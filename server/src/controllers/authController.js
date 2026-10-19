/**
 * Fluentiq Auth Controller
 * Lightweight, zero-friction authentication without email/phone verification.
 * Provides user accounts, XP/streak persistence, and personal progress tracking.
 */

const crypto = require('node:crypto');
const db = require('../db/schema');

const PASSWORD_SALT = process.env.AUTH_SALT || 'fluentiq_secret_salt_2026';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + PASSWORD_SALT).digest('hex');
}

function generateToken(user) {
  const payload = `${user.id}:${user.username}:${Date.now()}`;
  const sig = crypto.createHmac('sha256', PASSWORD_SALT).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64');
}

function generateRefreshToken(user) {
  const payload = `refresh:${user.id}:${Date.now()}`;
  const sig = crypto.createHmac('sha256', PASSWORD_SALT).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64');
}

function verifyToken(token) {
  try {
    const raw = Buffer.from(token, 'base64').toString('utf8');
    const parts = raw.split(':');
    if (parts.length !== 4) return null;
    const [userId, username, timestamp, sig] = parts;
    const payload = `${userId}:${username}:${timestamp}`;
    const expectedSig = crypto.createHmac('sha256', PASSWORD_SALT).update(payload).digest('hex');
    if (sig !== expectedSig) return null;
    return { userId, username };
  } catch (err) {
    return null;
  }
}

function verifyRefreshToken(token) {
  try {
    const raw = Buffer.from(token, 'base64').toString('utf8');
    const parts = raw.split(':');
    if (parts.length !== 4 || parts[0] !== 'refresh') return null;
    const [, userId, timestamp, sig] = parts;
    const payload = `refresh:${userId}:${timestamp}`;
    const expectedSig = crypto.createHmac('sha256', PASSWORD_SALT).update(payload).digest('hex');
    if (sig !== expectedSig) return null;
    return { userId };
  } catch (err) {
    return null;
  }
}

async function getUserFromReq(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const verified = verifyToken(token);
    if (verified) {
      const user = await db.prepare('SELECT id, username, xp, streak, created_at FROM users WHERE id = ?').get(verified.userId);
      if (user) return user;
    }
  }

  // Accept valid registered user ID from header, body, or query params (if user actually exists in DB)
  const customId = req.headers['x-user-id'] || req.body?.userId || req.query?.userId;
  if (customId && customId !== 'user_default' && customId !== 'guest_user') {
    const user = await db.prepare('SELECT id, username, xp, streak, created_at FROM users WHERE id = ?').get(customId);
    if (user) return user;
  }

  return null;
}

async function register(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || typeof username !== 'string' || username.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Имя пользователя должно содержать не менее 2 символов' });
    }
    if (!password || typeof password !== 'string' || password.length < 3) {
      return res.status(400).json({ success: false, error: 'Пароль должен содержать не менее 3 символов' });
    }

    const cleanUsername = username.trim();
    const existing = await db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(cleanUsername);
    if (existing) {
      return res.status(400).json({ success: false, error: 'Пользователь с таким именем уже зарегистрирован' });
    }

    const userId = 'usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const passHash = hashPassword(password);

    await db.prepare(`
      INSERT INTO users (id, username, password_hash, xp, streak, last_active_date)
      VALUES (?, ?, ?, 0, 1, date('now'))
    `).run(userId, cleanUsername, passHash);

    const user = {
      id: userId,
      username: cleanUsername,
      xp: 0,
      streak: 1,
      level: 1
    };

    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    res.json({
      success: true,
      message: 'Регистрация прошла успешно!',
      token,
      refreshToken,
      user
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function login(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Введите имя пользователя и пароль' });
    }

    const cleanUsername = username.trim();
    const userRow = await db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(cleanUsername);
    if (!userRow) {
      return res.status(401).json({ success: false, error: 'Пользователь не найден' });
    }

    const passHash = hashPassword(password);
    if (userRow.password_hash && userRow.password_hash !== passHash) {
      return res.status(401).json({ success: false, error: 'Неверный пароль' });
    }

    const streakService = require('../services/streakService');
    const dynamicStreak = await streakService.getUserStreak(userRow.id);
    if (dynamicStreak !== userRow.streak) {
      await db.prepare('UPDATE users SET streak = ? WHERE id = ?').run(dynamicStreak, userRow.id);
      userRow.streak = dynamicStreak;
    }

    const level = Math.floor(userRow.xp / 50) + 1;
    const user = {
      id: userRow.id,
      username: userRow.username,
      xp: userRow.xp,
      streak: dynamicStreak,
      level
    };

    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    res.json({
      success: true,
      message: 'С возвращением!',
      token,
      refreshToken,
      user
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function refreshAuth(req, res) {
  try {
    const candidate = req.body?.refreshToken || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.substring(7).trim() : null);
    if (!candidate) {
      return res.status(400).json({ success: false, error: 'Отсутствует токен обновления' });
    }

    let userId = null;
    const verifiedRef = verifyRefreshToken(candidate);
    if (verifiedRef) {
      userId = verifiedRef.userId;
    } else {
      const verifiedStd = verifyToken(candidate);
      if (verifiedStd) {
        userId = verifiedStd.userId;
      }
    }

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Недействительный токен' });
    }

    const userRow = await db.prepare('SELECT id, username, xp, streak FROM users WHERE id = ?').get(userId);
    if (!userRow) {
      return res.status(401).json({ success: false, error: 'Пользователь не найден' });
    }

    const streakService = require('../services/streakService');
    const dynamicStreak = await streakService.getUserStreak(userRow.id);
    if (dynamicStreak !== userRow.streak) {
      await db.prepare('UPDATE users SET streak = ? WHERE id = ?').run(dynamicStreak, userRow.id);
      userRow.streak = dynamicStreak;
    }

    const level = Math.floor(userRow.xp / 50) + 1;
    const user = {
      id: userRow.id,
      username: userRow.username,
      xp: userRow.xp,
      streak: dynamicStreak,
      level,
      isGuest: false
    };

    const newToken = generateToken(user);
    const newRefreshToken = generateRefreshToken(user);

    return res.json({
      success: true,
      token: newToken,
      refreshToken: newRefreshToken,
      user
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getMe(req, res) {
  try {
    const user = await getUserFromReq(req);
    if (!user) {
      return res.json({
        success: true,
        authenticated: false,
        user: null
      });
    }

    const level = Math.floor(user.xp / 50) + 1;
    res.json({
      success: true,
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        xp: user.xp,
        streak: user.streak,
        level,
        isGuest: false
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  register,
  login,
  refreshAuth,
  getMe,
  getUserFromReq
};

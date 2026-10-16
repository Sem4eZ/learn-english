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

async function getUserFromReq(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const verified = verifyToken(token);
    if (verified) {
      return await db.prepare('SELECT id, username, xp, streak, created_at FROM users WHERE id = ?').get(verified.userId);
    }
  }

  // Fallback to x-user-id header or user_default
  const customId = req.headers['x-user-id'] || 'user_default';
  return await db.prepare('SELECT id, username, xp, streak, created_at FROM users WHERE id = ?').get(customId);
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
    res.json({
      success: true,
      message: 'Регистрация прошла успешно!',
      token,
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

    const level = Math.floor(userRow.xp / 50) + 1;
    const user = {
      id: userRow.id,
      username: userRow.username,
      xp: userRow.xp,
      streak: userRow.streak,
      level
    };

    const token = generateToken(user);
    res.json({
      success: true,
      message: 'С возвращением!',
      token,
      user
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getMe(req, res) {
  try {
    const user = await getUserFromReq(req);
    if (!user) {
      // Default guest user
      const guestRow = await db.prepare("SELECT * FROM users WHERE id = 'guest_user'").get();
      if (!guestRow) {
        await db.prepare(`
          INSERT INTO users (id, username, xp, streak) VALUES ('guest_user', 'Гость', 0, 1)
        `).run();
      }
      return res.json({
        success: true,
        user: {
          id: 'guest_user',
          username: 'Гость',
          xp: guestRow ? guestRow.xp : 0,
          streak: guestRow ? guestRow.streak : 1,
          level: guestRow ? Math.floor(guestRow.xp / 50) + 1 : 1,
          isGuest: true
        }
      });
    }

    const level = Math.floor(user.xp / 50) + 1;
    res.json({
      success: true,
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
  getMe,
  getUserFromReq
};

const db = require('../db/schema');

function recordAnswer(req, res) {
  try {
    const userId = req.headers['x-user-id'] || req.body.userId || 'user_default';
    const { questionId, selectedIndex } = req.body;

    if (!questionId || selectedIndex === undefined) {
      return res.status(400).json({ success: false, error: 'questionId and selectedIndex are required' });
    }

    // Fetch question to check correctness
    const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId);
    if (!question) {
      return res.status(404).json({ success: false, error: 'Question not found' });
    }

    const isCorrect = question.correct_index === Number(selectedIndex);
    const xpReward = isCorrect ? 15 : 5;

    // Save user answer
    const insertAnswer = db.prepare(`
      INSERT INTO user_answers (user_id, question_id, selected_index, is_correct)
      VALUES (?, ?, ?, ?)
    `);
    insertAnswer.run(userId, questionId, selectedIndex, isCorrect ? 1 : 0);

    // Update user stats
    const todayStr = new Date().toISOString().slice(0, 10);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

    let streak = 1;
    let xp = xpReward;

    if (user) {
      xp = user.xp + xpReward;
      streak = user.streak || 1;

      if (user.last_active_date) {
        const last = new Date(user.last_active_date);
        const today = new Date(todayStr);
        const diffDays = Math.ceil(Math.abs(today - last) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          streak += 1;
        } else if (diffDays > 1) {
          streak = 1;
        }
      }

      db.prepare(`
        UPDATE users 
        SET xp = ?, streak = ?, last_active_date = ?
        WHERE id = ?
      `).run(xp, streak, todayStr, userId);
    } else {
      db.prepare(`
        INSERT INTO users (id, username, xp, streak, last_active_date)
        VALUES (?, 'Learner', ?, 1, ?)
      `).run(userId, xp, todayStr);
    }

    res.json({
      success: true,
      data: {
        isCorrect,
        correctIndex: question.correct_index,
        explanation: question.explanation,
        grammarRule: question.grammar_rule,
        pronunciationTip: question.pronunciation_tip,
        xpEarned: xpReward,
        totalXp: xp,
        streak
      }
    });
  } catch (err) {
    console.error('Error recording answer:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

function getStats(req, res) {
  try {
    const userId = req.query.userId || req.headers['x-user-id'] || 'user_default';
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) || {
      id: userId,
      username: 'Learner',
      xp: 0,
      streak: 1
    };

    const answerStats = db.prepare(`
      SELECT 
        COUNT(*) as total_answers,
        SUM(is_correct) as correct_answers
      FROM user_answers
      WHERE user_id = ?
    `).get(userId);

    const total = answerStats.total_answers || 0;
    const correct = answerStats.correct_answers || 0;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    // Section breakdown
    const sectionBreakdown = db.prepare(`
      SELECT 
        s.id,
        s.title,
        COUNT(ua.id) as attempted,
        SUM(ua.is_correct) as correct
      FROM sections s
      LEFT JOIN questions q ON s.id = q.section_id
      LEFT JOIN user_answers ua ON q.id = ua.question_id AND ua.user_id = ?
      GROUP BY s.id
    `).all(userId);

    // Calculate level info
    const xp = user.xp || 0;
    const level = Math.floor(Math.sqrt(xp / 50)) + 1;
    const currentBase = Math.pow(level - 1, 2) * 50;
    const nextBase = Math.pow(level, 2) * 50;
    const progressXP = xp - currentBase;
    const neededXP = nextBase - currentBase;
    const levelPercent = Math.min(100, Math.round((progressXP / neededXP) * 100));

    res.json({
      success: true,
      data: {
        user,
        xp,
        level,
        levelPercent,
        progressXP,
        neededXP,
        streak: user.streak || 1,
        totalAnswered: total,
        correctAnswered: correct,
        accuracy,
        sectionBreakdown
      }
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

function getHistory(req, res) {
  try {
    const userId = req.query.userId || req.headers['x-user-id'] || 'user_default';
    const mistakesOnly = req.query.mistakesOnly === 'true';

    let sql = `
      SELECT 
        ua.id, ua.selected_index, ua.is_correct, ua.answered_at,
        q.id as question_id, q.section_id, q.level, q.question_text, 
        q.options_json, q.correct_index, q.explanation, q.grammar_rule
      FROM user_answers ua
      JOIN questions q ON ua.question_id = q.id
      WHERE ua.user_id = ?
    `;

    if (mistakesOnly) {
      sql += ' AND ua.is_correct = 0 ';
    }

    sql += ' ORDER BY ua.id DESC LIMIT 50';

    const rows = db.prepare(sql).all(userId);

    const history = rows.map(r => ({
      ...r,
      options: JSON.parse(r.options_json)
    }));

    res.json({ success: true, data: history });
  } catch (err) {
    console.error('Error fetching history:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { recordAnswer, getStats, getHistory };

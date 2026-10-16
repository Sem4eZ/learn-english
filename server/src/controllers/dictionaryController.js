const db = require('../db/schema');

function getDictionary(req, res) {
  try {
    const { 
      search = '', 
      sectionId = '', 
      level = '', 
      favoritesOnly = 'false',
      page = 1,
      limit = 30 
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 30));
    const offset = (pageNum - 1) * limitNum;

    let whereClauses = [];
    let params = [];

    if (search.trim()) {
      whereClauses.push('(word LIKE ? OR translation LIKE ? OR definition LIKE ? OR example_sentence LIKE ?)');
      const pattern = `%${search.trim()}%`;
      params.push(pattern, pattern, pattern, pattern);
    }

    if (sectionId && sectionId !== 'all') {
      whereClauses.push('section_id = ?');
      params.push(sectionId);
    }

    if (level && level !== 'all') {
      whereClauses.push('level = ?');
      params.push(level);
    }

    if (favoritesOnly === 'true' || favoritesOnly === '1') {
      whereClauses.push('is_favorite = 1');
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM dictionary ${whereSql}`);
    const countRow = countStmt.get(...params);
    const total = countRow ? countRow.total : 0;

    const listStmt = db.prepare(`
      SELECT * FROM dictionary
      ${whereSql}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `);
    const data = listStmt.all(...params, limitNum, offset);

    res.json({
      success: true,
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1
      }
    });
  } catch (err) {
    console.error('Error fetching dictionary:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

function toggleFavorite(req, res) {
  try {
    const { id } = req.params;
    const stmt = db.prepare('UPDATE dictionary SET is_favorite = (CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END) WHERE id = ?');
    stmt.run(id);

    const updated = db.prepare('SELECT * FROM dictionary WHERE id = ?').get(id);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error toggling favorite:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function generateDictionaryWords(req, res) {
  try {
    const { level = 'B1', sectionId = 'general', count = 10 } = req.body;
    const countNum = Math.max(1, Math.min(20, parseInt(count, 10) || 10));
    
    const geminiService = require('../services/geminiService');
    const newWords = await geminiService.generateVocabulary(level, sectionId, countNum);

    const totalCount = db.prepare('SELECT COUNT(*) as count FROM dictionary').get().count;

    res.json({
      success: true,
      message: `Словарь пополнен на ${newWords.length} новых слов!`,
      data: newWords,
      totalCount
    });
  } catch (err) {
    console.error('Error generating dictionary words:', err.message);
    res.status(500).json({
      success: false,
      error: 'Не удалось пополнить словарь в данный момент. Повторите попытку через пару секунд.'
    });
  }
}

function recordSrsReview(req, res) {
  try {
    const { wordId, grade, userId = 'guest_user' } = req.body;
    const gradeNum = Math.max(1, Math.min(4, parseInt(grade, 10) || 1));

    if (!wordId) {
      return res.status(400).json({ success: false, error: 'wordId is required' });
    }

    // Ensure user exists in users table to satisfy FOREIGN KEY constraint
    const userRow = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!userRow) {
      db.prepare(`
        INSERT INTO users (id, username, xp, streak, last_active_date)
        VALUES (?, 'Learner', 0, 1, date('now'))
      `).run(userId);
    }

    // SM-2 Algorithm computation
    const existing = db.prepare('SELECT * FROM srs_reviews WHERE user_id = ? AND word_id = ?').get(userId, wordId);
    let reps = existing ? existing.reps : 0;
    let ef = existing ? existing.ef : 2.5;
    let interval = existing ? existing.interval : 0;

    const smGrade = gradeNum === 1 ? 1 : gradeNum === 2 ? 3 : gradeNum === 3 ? 4 : 5;
    let newEf = ef + (0.1 - (5 - smGrade) * (0.08 + (5 - smGrade) * 0.02));
    if (newEf < 1.3) newEf = 1.3;
    ef = Math.round(newEf * 100) / 100;

    let nextIntervalDays = 0;
    if (gradeNum === 1) {
      reps = 0;
      nextIntervalDays = 0;
    } else {
      if (reps === 0) {
        nextIntervalDays = gradeNum === 4 ? 3 : 1;
      } else if (reps === 1) {
        nextIntervalDays = gradeNum === 4 ? 6 : gradeNum === 3 ? 4 : 2;
      } else {
        const factor = gradeNum === 4 ? ef * 1.25 : gradeNum === 2 ? 1.15 : ef;
        nextIntervalDays = Math.max(1, Math.round(interval * factor));
      }
      reps += 1;
    }

    const now = new Date();
    const dueDate = new Date(now);
    if (nextIntervalDays === 0) {
      dueDate.setMinutes(dueDate.getMinutes() + 10);
    } else {
      dueDate.setDate(dueDate.getDate() + nextIntervalDays);
    }

    db.prepare(`
      INSERT INTO srs_reviews (user_id, word_id, grade, reps, interval, ef, due_date, reviewed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, word_id) DO UPDATE SET
        grade = excluded.grade,
        reps = excluded.reps,
        interval = excluded.interval,
        ef = excluded.ef,
        due_date = excluded.due_date,
        reviewed_at = excluded.reviewed_at
    `).run(userId, wordId, gradeNum, reps, nextIntervalDays, ef, dueDate.toISOString());

    // Award XP
    const xpReward = gradeNum === 4 ? 25 : gradeNum === 3 ? 15 : gradeNum === 2 ? 10 : 5;
    db.prepare(`UPDATE users SET xp = xp + ? WHERE id = ?`).run(xpReward, userId);

    res.json({
      success: true,
      data: {
        reps,
        interval: nextIntervalDays,
        ef,
        dueDate: dueDate.toISOString(),
        xpEarned: xpReward
      }
    });
  } catch (err) {
    console.error('Error recording SRS review:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  getDictionary,
  toggleFavorite,
  generateDictionaryWords,
  recordSrsReview
};

const db = require('../db/schema');
const geminiService = require('../services/geminiService');
const { getUserFromReq } = require('./authController');

async function getDictionary(req, res) {
  try {
    const authUser = await getUserFromReq(req);
    const { 
      search = '', 
      sectionId = '', 
      level = '', 
      favoritesOnly = 'false',
      mode = 'all',
      userId = authUser ? authUser.id : 'anonymous',
      page = 1, 
      limit = 30 
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(1000, parseInt(limit, 10) || 30));
    const offset = (pageNum - 1) * limitNum;

    let whereClauses = [];
    let params = [];

    if (search.trim()) {
      const cleanTerm = search.trim().toLowerCase();
      const pattern = `%${cleanTerm}%`;

      // Check if any words match word or translation directly
      const wordMatchCheck = await db.prepare(`
        SELECT COUNT(*) as count 
        FROM dictionary d 
        WHERE LOWER(d.word) LIKE ? OR LOWER(d.translation) LIKE ?
      `).get(pattern, pattern);

      if (wordMatchCheck && wordMatchCheck.count > 0) {
        // Strict match: word and translation only (eliminates noisy false positives from examples)
        whereClauses.push('(LOWER(d.word) LIKE ? OR LOWER(d.translation) LIKE ?)');
        params.push(pattern, pattern);
      } else {
        // Fallback match: if no direct word/translation matched, check definition & examples
        whereClauses.push('(LOWER(d.word) LIKE ? OR LOWER(d.translation) LIKE ? OR LOWER(d.definition) LIKE ? OR LOWER(d.example_sentence) LIKE ?)');
        params.push(pattern, pattern, pattern, pattern);
      }
    }

    if (sectionId && sectionId !== 'all') {
      whereClauses.push('d.section_id = ?');
      params.push(sectionId);
    }

    if (level && level !== 'all') {
      whereClauses.push('d.level = ?');
      params.push(level);
    }

    if (favoritesOnly === 'true' || favoritesOnly === '1') {
      whereClauses.push('d.is_favorite = 1');
    }

    let joinSql = 'LEFT JOIN srs_reviews s ON s.word_id = d.id AND s.user_id = ?';
    let orderBySql = 'ORDER BY d.id DESC';
    let orderParams = [];

    if (search.trim()) {
      const cleanTerm = search.trim().toLowerCase();
      orderBySql = `
        ORDER BY 
          CASE 
            WHEN LOWER(d.word) = ? THEN 1
            WHEN LOWER(d.word) LIKE ? THEN 2
            WHEN LOWER(d.translation) = ? THEN 3
            WHEN LOWER(d.translation) LIKE ? THEN 4
            WHEN LOWER(d.word) LIKE ? THEN 5
            WHEN LOWER(d.translation) LIKE ? THEN 6
            ELSE 7
          END ASC,
          LENGTH(d.word) ASC,
          d.id DESC
      `;
      orderParams = [
        cleanTerm,
        `${cleanTerm}%`,
        cleanTerm,
        `${cleanTerm}%`,
        `%${cleanTerm}%`,
        `%${cleanTerm}%`
      ];
    } else if (mode === 'practice') {
      // A word is eligible for practice if:
      // 1. It is brand new (never reviewed, s.id IS NULL)
      // 2. OR its repetition interval has elapsed (due_date <= now)
      whereClauses.push(`(s.id IS NULL OR datetime('now') >= datetime(s.due_date))`);
      orderBySql = `
        ORDER BY 
          CASE WHEN s.id IS NULL THEN 0 ELSE 1 END ASC,
          s.due_date ASC,
          d.id DESC
      `;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countParams = [userId, ...params];
    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM dictionary d ${joinSql} ${whereSql}`);
    let countRow = await countStmt.get(...countParams);
    let total = countRow ? countRow.total : 0;

    // Smart Auto-Enrichment:
    // If available practice words in DB are fewer than 30:
    // automatically generate and persist a fresh batch of 35 words!
    const isFilteredSearch = Boolean(search.trim()) || favoritesOnly === 'true' || favoritesOnly === '1';
    const VALID_CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const isLevelValid = !level || level === 'all' || VALID_CEFR.includes(level.toUpperCase());
    const validSections = ['all', '', 'general', 'grammar', 'business', 'conversational', 'ielts_toefl', 'phrasal_idioms', 'tech_it', 'travel'];
    const isSectionValid = !sectionId || validSections.includes(sectionId);

    if (!isFilteredSearch && total < 30 && isLevelValid && isSectionValid) {
      const targetLevel = (level && level !== 'all') ? level : 'A1';
      const targetSection = (sectionId && sectionId !== 'all') ? sectionId : 'general';
      const countToGenerate = 35;

      console.log(`[Auto-Enrichment] Found only ${total} words eligible for practice in level "${targetLevel}". Requesting generation (+${countToGenerate})...`);
      try {
        await geminiService.generateVocabulary(targetLevel, targetSection, countToGenerate);
        countRow = await countStmt.get(...countParams);
        total = countRow ? countRow.total : 0;
        console.log(`[Auto-Enrichment] Database replenished! New total eligible words: ${total}`);
      } catch (genErr) {
        console.warn('[Auto-Enrichment] Warning during background word generation:', genErr.message);
      }
    }

    const listParams = [userId, ...params, ...orderParams, limitNum, offset];

    const listStmt = db.prepare(`
      SELECT d.*, s.grade as srs_grade, s.reps as srs_reps, s.due_date as srs_due_date, s.interval as srs_interval
      FROM dictionary d
      ${joinSql}
      ${whereSql}
      ${orderBySql}
      LIMIT ? OFFSET ?
    `);
    const data = await listStmt.all(...listParams);

    // Total words matching filter in dictionary table (without practice due-date exclusion)
    let baseWhereClauses = [];
    let baseParams = [];
    if (search.trim()) {
      baseWhereClauses.push('(word LIKE ? OR translation LIKE ? OR definition LIKE ? OR example_sentence LIKE ?)');
      const pattern = `%${search.trim()}%`;
      baseParams.push(pattern, pattern, pattern, pattern);
    }
    if (sectionId && sectionId !== 'all') {
      baseWhereClauses.push('section_id = ?');
      baseParams.push(sectionId);
    }
    if (level && level !== 'all') {
      baseWhereClauses.push('level = ?');
      baseParams.push(level);
    }
    if (favoritesOnly === 'true' || favoritesOnly === '1') {
      baseWhereClauses.push('is_favorite = 1');
    }
    const baseWhereSql = baseWhereClauses.length > 0 ? `WHERE ${baseWhereClauses.join(' AND ')}` : '';
    const baseCountRow = await db.prepare(`SELECT COUNT(*) as count FROM dictionary ${baseWhereSql}`).get(...baseParams);
    const totalInDb = baseCountRow ? baseCountRow.count : 0;
    const totalOverallRow = await db.prepare('SELECT COUNT(*) as count FROM dictionary').get();
    const totalOverall = totalOverallRow ? totalOverallRow.count : 0;

    res.json({
      success: true,
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1,
        totalInDb,
        totalOverall
      }
    });
  } catch (err) {
    console.error('Error fetching dictionary:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function toggleFavorite(req, res) {
  try {
    const { id } = req.params;
    const stmt = db.prepare('UPDATE dictionary SET is_favorite = (CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END) WHERE id = ?');
    await stmt.run(id);

    const updated = await db.prepare('SELECT * FROM dictionary WHERE id = ?').get(id);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error toggling favorite:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function generateDictionaryWords(req, res) {
  try {
    const { level = 'A1', sectionId = 'general', count = 35 } = req.body;
    const countNum = Math.max(1, Math.min(50, parseInt(count, 10) || 35));
    
    const geminiService = require('../services/geminiService');
    const newWords = await geminiService.generateVocabulary(level, sectionId, countNum);

    const countRes = await db.prepare('SELECT COUNT(*) as count FROM dictionary').get();
    const totalCount = countRes ? countRes.count : 0;

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

async function recordSrsReview(req, res) {
  try {
    const { wordId, grade } = req.body || {};

    if (!wordId) {
      return res.status(400).json({ success: false, error: 'wordId is required' });
    }

    const user = await getUserFromReq(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Для интервального повторения и сохранения прогресса необходимо войти в аккаунт'
      });
    }
    const userId = user.id;
    const gradeNum = Math.max(1, Math.min(4, parseInt(grade, 10) || 1));

    // SM-2 Algorithm computation
    const existing = await db.prepare('SELECT * FROM srs_reviews WHERE user_id = ? AND word_id = ?').get(userId, wordId);
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
        // First correct answer: 1-3 days break before next repetition
        nextIntervalDays = gradeNum === 4 ? 3 : (gradeNum === 3 ? 2 : 1);
      } else if (reps === 1) {
        // Second correct answer: 3-6 days break
        nextIntervalDays = gradeNum === 4 ? 6 : (gradeNum === 3 ? 4 : 3);
      } else {
        const factor = gradeNum === 4 ? ef * 1.25 : gradeNum === 2 ? 1.15 : ef;
        nextIntervalDays = Math.max(2, Math.round(interval * factor));
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
    const formattedDueDate = dueDate.toISOString().replace('T', ' ').substring(0, 19);

    await db.prepare(`
      INSERT INTO srs_reviews (user_id, word_id, grade, reps, interval, ef, due_date, reviewed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, word_id) DO UPDATE SET
        grade = excluded.grade,
        reps = excluded.reps,
        interval = excluded.interval,
        ef = excluded.ef,
        due_date = excluded.due_date,
        reviewed_at = excluded.reviewed_at
    `).run(userId, wordId, gradeNum, reps, nextIntervalDays, ef, formattedDueDate);

    // Award XP immediately
    const xpReward = gradeNum === 4 ? 25 : gradeNum === 3 ? 15 : gradeNum === 2 ? 10 : 5;
    await db.prepare(`UPDATE users SET xp = xp + ? WHERE id = ?`).run(xpReward, userId);
    const updatedUser = await db.prepare('SELECT xp, streak FROM users WHERE id = ?').get(userId);

    res.json({
      success: true,
      data: {
        reps,
        interval: nextIntervalDays,
        ef,
        dueDate: dueDate.toISOString(),
        xpEarned: xpReward,
        totalXp: updatedUser ? updatedUser.xp : xpReward,
        streak: updatedUser ? updatedUser.streak : 1
      }
    });
  } catch (err) {
    console.error('Error recording SRS review:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function lookupWord(req, res) {
  try {
    const { word } = req.body;
    if (!word || !word.trim()) {
      return res.status(400).json({ success: false, error: 'Слово для поиска обязательно' });
    }

    const geminiService = require('../services/geminiService');
    const result = await geminiService.lookupAndDefineWord(word.trim());

    res.json({
      success: true,
      data: result.item,
      isNew: result.isNew,
      message: result.isNew 
        ? `Слово «${result.item.word}» найдено и добавлено в ваш словарь!`
        : `Слово «${result.item.word}» уже есть в вашем словаре`
    });
  } catch (err) {
    console.error('Error looking up word:', err.message);
    res.status(500).json({
      success: false,
      error: 'Не удалось найти слово. Проверьте правильность написания или повторите через пару секунд.'
    });
  }
}

module.exports = {
  getDictionary,
  toggleFavorite,
  generateDictionaryWords,
  recordSrsReview,
  lookupWord
};

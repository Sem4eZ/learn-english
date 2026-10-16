const db = require('../db/schema');
const geminiService = require('../services/geminiService');

async function getQuestions(req, res) {
  try {
    const { sectionId, level = 'B1', page = 1, limit = 5 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, Math.min(20, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    // Check whether querying specific section or all topics
    const isAll = !sectionId || sectionId === 'all';
    let totalInDb = 0;
    let rows = [];

    if (!isAll) {
      let countQuery = db.prepare('SELECT COUNT(*) as count FROM questions WHERE section_id = ? AND level = ?');
      totalInDb = countQuery.get(sectionId, level).count;

      if (totalInDb < offset + limitNum) {
        const needed = Math.max(limitNum, 5);
        try {
          await geminiService.generateQuestions(sectionId, level, needed);
        } catch (genErr) {
          console.warn('AI Generation warning:', genErr.message);
        }
        totalInDb = countQuery.get(sectionId, level).count;
      }

      const query = db.prepare(`
        SELECT 
          id, section_id, level, question_text, context_text, 
          options_json, correct_index, explanation, grammar_rule, pronunciation_tip, created_at
        FROM questions
        WHERE section_id = ? AND level = ?
        ORDER BY id ASC
        LIMIT ? OFFSET ?
      `);
      rows = query.all(sectionId, level, limitNum, offset);
    } else {
      let countQuery = db.prepare('SELECT COUNT(*) as count FROM questions WHERE level = ?');
      totalInDb = countQuery.get(level).count;

      if (totalInDb < offset + limitNum) {
        try {
          await geminiService.generateQuestions('grammar', level, 5);
        } catch (genErr) {
          console.warn('AI Generation warning:', genErr.message);
        }
        totalInDb = countQuery.get(level).count;
      }

      const query = db.prepare(`
        SELECT 
          id, section_id, level, question_text, context_text, 
          options_json, correct_index, explanation, grammar_rule, pronunciation_tip, created_at
        FROM questions
        WHERE level = ?
        ORDER BY id ASC
        LIMIT ? OFFSET ?
      `);
      rows = query.all(level, limitNum, offset);
    }

    const questions = rows.map(r => ({
      ...r,
      options: JSON.parse(r.options_json)
    }));

    res.json({
      success: true,
      data: questions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: Math.max(totalInDb, offset + limitNum + 10), // Infinite indicator
        hasMore: true // Infinite AI questions always has more!
      }
    });
  } catch (err) {
    console.error('Error fetching questions:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function generateBatch(req, res) {
  try {
    const { sectionId, level = 'B1', count = 5, customTopic = '' } = req.body;
    if (!sectionId) {
      return res.status(400).json({ success: false, error: 'sectionId is required' });
    }

    const countNum = Math.max(1, Math.min(10, parseInt(count, 10) || 5));
    const generated = await geminiService.generateQuestions(sectionId, level, countNum, customTopic);

    res.json({
      success: true,
      message: `Успешно сформировано ${generated.length} заданий`,
      data: generated
    });
  } catch (err) {
    console.error('Error in generateBatch:', err.message);
    res.status(503).json({ 
      success: false, 
      error: 'Сервер сейчас обрабатывает много запросов. Пожалуйста, повторите попытку через несколько секунд.' 
    });
  }
}

module.exports = { getQuestions, generateBatch };

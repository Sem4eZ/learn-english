const db = require('../db/schema');
const { getUserFromReq } = require('./authController');

async function recordAnswer(req, res) {
  try {
    const { questionId, selectedIndex } = req.body || {};

    if (!questionId || selectedIndex === undefined) {
      return res.status(400).json({ success: false, error: 'questionId and selectedIndex are required' });
    }

    const user = await getUserFromReq(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Для выполнения заданий и сохранения прогресса необходимо войти в аккаунт'
      });
    }
    const userId = user.id;

    // Fetch question to check correctness
    const question = await db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId);
    if (!question) {
      return res.status(404).json({ success: false, error: 'Question not found' });
    }

    const isCorrect = question.correct_index === Number(selectedIndex);
    const xpReward = isCorrect ? 15 : 0;

    // Update user stats
    const todayStr = new Date().toISOString().slice(0, 10);
    let streak = user.streak || 1;
    let xp = user.xp + xpReward;

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

    await db.prepare(`
      UPDATE users 
      SET xp = ?, streak = ?, last_active_date = ?
      WHERE id = ?
    `).run(xp, streak, todayStr, userId);

    // Save user answer
    const insertAnswer = db.prepare(`
      INSERT INTO user_answers (user_id, question_id, selected_index, is_correct)
      VALUES (?, ?, ?, ?)
    `);
    await insertAnswer.run(userId, questionId, selectedIndex, isCorrect ? 1 : 0);

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

async function getStats(req, res) {
  try {
    const user = await getUserFromReq(req);
    if (!user) {
      return res.json({
        success: true,
        data: {
          id: null,
          username: 'Гость',
          xp: 0,
          streak: 0,
          level: 1,
          levelPercent: 0,
          progressXP: 0,
          neededXP: 50,
          totalAnswered: 0,
          correctAnswered: 0,
          accuracy: 100,
          wordsStudied: 0,
          wordsDueForReview: 0,
          streakStatus: 'idle',
          streakDaysLeft: 0,
          weeklyActivity: [],
          trainerBreakdown: { grammar: 0, cards: 0, sprint: 0, quiz: 0, builder: 0, audio: 0 },
          sectionBreakdown: [],
          badges: []
        }
      });
    }

    const userId = user.id;

    // 1. Grammar answers stats
    const answerStats = (await db.prepare(`
      SELECT 
        COUNT(*) as total_answers,
        SUM(is_correct) as correct_answers
      FROM user_answers
      WHERE user_id = ?
    `).get(userId)) || {};

    const grammarTotal = answerStats.total_answers || 0;
    const grammarCorrect = answerStats.correct_answers || 0;
    const grammarAccuracy = grammarTotal > 0 ? Math.round((grammarCorrect / grammarTotal) * 100) : 0;

    // 2. Vocabulary SRS reviews stats
    const srsStats = (await db.prepare(`
      SELECT 
        COUNT(*) as total_reviews,
        SUM(CASE WHEN grade >= 3 THEN 1 ELSE 0 END) as successful_reviews
      FROM srs_reviews
      WHERE user_id = ?
    `).get(userId)) || {};

    const vocabTotal = srsStats.total_reviews || 0;
    const vocabCorrect = srsStats.successful_reviews || 0;
    const vocabAccuracy = vocabTotal > 0 ? Math.round((vocabCorrect / vocabTotal) * 100) : 0;

    // Combined totals
    const totalInteractions = grammarTotal + vocabTotal;
    const totalCorrectInteractions = grammarCorrect + vocabCorrect;
    const overallAccuracy = totalInteractions > 0 
      ? Math.round((totalCorrectInteractions / totalInteractions) * 100) 
      : (grammarAccuracy || vocabAccuracy || 100);

    // 3. Learned words dynamics (today, week, month)
    const todayRow = await db.prepare(`
      SELECT COUNT(DISTINCT word_id) as c 
      FROM srs_reviews 
      WHERE user_id = ? AND date(reviewed_at) = date('now')
    `).get(userId);
    const wordsToday = todayRow?.c || 0;

    const weekRow = await db.prepare(`
      SELECT COUNT(DISTINCT word_id) as c 
      FROM srs_reviews 
      WHERE user_id = ? AND date(reviewed_at) >= date('now', '-7 days')
    `).get(userId);
    const wordsThisWeek = weekRow?.c || 0;

    const monthRow = await db.prepare(`
      SELECT COUNT(DISTINCT word_id) as c 
      FROM srs_reviews 
      WHERE user_id = ? AND date(reviewed_at) >= date('now', '-30 days')
    `).get(userId);
    const wordsThisMonth = monthRow?.c || 0;

    const totalDictRow = await db.prepare('SELECT COUNT(*) as c FROM dictionary').get();
    const totalDictWords = totalDictRow?.c || 0;

    const learnedRow = await db.prepare(`
      SELECT COUNT(DISTINCT word_id) as c 
      FROM srs_reviews 
      WHERE user_id = ?
    `).get(userId);
    const totalWordsLearned = learnedRow?.c || 0;

    // 4. Memory stages (SRS distribution)
    const stages = (await db.prepare(`
      SELECT 
        SUM(CASE WHEN interval >= 21 THEN 1 ELSE 0 END) as mastered,
        SUM(CASE WHEN interval BETWEEN 3 AND 20 THEN 1 ELSE 0 END) as review,
        SUM(CASE WHEN interval < 3 THEN 1 ELSE 0 END) as learning
      FROM srs_reviews 
      WHERE user_id = ?
    `).get(userId)) || {};

    const masteredWords = stages.mastered || 0;
    const reviewWords = stages.review || 0;
    const learningWords = stages.learning || 0;
    const newWords = Math.max(0, totalDictWords - totalWordsLearned);

    // 5. CEFR level mastery breakdown
    const cefrRows = await db.prepare(`
      SELECT 
        d.level, 
        COUNT(DISTINCT d.id) as total,
        COUNT(DISTINCT s.word_id) as learned
      FROM dictionary d
      LEFT JOIN srs_reviews s ON d.id = s.word_id AND s.user_id = ?
      GROUP BY d.level
      ORDER BY 
        CASE d.level 
          WHEN 'A1' THEN 1 
          WHEN 'A2' THEN 2 
          WHEN 'B1' THEN 3 
          WHEN 'B2' THEN 4 
          WHEN 'C1' THEN 5 
          WHEN 'C2' THEN 6 
          ELSE 7 
        END
    `).all(userId);

    const cefrBreakdown = cefrRows.map(r => ({
      level: r.level || 'A1',
      total: r.total || 0,
      count: r.learned || 0,
      percent: r.total > 0 ? Math.round((r.learned / r.total) * 100) : 0
    }));

    // 6. 7-day Weekly activity
    const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const weeklyActivity = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayName = dayNames[d.getDay()];

      const wRow = await db.prepare(`
        SELECT COUNT(DISTINCT word_id) as c 
        FROM srs_reviews 
        WHERE user_id = ? AND date(reviewed_at) = ?
      `).get(userId, dateStr);
      const wCount = wRow?.c || 0;

      const aRow = await db.prepare(`
        SELECT COUNT(*) as c 
        FROM user_answers 
        WHERE user_id = ? AND date(answered_at) = ?
      `).get(userId, dateStr);
      const aCount = aRow?.c || 0;

      const count = wCount + aCount;
      const dayXp = count * 15;

      weeklyActivity.push({
        date: dateStr,
        day: dayName,
        words: wCount,
        count,
        xp: dayXp,
        isToday: i === 0
      });
    }

    // 7. Trainer performance breakdown
    const trainerBreakdown = [
      {
        id: 'vocab',
        name: 'Словарные карточки & Квизы',
        icon: 'ReadOutlined',
        attempted: vocabTotal,
        correct: vocabCorrect,
        accuracy: vocabAccuracy,
      },
      {
        id: 'grammar',
        name: 'Грамматические тесты',
        icon: 'FormOutlined',
        attempted: grammarTotal,
        correct: grammarCorrect,
        accuracy: grammarAccuracy,
      }
    ];

    // 8. Section breakdown
    const sectionBreakdown = await db.prepare(`
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

    // Level & XP calculations
    const xp = user.xp || 0;
    const level = Math.floor(Math.sqrt(xp / 50)) + 1;
    const currentBase = Math.pow(level - 1, 2) * 50;
    const nextBase = Math.pow(level, 2) * 50;
    const progressXP = xp - currentBase;
    const neededXP = nextBase - currentBase;
    const levelPercent = Math.min(100, Math.round((progressXP / neededXP) * 100));

    // Gamification titles based on level
    let rankTitle = 'Новичок (Novice)';
    if (level >= 15) rankTitle = 'Легенда (English Master)';
    else if (level >= 10) rankTitle = 'Полиглот (Polyglot)';
    else if (level >= 7) rankTitle = 'Эксперт (Proficient)';
    else if (level >= 5) rankTitle = 'Знаток (Fluent)';
    else if (level >= 3) rankTitle = 'Практик (Practitioner)';

    // Badges / Milestones earned
    const badges = [
      { id: 'first_step', title: 'Первый шаг', desc: 'Первая тренировка пройдена', icon: 'RocketOutlined', unlocked: totalInteractions > 0 },
      { id: 'words_50', title: 'Книжный червь', desc: 'Выучено более 50 слов', icon: 'BookOutlined', unlocked: totalWordsLearned >= 50 },
      { id: 'words_100', title: 'Словарный запас', desc: 'Выучено более 100 слов', icon: 'AppstoreOutlined', unlocked: totalWordsLearned >= 100 },
      { id: 'sniper', title: 'Снайпер точности', desc: 'Точность ответов выше 80%', icon: 'AimOutlined', unlocked: overallAccuracy >= 80 && totalInteractions >= 10 },
      { id: 'streak_3', title: 'Огненная серия', desc: 'Серия занятий от 2 дней', icon: 'FireOutlined', unlocked: (user.streak || 1) >= 2 },
      { id: 'level_5', title: 'Знаток языка', desc: 'Достигнут 5-й уровень', icon: 'TrophyOutlined', unlocked: level >= 5 },
      { id: 'memory_vault', title: 'Крепкая память', desc: 'Более 20 слов в повторении', icon: 'CrownOutlined', unlocked: (masteredWords + reviewWords) >= 20 }
    ];

    res.json({
      success: true,
      data: {
        user,
        xp,
        level,
        rankTitle,
        levelPercent,
        progressXP,
        neededXP,
        streak: user.streak || 1,
        totalAnswered: totalInteractions,
        correctAnswered: totalCorrectInteractions,
        accuracy: overallAccuracy,
        grammarTotal,
        grammarCorrect,
        grammarAccuracy,
        vocabTotal,
        vocabCorrect,
        vocabAccuracy,
        wordsToday,
        wordsThisWeek,
        wordsThisMonth,
        totalWordsLearned,
        totalDictWords,
        masteredWords,
        reviewWords,
        learningWords,
        newWords,
        cefrBreakdown,
        weeklyActivity,
        trainerBreakdown,
        sectionBreakdown,
        badges
      }
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getHistory(req, res) {
  try {
    const user = await getUserFromReq(req);
    if (!user) {
      return res.json({ success: true, data: [] });
    }
    const userId = user.id;
    const mistakesOnly = req.query.mistakesOnly === 'true';

    // 1. Fetch grammar answers
    let grammarSql = `
      SELECT 
        'grammar' as type,
        ua.id, ua.selected_index, ua.is_correct, ua.answered_at,
        q.id as question_id, q.section_id, q.level, q.question_text, 
        q.options_json, q.correct_index, q.explanation, q.grammar_rule,
        NULL as word, NULL as translation, NULL as transcription, NULL as srs_grade, NULL as reps
      FROM user_answers ua
      JOIN questions q ON ua.question_id = q.id
      WHERE ua.user_id = ?
    `;
    if (mistakesOnly) {
      grammarSql += ' AND ua.is_correct = 0 ';
    }

    // 2. Fetch vocabulary reviews
    let vocabSql = `
      SELECT 
        'vocab' as type,
        s.id, NULL as selected_index, 
        (CASE WHEN s.grade >= 3 THEN 1 ELSE 0 END) as is_correct,
        s.reviewed_at as answered_at,
        s.word_id as question_id, d.section_id, d.level, 
        d.word as question_text,
        NULL as options_json, NULL as correct_index,
        d.definition as explanation,
        d.example_sentence as grammar_rule,
        d.word, d.translation, d.transcription, s.grade as srs_grade, s.reps
      FROM srs_reviews s
      JOIN dictionary d ON s.word_id = d.id
      WHERE s.user_id = ?
    `;
    if (mistakesOnly) {
      vocabSql += ' AND s.grade <= 2 ';
    }

    const grammarRows = await db.prepare(grammarSql).all(userId);
    const vocabRows = await db.prepare(vocabSql).all(userId);

    // Merge and sort chronologically descending
    const merged = [...grammarRows, ...vocabRows].sort((a, b) => {
      const timeA = new Date(a.answered_at || 0).getTime();
      const timeB = new Date(b.answered_at || 0).getTime();
      return timeB - timeA;
    }).slice(0, 100);

    const history = merged.map(r => ({
      ...r,
      options: r.options_json ? JSON.parse(r.options_json) : []
    }));

    res.json({ success: true, data: history });
  } catch (err) {
    console.error('Error fetching history:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { recordAnswer, getStats, getHistory };

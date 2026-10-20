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

    // Save user answer
    const insertAnswer = db.prepare(`
      INSERT INTO user_answers (user_id, question_id, selected_index, is_correct)
      VALUES (?, ?, ?, ?)
    `);
    await insertAnswer.run(userId, questionId, selectedIndex, isCorrect ? 1 : 0);

    // Log to trainer_activity for granular trainer analytics and section attribution
    try {
      await db.prepare(`
        INSERT INTO trainer_activity (user_id, trainer_id, question_id, section_id, is_correct)
        VALUES (?, 'grammar', ?, ?, ?)
      `).run(userId, questionId, question.section_id, isCorrect ? 1 : 0);
    } catch (logErr) {
      console.warn('[recordAnswer] Note during trainer logging:', logErr.message);
    }

    // Update user stats & streak via centralized streakService
    const streakService = require('../services/streakService');
    const activityResult = await streakService.recordUserActivity(userId, xpReward);

    res.json({
      success: true,
      data: {
        isCorrect,
        correctIndex: question.correct_index,
        explanation: question.explanation,
        grammarRule: question.grammar_rule,
        pronunciationTip: question.pronunciation_tip,
        xpEarned: xpReward,
        totalXp: activityResult.xp,
        streak: activityResult.streak
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
          trainerBreakdown: [
            { id: 'grammar', name: 'Грамматический тренажер', icon: 'FormOutlined', attempted: 0, correct: 0, accuracy: 100 },
            { id: 'quiz', name: 'Тест на выбор (Квиз)', icon: 'AimOutlined', attempted: 0, correct: 0, accuracy: 100 },
            { id: 'sprint', name: 'Спринт слов', icon: 'ThunderboltOutlined', attempted: 0, correct: 0, accuracy: 100 },
            { id: 'builder', name: 'Конструктор слов', icon: 'AppstoreOutlined', attempted: 0, correct: 0, accuracy: 100 },
            { id: 'cards', name: 'Умные карточки (SRS)', icon: 'ReadOutlined', attempted: 0, correct: 0, accuracy: 100 },
            { id: 'audio', name: 'Аудиовызов', icon: 'SoundOutlined', attempted: 0, correct: 0, accuracy: 100 },
          ],
          sectionBreakdown: [],
          badges: require('../services/achievementsService').buildAchievementsList({})
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

    // 7. Trainer performance breakdown across all 6 modes
    const activityRows = (await db.prepare(`
      SELECT 
        trainer_id,
        COUNT(*) as attempted,
        SUM(is_correct) as correct
      FROM trainer_activity
      WHERE user_id = ?
      GROUP BY trainer_id
    `).all(userId)) || [];

    const activityMap = {};
    activityRows.forEach(r => {
      activityMap[r.trainer_id] = {
        attempted: Number(r.attempted) || 0,
        correct: Number(r.correct) || 0
      };
    });

    // Ensure grammar accounts for user_answers
    const grammarActs = activityMap['grammar'] || { attempted: 0, correct: 0 };
    const effectiveGrammarAttempted = Math.max(grammarTotal, grammarActs.attempted);
    const effectiveGrammarCorrect = Math.max(grammarCorrect, grammarActs.correct);

    // Sum of logged vocab trainer attempts
    const loggedVocabAttempted = ['quiz', 'sprint', 'builder', 'cards', 'audio'].reduce(
      (sum, id) => sum + (activityMap[id]?.attempted || 0), 0
    );

    // If historical vocabTotal > loggedVocabAttempted, attribute remainder to 'cards' so existing stats stay intact
    const cardsUnlogged = Math.max(0, vocabTotal - loggedVocabAttempted);
    const cardsActs = activityMap['cards'] || { attempted: 0, correct: 0 };
    const effectiveCardsAttempted = cardsActs.attempted + cardsUnlogged;
    const effectiveCardsCorrect = cardsActs.correct + Math.min(cardsUnlogged, Math.max(0, vocabCorrect - (activityMap['cards']?.correct || 0)));

    const trainerMap = {
      grammar: { attempted: effectiveGrammarAttempted, correct: effectiveGrammarCorrect },
      quiz: activityMap['quiz'] || { attempted: 0, correct: 0 },
      sprint: activityMap['sprint'] || { attempted: 0, correct: 0 },
      builder: activityMap['builder'] || { attempted: 0, correct: 0 },
      cards: { attempted: effectiveCardsAttempted, correct: effectiveCardsCorrect },
      audio: activityMap['audio'] || { attempted: 0, correct: 0 },
    };

    const trainerBreakdown = [
      {
        id: 'grammar',
        name: 'Грамматический тренажер',
        icon: 'FormOutlined',
        attempted: trainerMap.grammar.attempted,
        correct: trainerMap.grammar.correct,
        accuracy: trainerMap.grammar.attempted > 0 ? Math.round((trainerMap.grammar.correct / trainerMap.grammar.attempted) * 100) : 100,
      },
      {
        id: 'quiz',
        name: 'Тест на выбор (Квиз)',
        icon: 'AimOutlined',
        attempted: trainerMap.quiz.attempted,
        correct: trainerMap.quiz.correct,
        accuracy: trainerMap.quiz.attempted > 0 ? Math.round((trainerMap.quiz.correct / trainerMap.quiz.attempted) * 100) : 100,
      },
      {
        id: 'sprint',
        name: 'Спринт слов',
        icon: 'ThunderboltOutlined',
        attempted: trainerMap.sprint.attempted,
        correct: trainerMap.sprint.correct,
        accuracy: trainerMap.sprint.attempted > 0 ? Math.round((trainerMap.sprint.correct / trainerMap.sprint.attempted) * 100) : 100,
      },
      {
        id: 'builder',
        name: 'Конструктор слов',
        icon: 'AppstoreOutlined',
        attempted: trainerMap.builder.attempted,
        correct: trainerMap.builder.correct,
        accuracy: trainerMap.builder.attempted > 0 ? Math.round((trainerMap.builder.correct / trainerMap.builder.attempted) * 100) : 100,
      },
      {
        id: 'cards',
        name: 'Умные карточки (SRS)',
        icon: 'ReadOutlined',
        attempted: trainerMap.cards.attempted,
        correct: trainerMap.cards.correct,
        accuracy: trainerMap.cards.attempted > 0 ? Math.round((trainerMap.cards.correct / trainerMap.cards.attempted) * 100) : 100,
      },
      {
        id: 'audio',
        name: 'Аудиовызов',
        icon: 'SoundOutlined',
        attempted: trainerMap.audio.attempted,
        correct: trainerMap.audio.correct,
        accuracy: trainerMap.audio.attempted > 0 ? Math.round((trainerMap.audio.correct / trainerMap.audio.attempted) * 100) : 100,
      }
    ];

    // 8. Section breakdown: combines both grammar questions and trainer vocabulary attempts per topic
    const grammarSectionRows = (await db.prepare(`
      SELECT 
        s.id,
        s.title,
        COUNT(ua.id) as grammar_attempted,
        COALESCE(SUM(ua.is_correct), 0) as grammar_correct
      FROM sections s
      LEFT JOIN questions q ON s.id = q.section_id
      LEFT JOIN user_answers ua ON q.id = ua.question_id AND ua.user_id = ?
      GROUP BY s.id
    `).all(userId)) || [];

    // Word reviews per section from srs_reviews joined with dictionary
    const vocabSectionRows = (await db.prepare(`
      SELECT 
        d.section_id,
        COUNT(sr.id) as vocab_attempted,
        COALESCE(SUM(CASE WHEN sr.grade >= 3 THEN 1 ELSE 0 END), 0) as vocab_correct
      FROM dictionary d
      INNER JOIN srs_reviews sr ON d.id = sr.word_id AND sr.user_id = ?
      WHERE d.section_id IS NOT NULL AND d.section_id != ''
      GROUP BY d.section_id
    `).all(userId)) || [];

    // Also include trainer_activity where section_id is specified
    const activitySectionRows = (await db.prepare(`
      SELECT 
        section_id,
        COUNT(*) as act_attempted,
        COALESCE(SUM(is_correct), 0) as act_correct
      FROM trainer_activity
      WHERE user_id = ? AND section_id IS NOT NULL AND section_id != ''
      GROUP BY section_id
    `).all(userId)) || [];

    const vocabSectionMap = {};
    vocabSectionRows.forEach(r => {
      vocabSectionMap[r.section_id] = {
        vocab_attempted: Number(r.vocab_attempted) || 0,
        vocab_correct: Number(r.vocab_correct) || 0
      };
    });

    activitySectionRows.forEach(r => {
      const existing = vocabSectionMap[r.section_id] || { vocab_attempted: 0, vocab_correct: 0 };
      // Use max to gracefully support both srs_reviews and new trainer_activity logs without double-counting
      vocabSectionMap[r.section_id] = {
        vocab_attempted: Math.max(existing.vocab_attempted, Number(r.act_attempted) || 0),
        vocab_correct: Math.max(existing.vocab_correct, Number(r.act_correct) || 0)
      };
    });

    const sectionMapForAchievements = {};

    const sectionBreakdown = grammarSectionRows.map(row => {
      const v = vocabSectionMap[row.id] || { vocab_attempted: 0, vocab_correct: 0 };
      const gAttempted = Number(row.grammar_attempted) || 0;
      const gCorrect = Number(row.grammar_correct) || 0;
      const vAttempted = v.vocab_attempted;
      const vCorrect = v.vocab_correct;

      const totalAttempted = gAttempted + vAttempted;
      const totalCorrect = gCorrect + vCorrect;
      const accuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;

      sectionMapForAchievements[row.id] = {
        attempted: totalAttempted,
        correct: totalCorrect
      };

      return {
        id: row.id,
        title: row.title,
        attempted: totalAttempted,
        correct: totalCorrect,
        accuracy,
        grammarAttempted: gAttempted,
        vocabAttempted: vAttempted
      };
    });

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

    // Calculate dynamic streak and ensure DB is in sync
    const streakService = require('../services/streakService');
    const userStreak = await streakService.getUserStreak(userId);
    if (user.streak !== userStreak) {
      await db.prepare('UPDATE users SET streak = ? WHERE id = ?').run(userStreak, userId);
      user.streak = userStreak;
    }

    // Comprehensive 178 Achievements list
    const { buildAchievementsList } = require('../services/achievementsService');
    const badges = buildAchievementsList({
      wordsLearned: totalWordsLearned,
      streak: userStreak,
      level,
      xp,
      totalAnswers: totalInteractions,
      overallAccuracy,
      masteredWords,
      reviewWords,
      trainerStats: trainerMap,
      sectionStats: sectionMapForAchievements
    });

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
        streak: userStreak,
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

    // Fetch ONLY actual mistakes: incorrect grammar answers (is_correct = 0) and low-grade vocabulary reviews (grade <= 2)
    const grammarSql = `
      SELECT 
        'grammar' as type,
        ua.id, ua.selected_index, 0 as is_correct, ua.answered_at,
        q.id as question_id, q.section_id, q.level, q.question_text, 
        q.options_json, q.correct_index, q.explanation, q.grammar_rule,
        NULL as word, NULL as translation, NULL as transcription, NULL as srs_grade, NULL as reps
      FROM user_answers ua
      JOIN questions q ON ua.question_id = q.id
      WHERE ua.user_id = ? AND ua.is_correct = 0
    `;

    const vocabSql = `
      SELECT 
        'vocab' as type,
        s.id, NULL as selected_index, 
        0 as is_correct,
        s.reviewed_at as answered_at,
        s.word_id as question_id, d.section_id, d.level, 
        d.word as question_text,
        NULL as options_json, NULL as correct_index,
        d.definition as explanation,
        d.example_sentence as grammar_rule,
        d.word, d.translation, d.transcription, s.grade as srs_grade, s.reps
      FROM srs_reviews s
      JOIN dictionary d ON s.word_id = d.id
      WHERE s.user_id = ? AND s.grade <= 2
    `;

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

/**
 * LexiFlow Achievements Engine
 * 178 Gamified & Pedagogical Milestones across 8 Categories:
 * - vocab: 30 milestones (1 to 5,000 words)
 * - streak: 20 milestones (1 to 365 days)
 * - levels: 20 milestones (Level 2 to 50)
 * - xp: 20 milestones (50 to 200,000 XP)
 * - trainers: 36 milestones (6 per each of the 6 trainers)
 * - themes: 24 milestones (3 per each of the 8 curriculum sections)
 * - memory: 16 milestones (mastered & review retention)
 * - accuracy: 12 milestones (precision thresholds)
 */

const SECTIONS_CONFIG = [
  { id: 'general', title: 'Повседневный английский' },
  { id: 'grammar', title: 'Грамматика и конструкции' },
  { id: 'business', title: 'Деловой английский' },
  { id: 'tech_it', title: 'IT и разработка ПО' },
  { id: 'travel', title: 'Путешествия и город' },
  { id: 'phrasal_idioms', title: 'Фразовые глаголы и идиомы' },
  { id: 'conversational', title: 'Разговорный сленг' },
  { id: 'ielts_toefl', title: 'IELTS и TOEFL' }
];

const TRAINERS_CONFIG = [
  { id: 'grammar', name: 'Грамматика', icon: 'FormOutlined' },
  { id: 'quiz', name: 'Квиз', icon: 'AimOutlined' },
  { id: 'sprint', name: 'Спринт', icon: 'ThunderboltOutlined' },
  { id: 'builder', name: 'Конструктор', icon: 'AppstoreOutlined' },
  { id: 'cards', name: 'Карточки', icon: 'ReadOutlined' },
  { id: 'audio', name: 'Аудио', icon: 'SoundOutlined' }
];

const VOCAB_TIERS = [
  { target: 1, title: 'Первое слово', desc: 'Выучите 1 слово в словаре' },
  { target: 5, title: 'Любознательный', desc: 'Освойте 5 слов' },
  { target: 10, title: 'Старт в язык', desc: 'Освойте 10 слов' },
  { target: 15, title: 'Первый диалог', desc: 'Освойте 15 слов' },
  { target: 20, title: 'Базовый набор', desc: 'Освойте 20 слов' },
  { target: 25, title: 'Уверенный шаг', desc: 'Освойте 25 слов' },
  { target: 35, title: 'Словарный спринт', desc: 'Освойте 35 слов' },
  { target: 50, title: 'Книжный червь', desc: 'Освойте 50 слов' },
  { target: 75, title: 'Эрудит', desc: 'Освойте 75 слов' },
  { target: 100, title: 'Словарный запас', desc: 'Освойте 100 слов' },
  { target: 125, title: 'Лексический ритм', desc: 'Освойте 125 слов' },
  { target: 150, title: 'Свободный слог', desc: 'Освойте 150 слов' },
  { target: 200, title: 'Читатель прессы', desc: 'Освойте 200 слов' },
  { target: 250, title: 'Полиглот в пути', desc: 'Освойте 250 слов' },
  { target: 300, title: 'Разговорный запас', desc: 'Освойте 300 слов' },
  { target: 400, title: 'Уверенная речь', desc: 'Освойте 400 слов' },
  { target: 500, title: 'Лексический колосс', desc: 'Освойте 500 слов' },
  { target: 600, title: 'Мастер контекста', desc: 'Освойте 600 слов' },
  { target: 750, title: 'Глубокое погружение', desc: 'Освойте 750 слов' },
  { target: 1000, title: 'Клуб 1000 слов', desc: 'Освойте 1000 слов' },
  { target: 1250, title: 'Академический слог', desc: 'Освойте 1250 слов' },
  { target: 1500, title: 'Свободный слушатель', desc: 'Освойте 1500 слов' },
  { target: 1750, title: 'Блестящий лексикон', desc: 'Освойте 1750 слов' },
  { target: 2000, title: 'Властелин слов', desc: 'Освойте 2000 слов' },
  { target: 2500, title: 'Филолог', desc: 'Освойте 2500 слов' },
  { target: 3000, title: 'Уровень С1', desc: 'Освойте 3000 слов' },
  { target: 3500, title: 'Профессор', desc: 'Освойте 3500 слов' },
  { target: 4000, title: 'Живой словарь', desc: 'Освойте 4000 слов' },
  { target: 4500, title: 'Энциклопедист', desc: 'Освойте 4500 слов' },
  { target: 5000, title: 'Оксфордский эталон', desc: 'Освойте 5000 слов' }
];

const STREAK_TIERS = [
  { target: 1, title: 'Первая искра', desc: 'Занимайтесь 1 день' },
  { target: 2, title: 'Огонь горит', desc: 'Занимайтесь 2 дня подряд' },
  { target: 3, title: 'Тройной огонь', desc: 'Серия занятий 3 дня' },
  { target: 4, title: 'Привычка зреет', desc: 'Серия занятий 4 дня' },
  { target: 5, title: 'Рабочая неделя', desc: 'Серия занятий 5 дней' },
  { target: 6, title: 'Без остановок', desc: 'Серия занятий 6 дней' },
  { target: 7, title: 'Недельный триумф', desc: 'Серия занятий 7 дней подряд' },
  { target: 10, title: 'Десятидневка', desc: 'Серия занятий 10 дней' },
  { target: 14, title: 'Две недели побед', desc: 'Серия занятий 14 дней' },
  { target: 21, title: 'Железная привычка', desc: 'Серия занятий 21 день' },
  { target: 30, title: 'Месяц упорства', desc: 'Серия занятий 30 дней подряд' },
  { target: 45, title: 'Неукротимый', desc: 'Серия занятий 45 дней' },
  { target: 60, title: 'Два месяца силы', desc: 'Серия занятий 60 дней' },
  { target: 75, title: 'Титан регулярности', desc: 'Серия занятий 75 дней' },
  { target: 90, title: 'Квартал побед', desc: 'Серия занятий 90 дней' },
  { target: 120, title: 'Несокрушимый', desc: 'Серия занятий 120 дней' },
  { target: 150, title: 'Полгода силы', desc: 'Серия занятий 150 дней' },
  { target: 180, title: 'Стальной характер', desc: 'Серия занятий 180 дней' },
  { target: 270, title: 'Три сезона знаний', desc: 'Серия занятий 270 дней' },
  { target: 365, title: 'Год на вершине', desc: 'Серия занятий 365 дней подряд' }
];

const LEVEL_TIERS = [
  { target: 2, title: 'Ученик', desc: 'Достигните 2 уровня' },
  { target: 3, title: 'Практик', desc: 'Достигните 3 уровня' },
  { target: 4, title: 'Искатель', desc: 'Достигните 4 уровня' },
  { target: 5, title: 'Знаток', desc: 'Достигните 5 уровня' },
  { target: 6, title: 'Адепт', desc: 'Достигните 6 уровня' },
  { target: 7, title: 'Эксперт', desc: 'Достигните 7 уровня' },
  { target: 8, title: 'Магистр', desc: 'Достигните 8 уровня' },
  { target: 9, title: 'Наставник', desc: 'Достигните 9 уровня' },
  { target: 10, title: 'Полиглот', desc: 'Достигните 10 уровня' },
  { target: 12, title: 'Виртуоз', desc: 'Достигните 12 уровня' },
  { target: 14, title: 'Мыслитель', desc: 'Достигните 14 уровня' },
  { target: 16, title: 'Гранд-мастер', desc: 'Достигните 16 уровня' },
  { target: 18, title: 'Легенда языка', desc: 'Достигните 18 уровня' },
  { target: 20, title: 'Владыка грамматики', desc: 'Достигните 20 уровня' },
  { target: 25, title: 'Архимаг английского', desc: 'Достигните 25 уровня' },
  { target: 30, title: 'Олимп языка', desc: 'Достигните 30 уровня' },
  { target: 35, title: 'Гений мысли', desc: 'Достигните 35 уровня' },
  { target: 40, title: 'Верховный полиглот', desc: 'Достигните 40 уровня' },
  { target: 45, title: 'Абсолют знаний', desc: 'Достигните 45 уровня' },
  { target: 50, title: 'Бессмертный оратор', desc: 'Достигните 50 уровня' }
];

const XP_TIERS = [
  { target: 50, title: 'Первые искры XP', desc: 'Заработайте 50 XP' },
  { target: 100, title: 'Сотня опыта', desc: 'Заработайте 100 XP' },
  { target: 250, title: 'Четверть тысячи', desc: 'Заработайте 250 XP' },
  { target: 500, title: 'Половина тысячи', desc: 'Заработайте 500 XP' },
  { target: 1000, title: 'Тысячник', desc: 'Заработайте 1 000 XP' },
  { target: 2000, title: 'Две тысячи', desc: 'Заработайте 2 000 XP' },
  { target: 3500, title: 'Энергия знаний', desc: 'Заработайте 3 500 XP' },
  { target: 5000, title: 'Пять тысяч', desc: 'Заработайте 5 000 XP' },
  { target: 7500, title: 'Вдохновение', desc: 'Заработайте 7 500 XP' },
  { target: 10000, title: 'Десятитысячник', desc: 'Заработайте 10 000 XP' },
  { target: 15000, title: 'Пятнадцать тысяч', desc: 'Заработайте 15 000 XP' },
  { target: 20000, title: 'Двадцать тысяч', desc: 'Заработайте 20 000 XP' },
  { target: 30000, title: 'Тридцать тысяч', desc: 'Заработайте 30 000 XP' },
  { target: 40000, title: 'Сорок тысяч', desc: 'Заработайте 40 000 XP' },
  { target: 50000, title: 'Полсотни тысяч', desc: 'Заработайте 50 000 XP' },
  { target: 65000, title: 'Шестьдесят пять тысяч', desc: 'Заработайте 65 000 XP' },
  { target: 80000, title: 'Восемьдесят тысяч', desc: 'Заработайте 80 000 XP' },
  { target: 100000, title: 'Сто тысяч опыта', desc: 'Заработайте 100 000 XP' },
  { target: 150000, title: 'Сто пятьдесят тысяч', desc: 'Заработайте 150 000 XP' },
  { target: 200000, title: 'Двести тысяч XP', desc: 'Заработайте 200 000 XP' }
];

const TRAINER_COUNT_TIERS = [
  { target: 1, titleSuffix: ': Первый шаг', descSuffix: 'Пройдите 1 упражнение' },
  { target: 10, titleSuffix: ': Разминка', descSuffix: 'Дайте 10 верных ответов' },
  { target: 25, titleSuffix: ': Разгон', descSuffix: 'Дайте 25 верных ответов' },
  { target: 50, titleSuffix: ': Уверенность', descSuffix: 'Дайте 50 верных ответов' },
  { target: 100, titleSuffix: ': Профи', descSuffix: 'Дайте 100 верных ответов' },
  { target: 250, titleSuffix: ': Мастер режима', descSuffix: 'Дайте 250 верных ответов' }
];

const THEME_TIERS = [
  { target: 10, titleSuffix: ': Исследователь', descSuffix: 'Выполните 10 заданий в теме' },
  { target: 50, titleSuffix: ': Практик темы', descSuffix: 'Выполните 50 заданий в теме' },
  { target: 150, titleSuffix: ': Эксперт темы', descSuffix: 'Выполните 150 заданий в теме' }
];

const MEMORY_MASTERED_TIERS = [
  { target: 1, title: 'Первый якорь', desc: 'Закрепите 1 слово в долговременной памяти' },
  { target: 5, title: 'Крепкая память: 5', desc: 'Закрепите 5 слов (интервал 21+ дн.)' },
  { target: 10, title: 'Крепкая память: 10', desc: 'Закрепите 10 слов' },
  { target: 25, title: 'Склад памяти: 25', desc: 'Закрепите 25 слов' },
  { target: 50, title: 'Склад памяти: 50', desc: 'Закрепите 50 слов' },
  { target: 75, title: 'Золотой фонд: 75', desc: 'Закрепите 75 слов' },
  { target: 100, title: 'Железный архив: 100', desc: 'Закрепите 100 слов' },
  { target: 200, title: 'Монолит памяти: 200', desc: 'Закрепите 200 слов' }
];

const MEMORY_REVIEW_TIERS = [
  { target: 5, title: 'Круговорот слов: 5', desc: 'Удерживайте 5 слов в регулярном повторении' },
  { target: 15, title: 'Круговорот слов: 15', desc: 'Удерживайте 15 слов в повторении' },
  { target: 30, title: 'Активный цикл: 30', desc: 'Удерживайте 30 слов в повторении' },
  { target: 60, title: 'Активный цикл: 60', desc: 'Удерживайте 60 слов в повторении' },
  { target: 100, title: 'Поток повторений: 100', desc: 'Удерживайте 100 слов в повторении' },
  { target: 150, title: 'Поток повторений: 150', desc: 'Удерживайте 150 слов в повторении' },
  { target: 250, title: 'Океан памяти: 250', desc: 'Удерживайте 250 слов в повторении' },
  { target: 500, title: 'Океан памяти: 500', desc: 'Удерживайте 500 слов в повторении' }
];

const ACCURACY_TIERS = [
  { minAnswers: 10, targetPct: 70, title: 'Меткий глаз (70%)', desc: 'Точность от 70% при 10+ ответах' },
  { minAnswers: 10, targetPct: 75, title: 'Четкость (75%)', desc: 'Точность от 75% при 10+ ответах' },
  { minAnswers: 10, targetPct: 80, title: 'Снайпер (80%)', desc: 'Точность от 80% при 10+ ответах' },
  { minAnswers: 10, targetPct: 85, title: 'Меткий стрелок (85%)', desc: 'Точность от 85% при 10+ ответах' },
  { minAnswers: 10, targetPct: 90, title: 'Прецизионность (90%)', desc: 'Точность от 90% при 10+ ответах' },
  { minAnswers: 10, targetPct: 95, title: 'Безупречность (95%)', desc: 'Точность от 95% при 10+ ответах' },
  { minAnswers: 50, targetPct: 70, title: 'Стойкий стрелок (70%)', desc: 'Точность от 70% при 50+ ответах' },
  { minAnswers: 50, targetPct: 75, title: 'Стабильность (75%)', desc: 'Точность от 75% при 50+ ответах' },
  { minAnswers: 50, targetPct: 80, title: 'Мастер точности (80%)', desc: 'Точность от 80% при 50+ ответах' },
  { minAnswers: 50, targetPct: 85, title: 'Гроссмейстер точности (85%)', desc: 'Точность от 85% при 50+ ответах' },
  { minAnswers: 50, targetPct: 90, title: 'Хирург языка (90%)', desc: 'Точность от 90% при 50+ ответах' },
  { minAnswers: 50, targetPct: 95, title: 'Абсолютный снайпер (95%)', desc: 'Точность от 95% при 50+ ответах' }
];

function buildAchievementsList(userMetrics = {}) {
  const wordsLearned = userMetrics.wordsLearned ?? 0;
  const streak = userMetrics.streak ?? 0;
  const level = userMetrics.level ?? 1;
  const xp = userMetrics.xp ?? 0;
  const totalAnswers = userMetrics.totalAnswers ?? userMetrics.totalAnswered ?? 0;
  const overallAccuracy = userMetrics.overallAccuracy ?? userMetrics.accuracy ?? 0;
  const masteredWords = userMetrics.masteredWords ?? 0;
  const reviewWords = userMetrics.reviewWords ?? 0;
  const trainerStats = userMetrics.trainerStats || userMetrics.trainerCounts || {};
  const sectionStats = userMetrics.sectionStats || userMetrics.sectionCounts || {};

  const achievements = [];

  // 0. Classic Milestone: First Step
  achievements.push({
    id: 'first_step',
    category: 'trainers',
    categoryName: 'Первые шаги',
    title: 'Первый шаг',
    desc: 'Первая тренировка пройдена',
    icon: 'RocketOutlined',
    current: totalAnswers,
    target: 1,
    percent: totalAnswers > 0 ? 100 : 0,
    unlocked: totalAnswers > 0
  });

  // 1. Vocabulary (30)
  VOCAB_TIERS.forEach(t => {
    const cur = wordsLearned;
    const badgeId = t.target === 50 ? 'words_50' : t.target === 100 ? 'words_100' : `vocab_${t.target}`;
    achievements.push({
      id: badgeId,
      category: 'vocab',
      categoryName: 'Словарный запас',
      title: t.title,
      desc: t.desc,
      icon: 'BookOutlined',
      current: cur,
      target: t.target,
      percent: Math.min(100, Math.round((cur / t.target) * 100)),
      unlocked: cur >= t.target
    });
  });

  // 2. Streak (20)
  STREAK_TIERS.forEach(t => {
    const cur = streak;
    const badgeId = t.target === 2 ? 'streak_3' : `streak_${t.target}`;
    achievements.push({
      id: badgeId,
      category: 'streak',
      categoryName: 'Серии и дни',
      title: t.title,
      desc: t.desc,
      icon: 'FireOutlined',
      current: cur,
      target: t.target,
      percent: Math.min(100, Math.round((cur / t.target) * 100)),
      unlocked: cur >= t.target
    });
  });

  // 3. Levels (20)
  LEVEL_TIERS.forEach(t => {
    const cur = level;
    const badgeId = t.target === 5 ? 'level_5' : `lvl_${t.target}`;
    achievements.push({
      id: badgeId,
      category: 'levels',
      categoryName: 'Уровни и звания',
      title: t.title,
      desc: t.desc,
      icon: 'TrophyOutlined',
      current: cur,
      target: t.target,
      percent: Math.min(100, Math.round((cur / t.target) * 100)),
      unlocked: cur >= t.target
    });
  });

  // 4. XP (20)
  XP_TIERS.forEach(t => {
    const cur = xp;
    achievements.push({
      id: `xp_${t.target}`,
      category: 'xp',
      categoryName: 'Опыт (XP)',
      title: t.title,
      desc: t.desc,
      icon: 'ThunderboltOutlined',
      current: cur,
      target: t.target,
      percent: Math.min(100, Math.round((cur / t.target) * 100)),
      unlocked: cur >= t.target
    });
  });

  // 5. Trainers (36 = 6 trainers x 6 tiers)
  TRAINERS_CONFIG.forEach(tr => {
    const stat = trainerStats[tr.id] || { correct: 0, attempted: 0 };
    const cur = stat.correct || 0;
    TRAINER_COUNT_TIERS.forEach(tier => {
      achievements.push({
        id: `tr_${tr.id}_${tier.target}`,
        category: 'trainers',
        categoryName: 'Тренажеры',
        title: `${tr.name}${tier.titleSuffix}`,
        desc: `${tier.descSuffix} в тренажере «${tr.name}»`,
        icon: tr.icon,
        current: cur,
        target: tier.target,
        percent: Math.min(100, Math.round((cur / tier.target) * 100)),
        unlocked: cur >= tier.target
      });
    });
  });

  // 6. Themes / Sections (24 = 8 sections x 3 tiers)
  SECTIONS_CONFIG.forEach(sec => {
    const stat = sectionStats[sec.id] || { attempted: 0, correct: 0 };
    const cur = stat.attempted || 0;
    THEME_TIERS.forEach(tier => {
      achievements.push({
        id: `sec_${sec.id}_${tier.target}`,
        category: 'themes',
        categoryName: 'Тематические разделы',
        title: `${sec.title}${tier.titleSuffix}`,
        desc: `${tier.descSuffix} (${sec.title})`,
        icon: 'AppstoreOutlined',
        current: cur,
        target: tier.target,
        percent: Math.min(100, Math.round((cur / tier.target) * 100)),
        unlocked: cur >= tier.target
      });
    });
  });

  // 7. Memory & SRS (16: 8 mastered + 8 review)
  MEMORY_MASTERED_TIERS.forEach(t => {
    const cur = masteredWords;
    const badgeId = t.target === 25 ? 'memory_vault' : `mem_mastered_${t.target}`;
    achievements.push({
      id: badgeId,
      category: 'memory',
      categoryName: 'Долговременная память',
      title: t.title,
      desc: t.desc,
      icon: 'CrownOutlined',
      current: cur,
      target: t.target,
      percent: Math.min(100, Math.round((cur / t.target) * 100)),
      unlocked: cur >= t.target
    });
  });

  MEMORY_REVIEW_TIERS.forEach(t => {
    const cur = reviewWords;
    achievements.push({
      id: `mem_review_${t.target}`,
      category: 'memory',
      categoryName: 'Долговременная память',
      title: t.title,
      desc: t.desc,
      icon: 'RiseOutlined',
      current: cur,
      target: t.target,
      percent: Math.min(100, Math.round((cur / t.target) * 100)),
      unlocked: cur >= t.target
    });
  });

  // 8. Accuracy (12)
  ACCURACY_TIERS.forEach(t => {
    const meetsSample = totalAnswers >= t.minAnswers;
    const meetsPct = overallAccuracy >= t.targetPct;
    const cur = meetsSample ? overallAccuracy : 0;
    const badgeId = (t.minAnswers === 10 && t.targetPct === 80) ? 'sniper' : `acc_${t.minAnswers}_${t.targetPct}`;
    achievements.push({
      id: badgeId,
      category: 'accuracy',
      categoryName: 'Точность и мастерство',
      title: t.title,
      desc: t.desc,
      icon: 'AimOutlined',
      current: meetsSample ? overallAccuracy : totalAnswers,
      target: meetsSample ? t.targetPct : t.minAnswers,
      percent: meetsSample ? Math.min(100, Math.round((overallAccuracy / t.targetPct) * 100)) : Math.round((totalAnswers / t.minAnswers) * 100),
      unlocked: meetsSample && meetsPct
    });
  });

  return achievements;
}

module.exports = {
  buildAchievementsList,
  SECTIONS_CONFIG,
  TRAINERS_CONFIG
};

import { Section } from '@/entities/section/model/types';
import { DictionaryItem } from '@/entities/dictionary/model/types';
import { UserStats } from '@/entities/user/model/types';

export const FALLBACK_SECTIONS: Section[] = [
  {
    id: 'grammar',
    title: 'Грамматика и конструкции',
    description: 'Времена глаголов, Conditionals, пассивный залог и модальные конструкции.',
    icon: 'BookOutlined',
    default_level: 'B1',
    prompt_focus: 'English grammar, verb tenses, conditionals, passive voice'
  },
  {
    id: 'business',
    title: 'Деловой английский (Business & Career)',
    description: 'Переговоры, деловая переписка, презентации и корпоративная этика.',
    icon: 'RocketOutlined',
    default_level: 'B2',
    prompt_focus: 'Business English, negotiations, formal emails, presentations'
  },
  {
    id: 'tech_it',
    title: 'IT и Software Engineering',
    description: 'Код-ревью, архитектура ПО, терминология баг-трекинга и agile-митинги.',
    icon: 'CodeOutlined',
    default_level: 'B2',
    prompt_focus: 'IT, programming, pull requests, agile, architecture'
  },
  {
    id: 'travel',
    title: 'Путешествия и реальная жизнь',
    description: 'Аэропорты, бронирование отелей, рестораны и экстренные ситуации.',
    icon: 'CompassOutlined',
    default_level: 'A2',
    prompt_focus: 'Travel situations, airports, hotels, restaurants, directions'
  },
  {
    id: 'phrasal_idioms',
    title: 'Фразовые глаголы и идиомы',
    description: 'Живая разговорная речь носителей и устойчивые выражения.',
    icon: 'FireOutlined',
    default_level: 'B1',
    prompt_focus: 'Phrasal verbs, idioms, common expressions'
  },
  {
    id: 'conversational',
    title: 'Разговорный английский и сленг',
    description: 'Small talk, вежливые отказы, современный сленг и живые диалоги.',
    icon: 'CommentOutlined',
    default_level: 'B1',
    prompt_focus: 'Conversational English, casual speech, slang, small talk'
  },
  {
    id: 'ielts_toefl',
    title: 'Подготовка к IELTS и TOEFL',
    description: 'Академическая лексика, дискурсивные маркеры и сложные синтаксические конструкции.',
    icon: 'TrophyOutlined',
    default_level: 'C1',
    prompt_focus: 'Academic vocabulary, IELTS, TOEFL, essays'
  }
];

export const FALLBACK_WORDS: DictionaryItem[] = [
  {
    id: 1,
    word: "bottleneck",
    transcription: "/ˈbɒtlnek/",
    part_of_speech: "noun",
    translation: "узкое место, затор в процессе",
    definition: "A situation that causes delay in a process or system.",
    example_sentence: "The code review stage has become a major bottleneck for the team.",
    example_translation: "Этап код-ревью стал главным узким местом для команды.",
    level: "B2",
    section_id: "tech_it",
    is_favorite: 1,
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    word: "touch base",
    transcription: "/tʌtʃ beɪs/",
    part_of_speech: "phrase",
    translation: "кратко связаться, сверить часы",
    definition: "To make brief contact with someone to talk about progress.",
    example_sentence: "Let's touch base on Friday after the quarterly results are published.",
    example_translation: "Давай свяжемся в пятницу после публикации квартальных результатов.",
    level: "B2",
    section_id: "business",
    is_favorite: 1,
    created_at: new Date().toISOString()
  },
  {
    id: 3,
    word: "deprecate",
    transcription: "/ˈdeprəkeɪt/",
    part_of_speech: "verb",
    translation: "объявлять устаревшим (в коде)",
    definition: "To declare software or code obsolete and advise against its use.",
    example_sentence: "This legacy API endpoint has been deprecated in version 3.0.",
    example_translation: "Этот старый эндпоинт API был объявлен устаревшим в версии 3.0.",
    level: "B2",
    section_id: "tech_it",
    is_favorite: 0,
    created_at: new Date().toISOString()
  },
  {
    id: 4,
    word: "bite the bullet",
    transcription: "/baɪt ðə ˈbʊlɪt/",
    part_of_speech: "idiom",
    translation: "стиснуть зубы, решиться на сложный шаг",
    definition: "To decide to do something difficult that one has been putting off.",
    example_sentence: "I decided to bite the bullet and rewrite the whole legacy architecture.",
    example_translation: "Я решил стиснуть зубы и полностью переписать старую архитектуру.",
    level: "B2",
    section_id: "phrasal_idioms",
    is_favorite: 1,
    created_at: new Date().toISOString()
  },
  {
    id: 5,
    word: "seamless",
    transcription: "/ˈsiːmləs/",
    part_of_speech: "adjective",
    translation: "бесшовный, плавный, непрерывный",
    definition: "Smooth and continuous, with no obvious gaps or problems.",
    example_sentence: "The update provided a seamless transition to the new design system.",
    example_translation: "Обновление обеспечило плавный переход на новую систему дизайна.",
    level: "B2",
    section_id: "tech_it",
    is_favorite: 0,
    created_at: new Date().toISOString()
  },
  {
    id: 6,
    word: "breakthrough",
    transcription: "/ˈbreɪkθruː/",
    part_of_speech: "noun",
    translation: "прорыв, важное открытие",
    definition: "An important discovery or event that helps solve a problem.",
    example_sentence: "The team achieved a major breakthrough in optimizing load time.",
    example_translation: "Команда совершила большой прорыв в оптимизации времени загрузки.",
    level: "B1",
    section_id: "tech_it",
    is_favorite: 1,
    created_at: new Date().toISOString()
  },
  {
    id: 7,
    word: "resilient",
    transcription: "/rɪˈzɪliənt/",
    part_of_speech: "adjective",
    translation: "устойчивый, способный быстро восстанавливаться",
    definition: "Able to withstand or recover quickly from difficult conditions.",
    example_sentence: "Our microservice architecture is highly resilient to network failures.",
    example_translation: "Наша микросервисная архитектура высокоустойчива к сетевым сбоям.",
    level: "B2",
    section_id: "tech_it",
    is_favorite: 1,
    created_at: new Date().toISOString()
  },
  {
    id: 8,
    word: "ambiguous",
    transcription: "/æmˈbɪɡjuəs/",
    part_of_speech: "adjective",
    translation: "двусмысленный, неоднозначный",
    definition: "Open to more than one interpretation; not having one obvious meaning.",
    example_sentence: "The requirements in the ticket were too ambiguous for the QA team.",
    example_translation: "Требования в задаче были слишком двусмысленными для тестировщиков.",
    level: "B2",
    section_id: "business",
    is_favorite: 0,
    created_at: new Date().toISOString()
  },
  {
    id: 9,
    word: "feasibility",
    transcription: "/ˌfiːzəˈbɪləti/",
    part_of_speech: "noun",
    translation: "осуществимость, целесообразность",
    definition: "The state or degree of being easily or conveniently done.",
    example_sentence: "We need to conduct a feasibility study before starting production.",
    example_translation: "Нам нужно провести анализ целесообразности до запуска разработки.",
    level: "C1",
    section_id: "business",
    is_favorite: 0,
    created_at: new Date().toISOString()
  },
  {
    id: 10,
    word: "boarding pass",
    transcription: "/ˈbɔːdɪŋ pɑːs/",
    part_of_speech: "noun",
    translation: "посадочный талон",
    definition: "A pass for boarding an aircraft, given to passengers with a ticket.",
    example_sentence: "Please have your passport and boarding pass ready at gate 4.",
    example_translation: "Пожалуйста, приготовьте паспорт и посадочный талон у выхода номер 4.",
    level: "A2",
    section_id: "travel",
    is_favorite: 1,
    created_at: new Date().toISOString()
  },
  {
    id: 11,
    word: "layover",
    transcription: "/ˈleɪoʊvər/",
    part_of_speech: "noun",
    translation: "пересадка, остановка в пути",
    definition: "A period of rest or waiting before further travel.",
    example_sentence: "We had a four-hour layover in Istanbul before our connecting flight.",
    example_translation: "У нас была четырёхчасовая пересадка в Стамбуле перед стыковочным рейсом.",
    level: "A2",
    section_id: "travel",
    is_favorite: 0,
    created_at: new Date().toISOString()
  },
  {
    id: 12,
    word: "call it a day",
    transcription: "/kɔːl ɪt ə deɪ/",
    part_of_speech: "idiom",
    translation: "закругляться, закончить работу на сегодня",
    definition: "To stop what you are doing because you do not want to do any more.",
    example_sentence: "We have made great progress today, let's call it a day.",
    example_translation: "Мы отлично продвинулись сегодня, давайте закругляться.",
    level: "B1",
    section_id: "phrasal_idioms",
    is_favorite: 1,
    created_at: new Date().toISOString()
  },
  {
    id: 13,
    word: "bring up",
    transcription: "/brɪŋ ʌp/",
    part_of_speech: "phrase",
    translation: "поднять вопрос, затронуть тему",
    definition: "To mention or introduce a topic for discussion.",
    example_sentence: "I will bring up the release timeline at tomorrow's sync.",
    example_translation: "Я подниму вопрос сроков релиза на завтрашнем синке.",
    level: "B1",
    section_id: "phrasal_idioms",
    is_favorite: 0,
    created_at: new Date().toISOString()
  },
  {
    id: 14,
    word: "figure out",
    transcription: "/ˈfɪɡjər aʊt/",
    part_of_speech: "phrase",
    translation: "разобраться, понять, решить задачу",
    definition: "To find the answer to a problem or understand something.",
    example_sentence: "It took me an hour to figure out where the memory leak was.",
    example_translation: "Мне потребовался час, чтобы понять, где была утечка памяти.",
    level: "A2",
    section_id: "conversational",
    is_favorite: 1,
    created_at: new Date().toISOString()
  },
  {
    id: 15,
    word: "comprehensive",
    transcription: "/ˌkɒmprɪˈhensɪv/",
    part_of_speech: "adjective",
    translation: "всесторонний, исчерпывающий, комплексный",
    definition: "Complete and including everything that is necessary.",
    example_sentence: "The documentation provides a comprehensive guide to our API.",
    example_translation: "Документация содержит исчерпывающее руководство по нашему API.",
    level: "B2",
    section_id: "ielts_toefl",
    is_favorite: 1,
    created_at: new Date().toISOString()
  },
  {
    id: 16,
    word: "notwithstanding",
    transcription: "/ˌnɒtwɪθˈstændɪŋ/",
    part_of_speech: "preposition",
    translation: "несмотря на, вопреки",
    definition: "In spite of something.",
    example_sentence: "Notwithstanding the tight deadline, the project was delivered on time.",
    example_translation: "Несмотря на сжатые сроки, проект был сдан вовремя.",
    level: "C1",
    section_id: "ielts_toefl",
    is_favorite: 0,
    created_at: new Date().toISOString()
  },
  {
    id: 17,
    word: "mitigate",
    transcription: "/ˈmɪtɪɡeɪt/",
    part_of_speech: "verb",
    translation: "смягчать, снижать (риски, ущерб)",
    definition: "To make something less harmful, unpleasant, or bad.",
    example_sentence: "Proper error handling helps mitigate downtime during peak traffic.",
    example_translation: "Грамотная обработка ошибок помогает снизить время простоя при пиковых нагрузках.",
    level: "B2",
    section_id: "business",
    is_favorite: 1,
    created_at: new Date().toISOString()
  },
  {
    id: 18,
    word: "cut corners",
    transcription: "/kʌt ˈkɔːnərz/",
    part_of_speech: "idiom",
    translation: "халтурить, экономить в ущерб качеству",
    definition: "To do something in the easiest, cheapest, or fastest way, often sacrificing quality.",
    example_sentence: "Don't cut corners on security testing before going to production.",
    example_translation: "Не экономьте на тестах безопасности перед выходом в прод.",
    level: "B1",
    section_id: "phrasal_idioms",
    is_favorite: 0,
    created_at: new Date().toISOString()
  },
  {
    id: 19,
    word: "concise",
    transcription: "/kənˈsaɪs/",
    part_of_speech: "adjective",
    translation: "краткий, лаконичный, емкий",
    definition: "Giving a lot of information clearly and in a few words.",
    example_sentence: "Please make the pull request description concise and informative.",
    example_translation: "Пожалуйста, сделайте описание пул-реквеста кратким и информативным.",
    level: "B2",
    section_id: "business",
    is_favorite: 1,
    created_at: new Date().toISOString()
  },
  {
    id: 20,
    word: "clarify",
    transcription: "/ˈklærɪfaɪ/",
    part_of_speech: "verb",
    translation: "прояснить, внести ясность",
    definition: "To make something clear or easier to understand.",
    example_sentence: "Could you clarify what you mean by scalable architecture?",
    example_translation: "Не могли бы вы уточнить, что вы имеете в виду под масштабируемой архитектурой?",
    level: "A2",
    section_id: "conversational",
    is_favorite: 0,
    created_at: new Date().toISOString()
  }
];

export const FALLBACK_USER_STATS: UserStats = {
  user: {
    id: 'user_default',
    username: 'Learner',
    email: 'learner@example.com',
    xp: 120,
    streak: 2
  },
  xp: 120,
  level: 2,
  levelPercent: 40,
  progressXP: 20,
  neededXP: 50,
  streak: 2,
  totalAnswered: 24,
  correctAnswered: 21,
  accuracy: 88,
  rankTitle: 'Elementary (A2)',
  wordsToday: 8,
  wordsThisWeek: 20,
  totalWordsLearned: 15,
  totalDictWords: 20,
  masteredWords: 8,
  reviewWords: 5,
  learningWords: 7,
  newWords: 5,
  sectionBreakdown: [
    { id: 'grammar', title: 'Грамматика', attempted: 10, correct: 9 },
    { id: 'tech_it', title: 'IT & Software', attempted: 8, correct: 7 },
    { id: 'travel', title: 'Путешествия', attempted: 6, correct: 5 }
  ],
  cefrBreakdown: [
    { level: 'A1', count: 8, total: 8, percent: 100 },
    { level: 'A2', count: 6, total: 8, percent: 75 },
    { level: 'B1', count: 4, total: 8, percent: 50 },
    { level: 'B2', count: 2, total: 5, percent: 40 }
  ],
  weeklyActivity: [
    { day: 'Пн', date: '2026-10-12', xp: 30, count: 6, words: 4 },
    { day: 'Вт', date: '2026-10-13', xp: 20, count: 4, words: 3 },
    { day: 'Ср', date: '2026-10-14', xp: 40, count: 8, words: 5 },
    { day: 'Чт', date: '2026-10-15', xp: 15, count: 3, words: 2 },
    { day: 'Пт', date: '2026-10-16', xp: 15, count: 3, words: 1, isToday: true }
  ],
  badges: [
    { id: 'first_step', title: 'Первый шаг', desc: 'Завершите первое упражнение', unlocked: true, icon: '🎯' },
    { id: 'vocabulary_builder', title: 'Эрудит', desc: 'Изучите 10 слов', unlocked: true, icon: '📚' },
    { id: 'streak_master', title: 'Огонь', desc: 'Серия 3 дня подряд', unlocked: false, icon: '🔥' }
  ]
};

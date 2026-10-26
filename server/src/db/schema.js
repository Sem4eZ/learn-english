/**
 * Fluentiq Database Engine
 * Dual-Mode Data Persistence with Automatic Resilient Failover:
 * 1. Cloud Serverless libSQL (Turso): Active when TURSO_DATABASE_URL is set (Render/Production)
 *    - Zero sleep / persistent across all deployments & spin-downs
 *    - 9 GB free storage for millions of vocabulary words and user progress
 * 2. High-performance native SQLite (Node 22 built-in): Active locally / in offline tests / automatic failover
 * 
 * Provides unified async interface with backward-compatible synchronous fallback for tests.
 */

const fs = require('fs');
const path = require('path');

const TURSO_DATABASE_URL = (process.env.TURSO_DATABASE_URL || '').trim();
const TURSO_AUTH_TOKEN = (process.env.TURSO_AUTH_TOKEN || '').trim();

// Detect whether URL is set and is not a placeholder
const isPlaceholder = TURSO_DATABASE_URL.includes('твоеимя') || 
                      TURSO_DATABASE_URL.includes('yourname') || 
                      TURSO_DATABASE_URL.includes('your-db');

const isForceLocal = process.env.FORCE_LOCAL_DB === 'true' || 
                     process.env.USE_TURSO === 'false' || 
                     process.env.TURSO_ENABLED === 'false';

const shouldAttemptTurso = Boolean(TURSO_DATABASE_URL) && !isPlaceholder && !isForceLocal;

// Standard curriculum sections
const seedSections = [
  {
    id: "grammar",
    title: "Грамматика и конструкции (Grammar & Tenses)",
    description: "Времена глаголов, условные предложения (Conditionals), пассивный залог, инверсия и модальные глаголы.",
    icon: "BookOutlined",
    default_level: "B1",
    prompt_focus: "English grammar, verb tenses, conditionals (0, 1st, 2nd, 3rd, mixed), passive voice, reported speech, subjunctive mood, inversion, modal verbs, prepositions."
  },
  {
    id: "business",
    title: "Деловой английский (Business & Career)",
    description: "Переговоры, деловая переписка, презентации, корпоративная этика, собеседования и лидерство.",
    icon: "RocketOutlined",
    default_level: "B2",
    prompt_focus: "Business English, negotiations, contract terminology, formal business email etiquette, pitching, board meetings, conflict resolution, management and corporate diplomacy."
  },
  {
    id: "tech_it",
    title: "IT и Software Engineering",
    description: "Код-ревью, архитектура ПО, DevOps, терминология баг-трекинга, standup-митинги и agile-коммуникация.",
    icon: "CodeOutlined",
    default_level: "B2",
    prompt_focus: "IT and software engineering English, pull request reviews, system architecture discussions, agile terminology (standups, sprints, retros), cloud infrastructure, debugging discussions."
  },
  {
    id: "travel",
    title: "Путешествия и реальная жизнь (Travel & Living)",
    description: "Аэропорты, бронирование отелей, рестораны, экстренные ситуации, ориентирование в городе и покупки.",
    icon: "CompassOutlined",
    default_level: "A2",
    prompt_focus: "Everyday travel scenarios, airport customs, flight delays, hotel reservations, ordering food in restaurants, asking directions, emergency phrases, medical assistance."
  },
  {
    id: "phrasal_idioms",
    title: "Фразовые глаголы и идиомы (Phrasal Verbs & Idioms)",
    description: "Живая разговорная речь носителей, устойчивые выражения, фразовые глаголы и ложные друзья переводчика.",
    icon: "FireOutlined",
    default_level: "B1",
    prompt_focus: "English phrasal verbs, common idioms, collocations, false friends (false cognates), natural colloquial expressions used by native speakers."
  },
  {
    id: "conversational",
    title: "Разговорный английский и сленг (Conversational & Slang)",
    description: "Small talk, вежливые отказы, выражение сомнения, современный сленг и культурные контексты общения.",
    icon: "CommentOutlined",
    default_level: "B1",
    prompt_focus: "Conversational English, casual speech, polite disagreements, expressing nuanced feelings, modern slang, humor, nuances of tone (formal vs informal)."
  },
  {
    id: "ielts_toefl",
    title: "Подготовка к IELTS и TOEFL (Academic English)",
    description: "Академическая лексика, дискурсивные маркеры, сложные синтаксические конструкции и эссе.",
    icon: "TrophyOutlined",
    default_level: "C1",
    prompt_focus: "IELTS and TOEFL academic vocabulary, linking words, complex compound sentence structures, paraphrasing, academic argument analysis."
  }
];

// Seed dictionary words
const seedWords = [
  {
    word: "bottleneck",
    transcription: "/ˈbɒtlnek/",
    part_of_speech: "noun",
    translation: "узкое место, затор в процессе",
    definition: "A situation that causes delay in a process or system.",
    example_sentence: "The code review stage has become a major bottleneck for the development team.",
    example_translation: "Этап код-ревью стал главным узким местом для команды разработки.",
    level: "B2",
    section_id: "tech_it",
    is_favorite: 1
  },
  {
    word: "touch base",
    transcription: "/tʌtʃ beɪs/",
    part_of_speech: "phrase",
    translation: "кратко связаться, сверить часы",
    definition: "To make brief contact with someone to talk about progress.",
    example_sentence: "Let's touch base on Friday after the quarterly results are published.",
    example_translation: "Давай свяжемся в пятницу после публикации квартальных результатов.",
    level: "B2",
    section_id: "business",
    is_favorite: 1
  },
  {
    word: "deprecate",
    transcription: "/ˈdeprəkeɪt/",
    part_of_speech: "verb",
    translation: "объявлять устаревшим (в ПО)",
    definition: "To declare software or code obsolete and advise against its use.",
    example_sentence: "This legacy API endpoint has been deprecated in version 3.0.",
    example_translation: "Этот старый эндпоинт API был объявлен устаревшим в версии 3.0.",
    level: "B2",
    section_id: "tech_it",
    is_favorite: 0
  },
  {
    word: "bite the bullet",
    transcription: "/baɪt ðə ˈbʊlɪt/",
    part_of_speech: "idiom",
    translation: "стиснуть зубы, решиться на трудный шаг",
    definition: "To decide to do something difficult or unpleasant that one has been putting off.",
    example_sentence: "I decided to bite the bullet and rewrite the whole legacy architecture.",
    example_translation: "Я решил стиснуть зубы и полностью переписать старую архитектуру.",
    level: "B2",
    section_id: "phrasal_idioms",
    is_favorite: 1
  },
  {
    word: "no-brainer",
    transcription: "/nəʊ ˈbreɪnər/",
    part_of_speech: "noun (slang)",
    translation: "очевидное, элементарное решение",
    definition: "A decision that is exceptionally easy or obvious to make.",
    example_sentence: "Upgrading to a faster cloud tier with 50% discount was a complete no-brainer.",
    example_translation: "Переход на более быстрый облачный тариф со скидкой 50% был абсолютно очевидным решением.",
    level: "B1",
    section_id: "conversational",
    is_favorite: 0
  },
  {
    word: "cut corners",
    transcription: "/kʌt ˈkɔːnəz/",
    part_of_speech: "idiom",
    translation: "халтурить, срезать углы в ущерб качеству",
    definition: "To do something in the easiest or cheapest way, usually reducing quality.",
    example_sentence: "Never cut corners on automated testing and security audits.",
    example_translation: "Никогда не экономьте на автоматизированном тестировании и проверках безопасности.",
    level: "B1",
    section_id: "business",
    is_favorite: 0
  },
  {
    word: "layover",
    transcription: "/ˈleɪˌəʊvər/",
    part_of_speech: "noun",
    translation: "пересадка между рейсами",
    definition: "A period of rest or waiting before continuing a trip by air or train.",
    example_sentence: "We had a five-hour layover in Frankfurt before flying to New York.",
    example_translation: "У нас была пятичасовая пересадка во Франкфурте перед вылетом в Нью-Йорк.",
    level: "A2",
    section_id: "travel",
    is_favorite: 0
  },
  {
    word: "boarding pass",
    transcription: "/ˈbɔːdɪŋ pɑːs/",
    part_of_speech: "noun",
    translation: "посадочный талон",
    definition: "A pass that authorizes a passenger to board an aircraft.",
    example_sentence: "Please have your passport and boarding pass ready at gate 14.",
    example_translation: "Пожалуйста, приготовьте паспорт и посадочный талон у выхода на посадку 14.",
    level: "A2",
    section_id: "travel",
    is_favorite: 0
  },
  {
    word: "mitigate",
    transcription: "/ˈmɪtɪɡeɪt/",
    part_of_speech: "verb",
    translation: "смягчать, минимизировать риски",
    definition: "To make something less severe, harmful, or painful.",
    example_sentence: "Implementing automated backups helped mitigate the risk of catastrophic data loss.",
    example_translation: "Внедрение автоматических бэкапов помогло минимизировать риск катастрофической потери данных.",
    level: "C1",
    section_id: "ielts_toefl",
    is_favorite: 1
  },
  {
    word: "resilient",
    transcription: "/rɪˈzɪliənt/",
    part_of_speech: "adjective",
    translation: "отказоустойчивый, стойкий",
    definition: "Able to withstand or recover quickly from difficult conditions.",
    example_sentence: "Microservice architectures are designed to be resilient to unexpected network failures.",
    example_translation: "Микросервисные архитектуры спроектированы так, чтобы быть устойчивыми к неожиданным сетевым сбоям.",
    level: "B2",
    section_id: "tech_it",
    is_favorite: 1
  },
  {
    word: "turn down",
    transcription: "/tɜːn daʊn/",
    part_of_speech: "phrasal verb",
    translation: "отклонять, отвергать предложение",
    definition: "To refuse or decline a request or an offer.",
    example_sentence: "He turned down the job offer because the commute was too exhausting.",
    example_translation: "Он отклонил предложение о работе, так как дорога была слишком утомительной.",
    level: "B1",
    section_id: "phrasal_idioms",
    is_favorite: 0
  },
  {
    word: "look forward to",
    transcription: "/lʊk ˈfɔːwəd tuː/",
    part_of_speech: "phrasal verb",
    translation: "с нетерпением ждать чего-либо",
    definition: "To feel pleased and excited about something that is going to happen.",
    example_sentence: "I look forward to collaborating with your engineering department.",
    example_translation: "С нетерпением жду сотрудничества с вашим инженерным отделом.",
    level: "B1",
    section_id: "grammar",
    is_favorite: 0
  },
  {
    word: "compelling",
    transcription: "/kəmˈpelɪŋ/",
    part_of_speech: "adjective",
    translation: "убедительный, веский, захватывающий",
    definition: "Evoking interest, attention, or admiration in a powerfully irresistible way.",
    example_sentence: "The researcher presented compelling empirical evidence supporting her hypothesis.",
    example_translation: "Исследователь представила убедительные эмпирические доказательства в поддержку своей гипотезы.",
    level: "C1",
    section_id: "ielts_toefl",
    is_favorite: 0
  },
  {
    word: "catch-22",
    transcription: "/kætʃ ˌtwenti ˈtuː/",
    part_of_speech: "noun",
    translation: "замкнутый круг, безвыходная дилемма",
    definition: "A dilemma or difficult circumstance from which there is no escape because of mutually conflicting conditions.",
    example_sentence: "You need experience to get a job, but you need a job to get experience — a classic catch-22.",
    example_translation: "Нужен опыт, чтобы получить работу, но нужна работа, чтобы получить опыт — классический замкнутый круг.",
    level: "B2",
    section_id: "conversational",
    is_favorite: 1
  },
  {
    word: "hands down",
    transcription: "/hændz daʊn/",
    part_of_speech: "adverb",
    translation: "безусловно, вне всяких сомнений",
    definition: "Easily and indisputably; without question.",
    example_sentence: "That was hands down the most informative presentation of the entire conference.",
    example_translation: "Это была безусловно самая информативная презентация на всей конференции.",
    level: "B1",
    section_id: "conversational",
    is_favorite: 0
  }
];

const seedQuestions = [
  // --- A1 (Beginner) ---
  {
    section_id: 'grammar',
    level: 'A1',
    question_text: 'She _____ a student at the local college.',
    context_text: 'Present Simple: формы глагола to be (am/is/are).',
    options_json: JSON.stringify(['is', 'are', 'am', 'be']),
    correct_index: 0,
    explanation: 'С местоимениями he, she, it в настоящем времени используется форма глагола to be — "is".',
    grammar_rule: 'To be in Present Simple: He/She/It + is',
    pronunciation_tip: 'Глагол "is" произносится со звонким звуком /ɪz/'
  },
  {
    section_id: 'grammar',
    level: 'A1',
    question_text: 'They _____ in a big house near the park.',
    context_text: 'Present Simple: утвердительные предложения во множественном числе.',
    options_json: JSON.stringify(['live', 'lives', 'living', 'are live']),
    correct_index: 0,
    explanation: 'С местоимениями they, we, you, I глагол в Present Simple используется в базовой форме без окончания -s.',
    grammar_rule: 'Subject (I/You/We/They) + V1 (base form)',
    pronunciation_tip: '"live" как глагол произносится с кратким гласным /lɪv/'
  },
  {
    section_id: 'grammar',
    level: 'A1',
    question_text: 'There _____ three books on the wooden table.',
    context_text: 'Конструкция There is / There are для множественного числа.',
    options_json: JSON.stringify(['are', 'is', 'be', 'have']),
    correct_index: 0,
    explanation: 'Для указания на несколько предметов (three books) используется конструкция "There are".',
    grammar_rule: 'There are + plural noun',
    pronunciation_tip: 'Связка "There are" произносится слитно: /ðeər ɑːr/'
  },
  {
    section_id: 'grammar',
    level: 'A1',
    question_text: 'He doesn\'t _____ coffee in the evening.',
    context_text: 'Present Simple: отрицание с вспомогательным глаголом doesn\'t.',
    options_json: JSON.stringify(['drink', 'drinks', 'drinking', 'drank']),
    correct_index: 0,
    explanation: 'После отрицательного вспомогательного глагола doesn\'t основной глагол всегда ставится в начальной форме (без -s).',
    grammar_rule: 'doesn\'t + bare infinitive (drink)',
    pronunciation_tip: 'В слове "doesn\'t" ударение на первый слог: /ˈdʌznt/'
  },
  {
    section_id: 'grammar',
    level: 'A1',
    question_text: 'Where _____ your parents live?',
    context_text: 'Present Simple: специальный вопрос с вспомогательным глаголом do.',
    options_json: JSON.stringify(['do', 'does', 'are', 'is']),
    correct_index: 0,
    explanation: 'Подлежащее "your parents" во множественном числе (они / they), поэтому вспомогательный глагол — "do".',
    grammar_rule: 'Question word + do + Subject (plural) + V1?',
    pronunciation_tip: 'Вопросительное слово "Where" произносится как /weər/'
  },

  // --- A2 (Elementary) ---
  {
    section_id: 'grammar',
    level: 'A2',
    question_text: 'Yesterday we _____ to a cozy Italian restaurant.',
    context_text: 'Past Simple: неправильный глагол go (прошедшее время).',
    options_json: JSON.stringify(['went', 'go', 'goed', 'have gone']),
    correct_index: 0,
    explanation: 'Глагол "go" — неправильный. Вторая форма (Past Simple) для завершенного действия в прошлом (yesterday) — "went".',
    grammar_rule: 'Past Simple: irregular verb go -> went',
    pronunciation_tip: 'Слово "went" произносится с четким звуком /w/: /went/'
  },
  {
    section_id: 'grammar',
    level: 'A2',
    question_text: 'While I was reading, my brother _____ dinner.',
    context_text: 'Past Continuous & Past Simple: параллельные действия в прошлом.',
    options_json: JSON.stringify(['was cooking', 'cooked', 'cooks', 'is cooking']),
    correct_index: 0,
    explanation: 'Для двух одновременных длительных процессов в прошлом используется Past Continuous в обеих частях (was reading / was cooking).',
    grammar_rule: 'While + Past Continuous, Past Continuous (длительные одновременные действия)',
    pronunciation_tip: '"was cooking" произносится с ударением на смысловой глагол: /wəz ˈkʊkɪŋ/'
  },
  {
    section_id: 'grammar',
    level: 'A2',
    question_text: 'This car is much _____ than my old one.',
    context_text: 'Сравнительная степень коротких прилагательных (fast -> faster).',
    options_json: JSON.stringify(['faster', 'more fast', 'fastest', 'most fast']),
    correct_index: 0,
    explanation: 'Односложные прилагательные образуют сравнительную степень путем добавления суффикса -er: fast -> faster.',
    grammar_rule: 'One-syllable adjective + -er + than',
    pronunciation_tip: 'Ударение на первый слог: /ˈfɑːstər/'
  },
  {
    section_id: 'grammar',
    level: 'A2',
    question_text: 'Have you ever _____ to London?',
    context_text: 'Present Perfect: жизненный опыт с наречием "ever".',
    options_json: JSON.stringify(['been', 'was', 'went', 'be']),
    correct_index: 0,
    explanation: 'Для выражения посещения места в качестве жизненного опыта в Present Perfect используется третья форма глагола to be — "been" (to).',
    grammar_rule: 'Have/Has + Subject + ever + V3 (Past Participle)',
    pronunciation_tip: '"been" в британском английском звучит как /biːn/ или /bɪn/'
  },
  {
    section_id: 'grammar',
    level: 'A2',
    question_text: 'You _____ wear a seatbelt while driving.',
    context_text: 'Модальные глаголы обязательства и правил.',
    options_json: JSON.stringify(['must', 'can', 'might', 'could']),
    correct_index: 0,
    explanation: 'Модальный глагол "must" выражает строгое обязательство, закон или необходимость.',
    grammar_rule: 'Must + bare infinitive (без частицы to) для выражения обязательства',
    pronunciation_tip: 'В слове "must" буква "t" перед согласными часто редуцируется: /məs/'
  },

  // --- B1 (Intermediate) ---
  {
    section_id: 'grammar',
    level: 'B1',
    question_text: 'If I _____ more free time, I would travel around Europe.',
    context_text: 'Second Conditional (гипотетическая ситуация в настоящем/будущем).',
    options_json: JSON.stringify(['had', 'have', 'would have', 'will have']),
    correct_index: 0,
    explanation: 'В придаточной части Second Conditional (после if) используется Past Simple (had), а в главной части — would + глагол.',
    grammar_rule: 'If + Past Simple, would + infinitive (Second Conditional)',
    pronunciation_tip: 'Обратите внимание на связку "If I had" -> /ɪf aɪ hæd/'
  },
  {
    section_id: 'grammar',
    level: 'B1',
    question_text: 'She has been working here _____ 2018.',
    context_text: 'Present Perfect Continuous (действие началось в прошлом и длится до сих пор).',
    options_json: JSON.stringify(['since', 'for', 'during', 'from']),
    correct_index: 0,
    explanation: 'С точной точкой отсчета во времени (год, дата, событие) используется предлог "since". Предлог "for" используется с периодами времени (for 5 years).',
    grammar_rule: 'since + точка времени (since 2018), for + период времени (for 5 years)',
    pronunciation_tip: '"since" произносится как /sɪns/, не путать с "science"'
  },
  {
    section_id: 'grammar',
    level: 'B1',
    question_text: 'The new bridge _____ by engineers last year.',
    context_text: 'Past Simple Passive: страдательный залог в прошлом.',
    options_json: JSON.stringify(['was built', 'built', 'was building', 'has been built']),
    correct_index: 0,
    explanation: 'Мост не сам строил, а был построен кем-то (Passive Voice). Для завершенного действия в прошлом (last year) используется was + V3 (was built).',
    grammar_rule: 'Past Simple Passive: was/were + Past Participle (V3)',
    pronunciation_tip: '"built" оканчивается на четкий глухой звук /t/: /bɪlt/'
  },
  {
    section_id: 'grammar',
    level: 'B1',
    question_text: 'He told me that he _____ the report earlier that morning.',
    context_text: 'Reported Speech: согласование времен (Past Perfect для предшествующего действия).',
    options_json: JSON.stringify(['had finished', 'finished', 'has finished', 'will finish']),
    correct_index: 0,
    explanation: 'В косвенной речи, когда главное предложение в прошедшем времени (told), действие, совершенное еще раньше, сдвигается в Past Perfect (had finished).',
    grammar_rule: 'Reported Speech: Past Simple / Present Perfect -> Past Perfect (had + V3)',
    pronunciation_tip: 'Связка "he had" сокращается до "he\'d" -> /hiːd/'
  },
  {
    section_id: 'grammar',
    level: 'B1',
    question_text: 'I really enjoy _____ modern board games with colleagues.',
    context_text: 'Герундий после определенных глаголов (enjoy + V-ing).',
    options_json: JSON.stringify(['playing', 'to play', 'play', 'played']),
    correct_index: 0,
    explanation: 'После глаголов предпочтения (enjoy, fancy, avoid, consider) используется герундий (глагол с окончанием -ing), а не инфинитив.',
    grammar_rule: 'enjoy + Verb-ing (Gerund)',
    pronunciation_tip: 'Окончание "-ing" произносится с носовым звуком /ŋ/: /ˈpleɪɪŋ/'
  },

  // --- B2 (Upper-Intermediate) ---
  {
    section_id: 'grammar',
    level: 'B2',
    question_text: 'Hardly _____ the office when the client called with an urgent issue.',
    context_text: 'Inversion with negative adverbs (инверсия для усиления выразительности).',
    options_json: JSON.stringify(['had I left', 'I had left', 'did I leave', 'I left']),
    correct_index: 0,
    explanation: 'После отрицательных наречий (Hardly, Barely, Scarcely, Seldom) в начале предложения используется обратный порядок слов (инверсия) с Past Perfect: Hardly had + subject + V3.',
    grammar_rule: 'Hardly + had + Subject + V3 ... when ... (Negative Inversion)',
    pronunciation_tip: 'Логическое ударение падает на слово "Hardly" /ˈhɑːdli/'
  },
  {
    section_id: 'grammar',
    level: 'B2',
    question_text: 'If you had followed the deployment checklist, the outage _____ avoided.',
    context_text: 'Third Conditional (нереальное условие в прошлом и его последствия).',
    options_json: JSON.stringify(['would have been', 'would be', 'had been', 'was']),
    correct_index: 0,
    explanation: 'В третьем типе условных предложений для выражения нереального действия в прошлом используется схема: If + had + V3, would have + been + V3 (пассивный залог).',
    grammar_rule: 'If + Past Perfect, would have been + V3 (Third Conditional Passive)',
    pronunciation_tip: 'Связка "would have been" редуцируется в беглой речи: /wʊdəv bɪn/'
  },
  {
    section_id: 'grammar',
    level: 'B2',
    question_text: 'The lead architect suggested that the migration _____ postponed until next quarter.',
    context_text: 'Subjunctive Mood (сослагательное наклонение после suggest/recommend).',
    options_json: JSON.stringify(['be', 'is', 'was', 'would be']),
    correct_index: 0,
    explanation: 'После глаголов волеизъявления (suggest, recommend, demand, insist) в придаточном предложении с that используется сослагательное наклонение (базовая форма глагола: be).',
    grammar_rule: 'suggest that + subject + (should) bare infinitive (be)',
    pronunciation_tip: '"suggested that" произносится связно: /səˈdʒestɪd ðæt/'
  },
  {
    section_id: 'grammar',
    level: 'B2',
    question_text: 'She is used to _____ in high-pressure startup environments.',
    context_text: 'To be used to doing something (привычка к чему-либо).',
    options_json: JSON.stringify(['working', 'work', 'worked', 'be worked']),
    correct_index: 0,
    explanation: 'Конструкция "be used to" означает "иметь привычку, быть привыкшим" и требует после себя герундия (V-ing) или существительного, в отличие от used to + bare infinitive (прошлые привычки).',
    grammar_rule: 'be used to + Verb-ing / noun (привычка к процессу)',
    pronunciation_tip: '"used to" произносится со звуком /s/: /ˈjuːs tu/'
  },
  {
    section_id: 'grammar',
    level: 'B2',
    question_text: 'I wish I _____ more attention during the database architecture workshop.',
    context_text: 'Wish + Past Perfect: сожаление о совершенном или упущенном в прошлом.',
    options_json: JSON.stringify(['had paid', 'paid', 'would pay', 'have paid']),
    correct_index: 0,
    explanation: 'Для выражения сожаления о событии в прошлом используется конструкция Wish + Past Perfect (had + V3).',
    grammar_rule: 'Subject + wish + Subject + had + Past Participle (regret about the past)',
    pronunciation_tip: 'Связка "wish I had" -> /wɪʃ aɪ hæd/'
  },

  // --- C1 (Advanced) ---
  {
    section_id: 'grammar',
    level: 'C1',
    question_text: 'Under no circumstances _____ credentials in plain text in public repositories.',
    context_text: 'Negative Inversion with modal verb (категорический запрет с инверсией).',
    options_json: JSON.stringify(['should you commit', 'you should commit', 'you commit', 'do you commit']),
    correct_index: 0,
    explanation: 'Ограничительный оборот "Under no circumstances" в начале предложения требует обязательной инверсии: Under no circumstances + modal auxiliary + subject + main verb.',
    grammar_rule: 'Under no circumstances + Auxiliary / Modal + Subject + Verb',
    pronunciation_tip: 'Сильное фразовое ударение на "no circumstances" /ˌsɜːkəmstənsɪz/'
  },
  {
    section_id: 'grammar',
    level: 'C1',
    question_text: 'Were it not for your timely code review, we _____ a critical bug to production.',
    context_text: 'Inversion in Conditionals (альтернатива "If it were not for").',
    options_json: JSON.stringify(['would have pushed', 'had pushed', 'pushed', 'will push']),
    correct_index: 0,
    explanation: '"Were it not for" — формальная инвертированная форма для выражения условия ("Если бы не..."). В главной части смешанного/прошедшего условия используется would have + V3.',
    grammar_rule: 'Were it not for + Noun, Subject + would have + V3',
    pronunciation_tip: '"Were it not" произносится без паузы: /wɜːr ɪt nɒt/'
  },
  {
    section_id: 'grammar',
    level: 'C1',
    question_text: 'The higher the concurrency rate, _____ the memory overhead becomes.',
    context_text: 'Double Comparative (параллельная пропорциональная зависимость The... the...).',
    options_json: JSON.stringify(['the greater', 'greater', 'the greatest', 'more great']),
    correct_index: 0,
    explanation: 'Конструкция The + comparative ..., the + comparative ... выражает прямо пропорциональную зависимость: "Чем выше ..., тем больше ...".',
    grammar_rule: 'The + comparative + subject + verb, the + comparative + subject + verb',
    pronunciation_tip: 'Ритмичное повышение тона на первом "The higher" и спад на "the greater"'
  },
  {
    section_id: 'grammar',
    level: 'C1',
    question_text: '_____ all the microservices to Kubernetes, the operations team began stress testing.',
    context_text: 'Perfect Participle Clause: предшествующее завершенное действие.',
    options_json: JSON.stringify(['Having migrated', 'Migrating', 'Migrated', 'Being migrated']),
    correct_index: 0,
    explanation: 'Причастный оборот в форме Perfect Participle (Having + V3) подчеркивает, что действие миграции полностью завершилось до того, как началось стресс-тестирование.',
    grammar_rule: 'Having + Past Participle (Perfect Participle Clause for completed prior action)',
    pronunciation_tip: '"Having migrated" произносится с ударением на /ˈhævɪŋ maɪˈɡreɪtɪd/'
  },
  {
    section_id: 'grammar',
    level: 'C1',
    question_text: 'Little _____ that the refactored caching layer would double the throughput.',
    context_text: 'Negative Inversion with "Little" (никто и подумать не мог).',
    options_json: JSON.stringify(['did we anticipate', 'we anticipated', 'we did anticipate', 'had we anticipated']),
    correct_index: 0,
    explanation: 'Отрицательное наречие "Little" в значении "совсем не / даже не подозревали" в начале предложения вызывает инверсию: Little + did + subject + bare infinitive.',
    grammar_rule: 'Little + did + Subject + base verb (Negative Inversion with Little)',
    pronunciation_tip: 'Интонационный подъем на слове "Little" /ˈlɪtl/'
  }
];

const SCHEMA_DDL = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    password_hash TEXT,
    email TEXT,
    xp INTEGER DEFAULT 0,
    streak INTEGER DEFAULT 1,
    last_active_date TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sections (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    default_level TEXT DEFAULT 'B1',
    prompt_focus TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section_id TEXT NOT NULL,
    level TEXT NOT NULL,
    question_text TEXT NOT NULL,
    context_text TEXT,
    options_json TEXT NOT NULL,
    correct_index INTEGER NOT NULL,
    explanation TEXT NOT NULL,
    grammar_rule TEXT,
    pronunciation_tip TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (section_id) REFERENCES sections(id)
  );

  CREATE TABLE IF NOT EXISTS user_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    question_id INTEGER NOT NULL,
    selected_index INTEGER NOT NULL,
    is_correct INTEGER NOT NULL,
    answered_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (question_id) REFERENCES questions(id)
  );

  CREATE TABLE IF NOT EXISTS dictionary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL,
    transcription TEXT,
    part_of_speech TEXT,
    translation TEXT NOT NULL,
    definition TEXT,
    example_sentence TEXT,
    example_translation TEXT,
    level TEXT DEFAULT 'B1',
    section_id TEXT,
    is_favorite INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS srs_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    word_id INTEGER NOT NULL,
    grade INTEGER NOT NULL,
    reps INTEGER DEFAULT 0,
    interval INTEGER DEFAULT 0,
    ef REAL DEFAULT 2.5,
    due_date TEXT,
    reviewed_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (word_id) REFERENCES dictionary(id)
  );

  CREATE INDEX IF NOT EXISTS idx_questions_section_level ON questions(section_id, level);
  CREATE INDEX IF NOT EXISTS idx_user_answers_user ON user_answers(user_id);
  CREATE INDEX IF NOT EXISTS idx_dictionary_word ON dictionary(word);
  CREATE INDEX IF NOT EXISTS idx_dictionary_section ON dictionary(section_id);
  CREATE INDEX IF NOT EXISTS idx_dictionary_level ON dictionary(level);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_srs_user_word ON srs_reviews(user_id, word_id);

  CREATE TABLE IF NOT EXISTS trainer_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    trainer_id TEXT NOT NULL,
    word_id INTEGER,
    question_id INTEGER,
    section_id TEXT,
    is_correct INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_trainer_activity_user ON trainer_activity(user_id);
  CREATE INDEX IF NOT EXISTS idx_trainer_activity_trainer ON trainer_activity(trainer_id);
  CREATE INDEX IF NOT EXISTS idx_trainer_activity_section ON trainer_activity(section_id);
`;

function normalizeArgs(params) {
  if (params.length === 1 && Array.isArray(params[0])) {
    return params[0];
  }
  return params;
}

// ----------------------------------------------------------------------------
// Local SQLite Engine Initialization (Always available as rock-solid fallback)
// ----------------------------------------------------------------------------
const { DatabaseSync } = require('node:sqlite');

const dbPath = process.env.DATABASE_PATH 
  ? path.resolve(__dirname, '../../', process.env.DATABASE_PATH)
  : path.resolve(__dirname, '../../data/english_mastery.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const localDb = new DatabaseSync(dbPath);

// High performance SQLite settings
localDb.exec('PRAGMA journal_mode = WAL;');
localDb.exec('PRAGMA synchronous = NORMAL;');
localDb.exec('PRAGMA foreign_keys = ON;');
localDb.exec('PRAGMA busy_timeout = 5000;');

localDb.exec(SCHEMA_DDL);

try {
  localDb.exec('ALTER TABLE users ADD COLUMN password_hash TEXT;');
} catch (_) {}

// Seed default sections locally if empty
const checkSections = localDb.prepare('SELECT COUNT(*) as count FROM sections');
if (checkSections.get().count === 0) {
  const insertSection = localDb.prepare(`
    INSERT INTO sections (id, title, description, icon, default_level, prompt_focus)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const s of seedSections) {
    insertSection.run(s.id, s.title, s.description, s.icon, s.default_level, s.prompt_focus);
  }
}

// Users are not pre-seeded: every player must register their own unique account

// Seed rich dictionary vocabulary locally if empty
const checkDict = localDb.prepare('SELECT COUNT(*) as count FROM dictionary');
if (checkDict.get().count === 0) {
  const insertDict = localDb.prepare(`
    INSERT INTO dictionary (
      word, transcription, part_of_speech, translation, definition,
      example_sentence, example_translation, level, section_id, is_favorite
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const w of seedWords) {
    insertDict.run(
      w.word, w.transcription, w.part_of_speech, w.translation, w.definition,
      w.example_sentence, w.example_translation, w.level, w.section_id, w.is_favorite
    );
  }
}

// Seed curriculum questions for all levels (A1-C1) locally if A1 is missing
const checkQuestions = localDb.prepare("SELECT COUNT(*) as count FROM questions WHERE level = 'A1'");
if (checkQuestions.get().count === 0) {
  const insertQ = localDb.prepare(`
    INSERT INTO questions (
      section_id, level, question_text, context_text,
      options_json, correct_index, explanation, grammar_rule, pronunciation_tip
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const q of seedQuestions) {
    insertQ.run(
      q.section_id, q.level, q.question_text, q.context_text,
      q.options_json, q.correct_index, q.explanation, q.grammar_rule, q.pronunciation_tip
    );
  }
}

// ----------------------------------------------------------------------------
// Unified Database Wrapper
// ----------------------------------------------------------------------------
let activeTursoClient = null;
let circuitBreakerTripped = false;

function isTursoBlockedError(err) {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();
  return (
    msg.includes('blocked') ||
    msg.includes('forbidden') ||
    msg.includes('upgrade your plan') ||
    msg.includes('quota') ||
    msg.includes('insufficient') ||
    msg.includes('limit exceeded')
  );
}

function handleTursoError(err, context = 'query') {
  if (isTursoBlockedError(err)) {
    if (useTurso) {
      circuitBreakerTripped = true;
      useTurso = false;
      activeTursoClient = null;
      console.error(`[Database] 🚨 Turso Cloud Quota Exceeded / Blocked (${context}): ${err.message}`);
      console.error(`[Database] 🔀 Circuit Breaker TRIPPED: Disabling Turso Cloud. All queries will run directly against Local SQLite without latency.`);
    }
  } else {
    console.warn(`[Database] Turso query error (${context}), falling back to local DB: ${err.message}`);
  }
}
let useTurso = false;

if (isPlaceholder) {
  console.warn(`[Database] ⚠️ TURSO_DATABASE_URL contains placeholder "${TURSO_DATABASE_URL}". Please set your real Turso URL in Render. Using local SQLite.`);
}

let tursoInitPromise = Promise.resolve();

if (shouldAttemptTurso) {
  console.log(`[Database] 🌐 Attempting Turso Cloud connection: ${TURSO_DATABASE_URL}`);
  try {
    const { createClient } = require('@libsql/client');
    const client = createClient({
      url: TURSO_DATABASE_URL,
      authToken: TURSO_AUTH_TOKEN
    });

    tursoInitPromise = (async () => {
      try {
        // Test basic connectivity first
        await client.execute('SELECT 1 as connected');

        // Split and execute DDL statements
        const statements = SCHEMA_DDL
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0);

        for (const sql of statements) {
          await client.execute(sql);
        }

        try {
          await client.execute('ALTER TABLE users ADD COLUMN password_hash TEXT;');
        } catch (_) {}

        // Seed sections if empty
        const secCountRes = await client.execute('SELECT COUNT(*) as count FROM sections');
        const secCount = secCountRes.rows[0]?.count || 0;
        if (secCount === 0) {
          console.log('[Database] Seeding initial curriculum sections on Turso...');
          for (const s of seedSections) {
            await client.execute({
              sql: `INSERT INTO sections (id, title, description, icon, default_level, prompt_focus) VALUES (?, ?, ?, ?, ?, ?)`,
              args: [s.id, s.title, s.description, s.icon, s.default_level, s.prompt_focus]
            });
          }
        }

        // Seed curriculum questions for all levels on Turso if A1 is missing
        const qCountRes = await client.execute("SELECT COUNT(*) as count FROM questions WHERE level = 'A1'");
        const qCount = qCountRes.rows[0]?.count || 0;
        if (qCount === 0) {
          console.log('[Database] Seeding initial curriculum questions for all CEFR levels on Turso...');
          for (const q of seedQuestions) {
            await client.execute({
              sql: `INSERT INTO questions (
                section_id, level, question_text, context_text,
                options_json, correct_index, explanation, grammar_rule, pronunciation_tip
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [
                q.section_id, q.level, q.question_text, q.context_text,
                q.options_json, q.correct_index, q.explanation, q.grammar_rule, q.pronunciation_tip
              ]
            });
          }
        }

        activeTursoClient = client;
        useTurso = true;
        console.log('[Database] ✅ Turso Cloud Database connected and verified.');
      } catch (err) {
        if (isTursoBlockedError(err)) {
          circuitBreakerTripped = true;
          console.error(`[Database] 🚨 Turso Cloud Quota Exceeded / Blocked at startup: ${err.message}`);
          console.error(`[Database] 🔀 Circuit Breaker TRIPPED: Disabling Turso Cloud. Using local SQLite.`);
        } else {
          console.warn(`[Database] ⚠️ Turso Cloud connection failed (${err.message}). Seamlessly falling back to local SQLite.`);
        }
        useTurso = false;
        activeTursoClient = null;
      }
    })();
  } catch (clientErr) {
    console.warn(`[Database] ⚠️ Failed to initialize Turso client (${clientErr.message}). Using local SQLite.`);
    useTurso = false;
  }
}

const db = {
  get isCircuitBreakerTripped() {
    return circuitBreakerTripped;
  },
  get isTurso() {
    return useTurso;
  },
  readyPromise: tursoInitPromise,

  prepare(sql) {
    if (useTurso && activeTursoClient) {
      return {
        async get(...params) {
          await tursoInitPromise;
          if (!useTurso || !activeTursoClient) {
            return localDb.prepare(sql).get(...normalizeArgs(params));
          }
          const args = normalizeArgs(params);
          try {
            const res = await activeTursoClient.execute({ sql, args });
            return res.rows[0] !== undefined ? res.rows[0] : undefined;
          } catch (err) {
            handleTursoError(err, 'query');
            return localDb.prepare(sql).get(...args);
          }
        },

        async all(...params) {
          await tursoInitPromise;
          if (!useTurso || !activeTursoClient) {
            return localDb.prepare(sql).all(...normalizeArgs(params));
          }
          const args = normalizeArgs(params);
          try {
            const res = await activeTursoClient.execute({ sql, args });
            return Array.from(res.rows);
          } catch (err) {
            handleTursoError(err, 'query');
            return localDb.prepare(sql).all(...args);
          }
        },

        async run(...params) {
          await tursoInitPromise;
          if (!useTurso || !activeTursoClient) {
            return localDb.prepare(sql).run(...normalizeArgs(params));
          }
          const args = normalizeArgs(params);
          try {
            const res = await activeTursoClient.execute({ sql, args });
            return {
              lastInsertRowid: res.lastInsertRowid != null ? Number(res.lastInsertRowid) : 0,
              changes: res.rowsAffected
            };
          } catch (err) {
            handleTursoError(err, 'query');
            return localDb.prepare(sql).run(...args);
          }
        }
      };
    }

    return localDb.prepare(sql);
  },

  async exec(sql) {
    await tursoInitPromise;
    if (useTurso && activeTursoClient) {
      try {
        if (typeof activeTursoClient.executeMultiple === 'function') {
          return await activeTursoClient.executeMultiple(sql);
        }
        const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
        for (const s of statements) {
          await activeTursoClient.execute(s);
        }
        return;
      } catch (err) {
        handleTursoError(err, 'exec');
      }
    }
    return localDb.exec(sql);
  }
};

module.exports = db;

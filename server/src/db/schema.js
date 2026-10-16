/**
 * Fluentiq Database Engine
 * High-performance native SQLite database (Node 22 built-in)
 * Scalable schema for thousands of users, progress tracking, and infinite AI questions.
 */

const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DATABASE_PATH 
  ? path.resolve(__dirname, '../../', process.env.DATABASE_PATH)
  : path.resolve(__dirname, '../../data/english_mastery.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(dbPath);

// Enable WAL mode for high concurrency
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

// Initialize tables
db.exec(`
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
`);

// Run migrations on existing SQLite databases
try {
  db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT;');
} catch (_) {
  // Column already exists
}

// Seed default sections
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

const checkSections = db.prepare('SELECT COUNT(*) as count FROM sections');
const secCount = checkSections.get().count;

if (secCount === 0) {
  const insertSection = db.prepare(`
    INSERT INTO sections (id, title, description, icon, default_level, prompt_focus)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const s of seedSections) {
    insertSection.run(s.id, s.title, s.description, s.icon, s.default_level, s.prompt_focus);
  }
}

// Seed a default demo user if not exists
const checkUser = db.prepare('SELECT COUNT(*) as count FROM users');
if (checkUser.get().count === 0) {
  const insertUser = db.prepare(`
    INSERT INTO users (id, username, email, xp, streak, last_active_date)
    VALUES ('user_default', 'Learner', 'learner@example.com', 50, 1, ?)
  `);
  insertUser.run(new Date().toISOString().slice(0, 10));
}

// Seed rich dictionary vocabulary if empty
const checkDict = db.prepare('SELECT COUNT(*) as count FROM dictionary');
if (checkDict.get().count === 0) {
  const insertDict = db.prepare(`
    INSERT INTO dictionary (
      word, transcription, part_of_speech, translation, definition,
      example_sentence, example_translation, level, section_id, is_favorite
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

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

  for (const w of seedWords) {
    insertDict.run(
      w.word,
      w.transcription,
      w.part_of_speech,
      w.translation,
      w.definition,
      w.example_sentence,
      w.example_translation,
      w.level,
      w.section_id,
      w.is_favorite
    );
  }
}

module.exports = db;


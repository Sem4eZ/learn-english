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

const shouldAttemptTurso = Boolean(TURSO_DATABASE_URL) && !isPlaceholder;

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

// ----------------------------------------------------------------------------
// Unified Database Wrapper
// ----------------------------------------------------------------------------
let activeTursoClient = null;
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

        activeTursoClient = client;
        useTurso = true;
        console.log('[Database] ✅ Turso Cloud Database connected and verified.');
      } catch (err) {
        console.warn(`[Database] ⚠️ Turso Cloud connection failed (${err.message}). Seamlessly falling back to local SQLite.`);
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
  get isTurso() {
    return useTurso;
  },
  readyPromise: tursoInitPromise,

  prepare(sql) {
    if (useTurso && activeTursoClient) {
      return {
        async get(...params) {
          await tursoInitPromise;
          const args = normalizeArgs(params);
          try {
            const res = await activeTursoClient.execute({ sql, args });
            return res.rows[0] !== undefined ? res.rows[0] : undefined;
          } catch (err) {
            console.warn('[Database] Turso query error, falling back to local DB:', err.message);
            return localDb.prepare(sql).get(...args);
          }
        },

        async all(...params) {
          await tursoInitPromise;
          const args = normalizeArgs(params);
          try {
            const res = await activeTursoClient.execute({ sql, args });
            return Array.from(res.rows);
          } catch (err) {
            console.warn('[Database] Turso query error, falling back to local DB:', err.message);
            return localDb.prepare(sql).all(...args);
          }
        },

        async run(...params) {
          await tursoInitPromise;
          const args = normalizeArgs(params);
          try {
            const res = await activeTursoClient.execute({ sql, args });
            return {
              lastInsertRowid: res.lastInsertRowid != null ? Number(res.lastInsertRowid) : 0,
              changes: res.rowsAffected
            };
          } catch (err) {
            console.warn('[Database] Turso query error, falling back to local DB:', err.message);
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
        console.warn('[Database] Turso exec error, falling back to local DB:', err.message);
      }
    }
    return localDb.exec(sql);
  }
};

module.exports = db;

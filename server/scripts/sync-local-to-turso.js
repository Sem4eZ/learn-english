/**
 * Migration Script: Local SQLite to Turso Cloud libSQL
 * Syncs all local words, questions, sections, and users into Turso Cloud.
 */

const { DatabaseSync } = require('node:sqlite');
const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');

const TURSO_URL = process.env.TURSO_DATABASE_URL || 'libsql://fluentiq-db-sem4ez.aws-eu-north-1.turso.io';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTIxNTM1NjYsImlkIjoiMDFhMTQ0YWMtZWMwMS03Y2E3LWJjMTctNDUwMmNmODdkZTU3Iiwia2lkIjoiR0doek1jNFJtNWQ2TlFTRGpHOFpjMnFCUFl1ZUlzY2YxTloyMXprTHJhUSIsInJpZCI6IjE3OTY5YTk5LWU1M2ItNDQyZS05ZDg4LWRiZmJjMjdhZmRlMiJ9.eK7qSriccGMOjUjmj05wsXHJPI-UYlGR1dp5sQE8nzEX4n2qW6SdXMjPsw0-RR9_Cfge6mJUdNdcx36eumbEDw';

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

async function sync() {
  console.log(`[Sync] Connecting to Turso: ${TURSO_URL}...`);
  const turso = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

  // 1. Create tables
  const ddlStmts = SCHEMA_DDL.split(';').map(s => s.trim()).filter(Boolean);
  for (const s of ddlStmts) {
    await turso.execute(s);
  }
  try {
    await turso.execute('ALTER TABLE users ADD COLUMN password_hash TEXT;');
  } catch (_) {}

  console.log('[Sync] Schema initialized on Turso.');

  // Find local databases
  const localDbPaths = [
    path.resolve(__dirname, '../data/english_mastery.db'),
    path.resolve(__dirname, '../../data/english_mastery.db')
  ].filter(p => fs.existsSync(p));

  if (localDbPaths.length === 0) {
    console.error('[Sync] No local SQLite databases found!');
    process.exit(1);
  }

  // 2. Sync Sections
  for (const dbPath of localDbPaths) {
    const local = new DatabaseSync(dbPath);
    try {
      const sections = local.prepare('SELECT * FROM sections').all();
      for (const s of sections) {
        await turso.execute({
          sql: `INSERT OR IGNORE INTO sections (id, title, description, icon, default_level, prompt_focus) VALUES (?, ?, ?, ?, ?, ?)`,
          args: [s.id, s.title, s.description, s.icon, s.default_level, s.prompt_focus]
        });
      }
    } catch (_) {}
  }
  const secCount = (await turso.execute('SELECT COUNT(*) as c FROM sections')).rows[0].c;
  console.log(`[Sync] Sections in Turso: ${secCount}`);

  // 3. Sync Dictionary Words
  let insertedWords = 0;
  for (const dbPath of localDbPaths) {
    const local = new DatabaseSync(dbPath);
    try {
      const words = local.prepare('SELECT * FROM dictionary').all();
      for (const w of words) {
        // Check if word already exists by lowercased word
        const check = await turso.execute({
          sql: 'SELECT id FROM dictionary WHERE LOWER(word) = LOWER(?)',
          args: [w.word.trim()]
        });
        if (check.rows.length === 0) {
          await turso.execute({
            sql: `INSERT INTO dictionary (
              word, transcription, part_of_speech, translation, definition,
              example_sentence, example_translation, level, section_id, is_favorite, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              w.word.trim(),
              w.transcription || '',
              w.part_of_speech || 'noun',
              w.translation || '',
              w.definition || '',
              w.example_sentence || '',
              w.example_translation || '',
              w.level || 'B1',
              w.section_id || 'general',
              w.is_favorite || 0,
              w.created_at || new Date().toISOString()
            ]
          });
          insertedWords++;
        }
      }
    } catch (err) {
      console.warn(`[Sync] Word sync warning from ${dbPath}:`, err.message);
    }
  }
  const totalWords = (await turso.execute('SELECT COUNT(*) as c FROM dictionary')).rows[0].c;
  console.log(`[Sync] Dictionary sync complete! Newly added: ${insertedWords}. Total words in Turso: ${totalWords}`);

  // 4. Sync Questions
  let insertedQuestions = 0;
  for (const dbPath of localDbPaths) {
    const local = new DatabaseSync(dbPath);
    try {
      const questions = local.prepare('SELECT * FROM questions').all();
      for (const q of questions) {
        const check = await turso.execute({
          sql: 'SELECT id FROM questions WHERE question_text = ?',
          args: [q.question_text]
        });
        if (check.rows.length === 0) {
          await turso.execute({
            sql: `INSERT INTO questions (
              section_id, level, question_text, context_text, options_json,
              correct_index, explanation, grammar_rule, pronunciation_tip, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              q.section_id,
              q.level,
              q.question_text,
              q.context_text || '',
              q.options_json,
              q.correct_index,
              q.explanation || '',
              q.grammar_rule || '',
              q.pronunciation_tip || '',
              q.created_at || new Date().toISOString()
            ]
          });
          insertedQuestions++;
        }
      }
    } catch (_) {}
  }
  const totalQuestions = (await turso.execute('SELECT COUNT(*) as c FROM questions')).rows[0].c;
  console.log(`[Sync] Questions sync complete! Newly added: ${insertedQuestions}. Total questions in Turso: ${totalQuestions}`);

  // 5. Sync Users
  const primaryDb = new DatabaseSync(path.resolve(__dirname, '../data/english_mastery.db'));
  try {
    const users = primaryDb.prepare('SELECT * FROM users').all();
    for (const u of users) {
      await turso.execute({
        sql: `INSERT OR IGNORE INTO users (id, username, password_hash, email, xp, streak, last_active_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [u.id, u.username, u.password_hash, u.email, u.xp || 0, u.streak || 1, u.last_active_date, u.created_at || new Date().toISOString()]
      });
    }
  } catch (_) {}
  const totalUsers = (await turso.execute('SELECT COUNT(*) as c FROM users')).rows[0].c;
  console.log(`[Sync] Users in Turso: ${totalUsers}`);

  // 6. Ensure default user exists
  await turso.execute({
    sql: `INSERT OR IGNORE INTO users (id, username, email, xp, streak, last_active_date) VALUES ('user_default', 'Learner', 'learner@example.com', 50, 1, ?)`,
    args: [new Date().toISOString().slice(0, 10)]
  });

  console.log('\n======================================================');
  console.log('🎉 SYNC TO TURSO CLOUD FINISHED SUCCESSFULLY!');
  console.log(`   📚 Total Dictionary Words: ${totalWords}`);
  console.log(`   ❓ Total Questions: ${totalQuestions}`);
  console.log(`   👤 Total Users: ${totalUsers}`);
  console.log('======================================================\n');
}

sync().catch(err => {
  console.error('[Sync] Fatal error:', err);
  process.exit(1);
});

/**
 * Purge All Users & Activity History
 * Safely removes all user accounts, answer histories, and SRS reviews from:
 * 1. Remote Turso Cloud Database
 * 2. Local SQLite Database (server/data/english_mastery.db)
 * 3. Root SQLite Database (data/english_mastery.db, if present)
 * 
 * PRESERVES:
 * - dictionary (all 750+ words, definitions, translations)
 * - questions (all 80+ grammar exercises)
 * - sections (all 7 curriculum topics)
 */

const { DatabaseSync } = require('node:sqlite');
const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');

const TURSO_URL = process.env.TURSO_DATABASE_URL || 'libsql://fluentiq-db-sem4ez.aws-eu-north-1.turso.io';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTIxNTM1NjYsImlkIjoiMDFhMTQ0YWMtZWMwMS03Y2E3LWJjMTctNDUwMmNmODdkZTU3Iiwia2lkIjoiR0doek1jNFJtNWQ2TlFTRGpHOFpjMnFCUFl1ZUlzY2YxTloyMXprTHJhUSIsInJpZCI6IjE3OTY5YTk5LWU1M2ItNDQyZS05ZDg4LWRiZmJjMjdhZmRlMiJ9.eK7qSriccGMOjUjmj05wsXHJPI-UYlGR1dp5sQE8nzEX4n2qW6SdXMjPsw0-RR9_Cfge6mJUdNdcx36eumbEDw';

async function purgeTurso() {
  console.log('\n======================================================');
  console.log('🌐 PURGING TURSO CLOUD DATABASE');
  console.log(`URL: ${TURSO_URL}`);
  console.log('======================================================');

  const client = createClient({
    url: TURSO_URL,
    authToken: TURSO_TOKEN
  });

  // Verify initial counts
  const beforeUsers = (await client.execute('SELECT COUNT(*) as c FROM users')).rows[0].c;
  const beforeAnswers = (await client.execute('SELECT COUNT(*) as c FROM user_answers')).rows[0].c;
  const beforeSrs = (await client.execute('SELECT COUNT(*) as c FROM srs_reviews')).rows[0].c;
  const dictCount = (await client.execute('SELECT COUNT(*) as c FROM dictionary')).rows[0].c;
  const qCount = (await client.execute('SELECT COUNT(*) as c FROM questions')).rows[0].c;
  const secCount = (await client.execute('SELECT COUNT(*) as c FROM sections')).rows[0].c;

  console.log(`Turso BEFORE:`);
  console.log(`  - users: ${beforeUsers}`);
  console.log(`  - user_answers: ${beforeAnswers}`);
  console.log(`  - srs_reviews: ${beforeSrs}`);
  console.log(`  - dictionary: ${dictCount} (PRESERVED)`);
  console.log(`  - questions: ${qCount} (PRESERVED)`);
  console.log(`  - sections: ${secCount} (PRESERVED)`);

  // Purge
  console.log('\nExecuting deletion on Turso...');
  await client.execute('DELETE FROM user_answers');
  await client.execute('DELETE FROM srs_reviews');
  await client.execute('DELETE FROM users');

  // Verify after
  const afterUsers = (await client.execute('SELECT COUNT(*) as c FROM users')).rows[0].c;
  const afterAnswers = (await client.execute('SELECT COUNT(*) as c FROM user_answers')).rows[0].c;
  const afterSrs = (await client.execute('SELECT COUNT(*) as c FROM srs_reviews')).rows[0].c;
  const dictAfter = (await client.execute('SELECT COUNT(*) as c FROM dictionary')).rows[0].c;

  console.log(`Turso AFTER:`);
  console.log(`  ✅ users: ${afterUsers}`);
  console.log(`  ✅ user_answers: ${afterAnswers}`);
  console.log(`  ✅ srs_reviews: ${afterSrs}`);
  console.log(`  🔒 dictionary: ${dictAfter} (Safe and intact)`);
}

function purgeLocalSqlite(dbFilePath, label) {
  console.log('\n======================================================');
  console.log(`💾 PURGING LOCAL SQLITE: ${label}`);
  console.log(`Path: ${dbFilePath}`);
  console.log('======================================================');

  if (!fs.existsSync(dbFilePath)) {
    console.log(`File not found, skipping.`);
    return;
  }

  const db = new DatabaseSync(dbFilePath);
  
  const getCount = (table) => {
    try {
      return db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get().c;
    } catch (_) {
      return 0;
    }
  };

  console.log(`${label} BEFORE:`);
  console.log(`  - users: ${getCount('users')}`);
  console.log(`  - user_answers: ${getCount('user_answers')}`);
  console.log(`  - srs_reviews: ${getCount('srs_reviews')}`);
  console.log(`  - dictionary: ${getCount('dictionary')} (PRESERVED)`);
  console.log(`  - questions: ${getCount('questions')} (PRESERVED)`);

  // Execute deletion
  try { db.exec('DELETE FROM user_answers;'); } catch (_) {}
  try { db.exec('DELETE FROM srs_reviews;'); } catch (_) {}
  try { db.exec('DELETE FROM users;'); } catch (_) {}

  console.log(`${label} AFTER:`);
  console.log(`  ✅ users: ${getCount('users')}`);
  console.log(`  ✅ user_answers: ${getCount('user_answers')}`);
  console.log(`  ✅ srs_reviews: ${getCount('srs_reviews')}`);
  console.log(`  🔒 dictionary: ${getCount('dictionary')} (Safe and intact)`);
  console.log(`  🔒 questions: ${getCount('questions')} (Safe and intact)`);
}

async function main() {
  try {
    // 1. Purge Turso Cloud
    await purgeTurso();

    // 2. Purge local server db
    const serverDbPath = path.resolve(__dirname, '../data/english_mastery.db');
    purgeLocalSqlite(serverDbPath, 'SERVER LOCAL DB');

    // 3. Purge root db if present
    const rootDbPath = path.resolve(__dirname, '../../data/english_mastery.db');
    if (fs.existsSync(rootDbPath) && path.normalize(rootDbPath) !== path.normalize(serverDbPath)) {
      purgeLocalSqlite(rootDbPath, 'ROOT DATA DB');
    }

    console.log('\n✨ ALL USER ACCOUNTS AND ACTIVITY SUCCESSFULLY PURGED!');
    console.log('The platform is completely reset for fresh user registration.');
  } catch (err) {
    console.error('Purge error:', err);
    process.exit(1);
  }
}

main();

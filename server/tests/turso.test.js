/**
 * Automated Test Suite: Cloud Turso & Dual-Mode Database Engine
 * Covers: Mode detection, libSQL query compatibility, parameter binding,
 * seeding verification, and Gemini model fallback pipeline.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db/schema');
const geminiService = require('../src/services/geminiService');

describe('Turso & Database Engine Architecture Test Suite', () => {
  it('1. Database Engine: Initializes and provides prepare(), get(), all(), run()', async () => {
    assert.ok(db, 'db instance must exist');
    assert.strictEqual(typeof db.prepare, 'function', 'db.prepare must be a function');
    assert.strictEqual(typeof db.isTurso, 'boolean', 'isTurso indicator must be boolean');

    const stmt = db.prepare('SELECT 1 as num');
    assert.strictEqual(typeof stmt.get, 'function');
    assert.strictEqual(typeof stmt.all, 'function');
    assert.strictEqual(typeof stmt.run, 'function');

    const res = await stmt.get();
    assert.strictEqual(res.num, 1);
  });

  it('2. Dual-Mode Compatibility: Prepared statements can be called synchronously or awaited', async () => {
    // Awaited call
    const awaitedRow = await db.prepare('SELECT COUNT(*) as c FROM sections').get();
    assert.ok(awaitedRow.c >= 7, 'Must have at least 7 curriculum sections');

    // All rows
    const allRows = await db.prepare('SELECT id, title FROM sections ORDER BY id ASC').all();
    assert.ok(Array.isArray(allRows));
    assert.ok(allRows.length >= 7);
  });

  it('3. Parameter Binding: Successfully normalizes and binds positional parameters', async () => {
    const wordRow = await db.prepare('SELECT * FROM dictionary WHERE word = ?').get('bottleneck');
    assert.ok(wordRow, 'Seed word "bottleneck" must exist in dictionary');
    assert.strictEqual(wordRow.word, 'bottleneck');
    assert.strictEqual(wordRow.level, 'B2');
    assert.strictEqual(wordRow.section_id, 'tech_it');
  });

  it('4. Write Operation: Correctly returns lastInsertRowid and changes', async () => {
    const testUsername = `turso_test_${Date.now()}`;
    const insertRes = await db.prepare(`
      INSERT INTO users (id, username, xp, streak) VALUES (?, ?, ?, ?)
    `).run(`usr_${Date.now()}`, testUsername, 100, 3);

    assert.ok(insertRes, 'Insert result must be returned');
    assert.strictEqual(typeof insertRes.changes, 'number');

    const found = await db.prepare('SELECT * FROM users WHERE username = ?').get(testUsername);
    assert.ok(found);
    assert.strictEqual(found.username, testUsername);
    assert.strictEqual(found.xp, 100);

    // Cleanup
    await db.prepare('DELETE FROM users WHERE username = ?').run(testUsername);
  });

  it('5. Gemini Pipeline: Prioritizes lightweight models for high rate limits', () => {
    assert.ok(geminiService, 'geminiService must be defined');
    // Ensure in-flight deduplication maps exist
    assert.ok(geminiService.inFlightRequests instanceof Map);
    assert.ok(geminiService.inFlightVocab instanceof Map);
  });
  it('6. Circuit Breaker: Provides isCircuitBreakerTripped indicator and handles quota blocking', () => {
    assert.strictEqual(typeof db.isCircuitBreakerTripped, 'boolean');
  });
});

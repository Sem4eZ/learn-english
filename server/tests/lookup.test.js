/**
 * Automated Test Suite: Word Lookup & Definition Fallback & Auto-Saving
 * Covers: Instant DB lookup, Russian-to-English lookup, case & whitespace trimming,
 * input validation, schema structure verification, deduplication, and DB persistence.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db/schema');

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001/api';

describe('Word Lookup & Persistence Test Suite', () => {
  it('1. Looks up an existing English word from database instantly (isNew = false)', async () => {
    const res = await fetch(`${BASE_URL}/dictionary/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: 'cold' })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.word.toLowerCase(), 'cold');
    assert.strictEqual(body.isNew, false);
    assert.ok(body.message.includes('уже есть в вашем словаре'));
  });

  it('2. Looks up an existing word by Russian translation (e.g. "стул" -> chair)', async () => {
    const res = await fetch(`${BASE_URL}/dictionary/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: 'стул' })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.word.toLowerCase(), 'chair');
    assert.strictEqual(body.isNew, false);
  });

  it('3. Lookup handles case-insensitivity correctly ("CHAIR" -> chair)', async () => {
    const res = await fetch(`${BASE_URL}/dictionary/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: 'CHAIR' })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.word.toLowerCase(), 'chair');
    assert.strictEqual(body.isNew, false);
  });

  it('4. Lookup trims surrounding whitespace ("   cold   " -> cold)', async () => {
    const res = await fetch(`${BASE_URL}/dictionary/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: '   cold   ' })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.word, 'cold');
  });

  it('5. Validation: Rejects empty string query with status 400', async () => {
    const res = await fetch(`${BASE_URL}/dictionary/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: '' })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('обязательно'));
  });

  it('6. Validation: Rejects whitespace-only string with status 400', async () => {
    const res = await fetch(`${BASE_URL}/dictionary/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: '     ' })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });

  it('7. Validation: Rejects missing word property in payload', async () => {
    const res = await fetch(`${BASE_URL}/dictionary/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });

  it('8. Schema verification: Returned card contains all standard pedagogical fields', async () => {
    const res = await fetch(`${BASE_URL}/dictionary/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: 'cold' })
    });
    const body = await res.json();
    const item = body.data;

    assert.ok(item.id, 'Missing id');
    assert.ok(item.word, 'Missing word');
    assert.ok(item.translation, 'Missing translation');
    assert.ok(typeof item.transcription === 'string', 'Missing transcription');
    assert.ok(typeof item.definition === 'string', 'Missing definition');
    assert.ok(typeof item.example_sentence === 'string', 'Missing example_sentence');
    assert.ok(typeof item.example_translation === 'string', 'Missing example_translation');
    assert.ok(typeof item.level === 'string', 'Missing level');
    assert.ok(typeof item.section_id === 'string', 'Missing section_id');
  });

  it('9. Database integrity: Word returned by lookup actually exists in SQLite DB', async () => {
    const res = await fetch(`${BASE_URL}/dictionary/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: 'cold' })
    });
    const body = await res.json();
    const dbRow = db.prepare('SELECT * FROM dictionary WHERE id = ?').get(body.data.id);
    assert.ok(dbRow, 'Row must exist in SQLite database');
    assert.strictEqual(dbRow.word, body.data.word);
    assert.strictEqual(dbRow.translation, body.data.translation);
  });

  it('10. Deduplication safety: Repeating lookup never creates duplicate database rows', async () => {
    const countBefore = db.prepare('SELECT COUNT(*) as count FROM dictionary WHERE LOWER(word) = ?').get('cold').count;
    assert.strictEqual(countBefore, 1);

    // Call lookup twice consecutively
    await fetch(`${BASE_URL}/dictionary/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: 'cold' })
    });
    await fetch(`${BASE_URL}/dictionary/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: 'cold' })
    });

    const countAfter = db.prepare('SELECT COUNT(*) as count FROM dictionary WHERE LOWER(word) = ?').get('cold').count;
    assert.strictEqual(countAfter, 1, 'Duplicate row must not be created');
  });
});

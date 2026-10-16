/**
 * Automated Test Suite: Dictionary Negative Cases, Security & Boundary Limits
 * Covers: Negative & non-numeric pagination params, limit clamps, SQL injection resilience,
 * special regex characters, non-existent level/section filters, favorite toggling,
 * empty & whitespace searches, and lookup validation errors.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db/schema');

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001/api';

describe('Dictionary Boundary, Security & Negative Test Suite', () => {
  // --------------------------------------------------------------------------
  // Pagination & Clamping Negative Cases
  // --------------------------------------------------------------------------
  it('1. Pagination Negative: Negative page (?page=-5) is auto-clamped to page 1', async () => {
    const res = await fetch(`${BASE_URL}/dictionary?page=-5&limit=5`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.pagination.page, 1);
    assert.ok(body.data.length <= 5);
  });

  it('2. Pagination Negative: Page 0 (?page=0) is auto-clamped to page 1', async () => {
    const res = await fetch(`${BASE_URL}/dictionary?page=0&limit=5`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.pagination.page, 1);
  });

  it('3. Pagination Negative: Non-numeric page (?page=invalid_string) defaults to page 1', async () => {
    const res = await fetch(`${BASE_URL}/dictionary?page=invalid_string&limit=5`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.pagination.page, 1);
  });

  it('4. Pagination Negative: Negative limit (?limit=-10) is clamped to minimum limit (1)', async () => {
    const res = await fetch(`${BASE_URL}/dictionary?page=1&limit=-10`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.pagination.limit, 1);
    assert.strictEqual(body.data.length, 1);
  });

  it('5. Pagination Boundary: Huge limit (?limit=999999) is clamped to maximum limit (1000)', async () => {
    const res = await fetch(`${BASE_URL}/dictionary?page=1&limit=999999`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.pagination.limit, 1000);
    assert.ok(body.data.length <= 1000);
  });

  // --------------------------------------------------------------------------
  // Filter Boundary & Negative Cases
  // --------------------------------------------------------------------------
  it('6. Filter Negative: Nonexistent CEFR level (?level=Z99) returns empty results without crashing', async () => {
    const res = await fetch(`${BASE_URL}/dictionary?level=Z99`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.length, 0);
    assert.strictEqual(body.pagination.total, 0);
  });

  it('7. Filter Negative: Nonexistent sectionId (?sectionId=fake_404) returns empty results without crashing', async () => {
    const res = await fetch(`${BASE_URL}/dictionary?sectionId=fake_section_404_not_found`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.length, 0);
    assert.strictEqual(body.pagination.total, 0);
  });

  it('8. Filter Negative: Favorites filter (?favoritesOnly=true) returns only marked words', async () => {
    const res = await fetch(`${BASE_URL}/dictionary?favoritesOnly=true&limit=20`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    for (const card of body.data) {
      assert.strictEqual(card.is_favorite, 1);
    }
  });

  // --------------------------------------------------------------------------
  // Search Security & Special Character Resilience
  // --------------------------------------------------------------------------
  it('9. Search Security: SQL Injection payload (\' OR \'1\'=\'1) is safely handled without error', async () => {
    const payload = `' OR '1'='1`;
    const res = await fetch(`${BASE_URL}/dictionary?search=${encodeURIComponent(payload)}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
  });

  it('10. Search Security: Drop table payload (\'; DROP TABLE dictionary; --) is safely escaped', async () => {
    const payload = `'; DROP TABLE dictionary; --`;
    const res = await fetch(`${BASE_URL}/dictionary?search=${encodeURIComponent(payload)}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);

    // Verify dictionary table still exists and is healthy
    const row = db.prepare('SELECT COUNT(*) as count FROM dictionary').get();
    assert.ok(row.count > 0, 'Dictionary table must not be affected by SQL injection');
  });

  it('11. Search Edge: Special punctuation characters (!@#$%^&*()) do not break query', async () => {
    const symbols = '!@#$%^&*()_+{}|:<>?';
    const res = await fetch(`${BASE_URL}/dictionary?search=${encodeURIComponent(symbols)}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
  });

  it('12. Search Edge: Empty search query (?search=) returns normal paginated listing', async () => {
    const res = await fetch(`${BASE_URL}/dictionary?search=&limit=10`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.length, 10);
    assert.ok(body.pagination.total > 100);
  });

  it('13. Search Edge: Whitespace-only search query (?search=%20%20) is treated as empty', async () => {
    const res = await fetch(`${BASE_URL}/dictionary?search=%20%20%20&limit=10`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.length, 10);
  });

  it('14. Search Boundary: Very long search string (300 characters) handles without timeout', async () => {
    const longString = 'a'.repeat(300);
    const res = await fetch(`${BASE_URL}/dictionary?search=${longString}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.length, 0);
  });

  // --------------------------------------------------------------------------
  // Favorite Toggling & Lookup Validation Negative Cases
  // --------------------------------------------------------------------------
  it('15. Favorite Toggle: Toggling an existing word switches favorite status (0 -> 1 -> 0)', async () => {
    const word = db.prepare('SELECT id, is_favorite FROM dictionary ORDER BY id ASC LIMIT 1').get();
    const initialStatus = word.is_favorite || 0;

    // Toggle 1
    const res1 = await fetch(`${BASE_URL}/dictionary/${word.id}/favorite`, { method: 'POST' });
    assert.strictEqual(res1.status, 200);
    const body1 = await res1.json();
    assert.strictEqual(body1.data.is_favorite, initialStatus === 1 ? 0 : 1);

    // Toggle 2 (revert)
    const res2 = await fetch(`${BASE_URL}/dictionary/${word.id}/favorite`, { method: 'POST' });
    assert.strictEqual(res2.status, 200);
    const body2 = await res2.json();
    assert.strictEqual(body2.data.is_favorite, initialStatus);
  });

  it('16. Favorite Toggle Negative: Nonexistent wordId (999999999) handled gracefully', async () => {
    const res = await fetch(`${BASE_URL}/dictionary/999999999/favorite`, { method: 'POST' });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
  });

  it('17. Lookup Negative: Empty body returns 400 Bad Request', async () => {
    const res = await fetch(`${BASE_URL}/dictionary/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('обязательно'));
  });

  it('18. Lookup Negative: Empty string word returns 400 Bad Request', async () => {
    const res = await fetch(`${BASE_URL}/dictionary/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: '' })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });

  it('19. Lookup Negative: Whitespace-only word returns 400 Bad Request', async () => {
    const res = await fetch(`${BASE_URL}/dictionary/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: '    ' })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });
});

/**
 * Automated Test Suite: Dictionary & Search & Filters & Pagination
 * Covers: Search relevance ranking, case-insensitivity, Russian query translation search,
 * CEFR level filter, section filter, favorite toggling, pagination total & limit.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db/schema');

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001/api';

describe('Dictionary & Search Engine Test Suite', () => {
  it('1. Fetches dictionary words with valid pagination metadata', async () => {
    const res = await fetch(`${BASE_URL}/dictionary?page=1&limit=10`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length <= 10);
    assert.ok(typeof body.pagination.total === 'number');
    assert.ok(body.pagination.total >= body.data.length);
  });

  it('2. Search ranking: Exact word match appears as the #1 result (e.g. "cold")', async () => {
    const res = await fetch(`${BASE_URL}/dictionary?search=cold`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.length > 0);
    assert.strictEqual(body.data[0].word.toLowerCase(), 'cold');
  });

  it('3. Search ranking: Exact word match appears first for "chair"', async () => {
    const res = await fetch(`${BASE_URL}/dictionary?search=chair`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.length > 0);
    assert.strictEqual(body.data[0].word.toLowerCase(), 'chair');
  });

  it('4. Case-insensitivity: Search handles all uppercase query (e.g. "COLD")', async () => {
    const res = await fetch(`${BASE_URL}/dictionary?search=COLD`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.length > 0);
    assert.strictEqual(body.data[0].word.toLowerCase(), 'cold');
  });

  it('5. Case-insensitivity: Search handles mixed-case query (e.g. "cHaIr")', async () => {
    const res = await fetch(`${BASE_URL}/dictionary?search=cHaIr`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.length > 0);
    assert.strictEqual(body.data[0].word.toLowerCase(), 'chair');
  });

  it('6. Russian search: Finds English cards when searching by Russian translation (e.g. "стул")', async () => {
    const res = await fetch(`${BASE_URL}/dictionary?search=${encodeURIComponent('стул')}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.length > 0);
    const foundChair = body.data.some(item => item.word === 'chair' || item.translation.includes('стул'));
    assert.ok(foundChair, 'Expected to find chair card for Russian query "стул"');
  });

  it('7. Russian search: Finds English cards when searching for "холодный"', async () => {
    const res = await fetch(`${BASE_URL}/dictionary?search=${encodeURIComponent('холодный')}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.length > 0);
    assert.strictEqual(body.data[0].word.toLowerCase(), 'cold');
  });

  it('8. Nonexistent query returns clean empty list without crashing', async () => {
    const res = await fetch(`${BASE_URL}/dictionary?search=xyznonexistentterm999`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.length, 0);
    assert.strictEqual(body.pagination.total, 0);
  });

  it('9. Pagination limit boundary: Clamps to requested limit and calculates pages', async () => {
    const limit = 5;
    const res = await fetch(`${BASE_URL}/dictionary?page=1&limit=${limit}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.length, limit);
    assert.strictEqual(body.pagination.limit, limit);
    assert.strictEqual(body.pagination.pages, Math.ceil(body.pagination.total / limit));
  });

  it('10. Pagination offset: Page 2 returns subsequent items distinct from Page 1', async () => {
    const res1 = await fetch(`${BASE_URL}/dictionary?page=1&limit=5`);
    const body1 = await res1.json();
    const res2 = await fetch(`${BASE_URL}/dictionary?page=2&limit=5`);
    const body2 = await res2.json();

    const ids1 = body1.data.map(i => i.id);
    const ids2 = body2.data.map(i => i.id);

    // No overlap between adjacent pages
    for (const id of ids2) {
      assert.ok(!ids1.includes(id), `Found overlapping ID ${id} between page 1 and page 2`);
    }
  });

  it('11. Filter by CEFR Level: Only returns words matching specified level (e.g. "A1")', async () => {
    const res = await fetch(`${BASE_URL}/dictionary?level=A1&limit=20`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.data.length > 0);
    for (const item of body.data) {
      assert.strictEqual(item.level, 'A1');
    }
  });

  it('12. Filter by Section: Only returns words matching specified section', async () => {
    const res = await fetch(`${BASE_URL}/dictionary?sectionId=general&limit=20`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.data.length > 0);
    for (const item of body.data) {
      assert.strictEqual(item.section_id, 'general');
    }
  });

  it('13. Favorites Toggle: Correctly toggles is_favorite between 0 and 1', async () => {
    // Pick first word from dictionary
    const listRes = await fetch(`${BASE_URL}/dictionary?limit=1`);
    const listBody = await listRes.json();
    const testItem = listBody.data[0];
    assert.ok(testItem, 'Expected at least 1 word in dictionary');

    const originalFav = testItem.is_favorite;

    // Toggle once
    const toggleRes1 = await fetch(`${BASE_URL}/dictionary/${testItem.id}/favorite`, { method: 'POST' });
    assert.strictEqual(toggleRes1.status, 200);
    const toggleBody1 = await toggleRes1.json();
    assert.strictEqual(toggleBody1.data.is_favorite, originalFav === 1 ? 0 : 1);

    // Toggle back to preserve state
    const toggleRes2 = await fetch(`${BASE_URL}/dictionary/${testItem.id}/favorite`, { method: 'POST' });
    const toggleBody2 = await toggleRes2.json();
    assert.strictEqual(toggleBody2.data.is_favorite, originalFav);
  });

  it('14. Favorites Filter: favoritesOnly=true returns only favorite items', async () => {
    const res = await fetch(`${BASE_URL}/dictionary?favoritesOnly=true`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    for (const item of body.data) {
      assert.strictEqual(item.is_favorite, 1);
    }
  });
});

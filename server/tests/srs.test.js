/**
 * Automated Test Suite: SRS (Spaced Repetition System) & Repetition Intervals
 * Covers: SM-2 spaced repetition, 1-3 day intervals on first review,
 * 3-6 day expansion on second review, ease factor progression & clamps,
 * XP rewards, practice mode filtering (new words included, active wait words excluded).
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db/schema');

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001/api';
const TEST_USER = 'test_srs_user_' + Date.now();

describe('Spaced Repetition (SRS) Engine Test Suite', () => {
  let testWord1, testWord2, testWord3, testWord4;

  before(() => {
    // Pick 4 test words from dictionary
    const words = db.prepare('SELECT id, word FROM dictionary ORDER BY id ASC LIMIT 4').all();
    testWord1 = words[0];
    testWord2 = words[1];
    testWord3 = words[2];
    testWord4 = words[3];

    // Ensure clean state for test user
    db.prepare('DELETE FROM srs_reviews WHERE user_id = ?').run(TEST_USER);
    db.prepare('DELETE FROM users WHERE id = ?').run(TEST_USER);
  });

  it('1. Grade 1 ("Again" / forgot): Resets reps to 0, interval to 0 days, due in 10 minutes', async () => {
    const res = await fetch(`${BASE_URL}/dictionary/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordId: testWord1.id, grade: 1, userId: TEST_USER })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.reps, 0);
    assert.strictEqual(body.data.interval, 0);
    assert.strictEqual(body.data.xpEarned, 5);

    // Verify in database
    const review = db.prepare('SELECT * FROM srs_reviews WHERE user_id = ? AND word_id = ?').get(TEST_USER, testWord1.id);
    assert.strictEqual(review.grade, 1);
    assert.strictEqual(review.reps, 0);
    assert.strictEqual(review.interval, 0);
  });

  it('2. Grade 2 ("Hard"): First correct answer schedules 1-day repetition break', async () => {
    const res = await fetch(`${BASE_URL}/dictionary/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordId: testWord2.id, grade: 2, userId: TEST_USER })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.reps, 1);
    assert.strictEqual(body.data.interval, 1);
    assert.strictEqual(body.data.xpEarned, 10);
  });

  it('3. Grade 3 ("Good"): First correct answer schedules 2-day repetition break', async () => {
    const res = await fetch(`${BASE_URL}/dictionary/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordId: testWord3.id, grade: 3, userId: TEST_USER })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.reps, 1);
    assert.strictEqual(body.data.interval, 2);
    assert.strictEqual(body.data.xpEarned, 15);
  });

  it('4. Grade 4 ("Easy"): First correct answer schedules 3-day repetition break', async () => {
    const res = await fetch(`${BASE_URL}/dictionary/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordId: testWord4.id, grade: 4, userId: TEST_USER })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.reps, 1);
    assert.strictEqual(body.data.interval, 3);
    assert.strictEqual(body.data.xpEarned, 25);
  });

  it('5. Second consecutive review (reps = 1 -> 2): Expands interval to 6 days for Grade 4', async () => {
    const res = await fetch(`${BASE_URL}/dictionary/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordId: testWord4.id, grade: 4, userId: TEST_USER })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.reps, 2);
    assert.strictEqual(body.data.interval, 6);
  });

  it('6. Second consecutive review: Expands interval to 4 days for Grade 3', async () => {
    const res = await fetch(`${BASE_URL}/dictionary/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordId: testWord3.id, grade: 3, userId: TEST_USER })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.reps, 2);
    assert.strictEqual(body.data.interval, 4);
  });

  it('7. Third consecutive review (reps = 2 -> 3): Applies ease factor multiplier', async () => {
    const res = await fetch(`${BASE_URL}/dictionary/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordId: testWord4.id, grade: 4, userId: TEST_USER })
    });
    const body = await res.json();
    assert.strictEqual(body.data.reps, 3);
    // Interval should be >= 10 days (6 * EF * 1.25)
    assert.ok(body.data.interval >= 10);
  });

  it('8. Ease factor minimum clamp: Ease factor never drops below 1.3 even after multiple failures', async () => {
    // Review word1 with failure multiple times
    for (let i = 0; i < 8; i++) {
      await fetch(`${BASE_URL}/dictionary/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordId: testWord1.id, grade: 1, userId: TEST_USER })
      });
    }
    const review = db.prepare('SELECT * FROM srs_reviews WHERE user_id = ? AND word_id = ?').get(TEST_USER, testWord1.id);
    assert.ok(review.ef >= 1.3, `Ease factor should be >= 1.3, got ${review.ef}`);
  });

  it('9. User auto-creation: Reviewing a word automatically initializes user record in DB', async () => {
    const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(TEST_USER);
    assert.ok(userRow, 'User must be automatically created in users table');
    assert.ok(userRow.xp > 0, 'User must have earned XP');
  });

  it('10. Practice mode filtering: Newly unreviewed words are eligible for practice', async () => {
    // Query practice mode
    const res = await fetch(`${BASE_URL}/dictionary?mode=practice&userId=${TEST_USER}&limit=50`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.data.length > 0);

    // Any word with no srs review row is included
    const unreviewedInList = body.data.some(w => w.srs_reps === null);
    assert.ok(unreviewedInList, 'Expected unreviewed words in practice mode list');
  });

  it('11. Practice mode exclusion: Word reviewed with future due date (1-3 days) is EXCLUDED from practice', async () => {
    // testWord4 was reviewed and has a due date in the future (+10+ days)
    const res = await fetch(`${BASE_URL}/dictionary?mode=practice&userId=${TEST_USER}&limit=200`);
    const body = await res.json();
    const hasWord4 = body.data.some(w => w.id === testWord4.id);
    assert.strictEqual(hasWord4, false, 'Word scheduled for future review must NOT appear in practice mode');
  });

  it('12. Practice mode reactivation: Word whose due date has passed is re-included in practice', async () => {
    // Manually set testWord4's due_date to 1 hour ago
    db.prepare(`
      UPDATE srs_reviews 
      SET due_date = datetime('now', '-1 hour')
      WHERE user_id = ? AND word_id = ?
    `).run(TEST_USER, testWord4.id);

    const res = await fetch(`${BASE_URL}/dictionary?mode=practice&userId=${TEST_USER}&search=${testWord4.word}`);
    const body = await res.json();
    const hasWord4 = body.data.some(w => w.id === testWord4.id);
    assert.strictEqual(hasWord4, true, 'Word whose due date has arrived MUST reappear in practice mode');
  });
});

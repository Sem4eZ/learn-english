/**
 * Automated Test Suite: SRS (Spaced Repetition System) Algorithmic & Negative Suite
 * Covers: Review validation errors, grade bounds and clamps, SM-2 Ease Factor minimum limit (1.3),
 * progression intervals (1st rep -> 2nd rep -> nth rep), failure resets (grade 1 resets to 0),
 * DB conflict resolution (ON CONFLICT updates row, prevents duplicates), and XP synchronization.
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db/schema');

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001/api';
const RUN_ID = Date.now().toString(36);
const TEST_USER = `srs_neg_user_${RUN_ID}`;

describe('SRS Algorithmic Bounds & Negative Test Suite', () => {
  let sampleWordA, sampleWordB, sampleWordC;

  before(() => {
    const words = db.prepare('SELECT id, word FROM dictionary ORDER BY id ASC LIMIT 3').all();
    assert.ok(words.length >= 3, 'Must have at least 3 words in DB');
    sampleWordA = words[0];
    sampleWordB = words[1];
    sampleWordC = words[2];

    // Clean user reviews
    db.prepare('DELETE FROM srs_reviews WHERE user_id = ?').run(TEST_USER);
    db.prepare('DELETE FROM users WHERE id = ?').run(TEST_USER);
  });

  // --------------------------------------------------------------------------
  // Validation Negative Cases
  // --------------------------------------------------------------------------
  it('1. Review Negative: Missing wordId returns 400 Bad Request', async () => {
    const res = await fetch(`${BASE_URL}/dictionary/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grade: 3, userId: TEST_USER })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('wordId'));
  });

  it('2. Review Negative: Empty body returns 400 Bad Request', async () => {
    const res = await fetch(`${BASE_URL}/dictionary/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });

  it('3. Review Negative: Negative grade (grade = -5) is clamped to minimum grade (1)', async () => {
    const res = await fetch(`${BASE_URL}/dictionary/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordId: sampleWordA.id, grade: -5, userId: TEST_USER })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    // Grade 1 means interval = 0, reps = 0, xp = 5
    assert.strictEqual(body.data.reps, 0);
    assert.strictEqual(body.data.interval, 0);
    assert.strictEqual(body.data.xpEarned, 5);
  });

  it('4. Review Negative: Out-of-bounds high grade (grade = 99) is clamped to maximum grade (4)', async () => {
    const res = await fetch(`${BASE_URL}/dictionary/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordId: sampleWordB.id, grade: 99, userId: TEST_USER })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    // Grade 4 (Easy) gives 25 XP and interval 3 days on 1st rep
    assert.strictEqual(body.data.reps, 1);
    assert.strictEqual(body.data.interval, 3);
    assert.strictEqual(body.data.xpEarned, 25);
  });

  it('5. Review Negative: Non-numeric grade (grade = "easy") defaults to grade 1', async () => {
    const res = await fetch(`${BASE_URL}/dictionary/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordId: sampleWordA.id, grade: 'invalid_grade', userId: TEST_USER })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.reps, 0);
  });

  // --------------------------------------------------------------------------
  // SM-2 Algorithmic Bounds & Ease Factor (EF) Invariants
  // --------------------------------------------------------------------------
  it('6. SM-2 Bound: Ease Factor (EF) never drops below absolute minimum of 1.3 even after 10 consecutive failures', async () => {
    // Fail word A 10 times consecutively
    for (let i = 0; i < 10; i++) {
      const res = await fetch(`${BASE_URL}/dictionary/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordId: sampleWordA.id, grade: 1, userId: TEST_USER })
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.ok(body.data.ef >= 1.3, `EF was ${body.data.ef}, must be >= 1.3`);
    }

    // Verify in database
    const dbRow = db.prepare('SELECT ef FROM srs_reviews WHERE user_id = ? AND word_id = ?').get(TEST_USER, sampleWordA.id);
    assert.strictEqual(dbRow.ef, 1.3);
  });

  it('7. SM-2 Progression: Multi-step review expansion (Rep 1 -> Rep 2 -> Rep 3)', async () => {
    // Step 1: Grade 3 ("Good")
    const step1 = await fetch(`${BASE_URL}/dictionary/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordId: sampleWordC.id, grade: 3, userId: TEST_USER })
    }).then(r => r.json());
    assert.strictEqual(step1.data.reps, 1);
    assert.strictEqual(step1.data.interval, 2);

    // Step 2: Grade 3 ("Good") again
    const step2 = await fetch(`${BASE_URL}/dictionary/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordId: sampleWordC.id, grade: 3, userId: TEST_USER })
    }).then(r => r.json());
    assert.strictEqual(step2.data.reps, 2);
    assert.strictEqual(step2.data.interval, 4);

    // Step 3: Grade 3 ("Good") again
    const step3 = await fetch(`${BASE_URL}/dictionary/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordId: sampleWordC.id, grade: 3, userId: TEST_USER })
    }).then(r => r.json());
    assert.strictEqual(step3.data.reps, 3);
    assert.ok(step3.data.interval >= 8, `Expected interval >= 8, got ${step3.data.interval}`);
  });

  it('8. SM-2 Reset: Grade 1 ("Forgot") immediately resets active reps and interval to 0', async () => {
    // Word C now has reps = 3 and interval >= 8
    const res = await fetch(`${BASE_URL}/dictionary/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordId: sampleWordC.id, grade: 1, userId: TEST_USER })
    });
    const body = await res.json();
    assert.strictEqual(body.data.reps, 0);
    assert.strictEqual(body.data.interval, 0);

    // Verify database row
    const row = db.prepare('SELECT reps, interval FROM srs_reviews WHERE user_id = ? AND word_id = ?').get(TEST_USER, sampleWordC.id);
    assert.strictEqual(row.reps, 0);
    assert.strictEqual(row.interval, 0);
  });

  it('9. Idempotency & Conflict Check: Multiple reviews never create duplicate rows for same user and word', async () => {
    const count = db.prepare('SELECT COUNT(*) as count FROM srs_reviews WHERE user_id = ? AND word_id = ?').get(TEST_USER, sampleWordC.id).count;
    assert.strictEqual(count, 1, 'There must be strictly 1 row in srs_reviews per user and word');
  });

  it('10. XP Tier Verification: Each grade tier awards exact XP amount', async () => {
    const userRowBefore = db.prepare('SELECT xp FROM users WHERE id = ?').get(TEST_USER);
    const startXp = userRowBefore.xp;

    // Grade 2 should award +10 XP
    const res = await fetch(`${BASE_URL}/dictionary/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordId: sampleWordB.id, grade: 2, userId: TEST_USER })
    });
    const body = await res.json();
    assert.strictEqual(body.data.xpEarned, 10);
    assert.strictEqual(body.data.totalXp, startXp + 10);
  });
});

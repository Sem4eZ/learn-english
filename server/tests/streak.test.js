const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { calculateStreakFromDates, recordUserActivity, getUserStreak } = require('../src/services/streakService');
const db = require('../src/db/schema');

describe('Streak Service & Daily Tracking Test Suite', () => {
  const TEST_USER = 'streak_test_user_' + Date.now();

  before(async () => {
    await db.prepare('INSERT INTO users (id, username, xp, streak) VALUES (?, ?, 0, 1)').run(TEST_USER, 'StreakTester');
  });

  after(async () => {
    try {
      await db.prepare('DELETE FROM users WHERE id = ?').run(TEST_USER);
      await db.prepare('DELETE FROM srs_reviews WHERE user_id = ?').run(TEST_USER);
      await db.prepare('DELETE FROM user_answers WHERE user_id = ?').run(TEST_USER);
    } catch (_) {}
  });

  it('1. Pure Function: Consecutive days increment streak', () => {
    const dates = ['2026-10-19', '2026-10-18', '2026-10-17'];
    const streak = calculateStreakFromDates(dates, '2026-10-19');
    assert.strictEqual(streak, 3);
  });

  it('2. Pure Function: Multiple activities on same day do not double-increment streak', () => {
    const dates = ['2026-10-19', '2026-10-19', '2026-10-18', '2026-10-18'];
    const streak = calculateStreakFromDates(dates, '2026-10-19');
    assert.strictEqual(streak, 2);
  });

  it('3. Pure Function: Streak continues if user practiced yesterday and has not yet practiced today', () => {
    const dates = ['2026-10-18', '2026-10-17'];
    const streak = calculateStreakFromDates(dates, '2026-10-19');
    assert.strictEqual(streak, 2);
  });

  it('4. Pure Function: Missing more than 1 day resets streak to 1', () => {
    const dates = ['2026-10-16', '2026-10-15']; // missed 2026-10-17 and 2026-10-18
    const streak = calculateStreakFromDates(dates, '2026-10-19');
    assert.strictEqual(streak, 1);
  });

  it('5. Database Record: First activity sets streak = 1 and sets last_active_date', async () => {
    const res = await recordUserActivity(TEST_USER, 15);
    assert.strictEqual(res.streak, 1);
    assert.strictEqual(res.xp, 15);

    const user = await db.prepare('SELECT streak, last_active_date, xp FROM users WHERE id = ?').get(TEST_USER);
    assert.strictEqual(user.streak, 1);
    assert.strictEqual(user.xp, 15);
  });

  it('6. Database Record: Second activity on same day keeps streak = 1 and adds XP', async () => {
    const res = await recordUserActivity(TEST_USER, 25);
    assert.strictEqual(res.streak, 1);
    assert.strictEqual(res.xp, 40);
  });

  it('7. Database Record: Activity on next consecutive day increments streak to 2', async () => {
    // Simulate last_active_date was yesterday
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    await db.prepare('UPDATE users SET last_active_date = ?, streak = 1 WHERE id = ?').run(yesterday, TEST_USER);

    const res = await recordUserActivity(TEST_USER, 15);
    assert.strictEqual(res.streak, 2);

    const user = await db.prepare('SELECT streak FROM users WHERE id = ?').get(TEST_USER);
    assert.strictEqual(user.streak, 2);
  });

  it('8. Database Dynamic Streak Evaluation: Reflects activity from srs_reviews table', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    const wordRow = await db.prepare('SELECT id FROM dictionary LIMIT 1').get();
    const wordId = wordRow ? wordRow.id : 1;

    // Insert simulated srs_reviews on yesterday and today
    await db.prepare(`
      INSERT OR REPLACE INTO srs_reviews (user_id, word_id, grade, reps, interval, ef, reviewed_at)
      VALUES (?, ?, 4, 1, 1, 2.5, ?)
    `).run(TEST_USER, wordId, yesterday + ' 12:00:00');

    const calculated = await getUserStreak(TEST_USER);
    assert.ok(calculated >= 1);
  });
});

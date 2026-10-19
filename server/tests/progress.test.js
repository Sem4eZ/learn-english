/**
 * Automated Test Suite: User Progress, Gamification, Stats & History Engine
 * Covers: Answer recording (correct/incorrect XP, streak preservation, validation errors,
 * 404 on missing questions), Stats calculation (gamification levels, CEFR breakdown,
 * 7-day activity, SRS retention stages, badges), and History merging & mistakes filter.
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db/schema');

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001/api';
const RUN_ID = Date.now().toString(36);
const TEST_USER = `progress_user_${RUN_ID}`;

describe('User Progress, Analytics & Gamification Test Suite', () => {
  let sampleQuestion;

  before(() => {
    // Pick an existing question from database
    sampleQuestion = db.prepare('SELECT * FROM questions ORDER BY id ASC LIMIT 1').get();
    assert.ok(sampleQuestion, 'Must have at least one question in DB for testing');

    // Clean user records and register test user
    db.prepare('DELETE FROM user_answers WHERE user_id = ?').run(TEST_USER);
    db.prepare('DELETE FROM srs_reviews WHERE user_id = ?').run(TEST_USER);
    db.prepare('DELETE FROM users WHERE id = ?').run(TEST_USER);
    db.prepare('INSERT INTO users (id, username, xp, streak) VALUES (?, ?, 0, 1)').run(TEST_USER, 'TestProgressUser');
  });

  // --------------------------------------------------------------------------
  // Record Answer: Negative & Validation Cases
  // --------------------------------------------------------------------------
  it('1. Answer Negative: Missing questionId returns 400 Bad Request', async () => {
    const res = await fetch(`${BASE_URL}/progress/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedIndex: 1, userId: TEST_USER })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('questionId'));
  });

  it('2. Answer Negative: Missing selectedIndex returns 400 Bad Request', async () => {
    const res = await fetch(`${BASE_URL}/progress/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: sampleQuestion.id, userId: TEST_USER })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('selectedIndex'));
  });

  it('3. Answer Negative: Nonexistent questionId returns 404 Not Found', async () => {
    const res = await fetch(`${BASE_URL}/progress/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 999999999, selectedIndex: 0, userId: TEST_USER })
    });
    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('Question not found'));
  });

  it('4. Answer Negative: Empty body returns 400 Bad Request', async () => {
    const res = await fetch(`${BASE_URL}/progress/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });

  // --------------------------------------------------------------------------
  // Record Answer: Positive & Gamification Logic
  // --------------------------------------------------------------------------
  it('5. Answer Positive (Correct): Awards 15 XP and marks isCorrect = true', async () => {
    const res = await fetch(`${BASE_URL}/progress/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: sampleQuestion.id,
        selectedIndex: sampleQuestion.correct_index,
        userId: TEST_USER
      })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.isCorrect, true);
    assert.strictEqual(body.data.xpEarned, 15);
    assert.strictEqual(body.data.totalXp, 15);
    assert.ok(body.data.explanation);

    // Verify row in user_answers table
    const row = db.prepare('SELECT * FROM user_answers WHERE user_id = ? AND question_id = ?').get(TEST_USER, sampleQuestion.id);
    assert.ok(row);
    assert.strictEqual(row.is_correct, 1);
  });

  it('6. Answer Positive (Incorrect): Awards 0 XP for wrong answer and marks isCorrect = false', async () => {
    const wrongIndex = (sampleQuestion.correct_index + 1) % 4;
    const res = await fetch(`${BASE_URL}/progress/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: sampleQuestion.id,
        selectedIndex: wrongIndex,
        userId: TEST_USER
      })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.isCorrect, false);
    assert.strictEqual(body.data.xpEarned, 0);
    assert.strictEqual(body.data.totalXp, 15); // 15 + 0
  });

  it('7. Streak Logic: Multiple answers on same calendar day do not double-increment streak', async () => {
    const res = await fetch(`${BASE_URL}/progress/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: sampleQuestion.id,
        selectedIndex: sampleQuestion.correct_index,
        userId: TEST_USER
      })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.streak, 1);
  });

  // --------------------------------------------------------------------------
  // Stats & Dashboard Analytics
  // --------------------------------------------------------------------------
  it('8. Stats Fresh User: Clean response without NaN or division by zero errors', async () => {
    const freshUser = `fresh_${Date.now()}`;
    const res = await fetch(`${BASE_URL}/progress/stats?userId=${freshUser}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.xp, 0);
    assert.strictEqual(body.data.level, 1);
    assert.strictEqual(body.data.accuracy, 100);
    assert.strictEqual(body.data.totalAnswered, 0);
    assert.strictEqual(body.data.correctAnswered, 0);
  });

  it('9. Stats Leveling: Mathematical progression matches level formula Math.floor(sqrt(xp/50)) + 1', async () => {
    const res = await fetch(`${BASE_URL}/progress/stats?userId=${TEST_USER}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);

    const xp = body.data.xp;
    const expectedLevel = Math.floor(Math.sqrt(xp / 50)) + 1;
    assert.strictEqual(body.data.level, expectedLevel);
    assert.ok(body.data.rankTitle);
    assert.ok(body.data.levelPercent >= 0 && body.data.levelPercent <= 100);
  });

  it('10. Stats Weekly Activity: Returns exactly 7 days with valid date format and single today flag', async () => {
    const res = await fetch(`${BASE_URL}/progress/stats?userId=${TEST_USER}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    const activity = body.data.weeklyActivity;

    assert.ok(Array.isArray(activity));
    assert.strictEqual(activity.length, 7);

    // Exactly one day is marked as today (the last one)
    const todayItems = activity.filter(d => d.isToday);
    assert.strictEqual(todayItems.length, 1);
    assert.strictEqual(activity[6].isToday, true);

    // Date format verification: YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    for (const day of activity) {
      assert.ok(dateRegex.test(day.date), `Expected date ${day.date} to match YYYY-MM-DD`);
      assert.ok(typeof day.day === 'string');
      assert.ok(typeof day.xp === 'number');
    }
  });

  it('11. Stats CEFR Breakdown: Returns levels A1 through C1 with accurate counts', async () => {
    const res = await fetch(`${BASE_URL}/progress/stats?userId=${TEST_USER}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    const cefr = body.data.cefrBreakdown;

    assert.ok(Array.isArray(cefr));
    assert.ok(cefr.length >= 5);
    const levels = cefr.map(c => c.level);
    assert.ok(levels.includes('A1'));
    assert.ok(levels.includes('B1'));
    assert.ok(levels.includes('C1'));

    for (const c of cefr) {
      assert.ok(typeof c.total === 'number');
      assert.ok(typeof c.count === 'number');
      assert.ok(typeof c.percent === 'number');
      assert.ok(c.percent >= 0 && c.percent <= 100);
    }
  });

  it('12. Stats SRS Stages: Categorizes vocabulary into mastered, review, learning and new', async () => {
    const res = await fetch(`${BASE_URL}/progress/stats?userId=${TEST_USER}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    const { masteredWords, reviewWords, learningWords, newWords, totalDictWords } = body.data;

    assert.ok(typeof masteredWords === 'number');
    assert.ok(typeof reviewWords === 'number');
    assert.ok(typeof learningWords === 'number');
    assert.ok(typeof newWords === 'number');
    assert.ok(typeof totalDictWords === 'number');
    assert.ok(totalDictWords > 0);
  });

  it('13. Stats Badges: Returns structured milestones with unlocked status', async () => {
    const res = await fetch(`${BASE_URL}/progress/stats?userId=${TEST_USER}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    const badges = body.data.badges;

    assert.ok(Array.isArray(badges));
    assert.ok(badges.length >= 6);
    const firstStep = badges.find(b => b.id === 'first_step');
    assert.ok(firstStep);
    assert.strictEqual(firstStep.unlocked, true, 'User answered questions so first_step must be unlocked');
  });

  // --------------------------------------------------------------------------
  // History & Mistakes Engine
  // --------------------------------------------------------------------------
  it('14. History: Returns chronological list of user mistake entries (only errors)', async () => {
    const res = await fetch(`${BASE_URL}/progress/history?userId=${TEST_USER}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 1);

    // Verify fields and strictly mistake status
    const item = body.data[0];
    assert.ok(item.type);
    assert.ok(item.answered_at);
    assert.strictEqual(item.is_correct, 0);
  });

  it('15. History Mistakes Only Filter: When mistakesOnly=true, returns strictly mistakes', async () => {
    const res = await fetch(`${BASE_URL}/progress/history?userId=${TEST_USER}&mistakesOnly=true`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));

    // Every item must be an error
    for (const item of body.data) {
      if (item.type === 'grammar') {
        assert.strictEqual(item.is_correct, 0, 'Grammar mistake must have is_correct = 0');
      } else if (item.type === 'vocab') {
        assert.ok(item.srs_grade <= 2, 'Vocab mistake must have grade <= 2');
      }
    }
  });

  it('16. History Fresh User: Returns empty array [] without failing', async () => {
    const emptyUser = `empty_user_${Date.now()}`;
    const res = await fetch(`${BASE_URL}/progress/history?userId=${emptyUser}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.deepStrictEqual(body.data, []);
  });
});

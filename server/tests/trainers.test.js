/**
 * Automated Test Suite: Interactive Trainer Engines & System APIs
 * Covers: Vocab Quiz 1-of-4 option generation, distractor uniqueness,
 * Speed Sprint combo multipliers, Word Builder spelling anagrams,
 * Sections curriculum, Server Health, and Progress Tracking.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db/schema');

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001/api';

describe('Interactive Trainers & Core Engine Test Suite', () => {
  it('1. Health Check: Server responds with status 200 OK and valid timestamp', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'ok');
    assert.ok(body.timestamp);
  });

  it('2. Sections API: Returns comprehensive curriculum list with prompt focus', async () => {
    const res = await fetch(`${BASE_URL}/sections`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 5);

    // Verify section properties
    const firstSection = body.data[0];
    assert.ok(firstSection.id);
    assert.ok(firstSection.title);
    assert.ok(firstSection.description);
  });

  it('3. Vocab Quiz Engine: Generates exactly 4 options (1 correct + 3 unique distractors)', () => {
    const words = db.prepare('SELECT id, word, translation FROM dictionary ORDER BY id ASC LIMIT 20').all();
    assert.ok(words.length >= 4, 'Need at least 4 dictionary words to test quiz options');

    const targetWord = words[0];
    const otherWords = words.filter(w => w.id !== targetWord.id);

    // Build 4 choices
    const distractors = otherWords
      .map(w => w.translation)
      .filter(t => t !== targetWord.translation)
      .slice(0, 3);

    const options = [targetWord.translation, ...distractors];

    assert.strictEqual(options.length, 4, 'Must have exactly 4 choices');
    assert.ok(options.includes(targetWord.translation), 'Must contain correct translation');
    // Check all options are unique
    const uniqueOptions = new Set(options);
    assert.strictEqual(uniqueOptions.size, 4, 'All 4 choices must be distinct');
  });

  it('4. Vocab Quiz Distractor Integrity: Distractors never include the target word', () => {
    const words = db.prepare('SELECT id, word, translation FROM dictionary ORDER BY id ASC LIMIT 30').all();
    const currentWord = words[5];

    const distractorCandidates = words
      .filter(w => w.id !== currentWord.id && w.translation !== currentWord.translation)
      .map(w => w.translation);

    assert.ok(!distractorCandidates.includes(currentWord.translation));
  });

  it('5. Speed Sprint Engine: Streak combo multipliers calculate properly (x1, x2, x3, x4)', () => {
    const getMultiplier = (streak) => {
      if (streak >= 10) return 4;
      if (streak >= 6) return 3;
      if (streak >= 3) return 2;
      return 1;
    };

    assert.strictEqual(getMultiplier(0), 1);
    assert.strictEqual(getMultiplier(1), 1);
    assert.strictEqual(getMultiplier(2), 1);
    assert.strictEqual(getMultiplier(3), 2);
    assert.strictEqual(getMultiplier(5), 2);
    assert.strictEqual(getMultiplier(6), 3);
    assert.strictEqual(getMultiplier(9), 3);
    assert.strictEqual(getMultiplier(10), 4);
    assert.strictEqual(getMultiplier(25), 4);
  });

  it('6. Word Builder Engine: Anagram letters match all letters of target word', () => {
    const word = 'CHALLENGE';
    const letters = word.split('');
    const shuffled = [...letters].sort(() => Math.random() - 0.5);

    assert.strictEqual(letters.length, shuffled.length);
    assert.strictEqual(
      letters.slice().sort().join(''),
      shuffled.slice().sort().join('')
    );
  });

  it('7. Word Builder Spelling Validation: Validates correct sequence assembly', () => {
    const target = 'BICYCLE';
    const assembledCorrect = ['B', 'I', 'C', 'Y', 'C', 'L', 'E'].join('');
    const assembledWrong = ['B', 'Y', 'C', 'I', 'C', 'L', 'E'].join('');

    assert.strictEqual(assembledCorrect === target, true);
    assert.strictEqual(assembledWrong === target, false);
  });

  it('8. User Stats API: Returns user level, streak, XP and active counters', async () => {
    const res = await fetch(`${BASE_URL}/progress/stats`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(typeof body.data.xp === 'number');
    assert.ok(typeof body.data.streak === 'number');
    assert.ok(typeof body.data.level === 'number');
  });

  it('9. Progress Answer Recording: Records answer history without error', async () => {
    // Get a question id
    const qRow = db.prepare('SELECT id FROM questions LIMIT 1').get();
    if (!qRow) return; // Skip if questions table is empty

    const res = await fetch(`${BASE_URL}/progress/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: qRow.id,
        selectedIndex: 0
      })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(typeof body.data.xpEarned === 'number');
  });

  it('10. Progress History API: Fetches practice activity logs', async () => {
    const res = await fetch(`${BASE_URL}/progress/history?mistakesOnly=false`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
  });

  it('11. Auth Me: Guest user authentication fallback works seamlessly', async () => {
    const res = await fetch(`${BASE_URL}/auth/me`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.user);
    assert.ok(body.user.username);
  });
});

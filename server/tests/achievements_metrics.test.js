const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db/schema');
const { buildAchievementsList } = require('../src/services/achievementsService');
const { getStats } = require('../src/controllers/progressController');

describe('Achievements, Trainer Breakdown & Combined Metrics Test Suite', () => {
  it('1. Achievements Count: buildAchievementsList generates exactly between 150 and 200 achievements', () => {
    const badges = buildAchievementsList({
      wordsLearned: 15,
      streak: 5,
      level: 3,
      xp: 450,
      trainerCounts: { grammar: 10, quiz: 5, sprint: 8, builder: 2, cards: 12, audio: 4 },
      sectionCounts: { grammar: 10, business: 2 },
      masteredWords: 5,
      reviewWords: 10,
      totalAnswered: 50,
      correctAnswered: 45,
      overallAccuracy: 90
    });

    assert.ok(badges.length >= 150 && badges.length <= 200, `Expected 150-200 achievements, got ${badges.length}`);
    assert.strictEqual(badges.length, 179);
  });

  it('2. Achievements Categories: All 8 core categories are populated', () => {
    const badges = buildAchievementsList({});
    const categories = new Set(badges.map(b => b.category));

    assert.ok(categories.has('vocab'), 'Category vocab missing');
    assert.ok(categories.has('streak'), 'Category streak missing');
    assert.ok(categories.has('levels'), 'Category levels missing');
    assert.ok(categories.has('xp'), 'Category xp missing');
    assert.ok(categories.has('trainers'), 'Category trainers missing');
    assert.ok(categories.has('themes'), 'Category themes missing');
    assert.ok(categories.has('memory'), 'Category memory missing');
    assert.ok(categories.has('accuracy'), 'Category accuracy missing');
    assert.strictEqual(categories.size, 8);
  });

  it('3. Legacy Badge IDs: Preserves compatibility with existing assertion tests', () => {
    const freshBadges = buildAchievementsList({ wordsLearned: 0, streak: 0, level: 1, xp: 0 });
    const unlockedBadges = buildAchievementsList({
      wordsLearned: 100,
      streak: 3,
      level: 5,
      xp: 1500,
      totalAnswered: 10,
      correctAnswered: 10,
      overallAccuracy: 100,
      masteredWords: 25
    });

    const legacyIds = ['first_step', 'words_50', 'words_100', 'streak_3', 'level_5', 'memory_vault', 'sniper'];
    legacyIds.forEach(id => {
      const fresh = freshBadges.find(b => b.id === id);
      assert.ok(fresh, `Legacy badge ${id} must exist in achievements`);
      assert.strictEqual(fresh.unlocked, false, `Badge ${id} should be locked initially`);

      const unlocked = unlockedBadges.find(b => b.id === id);
      assert.ok(unlocked, `Legacy badge ${id} must exist in unlocked achievements`);
      assert.strictEqual(unlocked.unlocked, true, `Badge ${id} should be unlocked under met criteria`);
    });
  });

  it('4. Trainer Activity Table: trainer_activity table records and groups all 6 trainer modes', () => {
    const testUserId = `test-user-metrics-${Date.now()}`;
    db.prepare(`
      INSERT INTO users (id, username, password_hash, xp, streak)
      VALUES (?, ?, 'hash', 100, 2)
    `).run(testUserId, `user_${Date.now()}`);

    const trainers = ['grammar', 'quiz', 'sprint', 'builder', 'cards', 'audio'];
    trainers.forEach((trainerId, idx) => {
      db.prepare(`
        INSERT INTO trainer_activity (user_id, trainer_id, section_id, is_correct)
        VALUES (?, ?, 'grammar', ?)
      `).run(testUserId, trainerId, idx % 2 === 0 ? 1 : 0);
    });

    const rows = db.prepare(`
      SELECT trainer_id, COUNT(*) as attempted, SUM(is_correct) as correct
      FROM trainer_activity
      WHERE user_id = ?
      GROUP BY trainer_id
    `).all(testUserId);

    assert.strictEqual(rows.length, 6);
    trainers.forEach(t => {
      const row = rows.find(r => r.trainer_id === t);
      assert.ok(row, `Activity for ${t} should be logged`);
      assert.strictEqual(row.attempted, 1);
    });
  });

  it('5. Stats Analytics: getStats combines grammar and trainer attempts in section breakdown', async () => {
    const testUserId = `test-user-combined-${Date.now()}`;
    db.prepare(`
      INSERT INTO users (id, username, password_hash, xp, streak)
      VALUES (?, ?, 'hash', 250, 4)
    `).run(testUserId, `user_comb_${Date.now()}`);

    // Insert grammar answer for 'grammar' section
    const qRow = db.prepare(`SELECT id FROM questions WHERE section_id = 'grammar' LIMIT 1`).get();
    if (qRow) {
      db.prepare(`
        INSERT INTO user_answers (user_id, question_id, selected_index, is_correct)
        VALUES (?, ?, 0, 1)
      `).run(testUserId, qRow.id);
    }

    // Insert trainer activities for 'grammar' section
    db.prepare(`
      INSERT INTO trainer_activity (user_id, trainer_id, section_id, is_correct)
      VALUES (?, 'quiz', 'grammar', 1)
    `).run(testUserId);

    db.prepare(`
      INSERT INTO trainer_activity (user_id, trainer_id, section_id, is_correct)
      VALUES (?, 'cards', 'grammar', 0)
    `).run(testUserId);

    // Call getStats
    let responseData = null;
    const req = {
      headers: { 'x-user-id': testUserId }
    };
    const res = {
      json(payload) {
        responseData = payload;
        return this;
      },
      status() {
        return this;
      }
    };

    await getStats(req, res);

    assert.ok(responseData, 'Response data must be returned');
    assert.strictEqual(responseData.success, true);
    assert.strictEqual(responseData.data.trainerBreakdown.length, 6);

    const grammarSec = responseData.data.sectionBreakdown.find(s => s.id === 'grammar');
    assert.ok(grammarSec, 'Section grammar must exist in breakdown');
    assert.ok(grammarSec.attempted >= 2, `Expected attempted >= 2, got ${grammarSec.attempted}`);
    assert.ok(responseData.data.badges.length >= 150, `Expected 150+ badges, got ${responseData.data.badges.length}`);
  });
});

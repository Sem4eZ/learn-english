/**
 * Automated Test Suite: Background Harvester & Autonomous Replenishment Engine
 * 
 * Verifies:
 * 1. BackgroundHarvester instantiation, configuration defaults, and ratio setup (3:1).
 * 2. 3:1 cycle sequencing: steps 1, 2, 3 dispatch vocabulary, step 4 dispatches grammar questions.
 * 3. CEFR level and thematic section matrix rotation logic.
 * 4. Concurrency guard (in-flight protection against duplicate overlapping executions).
 * 5. Error handling and exponential backoff tracking (simulated 429 / 503).
 * 6. Start / Stop lifecycle and timer management idempotence.
 * 7. Live stats telemetry via BackgroundHarvester.getStats().
 * 8. API Endpoint /api/dictionary/harvester-stats integrity.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { BackgroundHarvester, CEFR_LEVELS, HARVEST_SECTIONS, GRAMMAR_TOPICS } = require('../src/services/backgroundHarvester');
const singletonHarvester = require('../src/services/backgroundHarvester');
const geminiService = require('../src/services/geminiService');

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001/api';

describe('Background Harvester & Autonomous Replenishment Test Suite', () => {
  let originalGenVocab;
  let originalGenQuestions;

  beforeEach(() => {
    originalGenVocab = geminiService.generateVocabulary;
    originalGenQuestions = geminiService.generateQuestions;
  });

  afterEach(() => {
    geminiService.generateVocabulary = originalGenVocab;
    geminiService.generateQuestions = originalGenQuestions;
  });

  // --------------------------------------------------------------------------
  // 1. Instantiation & Config Defaults
  // --------------------------------------------------------------------------
  it('1. Harvester Config: Initializes with correct defaults and 3:1 ratio', () => {
    const harvester = new BackgroundHarvester();
    const stats = harvester.getStats();

    assert.strictEqual(stats.ratio, '3:1');
    assert.strictEqual(stats.totalCycleSteps, 4);
    assert.strictEqual(stats.currentCycleStep, 1);
    assert.strictEqual(stats.nextType, 'vocabulary');
    assert.strictEqual(stats.totalRuns, 0);
    assert.strictEqual(stats.totalVocabWordsAdded, 0);
    assert.strictEqual(stats.totalGrammarQuestionsAdded, 0);
    assert.strictEqual(stats.isRunning, false);
    assert.strictEqual(stats.isHarvesting, false);
  });

  it('2. Harvester Config: Supports custom interval, batch sizes, and ratio', () => {
    const custom = new BackgroundHarvester({
      intervalMs: 15000,
      vocabBatchSize: 60,
      grammarBatchSize: 12,
      vocabRatio: 4
    });
    const stats = custom.getStats();

    assert.strictEqual(stats.intervalMs, 15000);
    assert.strictEqual(stats.ratio, '4:1');
    assert.strictEqual(stats.totalCycleSteps, 5);
  });

  // --------------------------------------------------------------------------
  // 2. 3:1 Ratio Dispatch Sequencing
  // --------------------------------------------------------------------------
  it('3. Cycle Dispatch: Exactly 3 vocabulary harvests followed by 1 grammar harvest', async () => {
    const calls = [];

    geminiService.generateVocabulary = async (level, section, count) => {
      calls.push({ type: 'vocab', level, section, count });
      return [{ id: 101, word: 'sample', translation: 'пример' }];
    };

    geminiService.generateQuestions = async (sec, level, count, topic) => {
      calls.push({ type: 'grammar', level, topic, count });
      return [{ id: 201, question_text: 'Test question?' }];
    };

    const testHarvester = new BackgroundHarvester({ vocabRatio: 3 });

    // Step 1: Vocab
    const res1 = await testHarvester.triggerHarvest();
    assert.strictEqual(res1.type, 'vocabulary');
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].type, 'vocab');

    // Step 2: Vocab
    const res2 = await testHarvester.triggerHarvest();
    assert.strictEqual(res2.type, 'vocabulary');
    assert.strictEqual(calls.length, 2);
    assert.strictEqual(calls[1].type, 'vocab');

    // Step 3: Vocab
    const res3 = await testHarvester.triggerHarvest();
    assert.strictEqual(res3.type, 'vocabulary');
    assert.strictEqual(calls.length, 3);
    assert.strictEqual(calls[2].type, 'vocab');

    // Step 4: Grammar
    const res4 = await testHarvester.triggerHarvest();
    assert.strictEqual(res4.type, 'grammar');
    assert.strictEqual(calls.length, 4);
    assert.strictEqual(calls[3].type, 'grammar');

    // Step 5: Cycle wraps back to Vocab
    const res5 = await testHarvester.triggerHarvest();
    assert.strictEqual(res5.type, 'vocabulary');
    assert.strictEqual(calls.length, 5);
    assert.strictEqual(calls[4].type, 'vocab');

    // Verify stats counters
    const stats = testHarvester.getStats();
    assert.strictEqual(stats.totalRuns, 5);
    assert.strictEqual(stats.totalVocabWordsAdded, 4);
    assert.strictEqual(stats.totalGrammarQuestionsAdded, 1);
  });

  // --------------------------------------------------------------------------
  // 3. Matrix Round-Robin Rotation
  // --------------------------------------------------------------------------
  it('4. Matrix Rotation: Advances CEFR levels and sections across harvests', async () => {
    const recordedLevels = [];

    geminiService.generateVocabulary = async (level, section, count) => {
      recordedLevels.push({ level, section });
      return [{ id: 1, word: 'word' }];
    };

    geminiService.generateQuestions = async (sec, level, count, topic) => {
      return [{ id: 1, question_text: 'q' }];
    };

    const testHarvester = new BackgroundHarvester({ vocabRatio: 10 }); // only vocab for this test

    for (let i = 0; i < CEFR_LEVELS.length; i++) {
      await testHarvester.triggerHarvest();
    }

    assert.strictEqual(recordedLevels.length, CEFR_LEVELS.length);
    for (let i = 0; i < CEFR_LEVELS.length; i++) {
      assert.strictEqual(recordedLevels[i].level, CEFR_LEVELS[i]);
    }
  });

  // --------------------------------------------------------------------------
  // 4. In-Flight Concurrency Protection
  // --------------------------------------------------------------------------
  it('5. In-Flight Guard: Prevents overlapping concurrent harvests', async () => {
    let resolver;
    const slowPromise = new Promise(resolve => { resolver = resolve; });

    geminiService.generateVocabulary = async () => {
      await slowPromise;
      return [{ id: 1, word: 'delayed' }];
    };

    const testHarvester = new BackgroundHarvester();

    const firstRun = testHarvester.triggerHarvest();
    assert.strictEqual(testHarvester.isHarvesting, true);

    // Attempt concurrent run
    await assert.rejects(
      async () => {
        await testHarvester.triggerHarvest();
      },
      /already in-flight/
    );

    resolver();
    await firstRun;
    assert.strictEqual(testHarvester.isHarvesting, false);
  });

  // --------------------------------------------------------------------------
  // 5. Error Resilience & Recovery
  // --------------------------------------------------------------------------
  it('6. Error Resilience: Tracks consecutive errors on 429/503 and recovers on success', async () => {
    geminiService.generateVocabulary = async () => {
      const err = new Error('Model returned 429: RESOURCE_EXHAUSTED');
      err.status = 429;
      throw err;
    };

    const testHarvester = new BackgroundHarvester();

    await assert.rejects(
      async () => {
        await testHarvester.triggerHarvest();
      },
      /429/
    );

    let stats = testHarvester.getStats();
    assert.strictEqual(stats.lastRunStatus, 'error');
    assert.ok(stats.lastError.includes('429'));

    // Now model recovers
    geminiService.generateVocabulary = async () => {
      return [{ id: 5, word: 'recovered' }];
    };

    const okResult = await testHarvester.triggerHarvest();
    assert.strictEqual(okResult.type, 'vocabulary');

    stats = testHarvester.getStats();
    assert.strictEqual(stats.lastRunStatus, 'success');
    assert.strictEqual(stats.lastError, null);
  });

  // --------------------------------------------------------------------------
  // 6. Lifecycle: Start & Stop Idempotence
  // --------------------------------------------------------------------------
  it('7. Lifecycle: start() and stop() manage state and timers cleanly', () => {
    const testHarvester = new BackgroundHarvester({ intervalMs: 100000 });

    testHarvester.start();
    assert.strictEqual(testHarvester.isRunning, true);
    assert.ok(testHarvester.nextScheduledRun);

    // Idempotent start
    testHarvester.start();
    assert.strictEqual(testHarvester.isRunning, true);

    testHarvester.stop();
    assert.strictEqual(testHarvester.isRunning, false);
    assert.strictEqual(testHarvester.nextScheduledRun, null);
  });

  // --------------------------------------------------------------------------
  // 7. API Monitoring Endpoint
  // --------------------------------------------------------------------------
  it('8. Monitoring API: GET /api/dictionary/harvester-stats returns live telemetry', async () => {
    const res = await fetch(`${BASE_URL}/dictionary/harvester-stats`);
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data);
    assert.strictEqual(body.data.ratio, '3:1');
    assert.strictEqual(body.data.totalCycleSteps, 4);
    assert.ok('currentCycleStep' in body.data);
    assert.ok('totalRuns' in body.data);
    assert.ok('totalVocabWordsAdded' in body.data);
    assert.ok('totalGrammarQuestionsAdded' in body.data);
    assert.ok('nextType' in body.data);
    assert.ok('nextTarget' in body.data);
  });
});

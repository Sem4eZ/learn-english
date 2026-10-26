/**
 * LexiFlow Autonomous 24/7 Background Harvester
 * 
 * Continuous background replenishment engine:
 * - Operates at a steady cadence (default: 1 request every 60,000ms = 1,440 req/day)
 *   strictly within Google Gemini Free Tier quotas (1,500 RPD, 15 RPM).
 * - Enforces the agreed 3:1 ratio:
 *     - 3 cycles of vocabulary harvesting (50 words per batch)
 *     - 1 cycle of grammar test question harvesting (10 rich questions per batch)
 * - Traverses all CEFR levels ('A1', 'A2', 'B1', 'B2', 'C1') and thematic sections
 *   in a round-robin rotation.
 * - Resilient against rate limits (HTTP 429 / 503) via exponential backoff and
 *   in-flight overlap protection.
 * - Exposes real-time monitoring statistics.
 */

const geminiService = require('./geminiService');

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];

const HARVEST_SECTIONS = [
  'conversational',
  'ielts_toefl',
  'phrasal_idioms',
  'tech_it',
  'business',
  'travel',
  'general'
];

const GRAMMAR_TOPICS = [
  'verb tenses and aspect',
  'conditionals and hypothesis (0, 1st, 2nd, 3rd, mixed)',
  'passive voice and causative constructions',
  'modal verbs for deduction, obligation and permission',
  'reported speech and indirect questions',
  'relative clauses, participle clauses and inversion',
  'dependent prepositions and collocations',
  'articles, quantifiers and determiners'
];

class BackgroundHarvester {
  constructor(options = {}) {
    // Enabled flag (default: paused unless explicitly enabled via BACKGROUND_HARVESTER_ENABLED=true)
    this.enabled = options.enabled !== undefined
      ? Boolean(options.enabled)
      : (process.env.BACKGROUND_HARVESTER_ENABLED === 'true');

    // 300,000ms = 5 minutes cadence (~288 requests/day), staying strictly within 500 RPD free-tier limit
    this.intervalMs = options.intervalMs || parseInt(process.env.BACKGROUND_HARVESTER_INTERVAL_MS, 10) || 300000;
    this.maxDailyRequests = options.maxDailyRequests || parseInt(process.env.BACKGROUND_HARVESTER_MAX_DAILY_REQUESTS, 10) || 300;
    this.dailyRequestsDate = new Date().toISOString().slice(0, 10);
    this.dailyRequestsCount = 0;
    this.vocabBatchSize = options.vocabBatchSize || 50;
    this.grammarBatchSize = options.grammarBatchSize || 10;
    this.vocabRatio = options.vocabRatio || 3; // 3 vocab runs per 1 grammar run

    // State & Rotation Indices
    this.vocabLevelIndex = 0;
    this.vocabSectionIndex = 0;
    this.grammarLevelIndex = 0;
    this.grammarTopicIndex = 0;

    // Cycle tracking: 1, 2, 3 -> vocab; 4 -> grammar
    this.currentCycleStep = 1;

    // Running state
    this.isRunning = false;
    this.isHarvesting = false;
    this.timer = null;

    // Telemetry & Stats
    this.totalRuns = 0;
    this.totalVocabWordsAdded = 0;
    this.totalGrammarQuestionsAdded = 0;
    this.lastRunTime = null;
    this.lastRunType = null;
    this.lastRunStatus = 'idle';
    this.lastRunCount = 0;
    this.lastError = null;
    this.consecutiveErrors = 0;
    this.nextScheduledRun = null;
  }

  start(force = false) {
    if (this.isRunning) return;
    if (!this.enabled && !force) {
      console.log('[BackgroundHarvester] ⏸️ Replenishment is paused (~16,000 words in library). Resting pause active.');
      return;
    }
    if (force) {
      this.enabled = true;
    }
    this.isRunning = true;
    console.log(`[BackgroundHarvester] Started autonomous 24/7 replenishment service (interval: ${this.intervalMs}ms, ratio: ${this.vocabRatio}:1)`);
    this._scheduleNext(1000); // Initial kickoff after 1 second
  }

  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.nextScheduledRun = null;
    console.log('[BackgroundHarvester] Stopped autonomous replenishment service.');
  }

  _scheduleNext(delayMs) {
    if (!this.isRunning) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const delay = Math.max(100, delayMs !== undefined ? delayMs : this.intervalMs);
    this.nextScheduledRun = new Date(Date.now() + delay).toISOString();
    this.timer = setTimeout(async () => {
      await this._tick();
    }, delay);
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  _checkDailyBudget() {
    const todayUtc = new Date().toISOString().slice(0, 10);
    if (this.dailyRequestsDate !== todayUtc) {
      this.dailyRequestsDate = todayUtc;
      this.dailyRequestsCount = 0;
    }
    return this.dailyRequestsCount < this.maxDailyRequests;
  }

  async _tick() {
    if (!this.isRunning) return;
    if (this.isHarvesting) {
      console.warn('[BackgroundHarvester] Harvest already in-flight; skipping tick.');
      this._scheduleNext(this.intervalMs);
      return;
    }

    if (!this._checkDailyBudget()) {
      const now = new Date();
      const nextMidnightUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 5));
      const delayUntilMidnight = Math.max(60000, nextMidnightUtc.getTime() - now.getTime());
      console.log(`[BackgroundHarvester] 🛑 Daily harvest quota reached (${this.dailyRequestsCount}/${this.maxDailyRequests} req). Pausing runs until 00:00 UTC (~${Math.round(delayUntilMidnight / 60000)} min) to preserve Gemini free-tier quota for active users.`);
      this._scheduleNext(delayUntilMidnight);
      return;
    }

    try {
      await this.triggerHarvest();
      // On success, reset consecutive error count and schedule next normal tick
      this.consecutiveErrors = 0;
      this._scheduleNext(this.intervalMs);
    } catch (err) {
      this.consecutiveErrors++;
      const is429 = /429|RESOURCE_EXHAUSTED|Quota exceeded/i.test(err.message || '');
      let backoffDelay;
      if (is429) {
        const minutes = Math.min(60, 15 * Math.pow(2, Math.min(this.consecutiveErrors - 1, 2)));
        backoffDelay = minutes * 60 * 1000;
        console.warn(`[BackgroundHarvester] ⚠️ Gemini rate limit (HTTP 429) encountered. Backing off for ${minutes} minutes to allow quota replenishment.`);
      } else {
        const backoffMultiplier = Math.min(Math.pow(2, Math.min(this.consecutiveErrors, 3)), 5);
        backoffDelay = this.intervalMs * backoffMultiplier;
        console.error(`[BackgroundHarvester] Tick error (${this.consecutiveErrors} consecutive). Backing off for ${backoffDelay}ms:`, err.message);
      }
      this._scheduleNext(backoffDelay);
    }
  }

  /**
   * Executes a single harvest cycle (either vocabulary or grammar based on 3:1 ratio).
   * Can be invoked directly by tests or manual triggers.
   */
  async triggerHarvest(forcedType = null) {
    if (this.isHarvesting) {
      throw new Error('A harvest cycle is already in-flight');
    }

    this.isHarvesting = true;
    this.dailyRequestsCount++;
    const isVocab = forcedType ? forcedType === 'vocabulary' : (this.currentCycleStep <= this.vocabRatio);
    const runType = isVocab ? 'vocabulary' : 'grammar';

    this.lastRunTime = new Date().toISOString();
    this.lastRunType = runType;

    try {
      let count = 0;
      if (isVocab) {
        const level = CEFR_LEVELS[this.vocabLevelIndex];
        const section = HARVEST_SECTIONS[this.vocabSectionIndex];

        console.log(`[BackgroundHarvester] [Cycle ${this.currentCycleStep}/${this.vocabRatio + 1}] Harvesting vocabulary (level: ${level}, section: ${section}, batch: ${this.vocabBatchSize})...`);
        const result = await geminiService.generateVocabulary(level, section, this.vocabBatchSize);
        count = Array.isArray(result) ? result.length : 0;
        this.totalVocabWordsAdded += count;

        // Advance rotation: advance level every step; advance section when completing level loop
        this.vocabLevelIndex = (this.vocabLevelIndex + 1) % CEFR_LEVELS.length;
        if (this.vocabLevelIndex === 0) {
          this.vocabSectionIndex = (this.vocabSectionIndex + 1) % HARVEST_SECTIONS.length;
        }
      } else {
        const level = CEFR_LEVELS[this.grammarLevelIndex];
        const topic = GRAMMAR_TOPICS[this.grammarTopicIndex];

        console.log(`[BackgroundHarvester] [Cycle ${this.currentCycleStep}/${this.vocabRatio + 1}] Harvesting grammar questions (level: ${level}, topic: "${topic}", batch: ${this.grammarBatchSize})...`);
        const result = await geminiService.generateQuestions('grammar', level, this.grammarBatchSize, topic);
        count = Array.isArray(result) ? result.length : 0;
        this.totalGrammarQuestionsAdded += count;

        // Advance grammar rotation
        this.grammarLevelIndex = (this.grammarLevelIndex + 1) % CEFR_LEVELS.length;
        this.grammarTopicIndex = (this.grammarTopicIndex + 1) % GRAMMAR_TOPICS.length;
      }

      this.totalRuns++;
      this.lastRunStatus = 'success';
      this.lastRunCount = count;
      this.lastError = null;

      // Advance 3:1 cycle step: 1 -> 2 -> 3 -> 4 -> 1
      if (!forcedType) {
        this.currentCycleStep = this.currentCycleStep >= (this.vocabRatio + 1) ? 1 : this.currentCycleStep + 1;
      }

      console.log(`[BackgroundHarvester] Successfully harvested ${count} items for ${runType}. Total runs: ${this.totalRuns}`);
      return {
        type: runType,
        count,
        cycleStep: this.currentCycleStep
      };
    } catch (err) {
      this.lastRunStatus = 'error';
      this.lastError = err.message;
      throw err;
    } finally {
      this.isHarvesting = false;
    }
  }

  getStats() {
    const nextVocabLevel = CEFR_LEVELS[this.vocabLevelIndex];
    const nextVocabSection = HARVEST_SECTIONS[this.vocabSectionIndex];
    const nextGrammarLevel = CEFR_LEVELS[this.grammarLevelIndex];
    const nextGrammarTopic = GRAMMAR_TOPICS[this.grammarTopicIndex];

    const nextType = this.currentCycleStep <= this.vocabRatio ? 'vocabulary' : 'grammar';

    return {
      enabled: this.enabled,
      isPaused: !this.isRunning,
      statusMessage: this.isRunning ? 'Active' : (this.enabled ? 'Stopped' : 'Paused (~16k words achieved, resting pause)'),
      isRunning: this.isRunning,
      isHarvesting: this.isHarvesting,
      intervalMs: this.intervalMs,
      maxDailyRequests: this.maxDailyRequests,
      dailyRequestsCount: this.dailyRequestsCount,
      dailyQuotaRemaining: Math.max(0, this.maxDailyRequests - this.dailyRequestsCount),
      ratio: `${this.vocabRatio}:1`,
      currentCycleStep: this.currentCycleStep,
      totalCycleSteps: this.vocabRatio + 1,
      nextType,
      nextTarget: nextType === 'vocabulary' 
        ? { level: nextVocabLevel, section: nextVocabSection }
        : { level: nextGrammarLevel, topic: nextGrammarTopic },
      totalRuns: this.totalRuns,
      totalVocabWordsAdded: this.totalVocabWordsAdded,
      totalGrammarQuestionsAdded: this.totalGrammarQuestionsAdded,
      lastRunTime: this.lastRunTime,
      lastRunType: this.lastRunType,
      lastRunStatus: this.lastRunStatus,
      lastRunCount: this.lastRunCount,
      lastError: this.lastError,
      consecutiveErrors: this.consecutiveErrors,
      nextScheduledRun: this.nextScheduledRun
    };
  }
}

// Singleton harvester instance for the running server
const backgroundHarvester = new BackgroundHarvester();

module.exports = backgroundHarvester;
module.exports.BackgroundHarvester = BackgroundHarvester;
module.exports.CEFR_LEVELS = CEFR_LEVELS;
module.exports.HARVEST_SECTIONS = HARVEST_SECTIONS;
module.exports.GRAMMAR_TOPICS = GRAMMAR_TOPICS;

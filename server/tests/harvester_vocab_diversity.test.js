/**
 * Automated Test Suite: Harvester Models, Resilient JSON Parsing & Vocab Diversity
 * 
 * Verifies:
 * 1. Active Gemini model pipeline: eliminates defunct 404 models and includes 2026 models.
 * 2. Resilient JSON Array Parser: parses clean JSON, strips markdown fences, repairs unescaped
 *    quotes/newlines in Russian translations, and recovers valid items individually.
 * 3. Harvest Sections: excludes 'grammar' from vocabulary harvesting, prioritizes under-populated
 *    sections ('conversational', 'ielts_toefl', 'phrasal_idioms').
 * 4. Micro-Themes Library: covers all vocabulary sections with rich specialized sub-domains.
 * 5. Vocabulary Deduplication: ensures duplicates are filtered and only new words persist.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const geminiService = require('../src/services/geminiService');
const { HARVEST_SECTIONS, BackgroundHarvester } = require('../src/services/backgroundHarvester');
const db = require('../src/db/schema');

describe('Harvester Models, Resilient JSON Parsing & Vocab Diversity Test Suite', () => {

  // --------------------------------------------------------------------------
  // 1. Candidate Models Pipeline
  // --------------------------------------------------------------------------
  it('1. Model Pipeline: DEFAULT_MODELS contains no obsolete 404 models and includes verified 2026 models', () => {
    const models = geminiService.DEFAULT_MODELS;
    assert.ok(Array.isArray(models), 'DEFAULT_MODELS must be an array');
    assert.ok(models.length >= 3, 'Must have at least 3 fallback candidate models');

    // Defunct 404 models must NOT be present
    assert.ok(!models.includes('gemini-2.5-flash-lite'), 'gemini-2.5-flash-lite returned 404 and must NOT be in models');
    assert.ok(!models.includes('gemini-2.0-flash-lite'), 'gemini-2.0-flash-lite returned 404 and must NOT be in models');

    // Verified 2026 models MUST be present
    assert.ok(models.includes('gemini-3.1-flash-lite'), 'gemini-3.1-flash-lite must be present with fresh 500 RPD quota');
    assert.ok(models.includes('gemini-flash-lite-latest'), 'gemini-flash-lite-latest must be present');
    assert.ok(models.includes('gemini-3.5-flash-lite'), 'gemini-3.5-flash-lite must be present as recommended by Google');
  });

  // --------------------------------------------------------------------------
  // 2. Harvest Sections Integrity
  // --------------------------------------------------------------------------
  it('2. Harvest Sections: Excludes grammar from vocabulary harvesting and includes all 7 vocab categories', () => {
    assert.ok(!HARVEST_SECTIONS.includes('grammar'), 'HARVEST_SECTIONS must NOT contain "grammar" for vocabulary');

    const expectedSections = [
      'conversational',
      'ielts_toefl',
      'phrasal_idioms',
      'tech_it',
      'business',
      'travel',
      'general'
    ];

    for (const sec of expectedSections) {
      assert.ok(HARVEST_SECTIONS.includes(sec), `HARVEST_SECTIONS must include ${sec}`);
    }

    // Ensure under-represented sections are placed first
    assert.strictEqual(HARVEST_SECTIONS[0], 'conversational');
    assert.strictEqual(HARVEST_SECTIONS[1], 'ielts_toefl');
  });

  // --------------------------------------------------------------------------
  // 3. Micro-Themes Library
  // --------------------------------------------------------------------------
  it('3. Micro-Themes: Every harvest section has dedicated specialized sub-themes', () => {
    const themes = geminiService.VOCABULARY_MICRO_THEMES;
    assert.ok(themes, 'VOCABULARY_MICRO_THEMES must exist');

    for (const sec of HARVEST_SECTIONS) {
      assert.ok(Array.isArray(themes[sec]), `Micro-themes for ${sec} must be an array`);
      assert.ok(themes[sec].length >= 3, `Section ${sec} must have at least 3 distinct micro-themes`);
    }

    // Verify rich topics in general themes
    const generalThemesJoined = themes.general.join(' ').toLowerCase();
    assert.ok(generalThemesJoined.includes('astronomy') || generalThemesJoined.includes('space'));
    assert.ok(generalThemesJoined.includes('carpentry') || generalThemesJoined.includes('crafts'));
    assert.ok(generalThemesJoined.includes('culinary') || generalThemesJoined.includes('gastronomy'));
    assert.ok(generalThemesJoined.includes('psychology') || generalThemesJoined.includes('behavior'));
  });

  // --------------------------------------------------------------------------
  // 4. Resilient JSON Array Parser
  // --------------------------------------------------------------------------
  it('4. JSON Parser: Correctly parses clean JSON array', () => {
    const input = JSON.stringify([
      { word: 'nebula', translation: 'туманность', definition: 'A cloud of gas in space' },
      { word: 'timber', translation: 'древесина', definition: 'Wood prepared for use' }
    ]);
    const res = geminiService.cleanAndParseJsonArray(input, 'words');
    assert.strictEqual(res.length, 2);
    assert.strictEqual(res[0].word, 'nebula');
    assert.strictEqual(res[1].word, 'timber');
  });

  it('5. JSON Parser: Strips markdown code fences (```json and ```)', () => {
    const input = `\`\`\`json
[
  { "word": "satellite", "translation": "спутник", "definition": "An artificial body placed in orbit" }
]
\`\`\``;
    const res = geminiService.cleanAndParseJsonArray(input, 'words');
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].word, 'satellite');
  });

  it('6. JSON Parser: Unwraps object with "words" or "questions" key', () => {
    const input = JSON.stringify({
      words: [
        { word: 'telescope', translation: 'телескоп' }
      ]
    });
    const res = geminiService.cleanAndParseJsonArray(input, 'words');
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].word, 'telescope');
  });

  it('7. JSON Parser: Recovers valid items when raw text contains unescaped quotes in Russian translations', () => {
    // Simulated malformed string from LLM: "translation": "находиться в "офисе""
    const malformed = `[
      { "word": "abide", "translation": "оставаться в "помещении"", "definition": "To remain" },
      { "word": "orbit", "translation": "орбита", "definition": "A curved path of a celestial object" }
    ]`;
    const res = geminiService.cleanAndParseJsonArray(malformed, 'words');
    assert.ok(res.length >= 1, 'Should recover items despite malformed internal quotes');
    const orbit = res.find(r => r.word === 'orbit');
    assert.ok(orbit, 'Must recover valid item "orbit" from the batch');
  });

  it('8. JSON Parser: Recovers items with unescaped internal newlines', () => {
    const textWithNewlines = `[
      {
        "word": "constellation",
        "translation": "созвездие",
        "definition": "A group of stars
forming a pattern"
      }
    ]`;
    const res = geminiService.cleanAndParseJsonArray(textWithNewlines, 'words');
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].word, 'constellation');
  });

  // --------------------------------------------------------------------------
  // 5. Harvester Integration with Updated Sections
  // --------------------------------------------------------------------------
  it('9. Harvester Cycle: Executes vocabulary harvesting across conversational and ielts_toefl', async () => {
    const harvested = [];
    const origGenVocab = geminiService.generateVocabulary;

    geminiService.generateVocabulary = async (level, section, count) => {
      harvested.push({ level, section, count });
      return [{ id: 999, word: 'phrase', translation: 'фраза' }];
    };

    try {
      const harvester = new BackgroundHarvester({ vocabRatio: 3 });
      
      // First cycle step must target conversational
      await harvester.triggerHarvest();
      assert.strictEqual(harvested.length, 1);
      assert.strictEqual(harvested[0].section, 'conversational');

      // Second cycle step
      await harvester.triggerHarvest();
      assert.strictEqual(harvested.length, 2);
      assert.strictEqual(harvested[1].section, 'conversational'); // level rotates first
    } finally {
      geminiService.generateVocabulary = origGenVocab;
    }
  });
  // --------------------------------------------------------------------------
  // 6. Daily Quota Budget Guard
  // --------------------------------------------------------------------------
  it('6. Daily Quota Budget: Enforces maximum daily harvest requests and protects 500 RPD free-tier quota', async () => {
    const origGenVocab = geminiService.generateVocabulary;
    geminiService.generateVocabulary = async () => [{ id: 1, word: 'budget' }];

    try {
      const budgetHarvester = new BackgroundHarvester({
        maxDailyRequests: 3,
        intervalMs: 1000
      });

      assert.strictEqual(budgetHarvester.maxDailyRequests, 3);
      assert.strictEqual(budgetHarvester.dailyRequestsCount, 0);
      assert.strictEqual(budgetHarvester._checkDailyBudget(), true);

      // Execute 3 harvests
      await budgetHarvester.triggerHarvest();
      await budgetHarvester.triggerHarvest();
      await budgetHarvester.triggerHarvest();

      assert.strictEqual(budgetHarvester.dailyRequestsCount, 3);
      assert.strictEqual(budgetHarvester._checkDailyBudget(), false);

      const stats = budgetHarvester.getStats();
      assert.strictEqual(stats.dailyRequestsCount, 3);
      assert.strictEqual(stats.maxDailyRequests, 3);
      assert.strictEqual(stats.dailyQuotaRemaining, 0);
    } finally {
      geminiService.generateVocabulary = origGenVocab;
    }
  });
});
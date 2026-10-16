/**
 * Automated Test Suite: Questions Engine, Sections Curriculum & Generation
 * Covers: Question query filtering by section & CEFR level, structure validation,
 * options parsing, correct_index boundaries, pagination limits, sections curriculum integrity,
 * and batch generation validation negative cases.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db/schema');

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001/api';

describe('Questions Engine & Curriculum Test Suite', () => {
  // --------------------------------------------------------------------------
  // Questions Query & Integrity Cases
  // --------------------------------------------------------------------------
  it('1. Questions Query: Fetches questions by sectionId and CEFR level', async () => {
    const res = await fetch(`${BASE_URL}/questions?sectionId=grammar&level=B1&limit=5`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length > 0);
  });

  it('2. Question Structure: Verifies question schema integrity', async () => {
    const res = await fetch(`${BASE_URL}/questions?sectionId=grammar&level=B1&limit=1`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    const q = body.data[0];

    assert.ok(q.id);
    assert.ok(q.section_id);
    assert.ok(q.level);
    assert.ok(q.question_text);
    assert.ok(Array.isArray(q.options), 'options must be parsed array');
    assert.ok(q.options.length >= 2, 'Must have at least 2 options');
    assert.ok(typeof q.correct_index === 'number');
    assert.ok(q.explanation);
    assert.ok(q.grammar_rule);
  });

  it('3. Question Invariant: correct_index is strictly within valid bounds (0 <= index < options.length)', async () => {
    const res = await fetch(`${BASE_URL}/questions?sectionId=grammar&level=B1&limit=10`);
    const body = await res.json();

    for (const q of body.data) {
      assert.ok(q.correct_index >= 0, `correct_index ${q.correct_index} must be >= 0`);
      assert.ok(q.correct_index < q.options.length, `correct_index ${q.correct_index} must be < ${q.options.length}`);
      assert.ok(q.options[q.correct_index], 'The choice at correct_index must be non-empty');
    }
  });

  it('4. Questions Pagination: Negative page (?page=-10) is clamped to page 1', async () => {
    const res = await fetch(`${BASE_URL}/questions?sectionId=grammar&level=B1&page=-10&limit=5`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.pagination.page, 1);
  });

  it('5. Questions Pagination: High limit (?limit=100) is clamped to max 20 questions', async () => {
    const res = await fetch(`${BASE_URL}/questions?sectionId=grammar&level=B1&limit=100`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.pagination.limit, 20);
    assert.ok(body.data.length <= 20);
  });

  it('6. Questions Fallback: Missing sectionId queries across all sections without error', async () => {
    const res = await fetch(`${BASE_URL}/questions?level=B1&limit=5`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.length > 0);
  });

  // --------------------------------------------------------------------------
  // Generation Negative Cases
  // --------------------------------------------------------------------------
  it('7. Questions Batch Negative: Missing sectionId returns 400 Bad Request', async () => {
    const res = await fetch(`${BASE_URL}/questions/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: 'B1', count: 5 })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('sectionId is required'));
  });

  // --------------------------------------------------------------------------
  // Sections Curriculum Test Cases
  // --------------------------------------------------------------------------
  it('8. Sections API: Returns all default curriculum topics', async () => {
    const res = await fetch(`${BASE_URL}/sections`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));

    const sectionIds = body.data.map(s => s.id);
    const requiredSections = [
      'grammar',
      'business',
      'travel',
      'tech_it',
      'conversational',
      'phrasal_idioms',
      'ielts_toefl'
    ];

    for (const reqSec of requiredSections) {
      assert.ok(sectionIds.includes(reqSec), `Expected section "${reqSec}" in curriculum`);
    }
  });

  it('9. Section Properties: Each curriculum section has complete pedagogical metadata', async () => {
    const res = await fetch(`${BASE_URL}/sections`);
    const body = await res.json();

    for (const s of body.data) {
      assert.ok(s.id, 'Section must have id');
      assert.ok(s.title, 'Section must have title');
      assert.ok(s.description, 'Section must have description');
      assert.ok(s.icon, 'Section must have icon');
      assert.ok(s.default_level, 'Section must have default_level');
      assert.ok(s.prompt_focus, 'Section must have prompt_focus');
    }
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SRSEngine, SRS_RATING_OPTIONS, SrsRecord } from '../srs';
import { xpEventBus } from '../xpEvents';

describe('SRSEngine Client-Side Logic Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. should create a valid initial SRS record with default SM-2 values', () => {
    const record = SRSEngine.createInitialRecord(101);
    expect(record.id).toBe(101);
    expect(record.reps).toBe(0);
    expect(record.interval).toBe(0);
    expect(record.ef).toBe(2.5);
    expect(record.state).toBe('new');
    expect(record.dueDate).toBeDefined();
  });

  it('2. Grade 1 (Снова): resets reps to 0, interval to 0, state to learning', () => {
    const initial = SRSEngine.createInitialRecord(1);
    initial.reps = 3;
    initial.interval = 10;
    initial.state = 'review';

    const result = SRSEngine.processReview(initial, 1);
    expect(result.reps).toBe(0);
    expect(result.interval).toBe(0);
    expect(result.state).toBe('learning');
    expect(result.lastReviewed).toBeDefined();
  });

  it('3. Grade 1 (Снова): decreases ease factor and respects minimum 1.3 clamp', () => {
    let record: SrsRecord = {
      id: 1,
      reps: 0,
      interval: 0,
      ef: 1.4,
      dueDate: new Date().toISOString(),
      state: 'new'
    };

    record = SRSEngine.processReview(record, 1);
    expect(record.ef).toBe(1.3);

    record = SRSEngine.processReview(record, 1);
    expect(record.ef).toBe(1.3);
  });

  it('4. Grade 2 (Трудно) on reps = 0: sets interval to 1 day and reps to 1', () => {
    const initial = SRSEngine.createInitialRecord(2);
    const result = SRSEngine.processReview(initial, 2);

    expect(result.reps).toBe(1);
    expect(result.interval).toBe(1);
    expect(result.state).toBe('review');
    expect(result.ef).toBeLessThan(2.5);
  });

  it('5. Grade 3 (Хорошо) on reps = 0: sets interval to 1 day', () => {
    const initial = SRSEngine.createInitialRecord(3);
    const result = SRSEngine.processReview(initial, 3);

    expect(result.reps).toBe(1);
    expect(result.interval).toBe(1);
    expect(result.state).toBe('review');
  });

  it('6. Grade 4 (Легко) on reps = 0: jumps interval to 3 days and increases EF', () => {
    const initial = SRSEngine.createInitialRecord(4);
    const result = SRSEngine.processReview(initial, 4);

    expect(result.reps).toBe(1);
    expect(result.interval).toBe(3);
    expect(result.ef).toBeGreaterThan(2.5);
  });

  it('7. Grade 3 (Хорошо) on reps = 1: expands interval to 4 days', () => {
    const record: SrsRecord = {
      id: 5,
      reps: 1,
      interval: 1,
      ef: 2.5,
      dueDate: new Date().toISOString(),
      state: 'review'
    };

    const result = SRSEngine.processReview(record, 3);
    expect(result.reps).toBe(2);
    expect(result.interval).toBe(4);
  });

  it('8. Grade 2 (Трудно) on reps = 1: sets interval to 2 days', () => {
    const record: SrsRecord = {
      id: 6,
      reps: 1,
      interval: 1,
      ef: 2.3,
      dueDate: new Date().toISOString(),
      state: 'review'
    };

    const result = SRSEngine.processReview(record, 2);
    expect(result.reps).toBe(2);
    expect(result.interval).toBe(2);
  });

  it('9. Grade 4 (Легко) on reps = 1: expands interval to 6 days', () => {
    const record: SrsRecord = {
      id: 7,
      reps: 1,
      interval: 3,
      ef: 2.6,
      dueDate: new Date().toISOString(),
      state: 'review'
    };

    const result = SRSEngine.processReview(record, 4);
    expect(result.reps).toBe(2);
    expect(result.interval).toBe(6);
  });

  it('10. Higher repetitions (reps >= 2): applies ease factor multiplier', () => {
    const record: SrsRecord = {
      id: 8,
      reps: 2,
      interval: 4,
      ef: 2.5,
      dueDate: new Date().toISOString(),
      state: 'review'
    };

    const result = SRSEngine.processReview(record, 3);
    expect(result.reps).toBe(3);
    expect(result.interval).toBe(Math.round(4 * 2.5));
  });

  it('11. Transition to mastered state when reps >= 4 and interval >= 14', () => {
    const record: SrsRecord = {
      id: 9,
      reps: 3,
      interval: 10,
      ef: 2.5,
      dueDate: new Date().toISOString(),
      state: 'review'
    };

    const result = SRSEngine.processReview(record, 4);
    expect(result.reps).toBe(4);
    expect(result.interval).toBeGreaterThanOrEqual(14);
    expect(result.state).toBe('mastered');
  });

  it('12. getDueLabel formats intervals correctly', () => {
    expect(SRSEngine.getDueLabel(0)).toBe('< 10 мин');
    expect(SRSEngine.getDueLabel(1)).toBe('1 день');
    expect(SRSEngine.getDueLabel(3)).toBe('3 дн.');
    expect(SRSEngine.getDueLabel(5)).toBe('5 дн.');
    expect(SRSEngine.getDueLabel(14)).toBe('2 нед.');
    expect(SRSEngine.getDueLabel(45)).toBe('2 мес.');
  });

  it('13. SRS_RATING_OPTIONS defines 4 valid grades with shortcuts [1]-[4]', () => {
    expect(SRS_RATING_OPTIONS).toHaveLength(4);
    expect(SRS_RATING_OPTIONS.map(o => o.grade)).toEqual([1, 2, 3, 4]);
    expect(SRS_RATING_OPTIONS.map(o => o.shortcut)).toEqual(['[1]', '[2]', '[3]', '[4]']);
    expect(SRS_RATING_OPTIONS.map(o => o.title)).toEqual(['Снова', 'Трудно', 'Хорошо', 'Легко']);
  });

  it('14. syncReviewWithServer emits xpEventBus on offline fallback', async () => {
    const emitSpy = vi.spyOn(xpEventBus, 'emit');

    await SRSEngine.syncReviewWithServer(999, 3);
    expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({
      source: 'srs_review'
    }));
  });

  it('15. Target dueDate calculation for 0 interval sets +10 minutes', () => {
    const before = new Date();
    const initial = SRSEngine.createInitialRecord(15);
    const result = SRSEngine.processReview(initial, 1);

    const due = new Date(result.dueDate);
    const diffMinutes = (due.getTime() - before.getTime()) / (1000 * 60);
    expect(diffMinutes).toBeGreaterThanOrEqual(9);
    expect(diffMinutes).toBeLessThanOrEqual(11);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { xpEventBus, XpEarnedDetail } from '../xpEvents';

describe('xpEventBus Unit Tests', () => {
  it('1. should subscribe a listener and receive emitted XP events', () => {
    const listener = vi.fn();
    const unsubscribe = xpEventBus.subscribe(listener);

    const event: XpEarnedDetail = {
      xpReward: 15,
      totalXp: 120,
      streak: 3,
      source: 'quiz_correct',
    };

    xpEventBus.emit(event);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(event);

    unsubscribe();
  });

  it('2. should stop notifying listener after unsubscribe is called', () => {
    const listener = vi.fn();
    const unsubscribe = xpEventBus.subscribe(listener);

    xpEventBus.emit({ xpReward: 10 });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    xpEventBus.emit({ xpReward: 20 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('3. should support multiple independent subscribers', () => {
    const listenerA = vi.fn();
    const listenerB = vi.fn();

    const unsubA = xpEventBus.subscribe(listenerA);
    const unsubB = xpEventBus.subscribe(listenerB);

    xpEventBus.emit({ xpReward: 25, streak: 5 });

    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(1);

    unsubA();
    xpEventBus.emit({ xpReward: 5 });

    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(2);

    unsubB();
  });

  it('4. should gracefully handle emit when no subscribers exist', () => {
    expect(() => {
      xpEventBus.emit({ xpReward: 50 });
    }).not.toThrow();
  });

  it('5. should pass complete payload including source and streak', () => {
    let captured: XpEarnedDetail | null = null;
    const unsubscribe = xpEventBus.subscribe((detail) => {
      captured = detail;
    });

    xpEventBus.emit({
      xpReward: 30,
      totalXp: 500,
      streak: 7,
      source: 'sprint_completion',
    });

    expect(captured).toEqual({
      xpReward: 30,
      totalXp: 500,
      streak: 7,
      source: 'sprint_completion',
    });

    unsubscribe();
  });

  it('6. should allow idempotent unsubscribe calls without errors', () => {
    const listener = vi.fn();
    const unsubscribe = xpEventBus.subscribe(listener);

    expect(() => {
      unsubscribe();
      unsubscribe();
    }).not.toThrow();
  });

  it('7. should not crash when window dispatch is executed', () => {
    const goodListener = vi.fn();
    const unsubGood = xpEventBus.subscribe(goodListener);

    expect(() => {
      xpEventBus.emit({ xpReward: 10 });
    }).not.toThrow();
    expect(goodListener).toHaveBeenCalled();

    unsubGood();
  });

  it('8. should preserve order of subscribers invocation', () => {
    const callOrder: string[] = [];
    const unsub1 = xpEventBus.subscribe(() => callOrder.push('first'));
    const unsub2 = xpEventBus.subscribe(() => callOrder.push('second'));

    xpEventBus.emit({ xpReward: 10 });
    expect(callOrder).toEqual(['first', 'second']);

    unsub1();
    unsub2();
  });

  it('9. should support partial event details (only xpReward)', () => {
    let received: XpEarnedDetail | null = null;
    const unsub = xpEventBus.subscribe((detail) => {
      received = detail;
    });

    xpEventBus.emit({ xpReward: 5 });
    expect(received).toEqual({ xpReward: 5 });

    unsub();
  });

  it('10. should handle zero xpReward properly', () => {
    const listener = vi.fn();
    const unsub = xpEventBus.subscribe(listener);

    xpEventBus.emit({ xpReward: 0, source: 'mistake' });
    expect(listener).toHaveBeenCalledWith({ xpReward: 0, source: 'mistake' });

    unsub();
  });
});

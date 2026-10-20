/**
 * Fluentiq SuperMemo-2 (SM-2) Spaced Repetition Engine
 * Calculates optimal intervals for long-term memory retention.
 */

import { xpEventBus } from './xpEvents';

export type SrsReviewHandler = (wordId: number | string, grade: SrsGrade, trainerId?: string) => Promise<any>;

let srsReviewHandler: SrsReviewHandler | null = null;

export const setSrsReviewHandler = (handler: SrsReviewHandler) => {
  srsReviewHandler = handler;
};

export type SrsGrade = 1 | 2 | 3 | 4;

export interface SrsRecord {
  id: number | string;
  reps: number;
  interval: number; // Days
  ef: number;       // Ease factor (minimum 1.3)
  dueDate: string;
  lastReviewed?: string;
  state: 'new' | 'learning' | 'review' | 'mastered';
}

export interface SrsRatingOption {
  grade: SrsGrade;
  title: string;
  subTime: string;
  shortcut: string;
  color: string;
  badgeBg: string;
  xpReward: number;
}

export const SRS_RATING_OPTIONS: SrsRatingOption[] = [
  {
    grade: 1,
    title: 'Снова',
    subTime: '< 10 мин',
    shortcut: '[1]',
    color: '#ef4444',
    badgeBg: 'rgba(239, 68, 68, 0.15)',
    xpReward: 5
  },
  {
    grade: 2,
    title: 'Трудно',
    subTime: '1-2 дн.',
    shortcut: '[2]',
    color: '#f59e0b',
    badgeBg: 'rgba(245, 158, 11, 0.15)',
    xpReward: 10
  },
  {
    grade: 3,
    title: 'Хорошо',
    subTime: '3-5 дн.',
    shortcut: '[3]',
    color: '#3b82f6',
    badgeBg: 'rgba(59, 130, 246, 0.15)',
    xpReward: 15
  },
  {
    grade: 4,
    title: 'Легко',
    subTime: '7+ дн.',
    shortcut: '[4]',
    color: '#10b981',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    xpReward: 25
  }
];

export class SRSEngine {
  static createInitialRecord(cardId: number | string): SrsRecord {
    return {
      id: cardId,
      reps: 0,
      interval: 0,
      ef: 2.5,
      dueDate: new Date().toISOString(),
      state: 'new'
    };
  }

  static processReview(record: SrsRecord, grade: SrsGrade): SrsRecord {
    const updated = { ...record };
    const now = new Date();
    updated.lastReviewed = now.toISOString();

    const smGrade = grade === 1 ? 1 : grade === 2 ? 3 : grade === 3 ? 4 : 5;
    let newEF = updated.ef + (0.1 - (5 - smGrade) * (0.08 + (5 - smGrade) * 0.02));
    if (newEF < 1.3) newEF = 1.3;
    updated.ef = Math.round(newEF * 100) / 100;

    let nextIntervalDays = 0;

    if (grade === 1) {
      updated.reps = 0;
      nextIntervalDays = 0;
      updated.state = 'learning';
    } else {
      if (updated.reps === 0) {
        nextIntervalDays = grade === 4 ? 3 : 1;
      } else if (updated.reps === 1) {
        nextIntervalDays = grade === 4 ? 6 : grade === 3 ? 4 : 2;
      } else {
        const factor = grade === 4 ? updated.ef * 1.25 : grade === 2 ? 1.15 : updated.ef;
        nextIntervalDays = Math.max(1, Math.round(updated.interval * factor));
      }

      updated.reps += 1;
      updated.interval = nextIntervalDays;
      updated.state = (updated.reps >= 4 && updated.interval >= 14) ? 'mastered' : 'review';
    }

    updated.interval = nextIntervalDays;

    const targetDate = new Date(now);
    if (nextIntervalDays === 0) {
      targetDate.setMinutes(targetDate.getMinutes() + 10);
    } else {
      targetDate.setDate(targetDate.getDate() + nextIntervalDays);
    }
    updated.dueDate = targetDate.toISOString();

    return updated;
  }

  static async syncReviewWithServer(wordId: number | string, grade: SrsGrade, trainerId: string = 'cards'): Promise<any> {
    try {
      const res: any = srsReviewHandler ? await srsReviewHandler(wordId, grade, trainerId) : null;
      if (res?.success && res?.data) {
        xpEventBus.emit({
          xpReward: res.data.xpEarned || 10,
          totalXp: res.data.totalXp,
          streak: res.data.streak,
          source: 'srs_review'
        });
      } else {
        // Fallback event
        xpEventBus.emit({
          xpReward: 10,
          source: 'srs_review'
        });
      }
      return res;
    } catch (err) {
      // Offline fallback event
      xpEventBus.emit({
        xpReward: 10,
        source: 'srs_review'
      });
      return null;
    }
  }

  static getDueLabel(intervalDays: number): string {
    if (intervalDays === 0) return '< 10 мин';
    if (intervalDays === 1) return '1 день';
    if (intervalDays < 7) return `${intervalDays} дн.`;
    if (intervalDays < 30) return `${Math.round(intervalDays / 7)} нед.`;
    return `${Math.round(intervalDays / 30)} мес.`;
  }
}

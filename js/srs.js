/**
 * LexiFlow SRS Engine (SuperMemo-2 Implementation)
 * Spaced Repetition algorithm for optimal long-term memory retention.
 */

class SRSEngine {
  /**
   * Initializes or returns default card metadata
   */
  static createInitialRecord(cardId) {
    return {
      id: cardId,
      reps: 0,
      interval: 0, // Days
      ef: 2.5,     // Ease Factor (1.3 minimum)
      dueDate: new Date().toISOString(),
      lastReviewed: null,
      state: "new", // 'new' | 'learning' | 'review' | 'mastered'
      history: []
    };
  }

  /**
   * Updates card record based on user rating:
   * 1 = Again (Забыл / Полный провал)
   * 2 = Hard  (Трудно вспомнить)
   * 3 = Good  (Вспомнил нормально)
   * 4 = Easy  (Очень легко)
   * 
   * @param {Object} record - Existing card SRS record
   * @param {number} grade - User score (1 to 4)
   * @returns {Object} Updated record
   */
  static processReview(record, grade) {
    const updated = { ...record };
    const now = new Date();
    updated.lastReviewed = now.toISOString();

    // Map 1-4 scale to standard SM-2 0-5 scale
    // 1 -> 1 (Again), 2 -> 3 (Hard), 3 -> 4 (Good), 4 -> 5 (Easy)
    const smGrade = grade === 1 ? 1 : grade === 2 ? 3 : grade === 3 ? 4 : 5;

    // Calculate new Ease Factor
    // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    let newEF = updated.ef + (0.1 - (5 - smGrade) * (0.08 + (5 - smGrade) * 0.02));
    if (newEF < 1.3) newEF = 1.3;
    updated.ef = Math.round(newEF * 100) / 100;

    let nextIntervalDays = 0;

    if (grade === 1) {
      // Again: Reset streak, review again today/tomorrow
      updated.reps = 0;
      nextIntervalDays = 0; // immediate or same-day review
      updated.state = "learning";
    } else {
      // Successful recall
      if (updated.reps === 0) {
        nextIntervalDays = grade === 4 ? 3 : 1;
      } else if (updated.reps === 1) {
        nextIntervalDays = grade === 4 ? 6 : grade === 3 ? 4 : 2;
      } else {
        const factor = grade === 4 ? updated.ef * 1.25 : grade === 2 ? 1.15 : updated.ef;
        nextIntervalDays = Math.max(1, Math.round(updated.interval * factor));
      }

      updated.reps += 1;
      if (updated.reps >= 4 && updated.interval >= 14) {
        updated.state = "mastered";
      } else {
        updated.state = "review";
      }
    }

    updated.interval = nextIntervalDays;

    // Set next due date
    const targetDate = new Date(now);
    if (nextIntervalDays === 0) {
      // Repeat in 10 minutes for "Again"
      targetDate.setMinutes(targetDate.getMinutes() + 10);
    } else {
      targetDate.setDate(targetDate.getDate() + nextIntervalDays);
      targetDate.setHours(4, 0, 0, 0); // Reset to 4 AM on due day
    }
    updated.dueDate = targetDate.toISOString();

    updated.history.push({
      date: now.toISOString(),
      grade,
      interval: nextIntervalDays
    });

    return updated;
  }

  /**
   * Checks if a card is currently due for review
   */
  static isDue(record, currentDate = new Date()) {
    if (!record || !record.dueDate) return true;
    return new Date(record.dueDate) <= currentDate;
  }

  /**
   * Calculates human-readable time until next review
   */
  static getDueLabel(intervalDays) {
    if (intervalDays === 0) return "< 10 мин";
    if (intervalDays === 1) return "1 день";
    if (intervalDays < 7) return `${intervalDays} дн.`;
    if (intervalDays < 30) return `${Math.round(intervalDays / 7)} нед.`;
    return `${Math.round(intervalDays / 30)} мес.`;
  }
}

if (typeof window !== "undefined") {
  window.SRSEngine = SRSEngine;
}

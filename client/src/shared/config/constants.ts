export const CEFR_LEVELS = [
  { value: 'A1', label: 'A1 — Beginner (Начальный)', color: 'green' },
  { value: 'A2', label: 'A2 — Elementary (Элементарный)', color: 'cyan' },
  { value: 'B1', label: 'B1 — Intermediate (Средний)', color: 'blue' },
  { value: 'B2', label: 'B2 — Upper-Intermediate (Выше среднего)', color: 'purple' },
  { value: 'C1', label: 'C1 — Advanced (Продвинутый)', color: 'orange' },
  { value: 'C2', label: 'C2 — Mastery (В совершенстве)', color: 'red' },
] as const;

export type CEFRLevel = typeof CEFR_LEVELS[number]['value'];

export const DEFAULT_USER_ID = 'user_default';

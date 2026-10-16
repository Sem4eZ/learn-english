export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  xp: number;
  streak: number;
}

export interface UserStats {
  user: UserProfile;
  xp: number;
  level: number;
  levelPercent: number;
  progressXP: number;
  neededXP: number;
  streak: number;
  totalAnswered: number;
  correctAnswered: number;
  accuracy: number;
  sectionBreakdown: {
    id: string;
    title: string;
    attempted: number;
    correct: number;
  }[];
  rankTitle?: string;
  // Rich dashboard analytics
  wordsToday?: number;
  wordsThisWeek?: number;
  wordsThisMonth?: number;
  totalWordsLearned?: number;
  totalDictWords?: number;
  masteredWords?: number;
  reviewWords?: number;
  learningWords?: number;
  newWords?: number;
  grammarTotal?: number;
  grammarCorrect?: number;
  grammarAccuracy?: number;
  vocabTotal?: number;
  vocabCorrect?: number;
  vocabAccuracy?: number;
  cefrBreakdown?: { level: string; count: number; total: number; percent: number }[];
  weeklyActivity?: { day: string; date: string; xp: number; count: number; words: number; isToday?: boolean }[];
  trainerBreakdown?: {
    id: string;
    name: string;
    icon: string;
    attempted: number;
    correct: number;
    accuracy: number;
  }[];
  badges?: {
    id: string;
    title: string;
    desc: string;
    icon: string;
    unlocked: boolean;
  }[];
}

export interface HistoryItem {
  id: number | string;
  type?: 'grammar' | 'vocab';
  question_id?: number;
  selected_index?: number;
  is_correct: number;
  answered_at: string;
  section_id: string;
  level: string;
  question_text: string;
  options: string[];
  correct_index?: number;
  explanation: string;
  grammar_rule?: string;
  // Vocabulary fields
  word?: string;
  translation?: string;
  transcription?: string;
  srs_grade?: number;
  reps?: number;
}

export const INITIAL_USER_STATS: UserStats = {
  user: {
    id: 'guest',
    username: 'Гость',
    xp: 0,
    streak: 0,
  },
  xp: 0,
  level: 1,
  levelPercent: 0,
  progressXP: 0,
  neededXP: 50,
  streak: 0,
  totalAnswered: 0,
  correctAnswered: 0,
  accuracy: 100,
  rankTitle: 'Новичок (Novice)',
  wordsToday: 0,
  wordsThisWeek: 0,
  wordsThisMonth: 0,
  totalWordsLearned: 0,
  totalDictWords: 0,
  masteredWords: 0,
  reviewWords: 0,
  learningWords: 0,
  newWords: 0,
  grammarTotal: 0,
  grammarCorrect: 0,
  grammarAccuracy: 100,
  vocabTotal: 0,
  vocabCorrect: 0,
  vocabAccuracy: 100,
  sectionBreakdown: [],
  cefrBreakdown: [],
  weeklyActivity: [],
  trainerBreakdown: [
    {
      id: 'vocab',
      name: 'Словарные карточки & Квизы',
      icon: 'ReadOutlined',
      attempted: 0,
      correct: 0,
      accuracy: 100,
    },
    {
      id: 'grammar',
      name: 'Грамматические тесты',
      icon: 'FormOutlined',
      attempted: 0,
      correct: 0,
      accuracy: 100,
    },
  ],
  badges: [],
};

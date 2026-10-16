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

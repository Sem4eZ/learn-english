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
}

export interface HistoryItem {
  id: number;
  question_id: number;
  selected_index: number;
  is_correct: number;
  answered_at: string;
  section_id: string;
  level: string;
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string;
  grammar_rule?: string;
}

export interface Question {
  id: number;
  section_id: string;
  level: string;
  question_text: string;
  context_text?: string;
  options: string[];
  correct_index?: number;
  explanation: string;
  grammar_rule?: string;
  pronunciation_tip?: string;
  created_at?: string;
}

export interface QuestionsResponse {
  data: Question[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export interface AnswerResult {
  isCorrect: boolean;
  correctIndex: number;
  explanation: string;
  grammarRule?: string;
  pronunciationTip?: string;
  xpEarned: number;
  totalXp: number;
  streak: number;
}

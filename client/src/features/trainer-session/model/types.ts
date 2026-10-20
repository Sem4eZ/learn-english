export interface FlashcardItem {
  id: number | string;
  frontMain: string;
  frontPhonetic?: string;
  frontContext?: string;
  backMain: string;
  backDetail?: string;
  backGrammar?: string;
  level?: string;
  category?: string;
}

export interface AudioItem {
  id: number | string;
  sentence: string;
  translation: string;
  hint?: string;
  level?: string;
}

export interface UseTrainerWordsOptions {
  initialLevel?: string;
  initialCategory?: string;
  onRefreshStats?: () => void;
}

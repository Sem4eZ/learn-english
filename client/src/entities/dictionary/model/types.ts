export interface DictionaryItem {
  id: number;
  word: string;
  transcription?: string;
  part_of_speech?: string;
  translation: string;
  definition?: string;
  example_sentence?: string;
  example_translation?: string;
  level: string;
  section_id?: string;
  is_favorite: number;
  created_at: string;
  srs_grade?: number;
  srs_reps?: number;
  srs_due_date?: string;
  srs_interval?: number;
}

export interface DictionaryFilterParams {
  search?: string;
  sectionId?: string;
  level?: string;
  favoritesOnly?: boolean;
  mode?: 'practice' | 'all';
  page?: number;
  limit?: number;
}

export interface DictionaryResponse {
  success: boolean;
  data: DictionaryItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

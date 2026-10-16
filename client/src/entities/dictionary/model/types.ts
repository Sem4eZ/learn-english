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
}

export interface DictionaryFilterParams {
  search?: string;
  sectionId?: string;
  level?: string;
  favoritesOnly?: boolean;
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

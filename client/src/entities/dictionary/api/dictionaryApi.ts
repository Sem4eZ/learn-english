import { baseApi } from '@/shared/api/baseApi';
import { DictionaryItem, DictionaryFilterParams, DictionaryResponse } from '../model/types';
import { FALLBACK_WORDS } from '@/shared/lib/fallbackData';
import { store } from '@/app/store';

let localWordsCache: DictionaryItem[] | null = null;

function getOfflineWords(): DictionaryItem[] {
  if (localWordsCache) return localWordsCache;
  try {
    const saved = localStorage.getItem('fluentiq_offline_words');
    if (saved) {
      localWordsCache = JSON.parse(saved);
      return localWordsCache!;
    }
  } catch (_) {}
  localWordsCache = [...FALLBACK_WORDS];
  return localWordsCache;
}

function saveOfflineWords(words: DictionaryItem[]) {
  localWordsCache = words;
  try {
    localStorage.setItem('fluentiq_offline_words', JSON.stringify(words));
  } catch (_) {}
}

export const dictionaryApiSlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDictionary: builder.query<DictionaryResponse, DictionaryFilterParams | void>({
      query: (params) => {
        const queryParams: Record<string, string | number | boolean | undefined> = {};
        if (params?.search) queryParams.search = params.search;
        if (params?.sectionId && params.sectionId !== 'all') queryParams.sectionId = params.sectionId;
        if (params?.level && params.level !== 'all') queryParams.level = params.level;
        if (params?.favoritesOnly) queryParams.favoritesOnly = true;
        if (params?.mode) queryParams.mode = params.mode;
        if (params?.page) queryParams.page = params.page;
        if (params?.limit) queryParams.limit = params.limit;

        return {
          url: '/dictionary',
          params: queryParams,
        };
      },
      providesTags: ['Dictionary'],
    }),

    toggleFavorite: builder.mutation<{ success: boolean; data: DictionaryItem }, number>({
      query: (id) => ({
        url: `/dictionary/${id}/favorite`,
        method: 'POST',
      }),
      invalidatesTags: ['Dictionary'],
    }),

    reviewWord: builder.mutation<any, { wordId: number; grade: number }>({
      query: (body) => ({
        url: '/dictionary/review',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Dictionary', 'Stats', 'History'],
    }),

    lookupWord: builder.mutation<{ success: boolean; data: DictionaryItem; isNew: boolean; message: string; error?: string }, { word: string }>({
      query: (body) => ({
        url: '/dictionary/lookup',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Dictionary', 'Stats'],
    }),

    generateWords: builder.mutation<
      { success: boolean; message: string; data: DictionaryItem[]; totalCount: number },
      { level?: string; sectionId?: string; count?: number }
    >({
      query: (body) => ({
        url: '/dictionary/generate',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Dictionary'],
    }),
  }),
});

export const {
  useGetDictionaryQuery,
  useToggleFavoriteMutation,
  useReviewWordMutation,
  useLookupWordMutation,
  useGenerateWordsMutation,
} = dictionaryApiSlice;

export const dictionaryApi = {
  ...dictionaryApiSlice,

  async getDictionary(params: DictionaryFilterParams = {}): Promise<DictionaryResponse> {
    try {
      const res = await store.dispatch(
        dictionaryApiSlice.endpoints.getDictionary.initiate(params, { forceRefetch: true })
      ).unwrap();
      if (res && res.success) {
        if (res.data && res.data.length > 0) {
          saveOfflineWords(res.data);
        }
        return res;
      }
    } catch (err) {
      console.warn('[dictionaryApi] Backend query failed, using offline cache:', err);
    }

    // Resilient fallback if server is unreachable
    let filtered = getOfflineWords();
    if (params.sectionId && params.sectionId !== 'all') {
      filtered = filtered.filter(w => w.section_id === params.sectionId);
    }
    if (params.level && params.level !== 'all') {
      filtered = filtered.filter(w => w.level === params.level);
    }
    if (params.favoritesOnly) {
      filtered = filtered.filter(w => w.is_favorite);
    }
    if (params.search && params.search.trim()) {
      const q = params.search.toLowerCase().trim();
      filtered = filtered.filter(w =>
        w.word.toLowerCase().includes(q) ||
        w.translation.toLowerCase().includes(q) ||
        (w.definition && w.definition.toLowerCase().includes(q))
      );
    }

    const page = params.page || 1;
    const limit = params.limit || 50;
    const startIndex = (page - 1) * limit;
    const pageItems = filtered.slice(startIndex, startIndex + limit);

    return {
      success: true,
      data: pageItems,
      pagination: {
        page,
        limit,
        total: filtered.length,
        pages: Math.ceil(filtered.length / limit) || 1,
        totalInDb: filtered.length,
        totalOverall: filtered.length,
      },
    };
  },

  async toggleFavorite(id: number): Promise<DictionaryItem> {
    try {
      const res = await store.dispatch(
        dictionaryApiSlice.endpoints.toggleFavorite.initiate(id)
      ).unwrap();
      if (res && res.data) return res.data;
    } catch (err) {
      console.warn('[dictionaryApi] Backend favorite toggle failed:', err);
    }
    const words = getOfflineWords();
    const item = words.find(w => w.id === id);
    if (item) {
      item.is_favorite = item.is_favorite ? 0 : 1;
      saveOfflineWords(words);
      return item;
    }
    throw new Error('Слово не найдено');
  },

  async reviewWord(wordId: number, grade: number): Promise<any> {
    return await store.dispatch(
      dictionaryApiSlice.endpoints.reviewWord.initiate({ wordId, grade })
    ).unwrap();
  },

  async generateWords(level = 'A1', sectionId = 'general', count = 35) {
    try {
      return await store.dispatch(
        dictionaryApiSlice.endpoints.generateWords.initiate({ level, sectionId, count })
      ).unwrap();
    } catch (err) {
      console.warn('[dictionaryApi] Generator unavailable, returning cached words:', err);
      const words = getOfflineWords();
      return {
        success: true,
        message: 'Используются встроенные слова',
        data: words,
        totalCount: words.length,
      };
    }
  },

  async lookupWord(word: string) {
    try {
      return await store.dispatch(
        dictionaryApiSlice.endpoints.lookupWord.initiate({ word })
      ).unwrap();
    } catch (err: any) {
      console.warn('[dictionaryApi] Lookup unavailable:', err);
      const words = getOfflineWords();
      const existing = words.find(w => w.word.toLowerCase() === word.toLowerCase().trim());
      if (existing) {
        return {
          success: true,
          data: existing,
          isNew: false,
          message: `Слово «${existing.word}» найдено в словаре!`,
        };
      }
      return {
        success: false,
        data: null as any,
        isNew: false,
        message: 'Слово не найдено',
        error: err.message || 'Ошибка сервера',
      };
    }
  },
};

import { baseApi, executeApiThunk } from '@/shared/api/baseApi';
import { setSrsReviewHandler } from '@/shared/lib/srs';
import { DictionaryItem, DictionaryFilterParams, DictionaryResponse } from '../model/types';

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

    reviewWord: builder.mutation<any, { wordId: number; grade: number; trainerId?: string }>({
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
    return await executeApiThunk(
      dictionaryApiSlice.endpoints.getDictionary.initiate(params, { forceRefetch: true })
    ).unwrap();
  },

  async toggleFavorite(id: number): Promise<DictionaryItem> {
    const res = await executeApiThunk(
      dictionaryApiSlice.endpoints.toggleFavorite.initiate(id)
    ).unwrap();
    if (res && res.data) return res.data;
    throw new Error('Не удалось изменить статус избранного');
  },

  async reviewWord(wordId: number, grade: number, trainerId?: string): Promise<any> {
    return await executeApiThunk(
      dictionaryApiSlice.endpoints.reviewWord.initiate({ wordId, grade, trainerId })
    ).unwrap();
  },

  async generateWords(level = 'A1', sectionId = 'general', count = 35) {
    return await executeApiThunk(
      dictionaryApiSlice.endpoints.generateWords.initiate({ level, sectionId, count })
    ).unwrap();
  },

  async lookupWord(word: string) {
    return await executeApiThunk(
      dictionaryApiSlice.endpoints.lookupWord.initiate({ word })
    ).unwrap();
  },
};

setSrsReviewHandler((wordId, grade, trainerId) => dictionaryApi.reviewWord(Number(wordId), grade, trainerId));

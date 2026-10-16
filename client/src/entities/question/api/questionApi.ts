import { baseApi } from '@/shared/api/baseApi';
import { Question, QuestionsResponse, AnswerResult } from '../model/types';
import { FALLBACK_QUESTIONS } from '@/shared/lib/fallbackData';
import { store } from '@/app/store';

export const questionApiSlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getQuestions: builder.query<
      QuestionsResponse,
      { sectionId: string; level?: string; page?: number; limit?: number }
    >({
      query: (params) => ({
        url: '/questions',
        params,
      }),
      transformResponse: (res: {
        success: boolean;
        data: Question[];
        pagination: QuestionsResponse['pagination'];
      }) => ({
        data: res.data || [],
        pagination: res.pagination,
      }),
      providesTags: ['Questions'],
    }),

    generateBatch: builder.mutation<
      Question[],
      { sectionId: string; level?: string; count?: number; customTopic?: string }
    >({
      query: (body) => ({
        url: '/questions/generate',
        method: 'POST',
        body,
      }),
      transformResponse: (res: { success: boolean; data: Question[] }) => res.data || [],
      invalidatesTags: ['Questions'],
    }),

    submitAnswer: builder.mutation<
      AnswerResult,
      { questionId: number; selectedIndex: number }
    >({
      query: (body) => ({
        url: '/progress/answer',
        method: 'POST',
        body,
      }),
      transformResponse: (res: { success: boolean; data: AnswerResult }) => res.data,
      invalidatesTags: ['Stats', 'History', 'Questions'],
    }),
  }),
});

export const {
  useGetQuestionsQuery,
  useGenerateBatchMutation,
  useSubmitAnswerMutation,
} = questionApiSlice;

export const questionApi = {
  ...questionApiSlice,

  async getQuestions(params: {
    sectionId: string;
    level?: string;
    page?: number;
    limit?: number;
  }): Promise<QuestionsResponse> {
    try {
      const res = await store.dispatch(
        questionApiSlice.endpoints.getQuestions.initiate(params, { forceRefetch: true })
      ).unwrap();
      if (res && res.data && res.data.length > 0) {
        return res;
      }
    } catch (err) {
      console.warn('[questionApi] Backend query failed, using fallback questions:', err);
    }

    // Fallback if backend is unavailable
    let filtered = [...FALLBACK_QUESTIONS];
    if (params.sectionId && params.sectionId !== 'all') {
      const match = filtered.filter(q => q.section_id === params.sectionId);
      if (match.length > 0) filtered = match;
    }
    if (params.level && params.level !== 'all') {
      const match = filtered.filter(q => q.level === params.level);
      if (match.length > 0) filtered = match;
    }

    const page = params.page || 1;
    const limit = params.limit || 10;
    const startIndex = (page - 1) * limit;
    const pageItems = filtered.slice(startIndex, startIndex + limit);

    return {
      data: pageItems.length > 0 ? pageItems : FALLBACK_QUESTIONS.slice(0, limit),
      pagination: {
        page,
        limit,
        total: filtered.length,
        hasMore: startIndex + limit < filtered.length,
      },
    };
  },

  async generateBatch(params: {
    sectionId: string;
    level?: string;
    count?: number;
    customTopic?: string;
  }): Promise<Question[]> {
    try {
      const res = await store.dispatch(
        questionApiSlice.endpoints.generateBatch.initiate(params)
      ).unwrap();
      if (res && res.length > 0) return res;
    } catch (err) {
      console.warn('[questionApi] Generate failed, using fallback questions:', err);
    }
    return FALLBACK_QUESTIONS;
  },

  async submitAnswer(params: {
    questionId: number;
    selectedIndex: number;
  }): Promise<AnswerResult> {
    try {
      const res = await store.dispatch(
        questionApiSlice.endpoints.submitAnswer.initiate(params)
      ).unwrap();
      if (res) return res;
    } catch (err) {
      console.warn('[questionApi] Submit answer backend error:', err);
    }

    const q = FALLBACK_QUESTIONS.find(item => item.id === params.questionId) || FALLBACK_QUESTIONS[0];
    const isCorrect = q.correct_index === params.selectedIndex;
    return {
      isCorrect,
      correctIndex: q.correct_index ?? 0,
      explanation: q.explanation || (isCorrect ? 'Верно!' : 'Неверно, попробуйте еще раз.'),
      grammarRule: q.grammar_rule,
      pronunciationTip: q.pronunciation_tip,
      xpEarned: isCorrect ? 20 : 5,
      totalXp: 0,
      streak: 1,
    };
  },
};

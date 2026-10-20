import { baseApi, executeApiThunk } from '@/shared/api/baseApi';
import { Question, QuestionsResponse, AnswerResult } from '../model/types';


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
    return await executeApiThunk(
      questionApiSlice.endpoints.getQuestions.initiate(params, { forceRefetch: true })
    ).unwrap();
  },

  async generateBatch(params: {
    sectionId: string;
    level?: string;
    count?: number;
    customTopic?: string;
  }): Promise<Question[]> {
    return await executeApiThunk(
      questionApiSlice.endpoints.generateBatch.initiate(params)
    ).unwrap();
  },

  async submitAnswer(params: {
    questionId: number;
    selectedIndex: number;
  }): Promise<AnswerResult> {
    return await executeApiThunk(
      questionApiSlice.endpoints.submitAnswer.initiate(params)
    ).unwrap();
  },
};

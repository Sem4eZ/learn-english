import { apiClient } from '@/shared/api/client';
import { Question, QuestionsResponse, AnswerResult } from '../model/types';

export const questionApi = {
  async getQuestions(params: {
    sectionId: string;
    level?: string;
    page?: number;
    limit?: number;
  }): Promise<QuestionsResponse> {
    const res = await apiClient.get<{
      success: boolean;
      data: Question[];
      pagination: QuestionsResponse['pagination'];
    }>('/questions', params);

    return {
      data: res.data,
      pagination: res.pagination,
    };
  },

  async generateBatch(params: {
    sectionId: string;
    level?: string;
    count?: number;
    customTopic?: string;
  }): Promise<Question[]> {
    const res = await apiClient.post<{ success: boolean; data: Question[] }>('/questions/generate', params);
    return res.data;
  },

  async submitAnswer(params: {
    questionId: number;
    selectedIndex: number;
  }): Promise<AnswerResult> {
    const res = await apiClient.post<{ success: boolean; data: AnswerResult }>('/progress/answer', params);
    return res.data;
  },
};

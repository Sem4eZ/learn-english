import { apiClient } from '@/shared/api/client';
import { Question, QuestionsResponse, AnswerResult } from '../model/types';
import { FALLBACK_QUESTIONS } from '@/shared/lib/fallbackData';
import { xpEventBus } from '@/shared/lib/xpEvents';

export const questionApi = {
  async getQuestions(params: {
    sectionId: string;
    level?: string;
    page?: number;
    limit?: number;
  }): Promise<QuestionsResponse> {
    if (!apiClient.isOfflineMode()) {
      try {
        const res = await apiClient.get<{
          success: boolean;
          data: Question[];
          pagination: QuestionsResponse['pagination'];
        }>('/questions', params);

        if (res && res.data && res.data.length > 0) {
          return {
            data: res.data,
            pagination: res.pagination,
          };
        }
      } catch (err) {
        console.warn('Backend unavailable, using fallback questions:', err);
      }
    }

    // Resilient offline fallback for GitHub Pages
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
    if (!apiClient.isOfflineMode()) {
      try {
        const res = await apiClient.post<{ success: boolean; data: Question[] }>('/questions/generate', params);
        if (res && res.data) return res.data;
      } catch (err) {
        console.warn('Backend generate unavailable, using fallback questions:', err);
      }
    }
    return FALLBACK_QUESTIONS;
  },

  async submitAnswer(params: {
    questionId: number;
    selectedIndex: number;
  }): Promise<AnswerResult> {
    if (!apiClient.isOfflineMode()) {
      try {
        const res = await apiClient.post<{ success: boolean; data: AnswerResult }>('/progress/answer', params);
        if (res && res.data) return res.data;
      } catch (err) {
        console.warn('Backend unavailable, processing answer locally:', err);
      }
    }

    // Local evaluation for GitHub Pages
    const q = FALLBACK_QUESTIONS.find(item => item.id === params.questionId) || FALLBACK_QUESTIONS[0];
    const isCorrect = q.correct_index === params.selectedIndex;
    const xpReward = isCorrect ? 20 : 5;

    // Trigger local XP event bus
    xpEventBus.emit({
      xpReward,
      source: 'grammar',
      streak: 2
    });

    return {
      isCorrect,
      correctIndex: q.correct_index ?? 0,
      explanation: q.explanation || (isCorrect ? 'Верно!' : 'Неверно, попробуйте еще раз.'),
      grammarRule: q.grammar_rule,
      pronunciationTip: q.pronunciation_tip,
      xpEarned: xpReward,
      totalXp: 140,
      streak: 2
    };
  },
};

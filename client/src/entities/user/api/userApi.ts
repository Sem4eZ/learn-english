import { apiClient } from '@/shared/api/client';
import { UserStats, HistoryItem } from '../model/types';
import { FALLBACK_USER_STATS } from '@/shared/lib/fallbackData';

export const userApi = {
  async getStats(): Promise<UserStats> {
    try {
      const res = await apiClient.get<{ success: boolean; data: UserStats }>('/progress/stats');
      if (res && res.data) return res.data;
    } catch (err) {
      console.warn('Backend unavailable, using local stats:', err);
    }
    return FALLBACK_USER_STATS;
  },

  async getHistory(mistakesOnly = false): Promise<HistoryItem[]> {
    try {
      const res = await apiClient.get<{ success: boolean; data: HistoryItem[] }>('/progress/history', {
        mistakesOnly,
      });
      if (res && res.data) return res.data;
    } catch (err) {
      console.warn('Backend unavailable, returning empty history:', err);
    }
    return [];
  },
};

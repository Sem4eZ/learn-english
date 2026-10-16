import { apiClient } from '@/shared/api/client';
import { UserStats, HistoryItem } from '../model/types';

export const userApi = {
  async getStats(): Promise<UserStats> {
    const res = await apiClient.get<{ success: boolean; data: UserStats }>('/progress/stats');
    return res.data;
  },

  async getHistory(mistakesOnly = false): Promise<HistoryItem[]> {
    const res = await apiClient.get<{ success: boolean; data: HistoryItem[] }>('/progress/history', {
      mistakesOnly,
    });
    return res.data;
  },
};

import { apiClient } from '@/shared/api/client';
import { Section } from '../model/types';
import { FALLBACK_SECTIONS } from '@/shared/lib/fallbackData';

export const sectionApi = {
  async getSections(): Promise<Section[]> {
    if (!apiClient.isOfflineMode()) {
      try {
        const res = await apiClient.get<{ success: boolean; data: Section[] }>('/sections');
        if (res && res.data && res.data.length > 0) {
          return res.data;
        }
      } catch (err) {
        console.warn('Backend unavailable, using fallback sections:', err);
      }
    }
    return FALLBACK_SECTIONS;
  },
};

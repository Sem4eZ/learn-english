import { apiClient } from '@/shared/api/client';
import { Section } from '../model/types';

export const sectionApi = {
  async getSections(): Promise<Section[]> {
    const res = await apiClient.get<{ success: boolean; data: Section[] }>('/sections');
    return res.data;
  },
};

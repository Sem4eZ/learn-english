import { baseApi } from '@/shared/api/baseApi';
import { Section } from '../model/types';
import { FALLBACK_SECTIONS } from '@/shared/lib/fallbackData';
import { store } from '@/app/store';

export const sectionApiSlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSections: builder.query<Section[], void>({
      query: () => '/sections',
      transformResponse: (res: { success: boolean; data: Section[] }) => res.data || [],
      providesTags: ['Sections'],
    }),
  }),
});

export const { useGetSectionsQuery } = sectionApiSlice;

export const sectionApi = {
  ...sectionApiSlice,
  async getSections(): Promise<Section[]> {
    try {
      const res = await store.dispatch(
        sectionApiSlice.endpoints.getSections.initiate(undefined)
      ).unwrap();
      if (res && res.length > 0) return res;
    } catch (err) {
      console.warn('[sectionApi] Backend unavailable, using fallback sections:', err);
    }
    return FALLBACK_SECTIONS;
  },
};

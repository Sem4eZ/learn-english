import { baseApi, executeApiThunk } from '@/shared/api/baseApi';
import { Section } from '../model/types';


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
      const res = await executeApiThunk(
        sectionApiSlice.endpoints.getSections.initiate(undefined)
      ).unwrap();
      return res || [];
    } catch (err) {
      console.error('[sectionApi] Backend failed to load sections:', err);
      return [];
    }
  },
};

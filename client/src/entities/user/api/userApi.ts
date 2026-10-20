import { baseApi, executeApiThunk } from '@/shared/api/baseApi';
import { UserStats, HistoryItem, INITIAL_USER_STATS } from '../model/types';


export const userApiSlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUserStats: builder.query<UserStats, void>({
      query: () => '/progress/stats',
      transformResponse: (res: { success: boolean; data: UserStats }) => res.data || INITIAL_USER_STATS,
      providesTags: ['Stats'],
    }),
    getHistory: builder.query<HistoryItem[], void>({
      query: () => '/progress/history',
      transformResponse: (res: { success: boolean; data: HistoryItem[] }) => res.data || [],
      providesTags: ['History'],
    }),
    getMe: builder.query<{ success: boolean; authenticated: boolean; user?: any }, void>({
      query: () => '/auth/me',
      providesTags: ['User'],
    }),
  }),
});

export const {
  useGetUserStatsQuery,
  useGetHistoryQuery,
  useGetMeQuery,
} = userApiSlice;

export const userApi = {
  ...userApiSlice,
  async getStats(): Promise<UserStats> {
    try {
      const res = await executeApiThunk(
        userApiSlice.endpoints.getUserStats.initiate(undefined, { forceRefetch: true })
      ).unwrap();
      return res || INITIAL_USER_STATS;
    } catch (err) {
      console.warn('[userApi] Failed to load user stats from server:', err);
      return INITIAL_USER_STATS;
    }
  },

  async getHistory(): Promise<HistoryItem[]> {
    try {
      const res = await executeApiThunk(
        userApiSlice.endpoints.getHistory.initiate(undefined, { forceRefetch: true })
      ).unwrap();
      return res || [];
    } catch (err) {
      console.warn('[userApi] Failed to load history from server:', err);
      return [];
    }
  },

  async getMe() {
    try {
      return await executeApiThunk(
        userApiSlice.endpoints.getMe.initiate(undefined, { forceRefetch: true })
      ).unwrap();
    } catch (err) {
      return { success: false, authenticated: false };
    }
  },
};

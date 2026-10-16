import { createApi, fetchBaseQuery, retry } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '@/shared/config';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  prepareHeaders: (headers) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('fluentiq_token');
      const userId = localStorage.getItem('fluentiq_user_id') || localStorage.getItem('lexiflow_user_id');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      if (userId) {
        headers.set('x-user-id', userId);
      }
    }
    return headers;
  },
});

// Resilient auto-retry on 502/503/504 cold starts during backend spin-up
const baseQueryWithRetry = retry(rawBaseQuery, { maxRetries: 2 });

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithRetry,
  tagTypes: ['User', 'Stats', 'Sections', 'Dictionary', 'Questions', 'History'],
  endpoints: () => ({}),
});

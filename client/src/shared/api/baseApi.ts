import { createApi, fetchBaseQuery, retry, BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
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

// Automatic Refresh Token rotation on 401 Unauthorized
const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    if (typeof window !== 'undefined') {
      const refreshToken = localStorage.getItem('fluentiq_refresh_token');
      if (refreshToken) {
        const refreshResult = await rawBaseQuery(
          {
            url: '/auth/refresh',
            method: 'POST',
            body: { refreshToken },
          },
          api,
          extraOptions
        );

        if (refreshResult.data && (refreshResult.data as any).success && (refreshResult.data as any).token) {
          const authData = refreshResult.data as any;
          localStorage.setItem('fluentiq_token', authData.token);
          if (authData.refreshToken) {
            localStorage.setItem('fluentiq_refresh_token', authData.refreshToken);
          }
          if (authData.user) {
            localStorage.setItem('fluentiq_user_data', JSON.stringify(authData.user));
          }
          // Retry original request with newly rotated token
          result = await rawBaseQuery(args, api, extraOptions);
        } else {
          // Token expired and cannot be refreshed
          localStorage.removeItem('fluentiq_token');
          localStorage.removeItem('fluentiq_refresh_token');
          localStorage.removeItem('fluentiq_user_data');
        }
      }
    }
  }

  return result;
};

// Resilient auto-retry on 502/503/504 cold starts during backend spin-up
const resilientBaseQuery = retry(baseQueryWithReauth, { maxRetries: 2 });

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: resilientBaseQuery,
  tagTypes: ['User', 'Stats', 'Sections', 'Dictionary', 'Questions', 'History'],
  endpoints: () => ({}),
});

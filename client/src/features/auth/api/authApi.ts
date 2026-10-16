import { baseApi } from '@/shared/api/baseApi';
import { AuthUser } from '../ui/AuthModal';

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: AuthUser;
  error?: string;
}

export const authApiSlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<AuthResponse, { username: string; password?: string }>({
      query: (body) => ({
        url: '/auth/login',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['User', 'Stats', 'History'],
    }),
    register: builder.mutation<AuthResponse, { username: string; password?: string }>({
      query: (body) => ({
        url: '/auth/register',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['User', 'Stats', 'History'],
    }),
  }),
});

export const { useLoginMutation, useRegisterMutation } = authApiSlice;

export const authSession = {
  setAuth(token: string, userId: string) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('fluentiq_token', token);
    localStorage.setItem('fluentiq_user_id', userId);
  },

  clearAuth() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('fluentiq_token');
    localStorage.removeItem('fluentiq_user_id');
    localStorage.removeItem('lexiflow_user_id');
  },

  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('fluentiq_token');
  },

  getUserId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('fluentiq_user_id') || localStorage.getItem('lexiflow_user_id');
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  },
};

import { baseApi } from '@/shared/api/baseApi';
import { AuthUser } from '../model/types';

export interface AuthResponse {
  success: boolean;
  token?: string;
  refreshToken?: string;
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
    refreshToken: builder.mutation<AuthResponse, { refreshToken?: string }>({
      query: (body) => ({
        url: '/auth/refresh',
        method: 'POST',
        body,
      }),
    }),
  }),
});

export const { useLoginMutation, useRegisterMutation, useRefreshTokenMutation } = authApiSlice;

export const authSession = {
  setAuth(token?: string, userId?: string, user?: AuthUser, refreshToken?: string) {
    if (typeof window === 'undefined') return;
    if (token) localStorage.setItem('fluentiq_token', token);
    if (userId) localStorage.setItem('fluentiq_user_id', userId);
    if (refreshToken) localStorage.setItem('fluentiq_refresh_token', refreshToken);
    if (user) {
      try {
        localStorage.setItem('fluentiq_user_data', JSON.stringify(user));
      } catch (e) {
        console.warn('Failed to persist user profile:', e);
      }
    }
  },

  saveUser(user: AuthUser) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('fluentiq_user_data', JSON.stringify(user));
    } catch (e) {
      console.warn('Failed to save user:', e);
    }
  },

  clearAuth() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('fluentiq_token');
    localStorage.removeItem('fluentiq_refresh_token');
    localStorage.removeItem('fluentiq_user_id');
    localStorage.removeItem('fluentiq_user_data');
    localStorage.removeItem('lexiflow_user_id');
  },

  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('fluentiq_token');
  },

  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('fluentiq_refresh_token');
  },

  getUserId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('fluentiq_user_id') || localStorage.getItem('lexiflow_user_id');
  },

  getSavedUser(): AuthUser | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem('fluentiq_user_data');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch (e) {
      return null;
    }
  },

  isAuthenticated(): boolean {
    return !!(this.getToken() || this.getRefreshToken() || this.getSavedUser());
  },
};

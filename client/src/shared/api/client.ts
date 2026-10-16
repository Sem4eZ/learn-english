import { DEFAULT_USER_ID } from '../config/constants';

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

class ApiClient {
  private baseUrl = '/api';

  private getUserId(): string {
    return localStorage.getItem('fluentiq_user_id') || localStorage.getItem('lexiflow_user_id') || DEFAULT_USER_ID;
  }

  private getToken(): string | null {
    return localStorage.getItem('fluentiq_token');
  }

  setAuth(token: string, userId: string) {
    localStorage.setItem('fluentiq_token', token);
    localStorage.setItem('fluentiq_user_id', userId);
  }

  clearAuth() {
    localStorage.removeItem('fluentiq_token');
    localStorage.removeItem('fluentiq_user_id');
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, headers, ...rest } = options;
    let url = `${this.baseUrl}${endpoint}`;

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          searchParams.append(key, String(val));
        }
      });
      const queryStr = searchParams.toString();
      if (queryStr) {
        url += (url.includes('?') ? '&' : '?') + queryStr;
      }
    }

    const token = this.getToken();
    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-user-id': this.getUserId(),
      ...(headers as Record<string, string> || {}),
    };

    if (token) {
      reqHeaders['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      headers: reqHeaders,
      ...rest,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error ${res.status}`);
    }

    return res.json();
  }

  get<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>) {
    return this.request<T>(endpoint, { method: 'GET', params });
  }

  post<T>(endpoint: string, body?: any) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}

export const apiClient = new ApiClient();

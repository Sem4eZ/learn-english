interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

class ApiClient {
  private getBaseUrl(): string {
    const customUrl = localStorage.getItem('fluentiq_api_url');
    if (customUrl) return customUrl.replace(/\/$/, '') + (customUrl.endsWith('/api') ? '' : '/api');
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl) return envUrl.replace(/\/$/, '') + (envUrl.endsWith('/api') ? '' : '/api');
    return '/api';
  }

  setApiUrl(url: string) {
    if (url) {
      localStorage.setItem('fluentiq_api_url', url.trim());
    } else {
      localStorage.removeItem('fluentiq_api_url');
    }
  }

  getApiUrl(): string {
    return this.getBaseUrl();
  }

  isOfflineMode(): boolean {
    if (localStorage.getItem('fluentiq_api_url')) return false;
    if (import.meta.env.VITE_API_URL) return false;
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host.endsWith('github.io')) return true;
    }
    return false;
  }

  private getUserId(): string | null {
    return localStorage.getItem('fluentiq_user_id') || localStorage.getItem('lexiflow_user_id') || null;
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
    localStorage.removeItem('lexiflow_user_id');
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, headers, ...rest } = options;
    let url = `${this.getBaseUrl()}${endpoint}`;

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
    const userId = this.getUserId();
    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(headers as Record<string, string> || {}),
    };

    if (userId) {
      reqHeaders['x-user-id'] = userId;
    }

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

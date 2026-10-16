import { API_BASE_URL } from '@/shared/config';

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  skipCache?: boolean;
}

// In-memory cache for fast tab-switching and zero-latency repeat requests
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

class ApiClient {
  private cache = new Map<string, CacheEntry<any>>();

  constructor() {
    // Warm up the cloud backend in the background
    this.warmUpBackend();
  }

  private warmUpBackend() {
    if (typeof window === 'undefined') return;
    const base = this.getBaseUrl();
    // Non-blocking ping
    setTimeout(() => {
      fetch(`${base}/health`, { mode: 'cors' }).catch(() => {});
    }, 100);
  }

  private getBaseUrl(): string {
    return API_BASE_URL;
  }

  getApiUrl(): string {
    return this.getBaseUrl();
  }

  isOfflineMode(): boolean {
    // All environments now connect directly to the live cloud backend by default
    return false;
  }

  private getUserId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('fluentiq_user_id') || localStorage.getItem('lexiflow_user_id') || null;
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('fluentiq_token');
  }

  setAuth(token: string, userId: string) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('fluentiq_token', token);
    localStorage.setItem('fluentiq_user_id', userId);
    this.clearCache(); // Invalidate cache on user switch
  }

  clearAuth() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('fluentiq_token');
    localStorage.removeItem('fluentiq_user_id');
    localStorage.removeItem('lexiflow_user_id');
    this.clearCache();
  }

  clearCache(pattern?: string) {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, headers, skipCache = false, ...rest } = options;
    const isGet = !rest.method || rest.method.toUpperCase() === 'GET';
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

    // Check memory cache for GET requests
    const cacheKey = `${url}:${this.getUserId() || 'guest'}`;
    if (isGet && !skipCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < cached.ttlMs) {
        return cached.data as T;
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

    // Auto-retry up to 2 times on cold starts (502, 503, 504 from spin-down)
    let lastError: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(url, {
          headers: reqHeaders,
          ...rest,
        });

        // If server is spinning up (502, 503, 504), wait and retry cleanly
        if ((res.status === 502 || res.status === 503 || res.status === 504) && attempt < 3) {
          await new Promise(r => setTimeout(r, attempt * 1200));
          continue;
        }

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP error ${res.status}`);
        }

        const data = await res.json();

        // Cache successful GET results
        if (isGet) {
          // Sections cached for 5 min, dictionary/stats for 45 sec
          const ttlMs = endpoint.startsWith('/sections') ? 300000 : 45000;
          this.cache.set(cacheKey, {
            data,
            timestamp: Date.now(),
            ttlMs
          });
        } else {
          // On mutations (POST/PUT/DELETE), invalidate relevant caches
          if (endpoint.includes('dictionary') || endpoint.includes('progress')) {
            this.clearCache('/dictionary');
            this.clearCache('/progress');
          }
        }

        return data as T;
      } catch (err: any) {
        lastError = err;
        if (attempt < 3 && (err.message?.includes('502') || err.message?.includes('503') || err.message?.includes('Failed to fetch'))) {
          await new Promise(r => setTimeout(r, attempt * 1200));
          continue;
        }
        break;
      }
    }

    throw lastError;
  }

  get<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>, skipCache = false) {
    return this.request<T>(endpoint, { method: 'GET', params, skipCache });
  }

  post<T>(endpoint: string, body?: any) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}

export const apiClient = new ApiClient();

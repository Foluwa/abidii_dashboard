/**
 * API Client Configuration
 * 
 * Centralized axios client with:
 * - Environment-based base URL
 * - HttpOnly cookie authentication
 * - Automatic token refresh
 * - Request/response interceptors
 */

import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';

// Get API base URL from environment variable
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.abidii.app';

/**
 * Main API client instance
 */
const _apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false, // Tokens are sent via Authorization header, not cookies
});

/**
 * In-flight request deduplication cache.
 * Prevents identical GET requests from being fired in parallel
 * (e.g. React StrictMode double-mount, multiple hooks).
 * Capped at 100 entries; entries evicted after 30s TTL.
 */
const inFlightCache = new Map<string, Promise<unknown>>();
const IN_FLIGHT_MAX_SIZE = 100;
const IN_FLIGHT_TTL_MS = 30_000;

function evictOldestFromCache() {
  if (inFlightCache.size > IN_FLIGHT_MAX_SIZE) {
    const oldest = inFlightCache.keys().next().value;
    if (oldest) inFlightCache.delete(oldest);
  }
}

function buildCacheKey(url: string, params?: unknown): string {
  return `GET:${url}:${params ? JSON.stringify(params) : ''}`;
}

// Bind the ORIGINAL axios get before we override it, to avoid infinite recursion
const _originalGet = _apiClient.get.bind(_apiClient);

function dedupedGet<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<{ data: T }> {
  const key = buildCacheKey(url, config?.params);
  const cached = inFlightCache.get(key);
  if (cached) {
    return cached as Promise<{ data: T }>;
  }
  evictOldestFromCache();
  const promise = _originalGet<T>(url, config).finally(() => {
    inFlightCache.delete(key);
  });
  inFlightCache.set(key, promise);
  // TTL: evict if still pending after 30s (stuck/hung request)
  setTimeout(() => {
    if (inFlightCache.get(key) === promise) {
      inFlightCache.delete(key);
    }
  }, IN_FLIGHT_TTL_MS);
  return promise;
}

/**
 * Public API client with deduplicated GET
 */
export const apiClient = Object.assign(_apiClient, {
  get: dedupedGet,
});

function buildIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function shouldUseAdminProxy(url?: string): boolean {
  return !!url && url.startsWith('/api/v1/admin/');
}

/**
 * Request interceptor
 * Adds auth token to requests and deduplicates identical in-flight GETs
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔵 API REQUEST:', {
        method: config.method?.toUpperCase(),
        url: config.url,
        baseURL: config.baseURL,
        fullURL: `${config.baseURL}${config.url}`,
        hasToken: !!sessionStorage.getItem('access_token'),
      });
    }

    if (shouldUseAdminProxy(config.url)) {
      if (config.url?.startsWith('/api/v1/admin/')) {
        config.url = config.url.replace('/api/v1/admin/', '/api/admin/');
      }

      // Rewritten admin requests must target the Next.js same-origin proxy,
      // not the backend base URL where /api/admin/* does not exist.
      config.baseURL = undefined;
    }

    // Get access token from sessionStorage and attach to Authorization header
    // FastAPI HTTPBearer-secured endpoints expect: "Authorization: Bearer <token>"
    const accessToken = sessionStorage.getItem('access_token');
    if (accessToken) {
      config.headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // The x-admin-token header (separate from the JWT) is attached
    // server-side only, by the /api/admin/* proxy route — never here.
    // A NEXT_PUBLIC_-prefixed copy of that token must never exist: Next.js
    // inlines NEXT_PUBLIC_* values into the client bundle at build time
    // regardless of whether the code path referencing it is reachable.

    const method = config.method?.toLowerCase();
    if (method && ['post', 'put', 'patch', 'delete'].includes(method) && !config.headers['Idempotency-Key']) {
      config.headers['Idempotency-Key'] = buildIdempotencyKey();
    }

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor
 * Handles token refresh on 401 errors
 */
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Guard: if no request config, we can't retry or inspect the URL
    if (!originalRequest) {
      return Promise.reject(error);
    }

    // If the backend is explicitly telling us the admin monitoring token is invalid,
    // this is unrelated to the JWT access token. Do NOT try to refresh JWTs for this.
    if (
      error.response?.status === 401 &&
      (error.response.data as any)?.detail === 'Invalid admin token'
    ) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Invalid admin monitoring token; skipping JWT refresh.');
      }
      return Promise.reject(error);
    }

    // Don't try to refresh token for login or refresh endpoints
    const isAuthEndpoint = originalRequest.url?.includes('/auth/admin/login') || 
                          originalRequest.url?.includes('/auth/refresh');
    
    // ONLY refresh token on 401 Unauthorized (not 403, 422, or other errors)
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Got 401 error, attempting token refresh...');
      }
      
      if (isRefreshing) {
        // Wait for the refresh to complete (with 30s timeout)
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            const idx = failedQueue.findIndex((entry) => entry.reject === reject);
            if (idx >= 0) failedQueue.splice(idx, 1);
            reject(new Error('Token refresh timeout'));
          }, 30000);
          const wrappedResolve = (value?: unknown) => {
            clearTimeout(timeout);
            resolve(value);
          };
          const wrappedReject = (reason?: unknown) => {
            clearTimeout(timeout);
            reject(reason);
          };
          failedQueue.push({ resolve: wrappedResolve, reject: wrappedReject });
        })
          .then(() => {
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Get the refresh token from sessionStorage
        const refreshToken = sessionStorage.getItem('refresh_token');
        
        if (!refreshToken) {
          if (process.env.NODE_ENV === 'development') {
            console.error('❌ No refresh token available, cannot refresh');
          }
          throw new Error('No refresh token available');
        }

        // Call refresh endpoint (same for admin and regular users)
        const refreshResponse = await apiClient.post<{ 
          access_token: string; 
          refresh_token: string;
          expires_in: number;
        }>(
          '/api/v1/auth/refresh',
          { refresh_token: refreshToken }
        );

        
        // Calculate new expiry time
        const expiryTime = Date.now() + ((refreshResponse.data.expires_in || 3600) * 1000);
        
        // Store new tokens in sessionStorage (clears on browser/tab close)
        sessionStorage.setItem('access_token', refreshResponse.data.access_token);
        sessionStorage.setItem('token_expiry', expiryTime.toString());
        if (refreshResponse.data.refresh_token) {
          sessionStorage.setItem('refresh_token', refreshResponse.data.refresh_token);
        }

        processQueue(null, null);
        isRefreshing = false;

        // Retry the original request
        return apiClient(originalRequest);
      } catch (refreshError) {
        if (process.env.NODE_ENV === 'development') {
          console.error('❌ Token refresh failed:', refreshError);
        }
        processQueue(refreshError as Error, null);
        isRefreshing = false;

        // Clear only auth keys — preserve UI preferences and other non-auth state
        for (const key of ['access_token', 'refresh_token', 'token_expiry']) {
          sessionStorage.removeItem(key);
        }
        document.cookie = 'user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        
        // Only redirect if we're not already on the login page
        const currentPath = window.location.pathname;
        if (currentPath !== '/' && currentPath !== '/signin') {
          if (process.env.NODE_ENV === 'development') {
            console.error('Token refresh failed, redirecting to login');
          }
          // Use setTimeout to avoid affecting current request flow
          setTimeout(() => {
            window.location.href = '/signin';
          }, 100);
        }

        return Promise.reject(refreshError);
    }}
    

    // Handle 429 Too Many Requests with a user-friendly message
    if (error.response?.status === 429) {
      const retryAfter = (error.response.data as any)?.retry_after ?? 60;
      const err = new Error(`Rate limit exceeded. Please wait ${retryAfter} seconds before retrying.`);
      (err as any).status = 429;
      (err as any).retryAfter = retryAfter;
      return Promise.reject(err);
    }

    // For non-401/non-429 errors or already retried, just reject
    return Promise.reject(error);
  }
);

/**
 * API response types
 */
export interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
  success?: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_more: boolean;
}

/**
 * Helper function to handle API errors
 */
export const handleApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || error.message || 'An error occurred';
  }
  return 'An unexpected error occurred';
};

/**
 * Generic GET request
 */
export const get = <T>(url: string, config?: AxiosRequestConfig) => {
  return apiClient.get<T>(url, config);
};

/**
 * Generic POST request
 */
export const post = <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => {
  return apiClient.post<T>(url, data, config);
};

/**
 * Generic PUT request
 */
export const put = <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => {
  return apiClient.put<T>(url, data, config);
};

/**
 * Generic PATCH request
 */
export const patch = <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => {
  return apiClient.patch<T>(url, data, config);
};

/**
 * Generic DELETE request
 */
export const del = <T>(url: string, config?: AxiosRequestConfig) => {
  return apiClient.delete<T>(url, config);
};

export default apiClient;

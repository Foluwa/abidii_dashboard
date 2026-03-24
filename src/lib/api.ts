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
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

/**
 * Main API client instance
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important: enables httpOnly cookies
});

function buildIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Request interceptor
 * Adds auth token to requests
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

    // Get access token from sessionStorage and attach to Authorization header
    // FastAPI HTTPBearer-secured endpoints expect: "Authorization: Bearer <token>"
    const accessToken = sessionStorage.getItem('access_token');
    if (accessToken) {
      config.headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // Monitoring/admin tooling endpoints use a separate x-admin-token header,
    // which is NOT the JWT. It should be configured via env.
    const adminMonitoringToken = process.env.NEXT_PUBLIC_ADMIN_MONITORING_TOKEN;
    if (adminMonitoringToken && config.url?.startsWith('/api/v1/admin/')) {
      config.headers['x-admin-token'] = adminMonitoringToken;
    }

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
    console.log('🟢 API RESPONSE:', {
      status: response.status,
      url: response.config.url,
      method: response.config.method?.toUpperCase(),
      dataKeys: response.data ? Object.keys(response.data) : []
    });
    return response;
  },
  async (error: AxiosError) => {
    console.log('🔴 API ERROR:', {
      status: error.response?.status,
      url: error.config?.url,
      method: error.config?.method?.toUpperCase(),
      message: error.message,
      responseData: error.response?.data
    });
    
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // If the backend is explicitly telling us the admin monitoring token is invalid,
    // this is unrelated to the JWT access token. Do NOT try to refresh JWTs for this.
    if (
      error.response?.status === 401 &&
      (error.response.data as any)?.detail === 'Invalid admin token'
    ) {
      console.warn('⚠️ Invalid admin monitoring token; skipping JWT refresh.');
      return Promise.reject(error);
    }

    // Don't try to refresh token for login or refresh endpoints
    const isAuthEndpoint = originalRequest.url?.includes('/auth/admin/login') || 
                          originalRequest.url?.includes('/auth/refresh');
    
    // ONLY refresh token on 401 Unauthorized (not 403, 422, or other errors)
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      console.warn('⚠️ Got 401 error, attempting token refresh...');
      
      if (isRefreshing) {
        console.log('⏳ Token refresh already in progress, queuing request...');
        // Wait for the refresh to complete
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            console.log('✅ Retrying queued request after refresh');
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;
      console.log('🔄 Starting token refresh process...');

      try {
        // Get the refresh token from sessionStorage
        const refreshToken = sessionStorage.getItem('refresh_token');
        console.log('Refresh token exists:', !!refreshToken);
        
        if (!refreshToken) {
          console.error('❌ No refresh token available, cannot refresh');
          throw new Error('No refresh token available');
        }

        // Call refresh endpoint (same for admin and regular users)
        console.log('📡 Calling refresh endpoint...');
        const refreshResponse = await apiClient.post<{ 
          access_token: string; 
          refresh_token: string;
          expires_in: number;
        }>(
          '/api/v1/auth/refresh',
          { refresh_token: refreshToken }
        );

        console.log('✅ Token refresh successful');
        
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

        console.log('🔁 Retrying original request with new token...');
        // Retry the original request
        return apiClient(originalRequest);
      } catch (refreshError) {
        console.error('❌ Token refresh failed:', refreshError);
        processQueue(refreshError as Error, null);
        isRefreshing = false;

        // Clear auth data immediately to prevent further refresh attempts
        sessionStorage.clear();
        document.cookie = 'user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        
        // Only redirect if we're not already on the login page
        const currentPath = window.location.pathname;
        if (currentPath !== '/' && currentPath !== '/signin') {
          console.error('Token refresh failed, redirecting to login');
          // Use setTimeout to avoid affecting current request flow
          setTimeout(() => {
            window.location.href = '/';
          }, 100);
        }

        return Promise.reject(refreshError);
    }}
    

    // For non-401 errors or already retried, just reject
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

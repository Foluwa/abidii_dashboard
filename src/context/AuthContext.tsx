"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, handleApiError } from '@/lib/api';
import { User, UserRole, AdminLoginRequest, AdminLoginResponse, hasPermission } from '@/types/auth';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: AdminLoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  checkPermission: (permission: string) => boolean;
  isAdmin: boolean;
  isManager: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Auth Provider Component
 * Manages authentication state and user session
 */
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const isRefreshingSessionRef = React.useRef(false);

  const refreshSession = React.useCallback(async (): Promise<boolean> => {
    const refreshToken = sessionStorage.getItem('refresh_token');
    if (!refreshToken) return false;

    if (isRefreshingSessionRef.current) return true;
    isRefreshingSessionRef.current = true;

    try {
      const refreshResponse = await apiClient.post<{
        access_token: string;
        refresh_token: string;
        expires_in: number;
      }>(
        '/api/v1/auth/refresh',
        { refresh_token: refreshToken }
      );

      const expiryTime = Date.now() + ((refreshResponse.data.expires_in || 3600) * 1000);
      sessionStorage.setItem('access_token', refreshResponse.data.access_token);
      sessionStorage.setItem('token_expiry', expiryTime.toString());
      if (refreshResponse.data.refresh_token) {
        sessionStorage.setItem('refresh_token', refreshResponse.data.refresh_token);
      }

      return true;
    } catch (error) {
      console.error('❌ Silent token refresh failed:', error);
      return false;
    } finally {
      isRefreshingSessionRef.current = false;
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // Auth state tracking
  }, [user, isLoading]);

  /**
   * Load user from sessionStorage on mount
   * sessionStorage is more secure as it clears when browser/tab closes
   */
  useEffect(() => {
    const loadUser = () => {
      try {
        const storedUser = sessionStorage.getItem('user');
        const accessToken = sessionStorage.getItem('access_token');
        const tokenExpiry = sessionStorage.getItem('token_expiry');
        
        // Check if token has expired
        if (tokenExpiry && Date.now() > parseInt(tokenExpiry)) {
          // Refresh is async; we defer completion below.
        }
        
        // Validate both user data and token exist
        if (storedUser && accessToken) {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
        } else {
          // Clear invalid session
          sessionStorage.clear();
        }
      } catch (error) {
        console.error('Failed to load user from sessionStorage:', error);
        sessionStorage.clear();
      } finally {
        setIsLoading(false);
      }
    };

    // Load user, and if needed attempt a silent refresh first.
    (async () => {
      try {
        const tokenExpiry = sessionStorage.getItem('token_expiry');
        if (tokenExpiry && Date.now() > parseInt(tokenExpiry)) {
          const refreshed = await refreshSession();
          if (!refreshed) {
            sessionStorage.clear();
            document.cookie = 'user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          }
        }
      } finally {
        loadUser();
      }
    })();

    // Set up a periodic check for token expiry (every minute)
    const expiryCheckInterval = setInterval(() => {
      const tokenExpiry = sessionStorage.getItem('token_expiry');
      if (!tokenExpiry) return;

      const expiryMs = parseInt(tokenExpiry);
      const remainingMs = expiryMs - Date.now();

      // Refresh if the token is expired or will expire soon.
      // This prevents idle sessions from being logged out purely client-side.
      if (remainingMs <= 2 * 60 * 1000) {
        (async () => {
          const refreshed = await refreshSession();
          if (!refreshed) {
            logout();
          }
        })();
      }
    }, 60000); // Check every minute

    return () => clearInterval(expiryCheckInterval);
  }, []);

  /**
   * Login function
   */
  const login = async (credentials: AdminLoginRequest) => {
    try {
      const response = await apiClient.post<AdminLoginResponse>(
        '/api/v1/auth/admin/login',
        credentials
      );

      const { user: userData, access_token, refresh_token } = response.data;


      // Calculate token expiry time (expires_in is in seconds)
      const expiryTime = Date.now() + (response.data.expires_in * 1000);

      // Store tokens FIRST in sessionStorage (more secure - clears on browser/tab close)
      sessionStorage.setItem('access_token', access_token);
      sessionStorage.setItem('refresh_token', refresh_token);
      sessionStorage.setItem('user', JSON.stringify(userData));
      sessionStorage.setItem('token_expiry', expiryTime.toString());

      // Set a client-side cookie for middleware detection (session cookie)
      document.cookie = `user=${encodeURIComponent(JSON.stringify(userData))}; path=/; SameSite=Strict; Secure`;

      // Update state
      setUser(userData);


      // Wait longer to ensure everything is set
      await new Promise(resolve => setTimeout(resolve, 100));

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = handleApiError(error);
      throw new Error(errorMessage);
    }
  };

  /**
   * Logout function
   * Clears all auth data and redirects to login
   */
  const logout = async () => {
    try {
      
      // Clear state first to prevent any race conditions
      setUser(null);
      
      // Clear all session storage (more thorough than removing individual items)
      sessionStorage.clear();

      // Clear client-side cookie
      document.cookie = 'user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';

      
      // Force a hard redirect to login page (clears all state)
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
      // Force redirect even on error
      sessionStorage.clear();
      document.cookie = 'user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      window.location.href = '/';
    }
  };

  /**
   * Check if user has specific permission
   * Memoized to prevent unnecessary re-renders
   */
  const checkPermission = React.useCallback((permission: string): boolean => {
    if (!user) return false;
    return hasPermission(user.role, permission);
  }, [user]);

  const value: AuthContextType = React.useMemo(() => ({
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    checkPermission,
    isAdmin: user?.role === 'admin',
    isManager: user?.role === 'manager',
  }), [user, isLoading, login, logout, checkPermission]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Hook to use auth context
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * Hook to require authentication
 * Protects routes by redirecting unauthenticated users
 */
export const useRequireAuth = (requiredPermission?: string) => {
  const { isAuthenticated, isLoading, checkPermission, user } = useAuth();
  const router = useRouter();
  const [shouldRender, setShouldRender] = React.useState(false);
  const hasCheckedRef = React.useRef(false);

  useEffect(() => {
    // Skip if we've already completed auth check
    if (hasCheckedRef.current && shouldRender) {
      return;
    }

    // Don't do anything while still loading
    if (isLoading) {
      setShouldRender(false);
      return;
    }

    // Check if we have tokens in sessionStorage as a fallback
    const hasToken = typeof window !== 'undefined' && sessionStorage.getItem('access_token');
    
    // Only redirect if truly not authenticated (no user AND no token)
    if (!isAuthenticated && !hasToken) {
      setShouldRender(false);
      // Prevent redirect loops - only redirect once
      if (typeof window !== 'undefined' && 
          !hasCheckedRef.current && 
          window.location.pathname !== '/' && 
          window.location.pathname !== '/signin') {
        hasCheckedRef.current = true;
        window.location.href = '/';
      }
      return;
    }

    // Check permission if required
    if (requiredPermission && user && !checkPermission(requiredPermission)) {
      setShouldRender(false);
      if (typeof window !== 'undefined' && 
          !hasCheckedRef.current && 
          window.location.pathname !== '/dashboard') {
        hasCheckedRef.current = true;
        router.replace('/dashboard');
      }
      return;
    }

    // If we get here, user is authenticated
    hasCheckedRef.current = true;
    setShouldRender(true);
  }, [isAuthenticated, isLoading]); // Minimal dependencies - only primitives
  /* eslint-enable react-hooks/set-state-in-effect */

  return { isLoading: isLoading || !shouldRender };
};

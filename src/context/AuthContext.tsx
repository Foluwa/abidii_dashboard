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

  // Set the instant login() resolves, so the mount-effect's session-restore
  // check (below) can tell its own response is now stale and must not
  // apply it. Without this, a user who submits the login form quickly
  // enough races the initial (pre-login, unauthenticated) /auth/admin/me
  // check: login() correctly sets the real user, but the original check's
  // 401 can still land afterward and its `catch { setUser(null) }` silently
  // wipes that state back out - isAuthenticated flips back to false,
  // useRequireAuth hard-redirects to /signin, which remounts this provider
  // and restarts the exact same race. Reported as "signs me in and signs
  // me out automatically" / never actually landing on /dashboard.
  const authResolvedRef = React.useRef(false);

  /**
   * Restore the session on mount by asking the backend who's authenticated,
   * relying on the httpOnly access_token cookie the browser sends
   * automatically. Every tab does this independently on its own mount —
   * since the token is no longer in any JS-readable storage, this is what
   * actually makes multiple tabs work (a cookie isn't tab-scoped the way
   * sessionStorage was).
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await apiClient.get<User>('/api/v1/auth/admin/me');
        if (!cancelled && !authResolvedRef.current) {
          setUser(response.data);
        }
      } catch {
        if (!cancelled && !authResolvedRef.current) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
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

      // access_token/refresh_token are no longer in the body — the backend
      // already set them as httpOnly cookies via Set-Cookie before this
      // response resolved, and the browser attaches them automatically
      // from here on.
      authResolvedRef.current = true;
      setUser(response.data.user);

      // Hard navigation, not router.push: the access_token cookie was just
      // set via Set-Cookie on this response, and middleware.ts's
      // isAuthenticated check reads request.cookies server-side. A
      // client-side RSC push for /dashboard can race that cookie becoming
      // visible to the very next request, bouncing back to /signin -
      // window.location.href forces a full navigation that's guaranteed to
      // carry current cookies, matching what a manual URL entry does.
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = handleApiError(error);
      throw new Error(errorMessage);
    }
  };

  /**
   * Logout function
   * Revokes the session server-side (so a captured cookie stops working
   * immediately, not just on this browser) and redirects to login.
   */
  const logout = async () => {
    try {
      await apiClient.post('/api/v1/auth/admin/logout');
    } catch (error) {
      console.error('Logout error:', error);
      // Proceed with client-side logout regardless — worst case the
      // cookie's already invalid/expired, which is the state we want anyway.
    } finally {
      setUser(null);
      window.location.href = '/signin';
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

  /* eslint-disable react-hooks/set-state-in-effect --
     This effect's whole job is synchronously deciding "render or redirect"
     from auth state that just settled - there's no external system to
     subscribe to instead. */
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

    // No sessionStorage token to fall back on anymore — isAuthenticated
    // (backed by the /auth/admin/me mount-time check) is the only signal.
    if (!isAuthenticated) {
      setShouldRender(false);
      // Prevent redirect loops - only redirect once
      if (typeof window !== 'undefined' && 
          !hasCheckedRef.current && 
          window.location.pathname !== '/' && 
          window.location.pathname !== '/signin') {
        hasCheckedRef.current = true;
        window.location.href = '/signin';
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

/**
 * Authentication Types
 */

export type UserRole = 'admin' | 'manager' | 'user';

export interface User {
  id: string;
  email: string | null;
  display_name: string | null;
  role: UserRole;
  picture_url: string | null;
  avatar_config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface AdminLoginResponse {
  // access_token/refresh_token are set as httpOnly cookies, not returned here.
  token_type: string;
  expires_in: number;
  user: User;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface PasswordChangeRequest {
  current_password: string;
  new_password: string;
}

/**
 * Permission check types
 */
export interface Permission {
  resource: string;
  action: 'read' | 'create' | 'update' | 'delete';
}

/**
 * RBAC permissions map
 */
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: [
    'dashboard:read',
    'system:read',
    'system:update',
    'users:read',
    'users:create',
    'users:update',
    'users:delete',
    'content:read',
    'content:create',
    'content:update',
    'content:delete',
    'audio:read',
    'audio:create',
    'audio:update',
    'audio:delete',
    'testing:access',
  ],
  manager: [
    'dashboard:read',
    'content:read',
    'content:create',
    'content:update',
    'content:delete',
    'audio:read',
    'audio:create',
    'audio:update',
    'audio:delete',
  ],
  user: [],
};

/**
 * Check if user has permission
 */
export const hasPermission = (userRole: UserRole, permission: string): boolean => {
  return ROLE_PERMISSIONS[userRole]?.includes(permission) || false;
};

/**
 * Check if user can access route
 */
export const canAccessRoute = (userRole: UserRole, route: string): boolean => {
  // Admin has access to everything
  if (userRole === 'admin') return true;

  // Manager can only access content routes
  if (userRole === 'manager') {
    return (
      route.startsWith('/content') ||
      route === '/' // Dashboard
    );
  }

  // Regular users have no admin access
  return false;
};

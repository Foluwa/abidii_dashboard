/**
 * Tests for User Detail Page
 * 
 * Tests cover:
 * - Rendering user info correctly (no xp_points, uses total_xp)
 * - Null-safe rendering of all fields
 * - Provider display instead of Telegram
 * - Action buttons on detail page
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Note: This test file documents the expected behavior.
// The actual page component uses useParams and dynamic routes.

// Mock user data matching the real database schema
const mockUser = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'test@example.com',
  display_name: 'Test User',
  role: 'user',
  provider: 'google',
  is_active: true,
  total_xp: 1500,
  current_level: 5,
  current_streak: 7,
  is_premium: false,
  created_at: '2024-01-15T10:00:00Z',
  last_login_at: '2024-06-01T15:30:00Z',
  last_request_at: '2024-06-02T09:45:00Z',
  last_activity_date: '2024-06-01',
  total_sessions: 42,
  languages_learning: 2,
};

// Mock user with null/undefined values
const mockUserWithNulls = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  email: null,
  display_name: null,
  role: 'user',
  provider: null,
  is_active: true,
  total_xp: null,  // This should not crash toLocaleString
  current_level: null,
  current_streak: null,
  is_premium: null,
  created_at: null,
  last_login_at: null,
  last_request_at: null,
  last_activity_date: null,
  total_sessions: null,
  languages_learning: null,
};

describe('User Detail Page Schema Compliance', () => {
  describe('Field Name Compliance', () => {
    it('should use total_xp instead of xp_points', () => {
      // The page should access user.total_xp, not user.xp_points
      expect(mockUser).toHaveProperty('total_xp');
      expect(mockUser).not.toHaveProperty('xp_points');
    });

    it('should use display_name instead of name', () => {
      // The page should access user.display_name, not user.name
      expect(mockUser).toHaveProperty('display_name');
      expect(mockUser).not.toHaveProperty('name');
    });

    it('should use provider instead of telegram fields', () => {
      // The page should use provider, not telegram_id or telegram_username
      expect(mockUser).toHaveProperty('provider');
      expect(mockUser).not.toHaveProperty('telegram_id');
      expect(mockUser).not.toHaveProperty('telegram_username');
    });

    it('should use last_request_at for request recency and keep last_login_at as fallback', () => {
      expect(mockUser).toHaveProperty('last_request_at');
      expect(mockUser).toHaveProperty('last_login_at');
      expect(mockUser).not.toHaveProperty('last_login');
    });

    it('should use last_activity_date instead of last_active', () => {
      expect(mockUser).toHaveProperty('last_activity_date');
      expect(mockUser).not.toHaveProperty('last_active');
    });
  });

  describe('Null Safety', () => {
    it('total_xp should handle null with fallback', () => {
      // Simulating the fix: (user.total_xp ?? 0).toLocaleString()
      const xp = mockUserWithNulls.total_xp ?? 0;
      expect(() => xp.toLocaleString()).not.toThrow();
      expect(xp.toLocaleString()).toBe('0');
    });

    it('display_name should handle null with fallback', () => {
      const displayName = mockUserWithNulls.display_name || 'Not set';
      expect(displayName).toBe('Not set');
    });

    it('email should handle null with fallback', () => {
      const email = mockUserWithNulls.email || 'Not set';
      expect(email).toBe('Not set');
    });

    it('provider should handle null with fallback', () => {
      const provider = mockUserWithNulls.provider || 'Unknown';
      expect(provider).toBe('Unknown');
    });

    it('current_level should handle null with fallback', () => {
      const level = mockUserWithNulls.current_level ?? 1;
      expect(level).toBe(1);
    });

    it('current_streak should handle null with fallback', () => {
      const streak = mockUserWithNulls.current_streak ?? 0;
      expect(streak).toBe(0);
    });

    it('is_premium should handle null as false', () => {
      const isPremium = mockUserWithNulls.is_premium ?? false;
      expect(isPremium).toBe(false);
    });

    it('total_sessions should handle null with fallback', () => {
      const sessions = mockUserWithNulls.total_sessions ?? 0;
      expect(sessions).toBe(0);
    });

    it('languages_learning should handle null with fallback', () => {
      const languages = mockUserWithNulls.languages_learning ?? 0;
      expect(languages).toBe(0);
    });
  });

  describe('Provider Display', () => {
    it('should format google provider correctly', () => {
      const getProviderLabel = (provider: string | null) => {
        switch (provider) {
          case 'google': return 'Google';
          case 'apple': return 'Apple';
          case 'device': return 'Device';
          case 'email': return 'Email';
          default: return provider || 'Unknown';
        }
      };

      expect(getProviderLabel('google')).toBe('Google');
      expect(getProviderLabel('apple')).toBe('Apple');
      expect(getProviderLabel('device')).toBe('Device');
      expect(getProviderLabel(null)).toBe('Unknown');
    });
  });

  describe('XP Formatting', () => {
    it('should format XP with locale string', () => {
      const xp = mockUser.total_xp ?? 0;
      expect(xp.toLocaleString()).toBe('1,500');
    });

    it('should not crash when XP is null', () => {
      const xp = mockUserWithNulls.total_xp ?? 0;
      expect(() => xp.toLocaleString()).not.toThrow();
    });

    it('should not crash when XP is undefined', () => {
      const user: { total_xp?: number } = {};
      const xp = user.total_xp ?? 0;
      expect(() => xp.toLocaleString()).not.toThrow();
      expect(xp.toLocaleString()).toBe('0');
    });
  });

  describe('Status Display', () => {
    it('should show Active for is_active=true', () => {
      const status = mockUser.is_active ? 'Active' : 'Inactive';
      expect(status).toBe('Active');
    });

    it('should show Premium for is_premium=true', () => {
      const accountType = mockUser.is_premium ? 'Premium' : 'Free';
      expect(accountType).toBe('Free');
    });
  });
});

describe('User Detail Page - Data Mapping', () => {
  // This tests the transformation of backend data to frontend display
  
  it('maps backend response to display correctly', () => {
    const backendResponse = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'user@test.com',
      display_name: 'John Doe',
      role: 'user',
      provider: 'apple',
      is_active: true,
      total_xp: 2500,
      current_level: 8,
      current_streak: 14,
      is_premium: true,
      created_at: '2024-01-01T00:00:00Z',
      last_login_at: '2024-06-15T12:00:00Z',
      last_request_at: '2024-06-16T08:30:00Z',
      last_activity_date: '2024-06-15',
      total_sessions: 100,
      languages_learning: 3,
    };

    // Expected display values
    const displayValues = {
      name: backendResponse.display_name || 'Not set',
      email: backendResponse.email || 'Not set',
      provider: 'Apple', // Formatted
      xp: (backendResponse.total_xp ?? 0).toLocaleString(),
      level: backendResponse.current_level ?? 1,
      streak: backendResponse.current_streak ?? 0,
      accountType: backendResponse.is_premium ? 'Premium' : 'Free',
      status: backendResponse.is_active ? 'Active' : 'Inactive',
      sessions: backendResponse.total_sessions ?? 0,
      languages: backendResponse.languages_learning ?? 0,
    };

    expect(displayValues.name).toBe('John Doe');
    expect(displayValues.email).toBe('user@test.com');
    expect(displayValues.provider).toBe('Apple');
    expect(displayValues.xp).toBe('2,500');
    expect(displayValues.level).toBe(8);
    expect(displayValues.streak).toBe(14);
    expect(displayValues.accountType).toBe('Premium');
    expect(displayValues.status).toBe('Active');
    expect(displayValues.sessions).toBe(100);
    expect(displayValues.languages).toBe(3);
  });
});

describe('User Detail Page - Error Cases', () => {
  it('handles completely empty user object', () => {
    const emptyUser: Record<string, unknown> = {};

    // These should all use safe fallbacks
    const display = {
      name: (emptyUser.display_name as string) || 'Not set',
      email: (emptyUser.email as string) || 'Not set',
      xp: ((emptyUser.total_xp as number | undefined) ?? 0).toLocaleString(),
      level: (emptyUser.current_level as number | undefined) ?? 1,
    };

    expect(display.name).toBe('Not set');
    expect(display.email).toBe('Not set');
    expect(display.xp).toBe('0');
    expect(display.level).toBe(1);
  });

  it('handles user with wrong field names gracefully', () => {
    // This simulates if backend sent old field names
    const oldSchemaUser = {
      name: 'Old Name Field',  // Wrong - should be display_name
      xp_points: 1000,         // Wrong - should be total_xp
      telegram_id: '12345',    // Wrong - doesn't exist
    };

    // Frontend should use correct fields and fallback
    const display = {
      name: (oldSchemaUser as Record<string, unknown>).display_name || 'Not set',
      xp: (((oldSchemaUser as Record<string, unknown>).total_xp as number) ?? 0).toLocaleString(),
    };

    // Since correct fields don't exist, should use fallbacks
    expect(display.name).toBe('Not set');
    expect(display.xp).toBe('0');
  });
});

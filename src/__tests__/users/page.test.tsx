/**
 * Tests for Users List Page
 * 
 * Tests cover:
 * - Rendering users table with correct columns
 * - Filter functionality (status, provider, XP range)
 * - Action buttons (deactivate, reactivate, delete)
 * - Confirmation modal behavior
 * - Pagination
 */

import React from 'react';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UsersPage from '@/app/(admin)/(others-pages)/users/page';

import { renderWithProviders as render } from '@/test-utils';

// Mock the useUsers hook
const mockRefresh = jest.fn();
const mockUseUsers = jest.fn();

jest.mock('@/hooks/useApi', () => ({
  useUsers: (filters: unknown) => mockUseUsers(filters),
  useLanguages: () => ({ languages: [{ iso_639_3: 'yor', name: 'Yoruba' }] }),
  useUserCountries: () => ({
    countries: [{ country_code: 'NG', count: 2 }],
    isLoading: false,
    isError: false,
  }),
}));

jest.mock('@/lib/api', () => ({
  apiClient: {
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockApiClient = jest.requireMock('@/lib/api').apiClient as {
  post: jest.Mock;
  delete: jest.Mock;
};

// Sample user data
const sampleUsers = {
  total: 3,
  limit: 20,
  offset: 0,
  users: [
    {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'user1@test.com',
      display_name: 'User One',
      role: 'user',
      provider: 'google',
      is_active: true,
      total_xp: 1000,
      proficiency_level: 'basic',
      ui_locale: 'yo',
      ui_locale_name: 'Yorùbá',
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      email: 'user2@test.com',
      display_name: 'User Two',
      role: 'user',
      provider: 'apple',
      is_active: false,
      total_xp: 500,
      proficiency_level: null,
      ui_locale: null,
      ui_locale_name: null,
    },
    {
      id: '00000000-0000-0000-0000-000000000003',
      email: 'admin@test.com',
      display_name: 'Admin User',
      role: 'admin',
      provider: 'device',
      is_active: true,
      total_xp: 5000,
      proficiency_level: 'fluent',
    },
  ],
};

describe('UsersPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUsers.mockReturnValue({
      users: sampleUsers,
      isLoading: false,
      isError: false,
      refresh: mockRefresh,
    });
  });

  describe('Table Rendering', () => {
    it('renders users table with correct columns', () => {
      render(<UsersPage />);

      const table = screen.getByRole('table');
      const tableQueries = within(table);

      // Check column headers
      expect(tableQueries.getByText('User', { selector: 'th' })).toBeInTheDocument();
      expect(tableQueries.getByText('Device', { selector: 'th' })).toBeInTheDocument();
      expect(tableQueries.getByText('Learning', { selector: 'th' })).toBeInTheDocument();
      expect(tableQueries.getByText('Language', { selector: 'th' })).toBeInTheDocument();
      expect(tableQueries.getByText('Last Request', { selector: 'th' })).toBeInTheDocument();
      expect(tableQueries.queryByText('XP', { selector: 'th' })).not.toBeInTheDocument();
      expect(tableQueries.queryByText('Role', { selector: 'th' })).not.toBeInTheDocument();
      expect(tableQueries.getByText('Status', { selector: 'th' })).toBeInTheDocument();
      expect(tableQueries.getByText('Actions', { selector: 'th' })).toBeInTheDocument();

      // Should NOT have Telegram column
      expect(tableQueries.queryByText('Telegram')).not.toBeInTheDocument();
    });

    it('renders user data correctly', () => {
      render(<UsersPage />);

      // Check user names
      expect(screen.getByText('User One')).toBeInTheDocument();
      expect(screen.getByText('User Two')).toBeInTheDocument();
      expect(screen.getByText('Admin User')).toBeInTheDocument();

      // Check XP values (formatted with toLocaleString)
      expect(screen.getByText('1,000 XP')).toBeInTheDocument();
      expect(screen.getByText('500 XP')).toBeInTheDocument();
      expect(screen.getByText('5,000 XP')).toBeInTheDocument();
    });

    it('shows provider badges', () => {
      render(<UsersPage />);

      const table = screen.getByRole('table');
      const tableQueries = within(table);

      expect(tableQueries.getByText('Google')).toBeInTheDocument();
      expect(tableQueries.getByText('Apple')).toBeInTheDocument();
      // Avoid collision with the "Device" column header
      expect(tableQueries.getByText('Device', { selector: 'span' })).toBeInTheDocument();
    });

    it('shows status badges correctly', () => {
      render(<UsersPage />);

      const table = screen.getByRole('table');
      const tableQueries = within(table);

      // Active users should show "Active" badge
      const activeBadges = tableQueries.getAllByText('Active');
      expect(activeBadges.length).toBe(2);

      // Inactive user should show "Inactive" badge
      expect(tableQueries.getByText('Inactive')).toBeInTheDocument();
    });

    it('shows loading spinner when loading', () => {
      mockUseUsers.mockReturnValue({
        users: null,
        isLoading: true,
        isError: false,
        refresh: mockRefresh,
      });

      render(<UsersPage />);

      // Should show loading spinner
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('shows error message on error', () => {
      mockUseUsers.mockReturnValue({
        users: null,
        isLoading: false,
        isError: true,
        refresh: mockRefresh,
      });

      render(<UsersPage />);

      expect(screen.getByText(/failed to load users/i)).toBeInTheDocument();
    });

    it('shows the App Language label for a user with a known ui_locale', () => {
      render(<UsersPage />);
      const table = screen.getByRole('table');
      expect(within(table).getByText('Yorùbá')).toBeInTheDocument();
    });

    it('shows Unknown (not English) for a user with no ui_locale', () => {
      render(<UsersPage />);
      // User Two has ui_locale: null - must read "Unknown", never default to
      // English (abidii_app_language.md: null means not-yet-synced).
      const table = screen.getByRole('table');
      expect(within(table).getAllByText('Unknown').length).toBeGreaterThan(0);
    });

    it('shows empty state when no users', () => {
      mockUseUsers.mockReturnValue({
        users: { total: 0, users: [] },
        isLoading: false,
        isError: false,
        refresh: mockRefresh,
      });

      render(<UsersPage />);

      expect(screen.getByText('No users found')).toBeInTheDocument();
    });
  });

  describe('Filters', () => {
    it('filters are passed to useUsers hook', async () => {
      render(<UsersPage />);

      // Change status filter
      const statusLabel = screen.getByText('Status', { selector: 'label' });
      const statusSelect = statusLabel.parentElement?.querySelector('select');
      expect(statusSelect).toBeTruthy();
      if (!(statusSelect instanceof HTMLSelectElement)) {
        throw new Error('Status select not found');
      }
      await userEvent.selectOptions(statusSelect, 'active');

      // Check that useUsers was called with the filter
      expect(mockUseUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: true,
        })
      );
    });

    it('provider filter works', async () => {
      render(<UsersPage />);

      const providerLabel = screen.getByText('Provider', { selector: 'label' });
      const providerSelect = providerLabel.parentElement?.querySelector('select');
      expect(providerSelect).toBeTruthy();
      if (!(providerSelect instanceof HTMLSelectElement)) {
        throw new Error('Provider select not found');
      }
      await userEvent.selectOptions(providerSelect, 'google');

      expect(mockUseUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'google',
        })
      );
    });

    it('app language filter works independently of the learning language filter', async () => {
      render(<UsersPage />);

      const languageLabel = screen.getByText('Language', { selector: 'label' });
      const languageSelect = languageLabel.parentElement?.querySelector('select');
      if (!(languageSelect instanceof HTMLSelectElement)) {
        throw new Error('Language select not found');
      }
      await userEvent.selectOptions(languageSelect, 'yor');

      const appLanguageLabel = screen.getByText('App Language', { selector: 'label' });
      const appLanguageSelect = appLanguageLabel.parentElement?.querySelector('select');
      if (!(appLanguageSelect instanceof HTMLSelectElement)) {
        throw new Error('App Language select not found');
      }
      await userEvent.selectOptions(appLanguageSelect, 'pt');

      // Both filters must be usable together - learning Yoruba, app in
      // Portuguese - see abidii_app_language.md §6.4.
      expect(mockUseUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({
          language_code: 'yor',
          ui_locale: 'pt',
        })
      );
    });

    it('search filter works', async () => {
      render(<UsersPage />);

      const searchInput = screen.getByPlaceholderText(/search by name/i);
      await userEvent.type(searchInput, 'test@email.com');

      // Search is debounced (300ms) so the hook doesn't get the raw
      // keystrokes; wait for the debounced value to propagate.
      await waitFor(
        () =>
          expect(mockUseUsers).toHaveBeenCalledWith(
            expect.objectContaining({
              search: 'test@email.com',
            })
          ),
        { timeout: 1000 }
      );
    });

    it('clear filters button resets all filters', async () => {
      render(<UsersPage />);

      // Set the App Language filter alongside the advanced filters.
      const appLanguageLabel = screen.getByText('App Language', { selector: 'label' });
      const appLanguageSelect = appLanguageLabel.parentElement?.querySelector('select');
      if (!(appLanguageSelect instanceof HTMLSelectElement)) {
        throw new Error('App Language select not found');
      }
      await userEvent.selectOptions(appLanguageSelect, 'yo');

      // Show advanced filters
      const moreFiltersBtn = screen.getByText('More Filters');
      await userEvent.click(moreFiltersBtn);

      // Enter some filter values
      const minXpInput = screen.getByPlaceholderText('0');
      await userEvent.type(minXpInput, '100');

      // Click clear all
      const clearBtn = screen.getByText('Clear All Filters');
      await userEvent.click(clearBtn);

      // Check that filters are reset
      expect(mockUseUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({
          search: '',
          is_active: undefined,
          provider: undefined,
          ui_locale: undefined,
          min_xp: undefined,
          max_xp: undefined,
        })
      );
    });
  });

  describe('User Actions', () => {
    it('shows deactivate button for active users', () => {
      render(<UsersPage />);

      const deactivateButtons = screen.getAllByRole('button', { name: /Deactivate .*user/i });
      expect(deactivateButtons.length).toBe(2); // Two active users
    });

    it('shows reactivate button for inactive users', () => {
      render(<UsersPage />);

      expect(screen.getByRole('button', { name: /Reactivate User Two/i })).toBeInTheDocument();
    });

    it('opens confirmation modal on action click', async () => {
      render(<UsersPage />);

      const deactivateBtn = screen.getAllByRole('button', { name: /Deactivate .*user/i })[0];
      await userEvent.click(deactivateBtn);

      // Modal should appear
      expect(screen.getByText('Confirm Deactivate')).toBeInTheDocument();
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });

    it('calls API and refreshes on confirm action', async () => {
      mockApiClient.post.mockResolvedValue({ data: { success: true } });

      render(<UsersPage />);

      // Click deactivate
      const deactivateBtn = screen.getAllByRole('button', { name: /Deactivate .*user/i })[0];
      await userEvent.click(deactivateBtn);

      // Confirm in modal
      const confirmBtn = screen.getByText('Yes, deactivate');
      await userEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith('/api/v1/admin/users/00000000-0000-0000-0000-000000000001/deactivate');
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    it('closes modal on cancel', async () => {
      render(<UsersPage />);

      // Open modal
      const deactivateBtn = screen.getAllByRole('button', { name: /Deactivate .*user/i })[0];
      await userEvent.click(deactivateBtn);

      expect(screen.getByText('Confirm Deactivate')).toBeInTheDocument();

      // Click cancel
      const cancelBtn = screen.getByText('Cancel');
      await userEvent.click(cancelBtn);

      // Modal should close
      expect(screen.queryByText('Confirm Deactivate')).not.toBeInTheDocument();
    });

    it('shows error message on API failure', async () => {
      mockApiClient.post.mockRejectedValue({
        response: { data: { detail: 'Operation failed' } },
      });

      render(<UsersPage />);

      const deactivateBtn = screen.getAllByRole('button', { name: /Deactivate .*user/i })[0];
      await userEvent.click(deactivateBtn);

      const confirmBtn = screen.getByText('Yes, deactivate');
      await userEvent.click(confirmBtn);

      await waitFor(() => {
        expect(screen.getByText(/operation failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Pagination', () => {
    it('shows pagination when total exceeds limit', () => {
      mockUseUsers.mockReturnValue({
        users: { ...sampleUsers, total: 50 },
        isLoading: false,
        isError: false,
        refresh: mockRefresh,
      });

      render(<UsersPage />);

      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();

      // Should show numbered page buttons
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    });

    it('disables previous button on first page', () => {
      mockUseUsers.mockReturnValue({
        users: { ...sampleUsers, total: 50 },
        isLoading: false,
        isError: false,
        refresh: mockRefresh,
      });

      render(<UsersPage />);

      const prevBtn = screen.getByText('Previous');
      expect(prevBtn).toBeDisabled();
    });

    it('pagination changes page in hook call', async () => {
      mockUseUsers.mockReturnValue({
        users: { ...sampleUsers, total: 50 },
        isLoading: false,
        isError: false,
        refresh: mockRefresh,
      });

      render(<UsersPage />);

      const page2Btn = screen.getByRole('button', { name: '2' });
      await userEvent.click(page2Btn);

      expect(mockUseUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
        })
      );
    });
  });

  describe('Role Tabs', () => {
    it('shows role tabs', () => {
      render(<UsersPage />);

      expect(screen.getByText('All Users')).toBeInTheDocument();
      expect(screen.getByText('Admins')).toBeInTheDocument();
      expect(screen.getByText('Managers')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Users' })).toBeInTheDocument();
    });

    it('clicking tab changes role filter', async () => {
      render(<UsersPage />);

      const adminsTab = screen.getByText('Admins');
      await userEvent.click(adminsTab);

      expect(mockUseUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'admin',
        })
      );
    });
  });
});

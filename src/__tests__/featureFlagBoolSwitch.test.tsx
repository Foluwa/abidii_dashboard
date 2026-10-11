import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PlatformConfigContent } from '@/components/system/PlatformConfigContent';
import { renderWithProviders as render } from '@/test-utils';

const mockRefresh = jest.fn();
const mockPut = jest.fn();
let mockConfig: unknown[] = [];

jest.mock('@/hooks/useApi', () => ({
  useConfig: () => ({ config: mockConfig, isLoading: false, isError: null, refresh: mockRefresh }),
}));

jest.mock('@/lib/api', () => ({
  apiClient: {
    put: (...args: unknown[]) => mockPut(...args),
    patch: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

const cowries = (on: boolean) => ({
  key: 'rewards.cowries_enabled',
  value_type: 'boolean',
  value_bool: on,
  description: 'Shows/hides cowries in the app',
  category: 'mobile',
  is_active: true,
});

describe('Feature Flags one-click boolean switch', () => {
  beforeEach(() => {
    mockPut.mockReset().mockResolvedValue({ data: {} });
    mockRefresh.mockReset();
  });

  it('turns an off flag on after confirming', async () => {
    mockConfig = [cowries(false)];
    render(<PlatformConfigContent showHeader={false} />);

    const sw = screen.getByTestId('bool-switch-rewards.cowries_enabled');
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(sw);
    // Confirm in the shared confirmation dialog
    await userEvent.click(await screen.findByRole('button', { name: 'Turn On' }));

    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith('/api/v1/admin/configs/rewards.cowries_enabled', { value_bool: true }),
    );
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('does nothing when the confirmation is cancelled', async () => {
    mockConfig = [cowries(true)];
    render(<PlatformConfigContent showHeader={false} />);

    await userEvent.click(screen.getByTestId('bool-switch-rewards.cowries_enabled'));
    const dialog = await screen.findByRole('dialog', { name: 'Turn Flag Off' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mockPut).not.toHaveBeenCalled();
  });
});

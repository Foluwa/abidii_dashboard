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

const defaultView = (value: string) => ({
  key: 'learning_path.default_view',
  value_type: 'string',
  value_text: value,
  description: 'Which learning-path view Home opens on',
  category: 'mobile',
  is_active: true,
});

const mapEnabled = {
  key: 'learning_path.map_enabled',
  value_type: 'boolean',
  value_bool: true,
  description: 'Shows the Map view',
  category: 'mobile',
  is_active: true,
};

describe('Learning-path view settings', () => {
  beforeEach(() => {
    mockPut.mockReset().mockResolvedValue({ data: {} });
    mockRefresh.mockReset();
  });

  it('shows the default view as list/map choices with the current one selected', () => {
    mockConfig = [defaultView('list'), mapEnabled];
    render(<PlatformConfigContent showHeader={false} />);

    const group = screen.getByRole('radiogroup', { name: 'learning_path.default_view' });
    expect(within(group).getByRole('radio', { name: 'list' })).toHaveAttribute('aria-checked', 'true');
    expect(within(group).getByRole('radio', { name: 'map' })).toHaveAttribute('aria-checked', 'false');
    // The map switch is the usual one-click boolean.
    expect(screen.getByTestId('bool-switch-learning_path.map_enabled')).toHaveAttribute('aria-checked', 'true');
  });

  it('switches the default to map after confirming', async () => {
    mockConfig = [defaultView('list')];
    render(<PlatformConfigContent showHeader={false} />);

    await userEvent.click(screen.getByTestId('choice-learning_path.default_view-map'));
    await userEvent.click(await screen.findByRole('button', { name: 'Change' }));

    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith('/api/v1/admin/configs/learning_path.default_view', { value_text: 'map' }),
    );
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('clicking the selected choice does nothing', async () => {
    mockConfig = [defaultView('map')];
    render(<PlatformConfigContent showHeader={false} />);

    await userEvent.click(screen.getByTestId('choice-learning_path.default_view-map'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockPut).not.toHaveBeenCalled();
  });
});

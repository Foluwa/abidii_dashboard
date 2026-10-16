import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
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

const KEY = 'recommendations.mapping';
const mapping = {
  key: KEY,
  value_type: 'json',
  value_json: { enabled: true, max_cards: 3 },
  description: 'Recommended for you',
  category: 'mobile',
  is_active: true,
};

describe('JSON settings (e.g. recommendations.mapping)', () => {
  beforeEach(() => {
    mockPut.mockReset().mockResolvedValue({ data: {} });
    mockRefresh.mockReset();
    mockConfig = [mapping];
  });

  it('shows the stored JSON', () => {
    render(<PlatformConfigContent showHeader={false} />);
    expect(screen.getByText(/"max_cards": 3/)).toBeInTheDocument();
  });

  it('edits and saves the value as parsed JSON', async () => {
    render(<PlatformConfigContent showHeader={false} />);
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const editor = screen.getByTestId(`json-editor-${KEY}`) as HTMLTextAreaElement;
    expect(JSON.parse(editor.value)).toEqual({ enabled: true, max_cards: 3 });

    fireEvent.change(editor, { target: { value: '{"enabled": false, "max_cards": 2}' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith(`/api/v1/admin/configs/${KEY}`, {
        description: 'Recommended for you',
        value_json: { enabled: false, max_cards: 2 },
      }),
    );
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('refuses text that is not JSON and keeps the editor open', async () => {
    render(<PlatformConfigContent showHeader={false} />);
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByTestId(`json-editor-${KEY}`), { target: { value: '{"enabled": tru' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/is not valid JSON/)).toBeInTheDocument();
    expect(mockPut).not.toHaveBeenCalled();
    expect(screen.getByTestId(`json-editor-${KEY}`)).toBeInTheDocument();
  });
});

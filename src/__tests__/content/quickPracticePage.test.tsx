import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import QuickPracticePage from '@/app/(admin)/(others-pages)/content/quick-practice/page';
import { renderWithProviders as render } from '@/test-utils';

const mockGet = jest.fn();
const mockPut = jest.fn();
const mockPost = jest.fn();
const mockDelete = jest.fn();

jest.mock('@/lib/api', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockGet(...a),
    put: (...a: unknown[]) => mockPut(...a),
    post: (...a: unknown[]) => mockPost(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
}));

const row = (item_id: string, sort_order: number, extra: Record<string, unknown> = {}) => ({
  id: `uuid-${item_id}`,
  item_id,
  title: item_id,
  subtitle: '',
  icon: 'style',
  sort_order,
  enabled: true,
  ...extra,
});

const ITEMS = [
  row('alphabet', 0, { icon: 'abc' }),
  row('dictionary', 3, { icon: 'book' }),
  row('time_blitz', 3, { icon: 'timer' }),
  row('ask_abidii', 10, { icon: 'smart_toy', enabled: false }),
];

describe('QuickPracticePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({ data: { items: ITEMS } });
    mockPut.mockResolvedValue({ data: {} });
    mockPost.mockResolvedValue({ data: { success: true } });
    mockDelete.mockResolvedValue({ data: { success: true } });
  });

  it('shows clean 1..n positions, icons and status pills', async () => {
    render(<QuickPracticePage />);
    await screen.findByTestId('qp-row-alphabet');
    expect(screen.getAllByTestId('qp-position').map((e) => e.textContent)).toEqual(['1', '2', '3', '4']);
    expect(screen.getByRole('img', { name: 'Icon: smart_toy' })).toBeInTheDocument();
    expect(within(screen.getByTestId('qp-row-ask_abidii')).getByText('Disabled')).toBeInTheDocument();
    expect(within(screen.getByTestId('qp-row-alphabet')).getByText('Enabled')).toBeInTheDocument();
    // Edge arrows are disabled.
    expect(screen.getByRole('button', { name: 'Move alphabet up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move ask_abidii down' })).toBeDisabled();
  });

  it('renumbers duplicate sort_orders before moving', async () => {
    const user = userEvent.setup();
    render(<QuickPracticePage />);
    await screen.findByTestId('qp-row-time_blitz');

    await user.click(screen.getByRole('button', { name: 'Move time_blitz up' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    const renumbered = mockPut.mock.calls.map(([, body]) => [body.item_id, body.sort_order]);
    expect(renumbered).toEqual([
      ['dictionary', 1],
      ['time_blitz', 2],
      ['ask_abidii', 3],
    ]);
    expect(mockPost).toHaveBeenCalledWith('/api/v1/admin/quick-practice/reorder', {
      item_id: 'time_blitz',
      direction: -1,
    });
    // Renumbering happens before the reorder call.
    expect(mockPut.mock.invocationCallOrder[2]).toBeLessThan(mockPost.mock.invocationCallOrder[0]);
  });

  it('confirms delete with the danger dialog', async () => {
    const user = userEvent.setup();
    render(<QuickPracticePage />);
    await screen.findByTestId('qp-row-dictionary');

    await user.click(screen.getByRole('button', { name: 'Delete dictionary' }));
    const dialog = await screen.findByRole('dialog');
    expect(mockDelete).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(mockDelete).toHaveBeenCalledWith('/api/v1/admin/quick-practice/dictionary'),
    );
  });

  it('asks before disabling a live item but not before enabling', async () => {
    const user = userEvent.setup();
    render(<QuickPracticePage />);
    await screen.findByTestId('qp-row-ask_abidii');

    await user.click(screen.getByRole('switch', { name: 'ask_abidii: disabled' }));
    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith(
        '/api/v1/admin/quick-practice/ask_abidii',
        expect.objectContaining({ enabled: true }),
      ),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    mockPut.mockClear();
    await user.click(screen.getByRole('switch', { name: 'alphabet: enabled' }));
    const dialog = await screen.findByRole('dialog');
    expect(mockPut).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Disable' }));
    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith(
        '/api/v1/admin/quick-practice/alphabet',
        expect.objectContaining({ enabled: false }),
      ),
    );
  });
});

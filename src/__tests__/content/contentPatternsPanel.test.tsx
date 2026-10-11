import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ContentPatternsPanel, sortPatterns } from '@/components/content/ContentPatternsPanel';
import { renderWithProviders as render } from '@/test-utils';

const mockGet = jest.fn();
const mockDelete = jest.fn();

jest.mock('@/lib/api', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockGet(...a),
    put: jest.fn(),
    post: jest.fn(),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
}));

jest.mock('@/hooks/useApi', () => ({
  useAdminLanguages: () => ({ languages: [{ id: 'yor-id', name: 'Yoruba', iso_639_3: 'yor' }] }),
}));

const pattern = (pattern_key: string, sort_order: number, difficulty: number) => ({
  id: `id-${pattern_key}`,
  language_id: 'yor-id',
  pattern_key,
  title: pattern_key,
  subtitle: null,
  description: null,
  difficulty,
  category: 'number_formation',
  sort_order,
  config: {},
  created_at: '',
  updated_at: '',
});

describe('ContentPatternsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({
      data: [pattern('VIGESIMAL_SCORES', 4, 3), pattern('SUBTRACTIVE_15_19', 3, 3), pattern('BASE_UNITS_1_10', 1, 1)],
    });
    mockDelete.mockResolvedValue({});
  });

  it('sorts by sort_order then key', () => {
    expect(sortPatterns([pattern('B', 2, 1), pattern('A', 2, 1), pattern('C', 1, 1)]).map((p) => p.pattern_key)).toEqual([
      'C', 'A', 'B',
    ]);
  });

  it('loads via the admin endpoint for the selected language and shows positions + labelled difficulty', async () => {
    const user = userEvent.setup();
    render(<ContentPatternsPanel languageId="yor-id" />);
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith('/api/v1/admin/patterns', { params: { language_id: 'yor-id' } }),
    );
    expect(await screen.findByText('(3)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Formation patterns/ }));
    expect(screen.getAllByTestId('pattern-position').map((e) => e.textContent)).toEqual(['1', '2', '3']);
    // Two patterns share difficulty 3 - shown as a labelled pill, not a bare number badge.
    expect(screen.getAllByText('Difficulty 3')).toHaveLength(2);
  });

  it('deletes only after the danger confirmation', async () => {
    const user = userEvent.setup();
    render(<ContentPatternsPanel languageId="yor-id" />);
    await user.click(await screen.findByRole('button', { name: /Formation patterns/ }));
    await user.click(await screen.findByRole('button', { name: 'Delete BASE_UNITS_1_10' }));
    const dialog = await screen.findByRole('dialog');
    expect(mockDelete).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/api/v1/admin/patterns/id-BASE_UNITS_1_10'));
  });
});

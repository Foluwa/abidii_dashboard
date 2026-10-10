import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ContentSafetyContent } from '@/components/content/ContentSafetyContent';
import { WordSafetyDialog } from '@/components/content/WordSafetyDialog';
import WordsDataTable from '@/components/tables/WordsDataTable';
import { chooseOption, renderWithProviders as render } from '@/test-utils';

const mockSetWordSensitivity = jest.fn();
const mockStartClassification = jest.fn();
let mockIsAdmin = true;

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAdmin: mockIsAdmin, isManager: !mockIsAdmin }),
}));

jest.mock('@/lib/contentSafetyApi', () => {
  const actual = jest.requireActual('@/lib/contentSafetyApi');
  return {
    ...actual,
    setWordSensitivity: (...args: unknown[]) => mockSetWordSensitivity(...args),
    startClassification: (...args: unknown[]) => mockStartClassification(...args),
  };
});

jest.mock('@/hooks/useDebounce', () => ({ useDebounce: <T,>(v: T) => v }));

const mockSearch = jest.fn();
const mockRefresh = jest.fn();
jest.mock('@/hooks/useApi', () => ({
  useContentSafetySummary: () => ({
    data: { total: 10, checked: 8, unchecked: 2, flagged: 1, by_category: {}, classification_running: false },
    refresh: mockRefresh,
  }),
  useFlaggedWords: () => ({
    data: {
      items: [{ id: 'l-hate', lemma: 'slur', meanings: 'slur', category: 'hate', reason: 'slur', source: 'openai', checked_at: null }],
      total: 1, page: 1, limit: 50,
    },
    isLoading: false, isError: false, refresh: mockRefresh,
  }),
  useContentSafetySearch: (f: { q: string }) => mockSearch(f),
}));

const penis = {
  id: 'lemma-penis', lemma: 'penis', pos: 'noun', yoruba: ['okó'], meanings: 'penis',
  is_sensitive: false, category: null, reason: null, source: 'openai', checked_at: '2026-10-01T00:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAdmin = true;
  mockSearch.mockImplementation((f: { q: string }) => ({
    data: f.q.trim() ? { items: [penis], total: 1, page: 1, limit: 25 } : undefined,
    isLoading: false, isError: false, refresh: mockRefresh,
  }));
  mockSetWordSensitivity.mockResolvedValue({ id: 'lemma-penis', is_sensitive: true, category: 'sexual', reason: null, source: 'admin' });
  mockStartClassification.mockResolvedValue({ started: true });
});

describe('WordSafetyDialog', () => {
  it('needs a category, then hides the word with the chosen category and reason', async () => {
    const user = userEvent.setup();
    const onSaved = jest.fn();
    const onClose = jest.fn();
    render(
      <WordSafetyDialog
        word={{ id: 'lemma-penis', lemma: 'penis', yoruba: 'okó', is_sensitive: false }}
        onClose={onClose}
        onSaved={onSaved}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Hide from learners' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose why');
    expect(mockSetWordSensitivity).not.toHaveBeenCalled();

    await chooseOption(user, screen.getByRole('combobox', { name: 'Category' }), 'sexual');
    await user.type(screen.getByLabelText(/Reason/), 'explicit anatomical term');
    await user.click(screen.getByRole('button', { name: 'Hide from learners' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mockSetWordSensitivity).toHaveBeenCalledWith('lemma-penis', {
      is_sensitive: true, category: 'sexual', reason: 'explicit anatomical term',
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('unhides a hidden word', async () => {
    const user = userEvent.setup();
    render(
      <WordSafetyDialog
        word={{ id: 'lemma-penis', lemma: 'penis', is_sensitive: true, category: 'sexual', reason: 'genitals', source: 'admin' }}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByTestId('hidden-badge')).toHaveTextContent('Sexual');
    await user.click(screen.getByRole('button', { name: 'Unhide' }));
    await waitFor(() => expect(mockSetWordSensitivity).toHaveBeenCalledWith('lemma-penis', { is_sensitive: false }));
  });
});

describe('Content Safety page', () => {
  it('lets an admin find any word by its Yoruba spelling without tones and hide it', async () => {
    const user = userEvent.setup();
    render(<ContentSafetyContent />);

    await user.type(screen.getByLabelText('Search words'), 'oko');
    expect(mockSearch).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'oko', status: 'all' }));

    const row = screen.getByTestId('search-row-lemma-penis');
    expect(within(row).getByText('okó')).toBeInTheDocument();
    expect(within(row).getByText('Visible')).toBeInTheDocument();
    await user.click(within(row).getByRole('button', { name: 'Hide' }));

    const dialog = screen.getByTestId('word-safety-dialog');
    await chooseOption(user, within(dialog).getByRole('combobox', { name: 'Category' }), 'sexual');
    await user.click(within(dialog).getByRole('button', { name: 'Hide from learners' }));
    await waitFor(() =>
      expect(mockSetWordSensitivity).toHaveBeenCalledWith('lemma-penis', { is_sensitive: true, category: 'sexual', reason: null }),
    );
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('shows managers the status but no hide/unhide or run controls', async () => {
    mockIsAdmin = false;
    const user = userEvent.setup();
    render(<ContentSafetyContent />);
    await user.type(screen.getByLabelText('Search words'), 'oko');

    expect(screen.getByTestId('search-row-lemma-penis')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hide' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unhide' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Re-check/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Classify/ })).not.toBeInTheDocument();
  });

  it('re-checks AI-cleared words after confirmation', async () => {
    const user = userEvent.setup();
    render(<ContentSafetyContent />);
    await user.click(screen.getByRole('button', { name: 'Re-check AI-cleared words' }));
    expect(mockStartClassification).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Start re-check' }));
    await waitFor(() => expect(mockStartClassification).toHaveBeenCalledWith({ recheckClassifierSafe: true }));
  });
});

describe('Content Library words table', () => {
  const base = {
    word: 'penis', headword: 'penis', lemma_normalized: 'penis', pos: 'noun', language_id: 'eng',
    audio_key: null, audio_duration_sec: null, category: null, difficulty_level: null, usage_notes: null,
    is_published: true, created_at: '', updated_at: '', primary_translation: 'okó',
  };

  it('badges hidden words and offers Hide/Unhide only when allowed', async () => {
    const user = userEvent.setup();
    const onToggleHidden = jest.fn();
    const words = [
      { ...base, id: 'lemma-penis', is_sensitive: true, sensitivity_category: 'sexual' },
      { ...base, id: 'lemma-water', word: 'water', headword: 'water', lemma_normalized: 'water', primary_translation: 'omi', is_sensitive: false },
    ];
    const { rerender } = render(
      <WordsDataTable words={words} isLoading={false} onDelete={jest.fn()} onSearch={jest.fn()} searchQuery="" onToggleHidden={onToggleHidden} />,
    );
    // Desktop table + mobile cards both render in jsdom.
    expect(screen.getAllByTestId('hidden-badge').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('hidden-badge')[0]).toHaveTextContent('Hidden · Sexual');
    await user.click(screen.getAllByRole('button', { name: 'Unhide' })[0]);
    expect(onToggleHidden).toHaveBeenCalledWith(expect.objectContaining({ id: 'lemma-penis' }));
    await user.click(screen.getAllByRole('button', { name: 'Hide' })[0]);
    expect(onToggleHidden).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'lemma-water' }));

    // Managers: no onToggleHidden -> badge still shown, no actions.
    rerender(<WordsDataTable words={words} isLoading={false} onDelete={jest.fn()} onSearch={jest.fn()} searchQuery="" />);
    expect(screen.getAllByTestId('hidden-badge').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Unhide' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hide' })).not.toBeInTheDocument();
  });
});

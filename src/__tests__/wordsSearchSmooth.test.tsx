import React from 'react';
import { act, fireEvent, screen } from '@testing-library/react';

import WordsPage from '@/app/(admin)/(others-pages)/content/words/page';
import { renderWithProviders as render } from '@/test-utils';

// Typing in the Content Library search used to reload the list on every
// keystroke: each key was a new request whose loading state replaced the
// table (and its search box) with a spinner, and the router.replace of
// ?search= re-ran the read-filters-from-URL effect, resetting the box.

const mockReplace = jest.fn();
let mockSearchParams = new URLSearchParams('search=penis');
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  usePathname: () => '/content/library',
  useSearchParams: () => mockSearchParams,
}));

jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ isAdmin: false }) }));

const mockUseWords = jest.fn();
jest.mock('@/hooks/useApi', () => ({
  useWords: (filters: unknown) => mockUseWords(filters),
  useAdminLanguages: () => ({ languages: [] }),
}));

const row = {
  id: 'lemma-penis', word: 'penis', headword: 'penis', lemma_normalized: 'penis', pos: 'noun', language_id: 'eng',
  audio_key: null, audio_duration_sec: null, category: null, difficulty_level: null, usage_notes: null,
  is_published: true, created_at: '', updated_at: '', primary_translation: 'okó',
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockSearchParams = new URLSearchParams('search=penis');
  window.history.replaceState(null, '', '/content/library?search=penis');
  mockUseWords.mockReturnValue({
    words: [row], total: 1, isLoading: false, isFetching: false, isError: false, refresh: jest.fn(), filtersApplied: {},
  });
});

afterEach(() => {
  jest.useRealTimers();
});

const searchedFor = () => mockUseWords.mock.calls.map(([f]) => (f as { search?: string }).search);

it('debounces typing, keeps the list and the box, and updates the URL without navigating', () => {
  render(<WordsPage />);
  act(() => {
    jest.advanceTimersByTime(400);
  });
  expect(searchedFor()).toContain('penis'); // shared ?search= link is honoured

  const [box] = screen.getAllByPlaceholderText('Search headwords or translations...');
  mockUseWords.mockClear();
  fireEvent.change(box, { target: { value: 'peni' } });
  fireEvent.change(box, { target: { value: 'penid' } });
  // No request for the half-typed values yet; the old rows are still shown.
  expect(searchedFor().every((s) => s === 'penis')).toBe(true);
  expect(screen.getAllByText('okó').length).toBeGreaterThan(0);
  expect(screen.getAllByTestId('words-search-refreshing').length).toBeGreaterThan(0);

  act(() => {
    jest.advanceTimersByTime(350); // search debounce
  });
  act(() => {
    jest.advanceTimersByTime(350); // URL update debounce
  });
  expect(searchedFor()).toContain('penid');
  expect(searchedFor()).not.toContain('peni');
  expect(window.location.search).toBe('?search=penid');
  expect(mockReplace).not.toHaveBeenCalled();
  // The box still holds what the user typed (not reset from the URL).
  expect((screen.getAllByPlaceholderText('Search headwords or translations...')[0] as HTMLInputElement).value).toBe('penid');
});

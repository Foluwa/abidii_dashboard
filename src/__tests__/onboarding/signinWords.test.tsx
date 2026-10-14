import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  SigninWordsTab,
  hiddenOverLimit,
  toSigninWordPayload,
  validateSigninWord,
} from '@/components/content/onboarding/SigninWordsTab';
import { createSigninWord, signinWordTermSearchUrl } from '@/lib/onboardingApi';
import type { SigninWord } from '@/types/onboarding';
import { renderWithProviders as render } from '@/test-utils';

const mockWords = jest.fn();
const mockTermSearch = jest.fn();

jest.mock('@/hooks/useApi', () => ({
  useSigninWords: () => mockWords(),
  useSigninWordTermSearch: (q: string) => mockTermSearch(q),
}));

jest.mock('@/lib/onboardingApi', () => ({
  ...jest.requireActual('@/lib/onboardingApi'),
  createSigninWord: jest.fn(),
  updateSigninWord: jest.fn(),
  deleteSigninWord: jest.fn(),
}));

function word(i: number, overrides: Partial<SigninWord> = {}): SigninWord {
  return {
    id: `w${i}`,
    yoruba: `Ọ̀rọ̀ ${i}`,
    meanings: { en: `word ${i}`, fr: 'mot', es: null, pt: '' },
    term_id: null,
    audio_url: null,
    enabled: true,
    sort_order: i * 10,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    resolved_audio_url: null,
    ...overrides,
  };
}

const form = (overrides: Partial<Parameters<typeof toSigninWordPayload>[0]> = {}) => ({
  yoruba: ' Ayọ̀ ',
  meanings: { en: ' joy ', fr: 'joie', es: '', pt: ' ' },
  term_id: null,
  audio_url: '',
  enabled: true,
  sort_order: 10,
  ...overrides,
});

describe('Sign-in words helpers', () => {
  it('builds the payload: NFC, trimmed, empty translations and audio left out', () => {
    const payload = toSigninWordPayload(form({ yoruba: 'Ayọ̀' }));
    expect(payload.yoruba).toBe('Ayọ̀'.normalize('NFC'));
    expect(payload.meanings).toEqual({ en: 'joy', fr: 'joie' });
    expect(payload.audio_url).toBeNull();
  });

  it('validates required fields and limits', () => {
    expect(validateSigninWord(form())).toEqual([]);
    const errors = validateSigninWord(
      form({ yoruba: '', meanings: { en: '', fr: 'x'.repeat(61), es: '', pt: '' }, audio_url: 'a b' }),
    );
    expect(errors).toEqual([
      'The Yorùbá word is required.',
      'The English meaning is required.',
      'The French meaning must be at most 60 characters.',
      'Audio URL must be a URL or a storage key, without spaces.',
    ]);
  });

  it('marks enabled words past the app limit of 8', () => {
    const words = Array.from({ length: 10 }, (_, i) => word(i + 1, { enabled: i !== 2 }));
    expect([...hiddenOverLimit(words)]).toEqual(['w10']);
  });

  it('only searches with a non-empty query', () => {
    expect(signinWordTermSearchUrl('  ')).toBeNull();
    expect(signinWordTermSearchUrl('ayọ̀')).toBe(
      `/api/v1/admin/onboarding/signin-words/term-search?q=${encodeURIComponent('ayọ̀')}`,
    );
  });
});

describe('Sign-in words tab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTermSearch.mockReturnValue({ matches: undefined, isLoading: false, isError: undefined });
    mockWords.mockReturnValue({
      words: [
        word(1, { resolved_audio_url: 'https://cdn.example/ayo.mp3', term_id: 't1' }),
        word(2, { enabled: false }),
      ],
      isLoading: false,
      isError: undefined,
      refresh: jest.fn(),
    });
  });

  it('lists words with audio status, coverage and no over-limit warning', () => {
    render(<SigninWordsTab />);
    expect(screen.getByText('Ọ̀rọ̀ 1')).toBeInTheDocument();
    expect(screen.getAllByText('no audio')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Show "Ọ̀rọ̀ 2"' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByText(/the app shows only the first 8/)).not.toBeInTheDocument();
    expect(screen.getByText(/onboarding.signin_words_enabled/)).toBeInTheDocument();
    expect(screen.getByText(/onboarding.hear_it_first_enabled/)).toBeInTheDocument();
  });

  it('warns when more than 8 words are enabled', () => {
    mockWords.mockReturnValue({
      words: Array.from({ length: 9 }, (_, i) => word(i + 1)),
      isLoading: false,
      isError: undefined,
      refresh: jest.fn(),
    });
    render(<SigninWordsTab />);
    expect(screen.getByText(/9 words are enabled, but the app shows only the first 8/)).toBeInTheDocument();
    expect(screen.getAllByText('not shown')).toHaveLength(1);
  });

  it('shows a friendly state when the backend is not deployed', () => {
    mockWords.mockReturnValue({ words: undefined, isLoading: false, isError: { response: { status: 404 } }, refresh: jest.fn() });
    render(<SigninWordsTab />);
    expect(screen.getByText('Sign-in words are not available yet')).toBeInTheDocument();
  });

  it('picks a library word, previews the pill and saves with its term_id', async () => {
    mockTermSearch.mockImplementation((q: string) => ({
      matches: q ? [{ term_id: 't9', yoruba: 'Ìfẹ́', gloss_en: 'love', audio_url: 'https://cdn.example/ife.mp3' }] : undefined,
      isLoading: false,
      isError: undefined,
    }));
    (createSigninWord as jest.Mock).mockResolvedValue({});
    render(<SigninWordsTab />);

    await userEvent.click(screen.getByRole('button', { name: /Add word/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Use positive or neutral words/)).toBeInTheDocument();

    await userEvent.type(within(dialog).getByLabelText('Pick existing word'), 'ife');
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Use Ìfẹ́' }));

    expect(within(dialog).getByLabelText(/Yorùbá word/)).toHaveValue('Ìfẹ́');
    expect(within(dialog).getByLabelText(/English/)).toHaveValue('love');
    expect(within(within(dialog).getByTestId('signin-word-pill')).getByText('Ìfẹ́')).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Add word' }));
    await waitFor(() => expect(createSigninWord).toHaveBeenCalled());
    expect(createSigninWord).toHaveBeenCalledWith(
      expect.objectContaining({ yoruba: 'Ìfẹ́', term_id: 't9', meanings: { en: 'love' }, audio_url: null, sort_order: 30 }),
    );
  });
});

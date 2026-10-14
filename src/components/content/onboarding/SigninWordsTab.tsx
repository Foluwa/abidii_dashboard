'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, Link2Off, Pencil, Plus, Search, Trash2 } from 'lucide-react';

import { Modal } from '@/components/ui/modal';
import InlineAudioPlayer from '@/components/ui/audio/InlineAudioPlayer';
import { Pill } from '@/components/subscriptions/subscriptionDisplay';
import { useSigninWords, useSigninWordTermSearch } from '@/hooks/useApi';
import { useConfirm } from '@/hooks/useConfirm';
import { useDebounce } from '@/hooks/useDebounce';
import { useToast } from '@/contexts/ToastContext';
import {
  createSigninWord,
  deleteSigninWord,
  describeApiError,
  updateSigninWord,
} from '@/lib/onboardingApi';
import {
  ONBOARDING_LANGUAGE_LABELS,
  SIGNIN_WORDS_APP_LIMIT,
  SIGNIN_WORD_MEANING_LANGUAGES,
  SIGNIN_WORD_MEANING_MAX,
  SIGNIN_WORD_YORUBA_MAX,
  type SigninWord,
  type SigninWordInput,
  type SigninWordMeaningLanguage,
  type SigninWordTermMatch,
} from '@/types/onboarding';
import {
  ConfigLink,
  ICON_BUTTON,
  INPUT,
  LABEL,
  LoadErrorState,
  ReorderButtons,
  Switch,
  TD,
  TH,
  YORUBA_FONT_STYLE,
  reorderUpdates,
} from './shared';

const OPTIONAL_MEANING_LANGUAGES = SIGNIN_WORD_MEANING_LANGUAGES.filter(
  (l): l is Exclude<SigninWordMeaningLanguage, 'en'> => l !== 'en',
);

type MeaningForm = Record<SigninWordMeaningLanguage, string>;

interface SigninWordForm {
  yoruba: string;
  meanings: MeaningForm;
  term_id: string | null;
  audio_url: string;
  enabled: boolean;
  sort_order: number;
}

function toForm(word: SigninWord | null, nextOrder: number): SigninWordForm {
  return {
    yoruba: word?.yoruba ?? '',
    meanings: {
      en: word?.meanings?.en ?? '',
      fr: word?.meanings?.fr ?? '',
      es: word?.meanings?.es ?? '',
      pt: word?.meanings?.pt ?? '',
    },
    term_id: word?.term_id ?? null,
    audio_url: word?.audio_url ?? '',
    enabled: word?.enabled ?? true,
    sort_order: word?.sort_order ?? nextOrder,
  };
}

/** Request body from the form: NFC-normalized Yorùbá, trimmed text, empty translations left out. */
export function toSigninWordPayload(form: SigninWordForm): SigninWordInput {
  const meanings: SigninWordInput['meanings'] = { en: form.meanings.en.trim() };
  for (const lang of OPTIONAL_MEANING_LANGUAGES) {
    const value = form.meanings[lang].trim();
    if (value) meanings[lang] = value;
  }
  return {
    yoruba: form.yoruba.normalize('NFC').trim(),
    meanings,
    term_id: form.term_id,
    audio_url: form.audio_url.trim() || null,
    enabled: form.enabled,
    sort_order: form.sort_order,
  };
}

export function validateSigninWord(form: SigninWordForm): string[] {
  const errors: string[] = [];
  const yoruba = form.yoruba.normalize('NFC').trim();
  if (!yoruba) errors.push('The Yorùbá word is required.');
  else if (yoruba.length > SIGNIN_WORD_YORUBA_MAX)
    errors.push(`The Yorùbá word must be at most ${SIGNIN_WORD_YORUBA_MAX} characters.`);
  if (!form.meanings.en.trim()) errors.push('The English meaning is required.');
  for (const lang of SIGNIN_WORD_MEANING_LANGUAGES) {
    if (form.meanings[lang].trim().length > SIGNIN_WORD_MEANING_MAX) {
      errors.push(`The ${ONBOARDING_LANGUAGE_LABELS[lang]} meaning must be at most ${SIGNIN_WORD_MEANING_MAX} characters.`);
    }
  }
  if (/\s/.test(form.audio_url.trim())) errors.push('Audio URL must be a URL or a storage key, without spaces.');
  return errors;
}

/** True for a URL the browser can play directly (a storage key is resolved by the server). */
function isPlayableUrl(url: string | null | undefined): url is string {
  return !!url && /^https?:\/\//i.test(url.trim());
}

/** Ids of enabled words past the app's limit (by order): saved, but not shown. */
export function hiddenOverLimit(sortedWords: SigninWord[], limit = SIGNIN_WORDS_APP_LIMIT): Set<string> {
  return new Set(
    sortedWords
      .filter((w) => w.enabled)
      .slice(limit)
      .map((w) => w.id),
  );
}

/** How a word looks as a floating pill on the app's sign-in screen (navy + gold). */
export function SigninWordPill({ yoruba, meaning }: { yoruba: string; meaning: string }) {
  return (
    <span
      className="inline-flex max-w-full items-center gap-2 rounded-full border px-3.5 py-1.5 shadow-sm"
      style={{ backgroundColor: '#14213D', borderColor: '#E9B949' }}
      data-testid="signin-word-pill"
    >
      <span className="truncate text-sm font-semibold" style={{ ...YORUBA_FONT_STYLE, color: '#F5C451' }} lang="yo">
        {yoruba || 'Ẹ káàbọ̀'}
      </span>
      <span className="truncate text-xs" style={{ color: 'rgba(255,255,255,0.8)' }}>
        {meaning || 'welcome'}
      </span>
      <span aria-hidden="true" className="text-xs">
        🔊
      </span>
    </span>
  );
}

function TermPicker({ onPick }: { onPick: (match: SigninWordTermMatch) => void }) {
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 300);
  const { matches, isLoading, isError } = useSigninWordTermSearch(debounced);
  const showResults = debounced.trim().length > 0;

  return (
    <div className="space-y-2">
      <label htmlFor="signin-word-term-search" className={LABEL}>
        Pick existing word
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id="signin-word-term-search"
          className={`${INPUT} pl-9`}
          style={YORUBA_FONT_STYLE}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the word library (Yorùbá or English)…"
          autoComplete="off"
        />
      </div>
      {showResults && (
        <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
          {isError ? (
            <p className="p-3 text-sm text-destructive">
              {describeApiError(isError, 'Search failed.').notDeployed
                ? 'Word search is not available on this server yet. Enter the word by hand below.'
                : describeApiError(isError, 'Search failed.').message}
            </p>
          ) : isLoading && !matches ? (
            <p className="p-3 text-sm text-muted-foreground">Searching…</p>
          ) : !matches?.length ? (
            <p className="p-3 text-sm text-muted-foreground">No matching words. Enter it by hand below.</p>
          ) : (
            <ul className="divide-y divide-border" aria-label="Matching words">
              {matches.map((m) => (
                <li key={m.term_id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left hover:text-brand-600"
                    onClick={() => onPick(m)}
                    aria-label={`Use ${m.yoruba}`}
                  >
                    <span className="font-medium" style={YORUBA_FONT_STYLE} lang="yo">
                      {m.yoruba}
                    </span>
                    {m.gloss_en && <span className="ml-2 text-sm text-muted-foreground">{m.gloss_en}</span>}
                  </button>
                  {isPlayableUrl(m.audio_url) ? (
                    <InlineAudioPlayer src={m.audio_url} />
                  ) : (
                    <Pill tone="amber">no audio</Pill>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function SigninWordFormModal({
  word,
  nextOrder,
  onClose,
  onSaved,
}: {
  word: SigninWord | null;
  nextOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !word;
  const toast = useToast();
  const [form, setForm] = useState<SigninWordForm>(() => toForm(word, nextOrder));
  const [picked, setPicked] = useState<SigninWordTermMatch | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const errors = validateSigninWord(form);
  const missing = OPTIONAL_MEANING_LANGUAGES.filter((l) => !form.meanings[l].trim());

  // What will play in the app: manual override, else the picked term's audio,
  // else (unchanged link) the audio the server already resolved.
  const manualAudio = form.audio_url.trim();
  const previewAudio = manualAudio
    ? isPlayableUrl(manualAudio)
      ? manualAudio
      : null
    : picked
      ? picked.audio_url
      : form.term_id && form.term_id === word?.term_id && !word?.audio_url
        ? word.resolved_audio_url
        : null;

  const setMeaning = (lang: SigninWordMeaningLanguage, value: string) =>
    setForm((f) => ({ ...f, meanings: { ...f.meanings, [lang]: value } }));

  const pick = (match: SigninWordTermMatch) => {
    setPicked(match);
    setForm((f) => ({
      ...f,
      term_id: match.term_id,
      yoruba: match.yoruba.slice(0, SIGNIN_WORD_YORUBA_MAX),
      meanings: { ...f.meanings, en: (match.gloss_en ?? f.meanings.en).slice(0, SIGNIN_WORD_MEANING_MAX) },
    }));
  };

  const unlink = () => {
    setPicked(null);
    setForm((f) => ({ ...f, term_id: null }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (errors.length) return;
    setSaving(true);
    setError('');
    const payload = toSigninWordPayload(form);
    try {
      if (word) await updateSigninWord(word.id, payload);
      else await createSigninWord(payload);
      toast.success(isNew ? 'Word added' : 'Word updated');
      onSaved();
    } catch (err) {
      setError(describeApiError(err, 'Failed to save the word.').message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={isNew ? 'Add sign-in word' : `Edit word: ${word.yoruba}`} maxWidth="2xl">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
          Use positive or neutral words. Audio is reused from the word library — don&apos;t upload duplicates.
        </p>

        <TermPicker onPick={pick} />

        {form.term_id && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              Linked to word-library term <code className="text-xs">{form.term_id}</code>
              {picked ? ' (audio reused from the library)' : ''}
            </span>
            <button
              type="button"
              onClick={unlink}
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              <Link2Off className="h-3.5 w-3.5" aria-hidden="true" />
              Unlink
            </button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="signin-word-yoruba" className={LABEL}>
              Yorùbá word <span className="text-destructive">*</span>
            </label>
            <input
              id="signin-word-yoruba"
              className={`${INPUT} text-base`}
              style={YORUBA_FONT_STYLE}
              lang="yo"
              value={form.yoruba}
              onChange={(e) => setForm((f) => ({ ...f, yoruba: e.target.value }))}
              maxLength={SIGNIN_WORD_YORUBA_MAX}
              placeholder="e.g. Ayọ̀"
            />
            <p className="mt-1 text-xs text-muted-foreground">With tone marks. Up to {SIGNIN_WORD_YORUBA_MAX} characters.</p>
          </div>
          <div>
            <label htmlFor="signin-word-order" className={LABEL}>
              Order
            </label>
            <input
              id="signin-word-order"
              type="number"
              className={INPUT}
              value={form.sort_order}
              onChange={(e) => setForm((f) => ({ ...f, sort_order: Number.parseInt(e.target.value, 10) || 0 }))}
            />
            <p className="mt-1 text-xs text-muted-foreground">Lower numbers show first.</p>
          </div>
        </div>

        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-medium text-foreground">Meaning in each app language</legend>
          {SIGNIN_WORD_MEANING_LANGUAGES.map((lang) => (
            <div key={lang} className="grid items-center gap-2 sm:grid-cols-[110px_1fr]">
              <label htmlFor={`signin-word-meaning-${lang}`} className="text-sm text-muted-foreground">
                {ONBOARDING_LANGUAGE_LABELS[lang]}
                {lang === 'en' && <span className="text-destructive"> *</span>}
              </label>
              <input
                id={`signin-word-meaning-${lang}`}
                className={INPUT}
                value={form.meanings[lang]}
                onChange={(e) => setMeaning(lang, e.target.value)}
                maxLength={SIGNIN_WORD_MEANING_MAX}
                lang={lang}
              />
            </div>
          ))}
          {missing.length > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Missing: {missing.map((l) => ONBOARDING_LANGUAGE_LABELS[l]).join(', ')}. Learners using those languages
              will see the English meaning.
            </p>
          )}
        </fieldset>

        <div>
          <label htmlFor="signin-word-audio" className={LABEL}>
            Audio URL override (optional)
          </label>
          <input
            id="signin-word-audio"
            className={`${INPUT} font-mono`}
            value={form.audio_url}
            onChange={(e) => setForm((f) => ({ ...f, audio_url: e.target.value }))}
            placeholder="https://… or a storage key"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Leave empty to use the linked word&apos;s audio. Only set this for a word that isn&apos;t in the library.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-foreground">Audio preview</span>
          {isPlayableUrl(previewAudio) ? (
            <InlineAudioPlayer src={previewAudio} size="md" />
          ) : manualAudio || picked?.audio_url ? (
            <span className="text-xs text-muted-foreground">Stored file: the server resolves it on save.</span>
          ) : (
            <Pill tone="amber">no audio</Pill>
          )}
        </div>

        <div className="space-y-2">
          <span className="text-sm font-medium text-foreground">How it looks in the app</span>
          <div className="rounded-xl p-4" style={{ backgroundColor: '#0B1730' }}>
            <SigninWordPill yoruba={form.yoruba.trim()} meaning={form.meanings.en.trim()} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
          />
          Enabled (show in the app)
        </label>

        {submitted && errors.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-destructive" role="alert">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : isNew ? 'Add word' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function SigninWordsTab() {
  const toast = useToast();
  const { confirm, modal: confirmModal } = useConfirm();
  const { words, isLoading, isError, refresh } = useSigninWords();
  const [modal, setModal] = useState<{ word: SigninWord | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const sorted = useMemo(
    () => [...(words ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.yoruba.localeCompare(b.yoruba)),
    [words],
  );
  const nextOrder = sorted.length ? Math.max(...sorted.map((w) => w.sort_order)) + 10 : 10;
  const enabledCount = sorted.filter((w) => w.enabled).length;
  const hidden = useMemo(() => hiddenOverLimit(sorted), [sorted]);

  const toggleEnabled = async (word: SigninWord, next: boolean) => {
    setBusy(true);
    try {
      await updateSigninWord(word.id, { enabled: next });
      toast.success(`"${word.yoruba}" ${next ? 'enabled' : 'disabled'}`);
      await refresh();
    } catch (err) {
      toast.error(describeApiError(err, 'Failed to update the word.').message);
    } finally {
      setBusy(false);
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const updates = reorderUpdates(sorted, index, direction, (w) => w.id, (w) => w.sort_order);
    if (!updates.length) return;
    setBusy(true);
    try {
      await Promise.all(updates.map(([id, order]) => updateSigninWord(id, { sort_order: order })));
      await refresh();
    } catch (err) {
      toast.error(describeApiError(err, 'Failed to reorder words.').message);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (word: SigninWord) => {
    const ok = await confirm({
      title: 'Delete word',
      message: `Delete "${word.yoruba}" from the sign-in screen? The word and its audio stay in the word library. To hide it for now, turn it off instead.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await deleteSigninWord(word.id);
      toast.success('Word deleted');
      await refresh();
    } catch (err) {
      toast.error(describeApiError(err, 'Failed to delete the word.').message);
    }
  };

  return (
    <div className="space-y-4">
      {confirmModal}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>
            Short positive Yorùbá words that float as pills (word, meaning and native audio) on the app&apos;s sign-in
            screen, in this order. The app shows up to {SIGNIN_WORDS_APP_LIMIT} enabled words.
          </p>
          <p>
            <ConfigLink>Switched by onboarding.signin_words_enabled in System → Configuration</ConfigLink>
          </p>
          <p className="text-xs">
            The experimental onboarding.hear_it_first_enabled switch is also there.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ word: null })}
          disabled={!!isError}
          className="inline-flex items-center gap-1.5 self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add word
        </button>
      </div>

      {enabledCount > SIGNIN_WORDS_APP_LIMIT && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {enabledCount} words are enabled, but the app shows only the first {SIGNIN_WORDS_APP_LIMIT}. The rest are
            marked &quot;not shown&quot;; turn some off or reorder.
          </span>
        </div>
      )}

      {isError ? (
        <LoadErrorState error={isError} what="sign-in words" onRetry={() => refresh()} />
      ) : isLoading ? (
        <div className="space-y-2 rounded-xl border border-border bg-card p-4" aria-busy="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No sign-in words yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr>
                <th className={TH}>Order</th>
                <th className={TH}>Yorùbá word</th>
                <th className={TH}>Meanings</th>
                <th className={TH}>Audio</th>
                <th className={TH}>Enabled</th>
                <th className={`${TH} text-right`}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((word, index) => {
                const label = word.yoruba;
                return (
                  <tr key={word.id} className={word.enabled ? undefined : 'bg-muted/30'}>
                    <td className={TD}>
                      <div className="flex items-center gap-1">
                        <span className="w-8 text-xs tabular-nums text-muted-foreground">{word.sort_order}</span>
                        <ReorderButtons
                          label={label}
                          isFirst={index === 0}
                          isLast={index === sorted.length - 1}
                          disabled={busy}
                          onMove={(d) => move(index, d)}
                        />
                      </div>
                    </td>
                    <td className={TD}>
                      <div className="text-base font-medium" style={YORUBA_FONT_STYLE} lang="yo">
                        {word.yoruba}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {word.term_id && (
                          <Pill tone="blue" title={`Word-library term ${word.term_id}`}>
                            library
                          </Pill>
                        )}
                        {hidden.has(word.id) && (
                          <Pill tone="amber" title={`Only the first ${SIGNIN_WORDS_APP_LIMIT} enabled words are shown`}>
                            not shown
                          </Pill>
                        )}
                      </div>
                    </td>
                    <td className={TD}>
                      <div>{word.meanings?.en || '—'}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {OPTIONAL_MEANING_LANGUAGES.map((l) => {
                          const value = word.meanings?.[l]?.trim();
                          return (
                            <span
                              key={l}
                              title={`${ONBOARDING_LANGUAGE_LABELS[l]}: ${value || 'missing'}`}
                              className={`rounded px-1.5 py-0.5 text-[11px] font-medium uppercase ${
                                value
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                              }`}
                            >
                              {l}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className={TD}>
                      {word.resolved_audio_url ? (
                        <div className="flex items-center gap-2">
                          <InlineAudioPlayer src={word.resolved_audio_url} />
                          <span className="text-xs text-muted-foreground">{word.audio_url ? 'override' : 'library'}</span>
                        </div>
                      ) : (
                        <Pill tone="amber">no audio</Pill>
                      )}
                    </td>
                    <td className={TD}>
                      <Switch
                        checked={word.enabled}
                        label={`Show "${label}"`}
                        disabled={busy}
                        onChange={(next) => toggleEnabled(word, next)}
                      />
                    </td>
                    <td className={`${TD} whitespace-nowrap text-right`}>
                      <button
                        type="button"
                        className={ICON_BUTTON}
                        aria-label={`Edit ${label}`}
                        onClick={() => setModal({ word })}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className={`${ICON_BUTTON} hover:text-destructive`}
                        aria-label={`Delete ${label}`}
                        onClick={() => remove(word)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <SigninWordFormModal
          word={modal.word}
          nextOrder={nextOrder}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}

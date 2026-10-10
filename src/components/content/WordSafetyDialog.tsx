'use client';

import React, { useState } from 'react';
import { EyeOff } from 'lucide-react';

import { Modal } from '@/components/ui/modal';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import { useToast } from '@/contexts/ToastContext';
import {
  SENSITIVE_CATEGORIES,
  categoryLabel,
  setWordSensitivity,
  type SensitiveCategory,
  type SensitivityChange,
} from '@/lib/contentSafetyApi';

/** A dictionary word (lemma) and its current content-safety state. */
export interface WordSafetyTarget {
  /** Lemma id (Content Library word rows and content-safety rows both carry it). */
  id: string;
  /** English headword, e.g. "penis". */
  lemma: string;
  /** Yoruba translation(s) a learner sees, e.g. "okó". */
  yoruba?: string | null;
  is_sensitive: boolean;
  category?: string | null;
  reason?: string | null;
  source?: string | null;
}

const REASON_MAX = 200;

/** "Hidden" badge for a word flagged as not kid-safe. */
export function HiddenFromLearnersBadge({ category, className = '' }: { category?: string | null; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-300 ${className}`}
      title={category ? `Hidden from learners: ${categoryLabel(category)}` : 'Hidden from learners'}
      data-testid="hidden-badge"
    >
      <EyeOff className="h-3 w-3" aria-hidden />
      Hidden{category ? ` · ${categoryLabel(category)}` : ''}
    </span>
  );
}

/**
 * Hide a word from learners (choose a category, optional reason) or unhide
 * it. Used by Content Safety and the Content Library. Admin-only: callers
 * must only open it for admins (the backend rejects anyone else anyway).
 */
export function WordSafetyDialog({
  word,
  onClose,
  onSaved,
}: {
  word: WordSafetyTarget | null;
  onClose: () => void;
  onSaved?: (change: SensitivityChange) => void;
}) {
  if (!word) return null;
  // Keyed so the form starts fresh for every word it is opened for.
  return <WordSafetyForm key={`${word.id}:${word.is_sensitive}`} word={word} onClose={onClose} onSaved={onSaved} />;
}

function WordSafetyForm({
  word,
  onClose,
  onSaved,
}: {
  word: WordSafetyTarget;
  onClose: () => void;
  onSaved?: (change: SensitivityChange) => void;
}) {
  const toast = useToast();
  const [category, setCategory] = useState<string>(word.is_sensitive ? word.category ?? '' : '');
  const [reason, setReason] = useState(word.is_sensitive ? word.reason ?? '' : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const display = word.yoruba ? `${word.yoruba} (${word.lemma})` : word.lemma;

  const save = async (hide: boolean) => {
    if (hide && !category) {
      setError('Choose why this word is not suitable.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const change = await setWordSensitivity(
        word.id,
        hide
          ? { is_sensitive: true, category: category as SensitiveCategory, reason: reason.trim() || null }
          : { is_sensitive: false },
      );
      toast.success(hide ? `"${display}" is hidden from learners` : `"${display}" is visible to learners again`);
      onSaved?.(change);
      onClose();
    } catch {
      setError(`Could not update "${display}". Only admins can change this.`);
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={word.is_sensitive ? 'Hidden from learners' : 'Hide from learners'} maxWidth="md">
      <div className="space-y-4" data-testid="word-safety-dialog">
        <div>
          <p className="text-lg font-semibold text-foreground">{word.yoruba || word.lemma}</p>
          {word.yoruba ? <p className="text-sm text-muted-foreground">{word.lemma}</p> : null}
        </div>

        {word.is_sensitive ? (
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
            <HiddenFromLearnersBadge category={word.category} />
            {word.reason ? <p className="mt-2">{word.reason}</p> : null}
            <p className="mt-2 text-xs text-muted-foreground">
              Flagged by {word.source === 'admin' ? 'an admin' : 'the AI check'}.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Hidden words never appear in games, flashcards, the word of the day or the dictionary. The daily AI
            check will not change your decision.
          </p>
        )}

        <div>
          <StyledSelect
            label="Category"
            placeholder="Choose a category"
            options={SENSITIVE_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
            value={category}
            onValueChange={(v) => {
              setCategory(v);
              setError('');
            }}
            aria-label="Category"
          />
        </div>

        <div>
          <label htmlFor="word-safety-reason" className="block text-sm font-medium text-foreground">
            Reason <span className="text-muted-foreground">(optional)</span>
          </label>
          <input
            id="word-safety-reason"
            type="text"
            value={reason}
            maxLength={REASON_MAX}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. explicit anatomical term"
            className="mt-1 block w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-input px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
          >
            Cancel
          </button>
          {word.is_sensitive ? (
            <>
              <button
                type="button"
                onClick={() => save(false)}
                disabled={saving}
                className="rounded-lg border border-input px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
              >
                Unhide
              </button>
              <button
                type="button"
                onClick={() => save(true)}
                disabled={saving}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-brand-600 disabled:opacity-50"
              >
                Save
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => save(true)}
              disabled={saving}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Hide from learners
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

/**
 * Row action: "Hide" for a visible word, "Unhide" for a hidden one. Only
 * rendered for admins; managers see the badge only.
 */
export function WordSafetyActionButton({
  word,
  onClick,
  className = '',
}: {
  word: Pick<WordSafetyTarget, 'is_sensitive' | 'lemma'>;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20 ${className}`}
      title={word.is_sensitive ? `Unhide "${word.lemma}"` : `Hide "${word.lemma}" from learners`}
    >
      <EyeOff className="h-3.5 w-3.5" aria-hidden />
      {word.is_sensitive ? 'Unhide' : 'Hide'}
    </button>
  );
}

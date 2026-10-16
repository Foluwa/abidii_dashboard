'use client';

import React, { useMemo, useState } from 'react';
import { Pencil, Plus, ShieldCheck, Star, Trash2 } from 'lucide-react';

import { Modal } from '@/components/ui/modal';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import { Pill } from '@/components/subscriptions/subscriptionDisplay';
import { useOnboardingReviews } from '@/hooks/useApi';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/contexts/ToastContext';
import { countryFlagEmoji, countryName } from '@/lib/country-utils';
import {
  createOnboardingReview,
  deleteOnboardingReview,
  describeApiError,
  updateOnboardingReview,
} from '@/lib/onboardingApi';
import {
  ONBOARDING_LANGUAGES,
  ONBOARDING_LANGUAGE_LABELS,
  REVIEW_SOURCES,
  REVIEW_SOURCE_LABELS,
  REVIEW_TEXT_MAX,
  type OnboardingLanguage,
  type OnboardingReview,
  type OnboardingReviewInput,
  type ReviewSource,
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
  reorderUpdates,
} from './shared';

const PERMISSION_REQUIRED = 'Tick "I have permission to quote this review" before enabling it.';

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`} title={`${rating} / 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          aria-hidden="true"
          className={`h-3.5 w-3.5 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'}`}
        />
      ))}
    </span>
  );
}

export function ReviewPolicyNote() {
  return (
    <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-medium">Only real reviews, quoted with permission.</p>
        <p>
          Every review must come from a real learner, keep its original meaning (fix nothing but obvious typos), and be
          quoted with the reviewer&apos;s permission. If you translate one, keep the meaning and tick &quot;Translated&quot;.
          A review can&apos;t be shown in the app until permission is confirmed.
        </p>
      </div>
    </div>
  );
}

type FormState = {
  name: string;
  country: string;
  rating: number;
  text: string;
  language: OnboardingLanguage;
  translated: boolean;
  enabled: boolean;
  sort_order: number;
  source: ReviewSource;
  permission_confirmed: boolean;
};

function emptyForm(nextOrder: number): FormState {
  return {
    name: '',
    country: '',
    rating: 5,
    text: '',
    language: 'en',
    translated: false,
    enabled: false,
    sort_order: nextOrder,
    source: 'app_store',
    permission_confirmed: false,
  };
}

function formFromReview(review: OnboardingReview): FormState {
  return {
    name: review.name,
    country: review.country ?? '',
    rating: review.rating,
    text: review.text,
    language: review.language,
    translated: review.translated,
    enabled: review.enabled,
    sort_order: review.sort_order,
    source: review.source,
    permission_confirmed: review.permission_confirmed,
  };
}

/** Problems that block saving, mirroring the server's checks. */
export function validateReviewForm(form: FormState): string[] {
  const errors: string[] = [];
  if (!form.name.trim()) errors.push('Name is required.');
  if (!/^[A-Za-z]{2}$/.test(form.country.trim())) errors.push('Country must be a 2-letter code, e.g. NG.');
  if (!(form.rating >= 1 && form.rating <= 5)) errors.push('Rating must be 1 to 5.');
  if (!form.text.trim()) errors.push('Review text is required.');
  if (form.text.length > REVIEW_TEXT_MAX) errors.push(`Review text must be ${REVIEW_TEXT_MAX} characters or fewer.`);
  if (form.enabled && !form.permission_confirmed) errors.push(PERMISSION_REQUIRED);
  return errors;
}

function ReviewFormModal({
  initial,
  editing,
  onClose,
  onSaved,
}: {
  initial: FormState;
  editing: OnboardingReview | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const errors = validateReviewForm(form);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (errors.length) return;
    setSaving(true);
    setError('');
    const payload: OnboardingReviewInput = {
      ...form,
      name: form.name.trim(),
      country: form.country.trim().toUpperCase(),
      text: form.text.trim(),
      enabled: form.enabled && form.permission_confirmed,
    };
    try {
      if (editing) await updateOnboardingReview(editing.id, payload);
      else await createOnboardingReview(payload);
      toast.success(editing ? 'Review updated' : 'Review added');
      onSaved();
    } catch (err) {
      setError(describeApiError(err, 'Failed to save the review.').message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={editing ? 'Edit review' : 'Add review'} maxWidth="2xl">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <ReviewPolicyNote />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="review-name" className={LABEL}>
              Name
            </label>
            <input
              id="review-name"
              className={INPUT}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="As the reviewer signed it, e.g. Adé O."
              maxLength={80}
            />
          </div>
          <div>
            <label htmlFor="review-country" className={LABEL}>
              Country (2-letter code)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="review-country"
                className={INPUT}
                value={form.country}
                onChange={(e) => set('country', e.target.value.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase())}
                placeholder="NG"
                maxLength={2}
              />
              {/^[A-Z]{2}$/.test(form.country) && (
                <span className="whitespace-nowrap text-sm text-muted-foreground">
                  {countryFlagEmoji(form.country)} {countryName(form.country)}
                </span>
              )}
            </div>
          </div>
          <StyledSelect
            id="review-rating"
            label="Rating"
            value={String(form.rating)}
            onValueChange={(v) => set('rating', Number(v))}
            options={[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} star${n === 1 ? '' : 's'}` }))}
            fullWidth
          />
          <StyledSelect
            id="review-source"
            label="Where it came from"
            value={form.source}
            onValueChange={(v) => set('source', v as ReviewSource)}
            options={REVIEW_SOURCES.map((s) => ({ value: s, label: REVIEW_SOURCE_LABELS[s] }))}
            fullWidth
          />
          <StyledSelect
            id="review-language"
            label="Language of this text"
            value={form.language}
            onValueChange={(v) => set('language', v as OnboardingLanguage)}
            options={ONBOARDING_LANGUAGES.map((l) => ({ value: l, label: ONBOARDING_LANGUAGE_LABELS[l] }))}
            fullWidth
          />
          <div>
            <label htmlFor="review-order" className={LABEL}>
              Order
            </label>
            <input
              id="review-order"
              type="number"
              className={INPUT}
              value={form.sort_order}
              onChange={(e) => set('sort_order', Number.parseInt(e.target.value, 10) || 0)}
            />
            <p className="mt-1 text-xs text-muted-foreground">Lower numbers show first.</p>
          </div>
        </div>

        <div>
          <label htmlFor="review-text" className={LABEL}>
            Review text
          </label>
          <textarea
            id="review-text"
            className={`${INPUT} min-h-28`}
            value={form.text}
            onChange={(e) => set('text', e.target.value)}
            maxLength={REVIEW_TEXT_MAX}
            placeholder="Paste the review exactly as written."
          />
          <p
            className={`mt-1 text-right text-xs ${
              form.text.length >= REVIEW_TEXT_MAX ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
            }`}
          >
            {form.text.length} / {REVIEW_TEXT_MAX}
          </p>
        </div>

        <div className="space-y-3 rounded-lg border border-border p-4">
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.translated}
              onChange={(e) => set('translated', e.target.checked)}
            />
            <span>
              Translated
              <span className="block text-xs text-muted-foreground">
                The reviewer wrote it in another language; this is a faithful translation.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.permission_confirmed}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  permission_confirmed: e.target.checked,
                  // Without permission it can't stay enabled.
                  enabled: e.target.checked ? f.enabled : false,
                }))
              }
            />
            <span className="font-medium">I have permission to quote this review</span>
          </label>
          <label
            className={`flex items-start gap-2 text-sm ${
              form.permission_confirmed ? 'text-foreground' : 'text-muted-foreground'
            }`}
            title={form.permission_confirmed ? undefined : PERMISSION_REQUIRED}
          >
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.enabled}
              disabled={!form.permission_confirmed}
              onChange={(e) => set('enabled', e.target.checked)}
            />
            <span>
              Enabled (show in the app)
              {!form.permission_confirmed && (
                <span className="block text-xs">Confirm permission first.</span>
              )}
            </span>
          </label>
        </div>

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
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add review'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function ReviewsTab() {
  const toast = useToast();
  const { confirm, modal: confirmModal } = useConfirm();
  const { reviews, isLoading, isError, refresh } = useOnboardingReviews();
  const [modal, setModal] = useState<{ editing: OnboardingReview | null; initial: FormState } | null>(null);
  const [busy, setBusy] = useState(false);

  const sorted = useMemo(
    () => [...(reviews ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)),
    [reviews],
  );
  const enabledCount = sorted.filter((r) => r.enabled).length;
  const nextOrder = sorted.length ? Math.max(...sorted.map((r) => r.sort_order)) + 10 : 10;

  const toggleEnabled = async (review: OnboardingReview, next: boolean) => {
    if (next && !review.permission_confirmed) {
      toast.error(PERMISSION_REQUIRED);
      return;
    }
    setBusy(true);
    try {
      await updateOnboardingReview(review.id, { enabled: next });
      toast.success(`Review by ${review.name} ${next ? 'enabled' : 'disabled'}`);
      await refresh();
    } catch (err) {
      toast.error(describeApiError(err, 'Failed to update the review.').message);
    } finally {
      setBusy(false);
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const updates = reorderUpdates(sorted, index, direction, (r) => r.id, (r) => r.sort_order);
    if (!updates.length) return;
    setBusy(true);
    try {
      await Promise.all(updates.map(([id, order]) => updateOnboardingReview(id, { sort_order: order })));
      await refresh();
    } catch (err) {
      toast.error(describeApiError(err, 'Failed to reorder reviews.').message);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (review: OnboardingReview) => {
    const ok = await confirm({
      title: 'Delete review',
      message: `Delete the review by ${review.name}? This can't be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await deleteOnboardingReview(review.id);
      toast.success('Review deleted');
      await refresh();
    } catch (err) {
      toast.error(describeApiError(err, 'Failed to delete the review.').message);
    }
  };

  return (
    <div className="space-y-4">
      {confirmModal}
      <ReviewPolicyNote />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>
            Shown during onboarding as social proof, in this order.{' '}
            {reviews ? `${enabledCount} of ${sorted.length} shown in the app.` : null}
          </p>
          <p>
            <ConfigLink>The whole step is switched by onboarding.reviews_enabled in System → Configuration</ConfigLink>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ editing: null, initial: emptyForm(nextOrder) })}
          disabled={!!isError}
          className="inline-flex items-center gap-1.5 self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add review
        </button>
      </div>

      {isError ? (
        <LoadErrorState error={isError} what="reviews" onRetry={() => refresh()} />
      ) : isLoading ? (
        <div className="space-y-2 rounded-xl border border-border bg-card p-4" aria-busy="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No reviews yet. Add a real review you have permission to quote.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr>
                <th className={TH}>Order</th>
                <th className={TH}>Reviewer</th>
                <th className={TH}>Review</th>
                <th className={TH}>Language</th>
                <th className={TH}>Source</th>
                <th className={TH}>Permission</th>
                <th className={TH}>Enabled</th>
                <th className={`${TH} text-right`}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((review, index) => (
                <tr key={review.id} className={review.enabled ? undefined : 'bg-muted/30'}>
                  <td className={TD}>
                    <div className="flex items-center gap-1">
                      <span className="w-8 text-xs tabular-nums text-muted-foreground">{review.sort_order}</span>
                      <ReorderButtons
                        label={`review by ${review.name}`}
                        isFirst={index === 0}
                        isLast={index === sorted.length - 1}
                        disabled={busy}
                        onMove={(d) => move(index, d)}
                      />
                    </div>
                  </td>
                  <td className={TD}>
                    <div className="font-medium">{review.name}</div>
                    <div className="text-xs text-muted-foreground" title={countryName(review.country)}>
                      {countryFlagEmoji(review.country)} {review.country}
                    </div>
                    <Stars rating={review.rating} />
                  </td>
                  <td className={`${TD} max-w-md`}>
                    <p className="line-clamp-3 whitespace-pre-line" title={review.text}>
                      {review.text}
                    </p>
                  </td>
                  <td className={`${TD} whitespace-nowrap`}>
                    <div>{ONBOARDING_LANGUAGE_LABELS[review.language] ?? review.language}</div>
                    {review.translated && <Pill tone="indigo">Translated</Pill>}
                  </td>
                  <td className={`${TD} whitespace-nowrap`}>
                    {REVIEW_SOURCE_LABELS[review.source]?.split(' (')[0] ?? review.source}
                  </td>
                  <td className={`${TD} whitespace-nowrap`}>
                    {review.permission_confirmed ? (
                      <Pill tone="green">Confirmed</Pill>
                    ) : (
                      <Pill tone="amber" title={PERMISSION_REQUIRED}>
                        Missing
                      </Pill>
                    )}
                  </td>
                  <td className={TD}>
                    <Switch
                      checked={review.enabled}
                      label={`Show review by ${review.name}`}
                      disabled={busy || (!review.enabled && !review.permission_confirmed)}
                      title={!review.enabled && !review.permission_confirmed ? PERMISSION_REQUIRED : undefined}
                      onChange={(next) => toggleEnabled(review, next)}
                    />
                  </td>
                  <td className={`${TD} whitespace-nowrap text-right`}>
                    <button
                      type="button"
                      className={ICON_BUTTON}
                      aria-label={`Edit review by ${review.name}`}
                      onClick={() => setModal({ editing: review, initial: formFromReview(review) })}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className={`${ICON_BUTTON} hover:text-destructive`}
                      aria-label={`Delete review by ${review.name}`}
                      onClick={() => remove(review)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <ReviewFormModal
          initial={modal.initial}
          editing={modal.editing}
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

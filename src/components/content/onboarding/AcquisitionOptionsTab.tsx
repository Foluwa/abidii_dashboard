'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Lock, Pencil, Plus, Trash2 } from 'lucide-react';

import { Modal } from '@/components/ui/modal';
import { Pill } from '@/components/subscriptions/subscriptionDisplay';
import { useAcquisitionOptions } from '@/hooks/useApi';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/contexts/ToastContext';
import {
  createAcquisitionOption,
  deleteAcquisitionOption,
  describeApiError,
  updateAcquisitionOption,
} from '@/lib/onboardingApi';
import {
  ACQUISITION_OTHER_KEY,
  ONBOARDING_LANGUAGES,
  ONBOARDING_LANGUAGE_LABELS,
  type AcquisitionLabels,
  type AcquisitionOption,
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

const KEY_PATTERN = /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/;

const emptyLabels = (): AcquisitionLabels => ({ en: '', fr: '', es: '', pt: '', yo: '' });

function emptyOption(nextOrder: number): AcquisitionOption {
  return { key: '', labels: emptyLabels(), icon: '', image_url: null, enabled: true, sort_order: nextOrder };
}

/** "TikTok / Instagram" -> "tiktok_instagram" */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

export function validateOption(option: AcquisitionOption, existingKeys: string[], isNew: boolean): string[] {
  const errors: string[] = [];
  if (!KEY_PATTERN.test(option.key)) errors.push('Key must be lowercase letters, numbers and _ or -, e.g. friend_family.');
  else if (isNew && existingKeys.includes(option.key)) errors.push(`An option with key "${option.key}" already exists.`);
  if (!option.labels.en.trim()) errors.push('The English label is required.');
  if (option.image_url && !/^https?:\/\//i.test(option.image_url)) errors.push('Image URL must start with https://');
  return errors;
}

function isSafeImageUrl(url: string | null): url is string {
  return !!url && /^https?:\/\//i.test(url);
}

function OptionFormModal({
  initial,
  isNew,
  existingKeys,
  onClose,
  onSaved,
}: {
  initial: AcquisitionOption;
  isNew: boolean;
  existingKeys: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [option, setOption] = useState<AcquisitionOption>(initial);
  const [keyTouched, setKeyTouched] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [imageBroken, setImageBroken] = useState(false);

  const errors = validateOption(option, existingKeys, isNew);
  const missingLanguages = ONBOARDING_LANGUAGES.filter((l) => l !== 'en' && !option.labels[l].trim());

  const setLabel = (lang: keyof AcquisitionLabels, value: string) =>
    setOption((o) => ({
      ...o,
      labels: { ...o.labels, [lang]: value },
      // Suggest a key from the English label until the admin edits the key.
      key: isNew && lang === 'en' && !keyTouched ? slugify(value) : o.key,
    }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (errors.length) return;
    setSaving(true);
    setError('');
    const payload: AcquisitionOption = {
      ...option,
      icon: option.icon.trim(),
      image_url: option.image_url?.trim() || null,
      labels: Object.fromEntries(
        ONBOARDING_LANGUAGES.map((l) => [l, option.labels[l].trim()]),
      ) as AcquisitionLabels,
    };
    try {
      if (isNew) await createAcquisitionOption(payload);
      else await updateAcquisitionOption(initial.key, payload);
      toast.success(isNew ? 'Option added' : 'Option updated');
      onSaved();
    } catch (err) {
      setError(describeApiError(err, 'Failed to save the option.').message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={isNew ? 'Add option' : `Edit option: ${initial.key}`} maxWidth="2xl">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-medium text-foreground">Label in each app language</legend>
          {ONBOARDING_LANGUAGES.map((lang) => (
            <div key={lang} className="grid items-center gap-2 sm:grid-cols-[110px_1fr]">
              <label htmlFor={`option-label-${lang}`} className="text-sm text-muted-foreground">
                {ONBOARDING_LANGUAGE_LABELS[lang]}
                {lang === 'en' && <span className="text-destructive"> *</span>}
              </label>
              <input
                id={`option-label-${lang}`}
                className={INPUT}
                value={option.labels[lang]}
                onChange={(e) => setLabel(lang, e.target.value)}
                maxLength={80}
                lang={lang}
              />
            </div>
          ))}
          {missingLanguages.length > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Missing: {missingLanguages.map((l) => ONBOARDING_LANGUAGE_LABELS[l]).join(', ')}. Learners using those
              languages will see the English label.
            </p>
          )}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="option-key" className={LABEL}>
              Key
            </label>
            <input
              id="option-key"
              className={`${INPUT} font-mono`}
              value={option.key}
              disabled={!isNew}
              onChange={(e) => {
                setKeyTouched(true);
                setOption((o) => ({ ...o, key: e.target.value.toLowerCase() }));
              }}
              placeholder="friend_family"
              maxLength={48}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {isNew ? 'Stored with every answer; it cannot be changed later.' : 'Keys cannot be changed.'}
            </p>
          </div>
          <div>
            <label htmlFor="option-order" className={LABEL}>
              Order
            </label>
            <input
              id="option-order"
              type="number"
              className={INPUT}
              value={option.sort_order}
              onChange={(e) => setOption((o) => ({ ...o, sort_order: Number.parseInt(e.target.value, 10) || 0 }))}
            />
            <p className="mt-1 text-xs text-muted-foreground">Lower numbers show first.</p>
          </div>
          <div>
            <label htmlFor="option-icon" className={LABEL}>
              Icon
            </label>
            <input
              id="option-icon"
              className={INPUT}
              value={option.icon}
              onChange={(e) => setOption((o) => ({ ...o, icon: e.target.value }))}
              placeholder="e.g. people"
              maxLength={64}
            />
            <p className="mt-1 text-xs text-muted-foreground">Icon name the app shows when there is no image.</p>
          </div>
          <div>
            <label htmlFor="option-image" className={LABEL}>
              Image URL (optional)
            </label>
            <input
              id="option-image"
              type="url"
              className={INPUT}
              value={option.image_url ?? ''}
              onChange={(e) => {
                setImageBroken(false);
                setOption((o) => ({ ...o, image_url: e.target.value || null }));
              }}
              placeholder="https://…"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Use an image already in the media library (one copy, reused) rather than uploading a duplicate.
            </p>
          </div>
        </div>

        {isSafeImageUrl(option.image_url) && (
          <div className="flex items-center gap-3">
            {imageBroken ? (
              <span className="text-xs text-destructive">The image at this URL could not be loaded.</span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={option.image_url}
                alt="Option image preview"
                className="h-16 w-16 rounded-lg border border-border object-cover"
                onError={() => setImageBroken(true)}
              />
            )}
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={option.enabled}
            onChange={(e) => setOption((o) => ({ ...o, enabled: e.target.checked }))}
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
            {saving ? 'Saving…' : isNew ? 'Add option' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function AcquisitionOptionsTab() {
  const toast = useToast();
  const { confirm, modal: confirmModal } = useConfirm();
  const { options, isLoading, isError, refresh } = useAcquisitionOptions();
  const [modal, setModal] = useState<{ initial: AcquisitionOption; isNew: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const sorted = useMemo(
    () => [...(options ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.key.localeCompare(b.key)),
    [options],
  );
  const keys = sorted.map((o) => o.key);
  const nextOrder = sorted.length ? Math.max(...sorted.map((o) => o.sort_order)) + 10 : 10;

  const toggleEnabled = async (option: AcquisitionOption, next: boolean) => {
    setBusy(true);
    try {
      await updateAcquisitionOption(option.key, { enabled: next });
      toast.success(`"${option.labels.en || option.key}" ${next ? 'enabled' : 'disabled'}`);
      await refresh();
    } catch (err) {
      toast.error(describeApiError(err, 'Failed to update the option.').message);
    } finally {
      setBusy(false);
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const updates = reorderUpdates(sorted, index, direction, (o) => o.key, (o) => o.sort_order);
    if (!updates.length) return;
    setBusy(true);
    try {
      await Promise.all(updates.map(([key, order]) => updateAcquisitionOption(key, { sort_order: order })));
      await refresh();
    } catch (err) {
      toast.error(describeApiError(err, 'Failed to reorder options.').message);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (option: AcquisitionOption) => {
    const ok = await confirm({
      title: 'Delete option',
      message: `Delete "${option.labels.en || option.key}"? Past answers keep their key and still count in analytics. To hide it for now, turn it off instead.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await deleteAcquisitionOption(option.key);
      toast.success('Option deleted');
      await refresh();
    } catch (err) {
      toast.error(describeApiError(err, 'Failed to delete the option.').message);
    }
  };

  return (
    <div className="space-y-4">
      {confirmModal}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>
            The answers learners can pick for &quot;How did you hear about Abidii?&quot;, in this order. &quot;Other&quot;
            lets them type their own answer and is always kept.
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <ConfigLink>Switched by onboarding.acquisition_enabled in System → Configuration</ConfigLink>
            <Link
              href="/analytics/acquisition"
              className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              See the answers: Analytics → Acquisition
            </Link>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ initial: emptyOption(nextOrder), isNew: true })}
          disabled={!!isError}
          className="inline-flex items-center gap-1.5 self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add option
        </button>
      </div>

      {isError ? (
        <LoadErrorState error={isError} what="options" onRetry={() => refresh()} />
      ) : isLoading ? (
        <div className="space-y-2 rounded-xl border border-border bg-card p-4" aria-busy="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No options yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr>
                <th className={TH}>Order</th>
                <th className={TH}>Option</th>
                <th className={TH}>Translations</th>
                <th className={TH}>Icon / image</th>
                <th className={TH}>Enabled</th>
                <th className={`${TH} text-right`}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((option, index) => {
                const isOther = option.key === ACQUISITION_OTHER_KEY;
                const filled = ONBOARDING_LANGUAGES.filter((l) => option.labels?.[l]?.trim());
                const label = option.labels?.en || option.key;
                return (
                  <tr key={option.key} className={option.enabled ? undefined : 'bg-muted/30'}>
                    <td className={TD}>
                      <div className="flex items-center gap-1">
                        <span className="w-8 text-xs tabular-nums text-muted-foreground">{option.sort_order}</span>
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
                      <div className="font-medium">{label}</div>
                      <code className="text-xs text-muted-foreground">{option.key}</code>
                      {isOther && (
                        <span className="ml-2">
                          <Pill tone="neutral" title="Free-text answer; can't be deleted">
                            Free text
                          </Pill>
                        </span>
                      )}
                    </td>
                    <td className={TD}>
                      <div className="flex flex-wrap gap-1">
                        {ONBOARDING_LANGUAGES.map((l) => (
                          <span
                            key={l}
                            title={`${ONBOARDING_LANGUAGE_LABELS[l]}: ${option.labels?.[l] || 'missing'}`}
                            className={`rounded px-1.5 py-0.5 text-[11px] font-medium uppercase ${
                              filled.includes(l)
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                            }`}
                          >
                            {l}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className={TD}>
                      <div className="flex items-center gap-2">
                        {isSafeImageUrl(option.image_url) && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={option.image_url}
                            alt=""
                            className="h-8 w-8 rounded border border-border object-cover"
                          />
                        )}
                        <span className="text-xs text-muted-foreground">{option.icon || '—'}</span>
                      </div>
                    </td>
                    <td className={TD}>
                      <Switch
                        checked={option.enabled}
                        label={`Show "${label}"`}
                        disabled={busy}
                        onChange={(next) => toggleEnabled(option, next)}
                      />
                    </td>
                    <td className={`${TD} whitespace-nowrap text-right`}>
                      <button
                        type="button"
                        className={ICON_BUTTON}
                        aria-label={`Edit ${label}`}
                        onClick={() => setModal({ initial: { ...option, labels: { ...emptyLabels(), ...option.labels } }, isNew: false })}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {isOther ? (
                        <span
                          className={`${ICON_BUTTON} cursor-default`}
                          title='"Other" is always kept'
                          aria-label='"Other" cannot be deleted'
                        >
                          <Lock className="h-4 w-4" />
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={`${ICON_BUTTON} hover:text-destructive`}
                          aria-label={`Delete ${label}`}
                          onClick={() => remove(option)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <OptionFormModal
          initial={modal.initial}
          isNew={modal.isNew}
          existingKeys={keys}
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

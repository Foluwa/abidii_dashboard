'use client';

import React, { useState } from 'react';
import { ImageIcon, X } from 'lucide-react';

import { SharedMediaLibraryPanel } from '@/components/curriculum/media/SharedMediaLibraryPanel';
import { Pill, PILL_BASE_CLASS, type PillTone } from '@/components/subscriptions/subscriptionDisplay';
import { Modal } from '@/components/ui/modal';
import { blogLocaleLabel, formatBlogDate } from '@/lib/blogApi';
import { cn } from '@/lib/utils';
import type { BlogPostStatus } from '@/types/blog';

/**
 * Shared building blocks for the Blog CMS pages (TODO #43): status pills,
 * language tabs, inputs with counters and the image field with the shared
 * media library picker.
 */

export const BLOG_INPUT_CLASS =
  'block w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 aria-invalid:border-destructive';
export const ROW_ICON_BUTTON_CLASS =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg text-brand-600 hover:bg-brand-50 hover:text-brand-900 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-brand-400 dark:hover:bg-brand-900/30 dark:hover:text-brand-300';
export const ROW_DANGER_ICON_BUTTON_CLASS =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-destructive/30 dark:text-red-400 dark:hover:bg-red-900/30 dark:hover:text-red-300';

export const STATUS_LABELS: Record<BlogPostStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  published: 'Published',
};

const STATUS_TONE: Record<BlogPostStatus, PillTone> = {
  draft: 'neutral',
  scheduled: 'blue',
  published: 'green',
};

export function BlogStatusPill({ status, publishedAt }: { status: BlogPostStatus; publishedAt?: string | null }) {
  const title =
    status === 'scheduled' && publishedAt
      ? `Goes live ${formatBlogDate(publishedAt)}`
      : status === 'published' && publishedAt
        ? `Published ${formatBlogDate(publishedAt)}`
        : undefined;
  return (
    <Pill tone={STATUS_TONE[status] ?? 'neutral'} title={title}>
      {STATUS_LABELS[status] ?? status}
    </Pill>
  );
}

/** Locale code coloured by the version's status; dashed outline when the language is missing. */
export function BlogLocalePill({
  locale,
  status,
  publishedAt,
}: {
  locale: string;
  status?: BlogPostStatus | null;
  publishedAt?: string | null;
}) {
  if (!status) {
    return (
      <span
        className={`${PILL_BASE_CLASS} border border-dashed border-border text-muted-foreground`}
        title={`${blogLocaleLabel(locale)}: missing - not shown on the ${locale} site`}
        data-status="missing"
      >
        {locale}
      </span>
    );
  }
  const when = publishedAt ? ` (${formatBlogDate(publishedAt)})` : '';
  return (
    <span data-status={status}>
      <Pill tone={STATUS_TONE[status] ?? 'neutral'} title={`${blogLocaleLabel(locale)}: ${STATUS_LABELS[status]}${when}`}>
        {locale}
      </Pill>
    </span>
  );
}

export interface BlogLocaleTab {
  locale: string;
  /** Status of that language version; undefined = missing. */
  status?: BlogPostStatus | null;
  /** Unsaved edits in this language. */
  dirty?: boolean;
  /** Replaces the status pill (e.g. author profiles have no status). */
  badge?: React.ReactNode;
}

/** Per-language tabs (state, not URL - each tab keeps its unsaved draft). */
export function BlogLocaleTabs({
  tabs,
  active,
  onChange,
  label = 'Languages',
}: {
  tabs: BlogLocaleTab[];
  active: string;
  onChange: (locale: string) => void;
  label?: string;
}) {
  return (
    <div className="border-b border-border">
      <div className="-mb-px flex gap-5 overflow-x-auto" role="tablist" aria-label={label}>
        {tabs.map((tab) => {
          const isActive = tab.locale === active;
          return (
            <button
              key={tab.locale}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.locale)}
              className={cn(
                'inline-flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium whitespace-nowrap transition-colors',
                isActive
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
              )}
            >
              <span>{blogLocaleLabel(tab.locale)}</span>
              {tab.badge !== undefined ? (
                tab.badge
              ) : tab.status ? (
                <BlogStatusPill status={tab.status} />
              ) : (
                <span className="text-xs text-muted-foreground">missing</span>
              )}
              {tab.dirty ? (
                <span className="size-2 rounded-full bg-amber-500" title="Unsaved changes" aria-label="Unsaved changes" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Label + input/textarea slot + optional "n / max" counter, hint and error. */
export function BlogField({
  id,
  label,
  children,
  hint,
  error,
  count,
  max,
  className,
}: {
  id: string;
  label: React.ReactNode;
  children: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  count?: number;
  max?: number;
  className?: string;
}) {
  const over = max !== undefined && count !== undefined && count > max;
  return (
    <div className={className}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="block text-sm font-medium text-foreground">
          {label}
        </label>
        {max !== undefined && count !== undefined ? (
          <span
            className={cn('text-xs tabular-nums', over ? 'text-destructive' : 'text-muted-foreground')}
            aria-live="polite"
            id={`${id}-count`}
          >
            {count} / {max}
          </span>
        ) : null}
      </div>
      {children}
      {error ? (
        <p role="alert" className="mt-1 text-xs text-destructive" id={`${id}-error`}>
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * https image URL with a thumbnail, plus "Choose from library" (the shared
 * media library, images only). Picking an asset also hands back its media id
 * so the backend can link it; typing a URL clears that id.
 */
export function BlogImageField({
  id,
  label,
  value,
  onChange,
  hint,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (url: string, mediaId: string | null) => void;
  hint?: React.ReactNode;
  error?: string | null;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');

  return (
    <BlogField id={id} label={label} hint={hint ?? 'Full https:// URL, or pick an image from the media library.'} error={error}>
      <div className="flex items-start gap-3">
        <div className="flex size-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/40">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="size-16 object-cover" />
          ) : (
            <ImageIcon className="size-5 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input
            id={id}
            type="url"
            inputMode="url"
            value={value}
            onChange={(e) => onChange(e.target.value, null)}
            placeholder="https://"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className={BLOG_INPUT_CLASS}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="rounded-md border border-input px-2.5 py-1 text-xs font-medium hover:bg-accent"
            >
              Choose from library
            </button>
            {value ? (
              <button
                type="button"
                onClick={() => onChange('', null)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                aria-label={`Clear ${label}`}
              >
                <X className="size-3" aria-hidden="true" /> Clear
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <Modal isOpen={pickerOpen} onClose={() => setPickerOpen(false)} title={`${label}: media library`} maxWidth="4xl">
        <div className="space-y-4">
          <input
            aria-label="Search images"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by file name or key"
            className={BLOG_INPUT_CLASS}
          />
          <SharedMediaLibraryPanel
            kind="image"
            search={search}
            gridLabel="Image library"
            pageSize={15}
            isSelectable={(asset) => Boolean(asset.url && asset.url.startsWith('https://'))}
            onSelect={(asset) => {
              onChange(asset.url ?? '', asset.registered && asset.id ? asset.id : null);
              setPickerOpen(false);
            }}
          />
        </div>
      </Modal>
    </BlogField>
  );
}

/** Loading / error / empty block used by the blog pages. */
export function BlogStateBlock({ tone = 'muted', children }: { tone?: 'muted' | 'error'; children: React.ReactNode }) {
  return tone === 'error' ? (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300"
    >
      {children}
    </div>
  ) : (
    <div className="rounded-xl border border-dashed border-input bg-card px-6 py-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

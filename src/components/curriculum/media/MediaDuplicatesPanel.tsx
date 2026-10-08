'use client';

import React, { useState } from 'react';

import { useAdminMediaDuplicates } from '@/hooks/useApi';
import { formatBytes } from '@/lib/mediaLibraryApi';
import type { MediaDuplicateKey } from '@/types/mediaLibrary';

import { MediaUsageModal } from './MediaUsageModal';

/** Duplicate report: identical files under several keys, and several
 * recordings of the same Yorùbá text. Read-only: folding them is done by
 * `scripts/media_dedupe_audit.py` (dry run by default). */
export function MediaDuplicatesPanel() {
  const { data, isLoading, isError } = useAdminMediaDuplicates();
  const [usageKey, setUsageKey] = useState<string | null>(null);

  const keyRow = (key: MediaDuplicateKey) => (
    <li key={key.storage_key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 text-xs">
      <span className="min-w-0 break-all font-mono text-muted-foreground">{key.storage_key}</span>
      <span className="flex items-center gap-2">
        {key.registered ? (
          <span className="rounded-full bg-brand-50 px-1.5 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">library</span>
        ) : null}
        {key.human_recorded ? (
          <span className="rounded-full bg-emerald-50 px-1.5 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">human</span>
        ) : null}
        <button
          type="button"
          onClick={() => setUsageKey(key.storage_key)}
          className="rounded-lg border border-input px-2 py-1 font-medium text-foreground hover:bg-muted/50"
        >
          {key.usage_count === 0 ? 'Unused' : `Used in ${key.usage_count}`}
        </button>
      </span>
    </li>
  );

  if (isLoading) {
    return <div className="rounded-xl border border-dashed border-input bg-card px-6 py-10 text-center text-sm text-muted-foreground">Loading duplicate report…</div>;
  }
  if (isError || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
        Failed to load the duplicate report.
      </div>
    );
  }

  return (
    <div className="space-y-6" aria-label="Media duplicates">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Identical files under different keys</div>
          <div className="mt-1 text-2xl font-semibold text-foreground">{data.content_group_count}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Could be reclaimed</div>
          <div className="mt-1 text-2xl font-semibold text-foreground">{formatBytes(data.reclaimable_bytes)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Texts with more than one recording</div>
          <div className="mt-1 text-2xl font-semibold text-foreground">{data.text_group_count}</div>
        </div>
      </div>

      {data.hashed_object_count === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
          Bucket objects haven’t been hashed yet, so identical files under older keys can’t be found. Run
          <code className="mx-1">scripts/media_dedupe_audit.py</code> (a dry run by default) to fill this in.
        </p>
      ) : null}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Identical content</h3>
        {data.content_groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No identical files found.</p>
        ) : (
          data.content_groups.map((group) => (
            <div key={group.sha256} className="rounded-lg border border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 text-xs">
                <span className="font-mono text-muted-foreground" title={group.sha256}>
                  sha256 {group.sha256.slice(0, 12)}…
                </span>
                <span className="text-foreground">
                  {group.keys.length} copies · {formatBytes(group.reclaimable_bytes)} reclaimable
                </span>
              </div>
              <ul className="divide-y divide-border">{group.keys.map(keyRow)}</ul>
            </div>
          ))
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Same text, several recordings</h3>
        {data.text_groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Every text resolves to one recording.</p>
        ) : (
          data.text_groups.map((group) => (
            <div key={`${group.text_key}:${group.voice ?? ''}`} className="rounded-lg border border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 text-xs">
                <span className="font-medium text-foreground">“{group.text}”</span>
                <span className="text-muted-foreground">
                  {group.keys.length} recordings{group.voice ? ` · ${group.voice}` : ''}
                </span>
              </div>
              <ul className="divide-y divide-border">{group.keys.map(keyRow)}</ul>
            </div>
          ))
        )}
      </section>

      <MediaUsageModal storageKey={usageKey} onClose={() => setUsageKey(null)} />
    </div>
  );
}

export default MediaDuplicatesPanel;

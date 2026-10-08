'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

import { Modal } from '@/components/ui/modal';
import { describeReference, getMediaUsage } from '@/lib/mediaLibraryApi';
import type { MediaUsageResponse } from '@/types/mediaLibrary';

const BLUEPRINT_TABLES = new Set(['lesson_blueprints', 'lesson_blueprint_drafts']);

/** "Used in N places": every reference to one bucket object, fetched on open. */
export function MediaUsageModal({
  storageKey,
  onClose,
}: {
  storageKey: string | null;
  onClose: () => void;
}) {
  // Results are keyed by storage key, so opening another file never shows
  // the previous file's usage while its own request is in flight.
  const [loaded, setLoaded] = useState<{ key: string; usage?: MediaUsageResponse; error?: string } | null>(null);

  useEffect(() => {
    if (!storageKey) return;
    let cancelled = false;
    getMediaUsage(storageKey)
      .then((result) => {
        if (!cancelled) setLoaded({ key: storageKey, usage: result });
      })
      .catch((err: any) => {
        if (!cancelled) {
          setLoaded({ key: storageKey, error: err?.response?.data?.detail || err?.message || 'Failed to load usage.' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const current = loaded && loaded.key === storageKey ? loaded : null;
  const usage = current?.usage ?? null;
  const error = current?.error ?? null;

  const live = usage?.references.filter((ref) => !ref.history) ?? [];
  const history = usage?.references.filter((ref) => ref.history) ?? [];

  return (
    <Modal isOpen={Boolean(storageKey)} onClose={onClose} title="Where this media is used" maxWidth="2xl">
      <div className="space-y-4" aria-label="Media usage">
        <div className="break-all rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs text-muted-foreground">
          {storageKey}
        </div>
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
            {error}
          </div>
        ) : !usage ? (
          <div className="text-sm text-muted-foreground">Loading usage…</div>
        ) : (
          <>
            <p className="text-sm text-foreground">
              Used in {usage.usage_count} place{usage.usage_count === 1 ? '' : 's'}
              {usage.history_count ? ` (+${usage.history_count} in lesson history)` : ''}.
            </p>
            {live.length === 0 ? (
              <div className="rounded-lg border border-dashed border-input px-3 py-4 text-sm text-muted-foreground">
                Nothing references this file right now.
              </div>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border" aria-label="Media references">
                {live.map((ref, index) => (
                  <li key={`${ref.source}:${ref.row_id}:${ref.path}:${index}`} className="space-y-1 px-3 py-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">
                        {describeReference(ref.source)}
                      </span>
                      {BLUEPRINT_TABLES.has(ref.table) && ref.row_id ? (
                        <Link
                          href={`/curriculum/lesson-blueprints/${ref.row_id}`}
                          className="font-medium text-brand-700 hover:underline dark:text-brand-300"
                        >
                          {ref.label || ref.row_id}
                        </Link>
                      ) : (
                        <span className="font-medium text-foreground">{ref.label || ref.row_id || ref.table}</span>
                      )}
                    </div>
                    {ref.path ? <div className="break-all font-mono text-muted-foreground">{ref.path}</div> : null}
                    {ref.text ? <div className="text-muted-foreground">“{ref.text}”</div> : null}
                  </li>
                ))}
              </ul>
            )}
            {history.length ? (
              <p className="text-xs text-muted-foreground">
                {history.length} lesson version snapshot{history.length === 1 ? '' : 's'} also point here, so this file is
                kept for restores.
              </p>
            ) : null}
          </>
        )}
      </div>
    </Modal>
  );
}

export default MediaUsageModal;

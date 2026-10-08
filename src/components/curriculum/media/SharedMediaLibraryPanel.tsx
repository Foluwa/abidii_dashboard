'use client';

import React, { useState } from 'react';

import MediaLinkPreview from '@/components/admin/curriculum/MediaLinkPreview';
import Pagination from '@/components/tables/Pagination';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import { useAdminMediaLibrary } from '@/hooks/useApi';
import { formatBytes, mediaDisplayName } from '@/lib/mediaLibraryApi';
import type { MediaLibraryAsset } from '@/types/mediaLibrary';

import { MediaUsageModal } from './MediaUsageModal';

/**
 * Search across all media: shared-library rows plus every object any lesson,
 * scene or audio table references. Each card shows where it is used.
 */
export function SharedMediaLibraryPanel({
  kind: fixedKind,
  search: externalSearch,
  onSelect,
  selectLabel = 'Use',
  isSelectable,
  pageSize = 24,
  gridLabel = 'Shared media grid',
}: {
  /** Lock the kind filter (e.g. the picker's target field kind). */
  kind?: string;
  /** Controlled search text (the picker has its own search box). */
  search?: string;
  onSelect?: (asset: MediaLibraryAsset) => void;
  selectLabel?: string;
  isSelectable?: (asset: MediaLibraryAsset) => boolean;
  pageSize?: number;
  gridLabel?: string;
}) {
  const [page, setPage] = useState(1);
  const [ownSearch, setOwnSearch] = useState('');
  const [kind, setKind] = useState('');
  const [usageFilter, setUsageFilter] = useState<'all' | 'unused' | 'used'>('all');
  const [usageKey, setUsageKey] = useState<string | null>(null);

  const search = externalSearch ?? ownSearch;
  const { items, total, isLoading, isError } = useAdminMediaLibrary({
    page,
    limit: pageSize,
    search: search.trim() || undefined,
    kind: fixedKind || kind || undefined,
    unused: usageFilter === 'all' ? undefined : usageFilter === 'unused',
  });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-4">
        {externalSearch === undefined ? (
          <div className="lg:col-span-2">
            <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="shared-media-search">
              Search all media
            </label>
            <input
              id="shared-media-search"
              value={ownSearch}
              onChange={(event) => {
                setOwnSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Yorùbá text, file name, key or sha256"
              className="block h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:border-brand-500 focus:outline-none"
            />
          </div>
        ) : null}
        {fixedKind ? null : (
          <div>
            <StyledSelect
              label="Type"
              aria-label="Shared media type"
              value={kind}
              onChange={(event) => {
                setKind(event.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All types' },
                { value: 'audio', label: 'Audio' },
                { value: 'image', label: 'Images' },
                { value: 'video', label: 'Video' },
              ]}
              fullWidth
            />
          </div>
        )}
        <div>
          <StyledSelect
            label="Usage"
            aria-label="Shared media usage"
            value={usageFilter}
            onChange={(event) => {
              setUsageFilter(event.target.value as 'all' | 'unused' | 'used');
              setPage(1);
            }}
            options={[
              { value: 'all', label: 'Used and unused' },
              { value: 'used', label: 'Used somewhere' },
              { value: 'unused', label: 'Unused' },
            ]}
            fullWidth
          />
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        {total} file{total === 1 ? '' : 's'} found
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-dashed border-input bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          Loading media…
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
          Failed to load the media library.
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-input bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          No media match the current filters.
        </div>
      ) : (
        <div aria-label={gridLabel} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {items.map((asset) => {
            const name = mediaDisplayName(asset);
            const selectable = isSelectable ? isSelectable(asset) : true;
            return (
              <article key={asset.storage_key} className="flex flex-col rounded-xl border border-border bg-card p-3 shadow-sm">
                {asset.url ? <MediaLinkPreview kind={asset.kind} url={asset.url} label={name} compact /> : null}
                <div className="mt-2 min-w-0 space-y-1">
                  <div className="truncate text-sm font-semibold text-foreground" title={asset.storage_key}>
                    {name}
                  </div>
                  {asset.text ? <div className="truncate text-xs text-foreground">“{asset.text}”</div> : null}
                  <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    <span className="uppercase">{asset.kind}</span>
                    {asset.bytes ? <span>· {formatBytes(asset.bytes)}</span> : null}
                    {asset.human_recorded ? (
                      <span className="rounded-full bg-emerald-50 px-1.5 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                        human
                      </span>
                    ) : null}
                    {!asset.registered ? (
                      <span
                        className="rounded-full bg-amber-50 px-1.5 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                        title="Referenced, but not in the shared library yet (older per-feature key)"
                      >
                        legacy key
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-auto flex flex-wrap gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setUsageKey(asset.storage_key)}
                    className="rounded-lg border border-input px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50"
                  >
                    {asset.usage_count === 0
                      ? 'Unused'
                      : `Used in ${asset.usage_count} place${asset.usage_count === 1 ? '' : 's'}`}
                  </button>
                  {onSelect ? (
                    <button
                      type="button"
                      onClick={() => onSelect(asset)}
                      disabled={!selectable}
                      className="rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300"
                    >
                      {selectable ? selectLabel : 'Incompatible'}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex justify-end">
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      ) : null}

      <MediaUsageModal storageKey={usageKey} onClose={() => setUsageKey(null)} />
    </div>
  );
}

export default SharedMediaLibraryPanel;

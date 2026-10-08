'use client';

import React from 'react';

import MediaLinkPreview from '@/components/admin/curriculum/MediaLinkPreview';
import { Modal } from '@/components/ui/modal';
import { formatBytes, mediaDisplayName } from '@/lib/mediaLibraryApi';
import type { MediaLibraryAsset } from '@/types/mediaLibrary';

/** Shown before an upload when the exact same file is already in the shared
 * library: link the existing copy instead of storing a second one. */
export function DuplicateUploadDialog({
  asset,
  fileName,
  isBusy = false,
  onUseExisting,
  onUploadAnyway,
  onCancel,
}: {
  asset: MediaLibraryAsset | null;
  fileName?: string;
  isBusy?: boolean;
  onUseExisting: () => void;
  onUploadAnyway: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal isOpen={Boolean(asset)} onClose={onCancel} title="This file is already in the media library" maxWidth="lg">
      {asset ? (
        <div className="space-y-4" aria-label="Duplicate upload">
          <p className="text-sm text-foreground">
            {fileName ? <strong>{fileName}</strong> : 'The selected file'} is identical to a file that is already stored
            {asset.usage_count
              ? ` and used in ${asset.usage_count} place${asset.usage_count === 1 ? '' : 's'}`
              : ''}
            . Use the existing copy so it is stored once and a re-recording fixes it everywhere.
          </p>
          <div className="rounded-lg border border-border bg-muted/50 p-3">
            {asset.url ? <MediaLinkPreview kind={asset.kind} url={asset.url} label={mediaDisplayName(asset)} compact /> : null}
            <div className="mt-2 break-all font-mono text-xs text-muted-foreground">{asset.storage_key}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {asset.kind} · {formatBytes(asset.bytes)}
              {asset.text ? ` · “${asset.text}”` : ''}
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isBusy}
              className="rounded-lg border border-input px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onUploadAnyway}
              disabled={isBusy}
              className="rounded-lg border border-input px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-60"
            >
              Upload anyway
            </button>
            <button
              type="button"
              onClick={onUseExisting}
              disabled={isBusy}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-brand-700 disabled:opacity-60"
            >
              {isBusy ? 'Linking…' : 'Use existing'}
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

export default DuplicateUploadDialog;

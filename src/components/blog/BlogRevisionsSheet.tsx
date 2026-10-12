'use client';

import React, { useState } from 'react';

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useBlogRevisions } from '@/hooks/useApi';
import { blogErrorMessage, blogLocaleLabel, formatBlogDate } from '@/lib/blogApi';
import { cn } from '@/lib/utils';
import type { BlogRevision } from '@/types/blog';

import { BlogStatusPill } from './blogUi';
import { MarkdownPreview } from './MarkdownPreview';

/** Editable fields of one language version (the editor's form state). */
export interface TranslationForm {
  title: string;
  slug: string;
  excerpt: string;
  body_md: string;
  seo_title: string;
  seo_description: string;
  /** The slug was typed (or loaded), so stop auto-suggesting it from the title. */
  slugTouched: boolean;
}

export function revisionToForm(revision: BlogRevision): TranslationForm {
  const s = revision.snapshot;
  return {
    title: s.title ?? '',
    slug: s.slug ?? '',
    excerpt: s.excerpt ?? '',
    body_md: s.body_md ?? '',
    seo_title: s.seo_title ?? '',
    seo_description: s.seo_description ?? '',
    slugTouched: true,
  };
}

/**
 * Version history of one language: every save, publish and unpublish keeps a
 * snapshot. Picking one previews it; "Copy into editor" loads it into the
 * form (nothing is saved until the editor saves).
 */
export function BlogRevisionsSheet({
  open,
  onOpenChange,
  postId,
  locale,
  onRestore,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  locale: string;
  onRestore: (form: TranslationForm) => void;
}) {
  const revisions = useBlogRevisions(postId, open ? locale : null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const items = revisions.data?.items ?? [];
  const selected = items.find((r) => r.id === selectedId) ?? items[0] ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="border-b border-border">
          <SheetTitle>Version history - {blogLocaleLabel(locale)}</SheetTitle>
          <SheetDescription>Newest first. Copying a version into the editor does not save it.</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-6">
          {revisions.isLoading ? <p className="text-sm text-muted-foreground">Loading history…</p> : null}
          {revisions.isError ? (
            <p role="alert" className="text-sm text-destructive">
              Failed to load the history. {blogErrorMessage(revisions.isError, '')}
            </p>
          ) : null}
          {revisions.data && items.length === 0 ? <p className="text-sm text-muted-foreground">No saved versions yet.</p> : null}

          {items.length > 0 ? (
            <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border" aria-label="Revisions">
              {items.map((r) => {
                const isSelected = selected?.id === r.id;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedId(r.id)}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm',
                        isSelected ? 'bg-muted' : 'hover:bg-muted/50',
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block text-foreground">{formatBlogDate(r.created_at)}</span>
                        <span className="block truncate text-xs text-muted-foreground">{r.editor_email ?? 'Unknown editor'}</span>
                      </span>
                      {r.snapshot.status ? <BlogStatusPill status={r.snapshot.status} /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {selected ? (
            <div className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-foreground">{selected.snapshot.title || 'Untitled'}</h3>
                  <p className="font-mono text-xs text-muted-foreground">/{locale}/blog/{selected.snapshot.slug}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRestore(revisionToForm(selected))}
                  className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Copy into editor
                </button>
              </div>
              {selected.snapshot.excerpt ? <p className="text-sm text-muted-foreground">{selected.snapshot.excerpt}</p> : null}
              {selected.snapshot.seo_title || selected.snapshot.seo_description ? (
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">SEO title</dt>
                  <dd className="text-foreground">{selected.snapshot.seo_title || '—'}</dd>
                  <dt className="text-muted-foreground">SEO description</dt>
                  <dd className="text-foreground">{selected.snapshot.seo_description || '—'}</dd>
                </dl>
              ) : null}
              <div className="border-t border-border pt-3">
                <MarkdownPreview source={selected.snapshot.body_md ?? ''} emptyText="Empty body." />
              </div>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

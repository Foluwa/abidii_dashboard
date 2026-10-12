'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Pencil, Plus, Trash2 } from 'lucide-react';

import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import { PILL_BASE_CLASS } from '@/components/subscriptions/subscriptionDisplay';
import Pagination from '@/components/tables/Pagination';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import { useToast } from '@/contexts/ToastContext';
import { useBlogLocales, useBlogPosts } from '@/hooks/useApi';
import { useConfirm } from '@/hooks/useConfirm';
import { useDebounce } from '@/hooks/useDebounce';
import { blogErrorMessage, blogLocaleLabel, deleteBlogPost, formatBlogDate } from '@/lib/blogApi';
import type { BlogPostListItem } from '@/types/blog';

import {
  BLOG_INPUT_CLASS,
  BlogLocalePill,
  BlogStatusPill,
  ROW_DANGER_ICON_BUTTON_CLASS,
  ROW_ICON_BUTTON_CLASS,
} from './blogUi';

const PAGE_SIZE = 25;

/** Title to show for a post: English first, else the first language it has. */
function displayTitle(post: BlogPostListItem) {
  const t = post.translations.find((x) => x.locale === 'en') ?? post.translations[0];
  return t?.title || 'Untitled post';
}

export function BlogPostsContent() {
  const toast = useToast();
  const { confirm, modal: confirmModal } = useConfirm();
  const { locales } = useBlogLocales();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('');
  const [locale, setLocale] = useState('');
  const search = useDebounce(searchInput.trim(), 300);

  const posts = useBlogPosts({ page, limit: PAGE_SIZE, status, locale, search });
  const items = posts.data?.items ?? [];
  const totalPages = posts.data?.pages ?? 1;
  const filtered = Boolean(status || locale || search);
  // Locales from the settings, plus any stray locale a post still has.
  const columns = Array.from(new Set([...locales, ...items.flatMap((p) => p.translations.map((t) => t.locale))]));

  const handleDelete = async (post: BlogPostListItem) => {
    const live = post.translations.filter((t) => t.status !== 'draft').map((t) => t.locale);
    const ok = await confirm({
      title: 'Delete post',
      message: `Delete "${displayTitle(post)}" in every language (${post.translations.length} version${
        post.translations.length === 1 ? '' : 's'
      })?${live.length ? ` It is live or scheduled in: ${live.join(', ')} - those pages disappear from the site.` : ''} This cannot be undone.`,
      confirmLabel: 'Delete post',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await deleteBlogPost(post.id);
      toast.success('Post deleted');
      await posts.refresh();
    } catch (err) {
      toast.error(blogErrorMessage(err, 'Could not delete the post'));
    }
  };

  return (
    <>
      {confirmModal}
      <PageBreadCrumb
        pageTitle="Blog posts"
        description="Each post has one version per language. A post only appears on a language's site once that version is published."
        actions={
          <Link
            href="/content/blog/posts/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" aria-hidden="true" /> New post
          </Link>
        }
      />

      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label htmlFor="blog-post-search" className="mb-1 block text-sm font-medium text-foreground">
              Search
            </label>
            <input
              id="blog-post-search"
              type="search"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setPage(1);
              }}
              placeholder="Title or slug"
              className={`${BLOG_INPUT_CLASS} h-11`}
            />
          </div>
          <StyledSelect
            label="Status"
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All statuses' },
              { value: 'draft', label: 'Draft' },
              { value: 'scheduled', label: 'Scheduled' },
              { value: 'published', label: 'Published' },
            ]}
            fullWidth
          />
          <StyledSelect
            label="Language"
            aria-label="Filter by language"
            value={locale}
            onChange={(e) => {
              setLocale(e.target.value);
              setPage(1);
            }}
            options={[{ value: '', label: 'All languages' }, ...locales.map((l) => ({ value: l, label: blogLocaleLabel(l) }))]}
            fullWidth
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            {posts.data ? `${posts.data.total} post${posts.data.total === 1 ? '' : 's'}` : ''}
          </span>
          <span className="inline-flex flex-wrap items-center gap-1.5">
            Language pills: <BlogStatusPill status="published" />
            <BlogStatusPill status="scheduled" />
            <BlogStatusPill status="draft" />
            <span className={`${PILL_BASE_CLASS} border border-dashed border-border`}>missing</span>
          </span>
          {filtered ? <span>Filtered: pills show only the language versions that match.</span> : null}
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="border-b">
                <tr>
                  {['Post', 'Languages', 'Updated', 'Actions'].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {posts.isLoading && (
                  <tr>
                    <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={4}>
                      Loading…
                    </td>
                  </tr>
                )}
                {posts.isError && (
                  <tr>
                    <td className="px-4 py-6 text-sm text-destructive" colSpan={4} role="alert">
                      Failed to load blog posts. {blogErrorMessage(posts.isError, '')}
                    </td>
                  </tr>
                )}
                {posts.data && items.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={4}>
                      {filtered ? 'No posts match these filters.' : 'No posts yet. Create the first one with "New post".'}
                    </td>
                  </tr>
                )}
                {items.map((post) => {
                  const byLocale = new Map(post.translations.map((t) => [t.locale, t]));
                  return (
                    <tr key={post.id} data-testid={`blog-post-row-${post.id}`}>
                      <td className="px-4 py-3 text-sm">
                        <Link href={`/content/blog/posts/${post.id}`} className="font-medium text-foreground hover:underline">
                          {displayTitle(post)}
                        </Link>
                        {post.translations.length === 0 ? (
                          <div className="text-xs text-muted-foreground">No language versions yet</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex flex-wrap gap-1">
                          {columns.map((loc) => {
                            const t = byLocale.get(loc);
                            if (!t && filtered) return null;
                            return <BlogLocalePill key={loc} locale={loc} status={t?.status} publishedAt={t?.published_at} />;
                          })}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">{formatBlogDate(post.updated_at)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/content/blog/posts/${post.id}`}
                            aria-label={`Edit ${displayTitle(post)}`}
                            title="Edit"
                            className={ROW_ICON_BUTTON_CLASS}
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => void handleDelete(post)}
                            aria-label={`Delete ${displayTitle(post)}`}
                            title="Delete"
                            className={ROW_DANGER_ICON_BUTTON_CLASS}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 ? (
          <div className="flex justify-end">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        ) : null}
      </div>
    </>
  );
}

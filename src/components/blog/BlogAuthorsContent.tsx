'use client';

import React from 'react';
import Link from 'next/link';
import { Pencil, Plus, Trash2 } from 'lucide-react';

import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import { Pill } from '@/components/subscriptions/subscriptionDisplay';
import { useToast } from '@/contexts/ToastContext';
import { useBlogAuthors } from '@/hooks/useApi';
import { useConfirm } from '@/hooks/useConfirm';
import { blogErrorMessage, deleteBlogAuthor, formatBlogDate } from '@/lib/blogApi';
import type { BlogAuthorListItem } from '@/types/blog';

import { ROW_DANGER_ICON_BUTTON_CLASS, ROW_ICON_BUTTON_CLASS } from './blogUi';

/** Delete flow shared by the list and the editor: a 409 means "credited on posts". */
export async function confirmAndDeleteAuthor(
  author: { id: string; display_name: string; post_count?: number },
  confirm: ReturnType<typeof useConfirm>['confirm'],
  toast: ReturnType<typeof useToast>,
): Promise<boolean> {
  const ok = await confirm({
    title: 'Delete author',
    message: `Delete the profile of ${author.display_name}?${
      author.post_count ? ` They are credited on ${author.post_count} post(s), so the server will refuse until they are removed from those posts.` : ''
    } This cannot be undone.`,
    confirmLabel: 'Delete author',
    variant: 'danger',
  });
  if (!ok) return false;
  try {
    await deleteBlogAuthor(author.id);
    toast.success('Author deleted');
    return true;
  } catch (err) {
    toast.error(blogErrorMessage(err, 'Could not delete the author'));
    return false;
  }
}

export function BlogAuthorsContent() {
  const toast = useToast();
  const { confirm, modal: confirmModal } = useConfirm();
  const authors = useBlogAuthors();

  const remove = async (author: BlogAuthorListItem) => {
    if (await confirmAndDeleteAuthor(author, confirm, toast)) await authors.refresh();
  };

  return (
    <>
      {confirmModal}
      <PageBreadCrumb
        pageTitle="Blog authors"
        description="Public author profiles. A profile only appears on the site when it is active and the author agreed to it."
        actions={
          <Link
            href="/content/blog/authors/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" aria-hidden="true" /> New author
          </Link>
        }
      />

      <div className="rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="border-b">
              <tr>
                {['Author', 'Slug', 'Profile', 'Posts', 'Actions'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {authors.isLoading && (
                <tr>
                  <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={5}>
                    Loading…
                  </td>
                </tr>
              )}
              {authors.isError && (
                <tr>
                  <td className="px-4 py-6 text-sm text-destructive" colSpan={5} role="alert">
                    Failed to load authors. {blogErrorMessage(authors.isError, '')}
                  </td>
                </tr>
              )}
              {authors.data && authors.authors.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={5}>
                    No authors yet.
                  </td>
                </tr>
              )}
              {authors.authors.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 text-sm">
                    <Link href={`/content/blog/authors/${a.id}`} className="flex items-center gap-3 font-medium text-foreground hover:underline">
                      {a.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.avatar_url} alt="" className="size-8 rounded-full object-cover" />
                      ) : (
                        <span className="flex size-8 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground" aria-hidden="true">
                          {a.display_name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      {a.display_name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-sm text-muted-foreground">{a.slug}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex flex-wrap gap-1">
                      {a.is_active ? <Pill tone="green">Active</Pill> : <Pill tone="neutral">Inactive</Pill>}
                      {a.consent_given_at ? (
                        <Pill tone="teal" title={`Agreed ${formatBlogDate(a.consent_given_at)}`}>
                          Consent
                        </Pill>
                      ) : (
                        <Pill tone="amber" title="Not shown on the site until the author agrees to a public profile">
                          No consent
                        </Pill>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums text-foreground">{a.post_count}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <div className="flex items-center gap-1">
                      <Link href={`/content/blog/authors/${a.id}`} aria-label={`Edit ${a.display_name}`} title="Edit" className={ROW_ICON_BUTTON_CLASS}>
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => void remove(a)}
                        aria-label={`Delete ${a.display_name}`}
                        title="Delete"
                        className={ROW_DANGER_ICON_BUTTON_CLASS}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

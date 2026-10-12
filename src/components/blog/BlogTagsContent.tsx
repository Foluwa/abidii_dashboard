'use client';

import React, { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';

import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/contexts/ToastContext';
import { useBlogLocales, useBlogTags } from '@/hooks/useApi';
import { useConfirm } from '@/hooks/useConfirm';
import {
  BLOG_SLUG_RE,
  blogErrorMessage,
  blogLocaleLabel,
  blogSlugify,
  createBlogTag,
  deleteBlogTag,
  updateBlogTag,
} from '@/lib/blogApi';
import type { BlogTag } from '@/types/blog';

import { BLOG_INPUT_CLASS, BlogField, ROW_DANGER_ICON_BUTTON_CLASS, ROW_ICON_BUTTON_CLASS } from './blogUi';

interface TagForm {
  id: string | null;
  slug: string;
  names: Record<string, string>;
}

/** Blog tags: one slug (used in URLs) and a display name per language. */
export function BlogTagsContent() {
  const toast = useToast();
  const { confirm, modal: confirmModal } = useConfirm();
  const { locales } = useBlogLocales();
  const tags = useBlogTags();

  const [form, setForm] = useState<TagForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const openCreate = () => {
    setForm({ id: null, slug: '', names: {} });
    setError(null);
  };
  const openEdit = (tag: BlogTag) => {
    setForm({ id: tag.id, slug: tag.slug, names: { ...tag.names } });
    setError(null);
  };

  const save = async () => {
    if (!form) return;
    const slug = form.slug.trim();
    if (!BLOG_SLUG_RE.test(slug)) {
      setError('Slug must be lowercase letters, numbers and single hyphens.');
      return;
    }
    setBusy(true);
    try {
      // Send every locale so a cleared name is removed.
      const names = Object.fromEntries(locales.map((loc) => [loc, (form.names[loc] ?? '').trim()]));
      if (form.id) await updateBlogTag(form.id, { slug, names });
      else await createBlogTag({ slug, names });
      toast.success(form.id ? 'Tag updated' : 'Tag created');
      setForm(null);
      await tags.refresh();
    } catch (err) {
      setError(blogErrorMessage(err, 'Could not save the tag'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (tag: BlogTag) => {
    const count = tag.post_count ?? 0;
    const ok = await confirm({
      title: 'Delete tag',
      message: `Delete the tag "${tag.slug}"?${
        count ? ` It is removed from ${count} post${count === 1 ? '' : 's'}.` : ''
      } This cannot be undone.`,
      confirmLabel: 'Delete tag',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await deleteBlogTag(tag.id);
      toast.success('Tag deleted');
      await tags.refresh();
    } catch (err) {
      toast.error(blogErrorMessage(err, 'Could not delete the tag'));
    }
  };

  const colSpan = locales.length + 3;

  return (
    <>
      {confirmModal}
      <PageBreadCrumb
        pageTitle="Blog tags"
        description="Tags group posts on the site. The slug is used in URLs; names are shown per language."
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" aria-hidden="true" /> New tag
          </button>
        }
      />

      <div className="rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="border-b">
              <tr>
                {['Slug', ...locales.map(blogLocaleLabel), 'Posts', 'Actions'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tags.isLoading && (
                <tr>
                  <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={colSpan}>
                    Loading…
                  </td>
                </tr>
              )}
              {tags.isError && (
                <tr>
                  <td className="px-4 py-6 text-sm text-destructive" colSpan={colSpan} role="alert">
                    Failed to load tags. {blogErrorMessage(tags.isError, '')}
                  </td>
                </tr>
              )}
              {tags.data && tags.tags.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={colSpan}>
                    No tags yet.
                  </td>
                </tr>
              )}
              {tags.tags.map((tag) => (
                <tr key={tag.id}>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-sm text-foreground">{tag.slug}</td>
                  {locales.map((loc) => (
                    <td key={loc} className="px-4 py-3 text-sm text-foreground">
                      {tag.names[loc] || <span className="text-xs text-muted-foreground">missing</span>}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-sm tabular-nums text-foreground">{tag.post_count ?? 0}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => openEdit(tag)} aria-label={`Edit ${tag.slug}`} title="Edit" className={ROW_ICON_BUTTON_CLASS}>
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(tag)}
                        aria-label={`Delete ${tag.slug}`}
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

      <Modal isOpen={Boolean(form)} onClose={() => !busy && setForm(null)} title={form?.id ? 'Edit tag' : 'New tag'} maxWidth="lg">
        {form ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            {locales.map((loc) => (
              <BlogField key={loc} id={`tag-name-${loc}`} label={`Name - ${blogLocaleLabel(loc)}`}>
                <input
                  id={`tag-name-${loc}`}
                  value={form.names[loc] ?? ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((prev) => {
                      if (!prev) return prev;
                      const next = { ...prev, names: { ...prev.names, [loc]: value } };
                      // New tag: suggest the slug from the English name.
                      if (!prev.id && loc === 'en') next.slug = blogSlugify(value, 60);
                      return next;
                    });
                  }}
                  className={BLOG_INPUT_CLASS}
                />
              </BlogField>
            ))}
            <BlogField id="tag-slug" label="Slug" hint="Lowercase letters, numbers and hyphens. Changing it changes the tag's URL.">
              <input
                id="tag-slug"
                value={form.slug}
                maxLength={60}
                onChange={(e) => setForm((prev) => (prev ? { ...prev, slug: e.target.value } : prev))}
                className={`${BLOG_INPUT_CLASS} font-mono`}
                required
              />
            </BlogField>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-md border border-input px-4 text-sm font-medium hover:bg-accent"
                onClick={() => setForm(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                disabled={busy}
              >
                {form.id ? 'Save tag' : 'Create tag'}
              </button>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}

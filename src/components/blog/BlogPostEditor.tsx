'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowDown, ArrowLeft, ArrowUp, History, Trash2, X } from 'lucide-react';

import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/contexts/ToastContext';
import { useBlogAuthors, useBlogLocales, useBlogPost, useBlogTags } from '@/hooks/useApi';
import { useConfirm } from '@/hooks/useConfirm';
import {
  BLOG_SLUG_RE,
  blogErrorMessage,
  blogLocaleLabel,
  blogSlugify,
  createBlogPost,
  deleteBlogPost,
  deleteBlogTranslation,
  formatBlogDate,
  publishBlogTranslation,
  saveBlogTranslation,
  toLocalDateTimeInput,
  unpublishBlogTranslation,
  updateBlogPost,
} from '@/lib/blogApi';
import { cn } from '@/lib/utils';
import type { BlogAuthorAssignment, BlogAuthorRole, BlogPost, BlogPostTranslation } from '@/types/blog';

import { BlogRevisionsSheet, type TranslationForm } from './BlogRevisionsSheet';
import {
  BLOG_INPUT_CLASS,
  BlogField,
  BlogImageField,
  BlogLocaleTabs,
  BlogStateBlock,
  BlogStatusPill,
  ROW_DANGER_ICON_BUTTON_CLASS,
  ROW_ICON_BUTTON_CLASS,
} from './blogUi';
import { MarkdownField } from './MarkdownPreview';

interface SharedForm {
  cover_image_url: string;
  cover_media_id: string | null;
  og_image_url: string;
  tag_ids: string[];
  authors: BlogAuthorAssignment[];
}

const EMPTY_TRANSLATION: TranslationForm = {
  title: '',
  slug: '',
  excerpt: '',
  body_md: '',
  seo_title: '',
  seo_description: '',
  slugTouched: false,
};

const BUTTON = 'inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50';
const PRIMARY_BUTTON = `${BUTTON} bg-primary text-primary-foreground hover:bg-primary/90`;
const OUTLINE_BUTTON = `${BUTTON} border border-input hover:bg-accent`;
const DANGER_BUTTON = `${BUTTON} border border-destructive/40 text-destructive hover:bg-destructive/10`;

function sharedFromPost(post?: BlogPost): SharedForm {
  return {
    cover_image_url: post?.cover_image_url ?? '',
    cover_media_id: post?.cover_media_id ?? null,
    og_image_url: post?.og_image_url ?? '',
    tag_ids: post?.tags.map((t) => t.id) ?? [],
    // The API orders authors by role then position; keep that order.
    authors: post?.authors.map((a) => ({ author_id: a.id, role: a.role })) ?? [],
  };
}

function formFromTranslation(t?: BlogPostTranslation): TranslationForm {
  if (!t) return EMPTY_TRANSLATION;
  return {
    title: t.title,
    slug: t.slug,
    excerpt: t.excerpt ?? '',
    body_md: t.body_md ?? '',
    seo_title: t.seo_title ?? '',
    seo_description: t.seo_description ?? '',
    slugTouched: true,
  };
}

const nullIfEmpty = (value: string) => (value.trim() === '' ? null : value.trim());

/**
 * Blog post editor. Shared fields (cover, OG image, tags, authors) apply to
 * every language; each language tab is its own version with its own status.
 * Edits are kept per tab until saved, so switching tabs never loses work.
 */
export function BlogPostEditor({ postId: initialPostId }: { postId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { confirm, modal: confirmModal } = useConfirm();

  // A new post gets its id on first save; the URL is swapped in place so the
  // unsaved tabs survive.
  const [createdId, setCreatedId] = useState<string | null>(null);
  const postId = initialPostId ?? createdId;

  const { locales, isLoading: localesLoading, isError: localesError } = useBlogLocales();
  const post = useBlogPost(postId);
  const { tags } = useBlogTags();
  const { authors: allAuthors } = useBlogAuthors();

  const [activeTab, setActiveTab] = useState(searchParams.get('locale') ?? '');
  const [sharedEdit, setSharedEdit] = useState<SharedForm | null>(null);
  const [edits, setEdits] = useState<Record<string, TranslationForm>>({});
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleInput, setScheduleInput] = useState('');
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [addAuthorId, setAddAuthorId] = useState('');
  const [addAuthorRole, setAddAuthorRole] = useState<BlogAuthorRole>('author');
  const [sharedError, setSharedError] = useState<string | null>(null);

  const serverPost = post.data;
  const translations = new Map((serverPost?.translations ?? []).map((t) => [t.locale, t]));
  const tabLocales = Array.from(new Set([...locales, ...translations.keys()]));
  const locale = tabLocales.includes(activeTab) ? activeTab : (tabLocales[0] ?? '');
  const server = translations.get(locale);
  const form = edits[locale] ?? formFromTranslation(server);
  const shared = sharedEdit ?? sharedFromPost(serverPost);
  const translationDirty = Boolean(edits[locale]);
  const anyDirty = Boolean(sharedEdit) || Object.keys(edits).length > 0;
  const isLive = server ? server.status !== 'draft' : false;
  const slugChangedOnLive = Boolean(server && isLive && form.slug.trim() && form.slug.trim() !== server.slug);
  const slugInvalid = form.slug.trim() !== '' && !BLOG_SLUG_RE.test(form.slug.trim());

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!anyDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [anyDirty]);

  const updateForm = (patch: Partial<TranslationForm>) => {
    setEdits((prev) => {
      const next = { ...(prev[locale] ?? formFromTranslation(server)), ...patch };
      // Auto-suggest the slug from the title until the editor types one.
      if ('title' in patch && !next.slugTouched) next.slug = blogSlugify(next.title);
      return { ...prev, [locale]: next };
    });
  };

  const updateShared = (patch: Partial<SharedForm>) => {
    setSharedError(null);
    setSharedEdit((prev) => ({ ...(prev ?? sharedFromPost(serverPost)), ...patch }));
  };

  const clearEdit = (loc: string) =>
    setEdits((prev) => {
      const next = { ...prev };
      delete next[loc];
      return next;
    });

  const translationPayload = () => ({
    title: form.title.trim(),
    slug: nullIfEmpty(form.slug),
    excerpt: nullIfEmpty(form.excerpt),
    body_md: form.body_md,
    seo_title: nullIfEmpty(form.seo_title),
    seo_description: nullIfEmpty(form.seo_description),
  });

  const sharedPayload = () => ({
    cover_image_url: nullIfEmpty(shared.cover_image_url),
    cover_media_id: shared.cover_media_id,
    og_image_url: nullIfEmpty(shared.og_image_url),
    tag_ids: shared.tag_ids,
    authors: shared.authors,
  });

  /**
   * Save the shared fields (if changed) and this language (if changed or not
   * created yet). Returns the post id, or null when the save failed.
   */
  const saveActive = async (): Promise<string | null> => {
    if (!form.title.trim()) {
      toast.error(`Give the ${blogLocaleLabel(locale)} version a title first.`);
      return null;
    }
    if (slugInvalid) {
      toast.error('Slug must be lowercase letters, numbers and single hyphens.');
      return null;
    }
    try {
      if (!postId) {
        const created = await createBlogPost({ ...sharedPayload(), locale, translation: translationPayload() });
        setCreatedId(created.id);
        setSharedEdit(null);
        clearEdit(locale);
        window.history.replaceState(null, '', `/content/blog/posts/${created.id}?locale=${locale}`);
        await post.refresh(created, { revalidate: false });
        return created.id;
      }
      if (sharedEdit) {
        await updateBlogPost(postId, sharedPayload());
        setSharedEdit(null);
      }
      if (translationDirty || !server) {
        await saveBlogTranslation(postId, locale, translationPayload());
        clearEdit(locale);
      }
      await post.refresh();
      return postId;
    } catch (err) {
      const message = blogErrorMessage(err, 'Save failed');
      if (/cover_image_url|og_image_url|author role/i.test(message)) setSharedError(message);
      toast.error(message);
      return null;
    }
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const handleSave = () =>
    run(async () => {
      if ((await saveActive()) !== null) toast.success(isLive ? 'Saved - the live page updates shortly' : 'Draft saved');
    });

  const handlePublishNow = () =>
    run(async () => {
      const ok = await confirm({
        title: `Publish ${blogLocaleLabel(locale)} version`,
        message: `Publish "${form.title || 'this post'}" now? It becomes visible on the ${locale} blog straight away.${
          translationDirty || sharedEdit ? ' Unsaved changes are saved first.' : ''
        }`,
        confirmLabel: 'Publish now',
      });
      if (!ok) return;
      const id = await saveActive();
      if (!id) return;
      try {
        await publishBlogTranslation(id, locale);
        toast.success(`${blogLocaleLabel(locale)} version published`);
        await post.refresh();
      } catch (err) {
        toast.error(blogErrorMessage(err, 'Publish failed'));
      }
    });

  const openSchedule = () => {
    const current = server?.status === 'scheduled' ? server.published_at : null;
    setScheduleInput(toLocalDateTimeInput(current));
    setScheduleError(null);
    setScheduleOpen(true);
  };

  const handleSchedule = () =>
    run(async () => {
      const when = scheduleInput ? new Date(scheduleInput) : null;
      if (!when || Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
        setScheduleError('Pick a date and time in the future.');
        return;
      }
      const id = await saveActive();
      if (!id) return;
      try {
        await publishBlogTranslation(id, locale, when.toISOString());
        setScheduleOpen(false);
        toast.success(`${blogLocaleLabel(locale)} version scheduled for ${when.toLocaleString()}`);
        await post.refresh();
      } catch (err) {
        setScheduleError(blogErrorMessage(err, 'Scheduling failed'));
      }
    });

  const handleUnpublish = () =>
    run(async () => {
      if (!postId || !server) return;
      const ok = await confirm({
        title: `Unpublish ${blogLocaleLabel(locale)} version`,
        message: `Take "${server.title}" off the ${locale} blog? It goes back to draft; ${
          server.status === 'scheduled' ? 'the schedule is cancelled.' : 'its page stops being shown.'
        }`,
        confirmLabel: 'Unpublish',
        variant: 'danger',
      });
      if (!ok) return;
      try {
        await unpublishBlogTranslation(postId, locale);
        toast.success(`${blogLocaleLabel(locale)} version is a draft again`);
        await post.refresh();
      } catch (err) {
        toast.error(blogErrorMessage(err, 'Unpublish failed'));
      }
    });

  const handleDeleteTranslation = () =>
    run(async () => {
      if (!postId || !server) return;
      const ok = await confirm({
        title: `Delete ${blogLocaleLabel(locale)} version`,
        message: `Delete the ${blogLocaleLabel(locale)} version "${server.title}"?${
          isLive ? ' It is live or scheduled and disappears from the site.' : ''
        } Other languages are kept. This cannot be undone.`,
        confirmLabel: 'Delete version',
        variant: 'danger',
      });
      if (!ok) return;
      try {
        await deleteBlogTranslation(postId, locale);
        clearEdit(locale);
        toast.success(`${blogLocaleLabel(locale)} version deleted`);
        await post.refresh();
      } catch (err) {
        toast.error(blogErrorMessage(err, 'Delete failed'));
      }
    });

  const handleDeletePost = () =>
    run(async () => {
      if (!postId) return;
      const live = (serverPost?.translations ?? []).filter((t) => t.status !== 'draft').map((t) => t.locale);
      const ok = await confirm({
        title: 'Delete post',
        message: `Delete this post in every language?${
          live.length ? ` It is live or scheduled in: ${live.join(', ')}.` : ''
        } This cannot be undone.`,
        confirmLabel: 'Delete post',
        variant: 'danger',
      });
      if (!ok) return;
      try {
        await deleteBlogPost(postId);
        setSharedEdit(null);
        setEdits({});
        toast.success('Post deleted');
        router.push('/content/blog/posts');
      } catch (err) {
        toast.error(blogErrorMessage(err, 'Delete failed'));
      }
    });

  const moveAuthor = (index: number, delta: number) => {
    const next = [...shared.authors];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    updateShared({ authors: next });
  };

  const authorName = (id: string) =>
    allAuthors.find((a) => a.id === id)?.display_name ??
    serverPost?.authors.find((a) => a.id === id)?.display_name ??
    id;

  const tagLabel = (tag: { slug: string; names: Record<string, string> }) =>
    tag.names[locale] || tag.names.en || tag.slug;

  // ------------------------------------------------------------------ render
  const title = postId ? serverPost?.translations.find((t) => t.locale === 'en')?.title ?? serverPost?.translations[0]?.title ?? 'Edit post' : 'New post';
  const backLink = (
    <Link href="/content/blog/posts" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" aria-hidden="true" /> All posts
    </Link>
  );

  if (postId && post.isError) {
    return (
      <>
        <PageBreadCrumb pageTitle="Edit post" eyebrow={backLink} />
        <BlogStateBlock tone="error">Failed to load this post. {blogErrorMessage(post.isError, '')}</BlogStateBlock>
      </>
    );
  }
  if ((postId && post.isLoading) || localesLoading) {
    return (
      <>
        <PageBreadCrumb pageTitle={postId ? 'Edit post' : 'New post'} eyebrow={backLink} />
        <BlogStateBlock>Loading…</BlogStateBlock>
      </>
    );
  }
  if (localesError || tabLocales.length === 0) {
    return (
      <>
        <PageBreadCrumb pageTitle={postId ? 'Edit post' : 'New post'} eyebrow={backLink} />
        <BlogStateBlock tone="error">Could not load the blog languages. {blogErrorMessage(localesError, '')}</BlogStateBlock>
      </>
    );
  }

  const unassignedAuthors = allAuthors.filter((a) => !shared.authors.some((x) => x.author_id === a.id && x.role === addAuthorRole));

  return (
    <>
      {confirmModal}
      <PageBreadCrumb
        pageTitle={title}
        eyebrow={backLink}
        description={postId ? `Updated ${formatBlogDate(serverPost?.updated_at)}` : 'Fill in at least one language and save to create the post.'}
        actions={
          postId ? (
            <button type="button" className={DANGER_BUTTON} onClick={() => void handleDeletePost()} disabled={busy}>
              <Trash2 className="size-4" aria-hidden="true" /> Delete post
            </button>
          ) : null
        }
      />

      <div className="space-y-6">
        {/* ------------------------------------------------ shared fields */}
        <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="blog-shared-heading">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="blog-shared-heading" className="text-base font-semibold text-foreground">
              Post settings <span className="text-sm font-normal text-muted-foreground">- shared by every language</span>
            </h2>
            {sharedEdit ? <span className="text-xs text-amber-600 dark:text-amber-400">Unsaved - saved with the next language save</span> : null}
          </div>
          {sharedError ? (
            <p role="alert" className="mb-3 text-sm text-destructive">
              {sharedError}
            </p>
          ) : null}
          <div className="grid gap-5 lg:grid-cols-2">
            <BlogImageField
              id="blog-cover"
              label="Cover image"
              value={shared.cover_image_url}
              onChange={(url, mediaId) => updateShared({ cover_image_url: url, cover_media_id: mediaId })}
            />
            <BlogImageField
              id="blog-og"
              label="Social share (OG) image"
              value={shared.og_image_url}
              onChange={(url) => updateShared({ og_image_url: url })}
              hint="Optional. Falls back to the cover image. 1200×630 works best."
            />

            <fieldset>
              <legend className="mb-1 block text-sm font-medium text-foreground">Tags</legend>
              {tags.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No tags yet. <Link href="/content/blog/tags" className="underline">Create tags</Link>
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => {
                    const selected = shared.tag_ids.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          updateShared({
                            tag_ids: selected ? shared.tag_ids.filter((id) => id !== tag.id) : [...shared.tag_ids, tag.id],
                          })
                        }
                        className={cn(
                          'rounded-full border px-2.5 py-0.5 text-xs font-medium',
                          selected
                            ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                            : 'border-border text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {tagLabel(tag)}
                      </button>
                    );
                  })}
                </div>
              )}
            </fieldset>

            <fieldset>
              <legend className="mb-1 block text-sm font-medium text-foreground">Authors and reviewers</legend>
              {shared.authors.length === 0 ? (
                <p className="mb-2 text-xs text-muted-foreground">No one credited yet.</p>
              ) : (
                <ol className="mb-2 space-y-1">
                  {shared.authors.map((a, index) => (
                    <li key={`${a.author_id}-${a.role}`} className="flex items-center gap-2 rounded-lg border border-border px-2 py-1">
                      <span className="w-5 text-xs tabular-nums text-muted-foreground">{index + 1}.</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{authorName(a.author_id)}</span>
                      <select
                        aria-label={`Role of ${authorName(a.author_id)}`}
                        value={a.role}
                        onChange={(e) =>
                          updateShared({
                            authors: shared.authors.map((x, i) => (i === index ? { ...x, role: e.target.value as BlogAuthorRole } : x)),
                          })
                        }
                        className="rounded-md border border-input bg-card px-2 py-1 text-xs"
                      >
                        <option value="author">Author</option>
                        <option value="reviewer">Reviewer</option>
                      </select>
                      <button type="button" className={ROW_ICON_BUTTON_CLASS} aria-label={`Move ${authorName(a.author_id)} up`} onClick={() => moveAuthor(index, -1)} disabled={index === 0}>
                        <ArrowUp className="size-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={ROW_ICON_BUTTON_CLASS}
                        aria-label={`Move ${authorName(a.author_id)} down`}
                        onClick={() => moveAuthor(index, 1)}
                        disabled={index === shared.authors.length - 1}
                      >
                        <ArrowDown className="size-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={ROW_DANGER_ICON_BUTTON_CLASS}
                        aria-label={`Remove ${authorName(a.author_id)}`}
                        onClick={() => updateShared({ authors: shared.authors.filter((_, i) => i !== index) })}
                      >
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-48 flex-1">
                  <StyledSelect
                    aria-label="Author to add"
                    value={addAuthorId}
                    onChange={(e) => setAddAuthorId(e.target.value)}
                    placeholder={allAuthors.length ? 'Choose an author…' : 'No authors yet'}
                    options={unassignedAuthors.map((a) => ({
                      value: a.id,
                      label: `${a.display_name}${a.is_active ? '' : ' (inactive)'}${a.consent_given_at ? '' : ' - no consent'}`,
                    }))}
                    fullWidth
                  />
                </div>
                <select
                  aria-label="Role for the added author"
                  value={addAuthorRole}
                  onChange={(e) => setAddAuthorRole(e.target.value as BlogAuthorRole)}
                  className="h-10 rounded-md border border-input bg-card px-2 text-sm"
                >
                  <option value="author">Author</option>
                  <option value="reviewer">Reviewer</option>
                </select>
                <button
                  type="button"
                  className={OUTLINE_BUTTON}
                  disabled={!addAuthorId}
                  onClick={() => {
                    updateShared({ authors: [...shared.authors, { author_id: addAuthorId, role: addAuthorRole }] });
                    setAddAuthorId('');
                  }}
                >
                  Add
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Only active authors who agreed to a public profile are shown on the site.{' '}
                <Link href="/content/blog/authors" className="underline">Manage authors</Link>
              </p>
            </fieldset>
          </div>
        </section>

        {/* -------------------------------------------- language versions */}
        <section className="rounded-xl border border-border bg-card p-5" aria-label="Language versions">
          <BlogLocaleTabs
            tabs={tabLocales.map((loc) => ({ locale: loc, status: translations.get(loc)?.status, dirty: Boolean(edits[loc]) }))}
            active={locale}
            onChange={setActiveTab}
          />

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {server ? (
              <>
                <BlogStatusPill status={server.status} publishedAt={server.published_at} />
                {server.status === 'scheduled' ? (
                  <span className="text-xs text-muted-foreground">Goes live {formatBlogDate(server.published_at)}</span>
                ) : server.status === 'published' ? (
                  <span className="text-xs text-muted-foreground">Since {formatBlogDate(server.published_at)}</span>
                ) : null}
              </>
            ) : null}
            <div className="ml-auto flex flex-wrap gap-2">
              <button type="button" className={PRIMARY_BUTTON} onClick={() => void handleSave()} disabled={busy}>
                {isLive ? 'Save changes' : 'Save draft'}
              </button>
              <button type="button" className={OUTLINE_BUTTON} onClick={() => void handlePublishNow()} disabled={busy || server?.status === 'published'}>
                Publish now
              </button>
              <button type="button" className={OUTLINE_BUTTON} onClick={openSchedule} disabled={busy || server?.status === 'published'}>
                {server?.status === 'scheduled' ? 'Reschedule…' : 'Schedule…'}
              </button>
              {isLive ? (
                <button type="button" className={OUTLINE_BUTTON} onClick={() => void handleUnpublish()} disabled={busy}>
                  Unpublish
                </button>
              ) : null}
              {server && postId ? (
                <>
                  <button type="button" className={OUTLINE_BUTTON} onClick={() => setHistoryOpen(true)}>
                    <History className="size-4" aria-hidden="true" /> History
                  </button>
                  <button type="button" className={DANGER_BUTTON} onClick={() => void handleDeleteTranslation()} disabled={busy}>
                    <Trash2 className="size-4" aria-hidden="true" /> Delete {locale} version
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {!server ? (
            <div
              role="status"
              className="mt-4 rounded-lg border border-dashed border-amber-400/60 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/20 dark:text-amber-300"
            >
              <strong>Missing {blogLocaleLabel(locale)} version.</strong> This post is not shown on the {locale} site at all.
              Fill in the fields below and save to create it.
            </div>
          ) : null}
          {isLive && translationDirty ? (
            <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
              This version is {server?.status}. Saving updates the {server?.status === 'published' ? 'live page' : 'scheduled post'}.
            </p>
          ) : null}

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <BlogField id="blog-title" label="Title" count={form.title.length} max={200} className="lg:col-span-2">
              <input
                id="blog-title"
                value={form.title}
                maxLength={200}
                onChange={(e) => updateForm({ title: e.target.value })}
                className={BLOG_INPUT_CLASS}
                required
              />
            </BlogField>

            <BlogField
              id="blog-slug"
              label="Slug"
              error={slugInvalid ? 'Use lowercase letters, numbers and single hyphens, e.g. "yoruba-greetings".' : null}
              hint={
                slugChangedOnLive ? (
                  <span className="text-amber-600 dark:text-amber-400">
                    This version is live. Changing the slug moves it to a new URL; /{locale}/blog/{server?.slug} will redirect to
                    the new one.
                  </span>
                ) : (
                  `URL: /${locale}/blog/${form.slug || '…'}${server ? '' : ' (suggested from the title; edit freely)'}`
                )
              }
              className="lg:col-span-2"
            >
              <div className="flex gap-2">
                <input
                  id="blog-slug"
                  value={form.slug}
                  maxLength={120}
                  onChange={(e) => updateForm({ slug: e.target.value, slugTouched: true })}
                  aria-invalid={slugInvalid || undefined}
                  className={cn(BLOG_INPUT_CLASS, 'font-mono')}
                />
                <button
                  type="button"
                  className={OUTLINE_BUTTON}
                  onClick={() => updateForm({ slug: blogSlugify(form.title), slugTouched: true })}
                  disabled={!form.title.trim()}
                >
                  From title
                </button>
              </div>
            </BlogField>

            <BlogField
              id="blog-excerpt"
              label="Excerpt"
              count={form.excerpt.length}
              max={500}
              hint="Shown on the blog index and in previews."
              className="lg:col-span-2"
            >
              <textarea
                id="blog-excerpt"
                rows={2}
                value={form.excerpt}
                maxLength={500}
                onChange={(e) => updateForm({ excerpt: e.target.value })}
                className={BLOG_INPUT_CLASS}
              />
            </BlogField>

            <BlogField id="blog-seo-title" label="SEO title" count={form.seo_title.length} max={70} hint="Optional. Defaults to the title.">
              <input
                id="blog-seo-title"
                value={form.seo_title}
                maxLength={70}
                onChange={(e) => updateForm({ seo_title: e.target.value })}
                className={BLOG_INPUT_CLASS}
              />
            </BlogField>

            <BlogField
              id="blog-seo-description"
              label="SEO description"
              count={form.seo_description.length}
              max={170}
              hint="Optional. Defaults to the excerpt."
            >
              <textarea
                id="blog-seo-description"
                rows={2}
                value={form.seo_description}
                maxLength={170}
                onChange={(e) => updateForm({ seo_description: e.target.value })}
                className={BLOG_INPUT_CLASS}
              />
            </BlogField>

            <div className="lg:col-span-2">
              <MarkdownField
                id="blog-body"
                label="Body (Markdown)"
                value={form.body_md}
                onChange={(body_md) => updateForm({ body_md })}
                rows={22}
                hint="Markdown only - raw HTML is not rendered."
              />
            </div>
          </div>
        </section>
      </div>

      <Modal isOpen={scheduleOpen} onClose={() => !busy && setScheduleOpen(false)} title={`Schedule ${blogLocaleLabel(locale)} version`} maxWidth="md">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The {locale} version goes live automatically at this time (your local timezone). Unsaved changes are saved first.
          </p>
          <label className="block text-sm font-medium text-foreground">
            Publish at
            <input
              type="datetime-local"
              aria-label="Publish at"
              min={toLocalDateTimeInput(new Date().toISOString())}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={scheduleInput}
              onChange={(e) => setScheduleInput(e.target.value)}
            />
          </label>
          {scheduleError ? (
            <p role="alert" className="text-sm text-destructive">
              {scheduleError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button type="button" className={OUTLINE_BUTTON} onClick={() => setScheduleOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button type="button" className={PRIMARY_BUTTON} onClick={() => void handleSchedule()} disabled={busy || !scheduleInput}>
              Schedule
            </button>
          </div>
        </div>
      </Modal>

      {postId && server ? (
        <BlogRevisionsSheet
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          postId={postId}
          locale={locale}
          onRestore={(restored) => {
            setEdits((prev) => ({ ...prev, [locale]: restored }));
            setHistoryOpen(false);
            toast.info('Revision copied into the editor. Save to keep it.');
          }}
        />
      ) : null}
    </>
  );
}

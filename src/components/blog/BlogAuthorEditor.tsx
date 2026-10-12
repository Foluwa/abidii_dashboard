'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trash2 } from 'lucide-react';

import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAdminUsers, useBlogAuthor, useBlogLocales } from '@/hooks/useApi';
import { useConfirm } from '@/hooks/useConfirm';
import {
  blogErrorField,
  blogErrorMessage,
  blogLocaleLabel,
  createBlogAuthor,
  formatBlogDate,
  saveBlogAuthorTranslation,
  updateBlogAuthor,
} from '@/lib/blogApi';
import { cn } from '@/lib/utils';
import { BLOG_SOCIAL_KEYS, type BlogAuthor, type BlogAuthorTranslation, type BlogSocialKey } from '@/types/blog';

import { confirmAndDeleteAuthor } from './BlogAuthorsContent';
import { BLOG_INPUT_CLASS, BlogField, BlogImageField, BlogLocaleTabs, BlogStateBlock } from './blogUi';
import { MarkdownField } from './MarkdownPreview';

interface AuthorForm {
  display_name: string;
  slug: string;
  avatar_url: string;
  avatar_media_id: string | null;
  cover_url: string;
  cover_media_id: string | null;
  accent_color: string;
  location: string;
  languages_spoken: string;
  social_links: Record<BlogSocialKey, string>;
  contact_email: string;
  admin_user_id: string;
  consent_given: boolean;
  is_active: boolean;
}

interface AuthorTranslationForm {
  role_title: string;
  short_bio: string;
  long_bio: string;
  custom_section_md: string;
}

const SOCIAL_LABELS: Record<BlogSocialKey, string> = {
  website: 'Website',
  x: 'X (Twitter)',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  github: 'GitHub',
};

const SOCIAL_PLACEHOLDERS: Record<BlogSocialKey, string> = {
  website: 'https://example.com',
  x: 'https://x.com/handle',
  instagram: 'https://instagram.com/handle',
  tiktok: 'https://tiktok.com/@handle',
  youtube: 'https://youtube.com/@channel',
  linkedin: 'https://linkedin.com/in/name',
  facebook: 'https://facebook.com/name',
  github: 'https://github.com/name',
};

// Field keys the backend prefixes its 422 messages with.
const ERROR_FIELDS = [...BLOG_SOCIAL_KEYS, 'contact_email', 'accent_color', 'avatar_url', 'cover_url', 'slug', 'display_name'];

const BUTTON = 'inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50';
const PRIMARY_BUTTON = `${BUTTON} bg-primary text-primary-foreground hover:bg-primary/90`;
const DANGER_BUTTON = `${BUTTON} border border-destructive/40 text-destructive hover:bg-destructive/10`;

function formFromAuthor(a?: BlogAuthor): AuthorForm {
  const links = Object.fromEntries(BLOG_SOCIAL_KEYS.map((k) => [k, a?.social_links?.[k] ?? ''])) as Record<BlogSocialKey, string>;
  return {
    display_name: a?.display_name ?? '',
    slug: a?.slug ?? '',
    avatar_url: a?.avatar_url ?? '',
    avatar_media_id: a?.avatar_media_id ?? null,
    cover_url: a?.cover_url ?? '',
    cover_media_id: a?.cover_media_id ?? null,
    accent_color: a?.accent_color ?? '',
    location: a?.location ?? '',
    languages_spoken: (a?.languages_spoken ?? []).join(', '),
    social_links: links,
    contact_email: a?.contact_email ?? '',
    admin_user_id: a?.admin_user_id ?? '',
    consent_given: Boolean(a?.consent_given_at),
    is_active: a?.is_active ?? true,
  };
}

function formFromTranslation(t?: BlogAuthorTranslation): AuthorTranslationForm {
  return {
    role_title: t?.role_title ?? '',
    short_bio: t?.short_bio ?? '',
    long_bio: t?.long_bio ?? '',
    custom_section_md: t?.custom_section_md ?? '',
  };
}

const nullIfEmpty = (value: string) => (value.trim() === '' ? null : value.trim());

/** Admins can pick a staff account; managers can't list staff, so they paste an id. */
function StaffUserSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { admins, isError } = useAdminUsers();
  if (isError) {
    return (
      <input id="author-staff" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Staff user id (optional)" className={BLOG_INPUT_CLASS} />
    );
  }
  return (
    <StyledSelect
      id="author-staff"
      aria-label="Linked staff user"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      options={[
        { value: '', label: 'Not linked' },
        ...admins.map((u) => ({ value: u.id, label: `${u.display_name || u.email || u.id} (${u.role})` })),
      ]}
      fullWidth
    />
  );
}

export function BlogAuthorEditor({ authorId: initialAuthorId }: { authorId?: string }) {
  const router = useRouter();
  const toast = useToast();
  const { isAdmin } = useAuth();
  const { confirm, modal: confirmModal } = useConfirm();

  const [createdId, setCreatedId] = useState<string | null>(null);
  const authorId = initialAuthorId ?? createdId;
  const author = useBlogAuthor(authorId);
  const { locales } = useBlogLocales();

  const [edit, setEdit] = useState<AuthorForm | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('');
  const [trEdits, setTrEdits] = useState<Record<string, AuthorTranslationForm>>({});
  const [busy, setBusy] = useState(false);

  const server = author.data;
  const form = edit ?? formFromAuthor(server);
  const translations = new Map((server?.translations ?? []).map((t) => [t.locale, t]));
  const locale = locales.includes(activeTab) ? activeTab : (locales[0] ?? '');
  const trForm = trEdits[locale] ?? formFromTranslation(translations.get(locale));

  const update = (patch: Partial<AuthorForm>) => {
    setEdit((prev) => ({ ...(prev ?? formFromAuthor(server)), ...patch }));
    const cleared = Object.keys(patch);
    if (cleared.some((k) => fieldErrors[k])) {
      setFieldErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !cleared.includes(k))));
    }
  };
  const updateSocial = (key: BlogSocialKey, value: string) => {
    update({ social_links: { ...form.social_links, [key]: value } });
    if (fieldErrors[key]) setFieldErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== key)));
  };
  const updateTr = (patch: Partial<AuthorTranslationForm>) =>
    setTrEdits((prev) => ({ ...prev, [locale]: { ...(prev[locale] ?? formFromTranslation(translations.get(locale))), ...patch } }));

  const saveProfile = async () => {
    if (!form.display_name.trim()) {
      setFieldErrors({ display_name: 'Display name is required.' });
      return;
    }
    setBusy(true);
    setFormError(null);
    setFieldErrors({});
    const payload = {
      display_name: form.display_name.trim(),
      slug: nullIfEmpty(form.slug),
      avatar_url: nullIfEmpty(form.avatar_url),
      avatar_media_id: form.avatar_media_id,
      cover_url: nullIfEmpty(form.cover_url),
      cover_media_id: form.cover_media_id,
      accent_color: nullIfEmpty(form.accent_color),
      location: nullIfEmpty(form.location),
      languages_spoken: form.languages_spoken
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      social_links: Object.fromEntries(BLOG_SOCIAL_KEYS.map((k) => [k, nullIfEmpty(form.social_links[k])])),
      contact_email: nullIfEmpty(form.contact_email),
      admin_user_id: nullIfEmpty(form.admin_user_id),
      is_active: form.is_active,
    };
    try {
      if (!authorId) {
        const created = await createBlogAuthor({ ...payload, consent_given: form.consent_given });
        setCreatedId(created.id);
        window.history.replaceState(null, '', `/content/blog/authors/${created.id}`);
        await author.refresh(created, { revalidate: false });
      } else {
        // Only send consent when it changes: the server stamps the time it was given.
        const consentChanged = form.consent_given !== Boolean(server?.consent_given_at);
        const saved = await updateBlogAuthor(authorId, consentChanged ? { ...payload, consent_given: form.consent_given } : payload);
        await author.refresh(saved, { revalidate: false });
      }
      setEdit(null);
      toast.success(authorId ? 'Author saved' : 'Author created');
    } catch (err) {
      const message = blogErrorMessage(err, 'Could not save the author');
      const field = blogErrorField(message, ERROR_FIELDS);
      if (field) setFieldErrors({ [field]: message });
      else setFormError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const saveTranslation = async () => {
    if (!authorId) return;
    setBusy(true);
    try {
      const saved = await saveBlogAuthorTranslation(authorId, locale, {
        role_title: nullIfEmpty(trForm.role_title),
        short_bio: nullIfEmpty(trForm.short_bio),
        long_bio: nullIfEmpty(trForm.long_bio),
        custom_section_md: nullIfEmpty(trForm.custom_section_md),
      });
      setTrEdits((prev) => {
        const next = { ...prev };
        delete next[locale];
        return next;
      });
      await author.refresh(saved, { revalidate: false });
      toast.success(`${blogLocaleLabel(locale)} profile text saved`);
    } catch (err) {
      toast.error(blogErrorMessage(err, 'Could not save the profile text'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!server) return;
    if (await confirmAndDeleteAuthor(server, confirm, toast)) router.push('/content/blog/authors');
  };

  const backLink = (
    <Link href="/content/blog/authors" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" aria-hidden="true" /> All authors
    </Link>
  );

  if (authorId && author.isError) {
    return (
      <>
        <PageBreadCrumb pageTitle="Edit author" eyebrow={backLink} />
        <BlogStateBlock tone="error">Failed to load this author. {blogErrorMessage(author.isError, '')}</BlogStateBlock>
      </>
    );
  }
  if (authorId && author.isLoading) {
    return (
      <>
        <PageBreadCrumb pageTitle="Edit author" eyebrow={backLink} />
        <BlogStateBlock>Loading…</BlogStateBlock>
      </>
    );
  }

  const accentValid = /^#[0-9a-fA-F]{6}$/.test(form.accent_color);

  return (
    <>
      {confirmModal}
      <PageBreadCrumb
        pageTitle={authorId ? server?.display_name || 'Edit author' : 'New author'}
        eyebrow={backLink}
        description={
          server ? `Credited on ${server.post_count} post${server.post_count === 1 ? '' : 's'} · updated ${formatBlogDate(server.updated_at)}` : undefined
        }
        actions={
          authorId ? (
            <button type="button" className={DANGER_BUTTON} onClick={() => void remove()} disabled={busy}>
              <Trash2 className="size-4" aria-hidden="true" /> Delete author
            </button>
          ) : null
        }
      />

      <div className="space-y-6">
        <form
          className="rounded-xl border border-border bg-card p-5"
          aria-labelledby="author-profile-heading"
          onSubmit={(e) => {
            e.preventDefault();
            void saveProfile();
          }}
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 id="author-profile-heading" className="text-base font-semibold text-foreground">
              Profile
            </h2>
            <button type="submit" className={PRIMARY_BUTTON} disabled={busy}>
              {authorId ? 'Save profile' : 'Create author'}
            </button>
          </div>
          {formError ? (
            <p role="alert" className="mb-3 text-sm text-destructive">
              {formError}
            </p>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-2">
            <BlogField id="author-name" label="Display name" error={fieldErrors.display_name}>
              <input
                id="author-name"
                value={form.display_name}
                maxLength={120}
                onChange={(e) => update({ display_name: e.target.value })}
                aria-invalid={fieldErrors.display_name ? true : undefined}
                className={BLOG_INPUT_CLASS}
                required
              />
            </BlogField>
            <BlogField
              id="author-slug"
              label="Slug"
              error={fieldErrors.slug}
              hint={authorId ? 'Changing it moves the profile URL; the old one redirects.' : 'Leave empty to generate it from the name.'}
            >
              <input
                id="author-slug"
                value={form.slug}
                maxLength={80}
                onChange={(e) => update({ slug: e.target.value })}
                aria-invalid={fieldErrors.slug ? true : undefined}
                className={cn(BLOG_INPUT_CLASS, 'font-mono')}
              />
            </BlogField>

            <BlogImageField
              id="author-avatar"
              label="Avatar"
              value={form.avatar_url}
              error={fieldErrors.avatar_url}
              onChange={(url, mediaId) => update({ avatar_url: url, avatar_media_id: mediaId })}
            />
            <BlogImageField
              id="author-cover"
              label="Cover image"
              value={form.cover_url}
              error={fieldErrors.cover_url}
              onChange={(url, mediaId) => update({ cover_url: url, cover_media_id: mediaId })}
            />

            <BlogField id="author-accent" label="Accent colour" error={fieldErrors.accent_color} hint="Hex colour like #ffc837. Optional.">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Pick accent colour"
                  value={accentValid ? form.accent_color : '#ffc837'}
                  onChange={(e) => update({ accent_color: e.target.value })}
                  className="h-10 w-12 cursor-pointer rounded-md border border-input bg-card p-1"
                />
                <input
                  id="author-accent"
                  value={form.accent_color}
                  onChange={(e) => update({ accent_color: e.target.value })}
                  placeholder="#ffc837"
                  aria-invalid={fieldErrors.accent_color ? true : undefined}
                  className={cn(BLOG_INPUT_CLASS, 'font-mono')}
                />
              </div>
            </BlogField>
            <BlogField id="author-location" label="Location">
              <input
                id="author-location"
                value={form.location}
                maxLength={120}
                onChange={(e) => update({ location: e.target.value })}
                placeholder="Lagos, Nigeria"
                className={BLOG_INPUT_CLASS}
              />
            </BlogField>
            <BlogField id="author-languages" label="Languages spoken" hint="Comma separated, e.g. Yorùbá, English.">
              <input
                id="author-languages"
                value={form.languages_spoken}
                onChange={(e) => update({ languages_spoken: e.target.value })}
                className={BLOG_INPUT_CLASS}
              />
            </BlogField>
            <BlogField id="author-email" label="Public contact email" error={fieldErrors.contact_email} hint="Shown on the profile. Optional.">
              <input
                id="author-email"
                type="email"
                value={form.contact_email}
                onChange={(e) => update({ contact_email: e.target.value })}
                aria-invalid={fieldErrors.contact_email ? true : undefined}
                className={BLOG_INPUT_CLASS}
              />
            </BlogField>
            <BlogField id="author-staff" label="Linked staff user" hint="Optional. Links the profile to a dashboard account.">
              {isAdmin ? (
                <StaffUserSelect value={form.admin_user_id} onChange={(id) => update({ admin_user_id: id })} />
              ) : (
                <input
                  id="author-staff"
                  value={form.admin_user_id}
                  onChange={(e) => update({ admin_user_id: e.target.value })}
                  placeholder="Staff user id (optional)"
                  className={cn(BLOG_INPUT_CLASS, 'font-mono')}
                />
              )}
            </BlogField>
          </div>

          <fieldset className="mt-6">
            <legend className="mb-2 text-sm font-semibold text-foreground">Social links</legend>
            <div className="grid gap-4 md:grid-cols-2">
              {BLOG_SOCIAL_KEYS.map((key) => (
                <BlogField key={key} id={`author-social-${key}`} label={SOCIAL_LABELS[key]} error={fieldErrors[key]}>
                  <input
                    id={`author-social-${key}`}
                    type="url"
                    inputMode="url"
                    value={form.social_links[key]}
                    onChange={(e) => updateSocial(key, e.target.value)}
                    placeholder={SOCIAL_PLACEHOLDERS[key]}
                    aria-invalid={fieldErrors[key] ? true : undefined}
                    aria-describedby={fieldErrors[key] ? `author-social-${key}-error` : undefined}
                    className={BLOG_INPUT_CLASS}
                  />
                </BlogField>
              ))}
            </div>
          </fieldset>

          <div className="mt-6 space-y-3 border-t border-border pt-4">
            <label className="flex items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.consent_given}
                onChange={(e) => update({ consent_given: e.target.checked })}
                className="mt-0.5 size-4 rounded border-input"
              />
              <span>
                Author agreed to a public profile
                <span className="block text-xs text-muted-foreground">
                  Required for the profile to appear on the site.
                  {server?.consent_given_at ? ` Recorded ${formatBlogDate(server.consent_given_at)}.` : ''}
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => update({ is_active: e.target.checked })}
                className="mt-0.5 size-4 rounded border-input"
              />
              <span>
                Active
                <span className="block text-xs text-muted-foreground">Inactive profiles are hidden from the site but stay credited on posts.</span>
              </span>
            </label>
          </div>
        </form>

        <section className="rounded-xl border border-border bg-card p-5" aria-label="Profile text per language">
          <h2 className="mb-2 text-base font-semibold text-foreground">Profile text</h2>
          {!authorId ? (
            <BlogStateBlock>Create the author first, then add the profile text for each language.</BlogStateBlock>
          ) : locales.length === 0 ? (
            <BlogStateBlock tone="error">Could not load the blog languages.</BlogStateBlock>
          ) : (
            <>
              <BlogLocaleTabs
                label="Profile languages"
                tabs={locales.map((loc) => ({
                  locale: loc,
                  badge: translations.has(loc) ? null : <span className="text-xs text-muted-foreground">missing</span>,
                  dirty: Boolean(trEdits[loc]),
                }))}
                active={locale}
                onChange={setActiveTab}
              />
              {!translations.has(locale) ? (
                <p className="mt-3 text-sm text-muted-foreground">No {blogLocaleLabel(locale)} profile text yet.</p>
              ) : null}
              <div className="mt-4 grid gap-5 lg:grid-cols-2">
                <BlogField id="author-role-title" label="Role title" count={trForm.role_title.length} max={120}>
                  <input
                    id="author-role-title"
                    value={trForm.role_title}
                    maxLength={120}
                    onChange={(e) => updateTr({ role_title: e.target.value })}
                    placeholder="Yorùbá teacher"
                    className={BLOG_INPUT_CLASS}
                  />
                </BlogField>
                <BlogField id="author-short-bio" label="Short bio" count={trForm.short_bio.length} max={300} hint="Shown under posts.">
                  <textarea
                    id="author-short-bio"
                    rows={3}
                    value={trForm.short_bio}
                    maxLength={300}
                    onChange={(e) => updateTr({ short_bio: e.target.value })}
                    className={BLOG_INPUT_CLASS}
                  />
                </BlogField>
                <div className="lg:col-span-2">
                  <MarkdownField id="author-long-bio" label="Long bio" value={trForm.long_bio} onChange={(long_bio) => updateTr({ long_bio })} rows={8} />
                </div>
                <div className="lg:col-span-2">
                  <MarkdownField
                    id="author-custom-section"
                    label="Custom section (Markdown)"
                    value={trForm.custom_section_md}
                    onChange={(custom_section_md) => updateTr({ custom_section_md })}
                    rows={8}
                    hint="Optional extra section on the profile page."
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button type="button" className={PRIMARY_BUTTON} onClick={() => void saveTranslation()} disabled={busy}>
                  Save {blogLocaleLabel(locale)} text
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}

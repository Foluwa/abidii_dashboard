import { apiClient } from '@/lib/api';
import type {
  BlogAuthor,
  BlogAuthorInput,
  BlogAuthorTranslationInput,
  BlogPost,
  BlogPostCreateInput,
  BlogPostSharedInput,
  BlogPostTranslation,
  BlogTag,
  BlogTagInput,
  BlogTranslationInput,
} from '@/types/blog';

/** Blog mini CMS (TODO #43): writes. Reads live in hooks/useApi.ts. */
const BASE = '/api/v1/admin/blog';

const enc = encodeURIComponent;

// ---------------------------------------------------------------------- posts
export async function createBlogPost(payload: BlogPostCreateInput) {
  const res = await apiClient.post<BlogPost>(`${BASE}/posts`, payload);
  return res.data;
}

export async function updateBlogPost(postId: string, payload: BlogPostSharedInput) {
  const res = await apiClient.patch<BlogPost>(`${BASE}/posts/${enc(postId)}`, payload);
  return res.data;
}

export async function deleteBlogPost(postId: string) {
  await apiClient.delete(`${BASE}/posts/${enc(postId)}`);
}

export async function saveBlogTranslation(postId: string, locale: string, payload: BlogTranslationInput) {
  const res = await apiClient.put<BlogPostTranslation>(
    `${BASE}/posts/${enc(postId)}/translations/${enc(locale)}`,
    payload,
  );
  return res.data;
}

/** No date = publish now; a future date schedules the language version. */
export async function publishBlogTranslation(postId: string, locale: string, publishedAt?: string | null) {
  const res = await apiClient.post<BlogPostTranslation>(
    `${BASE}/posts/${enc(postId)}/translations/${enc(locale)}/publish`,
    publishedAt ? { published_at: publishedAt } : {},
  );
  return res.data;
}

export async function unpublishBlogTranslation(postId: string, locale: string) {
  const res = await apiClient.post<BlogPostTranslation>(
    `${BASE}/posts/${enc(postId)}/translations/${enc(locale)}/unpublish`,
    {},
  );
  return res.data;
}

export async function deleteBlogTranslation(postId: string, locale: string) {
  await apiClient.delete(`${BASE}/posts/${enc(postId)}/translations/${enc(locale)}`);
}

// ----------------------------------------------------------------------- tags
export async function createBlogTag(payload: BlogTagInput) {
  const res = await apiClient.post<BlogTag>(`${BASE}/tags`, payload);
  return res.data;
}

export async function updateBlogTag(tagId: string, payload: Partial<BlogTagInput>) {
  const res = await apiClient.patch<BlogTag>(`${BASE}/tags/${enc(tagId)}`, payload);
  return res.data;
}

export async function deleteBlogTag(tagId: string) {
  await apiClient.delete(`${BASE}/tags/${enc(tagId)}`);
}

// -------------------------------------------------------------------- authors
export async function createBlogAuthor(payload: BlogAuthorInput) {
  const res = await apiClient.post<BlogAuthor>(`${BASE}/authors`, payload);
  return res.data;
}

export async function updateBlogAuthor(authorId: string, payload: BlogAuthorInput) {
  const res = await apiClient.patch<BlogAuthor>(`${BASE}/authors/${enc(authorId)}`, payload);
  return res.data;
}

export async function saveBlogAuthorTranslation(authorId: string, locale: string, payload: BlogAuthorTranslationInput) {
  const res = await apiClient.put<BlogAuthor>(`${BASE}/authors/${enc(authorId)}/translations/${enc(locale)}`, payload);
  return res.data;
}

export async function deleteBlogAuthor(authorId: string) {
  await apiClient.delete(`${BASE}/authors/${enc(authorId)}`);
}

// -------------------------------------------------------------------- helpers
/** API error -> message: the backend's `detail` string (422/409/404) when present. */
export function blogErrorMessage(err: unknown, fallback: string) {
  const e = err as { response?: { data?: { error?: { message?: string }; detail?: unknown } }; message?: string };
  const data = e?.response?.data;
  if (typeof data?.detail === 'string') return data.detail;
  if (Array.isArray(data?.detail)) {
    // FastAPI/pydantic shape: [{loc: [..., field], msg}]
    const first = data.detail[0] as { loc?: unknown[]; msg?: string } | undefined;
    if (first?.msg) {
      const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : null;
      return field ? `${String(field)}: ${first.msg}` : first.msg;
    }
  }
  if (data?.error?.message) return data.error.message;
  return e?.message ?? fallback;
}

export function blogErrorStatus(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status;
}

/**
 * Which form field a 422 message is about, e.g. "x: must be a full https://
 * URL." -> "x", "contact_email is not a valid…" -> "contact_email". The
 * backend prefixes its messages with the field key; null when none matches.
 */
export function blogErrorField(message: string, fields: readonly string[]): string | null {
  const lower = message.toLowerCase();
  // Longest first so "cover_url" wins over a shorter key it contains.
  const sorted = [...fields].sort((a, b) => b.length - a.length);
  for (const field of sorted) {
    if (lower.startsWith(`${field}:`) || lower.startsWith(`${field} `)) return field;
  }
  return null;
}

/**
 * Mirrors blog_service.slugify: Yorùbá underdots fold to the base letter
 * (ẹ->e, ọ->o, ṣ->s), tone marks drop, ASCII only.
 */
export function blogSlugify(text: string, maxLen = 80): string {
  const ascii = (text || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, '')
    .toLowerCase();
  return ascii
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, maxLen)
    .replace(/-+$/g, '');
}

export const BLOG_SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function blogLocaleLabel(locale: string): string {
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'language' }).of(locale);
    return name && name !== locale ? name : locale.toUpperCase();
  } catch {
    return locale.toUpperCase();
  }
}

/** ISO timestamp -> value for <input type="datetime-local"> (local time). */
export function toLocalDateTimeInput(value: string | null | undefined) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatBlogDate(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

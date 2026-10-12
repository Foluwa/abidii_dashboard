/** Blog mini CMS (TODO #43). Mirrors app/routers/admin_blog.py. */

export type BlogPostStatus = 'draft' | 'scheduled' | 'published';
export type BlogAuthorRole = 'author' | 'reviewer';

export interface BlogLocalesResponse {
  locales: string[];
}

/** One language version as returned in the posts list. */
export interface BlogPostListTranslation {
  locale: string;
  title: string;
  slug: string;
  status: BlogPostStatus;
  published_at: string | null;
  updated_at: string;
}

export interface BlogPostListItem {
  id: string;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
  translations: BlogPostListTranslation[];
}

export interface BlogPostListResponse {
  items: BlogPostListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/** Full language version row (blog_post_translations). */
export interface BlogPostTranslation {
  id: string;
  post_id: string;
  locale: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body_md: string;
  seo_title: string | null;
  seo_description: string | null;
  status: BlogPostStatus;
  published_at: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlogPostTagRef {
  id: string;
  slug: string;
}

export interface BlogPostAuthorRef {
  id: string;
  slug: string;
  display_name: string;
  avatar_url: string | null;
  role: BlogAuthorRole;
  position: number;
}

export interface BlogPost {
  id: string;
  cover_image_url: string | null;
  cover_media_id: string | null;
  og_image_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  translations: BlogPostTranslation[];
  tags: BlogPostTagRef[];
  authors: BlogPostAuthorRef[];
}

export interface BlogTranslationInput {
  title: string;
  slug?: string | null;
  excerpt?: string | null;
  body_md: string;
  seo_title?: string | null;
  seo_description?: string | null;
}

export interface BlogAuthorAssignment {
  author_id: string;
  role: BlogAuthorRole;
}

export interface BlogPostSharedInput {
  cover_image_url?: string | null;
  cover_media_id?: string | null;
  og_image_url?: string | null;
  tag_ids?: string[];
  authors?: BlogAuthorAssignment[];
}

export interface BlogPostCreateInput extends BlogPostSharedInput {
  locale?: string;
  translation?: BlogTranslationInput;
}

export interface BlogRevision {
  id: string;
  created_at: string;
  editor_user_id: string | null;
  editor_email: string | null;
  /** The translation row as it was saved. */
  snapshot: Partial<BlogPostTranslation>;
}

export interface BlogRevisionListResponse {
  items: BlogRevision[];
}

export interface BlogTag {
  id: string;
  slug: string;
  /** locale -> name */
  names: Record<string, string>;
  post_count?: number;
}

export interface BlogTagListResponse {
  items: BlogTag[];
}

export interface BlogTagInput {
  slug: string;
  names: Record<string, string>;
}

export const BLOG_SOCIAL_KEYS = [
  'website',
  'x',
  'instagram',
  'tiktok',
  'youtube',
  'linkedin',
  'facebook',
  'github',
] as const;

export type BlogSocialKey = (typeof BLOG_SOCIAL_KEYS)[number];

export interface BlogAuthorListItem {
  id: string;
  slug: string;
  display_name: string;
  avatar_url: string | null;
  is_active: boolean;
  consent_given_at: string | null;
  post_count: number;
}

export interface BlogAuthorListResponse {
  items: BlogAuthorListItem[];
}

export interface BlogAuthorTranslation {
  locale: string;
  role_title: string | null;
  short_bio: string | null;
  long_bio: string | null;
  custom_section_md: string | null;
  updated_at: string;
}

export interface BlogAuthor {
  id: string;
  slug: string;
  display_name: string;
  avatar_url: string | null;
  avatar_media_id: string | null;
  cover_url: string | null;
  cover_media_id: string | null;
  accent_color: string | null;
  location: string | null;
  languages_spoken: string[];
  social_links: Partial<Record<BlogSocialKey, string>>;
  contact_email: string | null;
  admin_user_id: string | null;
  consent_given_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  translations: BlogAuthorTranslation[];
  post_count: number;
}

export interface BlogAuthorInput {
  display_name?: string;
  slug?: string | null;
  avatar_url?: string | null;
  avatar_media_id?: string | null;
  cover_url?: string | null;
  cover_media_id?: string | null;
  accent_color?: string | null;
  location?: string | null;
  languages_spoken?: string[];
  social_links?: Partial<Record<BlogSocialKey, string | null>>;
  contact_email?: string | null;
  admin_user_id?: string | null;
  consent_given?: boolean;
  is_active?: boolean;
}

export interface BlogAuthorTranslationInput {
  role_title?: string | null;
  short_bio?: string | null;
  long_bio?: string | null;
  custom_section_md?: string | null;
}

/**
 * Content Management Types
 * Types for sentences, phrases, and content versioning
 */

export interface Sentence {
  id: string;
  language_id: string;
  text: string;
  translation: string;
  romanization: string | null;
  difficulty_level: number | null;
  category: string | null;
  tags: string[];
  usage_context: string | null;
  cultural_notes: string | null;
  is_published: boolean;
  published_at: string | null;
  audio_url: string | null;
  audio_duration_sec: number | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SentenceCreate {
  language_id: string;
  text: string;
  translation: string;
  romanization?: string;
  difficulty_level?: number;
  category?: string;
  tags?: string[];
  usage_context?: string;
  cultural_notes?: string;
  is_published?: boolean;
}

export interface SentenceUpdate {
  text?: string;
  translation?: string;
  romanization?: string;
  difficulty_level?: number;
  category?: string;
  tags?: string[];
  usage_context?: string;
  cultural_notes?: string;
  is_published?: boolean;
  audio_url?: string;
}

export interface Phrase {
  id: string;
  language_id: string;
  phrase: string;
  translation: string;
  literal_translation: string | null;
  romanization: string | null;
  difficulty_level: number | null;
  category: string | null;
  tags: string[];
  usage_context: string | null;
  cultural_notes: string | null;
  is_published: boolean;
  published_at: string | null;
  audio_url: string | null;
  audio_duration_sec: number | null;
  last_regeneration_status?: string | null;
  last_regeneration_error?: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PhraseCreate {
  language_id: string;
  phrase: string;
  translation: string;
  literal_translation?: string;
  romanization?: string;
  difficulty_level?: number;
  category?: string;
  tags?: string[];
  usage_context?: string;
  cultural_notes?: string;
  is_published?: boolean;
}

export interface PhraseUpdate {
  phrase?: string;
  translation?: string;
  literal_translation?: string;
  romanization?: string;
  difficulty_level?: number;
  category?: string;
  tags?: string[];
  usage_context?: string;
  cultural_notes?: string;
  is_published?: boolean;
  audio_url?: string;
}

export interface ContentVersion {
  id: string;
  content_type: string;
  content_id: string;
  version_number: number;
  change_summary: string | null;
  content_snapshot: Record<string, unknown>;
  diff: Record<string, unknown> | null;
  edited_by: string | null;
  edited_at: string;
}

/**
 * Learning Items (Games & Lessons)
 */
export interface LearningItem {
  id: string;
  language_id: string;
  item_key: string;
  title: string;
  about: string;
  icon_name: string;
  image_url: string | null;
  image_fit: 'cover' | 'contain' | null;
  level: string;
  difficulty: string;
  duration_minutes: number;
  xp_reward: number;
  item_type: 'game' | 'lesson';
  launch_route: string;
  is_active: boolean;
  is_premium: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface LearningItemCreate {
  language_id: string;
  item_key: string;
  title: string;
  about?: string;
  icon_name?: string;
  image_url?: string;
  image_fit?: 'cover' | 'contain';
  level?: string;
  difficulty?: string;
  duration_minutes?: number;
  xp_reward?: number;
  item_type?: 'game' | 'lesson';
  launch_route?: string;
  is_active?: boolean;
  is_premium?: boolean;
  display_order?: number;
}

export interface LearningItemUpdate {
  title?: string;
  about?: string;
  icon_name?: string;
  image_url?: string;
  image_fit?: 'cover' | 'contain';
  level?: string;
  difficulty?: string;
  duration_minutes?: number;
  xp_reward?: number;
  item_type?: 'game' | 'lesson';
  launch_route?: string;
  is_active?: boolean;
  is_premium?: boolean;
  display_order?: number;
}

/**
 * Pagination
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * Content filters
 */
export interface ContentFilters {
  language_id?: string;
  difficulty?: number;
  category?: string;
  is_published?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
}

/**
 * Learning Engine v2 Types
 */

// Content Pattern
export interface ContentPattern {
  id: string;
  language_id: string;
  pattern_key: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  difficulty: number;
  category: string | null;
  sort_order: number;
  config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ContentPatternCreate {
  language_id: string;
  pattern_key: string;
  title: string;
  subtitle?: string;
  description?: string;
  difficulty?: number;
  category?: string;
  sort_order?: number;
  config?: Record<string, unknown>;
}

export interface ContentPatternUpdate {
  pattern_key?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  difficulty?: number;
  category?: string;
  sort_order?: number;
  config?: Record<string, unknown>;
}

// Pattern Explanation
export interface PatternExplanation {
  id: string;
  language_id: string;
  target_type: 'pattern' | 'content_item';
  target_id: string;
  explanation_type: 'how' | 'why' | 'rule' | 'mnemonic' | 'history' | 'tip';
  title: string;
  body: string;
  body_rich: unknown | null;
  is_brief_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PatternExplanationCreate {
  language_id: string;
  target_type: 'pattern' | 'content_item';
  target_id: string;
  explanation_type: string;
  title: string;
  body: string;
  body_rich?: unknown;
  is_brief_default?: boolean;
  sort_order?: number;
}

export interface PatternExplanationUpdate {
  explanation_type?: string;
  title?: string;
  body?: string;
  body_rich?: unknown;
  is_brief_default?: boolean;
  sort_order?: number;
}

// Content Asset
export interface ContentAsset {
  id: string;
  language_id: string;
  target_type: 'pattern' | 'content_item' | 'learning_item';
  target_id: string;
  asset_type: 'svg' | 'image' | 'audio' | 'video' | 'lottie';
  asset_role: 'illustration' | 'diagram' | 'icon' | 'animation' | 'audio_clip';
  asset_url: string | null;
  svg_content: string | null;
  alt_text: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ContentAssetCreate {
  language_id: string;
  target_type: string;
  target_id: string;
  asset_type: string;
  asset_role: string;
  asset_url?: string;
  svg_content?: string;
  alt_text?: string;
  sort_order?: number;
}

export interface ContentAssetUpdate {
  asset_type?: string;
  asset_role?: string;
  asset_url?: string;
  svg_content?: string;
  alt_text?: string;
  sort_order?: number;
}

// Content Example
export interface ContentExample {
  id: string;
  language_id: string;
  target_type: 'pattern' | 'content_item';
  target_id: string;
  example_text: string;
  translation_text: string | null;
  context_tag: string | null;
  difficulty: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ContentExampleCreate {
  language_id: string;
  target_type: string;
  target_id: string;
  example_text: string;
  translation_text?: string;
  context_tag?: string;
  difficulty?: number;
  sort_order?: number;
}

export interface ContentExampleUpdate {
  example_text?: string;
  translation_text?: string;
  context_tag?: string;
  difficulty?: number;
  sort_order?: number;
}

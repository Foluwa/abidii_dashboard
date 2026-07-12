/**
 * System Management Types
 */

export interface SystemStatus {
  monitoring_enabled: boolean;
  telegram_configured: boolean;
  telegram_connected: boolean;
  alert_queue_size: number;
  circuit_breaker_open: boolean;
  config_cache_age_seconds: number;
  uptime_seconds: number;
}

export interface ServiceHealth {
  name: string;
  status: 'online' | 'offline' | 'not_configured';
  detail: string | null;
  latency_ms: number | null;
}

export interface ServicesStatusResponse {
  services: ServiceHealth[];
}

export interface ConfigEntry {
  key: string;
  value_type: string;
  value_int: number | null;
  value_float: number | null;
  value_text: string | null;
  value_bool: boolean | null;
  description: string | null;
  category: string | null;
  is_active: boolean;
  updated_at: string | null;
}

// Legacy config format (alert_config table)
export interface LegacyConfigEntry {
  key: string;
  value: string;
  value_type: string;
  description: string | null;
  updated_at: string;
}

export interface AppSetting {
  setting_key: string;
  setting_value: Record<string, any>;
  description: string | null;
  category: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export type AlertLevel = 'critical' | 'error' | 'warning' | 'info';
export type AlertCategory = 'telegram' | 'system' | 'resource' | 'error';

export interface AlertHistoryItem {
  id: number;
  alert_level: AlertLevel;
  alert_category: AlertCategory;
  message: string;
  metadata: Record<string, any> | null;
  sent_at: string;
  sent_successfully: boolean;
  error_message: string | null;
}

export interface AlertHistoryResponse {
  items: AlertHistoryItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface AlertFilters {
  limit?: number;
  page?: number;
  level?: AlertLevel;
  category?: AlertCategory;
  hours?: number;
}

export interface SystemMetrics {
  // Define based on actual API response
  cpu_usage?: number;
  memory_usage?: number;
  timestamp?: string;
}

export interface IdempotencyHealth {
  total_requests?: number;
  unique_users?: number;
  cache_hit_rate?: number;
  table_size?: string;
}

export interface CronJob {
  job_id: number;
  job_name: string;
  schedule: string;
  command: string;
  active: boolean;
}

/**
 * Billing / Subscription Types
 */

export type BillingPeriod = 'monthly' | 'annual' | string;

export interface BillingPlan {
  plan_id: string;
  name: string;
  description: string;
  price_display: string;
  apple_price_display?: string | null;
  google_price_display?: string | null;
  billing_period: BillingPeriod;
  features: string[];
  apple_product_id: string;
  google_product_id: string;
  google_base_plan_id: string;
  stripe_price_id?: string;
  is_popular: boolean;
}

/**
 * User Management Types
 */

export interface UserListItem {
  id: string;
  email: string | null;
  display_name: string | null;
  role: 'admin' | 'manager' | 'user';
  created_at: string;
  updated_at: string;
  last_login?: string;
  last_login_at?: string | null;
  last_request_at?: string | null;
  last_activity_date?: string | null;
  is_active?: boolean;
  device_platform?: string | null;
  device_name?: string | null;
  device_app_version?: string | null;
  device_build_number?: string | null;
  country_code?: string | null;

  // Premium entitlement summary (computed from subscriptions)
  has_premium?: boolean;
  premium_plan_id?: string | null;
  premium_status?: string | null;
  premium_current_period_start?: string | null;
  premium_current_period_end?: string | null;
  premium_platform?: string | null;
  premium_provider?: string | null;
}

export interface UserDetail extends UserListItem {
  picture_url: string | null;
  avatar_config: Record<string, unknown> | null;
  total_xp: number;
  current_level: number;
  current_streak: number;
  languages?: Array<{
    language_id: string;
    language_name: string;
    total_xp: number;
    lessons_completed: number;
  }>;
}

export interface SystemStats {
  total_users: number;
  active_users_today: number;
  total_lessons: number;
  total_words: number;
  total_languages: number;
}

/**
 * Content Management Types
 */

export interface Language {
  id: string;  // UUID
  name: string;
  native_name: string;
  iso_639_3: string;
  direction?: string;
  text_direction?: string;
  is_tonal: boolean;
  is_deleted: boolean;
  flag_emoji?: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  // Stats (from public endpoint)
  total_letters?: number;
  total_contrasts?: number;
  total_phonics?: number;
  total_learners?: number;
  user_count?: number;
  is_available?: boolean;
}

export type LessonStatus = 'draft' | 'published' | 'archived';

export interface Lesson {
  id: number;
  language_id: number;
  order: number;
  title: string;
  description: string | null;
  image_url: string | null;
  status: LessonStatus;
  created_at: string;
  updated_at: string;
}

export interface LessonCreateRequest {
  language_id: number;
  order: number;
  title: string;
  description?: string;
  image_url?: string;
  status?: LessonStatus;
}

export interface Word {
  id: number;
  language_id: number;
  word: string;
  translation: string;
  pronunciation: string | null;
  audio_url: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Proverb {
  id: string; // UUID
  language_id: number;
  proverb: string;
  translation: string;
  meaning: string | null;
  category: string | null;
  is_published?: boolean;
  published_at?: string | null;
  audio_url?: string | null;
  audio_format?: string | null;
  audio_duration?: number | null;
  last_regeneration_status?: string | null;
  last_regeneration_error?: string | null;
  alignment_status?: 'draft' | 'reviewed' | 'approved' | 'stale' | null;
  alignment_updated_at?: string | null;
  alignment_stale_reason?: string | null;
  alignment_job_status?: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'superseded' | null;
  alignment_job_provider?: string | null;
  alignment_job_engine?: string | null;
  alignment_job_error?: string | null;
  alignment_job_updated_at?: string | null;
  pending_audio_version?: {
    id: string;
    audio_url: string | null;
    status: string;
    created_at: string | null;
  } | null;
  yoruba_prompt?: string | null;
  yoruba_answer?: string | null;
  is_game_ready?: boolean;
  created_at: string;
  updated_at: string;
}

export interface AudioVariant {
  audio_url: string;
  duration_sec: number | null;
  voice_name: string;
  language_code: string;
}

/**
 * Pagination Types
 */

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_more: boolean;
}

/**
 * Filter/Query Types
 */

export interface UserFilters {
  page?: number;
  page_size?: number;
  role?: 'admin' | 'manager' | 'user';
  search?: string;
}

export interface ContentFilters {
  page?: number;
  page_size?: number;
  language_code?: string;
  category?: string;
  difficulty?: number;
  search?: string;
}
/**
 * Game Management Types
 */

export type GameType = 'flashcard' | 'quiz' | 'matching' | 'fill_blank' | 'pronunciation';

export interface Game {
  id: number;
  language_id: number;
  game_type: GameType;
  title: string;
  description: string | null;
  rules: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GameCreateRequest {
  language_id: number;
  game_type: GameType;
  title: string;
  description?: string;
  rules?: Record<string, any>;
  is_active?: boolean;
}

export interface Sentence {
  id: number;
  language_id: number;
  text: string;
  translation: string;
  audio_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Phrase {
  id: number;
  language_id: number;
  text: string;
  translation: string;
  audio_url?: string | null;
  created_at: string;
  updated_at: string;
}

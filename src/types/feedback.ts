// Feedback form responses (backend migration 218, /api/v1/admin/feedback).

export type FeedbackStatus = 'new' | 'read' | 'archived';

export interface FeedbackItem {
  id: string;
  created_at: string;
  source: 'app' | 'web';
  page_locale: string;
  app_language: string | null;
  platform: string | null;
  app_version: string | null;
  usage_frequency: number;
  features_used: string[];
  favourite_feature: string | null;
  tracing_rating: number | null;
  recommend_score: number | null;
  improve_text: string | null;
  other_text: string | null;
  contact_email: string | null;
  status: FeedbackStatus;
}

export interface FeedbackListResponse {
  items: FeedbackItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface FeedbackSummary {
  total: number;
  unread: number;
  avg_usage_frequency: number | null;
  avg_tracing_rating: number | null;
  recommend_answers: number;
  nps: number | null;
  usage_frequency: Record<string, number>;
  features_used: Record<string, number>;
  favourite_feature: Record<string, number>;
  by_platform_language: { platform: string; language: string; n: number }[];
}

export interface FeedbackFilters {
  page?: number;
  limit?: number;
  status?: string;
  platform?: string;
  language?: string;
  q?: string;
}

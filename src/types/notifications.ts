export interface NotificationSendRequest {
  user_ids: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface NotificationBroadcastRequest {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface NotificationResponse {
  success: boolean;
  message: string;
  android_sent: number;
  ios_sent: number;
  failed: number;
}

// {"android": {"unregistered": 2}, "ios": {"error": 1}, "other": {"no_push_token": 1}}
// - per-platform failure category counts. Only populated for notifications
// sent after this was added; older rows have nothing to recover it from.
export type NotificationFailureReasons = Record<string, Record<string, number>>;

export interface NotificationLogItem {
  id: string;
  notification_type: string;
  title: string;
  body: string;
  target_type: string;
  target_count: number;
  android_sent: number;
  ios_sent: number;
  failed_count: number;
  sent_by: string;
  created_at: string;
  failure_reasons: NotificationFailureReasons | null;
}

export interface DailyContentFeedItem {
  content_log_id: string;
  content_date: string;
  content_type: string;
  language_code: string;
  content_text: string;
  target_count: number;
  android_sent: number;
  ios_sent: number;
  failed_count: number;
  sent_count: number;
  open_count: number;
}

export interface AudienceSnapshotItem {
  snapshot_date: string;
  total_eligible: number;
  android_eligible: number;
  ios_eligible: number;
}

export interface TeaserQuizFeedItem {
  quiz_log_id: string;
  word_text: string;
  language_code: string;
  prompt_text: string;
  sent_at: string;
  opened_at: string | null;
  answered_at: string | null;
  was_correct: boolean | null;
  xp_awarded: number;
}

export interface TeaserQuizFeedResponse {
  total: number;
  items: TeaserQuizFeedItem[];
}

export interface OpenRateBreakdownItem {
  group_label: string;
  sent_count: number;
  open_count: number;
  open_rate: number;
}

export type OpenRateDimension = 'country' | 'fluency' | 'device' | 'premium';

export interface TeaserQuizStats {
  total_sent: number;
  total_opened: number;
  total_answered: number;
  total_correct: number;
}

export interface DailyWordOverrideRequest {
  content_date: string; // YYYY-MM-DD
  language_code: string;
  word_id: string;
}

export interface DailyWordOverrideResponse {
  content_log_id: string;
  content_date: string;
  language_code: string;
  word_id: string;
  word_text: string;
}

export interface DailyContentPreviewItem {
  content_date: string;
  language_code: string;
  word_id: string;
  word_text: string;
  english_lemma: string;
  // "locked": already in daily_content_log (an override, or the scheduler
  // already ran for that date) - this is what will actually be sent.
  // "computed": no row yet, this is a preview of what the auto-picker
  // would choose today - not guaranteed if the eligible word pool
  // changes before that date arrives.
  source: 'locked' | 'computed';
}

export interface NotificationSchedule {
  daily_word_time: string; // HH:MM, 24h UTC
  teaser_quiz_time: string;
}

export interface NotificationScheduleUpdate {
  daily_word_time?: string;
  teaser_quiz_time?: string;
}

export interface DictionarySearchResult {
  id: string;
  lemma: string;
  pos: string;
  ipas: string[];
  glosses: string[];
}

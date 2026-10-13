export interface CurriculumOpsMetricRow {
  day: string; // YYYY-MM-DD
  action: string;
  result: string;
  count: number;
}

export interface CurriculumOpsMetricsResponse {
  window_days: number;
  rows: CurriculumOpsMetricRow[];
}

// GET /api/v1/admin/analytics/rooms
// Room type/status filters mirror the backend's RoomTypeFilter/RoomStatusFilter
// enums exactly - keep in sync with app/schemas/room_analytics.py.
export type RoomTypeFilterValue = "all" | "standard" | "instant";
export type RoomStatusFilterValue = "all" | "active" | "completed" | "cancelled";

export interface RoomAnalyticsPeriod {
  date_from: string;
  date_to: string;
  days: number;
}

export interface RoomAnalyticsFilters {
  room_type: RoomTypeFilterValue;
  status: RoomStatusFilterValue;
  language_id: string | null;
}

export interface RoomAnalyticsSummary {
  total_rooms: number;
  active_rooms: number;
  completed_rooms: number;
  cancelled_rooms: number;
  unique_hosts: number;
  unique_participants: number;
  total_participant_joins: number;
  average_participants_per_room: number;
  median_participants_per_room: number;
  average_room_duration_seconds: number;
  median_room_duration_seconds: number;
  total_games_played: number;
  average_games_per_room: number;
  average_score: number;
  accuracy_percent: number;
}

export interface RoomsByDayItem {
  date: string;
  rooms_created: number;
  rooms_completed: number;
  participants: number;
}

export interface RoomsByTypeItem {
  room_type: string;
  room_count: number;
  percentage: number;
}

export interface RoomsByStatusItem {
  status: string;
  room_count: number;
  percentage: number;
}

export interface ParticipationByDayItem {
  date: string;
  joins: number;
  unique_participants: number;
}

export interface PopularGameTypeItem {
  game_type: string;
  games_played: number;
  rooms: number;
  average_score: number;
  accuracy_percent: number;
}

export interface RecentRoomItem {
  room_id: string;
  room_type: string;
  status: string;
  language: { id: string | null; code: string | null; name: string | null };
  host: {
    id: string | null;
    display_name: string | null;
    email: string | null;
    avatar_svg: string | null;
    picture_url: string | null;
  };
  participant_count: number;
  game_count: number;
  average_score: number;
  accuracy_percent: number;
  winner_id: string | null;
  configured_duration_seconds: number;
  actual_duration_seconds: number;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
}

export interface RecentRoomsPage {
  items: RecentRoomItem[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface RoomAnalyticsLimitations {
  participant_presence_is_estimated: boolean;
  participant_presence_basis: string;
  scores_and_game_type_breakdown_scope: string;
  standard_room_language_attribution: string;
  cancelled_status_supported: boolean;
  instant_room_created_at_basis: string;
}

export interface RoomAnalyticsResponse {
  period: RoomAnalyticsPeriod;
  filters: RoomAnalyticsFilters;
  summary: RoomAnalyticsSummary;
  rooms_by_day: RoomsByDayItem[];
  rooms_by_type: RoomsByTypeItem[];
  rooms_by_status: RoomsByStatusItem[];
  participation_by_day: ParticipationByDayItem[];
  popular_game_types: PopularGameTypeItem[];
  recent_rooms: RecentRoomsPage;
  limitations: RoomAnalyticsLimitations;
}

// --- User Retention (GET /admin/analytics/retention) ---------------------

export interface RetentionDayStat {
  /** null (not 0) when there are no eligible users yet for this cohort day. */
  rate: number | null;
  retained_users: number;
  eligible_users: number;
}

export interface RetentionBreakdown {
  day_1: RetentionDayStat;
  day_7: RetentionDayStat;
  day_30: RetentionDayStat;
}

export interface WeeklyReturningUsersItem {
  week_start: string;
  week_end: string;
  returning_users: number;
  active_users: number;
}

export interface RetentionMonthlySummary {
  period_label: string;
  returning_users: number;
  eligible_users: number;
  previous_comparable_returning_users: number;
  absolute_change: number;
}

export interface RetentionResponse {
  generated_at: string;
  timezone: string;
  retention: RetentionBreakdown;
  weekly_returning_users: WeeklyReturningUsersItem[];
  monthly_summary: RetentionMonthlySummary;
}

// GET /api/v1/admin/analytics/email-signin?days=N
// Built from hashed sign-in events; never contains email addresses.
export interface EmailSignInFunnel {
  addresses: number;
  codes_sent: number;
  resends: number;
  verified: number;
  not_verified: number;
  expired_unverified: number;
  verify_rate: number | null;
  median_seconds_to_verify: number | null;
  new_accounts: number;
}

export interface EmailSignInBreakdown {
  key: string;
  addresses: number;
  codes_sent: number;
  verified: number;
  verify_rate: number | null;
  median_seconds_to_verify: number | null;
}

export interface EmailSignInDay {
  date: string;
  codes_sent: number;
  verified: number;
  expired: number;
  wrong: number;
  limited: number;
}

export interface EmailSignInAnalyticsResponse {
  days: number;
  since: string;
  funnel: EmailSignInFunnel;
  by_platform: EmailSignInBreakdown[];
  by_language: EmailSignInBreakdown[];
  daily: EmailSignInDay[];
  abuse: {
    wrong_codes: number;
    limits_hit: number;
    limited_by_reason: { reason: string; count: number }[];
    locks: number;
    locked_addresses: { address: string; locks: number; last_locked_at: string }[];
    busiest_networks: { network: string; codes_sent: number; addresses: number; limited: number }[];
  };
}

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
  host: { id: string | null; display_name: string | null };
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

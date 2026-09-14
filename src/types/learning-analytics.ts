/**
 * Typed models for GET /admin/learning-analytics/* (Phase 1C).
 *
 * These mirror the backend's Pydantic response models field-for-field
 * (snake_case, matching the wire format) - no metric is recalculated or
 * renamed into a different meaning here. See LEARNING_ANALYTICS_METRICS.md
 * in abidii_backend for the authoritative definition of every field.
 */

export interface AnalyticsFunnelMetrics {
  sessions_started: number;
  sessions_completed: number;
  session_completion_rate: number | null;
  unique_users_started: number;
  unique_users_completed: number;
  user_completion_rate: number | null;
}

export interface AnalyticsFunnelVersionRow {
  blueprint_content_hash: string | null; // null = legacy/unknown version
  sessions_started: number;
  sessions_completed: number;
  session_completion_rate: number | null;
}

export interface AnalyticsDropoffRow {
  exercise_index: number | null; // null = before_first_exercise
  exercise_key: string | null;
  exercise_type: string | null;
  sessions_dropped: number;
  unique_users_dropped: number;
  percent_of_started_sessions: number | null;
}

export interface AnalyticsExerciseAccuracyRow {
  exercise_key: string;
  exercise_index: number | null;
  exercise_type: string | null;
  raw_attempt_rows: number;
  session_exercise_count: number;
  first_attempt_count: number;
  first_attempt_correct: number;
  first_attempt_accuracy: number | null;
  eventual_correct_count: number;
  eventual_accuracy: number | null;
  mean_attempts_to_correct: number | null;
}

export interface AnalyticsResponseTimeMetrics {
  unit: string;
  median_response_time_ms: number | null;
  p75_response_time_ms: number | null;
  p90_response_time_ms: number | null;
  sample_size: number;
}

export interface AnalyticsDurationMetrics {
  unit: string;
  label: string; // always "wall_clock_duration" - never "active_learning_time"
  median_wall_clock_duration_ms: number | null;
  p75_wall_clock_duration_ms: number | null;
  p90_wall_clock_duration_ms: number | null;
  sample_size: number;
}

export interface AnalyticsRepeatSessionMetrics {
  unique_users_started: number;
  users_with_repeat_sessions: number;
  repeat_user_rate: number | null;
  average_sessions_per_user: number | null;
  median_sessions_per_user: number | null;
}

export interface AnalyticsSectionSummary {
  section_id: string;
  funnel: AnalyticsFunnelMetrics;
  drop_off: AnalyticsDropoffRow[];
  accuracy: AnalyticsExerciseAccuracyRow[];
  response_time: AnalyticsResponseTimeMetrics;
  duration: AnalyticsDurationMetrics;
  repeat_sessions: AnalyticsRepeatSessionMetrics;
}

export interface AnalyticsUserJourneySession {
  session_id: string;
  course_id: string;
  section_id: string;
  lesson_blueprint_id: string | null;
  blueprint_key: string;
  blueprint_content_hash: string | null;
  lesson_kind: string;
  status: string; // 'started' | 'in_progress' | 'completed' | 'abandoned'
  started_at: string;
  last_activity_at: string;
  completed_at: string | null;
  explicit_exit_at: string | null;
  final_score: number | null;
  completed_steps: number | null;
  total_steps: number | null;
  app_version: string | null;
  platform: string | null;
  attempt_count: number;
  first_attempt_accuracy: number | null;
}

export interface AnalyticsOverviewSummary {
  unique_learners: number;
  sessions_started: number;
  sessions_completed: number;
  session_completion_rate: number | null;
  first_attempt_accuracy: number | null;
  eventual_accuracy: number | null;
  repeat_user_rate: number | null;
  median_wall_clock_duration_ms: number | null;
}

export interface AnalyticsOverviewSectionRow {
  section_id: string;
  section_title: string | null;
  course_id: string;
  course_title: string | null;
  sessions_started: number;
  sessions_completed: number;
  session_completion_rate: number | null;
  first_attempt_accuracy: number | null;
  repeat_user_rate: number | null;
  median_wall_clock_duration_ms: number | null;
}

export interface AnalyticsOverviewResponse {
  summary: AnalyticsOverviewSummary;
  sections: AnalyticsOverviewSectionRow[];
}

/** Shared filter params every learning-analytics hook accepts - mirrors
 * the backend's SessionFilter query params 1:1 (dateFrom inclusive,
 * dateTo exclusive, ISO 8601 timezone-aware strings). */
export interface LearningAnalyticsFilters {
  dateFrom?: string;
  dateTo?: string;
  courseId?: string;
  languageId?: string;
  blueprintContentHash?: string;
}

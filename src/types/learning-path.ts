/**
 * GET /api/v1/admin/analytics/learning-path (abidii_backend
 * app/routers/admin_learning_path.py). Course -> unit -> lesson funnel,
 * time per lesson and progress over time.
 */
import type { Granularity, RangeKey } from '@/lib/dashboardRange';

export type LearnerTier = 'all' | 'free' | 'premium';

export interface LearningPathCourse {
  id: string;
  course_key: string;
  title: string;
  status: string;
  enabled: boolean;
}

export interface LearningPathSection {
  section_id: string;
  section_key: string;
  title: string;
  unit_id: string;
  position: number;
  live: boolean;
  learners_started: number;
  learners_completed: number;
  completion_rate: number | null;
  premium_started: number;
  premium_completed: number;
  completions_in_range: number;
  timed_sessions: number;
  median_wall_clock_ms: number | null;
  median_active_ms: number | null;
}

export interface LearningPathUnit {
  unit_id: string;
  unit_key: string;
  title: string;
  position: number;
  live: boolean;
  live_sections: number;
  learners_started: number;
  learners_completed: number;
  completion_rate: number | null;
  completions_in_range: number;
  typical_wall_clock_ms: number | null;
  typical_active_ms: number | null;
  sections: LearningPathSection[];
}

export interface LearningPathSummary {
  cohort_learners: number;
  cohort_premium: number;
  cohort_free: number;
  course_completed: number;
  course_completion_rate: number | null;
  active_learners: number;
  lesson_completions: number;
  timed_sessions: number;
  median_wall_clock_ms: number | null;
  median_active_ms: number | null;
  live_units: number;
  live_sections: number;
}

export interface LearningPathPoint {
  period_start: string;
  period_end: string;
  partial: boolean;
  lesson_completions: number;
  active_learners: number;
  new_learners: number;
  completions_by_unit: Record<string, number>;
}

export interface LearningPathResponse {
  range: {
    key: RangeKey;
    label: string;
    granularity: Granularity;
    start: string | null;
    end: string;
  };
  tier: LearnerTier;
  course: LearningPathCourse | null;
  courses: LearningPathCourse[];
  summary: LearningPathSummary;
  units: LearningPathUnit[];
  series: LearningPathPoint[];
}

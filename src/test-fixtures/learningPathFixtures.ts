import type { LearningPathResponse, LearningPathSection } from '@/types/learning-path';

function section(over: Partial<LearningPathSection> & Pick<LearningPathSection, 'section_id' | 'title' | 'unit_id' | 'position'>): LearningPathSection {
  return {
    section_key: over.section_id,
    live: true,
    learners_started: 0,
    learners_completed: 0,
    completion_rate: null,
    premium_started: 0,
    premium_completed: 0,
    completions_in_range: 0,
    timed_sessions: 0,
    median_wall_clock_ms: null,
    median_active_ms: null,
    ...over,
  };
}

export function learningPathFixture(): LearningPathResponse {
  return {
    range: { key: '30d', label: 'Last 30 days', granularity: 'day', start: '2026-09-12', end: '2026-10-11' },
    tier: 'all',
    course: { id: 'c1', course_key: 'yo', title: 'Abidii Yoruba', status: 'published', enabled: true },
    courses: [
      { id: 'c1', course_key: 'yo', title: 'Abidii Yoruba', status: 'published', enabled: true },
      { id: 'c2', course_key: 'en', title: 'Abidii English', status: 'published', enabled: true },
    ],
    summary: {
      cohort_learners: 20,
      cohort_premium: 5,
      cohort_free: 15,
      course_completed: 2,
      course_completion_rate: 0.1,
      active_learners: 31,
      lesson_completions: 57,
      timed_sessions: 40,
      median_wall_clock_ms: 150000,
      median_active_ms: 45000,
      live_units: 2,
      live_sections: 3,
    },
    units: [
      {
        unit_id: 'u1', unit_key: 'u1', title: 'Greetings', position: 1, live: true, live_sections: 2,
        learners_started: 20, learners_completed: 8, completion_rate: 0.4, completions_in_range: 40,
        typical_wall_clock_ms: 300000, typical_active_ms: 90000,
        sections: [
          section({ section_id: 's1', title: 'Hello', unit_id: 'u1', position: 1, learners_started: 20, learners_completed: 18,
            completion_rate: 0.9, premium_started: 5, timed_sessions: 25, median_wall_clock_ms: 120000, median_active_ms: 40000 }),
          section({ section_id: 's2', title: 'Goodbye', unit_id: 'u1', position: 2, learners_started: 10, learners_completed: 8,
            completion_rate: 0.8, timed_sessions: 10, median_wall_clock_ms: 180000, median_active_ms: 50000 }),
        ],
      },
      {
        unit_id: 'u2', unit_key: 'u2', title: 'Numbers', position: 2, live: true, live_sections: 1,
        learners_started: 9, learners_completed: 2, completion_rate: 0.2222, completions_in_range: 17,
        typical_wall_clock_ms: null, typical_active_ms: null,
        sections: [
          section({ section_id: 's3', title: 'One to ten', unit_id: 'u2', position: 3, learners_started: 9, learners_completed: 2,
            completion_rate: 0.2222 }),
          section({ section_id: 's4', title: 'Draft lesson', unit_id: 'u2', position: 4, live: false }),
        ],
      },
    ],
    series: [
      { period_start: '2026-10-10', period_end: '2026-10-10', partial: false, lesson_completions: 5, active_learners: 7,
        new_learners: 2, completions_by_unit: { u1: 4, u2: 1 } },
      { period_start: '2026-10-11', period_end: '2026-10-11', partial: true, lesson_completions: 3, active_learners: 4,
        new_learners: 1, completions_by_unit: { u1: 3 } },
    ],
  };
}

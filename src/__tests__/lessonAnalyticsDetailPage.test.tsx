import React from 'react';
import { screen } from '@testing-library/react';
import { renderWithProviders as render } from '@/test-utils';

import LessonAnalyticsDetailPage from '@/app/(admin)/(others-pages)/analytics/learning/lessons/[sectionId]/page';

const mockUseLessonAnalyticsSummary = jest.fn();
const mockUseLessonAnalyticsVersions = jest.fn();
const mockUseLearningAnalyticsOverview = jest.fn();

jest.mock('@/hooks/useApi', () => ({
  useLessonAnalyticsSummary: (...args: unknown[]) => mockUseLessonAnalyticsSummary(...args),
  useLessonAnalyticsVersions: (...args: unknown[]) => mockUseLessonAnalyticsVersions(...args),
  useLearningAnalyticsOverview: (...args: unknown[]) => mockUseLearningAnalyticsOverview(...args),
}));

jest.mock('next/navigation', () => ({
  useParams: () => ({ sectionId: 'sec-1' }),
}));

const SUMMARY = {
  section_id: 'sec-1',
  funnel: {
    sessions_started: 10,
    sessions_completed: 8,
    session_completion_rate: 0.8,
    unique_users_started: 9,
    unique_users_completed: 7,
    user_completion_rate: 0.777,
  },
  drop_off: [
    { exercise_index: null, exercise_key: null, exercise_type: null, sessions_dropped: 2, unique_users_dropped: 2, percent_of_started_sessions: 0.2 },
  ],
  accuracy: [
    {
      exercise_key: 'k1',
      exercise_index: 0,
      exercise_type: 'multiple_choice',
      raw_attempt_rows: 10,
      session_exercise_count: 10,
      first_attempt_count: 10,
      first_attempt_correct: 7,
      first_attempt_accuracy: 0.7,
      eventual_correct_count: 9,
      eventual_accuracy: 0.9,
      mean_attempts_to_correct: 1.3,
    },
  ],
  response_time: { unit: 'ms', median_response_time_ms: 2000, p75_response_time_ms: 3000, p90_response_time_ms: 4000, sample_size: 10 },
  duration: { unit: 'ms', label: 'wall_clock_duration', median_wall_clock_duration_ms: 60000, p75_wall_clock_duration_ms: 90000, p90_wall_clock_duration_ms: 120000, sample_size: 8 },
  repeat_sessions: { unique_users_started: 9, users_with_repeat_sessions: 1, repeat_user_rate: 0.111, average_sessions_per_user: 1.1, median_sessions_per_user: 1 },
};

function setupDefaults() {
  mockUseLessonAnalyticsSummary.mockReturnValue({ summary: SUMMARY, isLoading: false, isError: undefined, refresh: jest.fn() });
  mockUseLessonAnalyticsVersions.mockReturnValue({ versions: [], isLoading: false, isError: undefined, refresh: jest.fn() });
  mockUseLearningAnalyticsOverview.mockReturnValue({
    overview: { summary: {}, sections: [{ section_id: 'sec-1', section_title: 'Numbers 1-10', course_id: 'c1', course_title: 'Abidii Yoruba' }] },
    isLoading: false,
    isError: undefined,
    refresh: jest.fn(),
  });
}

describe('LessonAnalyticsDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaults();
  });

  it('resolves and shows the section/course title from the overview lookup', () => {
    render(<LessonAnalyticsDetailPage />);
    expect(screen.getByText('Numbers 1-10')).toBeInTheDocument();
    expect(screen.getByText('Abidii Yoruba')).toBeInTheDocument();
  });

  it('renders funnel and duration KPI cards from the summary', () => {
    render(<LessonAnalyticsDetailPage />);
    expect(screen.getByText('Sessions Started')).toBeInTheDocument();
    expect(screen.getAllByText('80%').length).toBeGreaterThan(0); // completion rate
    expect(screen.getByText('1m 0s')).toBeInTheDocument(); // median duration
  });

  it('renders the drop-off panel with "Before first exercise" label', () => {
    render(<LessonAnalyticsDetailPage />);
    expect(screen.getByText('Before first exercise')).toBeInTheDocument();
  });

  it('renders the exercise accuracy table', () => {
    render(<LessonAnalyticsDetailPage />);
    expect(screen.getByText('Step 1')).toBeInTheDocument();
  });

  it('does not render a version comparison table when only one version exists', () => {
    render(<LessonAnalyticsDetailPage />);
    expect(screen.queryByText('Content Versions')).not.toBeInTheDocument();
  });

  it('renders a version comparison table when more than one version exists', () => {
    mockUseLessonAnalyticsVersions.mockReturnValue({
      versions: [
        { blueprint_content_hash: null, sessions_started: 3, sessions_completed: 1, session_completion_rate: 0.333 },
        { blueprint_content_hash: 'sha256:abcdef123456', sessions_started: 7, sessions_completed: 7, session_completion_rate: 1 },
      ],
      isLoading: false,
      isError: undefined,
      refresh: jest.fn(),
    });
    render(<LessonAnalyticsDetailPage />);
    expect(screen.getByText('Content Versions')).toBeInTheDocument();
    expect(screen.getByText('Legacy / unknown version')).toBeInTheDocument();
  });

  it('shows a loading skeleton instead of KPI cards while loading', () => {
    mockUseLessonAnalyticsSummary.mockReturnValue({ summary: undefined, isLoading: true, isError: undefined, refresh: jest.fn() });
    render(<LessonAnalyticsDetailPage />);
    expect(screen.queryByText('Sessions Started')).not.toBeInTheDocument();
  });

  it('shows a 404-flavored error message when the section is not found', () => {
    mockUseLessonAnalyticsSummary.mockReturnValue({
      summary: undefined,
      isLoading: false,
      isError: { response: { status: 404 }, message: 'Not Found' },
      refresh: jest.fn(),
    });
    render(<LessonAnalyticsDetailPage />);
    expect(screen.getByText(/Lesson section not found/)).toBeInTheDocument();
  });

  it('shows an empty-sessions hint when the lesson had zero sessions in range', () => {
    mockUseLessonAnalyticsSummary.mockReturnValue({
      summary: {
        ...SUMMARY,
        funnel: { sessions_started: 0, sessions_completed: 0, session_completion_rate: null, unique_users_started: 0, unique_users_completed: 0, user_completion_rate: null },
      },
      isLoading: false,
      isError: undefined,
      refresh: jest.fn(),
    });
    render(<LessonAnalyticsDetailPage />);
    expect(screen.getByText(/No sessions recorded for this lesson/)).toBeInTheDocument();
  });
});

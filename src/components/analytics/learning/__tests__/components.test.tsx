import React from 'react';
import { screen } from '@testing-library/react';
import { renderWithProviders as render } from '@/test-utils';

import MetricCard from '@/components/analytics/learning/MetricCard';
import { AnalyticsEmptyState, AnalyticsPanelSkeleton, AnalyticsErrorPanel } from '@/components/analytics/learning/AnalyticsEmptyState';
import DropoffPanel from '@/components/analytics/learning/DropoffPanel';
import ExerciseAccuracyTable from '@/components/analytics/learning/ExerciseAccuracyTable';
import VersionComparisonTable from '@/components/analytics/learning/VersionComparisonTable';
import LessonPerformanceTable from '@/components/analytics/learning/LessonPerformanceTable';
import type { AnalyticsOverviewSectionRow, AnalyticsDropoffRow, AnalyticsExerciseAccuracyRow, AnalyticsFunnelVersionRow } from '@/types/learning-analytics';

describe('MetricCard', () => {
  it('renders a pre-formatted value and label', () => {
    render(<MetricCard label="Unique Learners" value="42" />);
    expect(screen.getByText('Unique Learners')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('shows a low-sample badge when sampleSize is below threshold', () => {
    render(<MetricCard label="Completion" value="100%" subtext="1/1 sessions" sampleSize={1} />);
    expect(screen.getByText(/Low sample \(n=1\)/)).toBeInTheDocument();
  });

  it('does not show a low-sample badge at/above threshold', () => {
    render(<MetricCard label="Completion" value="80%" subtext="8/10 sessions" sampleSize={10} />);
    expect(screen.queryByText(/Low sample/)).not.toBeInTheDocument();
  });
});

describe('AnalyticsEmptyState family', () => {
  it('renders message and optional hint', () => {
    render(<AnalyticsEmptyState message="No data" hint="Try widening filters" />);
    expect(screen.getByText('No data')).toBeInTheDocument();
    expect(screen.getByText('Try widening filters')).toBeInTheDocument();
  });

  it('renders a skeleton without crashing', () => {
    const { container } = render(<AnalyticsPanelSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders an error panel with retry action', () => {
    const onRetry = jest.fn();
    render(<AnalyticsErrorPanel message="Failed to load" onRetry={onRetry} />);
    expect(screen.getByText('Failed to load')).toBeInTheDocument();
    screen.getByRole('button').click();
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('DropoffPanel', () => {
  it('shows empty state with zero rows', () => {
    render(<DropoffPanel rows={[]} />);
    expect(screen.getByText(/No drop-off recorded/)).toBeInTheDocument();
  });

  it('labels a null exercise_index as "Before first exercise", never "Exercise 0"', () => {
    const rows: AnalyticsDropoffRow[] = [
      {
        exercise_index: null,
        exercise_key: null,
        exercise_type: null,
        sessions_dropped: 3,
        unique_users_dropped: 3,
        percent_of_started_sessions: 0.3,
      },
    ];
    render(<DropoffPanel rows={rows} />);
    expect(screen.getByText('Before first exercise')).toBeInTheDocument();
    expect(screen.queryByText('Exercise 0')).not.toBeInTheDocument();
  });

  it('labels a real exercise_index as a 1-based Step', () => {
    const rows: AnalyticsDropoffRow[] = [
      {
        exercise_index: 2,
        exercise_key: 'k3',
        exercise_type: 'multiple_choice',
        sessions_dropped: 5,
        unique_users_dropped: 4,
        percent_of_started_sessions: 0.5,
      },
    ];
    render(<DropoffPanel rows={rows} />);
    expect(screen.getByText('Step 3')).toBeInTheDocument();
  });
});

describe('ExerciseAccuracyTable', () => {
  it('shows empty state with zero rows', () => {
    render(<ExerciseAccuracyTable rows={[]} />);
    expect(screen.getByText(/No exercise attempts recorded/)).toBeInTheDocument();
  });

  it('renders step number (never raw exercise_key) and first/eventual accuracy', () => {
    const rows: AnalyticsExerciseAccuracyRow[] = [
      {
        exercise_key: 'raw_key_should_not_render_as_text',
        exercise_index: 0,
        exercise_type: 'multiple_choice',
        raw_attempt_rows: 12,
        session_exercise_count: 10,
        first_attempt_count: 10,
        first_attempt_correct: 8,
        first_attempt_accuracy: 0.8,
        eventual_correct_count: 10,
        eventual_accuracy: 1,
        mean_attempts_to_correct: 1.2,
      },
    ];
    render(<ExerciseAccuracyTable rows={rows} />);
    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.queryByText('raw_key_should_not_render_as_text')).not.toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('1.2')).toBeInTheDocument();
  });

  it('renders "—" for mean_attempts_to_correct when nobody ever got it correct', () => {
    const rows: AnalyticsExerciseAccuracyRow[] = [
      {
        exercise_key: 'k1',
        exercise_index: 0,
        exercise_type: null,
        raw_attempt_rows: 5,
        session_exercise_count: 5,
        first_attempt_count: 5,
        first_attempt_correct: 0,
        first_attempt_accuracy: 0,
        eventual_correct_count: 0,
        eventual_accuracy: 0,
        mean_attempts_to_correct: null,
      },
    ];
    render(<ExerciseAccuracyTable rows={rows} />);
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });
});

describe('VersionComparisonTable', () => {
  it('shows empty state with zero rows', () => {
    render(<VersionComparisonTable rows={[]} />);
    expect(screen.getByText(/No version data available/)).toBeInTheDocument();
  });

  it('renders a null hash as its own "legacy" row, not merged into a known version', () => {
    const rows: AnalyticsFunnelVersionRow[] = [
      { blueprint_content_hash: null, sessions_started: 3, sessions_completed: 1, session_completion_rate: 0.333 },
      { blueprint_content_hash: 'sha256:aaaa1111bbbb', sessions_started: 7, sessions_completed: 6, session_completion_rate: 0.857 },
    ];
    render(<VersionComparisonTable rows={rows} />);
    expect(screen.getByText('Legacy / unknown version')).toBeInTheDocument();
    expect(screen.getByText('Version aaaa1111')).toBeInTheDocument();
  });

  it('never claims one version is better than another', () => {
    const rows: AnalyticsFunnelVersionRow[] = [
      { blueprint_content_hash: 'sha256:aaaa1111bbbb', sessions_started: 7, sessions_completed: 6, session_completion_rate: 0.857 },
      { blueprint_content_hash: 'sha256:cccc2222dddd', sessions_started: 4, sessions_completed: 1, session_completion_rate: 0.25 },
    ];
    render(<VersionComparisonTable rows={rows} />);
    expect(screen.queryByText(/better/i)).not.toBeInTheDocument();
  });
});

describe('LessonPerformanceTable', () => {
  const rows: AnalyticsOverviewSectionRow[] = [
    {
      section_id: 's1',
      section_title: 'Numbers 1-10',
      course_id: 'c1',
      course_title: 'Abidii Yoruba',
      sessions_started: 10,
      sessions_completed: 8,
      session_completion_rate: 0.8,
      first_attempt_accuracy: 0.7,
      repeat_user_rate: 0.1,
      median_wall_clock_duration_ms: 60000,
    },
    {
      section_id: 's2',
      section_title: 'Greetings',
      course_id: 'c1',
      course_title: 'Abidii Yoruba',
      sessions_started: 3,
      sessions_completed: 0,
      session_completion_rate: null,
      first_attempt_accuracy: null,
      repeat_user_rate: null,
      median_wall_clock_duration_ms: null,
    },
  ];

  it('shows an empty state with zero rows', () => {
    render(<LessonPerformanceTable rows={[]} />);
    expect(screen.getByText(/No learning analytics for this period yet/)).toBeInTheDocument();
  });

  it('renders every row, linking to the lesson detail page', () => {
    render(<LessonPerformanceTable rows={rows} />);
    const link = screen.getByRole('link', { name: 'Numbers 1-10' });
    expect(link).toHaveAttribute('href', '/analytics/learning/lessons/s1');
    expect(screen.getByText('Greetings')).toBeInTheDocument();
  });

  it('filters by search query against section and course titles', () => {
    render(<LessonPerformanceTable rows={rows} searchQuery="greet" />);
    expect(screen.getByText('Greetings')).toBeInTheDocument();
    expect(screen.queryByText('Numbers 1-10')).not.toBeInTheDocument();
  });

  it('shows a distinct empty state when the search matches nothing', () => {
    render(<LessonPerformanceTable rows={rows} searchQuery="nonexistent-lesson-xyz" />);
    expect(screen.getByText(/No lessons match your search/)).toBeInTheDocument();
  });

  it('sorts rows with null metrics last regardless of direction', async () => {
    render(<LessonPerformanceTable rows={rows} />);
    const completionHeader = screen.getByRole('button', { name: /Completion/ });

    completionHeader.click();
    let cells = screen.getAllByRole('row').slice(1); // skip header row
    expect(cells[cells.length - 1]).toHaveTextContent('Greetings');

    completionHeader.click(); // flip direction
    cells = screen.getAllByRole('row').slice(1);
    expect(cells[cells.length - 1]).toHaveTextContent('Greetings');
  });
});

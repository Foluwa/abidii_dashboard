import React from 'react';
import { screen } from '@testing-library/react';
import { renderWithProviders as render } from '@/test-utils';
import LearnerJourneyTimeline from '@/components/analytics/learning/LearnerJourneyTimeline';
import type { AnalyticsUserJourneySession } from '@/types/learning-analytics';

function makeSession(overrides: Partial<AnalyticsUserJourneySession>): AnalyticsUserJourneySession {
  return {
    session_id: 's1',
    course_id: 'c1',
    section_id: 'sec1',
    lesson_blueprint_id: 'b1',
    blueprint_key: 'numbers_1_10',
    blueprint_content_hash: 'sha256:abcdef123456',
    lesson_kind: 'numbers',
    status: 'completed',
    started_at: '2026-01-01T10:00:00Z',
    last_activity_at: '2026-01-01T10:05:00Z',
    completed_at: '2026-01-01T10:05:00Z',
    explicit_exit_at: null,
    final_score: 90,
    completed_steps: 10,
    total_steps: 10,
    app_version: '1.2.0',
    platform: 'ios',
    attempt_count: 10,
    first_attempt_accuracy: 0.9,
    ...overrides,
  };
}

describe('LearnerJourneyTimeline', () => {
  it('shows an empty state with zero sessions', () => {
    render(<LearnerJourneyTimeline sessions={[]} />);
    expect(screen.getByText(/No structured learning analytics recorded/)).toBeInTheDocument();
  });

  it('renders sessions in the exact order given, never re-sorted', () => {
    const sessions = [
      makeSession({ session_id: 'first', blueprint_key: 'greetings', started_at: '2026-01-01T09:00:00Z' }),
      makeSession({ session_id: 'second', blueprint_key: 'numbers_1_10', started_at: '2026-01-02T09:00:00Z' }),
    ];
    render(<LearnerJourneyTimeline sessions={sessions} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('greetings');
    expect(items[1]).toHaveTextContent('numbers_1_10');
  });

  it('labels a completed session as Completed', () => {
    render(<LearnerJourneyTimeline sessions={[makeSession({ status: 'completed' })]} />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('labels an explicit-exit session as Exited, not a bare "Abandoned"', () => {
    render(
      <LearnerJourneyTimeline
        sessions={[
          makeSession({
            status: 'in_progress',
            completed_at: null,
            explicit_exit_at: '2026-01-01T10:02:00Z',
          }),
        ]}
      />,
    );
    expect(screen.getByText('Exited')).toBeInTheDocument();
    expect(screen.queryByText('Abandoned')).not.toBeInTheDocument();
  });

  it('labels a stale in-progress session as inactive/likely abandoned, never a bare "Abandoned"', () => {
    render(
      <LearnerJourneyTimeline
        sessions={[
          makeSession({
            status: 'in_progress',
            completed_at: null,
            explicit_exit_at: null,
            last_activity_at: '2020-01-01T00:00:00Z',
          }),
        ]}
      />,
    );
    expect(screen.getByText('Inactive / likely abandoned')).toBeInTheDocument();
  });

  it('shows a recent in-progress session as "In progress"', () => {
    render(
      <LearnerJourneyTimeline
        sessions={[
          makeSession({
            status: 'in_progress',
            completed_at: null,
            explicit_exit_at: null,
            last_activity_at: new Date().toISOString(),
          }),
        ]}
      />,
    );
    expect(screen.getByText('In progress')).toBeInTheDocument();
  });

  it('renders "—" for null final_score rather than crashing', () => {
    render(<LearnerJourneyTimeline sessions={[makeSession({ final_score: null })]} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('shows a legacy/unknown version label for a null content hash', () => {
    render(<LearnerJourneyTimeline sessions={[makeSession({ blueprint_content_hash: null })]} />);
    expect(screen.getByText('Legacy / unknown version')).toBeInTheDocument();
  });
});

import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders as render } from '@/test-utils';

import LearnerJourneyPage from '@/app/(admin)/(others-pages)/analytics/learning/users/[userId]/page';

const mockUseLearnerJourney = jest.fn();
const mockUseAdminCoursesList = jest.fn();

jest.mock('@/hooks/useApi', () => ({
  useLearnerJourney: (...args: unknown[]) => mockUseLearnerJourney(...args),
  useAdminCoursesList: (...args: unknown[]) => mockUseAdminCoursesList(...args),
}));

jest.mock('next/navigation', () => ({
  useParams: () => ({ userId: 'user-1234' }),
}));

const SESSIONS = [
  {
    session_id: 's1',
    course_id: 'c1',
    section_id: 'sec1',
    lesson_blueprint_id: 'b1',
    blueprint_key: 'greetings',
    blueprint_content_hash: null,
    lesson_kind: 'vocab',
    status: 'completed',
    started_at: '2026-01-01T09:00:00Z',
    last_activity_at: '2026-01-01T09:05:00Z',
    completed_at: '2026-01-01T09:05:00Z',
    explicit_exit_at: null,
    final_score: 100,
    completed_steps: 5,
    total_steps: 5,
    app_version: '1.0.0',
    platform: 'android',
    attempt_count: 5,
    first_attempt_accuracy: 1,
  },
  {
    session_id: 's2',
    course_id: 'c1',
    section_id: 'sec2',
    lesson_blueprint_id: 'b2',
    blueprint_key: 'numbers_1_10',
    blueprint_content_hash: 'sha256:abcdef123456',
    lesson_kind: 'numbers',
    status: 'in_progress',
    started_at: '2026-01-02T09:00:00Z',
    last_activity_at: '2026-01-02T09:05:00Z',
    completed_at: null,
    explicit_exit_at: null,
    final_score: null,
    completed_steps: 2,
    total_steps: 10,
    app_version: '1.0.0',
    platform: 'android',
    attempt_count: 2,
    first_attempt_accuracy: 0.5,
  },
];

function setupDefaults() {
  mockUseLearnerJourney.mockReturnValue({ journey: SESSIONS, isLoading: false, isError: undefined, refresh: jest.fn() });
  mockUseAdminCoursesList.mockReturnValue({ data: { items: [{ id: 'c1', title: 'Abidii Yoruba' }] } });
}

describe('LearnerJourneyPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaults();
  });

  it('shows the user id in the header', () => {
    render(<LearnerJourneyPage />);
    expect(screen.getByText('user-1234')).toBeInTheDocument();
  });

  it('renders sessions in the order returned by the API, not re-sorted', () => {
    render(<LearnerJourneyPage />);
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('greetings');
    expect(items[1]).toHaveTextContent('numbers_1_10');
  });

  it('shows a loading skeleton while fetching', () => {
    mockUseLearnerJourney.mockReturnValue({ journey: undefined, isLoading: true, isError: undefined, refresh: jest.fn() });
    render(<LearnerJourneyPage />);
    expect(screen.queryByText('greetings')).not.toBeInTheDocument();
  });

  it('shows an empty state when the learner has no analytics sessions', () => {
    mockUseLearnerJourney.mockReturnValue({ journey: [], isLoading: false, isError: undefined, refresh: jest.fn() });
    render(<LearnerJourneyPage />);
    expect(screen.getByText(/No structured learning analytics recorded/)).toBeInTheDocument();
  });

  it('shows a 404-flavored error message when the learner is not found', () => {
    mockUseLearnerJourney.mockReturnValue({
      journey: undefined,
      isLoading: false,
      isError: { response: { status: 404 }, message: 'Not Found' },
      refresh: jest.fn(),
    });
    render(<LearnerJourneyPage />);
    expect(screen.getByText(/Learner not found/)).toBeInTheDocument();
  });

  it('passes the selected course filter through to the hook', async () => {
    render(<LearnerJourneyPage />);
    await userEvent.selectOptions(screen.getByLabelText('Course'), 'c1');
    const lastCall = mockUseLearnerJourney.mock.calls.at(-1)?.[1];
    expect(lastCall.courseId).toBe('c1');
  });
});

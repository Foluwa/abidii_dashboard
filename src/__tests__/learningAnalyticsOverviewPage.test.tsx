import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders as render } from '@/test-utils';

import LearningAnalyticsOverviewPage from '@/app/(admin)/(others-pages)/analytics/learning/page';

const mockUseLearningAnalyticsOverview = jest.fn();
const mockUseAdminCoursesList = jest.fn();
const mockUseLanguages = jest.fn();

jest.mock('@/hooks/useApi', () => ({
  useLearningAnalyticsOverview: (...args: unknown[]) => mockUseLearningAnalyticsOverview(...args),
  useAdminCoursesList: (...args: unknown[]) => mockUseAdminCoursesList(...args),
  useLanguages: (...args: unknown[]) => mockUseLanguages(...args),
}));

const SECTION_ROW = {
  section_id: 'sec-1',
  section_title: 'Numbers 1-10',
  course_id: 'course-1',
  course_title: 'Abidii Yoruba',
  sessions_started: 10,
  sessions_completed: 8,
  session_completion_rate: 0.8,
  first_attempt_accuracy: 0.7,
  repeat_user_rate: 0.1,
  median_wall_clock_duration_ms: 60000,
};

function mockOverview(overrides: Partial<ReturnType<typeof mockUseLearningAnalyticsOverview>> = {}) {
  mockUseLearningAnalyticsOverview.mockReturnValue({
    overview: {
      summary: {
        unique_learners: 5,
        sessions_started: 10,
        sessions_completed: 8,
        session_completion_rate: 0.8,
        first_attempt_accuracy: 0.7,
        eventual_accuracy: 0.9,
        repeat_user_rate: 0.1,
        median_wall_clock_duration_ms: 60000,
      },
      sections: [SECTION_ROW],
    },
    isLoading: false,
    isError: undefined,
    refresh: jest.fn(),
    ...overrides,
  });
}

describe('LearningAnalyticsOverviewPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAdminCoursesList.mockReturnValue({ data: { items: [{ id: 'course-1', title: 'Abidii Yoruba' }] } });
    mockUseLanguages.mockReturnValue({ languages: [{ id: 'lang-1', name: 'Yoruba' }] });
    mockOverview();
  });

  it('renders KPI cards from the overview summary', () => {
    render(<LearningAnalyticsOverviewPage />);
    expect(screen.getByText('Unique Learners')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getAllByText('80%').length).toBeGreaterThan(0);
  });

  it('renders the lesson performance table with real rows', () => {
    render(<LearningAnalyticsOverviewPage />);
    expect(screen.getAllByText('Numbers 1-10').length).toBeGreaterThan(0);
  });

  it('shows a loading skeleton state instead of KPI cards while loading', () => {
    mockOverview({ overview: undefined, isLoading: true });
    render(<LearningAnalyticsOverviewPage />);
    expect(screen.queryByText('Unique Learners')).not.toBeInTheDocument();
  });

  it('shows an error panel with retry on fetch failure', async () => {
    const refresh = jest.fn();
    mockOverview({
      overview: undefined,
      isError: { message: 'Network Error' },
      refresh,
    });
    render(<LearningAnalyticsOverviewPage />);
    expect(screen.getByText(/Failed to load learning analytics/)).toBeInTheDocument();
    expect(screen.getByText(/Network Error/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refresh).toHaveBeenCalled();
  });

  it('shows an empty state within the table when there are no sections', () => {
    mockOverview({
      overview: {
        summary: {
          unique_learners: 0,
          sessions_started: 0,
          sessions_completed: 0,
          session_completion_rate: null,
          first_attempt_accuracy: null,
          eventual_accuracy: null,
          repeat_user_rate: null,
          median_wall_clock_duration_ms: null,
        },
        sections: [],
      },
    });
    render(<LearningAnalyticsOverviewPage />);
    expect(screen.getByText(/No learning analytics for this period yet/)).toBeInTheDocument();
    // Null rates render as an em dash, never 0%
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('passes the selected date preset through to the hook as an ISO dateFrom', async () => {
    render(<LearningAnalyticsOverviewPage />);
    await userEvent.selectOptions(screen.getByLabelText('Date Range'), 'Last 7 days');
    const lastCall = mockUseLearningAnalyticsOverview.mock.calls.at(-1)?.[0];
    expect(lastCall.dateFrom).toEqual(expect.any(String));
  });

  it('does not render "Lessons Needing Attention" when no section clears the sample threshold', () => {
    mockOverview({
      overview: {
        summary: {
          unique_learners: 1,
          sessions_started: 2,
          sessions_completed: 1,
          session_completion_rate: 0.5,
          first_attempt_accuracy: 0.5,
          eventual_accuracy: 0.5,
          repeat_user_rate: 0,
          median_wall_clock_duration_ms: 1000,
        },
        sections: [{ ...SECTION_ROW, sessions_started: 2 }], // below LOW_SAMPLE_THRESHOLD of 5
      },
    });
    render(<LearningAnalyticsOverviewPage />);
    expect(screen.queryByText('Lessons Needing Attention')).not.toBeInTheDocument();
  });
});

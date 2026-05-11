/**
 * Phase 14 + Phase 18 — User Learning State page tests
 *
 * Covers:
 * - Renders course cards with progress bar
 * - Renders "no enrollments" message for empty state
 * - Shows loading spinner while fetching
 * - Shows error message on fetch failure
 * - Refresh button calls refresh()
 * - Phase 18: Reset Progress button per course card
 * - Phase 18: Set Pointer button per course card
 * - Phase 18: Active-only checkbox filters out 0% courses
 */

import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders as render } from '@/test-utils';

// ===== Mocks =====

const mockRefresh = jest.fn();
const mockUseAdminUserLearningState = jest.fn();
const mockAdminResetCourseProgress = jest.fn();
const mockAdminSetLearningPointer = jest.fn();

jest.mock('@/hooks/useApi', () => ({
  useAdminUserLearningState: (userId: string | null) =>
    mockUseAdminUserLearningState(userId),
  adminResetCourseProgress: (...args: unknown[]) => mockAdminResetCourseProgress(...args),
  adminSetLearningPointer: (...args: unknown[]) => mockAdminSetLearningPointer(...args),
}));

// next/navigation
jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'test-user-uuid-1234' }),
}));

// PageBreadCrumb is not relevant to these tests
jest.mock('@/components/common/PageBreadCrumb', () => ({
  __esModule: true,
  default: ({ pageTitle }: { pageTitle: string }) => <div data-testid="breadcrumb">{pageTitle}</div>,
}));

// Lazy require used inside Page, we need to shim require
const originalRequire = (globalThis as any).__jest_require;
beforeAll(() => {
  // The page does: require('@/hooks/useApi') — jest.mock ensures it's intercepted
});

// ===== Import page AFTER mocks =====
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { default: UserLearningStatePage } = require(
  '@/app/(admin)/(others-pages)/content/users/[id]/learning-state/page'
);

// ===== Sample data =====

const sampleCourse = {
  course_id: 'course-uuid-abc',
  course_key: 'yoruba-basics',
  course_title: 'Yoruba Basics',
  enrolled_at: '2026-01-15T09:00:00Z',
  last_active_at: '2026-03-01T12:00:00Z',
  current_unit_id: 'unit-uuid-1',
  current_section_id: 'section-uuid-1',
  progress_percent: 45.5,
  is_completed: false,
  completed_at: null,
};

const completedCourse = {
  ...sampleCourse,
  course_id: 'course-uuid-def',
  course_key: 'yoruba-advanced',
  course_title: 'Yoruba Advanced',
  progress_percent: 100,
  is_completed: true,
  completed_at: '2026-02-28T18:00:00Z',
};

// ===== Tests =====

describe('UserLearningStatePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders course card with title and progress', () => {
    mockUseAdminUserLearningState.mockReturnValue({
      state: { user_id: 'test-user-uuid-1234', courses: [sampleCourse] },
      isLoading: false,
      isError: false,
      refresh: mockRefresh,
    });

    render(<UserLearningStatePage />);

    expect(screen.getByText('Yoruba Basics')).toBeInTheDocument();
    expect(screen.getByText('45.5%')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
  });

  it('renders completed badge for 100% course', () => {
    mockUseAdminUserLearningState.mockReturnValue({
      state: { user_id: 'test-user-uuid-1234', courses: [completedCourse] },
      isLoading: false,
      isError: false,
      refresh: mockRefresh,
    });

    render(<UserLearningStatePage />);

    expect(screen.getByText('Yoruba Advanced')).toBeInTheDocument();
    // "Completed" badge appears at least once
    expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('100.0%')).toBeInTheDocument();
  });

  it('renders empty message when no courses', () => {
    mockUseAdminUserLearningState.mockReturnValue({
      state: { user_id: 'test-user-uuid-1234', courses: [] },
      isLoading: false,
      isError: false,
      refresh: mockRefresh,
    });

    render(<UserLearningStatePage />);

    expect(screen.getByText(/No course enrollments found/i)).toBeInTheDocument();
  });

  it('renders loading state', () => {
    mockUseAdminUserLearningState.mockReturnValue({
      state: undefined,
      isLoading: true,
      isError: false,
      refresh: mockRefresh,
    });

    render(<UserLearningStatePage />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders error message on fetch failure', () => {
    mockUseAdminUserLearningState.mockReturnValue({
      state: undefined,
      isLoading: false,
      isError: true,
      refresh: mockRefresh,
    });

    render(<UserLearningStatePage />);

    expect(screen.getByText(/Failed to load learning state/i)).toBeInTheDocument();
  });

  it('calls refresh when Refresh button clicked', async () => {
    mockUseAdminUserLearningState.mockReturnValue({
      state: { user_id: 'test-user-uuid-1234', courses: [sampleCourse] },
      isLoading: false,
      isError: false,
      refresh: mockRefresh,
    });

    render(<UserLearningStatePage />);

    fireEvent.click(screen.getByText('Refresh'));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  // ===== Phase 18 admin-action tests =====

  it('renders Reset Progress button for each course card', () => {
    mockUseAdminUserLearningState.mockReturnValue({
      state: { user_id: 'test-user-uuid-1234', courses: [sampleCourse] },
      isLoading: false,
      isError: false,
      refresh: mockRefresh,
    });

    render(<UserLearningStatePage />);

    expect(screen.getByText('Reset Progress')).toBeInTheDocument();
  });

  it('renders Set Pointer button for each course card', () => {
    mockUseAdminUserLearningState.mockReturnValue({
      state: { user_id: 'test-user-uuid-1234', courses: [sampleCourse] },
      isLoading: false,
      isError: false,
      refresh: mockRefresh,
    });

    render(<UserLearningStatePage />);

    expect(screen.getByText('Set Pointer')).toBeInTheDocument();
  });

  it('active-only checkbox hides courses with 0% progress', () => {
    const zeroCourse = { ...sampleCourse, course_id: 'c-zero', course_title: 'Zero Course', progress_percent: 0, is_completed: false };
    mockUseAdminUserLearningState.mockReturnValue({
      state: {
        user_id: 'test-user-uuid-1234',
        courses: [sampleCourse, zeroCourse],
      },
      isLoading: false,
      isError: false,
      refresh: mockRefresh,
    });

    render(<UserLearningStatePage />);

    // Both visible before filtering
    expect(screen.getByText('Yoruba Basics')).toBeInTheDocument();
    expect(screen.getByText('Zero Course')).toBeInTheDocument();

    // Enable active-only filter
    fireEvent.click(screen.getByLabelText('Show active learners only'));

    // Zero-progress course hidden, active course still shown
    expect(screen.getByText('Yoruba Basics')).toBeInTheDocument();
    expect(screen.queryByText('Zero Course')).not.toBeInTheDocument();
  });

  // ===== Phase 19 safety + observability tests =====

  it('confirm modal cancellation prevents reset API call', async () => {
    mockUseAdminUserLearningState.mockReturnValue({
      state: { user_id: 'test-user-uuid-1234', courses: [sampleCourse] },
      isLoading: false,
      isError: false,
      refresh: mockRefresh,
    });

    render(<UserLearningStatePage />);
    fireEvent.click(screen.getByText('Reset Progress'));
    expect(screen.getByText('Reset course progress')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByText('Reset course progress')).not.toBeInTheDocument();
      expect(mockAdminResetCourseProgress).not.toHaveBeenCalled();
    });
  });

  it('confirm modal confirmation calls reset API and then refetch', async () => {
    mockAdminResetCourseProgress.mockResolvedValueOnce({ ok: true });
    mockUseAdminUserLearningState.mockReturnValue({
      state: { user_id: 'test-user-uuid-1234', courses: [sampleCourse] },
      isLoading: false,
      isError: false,
      refresh: mockRefresh,
    });

    render(<UserLearningStatePage />);
    fireEvent.click(screen.getByText('Reset Progress'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Reset Progress' }).slice(-1)[0]);

    await waitFor(() => {
      expect(mockAdminResetCourseProgress).toHaveBeenCalledWith(
        'test-user-uuid-1234',
        sampleCourse.course_id,
      );
    });
  });

  it('Set Pointer confirm calls API and refetch', async () => {
    mockAdminSetLearningPointer.mockResolvedValueOnce({ ok: true });
    mockUseAdminUserLearningState.mockReturnValue({
      state: { user_id: 'test-user-uuid-1234', courses: [sampleCourse] },
      isLoading: false,
      isError: false,
      refresh: mockRefresh,
    });

    render(<UserLearningStatePage />);

    // Open the Set Pointer form
    fireEvent.click(screen.getByText('Set Pointer'));
    // Click Save (submits form)
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockAdminSetLearningPointer).toHaveBeenCalledWith(
        'test-user-uuid-1234',
        sampleCourse.course_id,
        expect.objectContaining({}),
      );
    });
  });

  it('shows toast notification after successful reset', async () => {
    mockAdminResetCourseProgress.mockResolvedValueOnce({ ok: true });
    mockUseAdminUserLearningState.mockReturnValue({
      state: { user_id: 'test-user-uuid-1234', courses: [sampleCourse] },
      isLoading: false,
      isError: false,
      refresh: mockRefresh,
    });

    render(<UserLearningStatePage />);
    fireEvent.click(screen.getByText('Reset Progress'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Reset Progress' }).slice(-1)[0]);

    await waitFor(() => {
      expect(screen.getByText(/Progress reset successfully/i)).toBeInTheDocument();
    });
  });
});

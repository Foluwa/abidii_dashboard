import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CurriculumCoursesListPage from '@/app/(admin)/(others-pages)/curriculum/courses/page';
import { renderWithProviders as render } from '@/test-utils';

const mockRefresh = jest.fn().mockResolvedValue(undefined);
const mockUseAdminCoursesList = jest.fn();
const mockPush = jest.fn();

jest.mock('@/hooks/useApi', () => ({
  useAdminCoursesList: (filters: unknown) => mockUseAdminCoursesList(filters),
  useLanguages: () => ({
    languages: [{ id: 'lang-1', name: 'Yoruba', iso_639_3: 'yor' }],
    total: 1,
    isLoading: false,
    isError: false,
    refresh: jest.fn(),
  }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockValidateAdminCourse = jest.fn();
const mockPublishAdminCourse = jest.fn();
const mockUnpublishAdminCourse = jest.fn();
const mockCreateAdminCourse = jest.fn();
const mockUpdateAdminCourse = jest.fn();
const mockDeleteAdminCourse = jest.fn();

jest.mock('@/lib/adminCurriculumApi', () => ({
  createAdminCourse: (payload: unknown) => mockCreateAdminCourse(payload),
  updateAdminCourse: (courseId: string, payload: unknown) => mockUpdateAdminCourse(courseId, payload),
  deleteAdminCourse: (courseId: string) => mockDeleteAdminCourse(courseId),
  validateAdminCourse: (courseId: string) => mockValidateAdminCourse(courseId),
  publishAdminCourse: (courseId: string) => mockPublishAdminCourse(courseId),
  unpublishAdminCourse: (courseId: string) => mockUnpublishAdminCourse(courseId),
}));

jest.mock('@/lib/adminActionLog', () => ({
  logAdminCurriculumAction: jest.fn(),
}));

describe('CurriculumCoursesListPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAdminCoursesList.mockReturnValue({
      data: {
        items: [
          {
            id: 'c1',
            course_key: 'yoruba_101',
            title: 'Yoruba 101',
            description: null,
            status: 'draft',
            enabled: true,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
          },
          {
            id: 'c2',
            course_key: 'yoruba_102',
            title: 'Yoruba 102',
            description: null,
            status: 'draft',
            enabled: true,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
          },
        ],
        total: 2,
        page: 1,
        limit: 50,
        pages: 1,
        filters_applied: {},
      },
      isLoading: false,
      isError: false,
      refresh: mockRefresh,
    });

    mockValidateAdminCourse.mockResolvedValue({});
    mockUnpublishAdminCourse.mockResolvedValue({});
    mockDeleteAdminCourse.mockResolvedValue({ ok: true });
    mockCreateAdminCourse.mockResolvedValue({
      course: { id: 'created-course' },
    });
  });

  it('renders courses table and rows', () => {
    render(<CurriculumCoursesListPage />);

    expect(screen.getByText('Curriculum Courses')).toBeInTheDocument();

    const table = screen.getByRole('table');
    const t = within(table);

    expect(t.getByText('Course', { selector: 'th' })).toBeInTheDocument();
    expect(t.getByText('Key', { selector: 'th' })).toBeInTheDocument();
    expect(t.getByText('Status', { selector: 'th' })).toBeInTheDocument();
    expect(t.getByText('Enabled', { selector: 'th' })).toBeInTheDocument();

    expect(screen.getByText('Yoruba 101')).toBeInTheDocument();
    expect(screen.getByText('yoruba_101')).toBeInTheDocument();
    expect(screen.getByText('Yoruba 102')).toBeInTheDocument();
    expect(screen.getByText('yoruba_102')).toBeInTheDocument();
  });

  it('requires confirmation before bulk publish, and shows blocked outcomes', async () => {
    mockPublishAdminCourse
      .mockResolvedValueOnce({ ok: true, statusCode: 200, body: {} })
      .mockResolvedValueOnce({ ok: false, statusCode: 409, body: {} });

    render(<CurriculumCoursesListPage />);

    await userEvent.click(screen.getByLabelText('Select course Yoruba 101'));
    await userEvent.click(screen.getByLabelText('Select course Yoruba 102'));

    await userEvent.click(screen.getByText('Publish Selected'));

    expect(screen.getByText('Publish selected courses')).toBeInTheDocument();
    expect(mockPublishAdminCourse).not.toHaveBeenCalled();

    await userEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(mockPublishAdminCourse).toHaveBeenCalledTimes(2);
      expect(mockPublishAdminCourse).toHaveBeenNthCalledWith(1, 'c1');
      expect(mockPublishAdminCourse).toHaveBeenNthCalledWith(2, 'c2');
      expect(mockRefresh).toHaveBeenCalled();
    });

    expect(screen.getByText('Last bulk run')).toBeInTheDocument();
    expect(screen.getByText(/Success: 1, Blocked: 1, Failed: 0/i)).toBeInTheDocument();
  });

  it('requires confirmation before bulk unpublish', async () => {
    render(<CurriculumCoursesListPage />);

    await userEvent.click(screen.getByLabelText('Select course Yoruba 101'));
    await userEvent.click(screen.getByText('Unpublish Selected'));

    expect(screen.getByText('Unpublish selected courses')).toBeInTheDocument();
    expect(mockUnpublishAdminCourse).not.toHaveBeenCalled();

    await userEvent.click(screen.getByText('Unpublish'));

    await waitFor(() => {
      expect(mockUnpublishAdminCourse).toHaveBeenCalledTimes(1);
      expect(mockUnpublishAdminCourse).toHaveBeenCalledWith('c1');
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('creates a new course and routes to the detail page', async () => {
    render(<CurriculumCoursesListPage />);

    await userEvent.click(screen.getByRole('button', { name: 'New Course' }));
    await userEvent.type(screen.getByLabelText('Course key'), 'abidii_yoruba_v2');
    await userEvent.type(screen.getByLabelText('Title'), 'Abidii Yoruba v2');
    await userEvent.click(screen.getByRole('button', { name: 'Create Course' }));

    await waitFor(() => {
      expect(mockCreateAdminCourse).toHaveBeenCalledWith({
        course_key: 'abidii_yoruba_v2',
        title: 'Abidii Yoruba v2',
        description: null,
        target_language_id: 'lang-1',
      });
      expect(mockPush).toHaveBeenCalledWith('/curriculum/courses/created-course');
    });
  });

  it('deletes a course from the list actions', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<CurriculumCoursesListPage />);

    await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);

    await waitFor(() => {
      expect(mockDeleteAdminCourse).toHaveBeenCalledWith('c1');
      expect(mockRefresh).toHaveBeenCalled();
    });

    confirmSpy.mockRestore();
  });
});

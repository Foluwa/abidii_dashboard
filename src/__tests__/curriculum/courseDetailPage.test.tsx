import React from 'react';
import { act } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AdminCourseDetailPage from '@/app/(admin)/(others-pages)/content/curriculum/courses/[id]/page';
import { renderWithProviders as render } from '@/test-utils';

const mockMutateAdmin = jest.fn().mockResolvedValue(undefined);
const mockRefreshAdmin = jest.fn().mockResolvedValue(undefined);
const mockRefreshCurriculum = jest.fn().mockResolvedValue(undefined);
const mockValidateCourse = jest.fn();
const mockPublishCourse = jest.fn();
const mockUnpublishCourse = jest.fn();
const mockMarkSectionsComingSoon = jest.fn().mockResolvedValue({ ok: true });
const mockUpdateAdminCourse = jest.fn();
const mockDeleteAdminCourse = jest.fn().mockResolvedValue({ ok: true });

jest.mock('@/hooks/useApi', () => ({
  useAdminCourse: () => ({
    data: {
      course: {
        id: 'course-1',
        course_key: 'abidii_yoruba_v1',
        title: 'Abidii Yoruba v1',
        description: null,
        status: 'published',
        enabled: true,
        created_at: '2026-03-24T00:00:00Z',
        updated_at: '2026-03-24T00:00:00Z',
      },
      validation: {
        status: 'invalid',
        errors: [
          {
            code: 'section_missing_blueprint',
            path: 'sections[U2.S1]',
            message: 'section has no published blueprint',
            severity: 'ERROR',
          },
        ],
        warnings: [],
        validated_at: null,
        can_publish: false,
        blocking_error_count: 1,
        warning_count: 0,
      },
    },
    isLoading: false,
    isError: false,
    refresh: mockRefreshAdmin,
    mutate: mockMutateAdmin,
  }),
  useCourseCurriculum: () => ({
    curriculum: {
      id: 'course-1',
      course_key: 'abidii_yoruba_v1',
      title: 'Abidii Yoruba v1',
      description: null,
      status: 'published',
      enabled: true,
      availability: 'available',
      course_revision: 1,
      units: [
        {
          id: 'unit-1',
          unit_key: 'U2',
          title: 'Unit 2: Greetings',
          subtitle: null,
          status: 'published',
          enabled: true,
          availability: 'available',
          sections: [
            {
              id: 'section-1',
              section_key: 'S1',
              title: 'Hello & goodbye',
              status: 'published',
              enabled: true,
              availability: 'coming_soon',
              lesson_blueprint_id: null,
              blueprint_key: null,
              blueprint_status: null,
              blueprint_enabled: null,
            },
          ],
        },
      ],
    },
    isLoading: false,
    isError: false,
    refresh: mockRefreshCurriculum,
  }),
  useLanguages: () => ({
    languages: [{ id: 'lang-1', name: 'Yoruba', iso_639_3: 'yor' }],
    total: 1,
    isLoading: false,
    isError: false,
    refresh: jest.fn(),
  }),
}));

jest.mock('@/hooks/useCurriculumManagement', () => ({
  useCurriculumManagement: () => ({
    validateCourse: (courseId: string) => mockValidateCourse(courseId),
    publishCourse: (courseId: string) => mockPublishCourse(courseId),
    unpublishCourse: (courseId: string) => mockUnpublishCourse(courseId),
    isValidating: false,
    isPublishing: false,
    isUnpublishing: false,
  }),
}));

jest.mock('@/lib/adminCurriculumApi', () => ({
  markSectionsComingSoon: (courseKey: string, sectionIds: string[]) =>
    mockMarkSectionsComingSoon(courseKey, sectionIds),
  updateAdminCourse: (courseId: string, payload: unknown) => mockUpdateAdminCourse(courseId, payload),
  deleteAdminCourse: (courseId: string) => mockDeleteAdminCourse(courseId),
}));

describe('AdminCourseDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateCourse.mockResolvedValue({
      course: {
        id: 'course-1',
        course_key: 'abidii_yoruba_v1',
        title: 'Abidii Yoruba v1',
        description: null,
        status: 'published',
        enabled: true,
        created_at: '2026-03-24T00:00:00Z',
        updated_at: '2026-03-24T00:00:00Z',
      },
      validation: {
        status: 'valid',
        errors: [],
        warnings: [],
        validated_at: '2026-03-24T00:00:00Z',
        can_publish: true,
        blocking_error_count: 0,
        warning_count: 0,
      },
    });
    mockUpdateAdminCourse.mockResolvedValue({
      course: {
        id: 'course-1',
        course_key: 'abidii_yoruba_v1',
        title: 'Updated Course',
        description: null,
        target_language_id: 'lang-1',
        status: 'published',
        enabled: true,
        created_at: '2026-03-24T00:00:00Z',
        updated_at: '2026-03-24T00:00:00Z',
      },
      validation: {
        status: 'valid',
        errors: [],
        warnings: [],
        validated_at: null,
        can_publish: true,
        blocking_error_count: 0,
        warning_count: 0,
      },
    });
  });

  it('renders direct publish blocker actions and marks a section coming soon', async () => {
    const user = userEvent.setup();

    await act(async () => {
      render(
        <React.Suspense fallback={<div>Loading…</div>}>
          <AdminCourseDetailPage params={Promise.resolve({ id: 'course-1' })} />
        </React.Suspense>
      );
    });

    expect(await screen.findByText('Publish Blockers')).toBeInTheDocument();
    expect(screen.getAllByText(/Hello & goodbye/i).length).toBeGreaterThan(0);
    expect(
      screen
        .getAllByRole('link', { name: 'Create Blueprint' })
        .every(
          (link) =>
            link.getAttribute('href') ===
            '/content/curriculum/lesson-blueprints/new?courseKey=abidii_yoruba_v1&sectionId=section-1'
        )
    ).toBe(true);

    await user.click(screen.getAllByRole('button', { name: 'Mark Coming Soon' })[0]);

    await waitFor(() => {
      expect(mockMarkSectionsComingSoon).toHaveBeenCalledWith('abidii_yoruba_v1', ['section-1']);
      expect(mockRefreshCurriculum).toHaveBeenCalled();
      expect(mockValidateCourse).toHaveBeenCalledWith('course-1');
      expect(mockMutateAdmin).toHaveBeenCalled();
    });
  });

  it('updates course metadata from the edit modal', async () => {
    const user = userEvent.setup();

    await act(async () => {
      render(
        <React.Suspense fallback={<div>Loading…</div>}>
          <AdminCourseDetailPage params={Promise.resolve({ id: 'course-1' })} />
        </React.Suspense>
      );
    });

    await user.click(screen.getByRole('button', { name: 'Edit Course' }));
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Updated Course');
    await user.click(screen.getByRole('button', { name: 'Save Course' }));

    await waitFor(() => {
      expect(mockUpdateAdminCourse).toHaveBeenCalledWith('course-1', {
        course_key: 'abidii_yoruba_v1',
        title: 'Updated Course',
        description: null,
        target_language_id: 'lang-1',
      });
      expect(mockMutateAdmin).toHaveBeenCalled();
    });
  });

  it('deletes the course after confirmation', async () => {
    const assignSpy = jest.fn();
    Object.defineProperty(window, 'location', {
      value: { assign: assignSpy },
      writable: true,
    });
    const user = userEvent.setup();

    await act(async () => {
      render(
        <React.Suspense fallback={<div>Loading…</div>}>
          <AdminCourseDetailPage params={Promise.resolve({ id: 'course-1' })} />
        </React.Suspense>
      );
    });

    await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    await user.click(screen.getAllByRole('button', { name: 'Delete' })[1]);

    await waitFor(() => {
      expect(mockDeleteAdminCourse).toHaveBeenCalledWith('course-1');
      expect(assignSpy).toHaveBeenCalledWith('/content/curriculum/courses');
    });
  });
});

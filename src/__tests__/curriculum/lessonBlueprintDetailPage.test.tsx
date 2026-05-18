import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AdminLessonBlueprintDetailPage from '@/app/(admin)/(others-pages)/curriculum/lesson-blueprints/[id]/page';
import { renderWithProviders as render } from '@/test-utils';

const mockMutateAdmin = jest.fn().mockResolvedValue(undefined);
const mockRefreshAdmin = jest.fn().mockResolvedValue(undefined);
const mockMutateLinkedCourse = jest.fn().mockResolvedValue(undefined);
const mockRefreshLinkedCourse = jest.fn().mockResolvedValue(undefined);
const mockRefreshLinkedCurriculum = jest.fn().mockResolvedValue(undefined);
const mockUseAdminBlueprint = jest.fn();
const mockUsePublicBlueprint = jest.fn();
const mockUseAdminCourseValidationSummary = jest.fn();
const mockUseCourseCurriculum = jest.fn();

const mockValidateBlueprint = jest.fn();
const mockPublishBlueprint = jest.fn();
const mockUnpublishBlueprint = jest.fn();
const mockValidateCourse = jest.fn();
const mockPublishCourse = jest.fn();
const mockUnpublishCourse = jest.fn();
const mockListAdminBlueprintVersions = jest.fn();
const mockDiffAdminBlueprintVersion = jest.fn();
const mockRestoreAdminBlueprintVersion = jest.fn();
const mockDeleteAdminBlueprint = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('@/hooks/useApi', () => ({
  useAdminBlueprint: (blueprintId: string) => mockUseAdminBlueprint(blueprintId),
  usePublicBlueprint: (blueprintId: string) => mockUsePublicBlueprint(blueprintId),
  useAdminCourseValidationSummary: (courseId: string | null) => mockUseAdminCourseValidationSummary(courseId),
  useCourseCurriculum: (courseId: string | null) => mockUseCourseCurriculum(courseId),
}));

jest.mock('@/hooks/useCurriculumManagement', () => ({
  useCurriculumManagement: () => ({
    validateBlueprint: (blueprintId: string) => mockValidateBlueprint(blueprintId),
    publishBlueprint: (blueprintId: string) => mockPublishBlueprint(blueprintId),
    unpublishBlueprint: (blueprintId: string) => mockUnpublishBlueprint(blueprintId),
    validateCourse: (courseId: string) => mockValidateCourse(courseId),
    publishCourse: (courseId: string) => mockPublishCourse(courseId),
    unpublishCourse: (courseId: string) => mockUnpublishCourse(courseId),
    isValidating: false,
    isPublishing: false,
    isUnpublishing: false,
  }),
}));

jest.mock('@/components/admin/curriculum/LessonBlueprintEditor', () => ({
  LessonBlueprintEditor: () => <div>Blueprint editor</div>,
}));

jest.mock('@/lib/adminCurriculumApi', () => ({
  listAdminBlueprintVersions: (blueprintId: string) => mockListAdminBlueprintVersions(blueprintId),
  diffAdminBlueprintVersion: (blueprintId: string, versionId: string) =>
    mockDiffAdminBlueprintVersion(blueprintId, versionId),
  restoreAdminBlueprintVersion: (blueprintId: string, versionId: string) =>
    mockRestoreAdminBlueprintVersion(blueprintId, versionId),
  deleteAdminBlueprint: (blueprintId: string) => mockDeleteAdminBlueprint(blueprintId),
}));

const baseBlueprint = {
  id: 'bp-1',
  blueprint_key: 'lesson_greetings_01',
  course_id: 'course-1',
  section_id: 'section-1',
  course_key: 'abidii_yoruba_v1',
  unit_key: 'U2',
  section_key: 'S1',
  target_language_id: null,
  target_language_code: 'yor',
  target_language_name: 'Yoruba',
  lesson_kind: 'structured_micro_lesson',
  schema_version: 1,
  status: 'draft',
  enabled: false,
  payload: {},
  validation_status: 'valid',
  validation_errors: {},
  validated_at: '2026-03-24T00:00:00Z',
  contract: {
    contract_version: 'phase1.v1',
    strict_schema_contract_enabled: true,
    strict_publish_gates_enabled: true,
    strict_enrichment_authority_enabled: true,
    curriculum_atomic_reorder_v2_enabled: true,
    strict_schema_runtime_enforcement_enabled: true,
  },
  created_at: '2026-03-24T00:00:00Z',
  updated_at: '2026-03-24T00:00:00Z',
};

const baseBlueprintValidation = {
  status: 'valid' as const,
  errors: [],
  warnings: [],
  validated_at: '2026-03-24T00:00:00Z',
  can_publish: true,
  blocking_error_count: 0,
  warning_count: 0,
};

const baseCourse = {
  id: 'course-1',
  course_key: 'abidii_yoruba_v1',
  title: 'Abidii Yoruba v1',
  description: null,
  status: 'draft',
  enabled: true,
  created_at: '2026-03-24T00:00:00Z',
  updated_at: '2026-03-24T00:00:00Z',
};

const baseCourseCurriculum = {
  id: 'course-1',
  course_key: 'abidii_yoruba_v1',
  title: 'Abidii Yoruba v1',
  description: null,
  status: 'draft',
  enabled: true,
  availability: 'coming_soon' as const,
  course_revision: 1,
  units: [
    {
      id: 'unit-2',
      unit_key: 'U2',
      title: 'Unit 2: Greetings',
      subtitle: null,
      order_index: 1,
      status: 'published',
      enabled: true,
      availability: 'available' as const,
      sections: [
        {
          id: 'section-1',
          section_key: 'S1',
          title: 'Hello & goodbye',
          order_index: 0,
          status: 'published',
          enabled: true,
          availability: 'coming_soon' as const,
          lesson_blueprint_id: 'bp-1',
          blueprint_key: 'lesson_greetings_01',
          lesson_kind: 'structured_micro_lesson',
          blueprint_status: 'draft',
          blueprint_enabled: false,
        },
      ],
    },
  ],
};

describe('AdminLessonBlueprintDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAdminBlueprint.mockReturnValue({
      data: {
        blueprint: baseBlueprint,
        validation: baseBlueprintValidation,
      },
      isLoading: false,
      isError: false,
      refresh: mockRefreshAdmin,
      mutate: mockMutateAdmin,
    });

    mockUsePublicBlueprint.mockReturnValue({
      blueprint: {
        id: 'bp-1',
        blueprint_key: 'lesson_greetings_01',
        lesson_kind: 'structured_micro_lesson',
        schema_version: 1,
        status: 'draft',
        enabled: false,
        availability: 'coming_soon',
        payload: {},
        validation_status: 'valid',
        validated_at: '2026-03-24T00:00:00Z',
        created_at: '2026-03-24T00:00:00Z',
        updated_at: '2026-03-24T00:00:00Z',
      },
      isLoading: false,
      isError: false,
    });

    mockUseAdminCourseValidationSummary.mockReturnValue({
      data: {
        course: baseCourse,
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
        qa_status: 'partially_testable',
        qa_checks: [],
        can_publish_course: false,
      },
      isLoading: false,
      isError: false,
      mutate: mockMutateLinkedCourse,
      refresh: mockRefreshLinkedCourse,
    });

    mockUseCourseCurriculum.mockReturnValue({
      curriculum: baseCourseCurriculum,
      isLoading: false,
      isError: false,
      refresh: mockRefreshLinkedCurriculum,
    });

    mockValidateBlueprint.mockResolvedValue({
      blueprint: baseBlueprint,
      validation: baseBlueprintValidation,
    });
    mockPublishBlueprint.mockResolvedValue({
      ok: true,
      statusCode: 200,
      body: {
        blueprint: {
          ...baseBlueprint,
          status: 'published',
          enabled: true,
        },
        validation: baseBlueprintValidation,
      },
    });
    mockUnpublishBlueprint.mockResolvedValue({});
    mockValidateCourse.mockResolvedValue({
      course: baseCourse,
      validation: {
        status: 'valid',
        errors: [],
        warnings: [],
        validated_at: '2026-03-24T00:00:00Z',
        can_publish: true,
        blocking_error_count: 0,
        warning_count: 0,
      },
      qa_status: 'verified',
      qa_checks: [],
      can_publish_course: true,
    });
    mockPublishCourse.mockResolvedValue({
      ok: true,
      statusCode: 200,
      body: {
        course: {
          ...baseCourse,
          status: 'published',
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
        qa_status: 'verified',
        qa_checks: [],
        can_publish_course: true,
      },
    });
    mockUnpublishCourse.mockResolvedValue({});
    mockListAdminBlueprintVersions.mockResolvedValue([]);
    mockDiffAdminBlueprintVersion.mockResolvedValue({
      blueprint_id: 'bp-1',
      left_version_id: 'ver-1',
      right_version_id: null,
      changed_fields: ['payload'],
      left_snapshot: {},
      right_snapshot: {},
    });
    mockRestoreAdminBlueprintVersion.mockResolvedValue({
      blueprint: baseBlueprint,
      validation: baseBlueprintValidation,
    });
    mockDeleteAdminBlueprint.mockResolvedValue({ ok: true });
  });

  it('publishes the blueprint and revalidates the linked course from the same page', async () => {
    const user = userEvent.setup();

    render(<AdminLessonBlueprintDetailPage params={{ id: 'bp-1' }} />);

    expect(screen.getByText('Linked Course Flow')).toBeInTheDocument();
    expect(
      screen.getByText(/Publishing a valid blueprint here clears that specific course blocker/i)
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Publish + Recheck Course' }));
    await user.click(screen.getByRole('button', { name: 'Publish and Recheck Course' }));

    await waitFor(() => {
      expect(mockPublishBlueprint).toHaveBeenCalledWith('bp-1');
      expect(mockValidateCourse).toHaveBeenCalledWith('course-1');
      expect(mockMutateAdmin).toHaveBeenCalled();
      expect(mockMutateLinkedCourse).toHaveBeenCalled();
      expect(mockRefreshLinkedCurriculum).toHaveBeenCalled();
    });

    expect(
      await screen.findByText('Blueprint published. Linked course revalidated and is now ready to publish.')
    ).toBeInTheDocument();
  });

  it('publishes the linked course directly from the blueprint workflow when ready', async () => {
    const user = userEvent.setup();

    mockUseAdminCourseValidationSummary.mockReturnValue({
      data: {
        course: {
          ...baseCourse,
          status: 'published',
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
        qa_status: 'verified',
        qa_checks: [],
        can_publish_course: true,
      },
      isLoading: false,
      isError: false,
      mutate: mockMutateLinkedCourse,
      refresh: mockRefreshLinkedCourse,
    });

    render(<AdminLessonBlueprintDetailPage params={{ id: 'bp-1' }} />);

    await user.click(screen.getByRole('button', { name: 'Publish Linked Course' }));
    await user.click(screen.getByRole('button', { name: 'Publish Course' }));

    await waitFor(() => {
      expect(mockPublishCourse).toHaveBeenCalledWith('course-1');
      expect(mockMutateLinkedCourse).toHaveBeenCalled();
      expect(mockRefreshLinkedCurriculum).toHaveBeenCalled();
    });

    expect(await screen.findByText('Linked course published.')).toBeInTheDocument();
  });
});

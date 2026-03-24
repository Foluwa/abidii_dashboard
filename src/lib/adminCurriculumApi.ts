import { apiClient } from '@/lib/api';
import type {
  AtomicReorderRequest,
  AtomicReorderResponse,
  CurriculumUpdateResponse,
  LessonBlueprintCloneRequest,
  LessonBlueprintAuthoringCapabilitiesResponse,
  LessonBlueprintDraftUpsertRequest,
  CourseAdminResponse,
  CourseAdminListResponse,
  CourseCurriculumResponse,
  CourseValidationResponse,
  LessonBlueprintAdminResponse,
  LessonBlueprintAdminListResponse,
  LessonBlueprintValidationResponse,
  PublicLessonBlueprintResponse,
  PublishOutcome,
} from '@/types/curriculum';

function asAxiosLike(error: unknown): any {
  return error as any;
}

export async function getAdminBlueprint(blueprintId: string) {
  const res = await apiClient.get<LessonBlueprintValidationResponse>(
    `/api/v1/admin/lesson-blueprints/${blueprintId}`
  );
  return res.data;
}

export async function listAdminBlueprints(params?: {
  page?: number;
  limit?: number;
  course_id?: string;
  status?: string;
  enabled?: boolean;
  search?: string;
}) {
  const usp = new URLSearchParams();
  if (params?.page) usp.set('page', String(params.page));
  if (params?.limit) usp.set('limit', String(params.limit));
  if (params?.course_id) usp.set('course_id', params.course_id);
  if (params?.status) usp.set('status', params.status);
  if (typeof params?.enabled === 'boolean') usp.set('enabled', String(params.enabled));
  if (params?.search) usp.set('search', params.search);

  const suffix = usp.toString() ? `?${usp.toString()}` : '';
  const res = await apiClient.get<LessonBlueprintAdminListResponse>(
    `/api/v1/admin/lesson-blueprints${suffix}`
  );
  return res.data;
}

export async function getAdminBlueprintCapabilities() {
  const res = await apiClient.get<LessonBlueprintAuthoringCapabilitiesResponse>(
    '/api/v1/admin/lesson-blueprints/capabilities'
  );
  return res.data;
}

export async function validateAdminBlueprint(blueprintId: string) {
  const res = await apiClient.post<LessonBlueprintValidationResponse>(
    `/api/v1/admin/lesson-blueprints/${blueprintId}/validate`
  );
  return res.data;
}

export async function previewAdminBlueprintDraft(payload: LessonBlueprintDraftUpsertRequest) {
  const res = await apiClient.post<LessonBlueprintValidationResponse>(
    '/api/v1/admin/lesson-blueprints/preview',
    payload
  );
  return res.data;
}

export async function createAdminBlueprint(payload: LessonBlueprintDraftUpsertRequest) {
  const res = await apiClient.post<LessonBlueprintValidationResponse>(
    '/api/v1/admin/lesson-blueprints',
    payload
  );
  return res.data;
}

export async function updateAdminBlueprint(
  blueprintId: string,
  payload: LessonBlueprintDraftUpsertRequest
) {
  const res = await apiClient.put<LessonBlueprintValidationResponse>(
    `/api/v1/admin/lesson-blueprints/${blueprintId}`,
    payload
  );
  return res.data;
}

export async function cloneAdminBlueprint(
  blueprintId: string,
  payload: LessonBlueprintCloneRequest
) {
  const res = await apiClient.post<LessonBlueprintValidationResponse>(
    `/api/v1/admin/lesson-blueprints/${blueprintId}/clone`,
    payload
  );
  return res.data;
}

export async function publishAdminBlueprint(
  blueprintId: string
): Promise<PublishOutcome<LessonBlueprintValidationResponse>> {
  try {
    const res = await apiClient.post<LessonBlueprintValidationResponse>(
      `/api/v1/admin/lesson-blueprints/${blueprintId}/publish`
    );
    return { ok: true, statusCode: 200, body: res.data };
  } catch (err) {
    const error = asAxiosLike(err);
    if (error?.response?.status === 409 && error?.response?.data) {
      return {
        ok: false,
        statusCode: 409,
        body: error.response.data as LessonBlueprintValidationResponse,
      };
    }
    throw err;
  }
}

export async function unpublishAdminBlueprint(blueprintId: string) {
  const res = await apiClient.post<LessonBlueprintAdminResponse>(
    `/api/v1/admin/lesson-blueprints/${blueprintId}/unpublish`
  );
  return res.data;
}

export async function getAdminCourse(courseId: string) {
  const res = await apiClient.get<CourseValidationResponse>(
    `/api/v1/admin/courses/${courseId}`
  );
  return res.data;
}

export async function listAdminCourses(params?: {
  page?: number;
  limit?: number;
  status?: string;
  enabled?: boolean;
  search?: string;
}) {
  const usp = new URLSearchParams();
  if (params?.page) usp.set('page', String(params.page));
  if (params?.limit) usp.set('limit', String(params.limit));
  if (params?.status) usp.set('status', params.status);
  if (typeof params?.enabled === 'boolean') usp.set('enabled', String(params.enabled));
  if (params?.search) usp.set('search', params.search);

  const suffix = usp.toString() ? `?${usp.toString()}` : '';
  const res = await apiClient.get<CourseAdminListResponse>(
    `/api/v1/admin/courses${suffix}`
  );
  return res.data;
}

export async function getAdminCourseValidationSummary(courseId: string) {
  const res = await apiClient.get<CourseValidationResponse>(
    `/api/v1/admin/courses/${courseId}/validation-summary`
  );
  return res.data;
}

export async function validateAdminCourse(courseId: string) {
  const res = await apiClient.post<CourseValidationResponse>(
    `/api/v1/admin/courses/${courseId}/validate`
  );
  return res.data;
}

export async function publishAdminCourse(
  courseId: string
): Promise<PublishOutcome<CourseValidationResponse>> {
  try {
    const res = await apiClient.post<CourseValidationResponse>(
      `/api/v1/admin/courses/${courseId}/publish`
    );
    return { ok: true, statusCode: 200, body: res.data };
  } catch (err) {
    const error = asAxiosLike(err);
    if (error?.response?.status === 409 && error?.response?.data) {
      return {
        ok: false,
        statusCode: 409,
        body: error.response.data as CourseValidationResponse,
      };
    }
    throw err;
  }
}

export async function unpublishAdminCourse(courseId: string) {
  const res = await apiClient.post<CourseAdminResponse>(
    `/api/v1/admin/courses/${courseId}/unpublish`
  );
  return res.data;
}

export async function getPublicBlueprint(blueprintId: string) {
  const res = await apiClient.get<PublicLessonBlueprintResponse>(
    `/api/v1/lesson-blueprints/${blueprintId}`
  );
  return res.data;
}

export async function getCourseCurriculum(courseId: string) {
  const res = await apiClient.get<CourseCurriculumResponse>(
    `/api/v1/courses/${courseId}/curriculum`
  );
  return res.data;
}

export async function getCourseCurriculumByKey(courseKey: string) {
  const res = await apiClient.get<CourseCurriculumResponse>(
    `/api/v1/courses/by-key/${courseKey}/curriculum`
  );
  return res.data;
}

export async function reorderCourseUnits(courseKey: string, units: { unit_key: string; order_index: number }[]) {
  const res = await apiClient.patch<CurriculumUpdateResponse>(`/api/v1/admin/curriculum/courses/${courseKey}/units/reorder`, {
    units,
  });
  return res.data;
}

export async function reorderCourseSections(
  courseKey: string,
  sections: { unit_key: string; section_key: string; order_index: number }[]
) {
  const res = await apiClient.patch<CurriculumUpdateResponse>(`/api/v1/admin/curriculum/courses/${courseKey}/sections/reorder`, {
    sections,
  });
  return res.data;
}

export async function moveCourseSection(
  courseKey: string,
  payload: { section_key: string; to_unit_key: string; order_index: number; from_unit_key?: string }
) {
  const res = await apiClient.patch<CurriculumUpdateResponse>(`/api/v1/admin/curriculum/courses/${courseKey}/sections/move`, payload);
  return res.data;
}

export async function markSectionsComingSoon(courseKey: string, sectionIds: string[]) {
  const res = await apiClient.post<CurriculumUpdateResponse>(
    `/api/v1/admin/curriculum/courses/${courseKey}/sections/mark-coming-soon`,
    {
      section_ids: sectionIds,
    }
  );
  return res.data;
}

export async function reorderCourseAtomicV2(
  courseKey: string,
  payload: AtomicReorderRequest
) {
  const res = await apiClient.patch<AtomicReorderResponse>(
    `/api/v1/admin/curriculum/courses/${courseKey}/reorder-atomic-v2`,
    payload
  );
  return res.data;
}

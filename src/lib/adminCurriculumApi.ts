import { apiClient } from '@/lib/api';
import type {
  AtomicReorderRequest,
  AtomicReorderResponse,
  CourseDraftUpsertRequest,
  CurriculumVocabLibraryResponse,
  CurriculumUpdateResponse,
  CurriculumQaCheckUpdateRequest,
  LessonBlueprintAssetCleanupResponse,
  LessonBlueprintAssetCompleteRequest,
  LessonBlueprintAssetUploadRequest,
  LessonBlueprintAssetUploadResponse,
  LessonBlueprintAssetRenameRequest,
  LessonBlueprintCloneRequest,
  LessonBlueprintAuthoringCapabilitiesResponse,
  LessonBlueprintDraftUpsertRequest,
  LessonBlueprintVersionDiffPayload,
  LessonBlueprintVersionPayload,
  SectionCreateRequest,
  SectionUpdateRequest,
  CourseAdminResponse,
  CourseAdminListResponse,
  CurriculumReadinessMatrixResponse,
  CourseCurriculumResponse,
  CourseValidationResponse,
  LessonBlueprintAdminResponse,
  LessonBlueprintAdminListResponse,
  LessonBlueprintValidationResponse,
  PublicLessonBlueprintResponse,
  PublishOutcome,
  UnitCreateRequest,
  UnitUpdateRequest,
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

export async function requestBlueprintAssetUpload(
  blueprintId: string,
  payload: LessonBlueprintAssetUploadRequest
) {
  const res = await apiClient.post<LessonBlueprintAssetUploadResponse>(
    `/api/v1/admin/lesson-blueprints/${blueprintId}/assets/upload-url`,
    payload
  );
  return res.data;
}

export async function completeBlueprintAssetUpload(
  blueprintId: string,
  payload: LessonBlueprintAssetCompleteRequest
) {
  const res = await apiClient.post<LessonBlueprintValidationResponse>(
    `/api/v1/admin/lesson-blueprints/${blueprintId}/assets/complete`,
    payload
  );
  return res.data;
}

export async function uploadBlueprintAsset(
  blueprintId: string,
  payload: {
    field_path: string;
    file: File;
  },
  onProgress?: (percent: number) => void
) {
  const formData = new FormData();
  formData.append('field_path', payload.field_path);
  formData.append('file', payload.file);

  const res = await apiClient.post<LessonBlueprintValidationResponse>(
    `/api/v1/admin/lesson-blueprints/${blueprintId}/assets/upload`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (event) => {
        if (!event.total || !onProgress) return;
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      },
    }
  );
  onProgress?.(100);
  return res.data;
}

export async function renameBlueprintAsset(
  blueprintId: string,
  payload: LessonBlueprintAssetRenameRequest
) {
  const res = await apiClient.patch<LessonBlueprintValidationResponse>(
    `/api/v1/admin/lesson-blueprints/${blueprintId}/assets/metadata`,
    payload
  );
  return res.data;
}

export async function deleteBlueprintAsset(
  blueprintId: string,
  fieldPath: string
) {
  const res = await apiClient.delete<LessonBlueprintValidationResponse>(
    `/api/v1/admin/lesson-blueprints/${blueprintId}/assets?field_path=${encodeURIComponent(fieldPath)}`
  );
  return res.data;
}

export async function cleanupOrphanedBlueprintAssets(courseId?: string) {
  const suffix = courseId ? `?course_id=${encodeURIComponent(courseId)}` : '';
  const res = await apiClient.post<LessonBlueprintAssetCleanupResponse>(
    `/api/v1/admin/lesson-blueprints/assets/cleanup-orphans${suffix}`
  );
  return res.data;
}

export async function listCurriculumVocabLibrary(params: {
  language_id: string;
  page?: number;
  limit?: number;
  search?: string;
  external_ids?: string[];
}) {
  const usp = new URLSearchParams();
  usp.set('language_id', params.language_id);
  if (params.page) usp.set('page', String(params.page));
  if (params.limit) usp.set('limit', String(params.limit));
  if (params.search) usp.set('search', params.search);
  for (const externalId of params.external_ids ?? []) {
    if (externalId) usp.append('external_ids', externalId);
  }

  const res = await apiClient.get<CurriculumVocabLibraryResponse>(
    `/api/v1/admin/lesson-blueprints/vocab/library?${usp.toString()}`
  );
  return res.data;
}

export async function uploadFileToPresignedUrl(
  uploadUrl: string,
  file: File,
  contentType: string,
  onProgress?: (percent: number) => void
) {
  return await new Promise<XMLHttpRequest>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve(xhr);
        return;
      }
      reject(new Error(`Asset upload failed with status ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Asset upload failed'));
    xhr.send(file);
  });
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

export async function listAdminBlueprintVersions(blueprintId: string) {
  const res = await apiClient.get<LessonBlueprintVersionPayload[]>(
    `/api/v1/admin/lesson-blueprints/${blueprintId}/history`
  );
  return res.data;
}

export async function diffAdminBlueprintVersion(blueprintId: string, versionId: string) {
  const res = await apiClient.get<LessonBlueprintVersionDiffPayload>(
    `/api/v1/admin/lesson-blueprints/${blueprintId}/history/${versionId}/diff`
  );
  return res.data;
}

export async function restoreAdminBlueprintVersion(blueprintId: string, versionId: string) {
  const res = await apiClient.post<LessonBlueprintValidationResponse>(
    `/api/v1/admin/lesson-blueprints/${blueprintId}/history/${versionId}/restore`
  );
  return res.data;
}

export async function deleteAdminBlueprint(blueprintId: string) {
  const res = await apiClient.delete<{ ok: boolean; message?: string | null }>(
    `/api/v1/admin/lesson-blueprints/${blueprintId}`
  );
  return res.data;
}

export async function getAdminCourse(courseId: string) {
  const res = await apiClient.get<CourseValidationResponse>(
    `/api/v1/admin/courses/${courseId}`
  );
  return res.data;
}

export async function createAdminCourse(payload: CourseDraftUpsertRequest) {
  const res = await apiClient.post<CourseValidationResponse>(
    '/api/v1/admin/courses',
    payload
  );
  return res.data;
}

export async function updateAdminCourse(
  courseId: string,
  payload: CourseDraftUpsertRequest
) {
  const res = await apiClient.put<CourseValidationResponse>(
    `/api/v1/admin/courses/${courseId}`,
    payload
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

export async function getCurriculumReadinessMatrix() {
  const res = await apiClient.get<CurriculumReadinessMatrixResponse>(
    '/api/v1/admin/curriculum/readiness-matrix'
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

export async function deleteAdminCourse(courseId: string) {
  const res = await apiClient.delete<{ ok: boolean; message?: string | null }>(
    `/api/v1/admin/courses/${courseId}`
  );
  return res.data;
}

export async function updateCourseQaCheck(
  courseId: string,
  checkKey: string,
  payload: CurriculumQaCheckUpdateRequest
) {
  const res = await apiClient.put<CourseValidationResponse>(
    `/api/v1/admin/courses/${courseId}/qa-checks/${encodeURIComponent(checkKey)}`,
    payload
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
  payload: {
    section_id?: string;
    section_key: string;
    to_unit_key: string;
    order_index: number;
    from_unit_key?: string;
  }
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

export async function createCourseUnit(courseKey: string, payload: UnitCreateRequest) {
  const res = await apiClient.post<CurriculumUpdateResponse>(
    `/api/v1/admin/curriculum/courses/${courseKey}/units`,
    payload
  );
  return res.data;
}

export async function updateCourseUnit(
  courseKey: string,
  unitKey: string,
  payload: UnitUpdateRequest
) {
  const res = await apiClient.patch<CurriculumUpdateResponse>(
    `/api/v1/admin/curriculum/courses/${courseKey}/units/${encodeURIComponent(unitKey)}`,
    payload
  );
  return res.data;
}

export async function deleteCourseUnit(courseKey: string, unitKey: string, hardDelete = false) {
  const res = await apiClient.delete<CurriculumUpdateResponse>(
    `/api/v1/admin/curriculum/courses/${courseKey}/units/${encodeURIComponent(unitKey)}?hard_delete=${String(hardDelete)}`
  );
  return res.data;
}

export async function createCourseSection(
  courseKey: string,
  unitKey: string,
  payload: SectionCreateRequest
) {
  const res = await apiClient.post<CurriculumUpdateResponse>(
    `/api/v1/admin/curriculum/courses/${courseKey}/units/${encodeURIComponent(unitKey)}/sections`,
    payload
  );
  return res.data;
}

export async function updateCourseSection(
  courseKey: string,
  unitKey: string,
  sectionKey: string,
  payload: SectionUpdateRequest
) {
  const res = await apiClient.patch<CurriculumUpdateResponse>(
    `/api/v1/admin/curriculum/courses/${courseKey}/units/${encodeURIComponent(unitKey)}/sections/${encodeURIComponent(sectionKey)}`,
    payload
  );
  return res.data;
}

export async function deleteCourseSection(
  courseKey: string,
  unitKey: string,
  sectionKey: string,
  hardDelete = false
) {
  const res = await apiClient.delete<CurriculumUpdateResponse>(
    `/api/v1/admin/curriculum/courses/${courseKey}/units/${encodeURIComponent(unitKey)}/sections/${encodeURIComponent(sectionKey)}?hard_delete=${String(hardDelete)}`
  );
  return res.data;
}

export type ValidationSeverity = 'ERROR' | 'WARNING';
export type ValidationStatus = 'valid' | 'invalid' | 'unknown';

export interface ValidationIssuePayload {
  code: string;
  path: string;
  message: string;
  severity: ValidationSeverity;
}

export interface ValidationResultPayload {
  status: ValidationStatus;
  errors: ValidationIssuePayload[];
  warnings: ValidationIssuePayload[];

  validated_at: string | null;
  can_publish: boolean;
  blocking_error_count: number;
  warning_count: number;
}

export interface LessonBlueprintAdminResponse {
  id: string;
  blueprint_key: string;
  course_id: string;
  section_id: string;
  course_key?: string | null;
  unit_key?: string | null;
  section_key?: string | null;
  target_language_id?: string | null;
  target_language_code?: string | null;
  target_language_name?: string | null;
  lesson_kind: string;
  schema_version: number;
  status: string;
  enabled: boolean;
  payload: Record<string, unknown>;

  validation_status: string;
  validation_errors: Record<string, unknown>;
  validated_at: string | null;
  schema_compatibility?: {
    schema_version: number;
    min_supported_schema_version: number;
    max_supported_schema_version: number;
    client_enforcement: string;
    notes?: string | null;
  } | null;
  contract?: {
    contract_version: string;
    strict_schema_contract_enabled: boolean;
    strict_publish_gates_enabled: boolean;
    strict_enrichment_authority_enabled: boolean;
    curriculum_atomic_reorder_v2_enabled: boolean;
    strict_schema_runtime_enforcement_enabled: boolean;
    strict_publish_runtime_enforcement_enabled?: boolean;
  };

  created_at: string;
  updated_at: string;
  review_status?: 'published' | 'needs_review' | 'draft_only' | string;
  has_unpublished_changes?: boolean;
  draft_id?: string | null;
  draft_updated_at?: string | null;
  published_blueprint_key?: string | null;
  published_course_id?: string | null;
  published_section_id?: string | null;
  published_lesson_kind?: string | null;
  published_schema_version?: number | null;
  published_payload?: Record<string, unknown>;
  published_status?: string | null;
  published_enabled?: boolean | null;
  published_validation_status?: string | null;
  published_validation_errors?: Record<string, unknown>;
  published_validated_at?: string | null;
  published_updated_at?: string | null;
}

export interface LessonBlueprintMediaBinding {
  field_path: string;
  asset_kind?: string | null;
  storage_key: string;
  asset_url: string;
  content_type?: string | null;
  file_size_bytes?: number | null;
  file_name?: string | null;
  uploaded_at?: string | null;
  etag?: string | null;
}

export interface LessonBlueprintAssetLibraryItem {
  blueprint_id: string;
  blueprint_key: string;
  course_id: string;
  course_key?: string | null;
  section_id: string;
  unit_key?: string | null;
  section_key?: string | null;
  lesson_kind: string;
  field_path: string;
  binding: LessonBlueprintMediaBinding;
}

export interface LessonBlueprintAssetLibraryResponse {
  items: LessonBlueprintAssetLibraryItem[];
  total: number;
  page: number;
  limit: number;
}

export interface CourseAdminResponse {
  id: string;
  course_key: string;
  title: string;
  description: string | null;
  target_language_id?: string | null;
  target_language_code?: string | null;
  target_language_name?: string | null;
  status: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CourseDraftUpsertRequest {
  course_key: string;
  title: string;
  description?: string | null;
  target_language_id: string;
}

export interface LessonBlueprintValidationResponse {
  blueprint: LessonBlueprintAdminResponse;
  validation: ValidationResultPayload;
}

export interface LessonKindCapability {
  key: string;
  label: string;
  description?: string | null;
  runtime_family: string;
  validation_supported: boolean;
  publish_supported: boolean;
  mobile_fallback_required: boolean;
  default_payload: Record<string, unknown>;
}

export interface LessonBlueprintAuthoringCapabilitiesResponse {
  contract: {
    contract_version: string;
    strict_schema_contract_enabled: boolean;
    strict_publish_gates_enabled: boolean;
    strict_enrichment_authority_enabled: boolean;
    curriculum_atomic_reorder_v2_enabled: boolean;
    strict_schema_runtime_enforcement_enabled: boolean;
    strict_publish_runtime_enforcement_enabled?: boolean;
  };
  schema_compatibility: {
    schema_version: number;
    min_supported_schema_version: number;
    max_supported_schema_version: number;
    client_enforcement: string;
    notes?: string | null;
  };
  target_languages_required: boolean;
  lesson_kinds: LessonKindCapability[];
}

export interface CourseValidationResponse {
  course: CourseAdminResponse;
  validation: ValidationResultPayload;
  qa_status?: CurriculumCourseQaStatus | 'verified' | null;
  qa_checks?: CurriculumQaCheck[];
  can_publish_course?: boolean;
}

export type CurriculumQaCheckStatus =
  | 'passed'
  | 'pending_manual'
  | 'blocked'
  | 'not_applicable';

export type CurriculumCourseQaStatus =
  | 'verified'
  | 'ready_to_test'
  | 'partially_testable'
  | 'blocked';

export interface CurriculumQaCheck {
  key: string;
  label: string;
  status: CurriculumQaCheckStatus;
  detail?: string | null;
  notes?: string | null;
  build_version?: string | null;
  verified_at?: string | null;
  verified_by?: string | null;
  source?: 'system' | 'manual';
  required_for_publish?: boolean;
}

export interface CurriculumReadinessCourse {
  course: CourseAdminResponse;
  validation: ValidationResultPayload;
  unit_count: number;
  section_count: number;
  blueprint_count: number;
  published_blueprint_count: number;
  launchable_section_count: number;
  missing_blueprint_section_count: number;
  lesson_kinds: string[];
  qa_status: CurriculumCourseQaStatus;
  qa_checks: CurriculumQaCheck[];
}

export interface CurriculumReadinessLanguage {
  target_language_id?: string | null;
  target_language_code?: string | null;
  target_language_name?: string | null;
  course_count: number;
  unit_count: number;
  section_count: number;
  blueprint_count: number;
  published_blueprint_count: number;
  launchable_section_count: number;
  lesson_kinds: string[];
  courses: CurriculumReadinessCourse[];
}

export interface CurriculumReadinessTotals {
  language_count: number;
  course_count: number;
  unit_count: number;
  section_count: number;
  blueprint_count: number;
  published_blueprint_count: number;
  launchable_section_count: number;
  ready_to_test_course_count: number;
  partially_testable_course_count: number;
  blocked_course_count: number;
}

export interface CurriculumReadinessMatrixResponse {
  generated_at: string;
  totals: CurriculumReadinessTotals;
  languages: CurriculumReadinessLanguage[];
}

export interface AdminPaginatedListResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  filters_applied?: Record<string, unknown>;
}

export interface LessonBlueprintAdminListItem {
  id: string;
  blueprint_key: string;
  course_id: string;
  section_id: string;
  course_key?: string | null;
  unit_key?: string | null;
  section_key?: string | null;
  target_language_id?: string | null;
  target_language_code?: string | null;
  target_language_name?: string | null;
  lesson_kind: string;
  schema_version: number;
  status: string;
  enabled: boolean;
  validation_status: string;
  validated_at: string | null;
  blocking_error_count: number;
  warning_count: number;
  created_at: string;
  updated_at: string;
}

export type LessonBlueprintAdminListResponse = AdminPaginatedListResponse<LessonBlueprintAdminListItem>;

export type CourseAdminListItem = CourseAdminResponse;
export type CourseAdminListResponse = AdminPaginatedListResponse<CourseAdminListItem>;

export type AvailabilityStatus = 'available' | 'coming_soon' | 'hidden';

export interface PublicLessonBlueprintResponse {
  id: string;
  blueprint_key: string;
  lesson_kind: string;
  launch_route?: string;
  schema_version: number;
  target_language_id?: string | null;
  target_language_code?: string | null;
  target_language_name?: string | null;
  status: string;
  enabled: boolean;
  availability: AvailabilityStatus;
  payload: Record<string, unknown>;
  validation_status: string;
  validated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CurriculumSection {
  id: string;
  section_key: string;
  title: string;
  order_index?: number | null;
  status: string;
  enabled: boolean;
  availability: AvailabilityStatus;
  lesson_blueprint_id: string | null;
  blueprint_key: string | null;
  lesson_kind?: string | null;
  launch_route?: string | null;
  blueprint_status?: string | null;
  blueprint_enabled?: boolean | null;
}

export interface CurriculumUnit {
  id: string;
  unit_key: string;
  title: string;
  subtitle: string | null;
  order_index?: number | null;
  status: string;
  enabled: boolean;
  availability: AvailabilityStatus;
  sections: CurriculumSection[];
}

export interface CourseCurriculumResponse {
  id: string;
  course_key: string;
  title: string;
  description: string | null;
  target_language_id?: string | null;
  target_language_code?: string | null;
  target_language_name?: string | null;
  status: string;
  enabled: boolean;
  availability: AvailabilityStatus;
  course_revision?: number | null;
  units: CurriculumUnit[];
}

export interface LessonBlueprintDraftUpsertRequest {
  blueprint_key?: string | null;
  course_id: string;
  section_id: string;
  lesson_kind: string;
  schema_version: number;
  payload: Record<string, unknown>;
}

export interface LessonBlueprintAssetUploadRequest {
  field_path: string;
  file_name: string;
  content_type: string;
  file_size_bytes: number;
}

export interface LessonBlueprintAssetUploadResponse {
  field_path: string;
  storage_key: string;
  asset_url: string;
  upload_url: string;
  expires_at: string;
  max_upload_size: number;
}

export interface LessonBlueprintAssetCompleteRequest {
  field_path: string;
  storage_key: string;
  file_name?: string | null;
}

export interface LessonBlueprintAssetRenameRequest {
  field_path: string;
  file_name: string;
}

export interface LessonBlueprintCloneRequest {
  blueprint_key?: string | null;
  course_id?: string;
  section_id?: string;
}

export interface LessonBlueprintAssetCleanupResponse {
  ok: boolean;
  scanned_blueprint_count: number;
  updated_blueprint_count: number;
  removed_binding_count: number;
}

export interface CurriculumVocabLibraryItem {
  external_id: string;
  language_id: string;
  lemma_id?: string | null;
  lemma?: string | null;
  part_of_speech?: string | null;
}

export interface CurriculumVocabLibraryResponse {
  items: CurriculumVocabLibraryItem[];
  total: number;
  page: number;
  limit: number;
}

export interface CurriculumQaCheckUpdateRequest {
  status: CurriculumQaCheckStatus;
  notes?: string | null;
  build_version?: string | null;
}

export interface LessonBlueprintVersionPayload {
  id: string;
  blueprint_id: string;
  version_number: number;
  event_type: string;
  snapshot: Record<string, unknown>;
  payload_hash?: string | null;
  created_at: string;
  actor_user_id?: string | null;
}

export interface LessonBlueprintVersionDiffPayload {
  blueprint_id: string;
  left_version_id?: string | null;
  right_version_id?: string | null;
  changed_fields: string[];
  left_snapshot: Record<string, unknown>;
  right_snapshot: Record<string, unknown>;
}

export interface UnitCreateRequest {
  unit_key: string;
  title: string;
  subtitle?: string | null;
  status: string;
  enabled: boolean;
  order_index?: number | null;
}

export interface UnitUpdateRequest {
  unit_key?: string;
  title?: string;
  subtitle?: string | null;
  status?: string;
  enabled?: boolean;
}

export interface SectionCreateRequest {
  section_key: string;
  title: string;
  status: string;
  enabled: boolean;
  order_index?: number | null;
}

export interface SectionUpdateRequest {
  section_key?: string;
  title?: string;
  status?: string;
  enabled?: boolean;
}

export interface CurriculumUpdateResponse {
  ok: boolean;
  course_key: string;
  request_id?: string | null;
  curriculum?: CourseCurriculumResponse | null;
}

export interface AtomicReorderSectionItem {
  section_key: string;
  order_index: number;
}

export interface AtomicReorderUnitItem {
  unit_key: string;
  order_index: number;
  sections: AtomicReorderSectionItem[];
}

export interface AtomicReorderRequest {
  expected_revision: number;
  units: AtomicReorderUnitItem[];
}

export interface AtomicReorderResponse extends CurriculumUpdateResponse {
  expected_revision: number;
  new_revision: number;
}

export type PublishOutcome<T> =
  | { ok: true; statusCode: 200; body: T }
  | { ok: false; statusCode: 409; body: T };

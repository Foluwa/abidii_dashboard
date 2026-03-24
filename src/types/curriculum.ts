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
  blueprint_key: string;
  course_id: string;
  section_id: string;
  lesson_kind: string;
  schema_version: number;
  payload: Record<string, unknown>;
}

export interface LessonBlueprintCloneRequest {
  blueprint_key: string;
  course_id?: string;
  section_id?: string;
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

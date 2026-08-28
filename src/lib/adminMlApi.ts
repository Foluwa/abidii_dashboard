import { apiClient } from "@/lib/api";

export type MlReadinessLanguage = {
  language_code: string;
  label_count: number;
  labels: string[];
};

export type MlReadinessResponse = {
  generated_at: string;
  threshold: number;
  languages: MlReadinessLanguage[];
  model_versions: Record<string, number>;
  training_jobs: Record<string, number>;
};

export type MlTrainingJob = {
  id: string;
  job_type: string;
  language_code?: string | null;
  dataset_path?: string | null;
  dataset_version?: string | null;
  model_status_target: string;
  executor_type: string;
  external_job_id?: string | null;
  status: string;
  progress_percentage: number;
  current_stage: string;
  attempt_count: number;
  max_attempts: number;
  next_retry_at?: string | null;
  heartbeat_at?: string | null;
  last_polled_at?: string | null;
  parameters?: Record<string, unknown> | null;
  mlflow_run_id?: string | null;
  artifact_path?: string | null;
  artifact_manifest_key?: string | null;
  logs_path?: string | null;
  model_version_id?: number | null;
  error_message?: string | null;
  queued_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type MlTrainingJobListResponse = {
  items: MlTrainingJob[];
  total: number;
  limit: number;
  offset: number;
};

export type MlTrainingJobEvent = {
  id: number;
  event_type: string;
  message: string;
  details?: Record<string, unknown> | null;
  created_at: string;
};

export type MlTrainingJobLogsResponse = {
  job_id: string;
  events: MlTrainingJobEvent[];
  message: string;
};

export type MlModelVersion = {
  id?: string | null;
  model_name?: string | null;
  language_code?: string | null;
  model_type?: string | null;
  status?: string | null;
  version?: string | null;
  object_key?: string | null;
  training_dataset_size?: number | null;
  training_accuracy?: number | null;
  validation_accuracy?: number | null;
  test_accuracy?: number | null;
  metrics?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type MlModelVersionListResponse = {
  items: MlModelVersion[];
  total: number;
  limit: number;
  offset: number;
};

export type MlModelVersionActionResponse = {
  action: "promote" | "rollback";
  promoted_model_version: MlModelVersion;
  archived_model_versions: MlModelVersion[];
  message: string;
};

export type VerifiedPromotionManifest = {
  id: string;
  run_id?: string;
  created_at?: string | null;
  languages?: string[];
  candidate_count: number;
  status_counts: Record<string, number>;
  language_counts?: Record<string, number>;
  issue_count?: number;
  conflict_count?: number;
  validation_status?: string;
  apply_status?: string;
  summary?: Record<string, unknown>;
  issues?: Record<string, unknown>[];
  validation_report?: Record<string, unknown> | null;
  apply_report?: Record<string, unknown> | null;
};

export type VerifiedPromotionCandidate = {
  candidate_id: string;
  language: string;
  source_type: string;
  source_key: string;
  source_keys?: string[];
  raw_label?: string | null;
  label: string;
  canonical_label: string;
  proposed_verified_key: string;
  sha256?: string;
  image_hash?: string;
  width?: number;
  height?: number;
  image_size_bytes?: number;
  model_prediction?: string | null;
  confidence?: number | null;
  model_version?: string | null;
  reason_for_inclusion?: string[];
  review_status: "pending" | "approved" | "rejected";
  review_notes?: string | null;
  label_conflict?: boolean;
  conflict_labels?: string[];
  created_at?: string;
};

export type VerifiedPromotionCandidateListResponse = {
  items: VerifiedPromotionCandidate[];
  total: number;
  limit: number;
  offset: number;
};

export type VerifiedPromotionReadinessResponse = {
  threshold: number;
  languages: Array<{
    language: string;
    threshold: number;
    ready_count: number;
    not_ready_count: number;
    priority_gaps: Array<{ label: string; count: number; needed: number }>;
  }>;
};

export type VerifiedPromotionCollectionGap = {
  language: string;
  label: string;
  current_candidates: number;
  approved_pending_samples: number;
  verified_samples: number;
  projected_after_approved_apply: number;
  needed_to_300: number;
  needed_to_500: number;
  collection_target: number;
};

export type VerifiedPromotionCollectionGapResponse = {
  manifest_id?: string | null;
  target_low: number;
  target_high: number;
  items: VerifiedPromotionCollectionGap[];
};

export type HandwritingDatasetReadinessResponse = {
  manifest_id?: string | null;
  generated_at: string;
  target_min_count: number;
  target_high_count: number;
  global_readiness: {
    total_classes: number;
    ready_classes: number;
    missing_classes: number;
    low_classes: number;
    blocking_classes: number;
    approved_pending_samples: number;
    can_run_dry_run_promotion: boolean;
    can_run_full_training: boolean;
    next_best_action: string;
  };
  classes: Array<{
    class_label: string;
    language: string;
    script_group: string;
    candidate_count: number;
    verified_count: number;
    approved_pending_count: number;
    rejected_count: number;
    target_min_count: number;
    target_high_count: number;
    readiness_status: string;
    is_blocking_training: boolean;
    recommended_action: string;
    needed_to_300: number;
    needed_to_500: number;
  }>;
};

function buildQuery(params: Record<string, string | number | boolean | undefined>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  });
  const suffix = searchParams.toString();
  return suffix ? `?${suffix}` : "";
}

export async function getMlReadiness(threshold = 180) {
  const res = await apiClient.get<MlReadinessResponse>(
    `/api/v1/admin/ml/handwriting/readiness${buildQuery({ threshold })}`
  );
  return res.data;
}

export async function getHandwritingDatasetReadiness(params?: {
  manifest_id?: string;
  target_min_count?: number;
  target_high_count?: number;
}) {
  const res = await apiClient.get<HandwritingDatasetReadinessResponse>(
    `/api/v1/admin/ml/handwriting/dataset-readiness${buildQuery({
      manifest_id: params?.manifest_id,
      target_min_count: params?.target_min_count ?? 180,
      target_high_count: params?.target_high_count ?? 300,
    })}`
  );
  return res.data;
}

export async function queueTrainingJob(payload: {
  job_type?: "handwriting_tinyvgg_train" | "handwriting_tinyvgg_retrain";
  language_code?: "yor" | "eng";
  dataset_path?: string;
  model_status_target?: "staging" | "production";
  executor_type?: "local" | "lambda";
  max_attempts?: number;
  parameters?: Record<string, unknown>;
}) {
  const res = await apiClient.post<MlTrainingJob>(
    "/api/v1/admin/ml/training-jobs",
    {
      job_type: payload.job_type ?? "handwriting_tinyvgg_train",
      language_code: payload.language_code ?? "yor",
      dataset_path: payload.dataset_path ?? null,
      model_status_target: payload.model_status_target ?? "staging",
      executor_type: payload.executor_type ?? null,
      max_attempts: payload.max_attempts ?? null,
      parameters: payload.parameters ?? null,
    }
  );
  return res.data;
}

export async function listMlTrainingJobs(params?: {
  status?: string;
  language_code?: string;
  job_type?: string;
  limit?: number;
  offset?: number;
}) {
  const res = await apiClient.get<MlTrainingJobListResponse>(
    `/api/v1/admin/ml/training-jobs${buildQuery({
      status: params?.status,
      language_code: params?.language_code,
      job_type: params?.job_type,
      limit: params?.limit,
      offset: params?.offset,
    })}`
  );
  return res.data;
}

export async function getMlTrainingJob(jobId: string) {
  const res = await apiClient.get<MlTrainingJob>(`/api/v1/admin/ml/training-jobs/${jobId}`);
  return res.data;
}

export async function getMlTrainingJobLogs(jobId: string) {
  const res = await apiClient.get<MlTrainingJobLogsResponse>(`/api/v1/admin/ml/training-jobs/${jobId}/logs`);
  return res.data;
}

export async function listMlModelVersions(params?: {
  status?: string;
  language_code?: string;
  limit?: number;
  offset?: number;
}) {
  const res = await apiClient.get<MlModelVersionListResponse>(
    `/api/v1/admin/ml/model-versions${buildQuery({
      status: params?.status,
      language_code: params?.language_code,
      limit: params?.limit,
      offset: params?.offset,
    })}`
  );
  return res.data;
}

export async function promoteMlModelVersion(modelVersionId: string) {
  const res = await apiClient.post<MlModelVersionActionResponse>(
    `/api/v1/admin/ml/model-versions/${modelVersionId}/promote`
  );
  return res.data;
}

export async function rollbackMlModelVersion(modelVersionId: string) {
  const res = await apiClient.post<MlModelVersionActionResponse>(
    `/api/v1/admin/ml/model-versions/${modelVersionId}/rollback`
  );
  return res.data;
}

export async function listVerifiedPromotionManifests() {
  const res = await apiClient.get<{ items: VerifiedPromotionManifest[] }>(
    "/api/v1/admin/ml/verified-promotion/manifests"
  );
  return res.data;
}

export async function generateVerifiedPromotionManifest(language: "all" | "yor" | "eng" = "all") {
  const res = await apiClient.post<Record<string, unknown>>(
    "/api/v1/admin/ml/verified-promotion/manifests",
    { language }
  );
  return res.data;
}

export async function getVerifiedPromotionManifest(manifestId: string) {
  const res = await apiClient.get<VerifiedPromotionManifest>(
    `/api/v1/admin/ml/verified-promotion/manifests/${manifestId}`
  );
  return res.data;
}

export async function listVerifiedPromotionCandidates(
  manifestId: string,
  params?: {
    language?: string;
    label?: string;
    review_status?: string;
    conflict_only?: boolean;
    problem_only?: boolean;
    priority_only?: boolean;
    limit?: number;
    offset?: number;
  }
) {
  const res = await apiClient.get<VerifiedPromotionCandidateListResponse>(
    `/api/v1/admin/ml/verified-promotion/manifests/${manifestId}/candidates${buildQuery({
      language: params?.language,
      label: params?.label,
      review_status: params?.review_status,
      conflict_only: params?.conflict_only,
      problem_only: params?.problem_only,
      priority_only: params?.priority_only,
      limit: params?.limit,
      offset: params?.offset,
    })}`
  );
  return res.data;
}

export async function updateVerifiedPromotionCandidates(
  manifestId: string,
  candidateIds: string[],
  reviewStatus: "pending" | "approved" | "rejected",
  reviewNotes?: string
) {
  const res = await apiClient.patch<{ updated: number; status_counts: Record<string, number> }>(
    `/api/v1/admin/ml/verified-promotion/manifests/${manifestId}/candidates`,
    { candidate_ids: candidateIds, review_status: reviewStatus, review_notes: reviewNotes || null }
  );
  return res.data;
}

export async function getVerifiedPromotionCandidatePreview(manifestId: string, candidateId: string) {
  const res = await apiClient.get<{ preview_url: string; source_key: string; expires_seconds: number }>(
    `/api/v1/admin/ml/verified-promotion/manifests/${manifestId}/candidates/${candidateId}/preview`
  );
  return res.data;
}

export async function validateVerifiedPromotionManifest(manifestId: string) {
  const res = await apiClient.post<Record<string, unknown>>(
    `/api/v1/admin/ml/verified-promotion/manifests/${manifestId}/validate`
  );
  return res.data;
}

export async function dryRunVerifiedPromotionManifest(manifestId: string) {
  const res = await apiClient.post<Record<string, unknown>>(
    `/api/v1/admin/ml/verified-promotion/manifests/${manifestId}/dry-run`
  );
  return res.data;
}

export async function applyVerifiedPromotionManifest(manifestId: string, confirmation: string) {
  const res = await apiClient.post<Record<string, unknown>>(
    `/api/v1/admin/ml/verified-promotion/manifests/${manifestId}/apply`,
    { confirmation }
  );
  return res.data;
}

export async function getVerifiedPromotionReadiness(threshold = 180) {
  const res = await apiClient.get<VerifiedPromotionReadinessResponse>(
    `/api/v1/admin/ml/verified-promotion/readiness${buildQuery({ threshold })}`
  );
  return res.data;
}

export async function getVerifiedPromotionCollectionGaps(params?: {
  manifest_id?: string;
  target_low?: number;
  target_high?: number;
}) {
  const res = await apiClient.get<VerifiedPromotionCollectionGapResponse>(
    `/api/v1/admin/ml/verified-promotion/collection-gaps${buildQuery({
      manifest_id: params?.manifest_id,
      target_low: params?.target_low ?? 180,
      target_high: params?.target_high ?? 300,
    })}`
  );
  return res.data;
}

// ---------------------------------------------------------------------------
// DB-backed handwriting candidate review / promotion (newer replacement for
// the JSONL-based verified-promotion pipeline above - both run in parallel
// for now, see docs/ml/HANDWRITING_DATASET_REVIEW_VISION_PLAN.md)
// ---------------------------------------------------------------------------

export type HandwritingCandidateManifest = {
  id: string;
  language_code: string;
  dataset_kind: string;
  source: string;
  source_prefix?: string | null;
  status: string;
  created_by?: string | null;
  summary?: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
  status_counts?: Record<string, number>;
  per_class_counts?: Array<{
    case_group: string | null;
    label: string | null;
    review_status: string;
    count: number;
  }>;
};

export type HandwritingCandidateManifestListResponse = {
  items: HandwritingCandidateManifest[];
  total: number;
  limit: number;
  offset: number;
};

export type HandwritingCandidate = {
  id: string;
  manifest_id: string;
  language_code: string;
  source_type: string;
  source_key: string;
  candidate_key?: string | null;
  image_hash?: string | null;
  raw_label?: string | null;
  suggested_label?: string | null;
  suggested_case_group?: string | null;
  final_label?: string | null;
  final_case_group?: string | null;
  review_status: "pending" | "approved" | "rejected";
  review_notes?: string | null;
  quality_flags?: Record<string, unknown>;
  vision_status: "not_requested" | "queued" | "completed" | "failed" | "skipped";
  vision_suggestion?: Record<string, unknown> | null;
  vision_provider?: string | null;
  vision_model?: string | null;
  vision_confidence?: number | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type HandwritingCandidateListResponse = {
  items: HandwritingCandidate[];
  total: number;
  limit: number;
  offset: number;
};

export type HandwritingPromotionResult = {
  manifest_id: string;
  mode: "dry_run" | "apply";
  status: "succeeded" | "blocked" | "failed";
  valid: boolean;
  apply_allowed: boolean;
  target_prefix: string;
  approved_count: number;
  files_to_copy: Array<Record<string, unknown>>;
  copied_count: number;
  skipped_count: number;
  failed_count: number;
  validation_errors: Array<Record<string, unknown>>;
  per_class_impact: Array<{
    language_code: string;
    case_group: string;
    label: string;
    class_id: string;
    before: number;
    would_add: number;
    added: number;
    after: number;
  }>;
  created_at?: string | null;
  promotion_run_id: string;
};

export type HandwritingPromotionRun = {
  id: string;
  manifest_id: string;
  mode: "dry_run" | "apply";
  status: string;
  target_prefix?: string | null;
  files_to_copy?: number | null;
  copied_count?: number | null;
  skipped_count?: number | null;
  failed_count?: number | null;
  validation_errors: Array<Record<string, unknown>>;
  per_class_impact: Array<Record<string, unknown>>;
  result: Record<string, unknown>;
  created_by?: string | null;
  created_at?: string | null;
};

export async function listHandwritingCandidateManifests(params?: {
  language_code?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const res = await apiClient.get<HandwritingCandidateManifestListResponse>(
    `/api/v1/admin/ml/handwriting/candidate-manifests${buildQuery({
      language_code: params?.language_code,
      status: params?.status,
      limit: params?.limit,
      offset: params?.offset,
    })}`
  );
  return res.data;
}

export async function getHandwritingCandidateManifest(manifestId: string) {
  const res = await apiClient.get<HandwritingCandidateManifest>(
    `/api/v1/admin/ml/handwriting/candidate-manifests/${manifestId}`
  );
  return res.data;
}

export async function createHandwritingCandidateManifest(payload: {
  language_code?: "yor" | "eng";
  source?: "drawings" | "dashboard_upload" | "r2_import" | "feedback" | "mixed";
  source_prefix?: string;
  dry_run?: boolean;
  limit?: number;
}) {
  const res = await apiClient.post<Record<string, unknown>>(
    "/api/v1/admin/ml/handwriting/candidate-manifests",
    {
      language_code: payload.language_code ?? "yor",
      dataset_kind: "alphabet_handwriting",
      source: payload.source ?? "drawings",
      source_prefix: payload.source_prefix,
      dry_run: payload.dry_run ?? true,
      limit: payload.limit ?? 1000,
    }
  );
  return res.data;
}

export async function listHandwritingCandidates(params: {
  manifest_id?: string;
  language_code?: string;
  case_group?: string;
  label?: string;
  suggested_label?: string;
  final_label?: string;
  review_status?: string;
  vision_status?: string;
  source_type?: string;
  conflict_only?: boolean;
  duplicate_only?: boolean;
  limit?: number;
  offset?: number;
}) {
  const res = await apiClient.get<HandwritingCandidateListResponse>(
    `/api/v1/admin/ml/handwriting/candidates${buildQuery({
      manifest_id: params.manifest_id,
      language_code: params.language_code,
      case_group: params.case_group,
      label: params.label,
      suggested_label: params.suggested_label,
      final_label: params.final_label,
      review_status: params.review_status,
      vision_status: params.vision_status,
      source_type: params.source_type,
      conflict_only: params.conflict_only,
      duplicate_only: params.duplicate_only,
      limit: params.limit,
      offset: params.offset,
    })}`
  );
  return res.data;
}

export async function updateHandwritingCandidate(
  candidateId: string,
  payload: {
    review_status: "pending" | "approved" | "rejected";
    final_label?: string;
    final_case_group?: "LOWER_CASE" | "UPPER_CASE";
    review_notes?: string;
  }
) {
  const res = await apiClient.patch<HandwritingCandidate>(
    `/api/v1/admin/ml/handwriting/candidates/${candidateId}`,
    payload
  );
  return res.data;
}

export async function bulkUpdateHandwritingCandidates(payload: {
  candidate_ids: string[];
  review_status: "pending" | "approved" | "rejected";
  review_notes?: string;
}) {
  const res = await apiClient.patch<{ updated: number; items: HandwritingCandidate[] }>(
    "/api/v1/admin/ml/handwriting/candidates/bulk",
    payload
  );
  return res.data;
}

export async function getHandwritingCandidatePreviewUrl(candidateId: string, expiresSeconds = 900) {
  const res = await apiClient.get<{ candidate_id: string; source_key: string; preview_url: string; expires_seconds: number }>(
    `/api/v1/admin/ml/handwriting/candidates/${candidateId}/preview${buildQuery({ expires_seconds: expiresSeconds })}`
  );
  return res.data;
}

export async function dryRunHandwritingPromotion(manifestId: string, targetPrefix?: string) {
  const res = await apiClient.post<HandwritingPromotionResult>(
    `/api/v1/admin/ml/handwriting/candidate-manifests/${manifestId}/promotions/dry-run`,
    { target_prefix: targetPrefix }
  );
  return res.data;
}

export async function applyHandwritingPromotion(manifestId: string, confirmation: string, targetPrefix?: string) {
  const res = await apiClient.post<HandwritingPromotionResult>(
    `/api/v1/admin/ml/handwriting/candidate-manifests/${manifestId}/promotions/apply`,
    { confirmation, target_prefix: targetPrefix }
  );
  return res.data;
}

export async function getHandwritingPromotionRun(promotionId: string) {
  const res = await apiClient.get<HandwritingPromotionRun>(
    `/api/v1/admin/ml/handwriting/promotions/${promotionId}`
  );
  return res.data;
}

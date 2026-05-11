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

export type HandwritingDatasetReadinessClass = {
  class_label: string;
  language: string;
  script_group: string;
  candidate_count: number;
  verified_count: number;
  approved_pending_count: number;
  rejected_count: number;
  target_min_count: number;
  target_high_count: number;
  readiness_status: "missing" | "low" | "ready";
  is_blocking_training: boolean;
  recommended_action: string;
  needed_to_300: number;
  needed_to_500: number;
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
  classes: HandwritingDatasetReadinessClass[];
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

export async function getMlReadiness(threshold = 300) {
  const res = await apiClient.get<MlReadinessResponse>(
    `/api/v1/admin/ml/handwriting/readiness${buildQuery({ threshold })}`
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

export async function generateVerifiedPromotionManifest(
  language: "all" | "yor" | "eng" = "all",
  options?: { dry_run?: boolean; confirmation?: string }
) {
  const res = await apiClient.post<Record<string, unknown>>(
    "/api/v1/admin/ml/verified-promotion/manifests",
    { language, dry_run: options?.dry_run ?? true, confirmation: options?.confirmation ?? null }
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

export async function getVerifiedPromotionReadiness(threshold = 300) {
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
      target_low: params?.target_low ?? 300,
      target_high: params?.target_high ?? 500,
    })}`
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
      target_min_count: params?.target_min_count ?? 300,
      target_high_count: params?.target_high_count ?? 500,
    })}`
  );
  return res.data;
}

export async function uploadHandwritingCandidateSamples(payload: {
  language: "yor" | "eng";
  class_label: string;
  source?: string;
  contributor_id?: string;
  files: File[];
}) {
  const form = new FormData();
  form.set("language", payload.language);
  form.set("class_label", payload.class_label);
  form.set("source", payload.source ?? "dashboard_upload");
  if (payload.contributor_id) form.set("contributor_id", payload.contributor_id);
  payload.files.forEach((file) => form.append("files", file));
  const res = await apiClient.post<Record<string, unknown>>(
    "/api/v1/admin/ml/handwriting/candidates/upload",
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return res.data;
}

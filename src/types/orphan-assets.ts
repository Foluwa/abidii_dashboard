export type OrphanAssetCandidateStatus =
  | 'candidate'
  | 'reviewed'
  | 'protected'
  | 'scheduled_for_delete'
  | 'deleted'
  | 'skipped'
  | 'delete_failed';

export type OrphanAssetScanMode = 'dry_run' | 'active';
export type OrphanAssetAction = 'review' | 'protect' | 'skip' | 'schedule_delete' | 'delete_now';

export interface OrphanAssetScanItem {
  scan_id: string;
  started_at: string;
  completed_at?: string | null;
  objects_scanned: number;
  candidates_found: number;
  error_count: number;
  errors: string[];
  scan_mode: OrphanAssetScanMode;
  grace_period_days: number;
  managed_prefixes: string[];
  triggered_by_type: 'system' | 'admin';
  triggered_by?: string | null;
}

export interface OrphanAssetScanListResponse {
  items: OrphanAssetScanItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface OrphanAssetCandidateItem {
  candidate_id: string;
  latest_scan_id?: string | null;
  storage_key: string;
  preview_url?: string | null;
  asset_type: string;
  bucket: string;
  prefix: string;
  object_size: number;
  last_modified: string;
  flagged_reason: string;
  reference_check_result: Record<string, unknown>;
  status: OrphanAssetCandidateStatus;
  scheduled_delete_after?: string | null;
  latest_error?: string | null;
  first_flagged_at: string;
  last_flagged_at: string;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrphanAssetCandidateListResponse {
  items: OrphanAssetCandidateItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  filters_applied: Record<string, unknown>;
}

export interface OrphanAssetSummaryResponse {
  total_candidates: number;
  open_candidates: number;
  total_candidate_bytes: number;
  counts_by_status: Record<string, number>;
  counts_by_asset_type: Record<string, number>;
  last_completed_scan?: OrphanAssetScanItem | null;
  settings: {
    managed_prefixes: string[];
    grace_period_days: number;
    scan_frequency_days: number;
    scan_mode: OrphanAssetScanMode;
    scan_enabled: boolean;
    scheduled_delete_enabled: boolean;
    scheduled_delete_batch_size: number;
  };
}

export interface OrphanAssetActionOutcome {
  candidate_id: string;
  storage_key: string;
  status: OrphanAssetCandidateStatus;
  success: boolean;
  error_message?: string | null;
}

export interface OrphanAssetBulkActionResponse {
  action: OrphanAssetAction;
  requested_count: number;
  success_count: number;
  failure_count: number;
  outcomes: OrphanAssetActionOutcome[];
}
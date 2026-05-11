export interface DictionaryImportIssuePayload {
  code: string;
  message: string;
  severity: string;
  phase: string;
  file_name?: string | null;
  row_number?: number | null;
  column_name?: string | null;
  raw_value?: string | null;
  details: Record<string, unknown>;
}

export interface DictionaryImportSummaryPayload {
  rows_checked: number;
  errors: number;
  warnings: number;
  pair_code?: string | null;
  source_language_code?: string | null;
  target_language_code?: string | null;
}

export interface DictionaryImportCountersPayload {
  staged_rows: number;
  would_insert: number;
  would_update: number;
  would_skip: number;
  unchanged: number;
  would_create_concepts: number;
  would_attach_existing_concepts: number;
  would_conflict: number;
  applied_inserted: number;
  applied_updated: number;
  applied_skipped: number;
  applied_concepts_created: number;
  applied_concepts_reused: number;
}

export interface DictionaryImportRowPreviewPayload {
  source_file: string;
  row_number: number;
  source_row_key: string;
  lemma: string;
  pos: string;
  meaning_hint?: string | null;
  gloss_text: string;
  example_source?: string | null;
  example_translation?: string | null;
  review_status: string;
  normalized_lemma: string;
  normalized_pos: string;
  normalized_meaning_hint?: string | null;
  normalized_gloss_text: string;
  row_fingerprint: string;
  row_action?: string | null;
  validation_status?: string | null;
  reconciliation_status?: string | null;
  concept_key?: string | null;
  resolved_concept_id?: string | null;
  mapped: boolean;
  applyable: boolean;
}

export interface DictionaryImportValidateResponse {
  batch_id?: string | null;
  valid: boolean;
  status: string;
  summary: DictionaryImportSummaryPayload;
  counters: DictionaryImportCountersPayload;
  issues: DictionaryImportIssuePayload[];
  rows: DictionaryImportRowPreviewPayload[];
  started_at?: string | null;
  finished_at?: string | null;
}

export interface DictionaryImportGoogleSheetValidateRequest {
  pair_code: string;
  worksheet_title: string;
  sheet_url?: string;
  spreadsheet_id?: string;
  header_row?: number;
}

export interface DictionaryImportApplyResponse {
  batch_id?: string | null;
  valid: boolean;
  status: string;
  summary: DictionaryImportSummaryPayload;
  counters: DictionaryImportCountersPayload;
  started_at?: string | null;
  finished_at?: string | null;
}

export interface DictionaryImportBatchListItem {
  id: string;
  status: string;
  dry_run: boolean;
  source_name?: string | null;
  pair_code?: string | null;
  file_hash: string;
  validated_count: number;
  inserted_count: number;
  updated_count: number;
  skipped_count: number;
  error_count: number;
  warning_count: number;
  started_at: string;
  finished_at?: string | null;
}

export interface DictionaryImportBatchDetail extends DictionaryImportBatchListItem {
  summary_json: Record<string, unknown>;
  staging_row_count: number;
  reconciled_row_count: number;
  concept_count: number;
  issues: DictionaryImportIssuePayload[];
}

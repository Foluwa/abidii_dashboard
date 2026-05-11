import { apiClient } from '@/lib/api';
import type {
  DictionaryImportApplyResponse,
  DictionaryImportBatchDetail,
  DictionaryImportBatchListItem,
  DictionaryImportGoogleSheetValidateRequest,
  DictionaryImportValidateResponse,
} from '@/types/dictionaryImport';

export async function validateDictionaryImport(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await apiClient.post<DictionaryImportValidateResponse>(
    '/api/v1/admin/dictionary-import/validate',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 120000, // 2 minutes for large files
    }
  );
  return res.data;
}

export async function applyDictionaryImport(batchId: string) {
  const res = await apiClient.post<DictionaryImportApplyResponse>(
    '/api/v1/admin/dictionary-import/apply',
    { batch_id: batchId },
    { timeout: 300000 } // 5 minutes for apply operation
  );
  return res.data;
}

export async function validateDictionaryImportFromGoogleSheet(
  payload: DictionaryImportGoogleSheetValidateRequest
) {
  const res = await apiClient.post<DictionaryImportValidateResponse>(
    '/api/v1/admin/dictionary-import/validate/google-sheet',
    payload,
    // Validation includes reconciliation preview and can take longer on large sheets.
    { timeout: 300000 } // 5 minutes
  );
  return res.data;
}

export async function startDictionaryImportValidateFromGoogleSheet(
  payload: DictionaryImportGoogleSheetValidateRequest
) {
  const res = await apiClient.post<{ batch_id: string; job_id: string }>(
    '/api/v1/admin/dictionary-import/validate/google-sheet/start',
    payload,
    { timeout: 60000 }
  );
  return res.data;
}

export async function listDictionaryImportBatches(params?: { limit?: number; offset?: number }) {
  const usp = new URLSearchParams();
  if (params?.limit) usp.set('limit', String(params.limit));
  if (params?.offset) usp.set('offset', String(params.offset));
  const suffix = usp.toString() ? `?${usp.toString()}` : '';
  const res = await apiClient.get<DictionaryImportBatchListItem[]>(
    `/api/v1/admin/dictionary-import/batches${suffix}`
  );
  return res.data;
}

export async function getDictionaryImportBatch(batchId: string) {
  const res = await apiClient.get<DictionaryImportBatchDetail>(
    `/api/v1/admin/dictionary-import/batches/${batchId}`
  );
  return res.data;
}

export async function getDictionaryImportValidationReport(batchId: string) {
  const res = await apiClient.get<DictionaryImportValidateResponse>(
    `/api/v1/admin/dictionary-import/batches/${batchId}/validation-report`
  );
  return res.data;
}

export async function discardDictionaryImportBatch(batchId: string, opts?: { force?: boolean }) {
  const suffix = opts?.force ? '?force=true' : '';
  await apiClient.delete(`/api/v1/admin/dictionary-import/batches/${batchId}${suffix}`);
}

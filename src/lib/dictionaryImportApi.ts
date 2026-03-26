import { apiClient } from '@/lib/api';
import type {
  DictionaryImportApplyResponse,
  DictionaryImportBatchDetail,
  DictionaryImportBatchListItem,
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
    }
  );
  return res.data;
}

export async function applyDictionaryImport(batchId: string) {
  const res = await apiClient.post<DictionaryImportApplyResponse>(
    '/api/v1/admin/dictionary-import/apply',
    { batch_id: batchId }
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

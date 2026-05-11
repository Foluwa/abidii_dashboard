'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/admin/StatusBadge';
import { ConfirmationModal } from '@/components/ui/modal/ConfirmationModal';
import { useToast } from '@/contexts/ToastContext';
import {
  applyDictionaryImport,
  discardDictionaryImportBatch,
  getDictionaryImportBatch,
  getDictionaryImportValidationReport,
  listDictionaryImportBatches,
  startDictionaryImportValidateFromGoogleSheet,
  validateDictionaryImportFromGoogleSheet,
} from '@/lib/dictionaryImportApi';
import type {
  DictionaryImportBatchListItem,
  DictionaryImportValidateResponse,
} from '@/types/dictionaryImport';

const expectedColumns = [
  { name: 'source_row_key', required: true, description: 'Stable ASCII row key (never changes). Use letters/numbers plus . _ : -', example: 'eng_yor_000001' },
  { name: 'lemma', required: true, description: 'Source headword', example: 'hello' },
  { name: 'gloss_text', required: true, description: 'Target translation/gloss', example: 'báwo' },
  { name: 'example_source', required: false, description: 'Example sentence in source language', example: 'Hello, friend.' },
  { name: 'example_translation', required: false, description: 'Example sentence translation', example: 'Báwo, ọ̀rẹ́.' },
  { name: 'meaning_hint', required: false, description: 'Sense disambiguation when a word has multiple meanings', example: 'greeting' },
  { name: 'pos', required: true, description: 'Part of speech', example: 'interjection' },
  { name: 'review_status', required: true, description: 'Editorial status', example: 'approved' },
];

function renderStatus(status: string) {
  if (status === 'applied') return <StatusBadge status="success" label="Applied" />;
  if (status === 'validated') return <StatusBadge status="info" label="Validated" />;
  if (status === 'validation_failed' || status === 'apply_failed') {
    return <StatusBadge status="error" label={status === 'validation_failed' ? 'Validation Failed' : 'Apply Failed'} />;
  }
  if (status === 'applying' || status === 'validating') {
    return <StatusBadge status="warning" label={status === 'applying' ? 'Applying' : 'Validating'} />;
  }
  return <StatusBadge status="warning" label={status} />;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function DictionaryGoogleSheetsBulkImport({ onImportComplete }: { onImportComplete: () => void }) {
  const toast = useToast();
  const [sheetReference, setSheetReference] = useState('');
  const [worksheetTitle, setWorksheetTitle] = useState('eng_yor');
  const [pairCode, setPairCode] = useState('eng_yor');
  const [headerRow, setHeaderRow] = useState(1);
  const [showColumnInfo, setShowColumnInfo] = useState(false);
  const [validation, setValidation] = useState<DictionaryImportValidateResponse | null>(null);
  const [validating, setValidating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [history, setHistory] = useState<DictionaryImportBatchListItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [confirmApplyBatchId, setConfirmApplyBatchId] = useState<string | null>(null);
  const [confirmDiscardBatchId, setConfirmDiscardBatchId] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);

  const refreshHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      setHistory(await listDictionaryImportBatches({ limit: 10, offset: 0 }));
    } catch (error: any) {
      toast.error(error?.response?.data?.detail ?? error?.message ?? 'Failed to load import history');
    } finally {
      setLoadingHistory(false);
    }
  }, [toast]);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  const handleValidate = async () => {
    const trimmedReference = sheetReference.trim();
    const trimmedWorksheet = worksheetTitle.trim();
    const trimmedPairCode = pairCode.trim().toLowerCase();

    if (!trimmedReference) {
      toast.error('Enter a Google Sheet URL or spreadsheet ID first.');
      return;
    }
    if (!trimmedWorksheet) {
      toast.error('Enter the worksheet title to import.');
      return;
    }
    if (!trimmedPairCode) {
      toast.error('Enter a pair code like eng_yor.');
      return;
    }

    setValidating(true);
    setValidation(null);
    try {
      const { batch_id } = await startDictionaryImportValidateFromGoogleSheet({
        pair_code: trimmedPairCode,
        worksheet_title: trimmedWorksheet,
        header_row: headerRow,
        ...(trimmedReference.startsWith('http')
          ? { sheet_url: trimmedReference }
          : { spreadsheet_id: trimmedReference }),
      });
      setActiveBatchId(batch_id);
      toast.success('Validation queued. Watch Batch History for progress.');
      await refreshHistory();
      // Poll in the background so the UI stays responsive.
      void (async () => {
        const startedAt = Date.now();
        const timeoutMs = 10 * 60 * 1000;
        while (Date.now() - startedAt < timeoutMs) {
          const batch = await getDictionaryImportBatch(batch_id);
          if (batch.status === 'validated' || batch.status === 'validation_failed') {
            const report = await getDictionaryImportValidationReport(batch_id);
            setValidation(report);
            if (report.valid) {
              toast.success(`Validation passed. ${report.counters.staged_rows} rows ready.`);
            } else {
              toast.error(`Validation failed. ${report.summary.errors} errors found.`);
            }
            await refreshHistory();
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        toast.error('Validation is still running. Check Batch History and refresh.');
      })();
      return;
    } catch (error: any) {
      // Fall back to the synchronous endpoint if the worker isn't running yet.
      try {
        const result = await validateDictionaryImportFromGoogleSheet({
          pair_code: trimmedPairCode,
          worksheet_title: trimmedWorksheet,
          header_row: headerRow,
          ...(trimmedReference.startsWith('http')
            ? { sheet_url: trimmedReference }
            : { spreadsheet_id: trimmedReference }),
        });
        setValidation(result);
        if (result.valid) {
          toast.success(`Validation passed. ${result.counters.staged_rows} rows ready.`);
        } else {
          toast.error(`Validation failed. ${result.summary.errors} errors found.`);
        }
        await refreshHistory();
      } catch (fallbackError: any) {
        toast.error(fallbackError?.response?.data?.detail ?? fallbackError?.message ?? error?.message ?? 'Google Sheets validation failed');
      }
    } finally {
      setValidating(false);
    }
  };

  const handleApply = async () => {
    if (!validation?.batch_id || !validation.valid) {
      toast.error('Validate a clean batch first.');
      return;
    }
    setApplying(true);
    try {
      const result = await applyDictionaryImport(validation.batch_id);
      toast.success(`Import complete. ${result.counters.applied_inserted} inserted, ${result.counters.applied_updated} updated.`);
      setValidation(null);
      await refreshHistory();
      onImportComplete();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail ?? error?.message ?? 'Apply failed');
    } finally {
      setApplying(false);
    }
  };

  const handleApplyExistingBatch = async (batchId: string) => {
    setApplying(true);
    try {
      const result = await applyDictionaryImport(batchId);
      toast.success(
        `Import complete. ${result.counters.applied_inserted} inserted, ${result.counters.applied_updated} updated.`
      );
      await refreshHistory();
      onImportComplete();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail ?? error?.message ?? 'Apply failed');
    } finally {
      setApplying(false);
    }
  };

  const handleDiscardBatch = async (batchId: string) => {
    setDiscarding(true);
    try {
      const batch = history.find((item) => item.id === batchId);
      const force = (batch?.status || '').toLowerCase() === 'applied';
      await discardDictionaryImportBatch(batchId, { force });
      toast.success('Batch discarded.');
      await refreshHistory();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail ?? error?.message ?? 'Discard failed');
    } finally {
      setDiscarding(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Bulk Import from Google Sheets</h2>
        <button
          type="button"
          onClick={() => setShowColumnInfo(!showColumnInfo)}
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          {showColumnInfo ? 'Hide' : 'Show'} expected columns
        </button>
      </div>

      {showColumnInfo && (
        <div className="mb-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-700">
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Expected columns in your Google Sheet:</p>
          <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
            {expectedColumns.map((col) => (
              <li key={col.name}>
                <span className="rounded bg-gray-200 px-1 font-mono text-xs dark:bg-gray-600">{col.name}</span>
                {col.required && <span className="ml-1 text-red-600 dark:text-red-400">*required</span>}
                : {col.description}
                {col.example && <span className="ml-1 text-gray-500">(e.g., {col.example})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Google Sheet URL or Spreadsheet ID</label>
          <input
            type="text"
            value={sheetReference}
            onChange={(event) => setSheetReference(event.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/... or just the ID"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Worksheet Title</label>
          <input
            type="text"
            value={worksheetTitle}
            onChange={(event) => setWorksheetTitle(event.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Pair Code</label>
          <input
            type="text"
            value={pairCode}
            onChange={(event) => setPairCode(event.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Header Row</label>
          <input
            type="number"
            min={1}
            value={headerRow}
            onChange={(event) => setHeaderRow(Number(event.target.value) || 1)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={handleValidate}
          disabled={validating || applying}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {validating ? 'Validating...' : 'Validate'}
        </button>
        {validation?.valid && (
          <button
            type="button"
            onClick={handleApply}
            disabled={applying || validating}
            className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {applying ? 'Importing...' : `Import ${validation.counters.staged_rows} rows`}
          </button>
        )}
      </div>

      {validation && (
        <div className="mt-4 rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {renderStatus(validation.status)}
            <span className="text-gray-700 dark:text-gray-300">
              {validation.counters.would_insert} insert, {validation.counters.would_update} update, {validation.summary.errors} errors, {validation.summary.warnings} warnings
            </span>
            {validation.batch_id && (
              <span className="font-mono text-xs text-gray-500">{validation.batch_id}</span>
            )}
          </div>
          {validation.issues.length > 0 && (
            <ul className="mt-3 max-h-44 space-y-1 overflow-y-auto text-sm text-red-700 dark:text-red-300">
              {validation.issues.slice(0, 20).map((issue, index) => (
                <li key={`${issue.code}-${index}`}>
                  Row {issue.row_number ?? '-'}{issue.column_name ? ` (${issue.column_name})` : ''}: {issue.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Batch History</h3>
          <button
            type="button"
            onClick={() => void refreshHistory()}
            disabled={loadingHistory}
            className="text-sm text-blue-600 hover:underline disabled:opacity-60 dark:text-blue-400"
          >
            {loadingHistory ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/40">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Status</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Batch</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Pair</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Started</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300" title="Rows that would be inserted/updated if you click Apply">Validated</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300" title="Inserted rows on apply">Inserted</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300" title="Updated rows on apply">Updated</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300" title="Skipped rows (pending/rejected/unchanged)">Skipped</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300" title="Validation/apply errors">Errors</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300" title="Validation/apply warnings">Warnings</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-3 py-4 text-gray-600 dark:text-gray-300">No dictionary import batches found.</td>
                </tr>
              ) : (
                history.map((batch) => (
                  <tr key={batch.id}>
                    <td className="px-3 py-2">{renderStatus(batch.status)}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link href={`/content/dictionary-import/${batch.id}`} className="hover:underline">
                        {batch.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{batch.pair_code ?? '-'}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{formatDate(batch.started_at)}</td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{batch.validated_count ?? 0}</td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{batch.inserted_count}</td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{batch.updated_count}</td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{batch.skipped_count}</td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{batch.error_count}</td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{batch.warning_count}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        {batch.status === 'validated' && (
                          <button
                            type="button"
                            onClick={() => setConfirmApplyBatchId(batch.id)}
                            disabled={applying || validating}
                            className="rounded-md bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Apply this validated batch (imports approved rows)"
                          >
                            Apply
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setConfirmDiscardBatchId(batch.id)}
                          disabled={applying || validating || discarding}
                          className="rounded-md bg-gray-200 px-3 py-1.5 text-xs text-gray-800 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                          title="Discard this batch (deletes staging/issue rows to save space)"
                        >
                          Discard
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmationModal
        isOpen={!!confirmApplyBatchId}
        onClose={() => setConfirmApplyBatchId(null)}
        onConfirm={async () => {
          const batchId = confirmApplyBatchId;
          if (!batchId) return;
          try {
            await handleApplyExistingBatch(batchId);
          } finally {
            setConfirmApplyBatchId(null);
          }
        }}
        title="Apply Import Batch"
        message="Apply this validated batch now? This will import/update only rows marked as approved."
        confirmText="Apply"
        cancelText="Cancel"
        variant="warning"
        isLoading={applying}
      />

      <ConfirmationModal
        isOpen={!!confirmDiscardBatchId}
        onClose={() => setConfirmDiscardBatchId(null)}
        onConfirm={async () => {
          const batchId = confirmDiscardBatchId;
          if (!batchId) return;
          try {
            await handleDiscardBatch(batchId);
          } finally {
            setConfirmDiscardBatchId(null);
          }
        }}
        title="Discard Import Batch"
        message={
          (() => {
            const batch = history.find((item) => item.id === confirmDiscardBatchId);
            const isApplied = (batch?.status || '').toLowerCase() === 'applied';
            if (isApplied) {
              return 'Discard this applied batch from the database to save space? This is permanent and is admin-only.';
            }
            return 'Discard this batch from the database to save space? This deletes staging rows and issues for this batch.';
          })()
        }
        confirmText="Discard"
        cancelText="Cancel"
        variant="danger"
        isLoading={discarding}
      />
    </div>
  );
}

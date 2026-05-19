'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import StatusBadge from '@/components/admin/StatusBadge';
import { ConfirmationModal } from '@/components/ui/modal/ConfirmationModal';
import { useToast } from '@/contexts/ToastContext';
import {
  applyDictionaryImport,
  getDictionaryImportBatch,
  listDictionaryImportBatches,
  validateDictionaryImportFromGoogleSheet,
} from '@/lib/dictionaryImportApi';
import type {
  DictionaryImportBatchListItem,
  DictionaryImportValidateResponse,
  DictionaryImportRowPreviewPayload,
} from '@/types/dictionaryImport';

const PAIR_CODE_REGEX = /^[a-z]{3}_[a-z]{3}$/;

const expectedColumns = [
  { name: 'source_row_key', required: false, description: 'Stable row key. Auto-generated if blank.', example: 'word_yor_0001' },
  { name: 'lemma', required: true, description: 'Source headword', example: 'hello' },
  { name: 'gloss_text', required: true, description: 'Target translation/gloss', example: 'báwo' },
  { name: 'example_source', required: false, description: 'Example sentence in source language', example: 'Hello, friend.' },
  { name: 'example_translation', required: false, description: 'Example sentence translation', example: 'Báwo, ọ̀rẹ́.' },
  { name: 'meaning_hint', required: false, description: 'Sense disambiguation when a word has multiple meanings', example: 'greeting' },
  { name: 'pos', required: false, description: 'Part of speech', example: 'interjection' },
  { name: 'review_status', required: true, description: 'Editorial status', example: 'approved' },
  { name: 'difficulty_level', required: false, description: 'Learning difficulty (1-5)', example: '2' },
  { name: 'ipa_pronunciation', required: false, description: 'IPA phonetic transcription', example: '/bəˈwoː/' },
  { name: 'word_category', required: false, description: 'Semantic category or topic', example: 'greetings' },
  { name: 'audio_key', required: false, description: 'S3 audio file key (auto-generated if omitted)', example: 'audio/words/hello.mp3' },
];

function isValidSpreadsheetUrl(value: string): boolean {
  return value.trim().toLowerCase().startsWith('https://docs.google.com/spreadsheets');
}

function parseSheetInput(value: string): { sheet_url?: string; spreadsheet_id?: string } {
  const trimmed = value.trim();
  if (isValidSpreadsheetUrl(trimmed)) {
    return { sheet_url: trimmed };
  }
  // Treat anything else as a raw spreadsheet ID
  return { spreadsheet_id: trimmed };
}

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

function RowActionBadge({ action }: { action?: string | null }) {
  const text = action || 'unknown';
  const style =
    text === 'insert'
      ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
      : text === 'update'
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
        : text === 'skip'
          ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200';
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>{text}</span>;
}

function RowPreviewTable({ rows }: { rows: DictionaryImportRowPreviewPayload[] }) {
  const [expanded, setExpanded] = useState(false);
  const display = expanded ? rows : rows.slice(0, 10);
  const hasMore = rows.length > 10;

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Row Preview</h4>
        <span className="text-xs text-gray-500 dark:text-gray-400">{rows.length} row(s)</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Action</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Row</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Key</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Lemma</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">POS</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Gloss</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {display.map((row, idx) => (
              <tr key={`${row.source_row_key}-${idx}`} className={row.row_action === 'skip' ? 'opacity-60' : undefined}>
                <td className="px-3 py-2"><RowActionBadge action={row.row_action} /></td>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{row.row_number}</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">{row.source_row_key}</td>
                <td className="px-3 py-2 text-gray-900 dark:text-white">{row.lemma}</td>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{row.pos}</td>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{row.gloss_text}</td>
                <td className="px-3 py-2">
                  {row.applyable ? (
                    <span className="text-xs text-green-700 dark:text-green-300">Ready</span>
                  ) : (
                    <span className="text-xs text-red-700 dark:text-red-300">Blocked</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-2 text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          {expanded ? 'Show first 10 rows' : `Show all ${rows.length} rows`}
        </button>
      )}
    </div>
  );
}

export function DictionaryGoogleSheetsBulkImport({ onImportComplete }: { onImportComplete: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('dictionary-import-expanded') !== 'false';
    }
    return true;
  });

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('dictionary-import-expanded', String(next));
      }
      return next;
    });
  }, []);

  const [sheetReference, setSheetReference] = useState('');
  const [worksheetTitle, setWorksheetTitle] = useState('eng_yor');
  const [pairCode, setPairCode] = useState('eng_yor');
  const [headerRow, setHeaderRow] = useState(1);
  const [showColumnInfo, setShowColumnInfo] = useState(false);
  const [validation, setValidation] = useState<DictionaryImportValidateResponse | null>(null);
  const [validating, setValidating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [history, setHistory] = useState<DictionaryImportBatchListItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [confirmApplyBatchId, setConfirmApplyBatchId] = useState<string | null>(null);
  const [showAllIssues, setShowAllIssues] = useState(false);
  const [showRowPreview, setShowRowPreview] = useState(true);

  // Restore active batch from URL on mount
  useEffect(() => {
    const batchFromUrl = searchParams.get('batch');
    if (batchFromUrl) {
      setActiveBatchId(batchFromUrl);
      // Auto-poll if batch is still running
      void (async () => {
              try {
                const batch = await getDictionaryImportBatch(batchFromUrl);
                if (batch.status === 'validated' || batch.status === 'validation_failed') {
                  setValidation(null as any);
                } else if (batch.status === 'validating' || batch.status === 'applying') {
                  startPolling(batchFromUrl);
                }
              } catch {
          // Batch may have been discarded; clear it from URL
          const next = new URLSearchParams(searchParams.toString());
          next.delete('batch');
          router.replace(`${window.location.pathname}?${next.toString()}`, { scroll: false });
        }
      })();
    }
  }, []);

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

  const startPolling = useCallback((batchId: string) => {
    void (async () => {
      const startedAt = Date.now();
      const timeoutMs = 10 * 60 * 1000;
      while (Date.now() - startedAt < timeoutMs) {
                const batch = await getDictionaryImportBatch(batchId);
                if (batch.status === 'validated' || batch.status === 'validation_failed') {
                  const report = batch as any;
                  setValidation(report);
          setActiveBatchId(null);
          // Remove batch from URL
          const next = new URLSearchParams(searchParams.toString());
          next.delete('batch');
          router.replace(`${window.location.pathname}?${next.toString()}`, { scroll: false });
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
  }, [router, searchParams, toast, refreshHistory]);

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
    if (!PAIR_CODE_REGEX.test(trimmedPairCode)) {
      toast.error('Pair code must match format: three lowercase letters, underscore, three lowercase letters (e.g., eng_yor).');
      return;
    }

    setValidating(true);
    setValidation(null);
    setShowAllIssues(false);
    try {
      const result = await validateDictionaryImportFromGoogleSheet({
        pair_code: trimmedPairCode,
        worksheet_title: trimmedWorksheet,
        header_row: headerRow,
        ...parseSheetInput(trimmedReference),
      });
      setActiveBatchId(result.batch_id ?? null);
      // Persist batch ID in URL
      const next = new URLSearchParams(searchParams.toString());
      next.set('batch', result.batch_id ?? '');
      router.replace(`${window.location.pathname}?${next.toString()}`, { scroll: false });
      toast.success('Validation queued. Watch Batch History for progress.');
      await refreshHistory();
      if (result.batch_id) startPolling(result.batch_id);
      return;
    } catch (error: any) {
      // Fall back to the synchronous endpoint if the worker isn't running yet.
      try {
        const result = await validateDictionaryImportFromGoogleSheet({
          pair_code: trimmedPairCode,
          worksheet_title: trimmedWorksheet,
          header_row: headerRow,
          ...parseSheetInput(trimmedReference),
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

  const totalChanges = (validation?.counters.would_insert ?? 0) + (validation?.counters.would_update ?? 0);
  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* Accordion Header */}
      <button
        type="button"
        onClick={toggleExpanded}
        className="flex w-full items-center justify-between p-6 text-left hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors"
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Bulk Import from Google Sheets</h2>
        <svg
          className={`h-5 w-5 text-gray-500 transition-transform dark:text-gray-400 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Body */}
      <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-6 pb-6">
      <div className="mb-4 flex items-center justify-between">
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
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Pair Code <span className="text-xs text-gray-500">(e.g. eng_yor)</span>
          </label>
          <input
            type="text"
            value={pairCode}
            onChange={(event) => setPairCode(event.target.value)}
            className={`w-full rounded-lg border bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white ${
              pairCode && !PAIR_CODE_REGEX.test(pairCode.trim().toLowerCase())
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-blue-500'
            }`}
          />
          {pairCode && !PAIR_CODE_REGEX.test(pairCode.trim().toLowerCase()) && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              Must be 3 lowercase letters, underscore, 3 lowercase letters (e.g. eng_yor)
            </p>
          )}
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

          {/* Row Preview */}
          {validation.rows && validation.rows.length > 0 && (
            <>
              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowRowPreview((prev) => !prev)}
                  className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  {showRowPreview ? 'Hide row preview' : 'Show row preview'}
                </button>
              </div>
              {showRowPreview && <RowPreviewTable rows={validation.rows} />}
            </>
          )}

          {/* Issues */}
          {validation.issues.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium text-red-700 dark:text-red-300">
                  Issues ({validation.issues.length})
                </span>
                {validation.issues.length > 20 && (
                  <button
                    type="button"
                    onClick={() => setShowAllIssues((prev) => !prev)}
                    className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {showAllIssues ? 'Show first 20' : `Show all ${validation.issues.length}`}
                  </button>
                )}
              </div>
              <ul className="max-h-60 space-y-1 overflow-y-auto text-sm text-red-700 dark:text-red-300">
                {(showAllIssues ? validation.issues : validation.issues.slice(0, 20)).map((issue, index) => (
                  <li key={`${issue.code}-${index}`}>
                    Row {issue.row_number ?? '-'}{issue.column_name ? ` (${issue.column_name})` : ''}: {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {totalChanges > 100 && validation?.valid && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <strong>Large import:</strong> This will {validation.counters.would_insert} insert and {validation.counters.would_update} update rows. Please review the preview above before applying.
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
                <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">I / U / S / E / W</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-gray-600 dark:text-gray-300">No dictionary import batches found.</td>
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
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                      {batch.inserted_count} / {batch.updated_count} / {batch.skipped_count} / {batch.error_count} / {batch.warning_count}
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
        </div>
      </div>
    </div>
  );
}

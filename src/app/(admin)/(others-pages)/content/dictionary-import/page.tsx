'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import StatusBadge from '@/components/admin/StatusBadge';
import { useToast } from '@/contexts/ToastContext';
import {
  applyDictionaryImport,
  listDictionaryImportBatches,
  validateDictionaryImport,
} from '@/lib/dictionaryImportApi';
import type {
  DictionaryImportApplyResponse,
  DictionaryImportBatchListItem,
  DictionaryImportIssuePayload,
  DictionaryImportValidateResponse,
} from '@/types/dictionaryImport';

function formatDate(value?: string | null) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
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

function IssueTable({ issues }: { issues: DictionaryImportIssuePayload[] }) {
  if (!issues.length) {
    return <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300">No issues.</div>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              {['Severity', 'Phase', 'Row', 'Column', 'Code', 'Message'].map((label) => (
                <th key={label} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {issues.map((issue, index) => (
              <tr key={`${issue.code}-${issue.row_number ?? 'na'}-${index}`}>
                <td className="px-4 py-3 text-sm">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    issue.severity === 'ERROR'
                      ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                  }`}>
                    {issue.severity}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{issue.phase}</td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{issue.row_number ?? '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{issue.column_name ?? '-'}</td>
                <td className="px-4 py-3 text-sm font-mono text-gray-700 dark:text-gray-300">{issue.code}</td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{issue.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DictionaryImportPage() {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<DictionaryImportValidateResponse | null>(null);
  const [applyResult, setApplyResult] = useState<DictionaryImportApplyResponse | null>(null);
  const [history, setHistory] = useState<DictionaryImportBatchListItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [validating, setValidating] = useState(false);
  const [applying, setApplying] = useState(false);

  const refreshHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const items = await listDictionaryImportBatches({ limit: 20, offset: 0 });
      setHistory(items);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail ?? error?.message ?? 'Failed to load import history');
    } finally {
      setLoadingHistory(false);
    }
  }, [toast]);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  const currentBatchId = validation?.batch_id ?? applyResult?.batch_id ?? null;
  const canApply = Boolean(validation?.valid && validation?.batch_id && !applying);

  const counters = useMemo(() => validation?.counters ?? null, [validation]);

  const handleValidate = async () => {
    if (!file) {
      toast.error('Choose a CSV file first.');
      return;
    }
    setValidating(true);
    setApplyResult(null);
    try {
      const result = await validateDictionaryImport(file);
      setValidation(result);
      if (result.valid) {
        toast.success(`Validated ${file.name}`);
      } else {
        toast.error(`Validation failed for ${file.name}`);
      }
      await refreshHistory();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail ?? error?.message ?? 'Validation failed');
    } finally {
      setValidating(false);
    }
  };

  const handleApply = async () => {
    if (!validation?.batch_id) return;
    setApplying(true);
    try {
      const result = await applyDictionaryImport(validation.batch_id);
      setApplyResult(result);
      toast.success(`Applied batch ${validation.batch_id}`);
      await refreshHistory();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail ?? error?.message ?? 'Apply failed');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageBreadCrumb pageTitle="Dictionary Import" />

      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-100">
        <div className="font-semibold">Google Sheets Workflow</div>
        <div className="mt-1">
          Export one bilingual tab as a CSV named like <span className="font-mono">eng_yor.csv</span> or <span className="font-mono">eng_ibo.csv</span>.
          Required columns: <span className="font-mono">source_row_key</span>, <span className="font-mono">lemma</span>, <span className="font-mono">pos</span>, <span className="font-mono">meaning_hint</span>, <span className="font-mono">gloss_text</span>, <span className="font-mono">example_source</span>, <span className="font-mono">example_translation</span>, <span className="font-mono">review_status</span>.
          Languages are inferred from the filename.
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Import CSV</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                Validate first. Apply only after the batch is clean enough to promote.
              </p>
            </div>
            {currentBatchId ? (
              <Link
                href={`/content/dictionary-import/${currentBatchId}`}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5"
              >
                View Batch
              </Link>
            ) : null}
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                Pair CSV
              </label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  const next = event.target.files?.[0] ?? null;
                  setFile(next);
                  setValidation(null);
                  setApplyResult(null);
                }}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Expected filename format: <span className="font-mono">eng_yor.csv</span>, <span className="font-mono">eng_ibo.csv</span>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleValidate}
                disabled={!file || validating}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {validating ? 'Validating...' : 'Validate'}
              </button>
              <button
                onClick={handleApply}
                disabled={!canApply}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {applying ? 'Applying...' : 'Apply'}
              </button>
              {file ? (
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  File: <span className="font-mono">{file.name}</span>
                </span>
              ) : null}
            </div>
          </div>

          {validation ? (
            <div className="mt-6 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                {renderStatus(validation.status)}
                {validation.batch_id ? (
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-mono text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                    {validation.batch_id}
                  </span>
                ) : null}
              </div>

              {counters ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    ['Would insert', counters.would_insert],
                    ['Would update', counters.would_update],
                    ['Would skip', counters.would_skip],
                    ['Staged rows', counters.staged_rows],
                    ['New concepts', counters.would_create_concepts],
                    ['Existing concepts', counters.would_attach_existing_concepts],
                    ['Warnings', validation.summary.warnings],
                    ['Errors', validation.summary.errors],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                      <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
                      <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{value as number}</div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-200">
                  Validation Issues
                </h3>
                <IssueTable issues={validation.issues} />
              </div>
            </div>
          ) : null}

          {applyResult ? (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
              <div className="flex items-center gap-3">
                {renderStatus(applyResult.status)}
                <span className="text-sm text-emerald-800 dark:text-emerald-200">
                  Inserted {applyResult.counters.applied_inserted}, updated {applyResult.counters.applied_updated}, skipped {applyResult.counters.applied_skipped}.
                </span>
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Batch History</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                Recent validate/apply runs for bilingual pair files.
              </p>
            </div>
            <button
              onClick={() => void refreshHistory()}
              disabled={loadingHistory}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200"
            >
              {loadingHistory ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {history.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
                No dictionary import batches yet.
              </div>
            ) : (
              history.map((batch) => (
                <Link
                  key={batch.id}
                  href={`/content/dictionary-import/${batch.id}`}
                  className="block rounded-xl border border-gray-200 p-4 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {renderStatus(batch.status)}
                        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{batch.id}</span>
                      </div>
                      <div className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                        {batch.source_name ?? 'Unnamed import'}
                      </div>
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Pair: {batch.pair_code ?? '-'} · Started: {formatDate(batch.started_at)}
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-600 dark:text-gray-300">
                      <div>I {batch.inserted_count}</div>
                      <div>U {batch.updated_count}</div>
                      <div>S {batch.skipped_count}</div>
                      <div>E {batch.error_count}</div>
                      <div>W {batch.warning_count}</div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

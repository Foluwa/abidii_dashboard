'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import StatusBadge from '@/components/admin/StatusBadge';
import { useToast } from '@/contexts/ToastContext';
import {
  getDictionaryImportBatch,
  getDictionaryImportValidationReport,
  applyDictionaryImport,
} from '@/lib/dictionaryImportApi';
import type { DictionaryImportBatchDetail, DictionaryImportValidateResponse } from '@/types/dictionaryImport';


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

export default function DictionaryImportBatchDetailPage() {
  const params = useParams<{ id: string }>();
  const toast = useToast();
  const [detail, setDetail] = useState<DictionaryImportBatchDetail | null>(null);
  const [validation, setValidation] = useState<DictionaryImportValidateResponse | null>(null);
  const [applying, setApplying] = useState(false);
  const [loading, setLoading] = useState(true);

  const handleImport = async () => {
    if (!params.id) return;
    setApplying(true);
    try {
      await applyDictionaryImport(params.id);
      toast.success('Import applied successfully.');
      const d = await getDictionaryImportBatch(params.id);
      setDetail(d);
      setValidation(null);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail ?? error?.message ?? 'Import failed');
    } finally {
      setApplying(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      try {
        const result = await getDictionaryImportBatch(params.id);
        setDetail(result);
        const report = await getDictionaryImportValidationReport(params.id);
        setValidation(report);
      } catch (error: any) {
        toast.error(error?.response?.data?.detail ?? error?.message ?? 'Failed to load batch');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [params.id, toast]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <PageBreadCrumb pageTitle="Dictionary Import Batch" />
        <Link
          href="/content/words"
          className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
        >
          Back to Importer
        </Link>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Loading batch...
        </div>
      ) : detail ? (
        <>
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-3">
                {renderStatus(detail.status)}
                <span className="font-mono text-xs text-muted-foreground">{detail.id}</span>
                {detail.status === 'validated' && (
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={applying}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {applying ? 'Importing...' : `Import ${validation?.counters?.staged_rows ?? 0} rows`}
                  </button>
                )}
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  ['Source file', detail.source_name ?? '-'],
                  ['Pair code', detail.pair_code ?? '-'],
                  ['Started', formatDate(detail.started_at)],
                  ['Finished', formatDate(detail.finished_at)],
                  ['Inserted', detail.inserted_count],
                  ['Updated', detail.updated_count],
                  ['Skipped', detail.skipped_count],
                  ['Errors', detail.error_count],
                  ['Warnings', detail.warning_count],
                  ['Staging rows', detail.staging_row_count],
                  ['Reconciled rows', detail.reconciled_row_count],
                  ['Concept count', detail.concept_count],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl border border-border p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
                    <div className="mt-2 text-sm font-medium text-foreground">{String(value)}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground">Summary</h2>
              <pre className="mt-4 overflow-x-auto rounded-xl bg-gray-950 p-4 text-xs text-gray-100">
                {JSON.stringify(detail.summary_json ?? {}, null, 2)}
              </pre>
            </section>
          </div>

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">Issues</h2>
            {detail.issues.length === 0 ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100">
                This batch does not have any recorded validation or apply issues.
              </div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-lg border border-border">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border">
                    <thead className="border-b">
                      <tr>
                        {['Severity', 'Phase', 'Row', 'Column', 'Code', 'Message'].map((label) => (
                          <th key={label} className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {detail.issues.map((issue, index) => (
                        <tr key={`${issue.code}-${issue.row_number ?? 'na'}-${index}`}>
                          <td className="px-4 py-3 text-sm">{issue.severity}</td>
                          <td className="px-4 py-3 text-sm text-foreground">{issue.phase}</td>
                          <td className="px-4 py-3 text-sm text-foreground">{issue.row_number ?? '-'}</td>
                          <td className="px-4 py-3 text-sm text-foreground">{issue.column_name ?? '-'}</td>
                          <td className="px-4 py-3 font-mono text-sm text-foreground">{issue.code}</td>
                          <td className="px-4 py-3 text-sm text-foreground">{issue.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </>
      ) : (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-100">
          The requested dictionary import batch could not be loaded.
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import StatusBadge from '@/components/admin/StatusBadge';
import { useToast } from '@/contexts/ToastContext';
import { getDictionaryImportBatch } from '@/lib/dictionaryImportApi';
import type { DictionaryImportBatchDetail } from '@/types/dictionaryImport';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const result = await getDictionaryImportBatch(params.id);
        setDetail(result);
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
          href="/content/dictionary-import"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5"
        >
          Back to Importer
        </Link>
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300">
          Loading batch...
        </div>
      ) : detail ? (
        <>
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="flex items-center gap-3">
                {renderStatus(detail.status)}
                <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{detail.id}</span>
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
                  <div key={String(label)} className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                    <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
                    <div className="mt-2 text-sm font-medium text-gray-900 dark:text-white">{String(value)}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Summary</h2>
              <pre className="mt-4 overflow-x-auto rounded-xl bg-gray-950 p-4 text-xs text-gray-100">
                {JSON.stringify(detail.summary_json ?? {}, null, 2)}
              </pre>
            </section>
          </div>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Issues</h2>
            {detail.issues.length === 0 ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100">
                This batch does not have any recorded validation or apply issues.
              </div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
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
                      {detail.issues.map((issue, index) => (
                        <tr key={`${issue.code}-${issue.row_number ?? 'na'}-${index}`}>
                          <td className="px-4 py-3 text-sm">{issue.severity}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{issue.phase}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{issue.row_number ?? '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{issue.column_name ?? '-'}</td>
                          <td className="px-4 py-3 font-mono text-sm text-gray-700 dark:text-gray-300">{issue.code}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{issue.message}</td>
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

'use client';

import React, { useState } from 'react';

import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import Pagination from '@/components/tables/Pagination';
import StatusBadge from '@/components/admin/StatusBadge';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import { Modal } from '@/components/ui/modal';
import { useAdminDictionaryReportsList } from '@/hooks/useApi';
import type { DictionaryReportItem } from '@/types/dictionary-reports';

const STATUS_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
];

function statusBadgeFor(status: string) {
  if (status === 'pending') return <StatusBadge status="pending" />;
  return <StatusBadge status="info" label={status} />;
}

export default function ContentReportsPage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [status, setStatus] = useState<string>('');

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsItem, setDetailsItem] = useState<DictionaryReportItem | null>(null);

  const { data, isLoading, isError } = useAdminDictionaryReportsList({
    page,
    limit,
    status: status || undefined,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.pages ?? Math.max(1, Math.ceil(total / limit));
  const pageStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const pageEnd = total === 0 ? 0 : Math.min(page * limit, total);

  const openDetails = (item: DictionaryReportItem) => {
    setDetailsItem(item);
    setDetailsOpen(true);
  };

  return (
    <>
      <PageBreadCrumb pageTitle="Content Reports" />

      <div className="space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">Status</label>
              <div className="mt-1">
                <StyledSelect
                  options={STATUS_OPTIONS}
                  value={status}
                  onValueChange={(value) => {
                    setPage(1);
                    setStatus(value);
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-white/[0.05]" role="table">
              <thead className="bg-gray-50 dark:bg-white/[0.02]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Reported at</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Word</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Reason</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Reporter</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/[0.05]">
                {isLoading && (
                  <tr>
                    <td className="px-4 py-6 text-sm text-gray-600 dark:text-gray-400" colSpan={6}>
                      Loading…
                    </td>
                  </tr>
                )}
                {isError && (
                  <tr>
                    <td className="px-4 py-6 text-sm text-gray-600 dark:text-gray-400" colSpan={6}>
                      Failed to load content reports.
                    </td>
                  </tr>
                )}
                {!isLoading && !isError && items.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-sm text-gray-600 dark:text-gray-400" colSpan={6}>
                      No content reports found.
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  !isError &&
                  items.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {new Date(row.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{row.word || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.reason}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {row.reporter_display_name || row.reporter_email || '—'}
                        </div>
                        {row.reporter_email && row.reporter_display_name && (
                          <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{row.reporter_email}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">{statusBadgeFor(row.status)}</td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          type="button"
                          onClick={() => openDetails(row)}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-white/[0.03]"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-white/[0.05] dark:bg-white/[0.03]">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {pageStart} to {pageEnd} of {total} content reports
          </p>
          <div className="ml-auto">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={(p) => setPage(p)} />
          </div>
        </div>
      </div>

      <Modal isOpen={detailsOpen} onClose={() => setDetailsOpen(false)} title="Report Details" maxWidth="2xl">
        <div className="space-y-3">
          <div className="text-sm text-gray-900 dark:text-white">
            <div className="font-medium">{detailsItem?.word || '—'}</div>
            <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">{detailsItem?.id}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
            <div>
              <span className="font-medium">Reason:</span> {detailsItem?.reason}
            </div>
            <div className="mt-2">
              <span className="font-medium">Description:</span> {detailsItem?.description || '—'}
            </div>
            <div className="mt-2">
              <span className="font-medium">Reporter:</span>{' '}
              {detailsItem?.reporter_display_name || detailsItem?.reporter_email || detailsItem?.reporter_user_id}
            </div>
            <div className="mt-2">
              <span className="font-medium">Status:</span> {detailsItem?.status}
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

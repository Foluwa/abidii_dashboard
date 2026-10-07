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

export function ReportsContent({ showHeader = true, isActive = true }: { showHeader?: boolean; isActive?: boolean }) {
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
      {showHeader && <PageBreadCrumb pageTitle="Content Reports" />}

      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground">Status</label>
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

        <div className="rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border" role="table">
              <thead className="border-b">
                <tr>
                  <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Reported at</th>
                  <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Word</th>
                  <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Reason</th>
                  <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Reporter</th>
                  <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading && (
                  <tr>
                    <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={6}>
                      Loading…
                    </td>
                  </tr>
                )}
                {isError && (
                  <tr>
                    <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={6}>
                      Failed to load content reports.
                    </td>
                  </tr>
                )}
                {!isLoading && !isError && items.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={6}>
                      No content reports found.
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  !isError &&
                  items.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {new Date(row.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{row.word || '—'}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{row.reason}</td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        <div className="font-medium text-foreground">
                          {row.reporter_display_name || row.reporter_email || '—'}
                        </div>
                        {row.reporter_email && row.reporter_display_name && (
                          <div className="mt-0.5 text-xs text-muted-foreground">{row.reporter_email}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">{statusBadgeFor(row.status)}</td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          type="button"
                          onClick={() => openDetails(row)}
                          className="rounded-lg border border-input bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50"
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

        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Showing {pageStart} to {pageEnd} of {total} content reports
          </p>
          <div className="ml-auto">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={(p) => setPage(p)} />
          </div>
        </div>
      </div>

      <Modal isOpen={detailsOpen} onClose={() => setDetailsOpen(false)} title="Report Details" maxWidth="2xl">
        <div className="space-y-3">
          <div className="text-sm text-foreground">
            <div className="font-medium">{detailsItem?.word || '—'}</div>
            <div className="mt-1 text-xs text-muted-foreground">{detailsItem?.id}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 text-sm text-foreground">
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

'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';

import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import Pagination from '@/components/tables/Pagination';
import StatusBadge from '@/components/admin/StatusBadge';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import { useToast } from '@/contexts/ToastContext';
import { listDictionaryImportBatches } from '@/lib/dictionaryImportApi';
import type { DictionaryImportBatchListItem } from '@/types/dictionaryImport';

function formatDate(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function renderStatus(status: string) {
  if (status === 'applied') return <StatusBadge status="success" label="Applied" />;
  if (status === 'validated') return <StatusBadge status="info" label="Validated" />;
  if (status === 'validation_failed') return <StatusBadge status="error" label="Validation Failed" />;
  if (status === 'apply_failed') return <StatusBadge status="error" label="Apply Failed" />;
  if (status === 'applying') return <StatusBadge status="warning" label="Applying" />;
  if (status === 'validating') return <StatusBadge status="warning" label="Validating" />;
  return <StatusBadge status="pending" label={status} />;
}

const PAGE_SIZE = 25;
const API_LIMIT = 200;

export default function DictionaryImportListPage() {
  const toast = useToast();
  const [items, setItems] = useState<DictionaryImportBatchListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [search, setSearch] = useState('');
  const [apiTotal, setApiTotal] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch up to API_LIMIT batches at offset 0 for client-side filtering
      const all = await listDictionaryImportBatches({ limit: API_LIMIT, offset: 0 });
      setItems(all);
      setApiTotal(all.length);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail ?? error?.message ?? 'Failed to load batches');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredItems = useMemo(() => {
    let result = [...items];
    if (status) {
      result = result.filter((item) => item.status === status);
    }
    if (source) {
      result = result.filter((item) =>
        (item.source_name ?? '').toLowerCase().includes(source.toLowerCase())
      );
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.id.toLowerCase().includes(q) ||
          (item.source_name ?? '').toLowerCase().includes(q) ||
          (item.pair_code ?? '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [items, status, source, search]);

  const total = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageItems = useMemo(
    () => filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredItems, page]
  );
  const pageStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = total === 0 ? 0 : Math.min(page * PAGE_SIZE, total);

  const totalInserted = items.reduce((sum, item) => sum + (item.inserted_count || 0), 0);
  const totalUpdated = items.reduce((sum, item) => sum + (item.updated_count || 0), 0);
  const totalSkipped = items.reduce((sum, item) => sum + (item.skipped_count || 0), 0);
  const totalErrors = items.reduce((sum, item) => sum + (item.error_count || 0), 0);

  const showFetchMore = apiTotal >= API_LIMIT && !status && !source && !search;

  return (
    <div className="space-y-6">
      <PageBreadCrumb pageTitle="Dictionary Imports" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Total Batches</div>
          <div className="mt-2 text-2xl font-semibold text-foreground">{items.length}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Inserted</div>
          <div className="mt-2 text-2xl font-semibold text-foreground">{totalInserted}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Updated</div>
          <div className="mt-2 text-2xl font-semibold text-foreground">{totalUpdated}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Errors</div>
          <div className="mt-2 text-2xl font-semibold text-foreground">{totalErrors}</div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Search</label>
            <input
              aria-label="Search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Batch ID, source, or pair code"
              className="block h-12 w-full rounded-lg border border-input bg-background px-4 text-sm text-foreground"
            />
          </div>
          <div>
            <StyledSelect
              aria-label="Status"
              label="Status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All statuses' },
                { value: 'validated', label: 'Validated' },
                { value: 'validation_failed', label: 'Validation Failed' },
                { value: 'applying', label: 'Applying' },
                { value: 'applied', label: 'Applied' },
                { value: 'apply_failed', label: 'Apply Failed' },
              ]}
              fullWidth
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Source</label>
            <input
              aria-label="Source"
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setPage(1);
              }}
              placeholder="Filter by source name"
              className="block h-12 w-full rounded-lg border border-input bg-background px-4 text-sm text-foreground"
            />
          </div>
        </div>

        {showFetchMore && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            <span className="font-medium">Note:</span> Showing the latest {API_LIMIT} batches. Use filters to narrow results.
          </div>
        )}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">ID</th>
                <th className="px-3 py-2.5">Source</th>
                <th className="px-3 py-2.5">Pair</th>
                <th className="px-3 py-2.5">Dry Run</th>
                <th className="px-3 py-2.5 text-right">Inserted</th>
                <th className="px-3 py-2.5 text-right">Updated</th>
                <th className="px-3 py-2.5 text-right">Skipped</th>
                <th className="px-3 py-2.5 text-right">Errors</th>
                <th className="px-3 py-2.5">Started</th>
                <th className="px-3 py-2.5">Finished</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-3 py-10 text-center text-muted-foreground">
                    Loading batches…
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-10 text-center text-muted-foreground">
                    No dictionary import batches found.
                  </td>
                </tr>
              ) : (
                pageItems.map((item) => (
                  <tr key={item.id} className="border-b border-border align-top">
                    <td className="px-3 py-3">{renderStatus(item.status)}</td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/content/dictionary-import/${item.id}`}
                        className="font-medium text-brand-600 hover:underline dark:text-brand-400"
                      >
                        {item.id.slice(0, 8)}…
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-foreground">
                      <div className="max-w-[16rem] truncate">{item.source_name ?? '—'}</div>
                    </td>
                    <td className="px-3 py-3 text-foreground">{item.pair_code ?? '—'}</td>
                    <td className="px-3 py-3 text-foreground">{item.dry_run ? 'Yes' : 'No'}</td>
                    <td className="px-3 py-3 text-right text-foreground">{item.inserted_count}</td>
                    <td className="px-3 py-3 text-right text-foreground">{item.updated_count}</td>
                    <td className="px-3 py-3 text-right text-foreground">{item.skipped_count}</td>
                    <td className="px-3 py-3 text-right text-foreground">{item.error_count}</td>
                    <td className="px-3 py-3 text-foreground">{formatDate(item.started_at)}</td>
                    <td className="px-3 py-3 text-foreground">{formatDate(item.finished_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {pageStart} to {pageEnd} of {total} batches
          </p>
          <div className="ml-auto">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </div>
      </div>
    </div>
  );
}

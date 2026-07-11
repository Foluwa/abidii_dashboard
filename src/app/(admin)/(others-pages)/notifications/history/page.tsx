'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';

import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import Pagination from '@/components/tables/Pagination';
import StatusBadge from '@/components/admin/StatusBadge';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import { useToast } from '@/contexts/ToastContext';
import { listNotificationHistory } from '@/lib/notificationsApi';
import type { NotificationLogItem } from '@/types/notifications';

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function NotificationHistoryPage() {
  const toast = useToast();
  const [history, setHistory] = useState<NotificationLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [search, setSearch] = useState('');
  const [targetType, setTargetType] = useState('');
  const [status, setStatus] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const items = await listNotificationHistory({ limit: 500, offset: 0 });
      setHistory(items);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail ?? error?.message ?? 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    let result = [...history];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.body.toLowerCase().includes(q) ||
          item.sent_by.toLowerCase().includes(q)
      );
    }
    if (targetType) {
      result = result.filter((item) => item.target_type === targetType);
    }
    if (status) {
      result = result.filter((item) => {
        const itemStatus = item.failed_count > 0 ? 'partial' : 'sent';
        return itemStatus === status;
      });
    }
    return result;
  }, [history, search, targetType, status]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const pageItems = useMemo(
    () => filtered.slice((page - 1) * limit, page * limit),
    [filtered, page, limit]
  );
  const pageStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const pageEnd = total === 0 ? 0 : Math.min(page * limit, total);

  const totalSent = history.reduce((sum, item) => sum + item.android_sent + item.ios_sent, 0);
  const totalFailed = history.reduce((sum, item) => sum + item.failed_count, 0);
  const totalAndroid = history.reduce((sum, item) => sum + item.android_sent, 0);
  const totaliOS = history.reduce((sum, item) => sum + item.ios_sent, 0);

  const targetTypes = useMemo(
    () => Array.from(new Set(history.map((item) => item.target_type))).sort(),
    [history]
  );

  return (
    <div className="space-y-6">
      <PageBreadCrumb pageTitle="Notification History" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Total Sent</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{totalSent.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Android</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{totalAndroid.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">iOS</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{totaliOS.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Failed</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{totalFailed.toLocaleString()}</div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Sent Notifications</h2>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-800 hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Search</label>
            <input
              aria-label="Search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Title, body, or sender"
              className="block h-12 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            />
          </div>
          <div>
            <StyledSelect
              aria-label="Target type"
              label="Target Type"
              value={targetType}
              onChange={(e) => {
                setTargetType(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All targets' },
                ...targetTypes.map((t) => ({ value: t, label: t })),
              ]}
              fullWidth
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
                { value: 'sent', label: 'Sent' },
                { value: 'partial', label: 'Partial' },
              ]}
              fullWidth
            />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Title</th>
                <th className="px-3 py-3">Body</th>
                <th className="px-3 py-3">Target</th>
                <th className="px-3 py-3 text-right">Android</th>
                <th className="px-3 py-3 text-right">iOS</th>
                <th className="px-3 py-3 text-right">Failed</th>
                <th className="px-3 py-3">Sent By</th>
                <th className="px-3 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
                    No notification history found.
                  </td>
                </tr>
              ) : (
                pageItems.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 align-top dark:border-gray-800">
                    <td className="px-3 py-3">
                      {item.failed_count > 0 ? (
                        <StatusBadge status="error" label="Partial" />
                      ) : (
                        <StatusBadge status="success" label="Sent" />
                      )}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 font-medium text-gray-900 dark:text-white">
                      {item.title}
                    </td>
                    <td className="max-w-[250px] truncate px-3 py-2 text-gray-700 dark:text-gray-300">
                      {item.body}
                    </td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{item.target_type}</td>
                    <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">{item.android_sent.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">{item.ios_sent.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">{item.failed_count.toLocaleString()}</td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{item.sent_by}</td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{formatDate(item.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {pageStart} to {pageEnd} of {total} notifications
          </p>
          <div className="ml-auto">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </div>
      </div>
    </div>
  );
}

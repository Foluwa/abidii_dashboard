'use client';

import React, { useEffect, useState, useCallback } from 'react';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import StatusBadge from '@/components/admin/StatusBadge';
import { useToast } from '@/contexts/ToastContext';
import { listNotificationHistory } from '@/lib/notificationsApi';
import type { NotificationLogItem } from '@/types/notifications';

function formatDate(value?: string | null) {
  if (!value) return '-';
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

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const items = await listNotificationHistory({ limit: 50 });
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

  return (
    <div>
      <PageBreadCrumb pageTitle="Notification History" />
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
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

        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/40">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Status</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Title</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Body</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Target</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">Android</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">iOS</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">Failed</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Sent By</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-gray-500">
                    No notification history found.
                  </td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2">
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
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{item.target_type}</td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{item.android_sent}</td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{item.ios_sent}</td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{item.failed_count}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{item.sent_by}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{formatDate(item.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

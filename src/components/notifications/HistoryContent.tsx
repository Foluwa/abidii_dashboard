'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';

import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import Pagination from '@/components/tables/Pagination';
import StatusBadge from '@/components/admin/StatusBadge';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/contexts/ToastContext';
import { listNotificationHistory } from '@/lib/notificationsApi';
import type { NotificationLogItem } from '@/types/notifications';

const FAILURE_REASON_LABELS: Record<string, string> = {
  unregistered: 'Dead token (uninstalled, permission revoked, or sender mismatch)',
  error: 'Send error (transient or unknown cause)',
  user_not_found: 'User not found',
  no_push_token: 'User has no push token on file',
};

function FailureReasonsModal({
  item,
  onClose,
}: {
  item: NotificationLogItem;
  onClose: () => void;
}) {
  const reasons = item.failure_reasons;
  const hasReasons = reasons && Object.keys(reasons).length > 0;

  return (
    <Modal isOpen onClose={onClose} title="Why did this fail?" maxWidth="md">
      <div className="space-y-4">
        <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{item.title}</p>
          <p className="mt-1">{item.failed_count} of {item.target_count} recipients failed.</p>
        </div>

        {!hasReasons ? (
          <p className="text-sm text-muted-foreground">
            No failure reason was captured for this notification — either it predates failure-reason
            tracking, or the failures came from a path that doesn&apos;t report a specific reason.
          </p>
        ) : (
          <div className="space-y-3">
            {Object.entries(reasons!).map(([platform, byReason]) => (
              <div key={platform}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {platform}
                </p>
                <ul className="space-y-1">
                  {Object.entries(byReason).map(([reason, count]) => (
                    <li
                      key={reason}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <span className="text-foreground">
                        {FAILURE_REASON_LABELS[reason] ?? reason}
                      </span>
                      <span className="font-semibold text-foreground">{count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function HistoryContent({ showHeader = true }: { showHeader?: boolean; isActive?: boolean }) {
  const toast = useToast();
  const [history, setHistory] = useState<NotificationLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [search, setSearch] = useState('');
  const [targetType, setTargetType] = useState('');
  const [status, setStatus] = useState('');
  const [failureDetailItem, setFailureDetailItem] = useState<NotificationLogItem | null>(null);

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
      {showHeader && <PageBreadCrumb pageTitle="Notification History" />}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Total Sent</div>
          <div className="mt-2 text-2xl font-semibold text-foreground">{totalSent.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Android</div>
          <div className="mt-2 text-2xl font-semibold text-foreground">{totalAndroid.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">iOS</div>
          <div className="mt-2 text-2xl font-semibold text-foreground">{totaliOS.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Failed</div>
          <div className="mt-2 text-2xl font-semibold text-foreground">{totalFailed.toLocaleString()}</div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Sent Notifications</h2>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="rounded-lg bg-muted px-4 py-2 text-sm text-foreground hover:bg-gray-300 disabled:opacity-50 dark:hover:bg-gray-600"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

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
              placeholder="Title, body, or sender"
              className="block h-12 w-full rounded-lg border border-input bg-background px-4 text-sm text-foreground"
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
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Title</th>
                <th className="px-3 py-2.5">Body</th>
                <th className="px-3 py-2.5">Target</th>
                <th className="px-3 py-2.5 text-right">Android</th>
                <th className="px-3 py-2.5 text-right">iOS</th>
                <th className="px-3 py-2.5 text-right">Failed</th>
                <th className="px-3 py-2.5">Sent By</th>
                <th className="px-3 py-2.5">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                    No notification history found.
                  </td>
                </tr>
              ) : (
                pageItems.map((item) => (
                  <tr key={item.id} className="border-b border-border align-top">
                    <td className="px-3 py-3">
                      {item.failed_count > 0 ? (
                        <StatusBadge status="error" label="Partial" />
                      ) : (
                        <StatusBadge status="success" label="Sent" />
                      )}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 font-medium text-foreground">
                      {item.title}
                    </td>
                    <td className="max-w-[250px] truncate px-3 py-2 text-foreground">
                      {item.body}
                    </td>
                    <td className="px-3 py-3 text-foreground">{item.target_type}</td>
                    <td className="px-3 py-3 text-right text-foreground">{item.android_sent.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right text-foreground">{item.ios_sent.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right text-foreground">
                      <div className="flex items-center justify-end gap-1.5">
                        {item.failed_count.toLocaleString()}
                        {item.failed_count > 0 && (
                          <button
                            type="button"
                            onClick={() => setFailureDetailItem(item)}
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-input text-[10px] font-semibold text-muted-foreground hover:border-gray-400 hover:text-foreground"
                            title="Why did this fail?"
                            aria-label="Why did this fail?"
                          >
                            ?
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-foreground">{item.sent_by}</td>
                    <td className="px-3 py-3 text-foreground">{formatDate(item.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {pageStart} to {pageEnd} of {total} notifications
          </p>
          <div className="ml-auto">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </div>
      </div>

      {failureDetailItem && (
        <FailureReasonsModal item={failureDetailItem} onClose={() => setFailureDetailItem(null)} />
      )}
    </div>
  );
}

'use client';

import React, { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';

import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import Pagination from '@/components/tables/Pagination';
import StatusBadge from '@/components/admin/StatusBadge';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import { Modal } from '@/components/ui/modal';
import { useAdminAuditLogList } from '@/hooks/useApi';
import type { AdminAuditLogItem } from '@/types/audit-log';

type TimePreset = 'all' | '24h' | '7d' | '30d' | 'custom';

function isoStartOfDayUtc(dateYYYYMMDD: string) {
  return `${dateYYYYMMDD}T00:00:00Z`;
}

function isoEndOfDayUtc(dateYYYYMMDD: string) {
  return `${dateYYYYMMDD}T23:59:59Z`;
}

function routeForEntity(item: AdminAuditLogItem) {
  const entityType = item.entity_type || item.target_type;
  const entityId = item.entity_id || item.target_id;
  if (!entityType || !entityId) return null;
  if (entityType === 'course') return `/curriculum/courses/${entityId}`;
  if (entityType === 'lesson_blueprint') return `/curriculum/lesson-blueprints/${entityId}`;
  return null;
}

function resultBadge(details: any) {
  const result = details?.result;
  if (result === 'success') return <StatusBadge status="success" label="success" />;
  if (result === 'blocked') return <StatusBadge status="warning" label="blocked" />;
  if (result === 'failed') return <StatusBadge status="error" label="failed" />;
  return <StatusBadge status="info" label={result || '—'} />;
}

export default function AdminAuditLogPage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  const [actionPrefix, setActionPrefix] = useState<string>('');
  const [action, setAction] = useState<string>('');
  const [targetType, setTargetType] = useState<string>('');
  const [result, setResult] = useState<string>('');
  const [targetId, setTargetId] = useState<string>('');
  const [adminUserId, setAdminUserId] = useState<string>('');

  const [q, setQ] = useState<string>('');
  const [timePreset, setTimePreset] = useState<TimePreset>('all');
  const [nowAnchorMs, setNowAnchorMs] = useState<number>(() => Date.now());
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');

  const { fromTs, toTs } = useMemo(() => {
    if (timePreset === 'all') return { fromTs: undefined as string | undefined, toTs: undefined as string | undefined };

    if (timePreset === 'custom') {
      return {
        fromTs: customFrom ? isoStartOfDayUtc(customFrom) : undefined,
        toTs: customTo ? isoEndOfDayUtc(customTo) : undefined,
      };
    }

    const msPerDay = 24 * 60 * 60 * 1000;
    const days = timePreset === '24h' ? 1 : timePreset === '7d' ? 7 : 30;
    return { fromTs: new Date(nowAnchorMs - days * msPerDay).toISOString(), toTs: undefined };
  }, [timePreset, nowAnchorMs, customFrom, customTo]);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsItem, setDetailsItem] = useState<AdminAuditLogItem | null>(null);

  // Ops Mode: compact table + copy helpers in modal
  const [opsMode, setOpsMode] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data, isLoading, isError } = useAdminAuditLogList({
    page,
    limit,
    action_prefix: actionPrefix || undefined,
    action: action || undefined,
    target_type: targetType || undefined,
    result: result || undefined,
    target_id: targetId || undefined,
    admin_user_id: adminUserId || undefined,
    q: q || undefined,
    from_ts: fromTs,
    to_ts: toTs,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.pages ?? Math.max(1, Math.ceil(total / limit));
  const pageStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const pageEnd = total === 0 ? 0 : Math.min(page * limit, total);

  const actionPrefixOptions = useMemo(
    () => [
      { label: 'All', value: '' },
      { label: 'course.', value: 'course.' },
      { label: 'lesson_blueprint.', value: 'lesson_blueprint.' },
    ],
    []
  );

  const targetTypeOptions = useMemo(
    () => [
      { label: 'All', value: '' },
      { label: 'course', value: 'course' },
      { label: 'unit', value: 'unit' },
      { label: 'section', value: 'section' },
      { label: 'lesson_blueprint', value: 'lesson_blueprint' },
    ],
    []
  );

  const resultOptions = useMemo(
    () => [
      { label: 'All', value: '' },
      { label: 'success', value: 'success' },
      { label: 'blocked', value: 'blocked' },
      { label: 'failed', value: 'failed' },
      { label: 'unknown', value: 'unknown' },
    ],
    []
  );

  const timePresetOptions = useMemo(
    () => [
      { label: 'All time', value: 'all' },
      { label: 'Last 24h', value: '24h' },
      { label: 'Last 7d', value: '7d' },
      { label: 'Last 30d', value: '30d' },
      { label: 'Custom', value: 'custom' },
    ],
    []
  );

  const openDetails = (item: AdminAuditLogItem) => {
    setDetailsItem(item);
    setDetailsOpen(true);
  };

  const copyToClipboard = useCallback((text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(null), 1500);
    });
  }, []);

  /** Apply an Ops-mode filter preset, resetting page to 1. */
  const applyOpsPreset = useCallback(
    (preset: 'publish' | 'validate' | 'unpublish' | 'all') => {
      setPage(1);
      if (preset === 'all') {
        setActionPrefix('');
        setAction('');
      } else {
        setActionPrefix('');
        setAction(preset);
      }
    },
    []
  );

  return (
    <>
      <PageBreadCrumb pageTitle="Audit Log" />

      <div className="space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-white/[0.05] dark:bg-white/[0.03]">
          {/* Ops Mode bar */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              aria-pressed={opsMode}
              onClick={() => setOpsMode((m) => !m)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                opsMode
                  ? 'bg-brand-600 text-white hover:bg-brand-700'
                  : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-white/[0.05]'
              }`}
            >
              {opsMode ? 'Ops Mode ON' : 'Ops Mode'}
            </button>

            {opsMode && (
              <>
                <span className="text-xs text-gray-500 dark:text-gray-400">Preset:</span>
                {(['all', 'publish', 'validate', 'unpublish'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => applyOpsPreset(p)}
                    className="rounded border border-gray-300 bg-gray-50 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/[0.05]"
                  >
                    {p === 'all' ? 'All ops' : p}
                  </button>
                ))}
              </>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">Action prefix</label>
              <div className="mt-1">
                <StyledSelect
                  options={actionPrefixOptions}
                  value={actionPrefix}
                  onValueChange={(value) => {
                    setPage(1);
                    setActionPrefix(value);
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">Action</label>
              <input
                value={action}
                onChange={(e) => {
                  setPage(1);
                  setAction(e.target.value);
                }}
                placeholder="e.g. course.publish"
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">Target type</label>
              <div className="mt-1">
                <StyledSelect
                  options={targetTypeOptions}
                  value={targetType}
                  onValueChange={(value) => {
                    setPage(1);
                    setTargetType(value);
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">Result</label>
              <div className="mt-1">
                <StyledSelect
                  options={resultOptions}
                  value={result}
                  onValueChange={(value) => {
                    setPage(1);
                    setResult(value);
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">Target ID</label>
              <input
                value={targetId}
                onChange={(e) => {
                  setPage(1);
                  setTargetId(e.target.value);
                }}
                placeholder="UUID"
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">Admin user ID</label>
              <input
                value={adminUserId}
                onChange={(e) => {
                  setPage(1);
                  setAdminUserId(e.target.value);
                }}
                placeholder="UUID"
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label
                htmlFor="auditLogSearch"
                className="block text-xs font-medium text-gray-600 dark:text-gray-300"
              >
                Search
              </label>
              <input
                id="auditLogSearch"
                value={q}
                onChange={(e) => {
                  setPage(1);
                  setQ(e.target.value);
                }}
                placeholder="Search action, actor, target, details…"
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label
                htmlFor="auditLogTimeWindow"
                className="block text-xs font-medium text-gray-600 dark:text-gray-300"
              >
                Time window
              </label>
              <div className="mt-1">
                <StyledSelect
                  id="auditLogTimeWindow"
                  options={timePresetOptions}
                  value={timePreset}
                  onValueChange={(value) => {
                    setPage(1);
                    setNowAnchorMs(Date.now());
                    setTimePreset(value as TimePreset);
                  }}
                />
              </div>
            </div>

            {timePreset === 'custom' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">From (UTC)</label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => {
                      setPage(1);
                      setCustomFrom(e.target.value);
                    }}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">To (UTC)</label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => {
                      setPage(1);
                      setCustomTo(e.target.value);
                    }}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-white/[0.05]" role="table">
              <thead className="bg-gray-50 dark:bg-white/[0.02]">
                {opsMode ? (
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Entity type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Entity key</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Result</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Link / Details</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Actor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Target</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Result</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Details</th>
                  </tr>
                )}
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
                      Failed to load audit log.
                    </td>
                  </tr>
                )}
                {!isLoading && !isError && items.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-sm text-gray-600 dark:text-gray-400" colSpan={6}>
                      No audit log entries found.
                    </td>
                  </tr>
                )}
                {items.map((row) => {
                  const targetRoute = routeForEntity(row);
                  if (opsMode) {
                    return (
                      <tr key={row.id}>
                        <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {new Date(row.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-xs font-mono text-gray-900 dark:text-white">
                          {row.action}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400">
                          {row.entity_type || row.target_type || '—'}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-900 dark:text-white">
                          {row.entity_key || '—'}
                        </td>
                        <td className="px-4 py-2 text-xs">{resultBadge(row.details)}</td>
                        <td className="px-4 py-2 text-xs flex gap-2 items-center">
                          {targetRoute && (
                            <Link
                              href={targetRoute}
                              className="rounded border border-gray-300 bg-gray-50 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                            >
                              ↗ Entity
                            </Link>
                          )}
                          <button
                            type="button"
                            onClick={() => openDetails(row)}
                            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={row.id}>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {new Date(row.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        <div className="font-medium text-gray-900 dark:text-white">{row.actor_email || '—'}</div>
                        <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{row.actor_display_name || row.admin_user_id}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {row.action}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        <div className="text-xs text-gray-500 dark:text-gray-400">{row.entity_type || row.target_type || '—'}</div>
                        {targetRoute ? (
                          <Link href={targetRoute} className="hover:underline">
                            {row.entity_id || row.target_id}
                          </Link>
                        ) : (
                          <div className="break-all">{row.entity_id || row.target_id || '—'}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">{resultBadge(row.details)}</td>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-white/[0.05] dark:bg-white/[0.03]">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {pageStart} to {pageEnd} of {total} audit log entries
          </p>
          <div className="ml-auto">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(p) => setPage(p)}
            />
          </div>
        </div>
      </div>

      <Modal
        isOpen={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        title="Audit Log Details"
        maxWidth="4xl"
      >
        <div className="space-y-3">
          <div className="text-sm text-gray-900 dark:text-white">
            <div className="font-medium">{detailsItem?.action}</div>
            <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">{detailsItem?.id}</div>
          </div>

          {/* Copy buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                detailsItem?.id && copyToClipboard(detailsItem.id, 'request_id')
              }
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-white/[0.05]"
            >
              {copiedField === 'request_id' ? '✓ Copied!' : 'Copy request_id'}
            </button>
            <button
              type="button"
              onClick={() =>
                detailsItem?.details != null &&
                copyToClipboard(JSON.stringify(detailsItem.details, null, 2), 'json')
              }
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-white/[0.05]"
            >
              {copiedField === 'json' ? '✓ Copied!' : 'Copy JSON'}
            </button>
          </div>

          {(detailsItem?.details as any)?.validation_status && (
            <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
              Validation status: <span className="font-medium">{String((detailsItem?.details as any)?.validation_status)}</span>
            </div>
          )}
          <pre className="max-h-[60vh] overflow-auto rounded-lg bg-gray-50 p-4 text-xs text-gray-900 dark:bg-gray-800 dark:text-gray-100">
            {JSON.stringify(detailsItem?.details ?? null, null, 2)}
          </pre>
        </div>
      </Modal>
    </>
  );
}

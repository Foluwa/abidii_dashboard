"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import Alert from '@/components/ui/alert/SimpleAlert';
import StatusBadge from '@/components/admin/StatusBadge';
import Pagination from '@/components/tables/Pagination';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import { useAdminAuditLogList, useAdminCurriculumOpsMetrics } from '@/hooks/useApi';

function getResult(details: unknown): string {
  const d = details as any;
  return (d?.result || 'unknown') as string;
}

function getValidationStatus(details: unknown): string | null {
  const d = details as any;
  return typeof d?.validation_status === 'string' ? d.validation_status : null;
}

type Totals = {
  total: number;
  success: number;
  blocked: number;
  failed: number;
  unknown: number;
};

function resultBadge(result: string) {
  const r = (result || '').toLowerCase();
  if (r === 'success') return <StatusBadge status="success" label="Success" />;
  if (r === 'blocked') return <StatusBadge status="warning" label="Blocked" />;
  if (r === 'failed') return <StatusBadge status="error" label="Failed" />;
  return <StatusBadge status="info" label={result || 'unknown'} />;
}

export default function CurriculumOpsPage() {
  const pathname = usePathname();
  const [days, setDays] = useState(7);
  const [recentResultFilter, setRecentResultFilter] = useState<'all' | 'blocked' | 'failed'>('all');
  const [recentTargetFilter, setRecentTargetFilter] = useState<'all' | 'course' | 'lesson_blueprint'>('all');
  const [recentActionSearch, setRecentActionSearch] = useState('');
  const [recentPage, setRecentPage] = useState(1);
  const recentLimit = 25;
  const [metricsActionFilter, setMetricsActionFilter] = useState('');
  const [metricsResultFilter, setMetricsResultFilter] = useState<'all' | 'success' | 'blocked' | 'failed' | 'unknown'>('all');
  const [metricsPage, setMetricsPage] = useState(1);
  const metricsLimit = 25;

  const { metrics, isLoading, isError, refresh } = useAdminCurriculumOpsMetrics(days);

  const [nowAnchorMs, setNowAnchorMs] = useState<number>(() => Date.now());
  const fromTs24h = useMemo(() => new Date(nowAnchorMs - 24 * 60 * 60 * 1000).toISOString(), [nowAnchorMs]);

  const courseAudit = useAdminAuditLogList({
    page: 1,
    limit: 200,
    action_prefix: 'course.',
    from_ts: fromTs24h,
  });

  const blueprintAudit = useAdminAuditLogList({
    page: 1,
    limit: 200,
    action_prefix: 'lesson_blueprint.',
    from_ts: fromTs24h,
  });

  const last24hItems = useMemo(() => {
    const a = courseAudit.data?.items ?? [];
    const b = blueprintAudit.data?.items ?? [];
    return [...a, ...b].sort((x, y) => (x.created_at < y.created_at ? 1 : -1));
  }, [courseAudit.data?.items, blueprintAudit.data?.items]);

  const last24hSummary = useMemo(() => {
    let publishSuccess = 0;
    let publishBlocked = 0;
    let publishFailed = 0;
    const validationStatusCounts = new Map<string, number>();

    for (const item of last24hItems) {
      const action = item.action || '';
      const result = (getResult(item.details) || '').toLowerCase();
      const vs = getValidationStatus(item.details);

      if (vs) validationStatusCounts.set(vs, (validationStatusCounts.get(vs) || 0) + 1);

      if (action.endsWith('.publish')) {
        if (result === 'success') publishSuccess += 1;
        else if (result === 'blocked') publishBlocked += 1;
        else if (result === 'failed') publishFailed += 1;
      }
    }

    const topValidationStatuses = Array.from(validationStatusCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      publishSuccess,
      publishBlocked,
      publishFailed,
      topValidationStatuses,
    };
  }, [last24hItems]);

  const recentBlockedOrFailed = useMemo(() => {
    return last24hItems
      .filter((i) => {
        const r = (getResult(i.details) || '').toLowerCase();
        return r === 'blocked' || r === 'failed';
      });
  }, [last24hItems]);

  const filteredRecentBlockedOrFailed = useMemo(() => {
    const normalizedSearch = recentActionSearch.trim().toLowerCase();
    return recentBlockedOrFailed.filter((row) => {
      const result = (getResult(row.details) || '').toLowerCase();
      if (recentResultFilter !== 'all' && result !== recentResultFilter) return false;
      if (recentTargetFilter !== 'all' && row.target_type !== recentTargetFilter) return false;
      if (normalizedSearch) {
        const haystack = `${row.action} ${row.target_type} ${row.target_id ?? ''}`.toLowerCase();
        if (!haystack.includes(normalizedSearch)) return false;
      }
      return true;
    });
  }, [recentActionSearch, recentBlockedOrFailed, recentResultFilter, recentTargetFilter]);

  const recentTotal = filteredRecentBlockedOrFailed.length;
  const recentTotalPages = Math.max(1, Math.ceil(recentTotal / recentLimit));
  const recentPageStart = recentTotal === 0 ? 0 : (recentPage - 1) * recentLimit + 1;
  const recentPageEnd = recentTotal === 0 ? 0 : Math.min(recentPage * recentLimit, recentTotal);
  const recentRows = useMemo(() => {
    const start = (recentPage - 1) * recentLimit;
    return filteredRecentBlockedOrFailed.slice(start, start + recentLimit);
  }, [filteredRecentBlockedOrFailed, recentPage]);

  const filteredMetricsRows = useMemo(() => {
    const metricsRows = metrics?.rows ?? [];
    const normalizedAction = metricsActionFilter.trim().toLowerCase();
    return metricsRows.filter((row) => {
      const rowResult = (row.result || '').toLowerCase();
      if (metricsResultFilter !== 'all' && rowResult !== metricsResultFilter) return false;
      if (normalizedAction && !row.action.toLowerCase().includes(normalizedAction)) return false;
      return true;
    });
  }, [metrics, metricsActionFilter, metricsResultFilter]);

  const metricsTotal = filteredMetricsRows.length;
  const metricsTotalPages = Math.max(1, Math.ceil(metricsTotal / metricsLimit));
  const metricsPageStart = metricsTotal === 0 ? 0 : (metricsPage - 1) * metricsLimit + 1;
  const metricsPageEnd = metricsTotal === 0 ? 0 : Math.min(metricsPage * metricsLimit, metricsTotal);
  const paginatedMetricsRows = useMemo(() => {
    const start = (metricsPage - 1) * metricsLimit;
    return filteredMetricsRows.slice(start, start + metricsLimit);
  }, [filteredMetricsRows, metricsPage]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setRecentPage(1);
  }, [days, recentActionSearch, recentResultFilter, recentTargetFilter]);

  useEffect(() => {
    setMetricsPage(1);
  }, [days, metricsActionFilter, metricsResultFilter]);

  useEffect(() => {
    if (recentPage > recentTotalPages) {
      setRecentPage(recentTotalPages);
    }
  }, [recentPage, recentTotalPages]);

  useEffect(() => {
    if (metricsPage > metricsTotalPages) {
      setMetricsPage(metricsTotalPages);
    }
  }, [metricsPage, metricsTotalPages]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const totals = useMemo((): Totals => {
    const rows = metrics?.rows ?? [];
    const t: Totals = { total: 0, success: 0, blocked: 0, failed: 0, unknown: 0 };
    for (const row of rows) {
      t.total += row.count;
      const r = (row.result || '').toLowerCase();
      if (r === 'success') t.success += row.count;
      else if (r === 'blocked') t.blocked += row.count;
      else if (r === 'failed') t.failed += row.count;
      else t.unknown += row.count;
    }
    return t;
  }, [metrics]);

  if (isError) {
    const errMsg = isError?.response?.data?.detail || isError?.message || 'Failed to load curriculum ops metrics.';
    const status = isError?.response?.status;
    return (
      <div className="p-6 space-y-4">
        <Alert variant="error">
          <div className="font-medium">Failed to load curriculum ops metrics</div>
          <div className="text-sm mt-1">{errMsg}{status ? ` (HTTP ${status})` : ''}</div>
        </Alert>
        <button
          onClick={() => refresh()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <PageBreadCrumb pageTitle="Curriculum Ops" />
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Audit-derived operational counts for validate/publish actions on courses and lesson blueprints.
          </p>
        </div>
        <button
          onClick={() => {
            setNowAnchorMs(Date.now());
            refresh();
            courseAudit.refresh();
            blueprintAudit.refresh();
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh Data
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex -mb-px space-x-8">
          {[
            { name: 'Overview', href: '/analytics' },
            { name: 'Players', href: '/analytics/players' },
            { name: 'Curriculum Ops', href: '/analytics/curriculum-ops' },
          ].map((tab) => (
            <Link
              key={tab.name}
              href={tab.href}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm
                ${pathname === tab.href
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }
              `}
            >
              {tab.name}
            </Link>
          ))}
        </nav>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">Last 24h (from audit log)</div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Window starts: {fromTs24h}</div>
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-300">
            Publish — Success: <span className="font-medium text-gray-900 dark:text-white">{last24hSummary.publishSuccess}</span> | Blocked:{' '}
            <span className="font-medium text-gray-900 dark:text-white">{last24hSummary.publishBlocked}</span> | Failed:{' '}
            <span className="font-medium text-gray-900 dark:text-white">{last24hSummary.publishFailed}</span>
          </div>
        </div>

        {last24hSummary.topValidationStatuses.length > 0 && (
          <div className="mt-3 text-xs text-gray-600 dark:text-gray-300">
            Top validation statuses: {' '}
            {last24hSummary.topValidationStatuses
              .map(([k, v]) => `${k} (${v})`)
              .join(' · ')}
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="text-sm font-medium text-gray-900 dark:text-white">Recent blocked/failed (last 24h)</div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Filter operational failures by action/result/target type.</div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Action search</label>
              <input
                value={recentActionSearch}
                onChange={(e) => setRecentActionSearch(e.target.value)}
                placeholder="publish, validate..."
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-theme-xs focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <StyledSelect
                label="Result"
                value={recentResultFilter}
                onChange={(e) => setRecentResultFilter(e.target.value as 'all' | 'blocked' | 'failed')}
                options={[
                  { value: 'all', label: 'Blocked + Failed' },
                  { value: 'blocked', label: 'Blocked only' },
                  { value: 'failed', label: 'Failed only' },
                ]}
                fullWidth
              />
            </div>
            <div>
              <StyledSelect
                label="Target type"
                value={recentTargetFilter}
                onChange={(e) => setRecentTargetFilter(e.target.value as 'all' | 'course' | 'lesson_blueprint')}
                options={[
                  { value: 'all', label: 'All targets' },
                  { value: 'course', label: 'Course' },
                  { value: 'lesson_blueprint', label: 'Lesson blueprint' },
                ]}
                fullWidth
              />
            </div>
            <div className="flex items-end">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Matching rows: <span className="font-medium text-gray-900 dark:text-white">{recentTotal}</span>
              </p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-white/[0.05]" role="table" aria-label="Recent blocked/failed">
            <thead className="bg-gray-50 dark:bg-white/[0.02]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Result</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-white/[0.05]">
              {(courseAudit.isLoading || blueprintAudit.isLoading) && (
                <tr>
                  <td className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400" colSpan={4}>
                    Loading…
                  </td>
                </tr>
              )}
              {!courseAudit.isLoading && !blueprintAudit.isLoading && recentRows.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400" colSpan={4}>
                    No blocked/failed actions in this window.
                  </td>
                </tr>
              )}
              {recentRows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-mono">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 font-mono">{row.action}</td>
                  <td className="px-4 py-3 text-sm">{resultBadge(getResult(row.details))}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 font-mono">
                    {row.target_type}:{' '}
                    {row.target_id || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {recentPageStart} to {recentPageEnd} of {recentTotal} blocked/failed actions
          </p>
          <div className="ml-auto">
            <Pagination currentPage={recentPage} totalPages={recentTotalPages} onPageChange={setRecentPage} />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 p-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div>
            <StyledSelect
              id="curriculumOpsDays"
              label="Time Range"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              options={[
                { value: 7, label: 'Last 7 days' },
                { value: 14, label: 'Last 14 days' },
                { value: 30, label: 'Last 30 days' },
                { value: 60, label: 'Last 60 days' },
                { value: 90, label: 'Last 90 days' },
              ]}
              fullWidth
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Action filter</label>
            <input
              value={metricsActionFilter}
              onChange={(e) => setMetricsActionFilter(e.target.value)}
              placeholder="course.publish..."
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <StyledSelect
              label="Result filter"
              value={metricsResultFilter}
              onChange={(e) => setMetricsResultFilter(e.target.value as 'all' | 'success' | 'blocked' | 'failed' | 'unknown')}
              options={[
                { value: 'all', label: 'All results' },
                { value: 'success', label: 'Success' },
                { value: 'blocked', label: 'Blocked' },
                { value: 'failed', label: 'Failed' },
                { value: 'unknown', label: 'Unknown' },
              ]}
              fullWidth
            />
          </div>
          <div className="flex items-end">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Window: <span className="text-gray-900 dark:text-white">{metrics?.window_days ?? days} days</span><br />
              Matching rows: <span className="text-gray-900 dark:text-white">{metricsTotal}</span>
            </div>
          </div>
          <div className="flex items-end">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Total: <span className="text-gray-900 dark:text-white">{totals.total}</span>
            </div>
          </div>
          <div className="flex items-end">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Success: <span className="text-gray-900 dark:text-white">{totals.success}</span> | Blocked:{' '}
              <span className="text-gray-900 dark:text-white">{totals.blocked}</span> | Failed:{' '}
              <span className="text-gray-900 dark:text-white">{totals.failed}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-white/[0.05]" role="table">
            <thead className="bg-gray-50 dark:bg-white/[0.02]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Day</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Result</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300">Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-white/[0.05]">
              {isLoading && (
                <tr>
                  <td className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400" colSpan={4}>
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && metricsTotal === 0 && (
                <tr>
                  <td className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400" colSpan={4}>
                    No metrics in this window.
                  </td>
                </tr>
              )}
              {paginatedMetricsRows.map((row, idx) => (
                <tr key={`${row.day}-${row.action}-${row.result}-${idx}`}>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-mono">{row.day}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 font-mono">{row.action}</td>
                  <td className="px-4 py-3 text-sm">{resultBadge(row.result)}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-white">{row.count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {metricsPageStart} to {metricsPageEnd} of {metricsTotal} curriculum-ops metric rows
          </p>
          <div className="ml-auto">
            <Pagination currentPage={metricsPage} totalPages={metricsTotalPages} onPageChange={setMetricsPage} />
          </div>
        </div>
      </div>
    </div>
  );
}

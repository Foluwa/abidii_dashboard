'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import StatusBadge from '@/components/admin/StatusBadge';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import Pagination from '@/components/tables/Pagination';
import { useToast } from '@/contexts/ToastContext';
import {
  useAdminOrphanAssetCandidates,
  useAdminOrphanAssetScans,
  useAdminOrphanAssetSummary,
} from '@/hooks/useApi';
import {
  applyOrphanAssetBulkAction,
  runOrphanAssetScan,
} from '@/lib/orphanAssetsApi';
import type {
  OrphanAssetAction,
  OrphanAssetCandidateItem,
  OrphanAssetCandidateStatus,
} from '@/types/orphan-assets';

function formatDate(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function formatBytes(bytes?: number) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function ageInDays(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / (24 * 60 * 60 * 1000)));
}

function isAudioAsset(assetType: string) {
  return assetType === 'audio' || assetType === 'generated_audio' || assetType.includes('audio');
}

function MediaPreview({ storageKey, assetType }: { storageKey: string; assetType: string }) {
  if (!isAudioAsset(assetType)) return <span className="text-xs text-gray-400">—</span>;
  const baseUrl = process.env.NEXT_PUBLIC_MEDIA_BASE_URL || (process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.abidii.app');
  const src = `${baseUrl}/api/v1/media/${encodeURIComponent(storageKey)}`;
  return (
    <audio
      controls
      preload="none"
      className="h-8 w-48"
      onError={(e) => {
        // Fallback: try without /api/v1/media/ prefix if first fails
        const el = e.currentTarget;
        if (el.src.includes('/api/v1/media/')) {
          el.src = `${baseUrl}/${encodeURIComponent(storageKey)}`;
        }
      }}
    >
      <source src={src} />
    </audio>
  );
}

function mapStatusBadge(status: OrphanAssetCandidateStatus) {
  if (status === 'deleted') return <StatusBadge status="success" label="deleted" />;
  if (status === 'protected') return <StatusBadge status="info" label="protected" />;
  if (status === 'delete_failed') return <StatusBadge status="error" label="delete failed" />;
  if (status === 'scheduled_for_delete') return <StatusBadge status="warning" label="scheduled" />;
  if (status === 'reviewed') return <StatusBadge status="info" label="reviewed" />;
  if (status === 'skipped') return <StatusBadge status="inactive" label="skipped" />;
  return <StatusBadge status="pending" label="candidate" />;
}

export default function OrphanAssetsPage() {
  const toast = useToast();
  const [scanPage] = useState(1);
  const [scanLimit] = useState(10);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [assetType, setAssetType] = useState('');
  const [prefix, setPrefix] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [minAgeDays, setMinAgeDays] = useState('14');
  const [minSize, setMinSize] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmittingScan, setIsSubmittingScan] = useState(false);
  const [isApplyingAction, setIsApplyingAction] = useState(false);

  const summary = useAdminOrphanAssetSummary();
  const scans = useAdminOrphanAssetScans({ page: scanPage, limit: scanLimit });
  const candidates = useAdminOrphanAssetCandidates({
    page,
    limit,
    asset_type: assetType || undefined,
    prefix: prefix || undefined,
    status: status || undefined,
    min_age_days: minAgeDays ? Number(minAgeDays) : undefined,
    min_size_bytes: minSize ? Number(minSize) : undefined,
    q: search || undefined,
  });
  const refreshSummary = summary.refresh;
  const refreshScans = scans.refresh;
  const refreshCandidates = candidates.refresh;

  const candidateItems = useMemo(() => candidates.data?.items ?? [], [candidates.data?.items]);
  const totalCandidates = candidates.data?.total ?? 0;
  const totalPages = candidates.data?.pages ?? Math.max(1, Math.ceil(totalCandidates / limit));
  const pageStart = totalCandidates === 0 ? 0 : (page - 1) * limit + 1;
  const pageEnd = totalCandidates === 0 ? 0 : Math.min(page * limit, totalCandidates);
  const activeScan = useMemo(
    () => scans.data?.items.find((scan) => !scan.completed_at) ?? null,
    [scans.data?.items]
  );
  const isScanRunning = Boolean(activeScan);

  useEffect(() => {
    setSelectedIds((current) => current.filter((candidateId) => candidateItems.some((item) => item.candidate_id === candidateId)));
  }, [candidateItems]);

  const selectedCandidateItems = useMemo(
    () => candidateItems.filter((item) => selectedIds.includes(item.candidate_id)),
    [candidateItems, selectedIds]
  );

  const prefixOptions = useMemo(() => summary.data?.settings.managed_prefixes ?? [], [summary.data]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshSummary(),
      refreshScans(),
      refreshCandidates(),
    ]);
  }, [refreshCandidates, refreshScans, refreshSummary]);

  useEffect(() => {
    if (!activeScan) return undefined;

    const timer = window.setTimeout(() => {
      void refreshAll();
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [activeScan, refreshAll]);

  const handleRunScan = async (mode: 'dry_run' | 'active') => {
    setIsSubmittingScan(true);
    try {
      const result = await runOrphanAssetScan({ scan_mode: mode });
      await refreshAll();
      if (result.completed_at) {
        toast.success(`Scan ${result.scan_id} finished. Scanned ${result.objects_scanned} objects and flagged ${result.candidates_found} candidates.`);
      } else {
        toast.success(`Scan ${result.scan_id} queued. The page will refresh when it completes.`);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || error?.message || 'Failed to run orphan asset scan.');
    } finally {
      setIsSubmittingScan(false);
    }
  };

  const toggleCandidate = (candidateId: string) => {
    setSelectedIds((current) =>
      current.includes(candidateId)
        ? current.filter((value) => value !== candidateId)
        : [...current, candidateId]
    );
  };

  const toggleAllVisible = () => {
    if (candidateItems.length === 0) return;
    const visibleIds = candidateItems.map((item) => item.candidate_id);
    const allSelected = visibleIds.every((candidateId) => selectedIds.includes(candidateId));
    setSelectedIds(allSelected ? selectedIds.filter((candidateId) => !visibleIds.includes(candidateId)) : Array.from(new Set([...selectedIds, ...visibleIds])));
  };

  const handleBulkAction = async (action: OrphanAssetAction, ids?: string[]) => {
    const candidateIds = ids ?? selectedIds;
    if (candidateIds.length === 0) {
      toast.info('Select at least one candidate first.');
      return;
    }

    if (action === 'delete_now') {
      const confirmed = window.confirm(`Delete ${candidateIds.length} object${candidateIds.length === 1 ? '' : 's'} from R2 now? The system will re-check references first.`);
      if (!confirmed) return;
    }

    setIsApplyingAction(true);
    try {
      const result = await applyOrphanAssetBulkAction({
        action,
        candidate_ids: candidateIds,
      });
      await refreshAll();
      setSelectedIds([]);
      if (result.failure_count > 0) {
        toast.error(`${result.success_count} updated, ${result.failure_count} failed.`);
      } else {
        toast.success(`${result.success_count} candidate${result.success_count === 1 ? '' : 's'} updated.`);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || error?.message || 'Failed to apply action.');
    } finally {
      setIsApplyingAction(false);
    }
  };

  const activeSummaryCards = [
    { label: 'Open Candidates', value: String(summary.data?.open_candidates ?? 0) },
    { label: 'Tracked Candidates', value: String(summary.data?.total_candidates ?? 0) },
    { label: 'Open Candidate Size', value: formatBytes(summary.data?.total_candidate_bytes ?? 0) },
    { label: 'Default Grace Period', value: `${summary.data?.settings.grace_period_days ?? 14} days` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageBreadCrumb pageTitle="Orphan Assets" />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleRunScan('dry_run')}
            disabled={isSubmittingScan || isScanRunning}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {isSubmittingScan && !isScanRunning ? 'Queueing…' : isScanRunning ? 'Scan Running…' : 'Run Dry Scan'}
          </button>
          <button
            type="button"
            onClick={() => void handleRunScan('active')}
            disabled={isSubmittingScan || isScanRunning}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {isSubmittingScan && !isScanRunning ? 'Queueing…' : isScanRunning ? 'Scan Running…' : 'Run Active Scan'}
          </button>
        </div>
      </div>

      {activeScan ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <span className="font-medium">Scan in progress.</span> Started {formatDate(activeScan.started_at)} in {activeScan.scan_mode} mode. The page refreshes automatically until this run completes.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {activeSummaryCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{card.label}</div>
            <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Scan Runs</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Scheduled scans use the configured defaults. Manual scans can be dry-run or active, but neither mode deletes objects.
            </p>
          </div>
          {summary.data?.last_completed_scan ? (
            <div className="text-right text-sm text-gray-500 dark:text-gray-400">
              <div>Last completed scan</div>
              <div className="font-medium text-gray-900 dark:text-white">{formatDate(summary.data.last_completed_scan.completed_at)}</div>
            </div>
          ) : null}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                <th className="px-3 py-3">Started</th>
                <th className="px-3 py-3">Mode</th>
                <th className="px-3 py-3">Objects</th>
                <th className="px-3 py-3">Candidates</th>
                <th className="px-3 py-3">Errors</th>
                <th className="px-3 py-3">Trigger</th>
              </tr>
            </thead>
            <tbody>
              {scans.isLoading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-gray-500 dark:text-gray-400">Loading scans…</td>
                </tr>
              ) : scans.isError ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-red-600 dark:text-red-300">Failed to load scan runs.</td>
                </tr>
              ) : (scans.data?.items ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-gray-500 dark:text-gray-400">No scans recorded yet.</td>
                </tr>
              ) : (
                (scans.data?.items ?? []).map((scan) => (
                  <tr key={scan.scan_id} className="border-b border-gray-100 align-top dark:border-gray-800">
                    <td className="px-3 py-3 text-gray-900 dark:text-white">{formatDate(scan.started_at)}</td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-200">{scan.scan_mode}{!scan.completed_at ? ' (running)' : ''}</td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-200">{scan.objects_scanned.toLocaleString()}</td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-200">{scan.candidates_found.toLocaleString()}</td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-200">{scan.error_count}</td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-200">{scan.triggered_by_type}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Search</label>
            <input
              aria-label="Search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Storage key or error"
              className="block h-12 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            />
          </div>
          <div>
            <StyledSelect
              aria-label="Asset type"
              label="Asset type"
              value={assetType}
              onChange={(event) => {
                setAssetType(event.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All types' },
                { value: 'lesson_media', label: 'lesson_media' },
                { value: 'audio', label: 'audio' },
                { value: 'generated_audio', label: 'generated_audio' },
                { value: 'image', label: 'image' },
                { value: 'misc', label: 'misc' },
              ]}
              fullWidth
            />
          </div>
          <div>
            <StyledSelect
              aria-label="Prefix"
              label="Prefix"
              value={prefix}
              onChange={(event) => {
                setPrefix(event.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All prefixes' },
                ...prefixOptions.map((option) => ({ value: option, label: option })),
              ]}
              fullWidth
            />
          </div>
          <div>
            <StyledSelect
              aria-label="Status"
              label="Status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All statuses' },
                { value: 'candidate', label: 'candidate' },
                { value: 'reviewed', label: 'reviewed' },
                { value: 'protected', label: 'protected' },
                { value: 'scheduled_for_delete', label: 'scheduled_for_delete' },
                { value: 'deleted', label: 'deleted' },
                { value: 'skipped', label: 'skipped' },
                { value: 'delete_failed', label: 'delete_failed' },
              ]}
              fullWidth
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Min age days</label>
            <input
              aria-label="Min age days"
              type="number"
              min={0}
              value={minAgeDays}
              onChange={(event) => {
                setMinAgeDays(event.target.value);
                setPage(1);
              }}
              className="block h-12 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Min size bytes</label>
            <input
              aria-label="Min size bytes"
              type="number"
              min={0}
              value={minSize}
              onChange={(event) => {
                setMinSize(event.target.value);
                setPage(1);
              }}
              className="block h-12 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleBulkAction('review')}
            disabled={isApplyingAction || selectedIds.length === 0}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Review
          </button>
          <button
            type="button"
            onClick={() => void handleBulkAction('protect')}
            disabled={isApplyingAction || selectedIds.length === 0}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Protect
          </button>
          <button
            type="button"
            onClick={() => void handleBulkAction('skip')}
            disabled={isApplyingAction || selectedIds.length === 0}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => void handleBulkAction('schedule_delete')}
            disabled={isApplyingAction || selectedIds.length === 0}
            className="rounded-lg border border-amber-300 px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/20"
          >
            Schedule Delete
          </button>
          <button
            type="button"
            onClick={() => void handleBulkAction('delete_now')}
            disabled={isApplyingAction || selectedIds.length === 0}
            className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950/20"
          >
            Delete Now
          </button>
          <div className="ml-auto text-sm text-gray-500 dark:text-gray-400">
            {selectedIds.length} selected
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                <th className="px-3 py-3">
                  <input
                    aria-label="Select all visible candidates"
                    type="checkbox"
                    checked={candidateItems.length > 0 && candidateItems.every((item) => selectedIds.includes(item.candidate_id))}
                    onChange={toggleAllVisible}
                  />
                </th>
                <th className="px-3 py-3">Storage key</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Size</th>
                <th className="px-3 py-3">Prefix</th>
                <th className="px-3 py-3">Age</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Preview</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {candidates.isLoading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-gray-500 dark:text-gray-400">Loading orphan candidates…</td>
                </tr>
              ) : candidates.isError ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-red-600 dark:text-red-300">Failed to load orphan candidates.</td>
                </tr>
              ) : candidateItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-gray-500 dark:text-gray-400">No orphan candidates match the current filters.</td>
                </tr>
              ) : (
                candidateItems.map((item: OrphanAssetCandidateItem) => (
                  <tr key={item.candidate_id} className="border-b border-gray-100 align-top dark:border-gray-800">
                    <td className="px-3 py-3">
                      <input
                        aria-label={`Select candidate ${item.storage_key}`}
                        type="checkbox"
                        checked={selectedIds.includes(item.candidate_id)}
                        onChange={() => toggleCandidate(item.candidate_id)}
                      />
                    </td>
                    <td className="px-3 py-3 text-gray-900 dark:text-white">
                      <div className="max-w-[24rem] break-all font-medium">{item.storage_key}</div>
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.flagged_reason}</div>
                      {item.latest_error ? (
                        <div className="mt-1 text-xs text-red-600 dark:text-red-300">{item.latest_error}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-200">{item.asset_type}</td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-200">{formatBytes(item.object_size)}</td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-200">{item.prefix}</td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-200">{ageInDays(item.last_modified)}d</td>
                    <td className="px-3 py-3">{mapStatusBadge(item.status)}</td>
                    <td className="px-3 py-3">
                      <MediaPreview storageKey={item.storage_key} assetType={item.asset_type} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => void handleBulkAction('protect', [item.candidate_id])} className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-300">Protect</button>
                        <button type="button" onClick={() => void handleBulkAction('skip', [item.candidate_id])} className="text-xs font-medium text-gray-600 hover:underline dark:text-gray-300">Skip</button>
                        <button type="button" onClick={() => void handleBulkAction('schedule_delete', [item.candidate_id])} className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-300">Schedule</button>
                        <button type="button" onClick={() => void handleBulkAction('delete_now', [item.candidate_id])} className="text-xs font-medium text-red-700 hover:underline dark:text-red-300">Delete now</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {pageStart} to {pageEnd} of {totalCandidates} orphan asset candidates
          </p>
          <div className="ml-auto">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </div>
      </div>
    </div>
  );
}

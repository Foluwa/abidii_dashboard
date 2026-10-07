'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import Pagination from '@/components/tables/Pagination';
import StatusBadge from '@/components/admin/StatusBadge';
import ValidationResultViewer from '@/components/admin/curriculum/ValidationResultViewer';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import { Modal } from '@/components/ui/modal';
import { ConfirmationModal } from '@/components/ui/modal/ConfirmationModal';
import { useToast } from '@/contexts/ToastContext';
import { useAdminLessonBlueprintsList } from '@/hooks/useApi';
import {
  publishAdminBlueprint,
  unpublishAdminBlueprint,
  validateAdminBlueprint,
} from '@/lib/adminCurriculumApi';
import { logAdminCurriculumAction } from '@/lib/adminActionLog';
import { runBulkWithConcurrency, type BulkItemOutcome } from '@/lib/bulkRunner';
import type {
  LessonBlueprintValidationResponse,
  ValidationResultPayload,
} from '@/types/curriculum';

type BulkOutcome = BulkItemOutcome<LessonBlueprintValidationResponse>;

export function LessonBlueprintsContent({ showHeader = true }: { showHeader?: boolean }) {
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [enabled, setEnabled] = useState<string>('');
  const [courseId, setCourseId] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ completed: number; total: number } | null>(null);

  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [showUnpublishConfirm, setShowUnpublishConfirm] = useState(false);

  const [lastBulkOutcomes, setLastBulkOutcomes] = useState<BulkOutcome[] | null>(null);
  const [lastBulkAction, setLastBulkAction] = useState<'validate' | 'publish' | 'unpublish' | null>(null);

  const [blockedValidationOpen, setBlockedValidationOpen] = useState(false);
  const [blockedValidation, setBlockedValidation] = useState<ValidationResultPayload | null>(null);

  const enabledFilter = enabled === '' ? undefined : enabled === 'true';
  const { data, isLoading, isError, refresh } = useAdminLessonBlueprintsList({
    page,
    limit,
    course_id: courseId || undefined,
    search: search || undefined,
    status: status || undefined,
    enabled: enabledFilter,
  });

  const items = useMemo(() => data?.items ?? [], [data]);
  const total = data?.total ?? 0;
  const totalPages = data?.pages ?? Math.max(1, Math.ceil(total / limit));
  const pageStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const pageEnd = total === 0 ? 0 : Math.min(page * limit, total);

  const labelById = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((bp) => map.set(bp.id, bp.blueprint_key));
    return map;
  }, [items]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allOnPageSelected = items.length > 0 && items.every((b) => selectedSet.has(b.id));

  const toggleSelect = (blueprintId: string) => {
    setSelectedIds((prev) =>
      prev.includes(blueprintId) ? prev.filter((id) => id !== blueprintId) : [...prev, blueprintId]
    );
  };

  const toggleSelectAllOnPage = () => {
    if (allOnPageSelected) {
      const idsOnPage = new Set(items.map((b) => b.id));
      setSelectedIds((prev) => prev.filter((id) => !idsOnPage.has(id)));
      return;
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      items.forEach((b) => next.add(b.id));
      return Array.from(next);
    });
  };

  const runBulk = async (
    action: 'validate' | 'publish' | 'unpublish',
    ids: string[]
  ): Promise<BulkOutcome[]> => {
    return await runBulkWithConcurrency<LessonBlueprintValidationResponse>(
      ids,
      async (blueprintId) => {
        if (action === 'validate') {
          await validateAdminBlueprint(blueprintId);
          return { outcome: 'success' };
        }

        if (action === 'publish') {
          const result = await publishAdminBlueprint(blueprintId);
          if (!result.ok) {
            return { outcome: 'blocked', blockedBody: result.body };
          }
          return { outcome: 'success' };
        }

        await unpublishAdminBlueprint(blueprintId);
        return { outcome: 'success' };
      },
      {
        concurrency: 4,
        maxAttempts: 3,
        baseDelayMs: 250,
        onProgress: (u) => setBulkProgress({ completed: u.completed, total: u.total }),
      }
    );
  };

  const summarize = (outcomes: BulkOutcome[]) => {
    const summary = { success: 0, blocked: 0, failed: 0 };
    for (const o of outcomes) summary[o.outcome] += 1;
    return summary;
  };

  const openBlockedValidation = (outcome: BulkOutcome) => {
    const validation = outcome.blockedBody?.validation ?? null;
    setBlockedValidation(validation);
    setBlockedValidationOpen(true);
  };

  const onBulkValidate = async () => {
    if (selectedIds.length === 0 || isBulkRunning) return;

    setIsBulkRunning(true);
    setBulkProgress({ completed: 0, total: selectedIds.length });
    setLastBulkOutcomes(null);
    setLastBulkAction('validate');
    try {
      const outcomes = await runBulk('validate', selectedIds);
      setLastBulkOutcomes(outcomes);
      const s = summarize(outcomes);
      toast.success(`Validated: ${s.success}, Failed: ${s.failed}`);
      logAdminCurriculumAction({
        entity: 'lesson_blueprint',
        action: 'validate',
        scope: 'bulk',
        requested_count: selectedIds.length,
        outcomes: { success: s.success, blocked: 0, failed: s.failed },
      });
      await refresh();
    } finally {
      setIsBulkRunning(false);
      setBulkProgress(null);
    }
  };

  const onBulkPublishConfirmed = async () => {
    if (selectedIds.length === 0 || isBulkRunning) return;

    setIsBulkRunning(true);
    setBulkProgress({ completed: 0, total: selectedIds.length });
    setLastBulkOutcomes(null);
    setLastBulkAction('publish');
    try {
      const outcomes = await runBulk('publish', selectedIds);
      setLastBulkOutcomes(outcomes);
      const s = summarize(outcomes);
      toast.info(`Published: ${s.success}, Blocked: ${s.blocked}, Failed: ${s.failed}`);
      logAdminCurriculumAction({
        entity: 'lesson_blueprint',
        action: 'publish',
        scope: 'bulk',
        requested_count: selectedIds.length,
        outcomes: { success: s.success, blocked: s.blocked, failed: s.failed },
      });
      setShowPublishConfirm(false);
      await refresh();
    } finally {
      setIsBulkRunning(false);
      setBulkProgress(null);
    }
  };

  const onBulkUnpublishConfirmed = async () => {
    if (selectedIds.length === 0 || isBulkRunning) return;

    setIsBulkRunning(true);
    setBulkProgress({ completed: 0, total: selectedIds.length });
    setLastBulkOutcomes(null);
    setLastBulkAction('unpublish');
    try {
      const outcomes = await runBulk('unpublish', selectedIds);
      setLastBulkOutcomes(outcomes);
      const s = summarize(outcomes);
      toast.success(`Unpublished: ${s.success}, Failed: ${s.failed}`);
      logAdminCurriculumAction({
        entity: 'lesson_blueprint',
        action: 'unpublish',
        scope: 'bulk',
        requested_count: selectedIds.length,
        outcomes: { success: s.success, blocked: 0, failed: s.failed },
      });
      setShowUnpublishConfirm(false);
      await refresh();
    } finally {
      setIsBulkRunning(false);
      setBulkProgress(null);
    }
  };

  const onRetryFailed = async () => {
    if (!lastBulkOutcomes || !lastBulkAction || isBulkRunning) return;
    const failedIds = lastBulkOutcomes.filter((o) => o.outcome === 'failed').map((o) => o.id);
    if (failedIds.length === 0) return;

    setIsBulkRunning(true);
    setBulkProgress({ completed: 0, total: failedIds.length });
    try {
      const retried = await runBulk(lastBulkAction, failedIds);

      const next = [...lastBulkOutcomes];
      const indexById = new Map(next.map((o, idx) => [o.id, idx] as const));
      retried.forEach((o) => {
        const idx = indexById.get(o.id);
        if (typeof idx === 'number') next[idx] = o;
      });

      setLastBulkOutcomes(next);
      const s = summarize(next);
      toast.success(`Retry complete. Success: ${s.success}, Blocked: ${s.blocked}, Failed: ${s.failed}`);
      await refresh();
    } finally {
      setIsBulkRunning(false);
      setBulkProgress(null);
    }
  };

  const validationBadge = (validationStatus: string) => {
    if (validationStatus === 'valid') return <StatusBadge status="success" label="Valid" />;
    if (validationStatus === 'invalid') return <StatusBadge status="error" label="Invalid" />;
    return (
      <span title="Validation has not been run yet, validation metadata is stale, or this blueprint was promoted outside the normal validate/publish workflow.">
        <StatusBadge status="error" label="Unknown" />
      </span>
    );
  };

  const reviewBadge = (reviewStatus?: string | null) => {
    if (reviewStatus === 'needs_review') return <StatusBadge status="warning" label="Needs Review" />;
    if (reviewStatus === 'published') return <StatusBadge status="success" label="Published Live" />;
    return <StatusBadge status="draft" label="Draft Only" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        {showHeader ? <PageBreadCrumb pageTitle="Lesson Blueprints" /> : <div />}
        <div className="flex items-center gap-2">
          <Link
            href="/audio?tab=voices"
            className="rounded-lg border border-input px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
          >
            Audio Assets
          </Link>
          <Link
            href="/curriculum/lesson-blueprints/new"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-brand-700"
          >
            New Blueprint
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Search</label>
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="blueprint key"
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground shadow-theme-xs focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Course ID</label>
              <input
                value={courseId}
                onChange={(e) => {
                  setCourseId(e.target.value);
                  setPage(1);
                }}
                placeholder="uuid"
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground shadow-theme-xs focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
              <StyledSelect
                aria-label="Status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                options={[
                  { value: '', label: 'All' },
                  { value: 'draft', label: 'Draft' },
                  { value: 'published', label: 'Published' },
                  { value: 'archived', label: 'Archived' },
                ]}
                placeholder=""
                fullWidth
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Enabled</label>
              <StyledSelect
                aria-label="Enabled"
                value={enabled}
                onChange={(e) => {
                  setEnabled(e.target.value);
                  setPage(1);
                }}
                options={[
                  { value: '', label: 'All' },
                  { value: 'true', label: 'Enabled' },
                  { value: 'false', label: 'Disabled' },
                ]}
                placeholder=""
                fullWidth
              />
            </div>
            <div className="col-span-full flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={selectedIds.length === 0 || isBulkRunning}
                onClick={onBulkValidate}
                className="whitespace-nowrap rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Validate Selected
              </button>
              <button
                type="button"
                disabled={selectedIds.length === 0 || isBulkRunning}
                onClick={() => setShowPublishConfirm(true)}
                className="whitespace-nowrap rounded-md border border-input bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Publish Selected
              </button>
              <button
                type="button"
                disabled={selectedIds.length === 0 || isBulkRunning}
                onClick={() => setShowUnpublishConfirm(true)}
                className="whitespace-nowrap rounded-md border border-input bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Unpublish Selected
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <div>Selected: {selectedIds.length}</div>
            <div>
              {bulkProgress && isBulkRunning
                ? `Bulk progress: ${bulkProgress.completed}/${bulkProgress.total}`
                : '—'}
            </div>
            <div>Last refreshed: {data ? new Date().toLocaleTimeString() : '—'}</div>
          </div>
        </div>
      </div>

      {lastBulkOutcomes && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="p-5">
            <div className="text-sm font-medium text-foreground">Last bulk run</div>
            <div className="mt-2 text-xs text-muted-foreground">
              Success: {summarize(lastBulkOutcomes).success}, Blocked: {summarize(lastBulkOutcomes).blocked}, Failed: {summarize(lastBulkOutcomes).failed}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onRetryFailed}
                disabled={isBulkRunning || lastBulkOutcomes.every((o) => o.outcome !== 'failed')}
                className="rounded-lg border border-input bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Retry failed
              </button>
            </div>

            {lastBulkOutcomes.some((o) => o.outcome !== 'success') && (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-border" role="table">
                  <thead className="border-b">
                    <tr>
                      <th className="px-3 py-2 text-left text-sm font-medium text-muted-foreground">Blueprint</th>
                      <th className="px-3 py-2 text-left text-sm font-medium text-muted-foreground">Outcome</th>
                      <th className="px-3 py-2 text-left text-sm font-medium text-muted-foreground">Attempts</th>
                      <th className="px-3 py-2 text-left text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {lastBulkOutcomes
                      .filter((o) => o.outcome !== 'success')
                      .map((o) => (
                        <tr key={o.id}>
                          <td className="px-3 py-2 text-xs text-foreground">
                            <Link
                              href={`/curriculum/lesson-blueprints/${o.id}`}
                              className="hover:underline"
                            >
                              {labelById.get(o.id) || o.id}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-xs text-foreground">{o.outcome}</td>
                          <td className="px-3 py-2 text-xs text-foreground">{o.attempts}</td>
                          <td className="px-3 py-2 text-xs">
                            {o.outcome === 'blocked' && (
                              <button
                                type="button"
                                onClick={() => openBlockedValidation(o)}
                                className="rounded-lg border border-input bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50"
                              >
                                View validation
                              </button>
                            )}
                            {o.outcome === 'failed' && (
                              <span className="text-xs text-muted-foreground">{o.errorMessage || 'failed'}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        isOpen={blockedValidationOpen}
        onClose={() => setBlockedValidationOpen(false)}
        title="Blocked by validation"
        maxWidth="4xl"
      >
        <ValidationResultViewer validation={blockedValidation} />
      </Modal>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border" role="table">
            <thead className="border-b">
              <tr>
                <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleSelectAllOnPage}
                    aria-label="Select all on page"
                  />
                </th>
                <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Key</th>
                <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Enabled</th>
                <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Validation</th>
                <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Counts</th>
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
                    Failed to load lesson blueprints.
                  </td>
                </tr>
              )}
              {!isLoading && !isError && items.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={6}>
                    No lesson blueprints found.
                  </td>
                </tr>
              )}
              {items.map((bp) => (
                <tr key={bp.id}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedSet.has(bp.id)}
                      onChange={() => toggleSelect(bp.id)}
                      aria-label={`Select blueprint ${bp.blueprint_key}`}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    <Link
                      href={`/curriculum/lesson-blueprints/${bp.id}`}
                      className="hover:underline"
                    >
                      {bp.blueprint_key}
                    </Link>
                    <div className="mt-0.5 text-xs text-muted-foreground">{bp.lesson_kind}</div>
                    {(bp.target_language_code || bp.section_key) && (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {[bp.target_language_code?.toUpperCase(), bp.section_key].filter(Boolean).join(' • ')}
                      </div>
                    )}
                    <div className="mt-1">{reviewBadge(bp.review_status)}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <StatusBadge status={bp.status as any} />
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <StatusBadge status={bp.enabled ? 'active' : 'inactive'} />
                  </td>
                  <td className="px-4 py-3 text-sm">{validationBadge(bp.validation_status)}</td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {bp.blocking_error_count} errors, {bp.warning_count} warnings
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {pageStart} to {pageEnd} of {total} lesson blueprints
        </p>
        <div className="ml-auto">
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      </div>

      <ConfirmationModal
        isOpen={showPublishConfirm}
        onClose={() => setShowPublishConfirm(false)}
        onConfirm={onBulkPublishConfirmed}
        title="Publish selected lesson blueprints"
        message={`Publish ${selectedIds.length} selected blueprint(s)? This will re-run validation and may be blocked (409).`}
        confirmText="Publish"
        variant="warning"
        isLoading={isBulkRunning}
      />

      <ConfirmationModal
        isOpen={showUnpublishConfirm}
        onClose={() => setShowUnpublishConfirm(false)}
        onConfirm={onBulkUnpublishConfirmed}
        title="Unpublish selected lesson blueprints"
        message={`Unpublish ${selectedIds.length} selected blueprint(s)? This will archive and disable them.`}
        confirmText="Unpublish"
        variant="danger"
        isLoading={isBulkRunning}
      />
    </div>
  );
}

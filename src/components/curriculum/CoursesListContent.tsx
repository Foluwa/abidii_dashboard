'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import { CourseEditorModal } from '@/components/admin/curriculum/CourseEditorModal';
import Pagination from '@/components/tables/Pagination';
import StatusBadge from '@/components/admin/StatusBadge';
import ValidationResultViewer from '@/components/admin/curriculum/ValidationResultViewer';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import { Modal } from '@/components/ui/modal';
import { ConfirmationModal } from '@/components/ui/modal/ConfirmationModal';
import { useToast } from '@/contexts/ToastContext';
import { useAdminCoursesList } from '@/hooks/useApi';
import {
  createAdminCourse,
  deleteAdminCourse,
  publishAdminCourse,
  updateAdminCourse,
  unpublishAdminCourse,
  validateAdminCourse,
} from '@/lib/adminCurriculumApi';
import { logAdminCurriculumAction } from '@/lib/adminActionLog';
import { runBulkWithConcurrency, type BulkItemOutcome } from '@/lib/bulkRunner';
import type {
  CourseAdminResponse,
  CourseDraftUpsertRequest,
  CourseValidationResponse,
  ValidationResultPayload,
} from '@/types/curriculum';

type BulkOutcome = BulkItemOutcome<CourseValidationResponse>;

export function CoursesListContent({ showHeader = true }: { showHeader?: boolean }) {
  const router = useRouter();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [enabled, setEnabled] = useState<string>('');
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ completed: number; total: number } | null>(null);

  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [showUnpublishConfirm, setShowUnpublishConfirm] = useState(false);
  const [isCourseEditorOpen, setIsCourseEditorOpen] = useState(false);
  const [courseEditorMode, setCourseEditorMode] = useState<'create' | 'edit'>('create');
  const [editingCourse, setEditingCourse] = useState<CourseAdminResponse | null>(null);
  const [isCourseSaving, setIsCourseSaving] = useState(false);
  const [courseEditorError, setCourseEditorError] = useState('');
  const [pendingCourseActionId, setPendingCourseActionId] = useState<string | null>(null);
  const [archiveConfirmCourse, setArchiveConfirmCourse] = useState<CourseAdminResponse | null>(null);
  const [deleteConfirmCourse, setDeleteConfirmCourse] = useState<CourseAdminResponse | null>(null);

  const LS_OUTCOMES_KEY = 'adminCourses_lastBulkOutcomes';
  const LS_ACTION_KEY = 'adminCourses_lastBulkAction';

  const [lastBulkOutcomes, setLastBulkOutcomes] = useState<BulkOutcome[] | null>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(LS_OUTCOMES_KEY) : null;
      return raw ? (JSON.parse(raw) as BulkOutcome[]) : null;
    } catch {
      return null;
    }
  });
  const [lastBulkAction, setLastBulkAction] = useState<'validate' | 'publish' | 'unpublish' | null>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(LS_ACTION_KEY) : null;
      return (raw as 'validate' | 'publish' | 'unpublish') ?? null;
    } catch {
      return null;
    }
  });

  // Persist bulk run results across page refreshes
  useEffect(() => {
    try {
      if (lastBulkOutcomes != null) {
        localStorage.setItem(LS_OUTCOMES_KEY, JSON.stringify(lastBulkOutcomes));
      } else {
        localStorage.removeItem(LS_OUTCOMES_KEY);
      }
    } catch { /* storage unavailable */ }
  }, [lastBulkOutcomes]);

  useEffect(() => {
    try {
      if (lastBulkAction != null) {
        localStorage.setItem(LS_ACTION_KEY, lastBulkAction);
      } else {
        localStorage.removeItem(LS_ACTION_KEY);
      }
    } catch { /* storage unavailable */ }
  }, [lastBulkAction]);

  const [blockedValidationOpen, setBlockedValidationOpen] = useState(false);
  const [blockedValidation, setBlockedValidation] = useState<ValidationResultPayload | null>(null);

  const enabledFilter = enabled === '' ? undefined : enabled === 'true';
  const { data, isLoading, isError, refresh } = useAdminCoursesList({
    page,
    limit,
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
    items.forEach((c) => map.set(c.id, c.title));
    return map;
  }, [items]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allOnPageSelected = items.length > 0 && items.every((c) => selectedSet.has(c.id));

  const toggleSelect = (courseId: string) => {
    setSelectedIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  };

  const toggleSelectAllOnPage = () => {
    if (allOnPageSelected) {
      const idsOnPage = new Set(items.map((c) => c.id));
      setSelectedIds((prev) => prev.filter((id) => !idsOnPage.has(id)));
      return;
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      items.forEach((c) => next.add(c.id));
      return Array.from(next);
    });
  };

  const runBulk = async (
    action: 'validate' | 'publish' | 'unpublish',
    ids: string[]
  ): Promise<BulkOutcome[]> => {
    return await runBulkWithConcurrency<CourseValidationResponse>(
      ids,
      async (courseId) => {
        if (action === 'validate') {
          await validateAdminCourse(courseId);
          return { outcome: 'success' };
        }

        if (action === 'publish') {
          const result = await publishAdminCourse(courseId);
          if (!result.ok) {
            return { outcome: 'blocked', blockedBody: result.body };
          }
          return { outcome: 'success' };
        }

        await unpublishAdminCourse(courseId);
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

  const openCreateCourseModal = () => {
    setCourseEditorMode('create');
    setEditingCourse(null);
    setCourseEditorError('');
    setIsCourseEditorOpen(true);
  };

  const openEditCourseModal = (course: CourseAdminResponse) => {
    setCourseEditorMode('edit');
    setEditingCourse(course);
    setCourseEditorError('');
    setIsCourseEditorOpen(true);
  };

  const handleCourseEditorSubmit = async (payload: CourseDraftUpsertRequest) => {
    setIsCourseSaving(true);
    setCourseEditorError('');
    try {
      const result =
        courseEditorMode === 'create'
          ? await createAdminCourse(payload)
          : await updateAdminCourse(editingCourse!.id, payload);
      await refresh();
      setIsCourseEditorOpen(false);
      toast.success(courseEditorMode === 'create' ? 'Course created.' : 'Course updated.');
      router.push(`/curriculum/courses/${result.course.id}`);
    } catch (error: any) {
      const message =
        error?.response?.data?.detail || error?.message || 'Failed to save course.';
      setCourseEditorError(message);
      toast.error(message);
    } finally {
      setIsCourseSaving(false);
    }
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
        entity: 'course',
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
        entity: 'course',
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
        entity: 'course',
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

  const handleArchiveCourse = async (course: CourseAdminResponse) => {
    setPendingCourseActionId(course.id);
    try {
      await unpublishAdminCourse(course.id);
      await refresh();
      toast.success('Course archived.');
      setArchiveConfirmCourse(null);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || error?.message || 'Failed to archive course.');
    } finally {
      setPendingCourseActionId(null);
    }
  };

  const handleDeleteCourse = async (course: CourseAdminResponse) => {
    setPendingCourseActionId(course.id);
    try {
      await deleteAdminCourse(course.id);
      await refresh();
      toast.success('Course deleted.');
      setDeleteConfirmCourse(null);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || error?.message || 'Failed to delete course.');
    } finally {
      setPendingCourseActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        {showHeader ? <PageBreadCrumb pageTitle="Curriculum Courses" /> : <div />}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openCreateCourseModal}
            className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-brand-700"
          >
            New Course
          </button>
          <Link
            href="/curriculum/publishing"
            className="inline-flex items-center justify-center rounded-lg border border-input bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
          >
            Readiness Matrix
          </Link>
        </div>
      </div>

      {/* Filters + Actions */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Search</label>
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="course key or title"
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

      {/* Results summary */}
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
              <button
                type="button"
                disabled={isBulkRunning}
                onClick={() => {
                  setLastBulkOutcomes(null);
                  setLastBulkAction(null);
                }}
                className="rounded-lg border border-input bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear
              </button>
            </div>

            {lastBulkOutcomes.some((o) => o.outcome !== 'success') && (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-border" role="table">
                  <thead className="border-b">
                    <tr>
                      <th className="px-3 py-2 text-left text-sm font-medium text-muted-foreground">Course</th>
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
                              href={`/curriculum/courses/${o.id}`}
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

      {/* Table */}
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
                <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Course</th>
                <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Key</th>
                <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Enabled</th>
                <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Actions</th>
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
                    Failed to load courses.
                  </td>
                </tr>
              )}
              {!isLoading && !isError && items.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={6}>
                    No courses found.
                  </td>
                </tr>
              )}
              {items.map((course) => (
                <tr key={course.id}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedSet.has(course.id)}
                      onChange={() => toggleSelect(course.id)}
                      aria-label={`Select course ${course.title}`}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    <Link
                      href={`/curriculum/courses/${course.id}`}
                      className="hover:underline"
                    >
                      {course.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">{course.course_key}</td>
                  <td className="px-4 py-3 text-sm">
                    <StatusBadge status={course.status as any} />
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <StatusBadge status={course.enabled ? 'active' : 'inactive'} />
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEditCourseModal(course)}
                        className="rounded-lg border border-input bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setArchiveConfirmCourse(course)}
                        disabled={pendingCourseActionId === course.id}
                        className="rounded-lg border border-amber-300 bg-card px-3 py-2 text-xs font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-900 dark:text-amber-300 dark:hover:bg-amber-950/30"
                      >
                        Archive
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmCourse(course)}
                        disabled={pendingCourseActionId === course.id}
                        className="rounded-lg border border-red-300 bg-card px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {pageStart} to {pageEnd} of {total} courses
        </p>
        <div className="ml-auto">
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      </div>

      <ConfirmationModal
        isOpen={showPublishConfirm}
        onClose={() => setShowPublishConfirm(false)}
        onConfirm={onBulkPublishConfirmed}
        title="Publish selected courses"
        message={`Publish ${selectedIds.length} selected course(s)? This will re-run validation and may be blocked (409).`}
        confirmText="Publish"
        variant="warning"
        isLoading={isBulkRunning}
      />

      <ConfirmationModal
        isOpen={showUnpublishConfirm}
        onClose={() => setShowUnpublishConfirm(false)}
        onConfirm={onBulkUnpublishConfirmed}
        title="Unpublish selected courses"
        message={`Unpublish ${selectedIds.length} selected course(s)? This will archive and disable them.`}
        confirmText="Unpublish"
        variant="danger"
        isLoading={isBulkRunning}
      />

      <ConfirmationModal
        isOpen={Boolean(archiveConfirmCourse)}
        onClose={() => {
          if (!pendingCourseActionId) setArchiveConfirmCourse(null);
        }}
        onConfirm={() => {
          if (archiveConfirmCourse) void handleArchiveCourse(archiveConfirmCourse);
        }}
        title="Archive course"
        message={`Archive ${archiveConfirmCourse?.title ?? 'this course'}? This will unpublish and disable it.`}
        confirmText="Archive"
        variant="warning"
        isLoading={Boolean(pendingCourseActionId && archiveConfirmCourse?.id === pendingCourseActionId)}
      />

      <ConfirmationModal
        isOpen={Boolean(deleteConfirmCourse)}
        onClose={() => {
          if (!pendingCourseActionId) setDeleteConfirmCourse(null);
        }}
        onConfirm={() => {
          if (deleteConfirmCourse) void handleDeleteCourse(deleteConfirmCourse);
        }}
        title="Delete course"
        message={`Delete ${deleteConfirmCourse?.title ?? 'this course'}? The backend only allows deleting archived empty courses.`}
        confirmText="Delete"
        variant="danger"
        isLoading={Boolean(pendingCourseActionId && deleteConfirmCourse?.id === pendingCourseActionId)}
      />

      <CourseEditorModal
        key={`${courseEditorMode}:${editingCourse?.id ?? 'new'}:${isCourseEditorOpen ? 'open' : 'closed'}`}
        isOpen={isCourseEditorOpen}
        mode={courseEditorMode}
        course={editingCourse}
        isSaving={isCourseSaving}
        errorMessage={courseEditorError}
        onClose={() => {
          if (isCourseSaving) return;
          setIsCourseEditorOpen(false);
        }}
        onSubmit={handleCourseEditorSubmit}
      />
    </div>
  );
}

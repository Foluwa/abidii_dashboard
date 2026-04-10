'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import Alert from '@/components/ui/alert/SimpleAlert';
import Toast from '@/components/ui/toast/Toast';
import { ConfirmationModal } from '@/components/ui/modal/ConfirmationModal';
import StatusBadge from '@/components/admin/StatusBadge';

import ValidationResultViewer from '@/components/admin/curriculum/ValidationResultViewer';
import { LessonBlueprintEditor } from '@/components/admin/curriculum/LessonBlueprintEditor';
import { useAdminBlueprint, useAdminCourseValidationSummary, useCourseCurriculum, usePublicBlueprint } from '@/hooks/useApi';
import { useCurriculumManagement } from '@/hooks/useCurriculumManagement';
import {
  deleteAdminBlueprint,
  diffAdminBlueprintVersion,
  listAdminBlueprintVersions,
  restoreAdminBlueprintVersion,
} from '@/lib/adminCurriculumApi';
import type {
  CurriculumSection,
  CurriculumUnit,
  LessonBlueprintValidationResponse,
  LessonBlueprintVersionDiffPayload,
  LessonBlueprintVersionPayload,
  ValidationIssuePayload,
} from '@/types/curriculum';

function getLoadErrorMessage(error: any): string {
  if (error?.code === 'ECONNABORTED') {
    return 'The request timed out before the backend responded.';
  }
  if (error?.response?.status === 401 || error?.response?.status === 403) {
    return 'Authentication failed for this admin request. Check your session and token refresh flow.';
  }
  if (error?.response?.status === 404) {
    return 'This blueprint was not found in the backend database.';
  }
  return error?.response?.data?.detail || error?.message || 'Unknown API error';
}

function getActionErrorMessage(error: any, fallback: string): string {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') {
    return detail;
  }
  return error?.message || fallback;
}

function getStatusBadge(status: string | null | undefined) {
  if (status === 'published') return <StatusBadge status="published" />;
  if (status === 'needs_review') return <StatusBadge status="warning" label="Needs Review" />;
  if (status === 'draft') return <StatusBadge status="draft" />;
  if (status === 'archived') return <StatusBadge status="archived" />;
  return <StatusBadge status="info" label={status || 'Unknown'} />;
}

export default function AdminLessonBlueprintDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const router = useRouter();
  const resolvedParams =
    typeof (params as Promise<{ id: string }> & { then?: unknown })?.then === 'function'
      ? React.use(params as Promise<{ id: string }>)
      : (params as { id: string });
  const { id: blueprintId } = resolvedParams;

  const {
    data: adminData,
    isLoading: isLoadingAdmin,
    isError: adminError,
    refresh: refreshAdmin,
    mutate: mutateAdmin,
  } = useAdminBlueprint(blueprintId);

  const {
    blueprint: publicBlueprint,
    isLoading: isLoadingPublic,
    isError: publicError,
  } = usePublicBlueprint(blueprintId);

  const {
    validateBlueprint,
    publishBlueprint,
    unpublishBlueprint,
    isValidating,
    isPublishing,
    isUnpublishing,
    validateCourse,
    publishCourse,
  } = useCurriculumManagement();

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmPublishOpen, setConfirmPublishOpen] = useState(false);
  const [confirmUnpublishOpen, setConfirmUnpublishOpen] = useState(false);
  const [confirmPublishLinkedCourseOpen, setConfirmPublishLinkedCourseOpen] = useState(false);
  const [versionHistory, setVersionHistory] = useState<LessonBlueprintVersionPayload[]>([]);
  const [versionDiff, setVersionDiff] = useState<LessonBlueprintVersionDiffPayload | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isRestoringVersion, setIsRestoringVersion] = useState(false);
  const [isDeletingBlueprint, setIsDeletingBlueprint] = useState(false);
  const [focusFieldPath, setFocusFieldPath] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<LessonBlueprintValidationResponse | null>(null);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(true);

  const blueprint = adminData?.blueprint;
  const validation = adminData?.validation;
  const displayedValidation = previewResult?.validation ?? validation;

  const canPublish = !!validation?.can_publish;

  const {
    data: linkedCourseData,
    isLoading: isLoadingLinkedCourse,
    isError: linkedCourseError,
    mutate: mutateLinkedCourse,
    refresh: refreshLinkedCourse,
  } = useAdminCourseValidationSummary(blueprint?.course_id || null);

  const {
    curriculum: linkedCurriculum,
    isLoading: isLoadingLinkedCurriculum,
    isError: linkedCurriculumError,
    refresh: refreshLinkedCurriculum,
  } = useCourseCurriculum(blueprint?.course_id || null);

  const linkedCourse = linkedCourseData?.course;
  const linkedCourseValidation = linkedCourseData?.validation;

  const linkedSectionContext = useMemo<{
    unit: CurriculumUnit | null;
    section: CurriculumSection | null;
  }>(() => {
    if (!blueprint || !linkedCurriculum) {
      return { unit: null, section: null };
    }

    for (const unit of linkedCurriculum.units) {
      const section = unit.sections.find((entry) => entry.id === blueprint.section_id);
      if (section) {
        return { unit, section };
      }
    }

    return { unit: null, section: null };
  }, [blueprint, linkedCurriculum]);

  const linkedSectionPath = useMemo(() => {
    const unitKey = linkedSectionContext.unit?.unit_key || blueprint?.unit_key;
    const sectionKey = linkedSectionContext.section?.section_key || blueprint?.section_key;
    if (!unitKey || !sectionKey) return null;
    return `sections[${unitKey}.${sectionKey}]`;
  }, [blueprint?.section_key, blueprint?.unit_key, linkedSectionContext.section?.section_key, linkedSectionContext.unit?.unit_key]);

  const linkedSectionIssues = useMemo<ValidationIssuePayload[]>(() => {
    if (!linkedCourseValidation || !linkedSectionPath) return [];
    return linkedCourseValidation.errors.filter(
      (issue) => issue.path === linkedSectionPath || issue.path.startsWith(`${linkedSectionPath}.`)
    );
  }, [linkedCourseValidation, linkedSectionPath]);

  const linkedSectionMissingBlueprint = linkedSectionIssues.some(
    (issue) => issue.code === 'section_missing_blueprint'
  );
  const linkedCourseCanPublish = !!linkedCourseData?.can_publish_course;
  const linkedSectionHasPublishedBlueprint =
    !!linkedSectionContext.section?.lesson_blueprint_id &&
    (linkedSectionContext.section?.blueprint_status || '').toLowerCase() === 'published';
  const linkedCourseStatusBadge = getStatusBadge(linkedCourse?.status);

  const refreshVersionHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const items = await listAdminBlueprintVersions(blueprintId);
      setVersionHistory(items);
    } catch (err: any) {
      setErrorMessage(getActionErrorMessage(err, 'Failed to load blueprint history'));
    } finally {
      setIsLoadingHistory(false);
    }
  }, [blueprintId]);

  useEffect(() => {
    void refreshVersionHistory();
  }, [refreshVersionHistory]);

  const statusBadge = useMemo(() => {
    const status = blueprint?.status;
    if (!status) return <StatusBadge status="info" label="Unknown" />;
    if (status === 'published') return <StatusBadge status="published" />;
    if (status === 'draft') return <StatusBadge status="draft" />;
    if (status === 'archived') return <StatusBadge status="archived" />;
    return <StatusBadge status="info" label={status} />;
  }, [blueprint?.status]);

  const enabledBadge = blueprint?.enabled ? (
    <StatusBadge status="active" label="Enabled" />
  ) : (
    <StatusBadge status="inactive" label="Disabled" />
  );
  const reviewBadge =
    blueprint?.review_status === 'needs_review' ? (
      <StatusBadge status="warning" label="Needs Review" />
    ) : blueprint?.review_status === 'published' ? (
      <StatusBadge status="success" label="Published Live" />
    ) : (
      <StatusBadge status="draft" label="Draft Only" />
    );

  const availabilityBadge = publicBlueprint?.availability ? (
    <StatusBadge
      status={
        publicBlueprint.availability === 'available'
          ? 'success'
          : publicBlueprint.availability === 'coming_soon'
          ? 'pending'
          : 'inactive'
      }
      label={publicBlueprint.availability}
    />
  ) : (
    <StatusBadge
      status={publicError ? 'inactive' : 'info'}
      label={isLoadingPublic ? 'Loading…' : publicError ? 'Unavailable' : '—'}
    />
  );

  const handleValidate = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const next = await validateBlueprint(blueprintId);
      await mutateAdmin(next, { revalidate: false });
      setPreviewResult(next);
      setSuccessMessage('Validation completed.');
    } catch (err: any) {
      setErrorMessage(getActionErrorMessage(err, 'Failed to validate blueprint'));
    }
  };

  const refreshLinkedCourseState = async () => {
    if (!blueprint?.course_id) return null;

    const nextCourseValidation = await validateCourse(blueprint.course_id);
    await mutateLinkedCourse(nextCourseValidation, { revalidate: false });
    await refreshLinkedCurriculum();
    return nextCourseValidation;
  };

  const handlePublish = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const outcome = await publishBlueprint(blueprintId);
      await mutateAdmin(outcome.body, { revalidate: false });
      await refreshVersionHistory();

      if (outcome.ok) {
        if (blueprint?.course_id) {
          try {
            const nextCourseValidation = await refreshLinkedCourseState();
            if (nextCourseValidation?.can_publish_course) {
              setSuccessMessage('Blueprint published. Linked course revalidated and is now ready to publish.');
            } else {
              const remaining = nextCourseValidation?.validation?.blocking_error_count ?? 0;
              setSuccessMessage(
                `Blueprint published. Linked course revalidated; ${remaining} blocking issue${remaining === 1 ? '' : 's'} remain.`
              );
            }
          } catch (courseErr: any) {
            setSuccessMessage('Blueprint published.');
            setErrorMessage(getActionErrorMessage(courseErr, 'Linked course revalidation failed.'));
          }
        } else {
          setSuccessMessage('Blueprint published.');
        }
      } else {
        setErrorMessage('Publish blocked by server validation (409). Review issues below.');
      }
    } catch (err: any) {
      setErrorMessage(getActionErrorMessage(err, 'Failed to publish blueprint'));
    }
  };

  const handleUnpublish = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await unpublishBlueprint(blueprintId);
      setSuccessMessage('Blueprint unpublished (archived).');
      await refreshAdmin();
      await refreshVersionHistory();
    } catch (err: any) {
      setErrorMessage(getActionErrorMessage(err, 'Failed to unpublish blueprint'));
    }
  };

  const handleValidateLinkedCourse = async () => {
    if (!blueprint?.course_id) return;

    setErrorMessage('');
    setSuccessMessage('');
    try {
      const nextCourseValidation = await refreshLinkedCourseState();
      const remaining = nextCourseValidation?.validation?.blocking_error_count ?? 0;
      if (nextCourseValidation?.can_publish_course) {
        setSuccessMessage('Linked course validation completed. The course is now ready to publish.');
      } else {
        setSuccessMessage(
          `Linked course validation completed. ${remaining} blocking issue${remaining === 1 ? '' : 's'} remain.`
        );
      }
    } catch (err: any) {
      setErrorMessage(getActionErrorMessage(err, 'Failed to validate linked course'));
    }
  };

  const handlePublishLinkedCourse = async () => {
    if (!blueprint?.course_id) return;

    setErrorMessage('');
    setSuccessMessage('');
    try {
      const outcome = await publishCourse(blueprint.course_id);
      await mutateLinkedCourse(outcome.body, { revalidate: false });
      await refreshLinkedCurriculum();

      if (outcome.ok) {
        setSuccessMessage('Linked course published.');
      } else {
        setErrorMessage('Linked course publish blocked by server validation (409). Review remaining blockers.');
      }
    } catch (err: any) {
      setErrorMessage(getActionErrorMessage(err, 'Failed to publish linked course'));
    }
  };

  const handleLoadVersionDiff = async (versionId: string) => {
    setErrorMessage('');
    try {
      const diff = await diffAdminBlueprintVersion(blueprintId, versionId);
      setSelectedVersionId(versionId);
      setVersionDiff(diff);
    } catch (err: any) {
      setErrorMessage(getActionErrorMessage(err, 'Failed to load version diff'));
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!window.confirm('Restore this snapshot into the current draft? The blueprint will return to draft and require validation again.')) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsRestoringVersion(true);
    try {
      const next = await restoreAdminBlueprintVersion(blueprintId, versionId);
      await mutateAdmin(next, { revalidate: false });
      await refreshVersionHistory();
      setSuccessMessage('Blueprint restored from history.');
    } catch (err: any) {
      setErrorMessage(getActionErrorMessage(err, 'Failed to restore blueprint version'));
    } finally {
      setIsRestoringVersion(false);
    }
  };

  const handleDeleteBlueprint = async () => {
    if (!window.confirm('Delete this blueprint? Version history will be kept, but the live blueprint row will be removed.')) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsDeletingBlueprint(true);
    try {
      await deleteAdminBlueprint(blueprintId);
      router.push('/curriculum/lesson-blueprints');
    } catch (err: any) {
      setErrorMessage(getActionErrorMessage(err, 'Failed to delete blueprint'));
    } finally {
      setIsDeletingBlueprint(false);
    }
  };

  if (adminError) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="Lesson Blueprint" />
        <Alert variant="error">
          Failed to load blueprint details. {getLoadErrorMessage(adminError)}
        </Alert>
      </div>
    );
  }

  if (isLoadingAdmin || !adminData) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="Lesson Blueprint" />
        <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-brand-600 rounded-full animate-spin" />
          <span>Loading blueprint…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <PageBreadCrumb pageTitle="Lesson Blueprint" />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleValidate}
            disabled={isValidating || isPublishing || isUnpublishing}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-brand-500 dark:hover:bg-brand-600"
          >
            {isValidating ? 'Validating…' : 'Validate'}
          </button>

          <button
            onClick={() => setConfirmPublishOpen(true)}
            disabled={!canPublish || isValidating || isPublishing || isUnpublishing}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title={!canPublish ? 'Publish disabled: fix blocking errors first' : undefined}
          >
            {isPublishing ? 'Publishing…' : blueprint?.course_id ? 'Publish + Recheck Course' : 'Publish'}
          </button>

          <button
            onClick={() => setConfirmUnpublishOpen(true)}
            disabled={isValidating || isPublishing || isUnpublishing}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-700 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUnpublishing ? 'Unpublishing…' : 'Unpublish'}
          </button>

          <button
            onClick={handleDeleteBlueprint}
            disabled={isDeletingBlueprint || blueprint?.status === 'published'}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title={blueprint?.status === 'published' ? 'Unpublish before deleting' : undefined}
          >
            {isDeletingBlueprint ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      <details className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
          <div className="flex items-center justify-between gap-3">
            <span>Server-authoritative validation and publishing workflow</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Show details</span>
          </div>
        </summary>
        <div className="border-t border-gray-200 px-4 py-3 dark:border-gray-800">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Validate first, then publish. The server is the source of truth for publishability, availability, and linked-course readiness. Publishing this blueprint can also trigger linked-course revalidation so remaining blockers are visible immediately on this page.
          </div>
          <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Details</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-gray-600 dark:text-gray-400">Blueprint Key</dt>
                  <dd className="text-gray-900 dark:text-white font-mono break-all">{blueprint?.blueprint_key}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-gray-600 dark:text-gray-400">Lesson Kind</dt>
                  <dd className="text-gray-900 dark:text-white">{blueprint?.lesson_kind}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-gray-600 dark:text-gray-400">Schema Version</dt>
                  <dd className="text-gray-900 dark:text-white">{blueprint?.schema_version}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-gray-600 dark:text-gray-400">Status</dt>
                  <dd>{statusBadge}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-gray-600 dark:text-gray-400">Review state</dt>
                  <dd>{reviewBadge}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-gray-600 dark:text-gray-400">Enabled</dt>
                  <dd>{enabledBadge}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-gray-600 dark:text-gray-400">Availability</dt>
                  <dd>{availabilityBadge}</dd>
                </div>
              </dl>
              {isLoadingPublic && (
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Loading availability…</p>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">IDs</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-gray-600 dark:text-gray-400">Blueprint ID</dt>
                  <dd className="text-gray-900 dark:text-white font-mono break-all">{blueprint?.id}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-gray-600 dark:text-gray-400">Course ID</dt>
                  <dd className="text-gray-900 dark:text-white font-mono break-all">{blueprint?.course_id}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-gray-600 dark:text-gray-400">Section ID</dt>
                  <dd className="text-gray-900 dark:text-white font-mono break-all">{blueprint?.section_id}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </details>

      {successMessage && (
        <Toast type="success" message={successMessage} onClose={() => setSuccessMessage('')} />
      )}
      {errorMessage && (
        <Toast type="error" message={errorMessage} onClose={() => setErrorMessage('')} />
      )}
      {publicError && (
        <Alert variant="warning">
          Public blueprint lookup failed. Admin editing still works, but public availability data could not be loaded.
        </Alert>
      )}
      {(linkedCourseError || linkedCurriculumError) && (
        <Alert variant="warning">
          Linked course context could not be fully loaded. Blueprint editing still works, but course unblock guidance is incomplete.
        </Alert>
      )}

      {blueprint && (
        <details className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Linked Course Flow</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Publish this blueprint, revalidate the linked course, and finish the unblock flow without leaving this page.
              </p>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">Show details</span>
          </summary>
          <div className="border-t border-gray-200 p-4 dark:border-gray-800">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Unblock linked course publication</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Run the publish workflow here when this blueprint is the section-level blocker.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {blueprint.course_id && (
                <button
                  onClick={handleValidateLinkedCourse}
                  disabled={isValidating || isPublishing || isUnpublishing}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  {isValidating ? 'Validating…' : 'Revalidate Linked Course'}
                </button>
              )}
              {blueprint.course_id && linkedCourseCanPublish && (
                <button
                  onClick={() => setConfirmPublishLinkedCourseOpen(true)}
                  disabled={isValidating || isPublishing || isUnpublishing}
                  className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPublishing ? 'Publishing…' : 'Publish Linked Course'}
                </button>
              )}
              {blueprint.course_id && (
                <Link
                  href={`/curriculum/courses/${blueprint.course_id}`}
                  className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 dark:border-brand-900 dark:bg-brand-950/20 dark:text-brand-300 dark:hover:bg-brand-950/40"
                >
                  Open Linked Course
                </Link>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Course & Section</h3>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-gray-600 dark:text-gray-400">Course</dt>
                  <dd className="text-right text-gray-900 dark:text-white">
                    {linkedCourse?.title || blueprint.course_key || 'Unknown course'}
                    {(linkedCourse?.course_key || blueprint.course_key) && (
                      <div className="font-mono text-xs text-gray-500 dark:text-gray-400">
                        {linkedCourse?.course_key || blueprint.course_key}
                      </div>
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-gray-600 dark:text-gray-400">Unit / Section</dt>
                  <dd className="text-right text-gray-900 dark:text-white">
                    {(linkedSectionContext.unit?.title || blueprint.unit_key || 'Unknown unit') +
                      ' / ' +
                      (linkedSectionContext.section?.title || blueprint.section_key || 'Unknown section')}
                    <div className="font-mono text-xs text-gray-500 dark:text-gray-400">
                      {(linkedSectionContext.unit?.unit_key || blueprint.unit_key || '—')}.
                      {linkedSectionContext.section?.section_key || blueprint.section_key || '—'}
                    </div>
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="pt-1 text-gray-600 dark:text-gray-400">Section state</dt>
                  <dd className="flex flex-wrap justify-end gap-2">
                    {getStatusBadge(linkedSectionContext.section?.status || null)}
                    {typeof linkedSectionContext.section?.enabled === 'boolean' &&
                      (linkedSectionContext.section.enabled ? (
                        <StatusBadge status="active" label="Enabled" />
                      ) : (
                        <StatusBadge status="inactive" label="Disabled" />
                      ))}
                    {linkedSectionContext.section?.availability && (
                      <StatusBadge
                        status={
                          linkedSectionContext.section.availability === 'available'
                            ? 'success'
                            : linkedSectionContext.section.availability === 'coming_soon'
                            ? 'pending'
                            : 'inactive'
                        }
                        label={linkedSectionContext.section.availability}
                      />
                    )}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="pt-1 text-gray-600 dark:text-gray-400">Blueprint state</dt>
                  <dd className="flex flex-wrap justify-end gap-2">
                    {linkedSectionContext.section?.lesson_blueprint_id ? (
                      <>
                        <StatusBadge
                          status={linkedSectionHasPublishedBlueprint ? 'success' : 'warning'}
                          label={linkedSectionContext.section.blueprint_status || 'Blueprint'}
                        />
                        {typeof linkedSectionContext.section.blueprint_enabled === 'boolean' && (
                          <StatusBadge
                            status={linkedSectionContext.section.blueprint_enabled ? 'active' : 'inactive'}
                            label={linkedSectionContext.section.blueprint_enabled ? 'Enabled' : 'Disabled'}
                          />
                        )}
                      </>
                    ) : (
                      <StatusBadge status="warning" label="No blueprint" />
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Course Publish Readiness</h3>
              {isLoadingLinkedCourse || isLoadingLinkedCurriculum ? (
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">Loading linked course status…</p>
              ) : (
                <div className="mt-3 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-600 dark:text-gray-400">Course status</span>
                    <span>{linkedCourseStatusBadge}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-600 dark:text-gray-400">Validation</span>
                    <span>
                      {linkedCourseValidation?.status === 'valid' ? (
                        <StatusBadge status="success" label="Valid" />
                      ) : linkedCourseValidation?.status === 'invalid' ? (
                        <StatusBadge status="error" label="Invalid" />
                      ) : (
                        <StatusBadge status="info" label="Unknown" />
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-600 dark:text-gray-400">Publishability</span>
                    <span>
                      {linkedCourseCanPublish ? (
                        <StatusBadge status="success" label="Ready to publish" />
                      ) : (
                        <StatusBadge status="warning" label="Blocked" />
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-600 dark:text-gray-400">Blocking errors</span>
                    <span className="text-gray-900 dark:text-white">
                      {linkedCourseValidation?.blocking_error_count ?? '—'}
                    </span>
                  </div>

                  {linkedSectionMissingBlueprint && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
                      This linked section is currently blocked because it has no published blueprint. Publishing a valid blueprint here clears that specific course blocker.
                    </div>
                  )}

                  {!linkedSectionMissingBlueprint && linkedCourseCanPublish && blueprint.status === 'published' && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200">
                      This blueprint is already published and the linked course is ready to publish from this page.
                    </div>
                  )}

                  {!linkedSectionMissingBlueprint &&
                    !linkedCourseCanPublish &&
                    blueprint.status === 'published' &&
                    (linkedCourseValidation?.blocking_error_count ?? 0) > 0 && (
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-200">
                        This blueprint is published, but the linked course still has other blocking issues outside this section.
                      </div>
                    )}

                  {linkedSectionIssues.length > 0 && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Issues touching this section
                      </div>
                      <div className="mt-2 space-y-2">
                        {linkedSectionIssues.map((issue, index) => (
                          <div key={`${issue.code}-${issue.path}-${index}`}>
                            <div className="text-xs font-semibold text-gray-900 dark:text-white">{issue.code}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">{issue.message}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          </div>
        </details>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Preview Result</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Validation is computed against the current draft payload before publish.
          </p>
        </div>
        <ValidationResultViewer
          validation={displayedValidation}
          onJumpToPath={(path) => {
            setFocusFieldPath(null);
            window.requestAnimationFrame(() => setFocusFieldPath(path));
            document.getElementById('blueprint-editor-root')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <button
            type="button"
            onClick={() => setIsVersionHistoryOpen((current) => !current)}
            className="flex w-full items-start justify-between gap-4 text-left"
          >
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Version History</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Snapshot history used for restore, compare, and restore workflows.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {isLoadingHistory && (
                <span className="text-sm text-gray-500 dark:text-gray-400">Loading…</span>
              )}
              <span className="text-lg leading-none text-gray-500 dark:text-gray-400">
                {isVersionHistoryOpen ? '−' : '+'}
              </span>
            </div>
          </button>

          {isVersionHistoryOpen && (
            <div className="mt-4 grid h-[640px] min-h-0 gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
              {versionHistory.length === 0 ? (
                <div className="text-sm text-gray-600 dark:text-gray-400">No history snapshots found yet.</div>
              ) : (
                <>
                  <div className="flex min-h-0 flex-col rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">Snapshot History</div>
                      <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        Snapshot history used for restore, compare, and restore workflows.
                      </div>
                    </div>
                    <div className="mt-4 min-h-0 space-y-2 overflow-y-auto pr-1">
                      {versionHistory.map((version) => (
                        <div
                          key={version.id}
                          className={`rounded-lg border p-3 ${
                            selectedVersionId === version.id
                              ? 'border-brand-300 bg-brand-50 dark:border-brand-800 dark:bg-brand-950/20'
                              : 'border-gray-200 dark:border-gray-800'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                v{version.version_number} • {version.event_type}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(version.created_at).toLocaleString()}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => handleLoadVersionDiff(version.id)}
                                className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                              >
                                Compare
                              </button>
                              <button
                                onClick={() => handleRestoreVersion(version.id)}
                                disabled={isRestoringVersion}
                                className="rounded-lg border border-brand-300 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-950/30"
                              >
                                Restore
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="min-h-0 overflow-hidden rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                    <div className="mb-4">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">Compare Snapshot</div>
                      <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        Select a snapshot to compare it against the current blueprint.
                      </div>
                    </div>
                    {!versionDiff ? (
                      <div className="text-sm text-gray-600 dark:text-gray-400">No snapshot selected yet.</div>
                    ) : (
                      <div className="flex h-full min-h-0 flex-col space-y-4">
                        <div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">Changed Fields</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {versionDiff.changed_fields.length === 0 ? (
                              <StatusBadge status="info" label="No changes" />
                            ) : (
                              versionDiff.changed_fields.map((field) => (
                                <StatusBadge key={field} status="info" label={field} />
                              ))
                            )}
                          </div>
                        </div>
                        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-2">
                          <div className="min-h-0">
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                              Snapshot
                            </div>
                            <pre className="h-[180px] overflow-auto rounded-lg bg-gray-950 p-3 text-xs text-gray-100">
                              {JSON.stringify(versionDiff.left_snapshot, null, 2)}
                            </pre>
                          </div>
                          <div className="min-h-0">
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                              Current
                            </div>
                            <pre className="h-[180px] overflow-auto rounded-lg bg-gray-950 p-3 text-xs text-gray-100">
                              {JSON.stringify(versionDiff.right_snapshot, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
      </div>

      <LessonBlueprintEditor
        mode="edit"
        blueprint={blueprint}
        onPreviewResultChange={setPreviewResult}
        showPreviewResult={false}
        focusFieldPath={focusFieldPath}
        onSaved={(result) => {
          void mutateAdmin(result, { revalidate: false });
          void refreshVersionHistory();
          setPreviewResult(result);
          if (result.blueprint.id !== blueprintId) {
            router.push(`/curriculum/lesson-blueprints/${result.blueprint.id}`);
          }
          setFocusFieldPath(null);
        }}
      />

      <ConfirmationModal
        isOpen={confirmPublishOpen}
        onClose={() => setConfirmPublishOpen(false)}
        onConfirm={async () => {
          await handlePublish();
          setConfirmPublishOpen(false);
        }}
        title="Publish lesson blueprint"
        message={
          blueprint?.course_id
            ? 'Publishing will re-run blueprint validation and then revalidate the linked course so you can finish the unblock flow here.'
            : 'Publishing is server-authoritative and will re-run validation. Continue?'
        }
        confirmText={blueprint?.course_id ? 'Publish and Recheck Course' : 'Publish'}
        cancelText="Cancel"
        variant="warning"
        isLoading={isPublishing}
      />

      <ConfirmationModal
        isOpen={confirmUnpublishOpen}
        onClose={() => setConfirmUnpublishOpen(false)}
        onConfirm={async () => {
          await handleUnpublish();
          setConfirmUnpublishOpen(false);
        }}
        title="Unpublish lesson blueprint"
        message="Unpublishing archives the blueprint and disables it. Continue?"
        confirmText="Unpublish"
        cancelText="Cancel"
        variant="danger"
        isLoading={isUnpublishing}
      />

      <ConfirmationModal
        isOpen={confirmPublishLinkedCourseOpen}
        onClose={() => setConfirmPublishLinkedCourseOpen(false)}
        onConfirm={async () => {
          await handlePublishLinkedCourse();
          setConfirmPublishLinkedCourseOpen(false);
        }}
        title="Publish linked course"
        message="The linked course currently passes validation. Publish it now from this blueprint workflow?"
        confirmText="Publish Course"
        cancelText="Cancel"
        variant="warning"
        isLoading={isPublishing}
      />
    </div>
  );
}

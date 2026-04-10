'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import Alert from '@/components/ui/alert/SimpleAlert';
import Toast from '@/components/ui/toast/Toast';
import { ConfirmationModal } from '@/components/ui/modal/ConfirmationModal';
import StatusBadge from '@/components/admin/StatusBadge';
import { CourseEditorModal } from '@/components/admin/curriculum/CourseEditorModal';

import ValidationResultViewer from '@/components/admin/curriculum/ValidationResultViewer';
import { useAdminCourse, useCourseCurriculum } from '@/hooks/useApi';
import { useCurriculumManagement } from '@/hooks/useCurriculumManagement';
import {
  deleteAdminCourse,
  markSectionsComingSoon,
  updateAdminCourse,
  updateCourseQaCheck,
} from '@/lib/adminCurriculumApi';
import type {
  CourseDraftUpsertRequest,
  CurriculumQaCheck,
  CurriculumSection,
  CurriculumUnit,
} from '@/types/curriculum';

type SectionPublishRow = {
  unit: CurriculumUnit;
  section: CurriculumSection;
  hasPublishedBlueprint: boolean;
  hasDraftOrArchivedBlueprint: boolean;
  isExplicitComingSoon: boolean;
  blocksPublish: boolean;
};

function formatCourseActionError(err: any): string {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') {
    return detail;
  }
  if (detail?.error === 'sections_have_published_blueprints') {
    return 'One or more selected sections already have published blueprints. Open the blueprint instead of marking those sections as coming soon.';
  }
  if (detail?.error === 'unknown_section_ids') {
    return 'One or more sections no longer exist in this course. Refresh and try again.';
  }
  return err?.message || 'Request failed';
}

function getStatusBadge(status: string) {
  if (status === 'published') return <StatusBadge status="published" />;
  if (status === 'draft') return <StatusBadge status="draft" />;
  if (status === 'archived') return <StatusBadge status="archived" />;
  return <StatusBadge status="info" label={status || 'Unknown'} />;
}

function getQaStatusBadge(status: string) {
  if (status === 'verified') return <StatusBadge status="success" label="Verified" />;
  if (status === 'ready_to_test') return <StatusBadge status="active" label="Ready to test" />;
  if (status === 'partially_testable') return <StatusBadge status="warning" label="Partially testable" />;
  if (status === 'passed') return <StatusBadge status="success" label="Passed" />;
  if (status === 'pending_manual') return <StatusBadge status="pending" label="Pending manual" />;
  if (status === 'not_applicable') return <StatusBadge status="info" label="N/A" />;
  if (status === 'blocked') return <StatusBadge status="error" label="Blocked" />;
  return <StatusBadge status="info" label={status || 'Unknown'} />;
}

export default function AdminCourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = React.use(params);

  const {
    data: adminData,
    isLoading: isLoadingAdmin,
    isError: adminError,
    refresh: refreshAdmin,
    mutate: mutateAdmin,
  } = useAdminCourse(courseId);

  const {
    curriculum,
    isLoading: isLoadingCurriculum,
    isError: curriculumError,
    refresh: refreshCurriculum,
  } = useCourseCurriculum(courseId);

  const {
    validateCourse,
    publishCourse,
    unpublishCourse,
    isValidating,
    isPublishing,
    isUnpublishing,
  } = useCurriculumManagement();

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmPublishOpen, setConfirmPublishOpen] = useState(false);
  const [confirmUnpublishOpen, setConfirmUnpublishOpen] = useState(false);
  const [pendingSectionIds, setPendingSectionIds] = useState<string[]>([]);
  const [isBulkMarkingComingSoon, setIsBulkMarkingComingSoon] = useState(false);
  const [qaDrafts, setQaDrafts] = useState<Record<string, { notes: string; build_version: string }>>({});
  const [pendingQaKey, setPendingQaKey] = useState<string | null>(null);
  const [isCourseEditorOpen, setIsCourseEditorOpen] = useState(false);
  const [isCourseSaving, setIsCourseSaving] = useState(false);
  const [courseEditorError, setCourseEditorError] = useState('');
  const [isDeletingCourse, setIsDeletingCourse] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const course = adminData?.course;
  const validation = adminData?.validation;
  const qaChecks = useMemo(() => adminData?.qa_checks ?? [], [adminData]);
  const manualQaChecks = qaChecks.filter((check) => check.source === 'manual');
  const canPublish = !!adminData?.can_publish_course;
  const qaDraftSignature = useMemo(
    () =>
      JSON.stringify(
        qaChecks.map((check) => ({
          key: check.key,
          notes: check.notes || '',
          build_version: check.build_version || '',
        }))
      ),
    [qaChecks]
  );

  useEffect(() => {
    const nextDrafts: Record<string, { notes: string; build_version: string }> = {};
    qaChecks.forEach((check) => {
      nextDrafts[check.key] = {
        notes: check.notes || '',
        build_version: check.build_version || '',
      };
    });

    setQaDrafts((current) => {
      const currentSignature = JSON.stringify(current);
      const nextSignature = JSON.stringify(nextDrafts);
      if (currentSignature === nextSignature) {
        return current;
      }
      return nextDrafts;
    });
  }, [qaChecks, qaDraftSignature]);
  const sectionRows = useMemo<SectionPublishRow[]>(() => {
    if (!curriculum) return [];

    return curriculum.units.flatMap((unit) =>
      unit.sections.map((section) => {
        const blueprintStatus = (section.blueprint_status || '').toLowerCase();
        const hasPublishedBlueprint = !!section.lesson_blueprint_id && blueprintStatus === 'published';
        const hasDraftOrArchivedBlueprint = !!section.lesson_blueprint_id && blueprintStatus !== 'published';
        const isExplicitComingSoon = !hasPublishedBlueprint && section.status === 'published' && !section.enabled;

        return {
          unit,
          section,
          hasPublishedBlueprint,
          hasDraftOrArchivedBlueprint,
          isExplicitComingSoon,
          blocksPublish: !hasPublishedBlueprint && !isExplicitComingSoon,
        };
      })
    );
  }, [curriculum]);

  const blockingSections = useMemo(
    () => sectionRows.filter((row) => row.blocksPublish),
    [sectionRows]
  );

  const statusBadge = useMemo(() => {
    const status = course?.status;
    if (!status) return <StatusBadge status="info" label="Unknown" />;
    if (status === 'published') return <StatusBadge status="published" />;
    if (status === 'draft') return <StatusBadge status="draft" />;
    if (status === 'archived') return <StatusBadge status="archived" />;
    return <StatusBadge status="info" label={status} />;
  }, [course?.status]);

  const enabledBadge = course?.enabled ? (
    <StatusBadge status="active" label="Enabled" />
  ) : (
    <StatusBadge status="inactive" label="Disabled" />
  );

  const availabilityBadge = curriculum?.availability ? (
    <StatusBadge
      status={
        curriculum.availability === 'available'
          ? 'success'
          : curriculum.availability === 'coming_soon'
          ? 'pending'
          : 'inactive'
      }
      label={curriculum.availability}
    />
  ) : (
    <StatusBadge status="info" label={isLoadingCurriculum ? 'Loading…' : '—'} />
  );

  const handleValidate = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const next = await validateCourse(courseId);
      await mutateAdmin(next, { revalidate: false });
      setSuccessMessage('Course validation completed.');
    } catch (err: any) {
      setErrorMessage(formatCourseActionError(err) || 'Failed to validate course');
    }
  };

  const handleMarkSectionsComingSoon = async (sectionIds: string[]) => {
    if (!course?.course_key || sectionIds.length === 0) return;

    setErrorMessage('');
    setSuccessMessage('');
    setPendingSectionIds(sectionIds);
    setIsBulkMarkingComingSoon(sectionIds.length > 1);

    try {
      await markSectionsComingSoon(course.course_key, sectionIds);
      await refreshCurriculum();
      const next = await validateCourse(courseId);
      await mutateAdmin(next, { revalidate: false });
      setSuccessMessage(
        sectionIds.length === 1
          ? 'Section marked as coming soon.'
          : `${sectionIds.length} sections marked as coming soon.`
      );
    } catch (err: any) {
      setErrorMessage(formatCourseActionError(err));
    } finally {
      setPendingSectionIds([]);
      setIsBulkMarkingComingSoon(false);
    }
  };

  const handleQaUpdate = async (check: CurriculumQaCheck, status: CurriculumQaCheck['status']) => {
    setErrorMessage('');
    setSuccessMessage('');
    setPendingQaKey(check.key);

    try {
      const draft = qaDrafts[check.key] || { notes: '', build_version: '' };
      const next = await updateCourseQaCheck(courseId, check.key, {
        status,
        notes: draft.notes || null,
        build_version: draft.build_version || null,
      });
      await mutateAdmin(next, { revalidate: false });
      setSuccessMessage(`${check.label} updated.`);
    } catch (err: any) {
      setErrorMessage(formatCourseActionError(err) || 'Failed to update QA check');
    } finally {
      setPendingQaKey(null);
    }
  };

  const handlePublish = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const outcome = await publishCourse(courseId);
      await mutateAdmin(outcome.body, { revalidate: false });

      if (outcome.ok) {
        setSuccessMessage('Course published.');
      } else {
        setErrorMessage('Publish blocked by server validation (409). Review issues below.');
      }
    } catch (err: any) {
      setErrorMessage(formatCourseActionError(err) || 'Failed to publish course');
    }
  };

  const handleUnpublish = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await unpublishCourse(courseId);
      setSuccessMessage('Course unpublished (archived).');
      await refreshAdmin();
    } catch (err: any) {
      setErrorMessage(formatCourseActionError(err) || 'Failed to unpublish course');
    }
  };

  const handleCourseSave = async (payload: CourseDraftUpsertRequest) => {
    setIsCourseSaving(true);
    setCourseEditorError('');
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const next = await updateAdminCourse(courseId, payload);
      await mutateAdmin(next, { revalidate: false });
      setIsCourseEditorOpen(false);
      setSuccessMessage('Course metadata updated.');
    } catch (err: any) {
      const message = formatCourseActionError(err) || 'Failed to update course';
      setCourseEditorError(message);
      setErrorMessage(message);
    } finally {
      setIsCourseSaving(false);
    }
  };

  const handleDeleteCourse = async () => {
    setIsDeletingCourse(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await deleteAdminCourse(courseId);
      setSuccessMessage('Course deleted.');
      if (typeof window !== 'undefined') {
        window.location.assign('/curriculum/courses');
      }
    } catch (err: any) {
      setErrorMessage(formatCourseActionError(err) || 'Failed to delete course');
    } finally {
      setIsDeletingCourse(false);
    }
  };

  if (adminError || curriculumError) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="Course" />
        <Alert variant="error">
          Failed to load course details. Please check your API connection.
        </Alert>
      </div>
    );
  }

  if (isLoadingAdmin || !adminData) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="Course" />
        <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-brand-600 rounded-full animate-spin" />
          <span>Loading course…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <PageBreadCrumb pageTitle="Course" />
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Course validation and publishing (server-authoritative)
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setIsCourseEditorOpen(true)}
            disabled={isValidating || isPublishing || isUnpublishing || isCourseSaving}
            className="px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-white/[0.03]"
          >
            Edit Course
          </button>
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
            {isPublishing ? 'Publishing…' : 'Publish'}
          </button>

          <button
            onClick={() => setConfirmUnpublishOpen(true)}
            disabled={isValidating || isPublishing || isUnpublishing}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-700 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUnpublishing ? 'Unpublishing…' : 'Unpublish'}
          </button>
          <button
            onClick={() => setConfirmDeleteOpen(true)}
            disabled={isValidating || isPublishing || isUnpublishing || isDeletingCourse}
            className="px-4 py-2 text-sm font-medium text-white bg-red-700 rounded-lg hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeletingCourse ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      {successMessage && (
        <Toast type="success" message={successMessage} onClose={() => setSuccessMessage('')} />
      )}
      {errorMessage && (
        <Toast type="error" message={errorMessage} onClose={() => setErrorMessage('')} />
      )}

      {course?.status === 'published' && validation?.status === 'invalid' && (
        <Alert variant="warning">
          This course is still marked as published in the database, but it no longer passes current publish rules.
          Fix the blocked sections below, then validate again before republishing.
        </Alert>
      )}

      {validation?.can_publish && !canPublish && (
        <Alert variant="warning">
          Server validation passes, but publish is still blocked until the required manual QA checks are signed off below.
        </Alert>
      )}

      {blockingSections.length > 0 && course && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Publish Blockers</h2>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                {blockingSections.length} section{blockingSections.length === 1 ? '' : 's'} cannot publish because
                there is no published blueprint and the section is not explicitly configured as coming soon.
              </p>
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                Fast rule: either publish a blueprint for the section, or mark the section as coming soon
                (`published` + `disabled`).
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={`/curriculum/editor?courseKey=${encodeURIComponent(course.course_key)}`}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Open Curriculum Editor
              </Link>
              <button
                onClick={() => handleMarkSectionsComingSoon(blockingSections.map((row) => row.section.id))}
                disabled={isBulkMarkingComingSoon || pendingSectionIds.length > 0}
                className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isBulkMarkingComingSoon ? 'Marking…' : `Mark All ${blockingSections.length} as Coming Soon`}
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {blockingSections.map((row) => {
              const isPending = pendingSectionIds.includes(row.section.id);
              const blueprintHref = row.section.lesson_blueprint_id
                ? `/curriculum/lesson-blueprints/${row.section.lesson_blueprint_id}`
                : `/curriculum/lesson-blueprints/new?courseKey=${encodeURIComponent(course.course_key)}&sectionId=${encodeURIComponent(row.section.id)}`;

              return (
                <div
                  key={row.section.id}
                  className="rounded-lg border border-amber-200 bg-white p-3 dark:border-amber-900/60 dark:bg-gray-900"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {row.unit.title} / {row.section.title}
                      </div>
                      <div className="mt-1 text-xs font-mono text-gray-600 dark:text-gray-400">
                        {row.unit.unit_key}.{row.section.section_key}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {getStatusBadge(row.section.status)}
                        {row.section.enabled ? (
                          <StatusBadge status="active" label="Enabled" />
                        ) : (
                          <StatusBadge status="inactive" label="Disabled" />
                        )}
                        {row.section.lesson_blueprint_id ? (
                          <StatusBadge
                            status={row.hasPublishedBlueprint ? 'success' : 'warning'}
                            label={row.section.blueprint_status || 'Blueprint'}
                          />
                        ) : (
                          <StatusBadge status="warning" label="No blueprint" />
                        )}
                      </div>
                      <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                        {row.hasDraftOrArchivedBlueprint
                          ? 'A blueprint exists, but it is not published yet.'
                          : 'This section does not have any published blueprint yet.'}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={blueprintHref}
                        className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 dark:border-brand-900 dark:bg-brand-950/20 dark:text-brand-300 dark:hover:bg-brand-950/40"
                      >
                        {row.section.lesson_blueprint_id ? 'Open Blueprint' : 'Create Blueprint'}
                      </Link>
                      <button
                        onClick={() => handleMarkSectionsComingSoon([row.section.id])}
                        disabled={isPending || pendingSectionIds.length > 0}
                        className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-900 dark:bg-gray-900 dark:text-amber-300 dark:hover:bg-amber-950/30"
                      >
                        {isPending ? 'Saving…' : 'Mark Coming Soon'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Course summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-4 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Details</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-gray-600 dark:text-gray-400">Course Key</dt>
              <dd className="text-gray-900 dark:text-white font-mono break-all">{course?.course_key}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-gray-600 dark:text-gray-400">Title</dt>
              <dd className="text-gray-900 dark:text-white">{course?.title}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-gray-600 dark:text-gray-400">Status</dt>
              <dd>{statusBadge}</dd>
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
          {isLoadingCurriculum && (
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Loading curriculum overview…</p>
          )}
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">IDs</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-gray-600 dark:text-gray-400">Course ID</dt>
              <dd className="text-gray-900 dark:text-white font-mono break-all">{course?.id}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Manual QA Workflow</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Persistent publish signoff for device verification. Publish now requires both server validation and these manual checks.
            </p>
          </div>
          {adminData?.qa_status && getQaStatusBadge(adminData.qa_status)}
        </div>

        {manualQaChecks.length === 0 ? (
          <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            No manual QA checks are currently defined for this course.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {manualQaChecks.map((check) => {
              const draft = qaDrafts[check.key] || { notes: '', build_version: '' };
              const disabled = pendingQaKey === check.key || check.status === 'blocked';

              return (
                <div
                  key={check.key}
                  className="rounded-lg border border-gray-200 p-3 dark:border-gray-800"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">
                          {check.label}
                        </div>
                        {getQaStatusBadge(check.status)}
                      </div>
                      <div className="mt-1 text-xs font-mono text-gray-500 dark:text-gray-400">
                        {check.key}
                      </div>
                      {check.detail && (
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{check.detail}</p>
                      )}
                      {check.verified_at && (
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          Verified at {new Date(check.verified_at).toLocaleString()}
                          {check.verified_by ? ` by ${check.verified_by}` : ''}
                        </p>
                      )}
                    </div>

                    <div className="grid min-w-[280px] gap-2">
                      <input
                        value={draft.build_version}
                        onChange={(e) =>
                          setQaDrafts((prev) => ({
                            ...prev,
                            [check.key]: {
                              ...draft,
                              build_version: e.target.value,
                            },
                          }))
                        }
                        placeholder="Build / device label"
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                      />
                      <textarea
                        value={draft.notes}
                        onChange={(e) =>
                          setQaDrafts((prev) => ({
                            ...prev,
                            [check.key]: {
                              ...draft,
                              notes: e.target.value,
                            },
                          }))
                        }
                        placeholder="Verification notes"
                        rows={2}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleQaUpdate(check, 'passed')}
                          disabled={disabled}
                          className="rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {pendingQaKey === check.key ? 'Saving…' : 'Mark Passed'}
                        </button>
                        <button
                          onClick={() => handleQaUpdate(check, 'pending_manual')}
                          disabled={disabled}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                        >
                          Reset Pending
                        </button>
                        <button
                          onClick={() => handleQaUpdate(check, 'not_applicable')}
                          disabled={disabled}
                          className="rounded-lg border border-sky-300 px-3 py-2 text-xs font-medium text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
                        >
                          Mark N/A
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ValidationResultViewer validation={validation} />

      {/* Minimal units/sections overview */}
      <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Units & Sections</h3>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            Publish-readiness view: raw section state, public availability, blueprint state, and direct actions
          </p>
        </div>

        <div className="p-4">
          {!curriculum ? (
            <div className="text-sm text-gray-600 dark:text-gray-400">No curriculum data available.</div>
          ) : curriculum.units.length === 0 ? (
            <div className="text-sm text-gray-600 dark:text-gray-400">No units found.</div>
          ) : (
            <div className="space-y-4">
              {curriculum.units.map((unit) => (
                <div key={unit.id} className="border border-gray-200 dark:border-gray-800 rounded-lg">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {unit.title}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 font-mono">{unit.unit_key}</div>
                    </div>
                    <StatusBadge
                      status={
                        unit.availability === 'available'
                          ? 'success'
                          : unit.availability === 'coming_soon'
                          ? 'pending'
                          : 'inactive'
                      }
                      label={unit.availability}
                    />
                  </div>

                  <div className="p-3">
                    {unit.sections.length === 0 ? (
                      <div className="text-sm text-gray-600 dark:text-gray-400">No sections.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-600 dark:text-gray-400">
                              <th className="py-2">Section</th>
                              <th className="py-2">Publish State</th>
                              <th className="py-2">Blueprint</th>
                              <th className="py-2">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                            {unit.sections.map((section) => (
                              <tr key={section.id} className="text-gray-900 dark:text-white">
                                <td className="py-2">
                                  <div className="font-medium">{section.title}</div>
                                  <div className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                                    {section.section_key}
                                  </div>
                                </td>
                                <td className="py-2">
                                  <div className="space-y-2">
                                    <div className="flex flex-wrap gap-2">
                                      {getStatusBadge(section.status)}
                                      {section.enabled ? (
                                        <StatusBadge status="active" label="Enabled" />
                                      ) : (
                                        <StatusBadge status="inactive" label="Disabled" />
                                      )}
                                    </div>
                                    <div>
                                      <StatusBadge
                                        status={
                                          section.availability === 'available'
                                            ? 'success'
                                            : section.availability === 'coming_soon'
                                            ? 'pending'
                                            : 'inactive'
                                        }
                                        label={section.availability}
                                      />
                                    </div>
                                  </div>
                                </td>
                                <td className="py-2">
                                  {section.lesson_blueprint_id ? (
                                    <div className="space-y-1">
                                      <StatusBadge
                                        status={section.blueprint_status === 'published' ? 'success' : 'warning'}
                                        label={section.blueprint_status || 'Present'}
                                      />
                                      {typeof section.blueprint_enabled === 'boolean' && (
                                        <StatusBadge
                                          status={section.blueprint_enabled ? 'active' : 'inactive'}
                                          label={section.blueprint_enabled ? 'Enabled' : 'Disabled'}
                                        />
                                      )}
                                      {section.blueprint_key && (
                                        <div className="text-xs text-gray-600 dark:text-gray-400 font-mono break-all">
                                          {section.blueprint_key}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <StatusBadge status="warning" label="Missing" />
                                  )}
                                </td>
                                <td className="py-2">
                                  <div className="flex flex-wrap gap-2">
                                    <Link
                                      href={
                                        section.lesson_blueprint_id
                                          ? `/curriculum/lesson-blueprints/${section.lesson_blueprint_id}`
                                          : `/curriculum/lesson-blueprints/new?courseKey=${encodeURIComponent(curriculum.course_key)}&sectionId=${encodeURIComponent(section.id)}`
                                      }
                                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                    >
                                      {section.lesson_blueprint_id ? 'Open Blueprint' : 'Create Blueprint'}
                                    </Link>
                                    {section.blueprint_status !== 'published' && (section.status !== 'published' || section.enabled) && (
                                      <button
                                        onClick={() => handleMarkSectionsComingSoon([section.id])}
                                        disabled={pendingSectionIds.length > 0}
                                        className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-900 dark:text-amber-300 dark:hover:bg-amber-950/30"
                                      >
                                        {pendingSectionIds.includes(section.id) ? 'Saving…' : 'Mark Coming Soon'}
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmPublishOpen}
        onClose={() => setConfirmPublishOpen(false)}
        onConfirm={async () => {
          await handlePublish();
          setConfirmPublishOpen(false);
        }}
        title="Publish course"
        message="Publishing is server-authoritative and will re-run validation. Continue?"
        confirmText="Publish"
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
        title="Unpublish course"
        message="Unpublishing archives the course and disables it. Continue?"
        confirmText="Unpublish"
        cancelText="Cancel"
        variant="danger"
        isLoading={isUnpublishing}
      />

      <ConfirmationModal
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={async () => {
          await handleDeleteCourse();
          setConfirmDeleteOpen(false);
        }}
        title="Delete course"
        message="Deleting requires the course to already be archived and structurally empty. Continue?"
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeletingCourse}
      />

      <CourseEditorModal
        key={`edit:${course?.id ?? courseId}:${isCourseEditorOpen ? 'open' : 'closed'}`}
        isOpen={isCourseEditorOpen}
        mode="edit"
        course={course}
        isSaving={isCourseSaving}
        errorMessage={courseEditorError}
        onClose={() => {
          if (isCourseSaving) return;
          setIsCourseEditorOpen(false);
        }}
        onSubmit={handleCourseSave}
      />
    </div>
  );
}

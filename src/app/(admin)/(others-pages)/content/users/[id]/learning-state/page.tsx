'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import { ConfirmationModal } from '@/components/ui/modal/ConfirmationModal';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const color =
    clamped >= 100 ? 'bg-green-500' : clamped >= 50 ? 'bg-blue-500' : 'bg-amber-400';
  return (
    <div className="flex items-center gap-2" title={`${clamped.toFixed(1)}%`}>
      <div className="h-2 w-32 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-xs text-gray-600 dark:text-gray-400">{clamped.toFixed(1)}%</span>
    </div>
  );
}

type CourseState = {
  course_id: string;
  course_key: string | null;
  course_title: string | null;
  enrolled_at: string;
  last_active_at: string | null;
  current_unit_id: string | null;
  current_section_id: string | null;
  progress_percent: number;
  is_completed: boolean;
  completed_at: string | null;
};

type ActionState = 'idle' | 'loading' | 'success' | 'error';

function CourseCard({
  course,
  userId,
  onActionDone,
  onToast,
}: {
  course: CourseState;
  userId: string;
  onActionDone: () => void;
  /** Called on action success to display a brief toast message in the parent. */
  onToast: (message: string) => void;
}) {
  const [resetState, setResetState] = useState<ActionState>('idle');
  const [resetError, setResetError] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const [showPointerForm, setShowPointerForm] = useState(false);
  const [pointerUnit, setPointerUnit] = useState(course.current_unit_id ?? '');
  const [pointerSection, setPointerSection] = useState(course.current_section_id ?? '');
  const [pointerState, setPointerState] = useState<ActionState>('idle');
  const [pointerError, setPointerError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { adminResetCourseProgress, adminSetLearningPointer } = require('@/hooks/useApi');

  const confirmReset = async () => {
    setResetState('loading');
    setResetError(null);
    try {
      await adminResetCourseProgress(userId, course.course_id);
      setResetState('success');
      setShowResetConfirm(false);
      onToast('Progress reset successfully.');
      setTimeout(() => { setResetState('idle'); onActionDone(); }, 1500);
    } catch (e: unknown) {
      setResetState('error');
      setResetError(e instanceof Error ? e.message : 'Reset failed');
    }
  };

  const handleSetPointer = async () => {
    setPointerState('loading');
    setPointerError(null);
    try {
      await adminSetLearningPointer(userId, course.course_id, {
        current_unit_id: pointerUnit || undefined,
        current_section_id: pointerSection || undefined,
      });
      setPointerState('success');
      onToast('Learning pointer updated.');
      setTimeout(() => { setPointerState('idle'); setShowPointerForm(false); onActionDone(); }, 1500);
    } catch (e: unknown) {
      setPointerState('error');
      setPointerError(e instanceof Error ? e.message : 'Set pointer failed');
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
      {/* Course header */}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-800 dark:text-white">
            {course.course_title ?? course.course_key ?? course.course_id}
          </p>
          {course.course_key && (
            <p className="font-mono text-xs text-gray-500 dark:text-gray-400">{course.course_key}</p>
          )}
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            course.is_completed
              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
              : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
          }`}
        >
          {course.is_completed ? 'Completed' : 'In progress'}
        </span>
      </div>

      {/* Progress */}
      <div className="mb-3">
        <ProgressBar pct={course.progress_percent} />
      </div>

      {/* Detail grid */}
      <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-gray-500 dark:text-gray-400">Enrolled</dt>
          <dd className="text-gray-800 dark:text-gray-200">{formatDate(course.enrolled_at)}</dd>
        </div>
        <div>
          <dt className="text-gray-500 dark:text-gray-400">Last Active</dt>
          <dd className="text-gray-800 dark:text-gray-200">{formatDate(course.last_active_at)}</dd>
        </div>
        {course.is_completed && (
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Completed</dt>
            <dd className="text-gray-800 dark:text-gray-200">{formatDate(course.completed_at)}</dd>
          </div>
        )}
        {course.current_unit_id && (
          <div className="col-span-2 sm:col-span-3">
            <dt className="text-gray-500 dark:text-gray-400">Current Unit</dt>
            <dd className="font-mono text-gray-800 dark:text-gray-200">{course.current_unit_id}</dd>
          </div>
        )}
        {course.current_section_id && (
          <div className="col-span-2 sm:col-span-3">
            <dt className="text-gray-500 dark:text-gray-400">Current Section</dt>
            <dd className="font-mono text-gray-800 dark:text-gray-200">{course.current_section_id}</dd>
          </div>
        )}
        <div className="col-span-2 sm:col-span-3">
          <dt className="text-gray-500 dark:text-gray-400">Course ID</dt>
          <dd className="font-mono text-gray-800 dark:text-gray-200">{course.course_id}</dd>
        </div>
      </dl>

      {/* Admin actions */}
      <div className="border-t border-gray-100 pt-3 dark:border-gray-700">
        <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Admin actions</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowResetConfirm(true)}
            disabled={resetState === 'loading'}
            className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
          >
            {resetState === 'loading' ? 'Resetting…' : resetState === 'success' ? '✓ Reset' : 'Reset Progress'}
          </button>
          <button
            onClick={() => setShowPointerForm((v) => !v)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Set Pointer
          </button>
        </div>
        {resetError && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{resetError}</p>
        )}
        {showPointerForm && (
          <div className="mt-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <p className="mb-2 text-xs font-medium text-gray-600 dark:text-gray-400">
              Set current pointer (leave blank to keep existing)
            </p>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400">Unit ID (UUID)</label>
                <input
                  type="text"
                  value={pointerUnit}
                  onChange={(e) => setPointerUnit(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="mt-0.5 w-full rounded border border-gray-300 bg-white px-2 py-1 font-mono text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400">Section ID (UUID)</label>
                <input
                  type="text"
                  value={pointerSection}
                  onChange={(e) => setPointerSection(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="mt-0.5 w-full rounded border border-gray-300 bg-white px-2 py-1 font-mono text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSetPointer}
                  disabled={pointerState === 'loading' || (!pointerUnit && !pointerSection)}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-40"
                >
                  {pointerState === 'loading' ? 'Saving…' : pointerState === 'success' ? '✓ Saved' : 'Save'}
                </button>
                <button
                  onClick={() => setShowPointerForm(false)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400"
                >
                  Cancel
                </button>
              </div>
              {pointerError && (
                <p className="text-xs text-red-600 dark:text-red-400">{pointerError}</p>
              )}
            </div>
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={showResetConfirm}
        onClose={() => {
          if (resetState !== 'loading') setShowResetConfirm(false);
        }}
        onConfirm={() => void confirmReset()}
        title="Reset course progress"
        message={`Reset ALL progress for "${course.course_title ?? course.course_key}"? This cannot be undone.`}
        confirmText="Reset Progress"
        variant="danger"
        isLoading={resetState === 'loading'}
      />
    </div>
  );
}

export default function UserLearningStatePage() {
  const params = useParams();
  const userId = typeof params?.id === 'string' ? params.id : null;

  // We import the hook lazily to avoid pulling SWR into SSR
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useAdminUserLearningState } = require('@/hooks/useApi');
  const { state, isLoading, isError, refresh } = useAdminUserLearningState(userId);

  const allCourses: CourseState[] = state?.courses ?? [];

  // Phase 18: filter — only show courses with any activity (progress > 0)
  const [activeOnly, setActiveOnly] = useState(false);
  const courses = activeOnly
    ? allCourses.filter((c) => c.progress_percent > 0 || c.is_completed)
    : allCourses;

  // Phase 19: toast notification after admin actions
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(state ?? {}, null, 2));
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch {
      setCopyStatus('failed');
      setTimeout(() => setCopyStatus('idle'), 2000);
    }
  };

  return (
    <div>
      <PageBreadCrumb pageTitle="User Learning State" />

      {/* Phase 19: Toast notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
        >
          <span>✓ {toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-4 text-green-600 hover:text-green-800 dark:text-green-400"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
        {/* Header row */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-800 dark:text-white">
              Learning State
            </h1>
            {userId && (
              <p className="mt-0.5 font-mono text-xs text-gray-500 dark:text-gray-400">
                user_id: {userId}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Phase 18: active-learner filter */}
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
                aria-label="Show active learners only"
              />
              Active only
            </label>
            <button
              onClick={handleCopyJson}
              disabled={isLoading || !state}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {copyStatus === 'copied'
                ? '✓ Copied'
                : copyStatus === 'failed'
                  ? '✗ Failed'
                  : 'Copy JSON'}
            </button>
            <button
              onClick={() => refresh()}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        )}

        {/* Error */}
        {isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
            <p className="text-sm text-red-700 dark:text-red-300">
              Failed to load learning state.{' '}
              <button onClick={() => refresh()} className="underline">
                Retry
              </button>
            </p>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !isError && courses.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {activeOnly && allCourses.length > 0
              ? 'No active course enrollments (all courses at 0% progress).'
              : 'No course enrollments found for this user.'}
          </p>
        )}

        {/* Course cards */}
        {!isLoading && !isError && courses.length > 0 && userId && (
          <div className="space-y-4">
            {courses.map((course) => (
              <CourseCard
                key={course.course_id}
                course={course}
                userId={userId}
                onActionDone={refresh}
                onToast={showToast}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

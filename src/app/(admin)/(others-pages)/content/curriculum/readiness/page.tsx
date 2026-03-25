'use client';

import React from 'react';
import Link from 'next/link';

import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import StatusBadge from '@/components/admin/StatusBadge';
import Alert from '@/components/ui/alert/SimpleAlert';
import { useCurriculumReadinessMatrix } from '@/hooks/useApi';
import type {
  CurriculumCourseQaStatus,
  CurriculumQaCheckStatus,
  CurriculumReadinessCourse,
} from '@/types/curriculum';

function getErrorMessage(error: any): string {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') {
    return detail;
  }
  return error?.message || 'Unable to load curriculum readiness.';
}

function getCourseQaBadge(status: CurriculumCourseQaStatus) {
  if (status === 'verified') {
    return <StatusBadge status="success" label="Verified" />;
  }
  if (status === 'ready_to_test') {
    return <StatusBadge status="success" label="Ready To Test" />;
  }
  if (status === 'partially_testable') {
    return <StatusBadge status="warning" label="Partially Testable" />;
  }
  return <StatusBadge status="error" label="Blocked" />;
}

function getCheckBadge(status: CurriculumQaCheckStatus) {
  if (status === 'passed') {
    return <StatusBadge status="success" label="Passed" />;
  }
  if (status === 'pending_manual') {
    return <StatusBadge status="pending" label="Pending Manual" />;
  }
  if (status === 'not_applicable') {
    return <StatusBadge status="info" label="N/A" />;
  }
  return <StatusBadge status="error" label="Blocked" />;
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-white/[0.05] dark:bg-white/[0.03]">
      <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{value}</div>
      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</div>
    </div>
  );
}

function CourseCard({ course }: { course: CurriculumReadinessCourse }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-white/[0.05] dark:bg-white/[0.03]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {course.course.title}
            </h3>
            {getCourseQaBadge(course.qa_status)}
          </div>
          <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {course.course.course_key}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/content/curriculum/courses/${course.course.id}`}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:text-white dark:hover:bg-white/[0.03]"
          >
            Open Course
          </Link>
          <Link
            href={`/content/curriculum/editor?courseKey=${encodeURIComponent(course.course.course_key)}`}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:text-white dark:hover:bg-white/[0.03]"
          >
            Open Editor
          </Link>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-6">
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/40">
          <div className="text-xs text-gray-500 dark:text-gray-400">Units</div>
          <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
            {course.unit_count}
          </div>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/40">
          <div className="text-xs text-gray-500 dark:text-gray-400">Sections</div>
          <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
            {course.section_count}
          </div>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/40">
          <div className="text-xs text-gray-500 dark:text-gray-400">Blueprints</div>
          <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
            {course.blueprint_count}
          </div>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/40">
          <div className="text-xs text-gray-500 dark:text-gray-400">Published</div>
          <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
            {course.published_blueprint_count}
          </div>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/40">
          <div className="text-xs text-gray-500 dark:text-gray-400">Launchable</div>
          <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
            {course.launchable_section_count}
          </div>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/40">
          <div className="text-xs text-gray-500 dark:text-gray-400">Missing Blueprints</div>
          <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
            {course.missing_blueprint_section_count}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {course.lesson_kinds.length === 0 ? (
          <StatusBadge status="info" label="No lesson kinds" />
        ) : (
          course.lesson_kinds.map((lessonKind) => (
            <StatusBadge key={lessonKind} status="info" label={lessonKind} />
          ))
        )}
      </div>

      <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-800">
        <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">Validation</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {course.validation.blocking_error_count} blocking errors, {course.validation.warning_count} warnings
              </p>
            </div>
            <StatusBadge
              status={course.validation.can_publish ? 'success' : 'error'}
              label={course.validation.can_publish ? 'Can Publish' : 'Cannot Publish'}
            />
          </div>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-800">
          {course.qa_checks.map((check) => (
            <div
              key={check.key}
              className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-start md:justify-between"
            >
              <div>
                <div className="font-medium text-gray-900 dark:text-white">{check.label}</div>
                {check.detail ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400">{check.detail}</div>
                ) : null}
                {(check.build_version || check.notes || check.verified_at) ? (
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {[check.build_version, check.notes, check.verified_at ? new Date(check.verified_at).toLocaleString() : null]
                      .filter(Boolean)
                      .join(' • ')}
                  </div>
                ) : null}
              </div>
              {getCheckBadge(check.status)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CurriculumReadinessPage() {
  const { data, isLoading, isError, refresh } = useCurriculumReadinessMatrix();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <PageBreadCrumb pageTitle="Curriculum Readiness" />
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Backend inventory by language and course, with explicit manual QA gaps.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/content/curriculum/courses"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:text-white dark:hover:bg-white/[0.03]"
          >
            Courses
          </Link>
          <button
            type="button"
            onClick={() => refresh()}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {isError && <Alert variant="error">{getErrorMessage(isError)}</Alert>}

      {isLoading && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500 dark:border-white/[0.05] dark:bg-white/[0.03] dark:text-gray-400">
          Loading readiness matrix...
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <SummaryCard
              label="Languages"
              value={data.totals.language_count}
              hint="Languages with at least one mapped course"
            />
            <SummaryCard
              label="Courses"
              value={data.totals.course_count}
              hint="Courses discovered from backend truth"
            />
            <SummaryCard
              label="Launchable Sections"
              value={data.totals.launchable_section_count}
              hint="Sections with a published blueprint"
            />
            <SummaryCard
              label="Ready To Test"
              value={data.totals.ready_to_test_course_count}
              hint="Course passes publish gates; manual QA remains"
            />
            <SummaryCard
              label="Blocked"
              value={data.totals.blocked_course_count}
              hint="Course still missing blueprints or failing validation"
            />
          </div>

          <div className="space-y-6">
            {data.languages.map((language) => (
              <section
                key={language.target_language_id || language.target_language_code || 'unknown'}
                className="rounded-xl border border-gray-200 bg-white p-5 dark:border-white/[0.05] dark:bg-white/[0.03]"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {language.target_language_name || 'Unassigned Language'}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {language.target_language_code || 'no-language-code'} - {language.course_count} course(s)
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status="info" label={`Units ${language.unit_count}`} />
                    <StatusBadge status="info" label={`Sections ${language.section_count}`} />
                    <StatusBadge
                      status="info"
                      label={`Published Blueprints ${language.published_blueprint_count}`}
                    />
                    <StatusBadge
                      status="info"
                      label={`Launchable ${language.launchable_section_count}`}
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {language.lesson_kinds.length === 0 ? (
                    <StatusBadge status="info" label="No lesson kinds" />
                  ) : (
                    language.lesson_kinds.map((lessonKind) => (
                      <StatusBadge key={lessonKind} status="info" label={lessonKind} />
                    ))
                  )}
                </div>

                <div className="mt-5 space-y-4">
                  {language.courses.map((course) => (
                    <CourseCard key={course.course.id} course={course} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

'use client';

import React, { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import MetricCard from '@/components/analytics/learning/MetricCard';
import DropoffPanel from '@/components/analytics/learning/DropoffPanel';
import ExerciseAccuracyTable from '@/components/analytics/learning/ExerciseAccuracyTable';
import VersionComparisonTable from '@/components/analytics/learning/VersionComparisonTable';
import { AnalyticsPanelSkeleton, AnalyticsEmptyState, AnalyticsErrorPanel } from '@/components/analytics/learning/AnalyticsEmptyState';
import {
  useLessonAnalyticsSummary,
  useLessonAnalyticsVersions,
  useLearningAnalyticsOverview,
} from '@/hooks/useApi';
import { formatCount, formatDurationMs, formatRate } from '@/lib/formatAnalytics';

type DatePreset = '7' | '30' | '90' | 'all';

function presetToDateFrom(preset: DatePreset): string | undefined {
  if (preset === 'all') return undefined;
  const days = Number(preset);
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export default function LessonAnalyticsDetailPage() {
  const params = useParams<{ sectionId: string }>();
  const sectionId = params?.sectionId;
  const [preset, setPreset] = useState<DatePreset>('30');
  const dateFrom = useMemo(() => presetToDateFrom(preset), [preset]);

  const { summary, isLoading, isError, refresh } = useLessonAnalyticsSummary(sectionId, { dateFrom });
  const { versions } = useLessonAnalyticsVersions(sectionId, { dateFrom });
  // Reuses the already-cached Overview call purely to resolve this section's
  // human-readable title/course - avoids adding a new single-section lookup
  // endpoint for what is otherwise a display-only header.
  const { overview } = useLearningAnalyticsOverview();
  const sectionMeta = overview?.sections.find((s) => s.section_id === sectionId);

  if (isError) {
    const errMsg = (isError as any)?.response?.data?.detail || (isError as any)?.message || 'Failed to load lesson analytics.';
    const status = (isError as any)?.response?.status;
    const title = status === 404 ? 'Lesson section not found' : 'Failed to load lesson analytics';
    return (
      <div className="p-6 space-y-4">
        <Link href="/analytics/learning" className="text-sm text-blue-600 hover:underline">
          &larr; Back to Learning Analytics
        </Link>
        <AnalyticsErrorPanel
          message={`${title}: ${errMsg}`}
          onRetry={status === 404 ? undefined : () => refresh()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <Link href="/analytics/learning" className="text-sm text-blue-600 hover:underline">
            &larr; Back to Learning Analytics
          </Link>
          <PageBreadCrumb pageTitle={sectionMeta?.section_title ?? 'Lesson Analytics'} />
          {sectionMeta?.course_title && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{sectionMeta.course_title}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as DatePreset)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          <button
            onClick={() => refresh()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh Data
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <AnalyticsPanelSkeleton key={i} heightClassName="h-32" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Sessions Started"
              value={formatCount(summary?.funnel.sessions_started)}
              subtext={`${formatCount(summary?.funnel.unique_users_started)} unique learners`}
            />
            <MetricCard
              label="Completion Rate"
              value={formatRate(summary?.funnel.session_completion_rate)}
              subtext={summary ? `${summary.funnel.sessions_completed} / ${summary.funnel.sessions_started} sessions` : undefined}
              sampleSize={summary?.funnel.sessions_started}
            />
            <MetricCard
              label="Median Duration"
              value={formatDurationMs(summary?.duration.median_wall_clock_duration_ms)}
              subtext={`p75: ${formatDurationMs(summary?.duration.p75_wall_clock_duration_ms)} · p90: ${formatDurationMs(summary?.duration.p90_wall_clock_duration_ms)}`}
              tooltip="Wall-clock time from session start to completion - may include backgrounded time, not active study time."
              sampleSize={summary?.duration.sample_size}
            />
            <MetricCard
              label="Repeat-Session Rate"
              value={formatRate(summary?.repeat_sessions.repeat_user_rate)}
              subtext={summary ? `${summary.repeat_sessions.users_with_repeat_sessions} / ${summary.repeat_sessions.unique_users_started} learners` : undefined}
              tooltip="Share of learners who started this lesson more than once."
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MetricCard
              label="Median Response Time"
              value={formatDurationMs(summary?.response_time.median_response_time_ms)}
              subtext={`p75: ${formatDurationMs(summary?.response_time.p75_response_time_ms)} · p90: ${formatDurationMs(summary?.response_time.p90_response_time_ms)}`}
              tooltip="Time between an exercise being shown and the learner submitting an answer."
              sampleSize={summary?.response_time.sample_size}
            />
            <MetricCard
              label="User Completion Rate"
              value={formatRate(summary?.funnel.user_completion_rate)}
              subtext={summary ? `${summary.funnel.unique_users_completed} / ${summary.funnel.unique_users_started} learners` : undefined}
              tooltip="Share of learners who completed this lesson at least once, out of those who started it."
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Drop-off by Step</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Where learners stop without completing the lesson.
            </p>
            <DropoffPanel rows={summary?.drop_off ?? []} />
          </div>

          <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Exercise Accuracy</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              First-attempt vs. eventual accuracy per exercise, in lesson order.
            </p>
            <ExerciseAccuracyTable rows={summary?.accuracy ?? []} />
          </div>

          {versions && versions.length > 1 && (
            <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Content Versions</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                This lesson&apos;s content has changed during the selected period. Numbers are shown side by side -
                differences may reflect cohort or date effects, not just the content change itself.
              </p>
              <VersionComparisonTable rows={versions} />
            </div>
          )}

          {summary && summary.funnel.sessions_started === 0 && (
            <AnalyticsEmptyState
              message="No sessions recorded for this lesson in the selected period."
              hint="Try widening the date range or clearing filters."
            />
          )}
        </>
      )}
    </div>
  );
}

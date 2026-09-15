'use client';

import React, { useMemo, useState } from 'react';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import AnalyticsTabs from '@/components/analytics/AnalyticsTabs';
import MetricCard from '@/components/analytics/learning/MetricCard';
import LessonPerformanceTable from '@/components/analytics/learning/LessonPerformanceTable';
import { AnalyticsPanelSkeleton, AnalyticsErrorPanel } from '@/components/analytics/learning/AnalyticsEmptyState';
import { useLearningAnalyticsOverview, useAdminCoursesList, useLanguages } from '@/hooks/useApi';
import { formatCount, formatDurationMs, formatRate, LOW_SAMPLE_THRESHOLD } from '@/lib/formatAnalytics';

type DatePreset = '7' | '30' | '90' | 'all';

function presetToDateFrom(preset: DatePreset): string | undefined {
  if (preset === 'all') return undefined;
  const days = Number(preset);
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export default function LearningAnalyticsOverviewPage() {
  const [preset, setPreset] = useState<DatePreset>('30');
  const [courseId, setCourseId] = useState<string>('');
  const [languageId, setLanguageId] = useState<string>('');
  const [search, setSearch] = useState('');

  const dateFrom = useMemo(() => presetToDateFrom(preset), [preset]);

  const { overview, isLoading, isError, refresh } = useLearningAnalyticsOverview({
    dateFrom,
    courseId: courseId || undefined,
    languageId: languageId || undefined,
  });
  const { data: coursesData } = useAdminCoursesList({ limit: 200 });
  const { languages } = useLanguages();

  const courseOptions = (coursesData?.items ?? []) as Array<{ id: string; title?: string; course_key?: string }>;

  const needsAttention = useMemo(() => {
    if (!overview) return [];
    return [...overview.sections]
      .filter((s) => s.sessions_started >= LOW_SAMPLE_THRESHOLD && s.first_attempt_accuracy !== null)
      .sort((a, b) => (a.first_attempt_accuracy ?? 1) - (b.first_attempt_accuracy ?? 1))
      .slice(0, 5);
  }, [overview]);

  if (isError) {
    const errMsg = (isError as any)?.response?.data?.detail || (isError as any)?.message || 'Failed to load learning analytics.';
    return (
      <div className="p-6">
        <AnalyticsErrorPanel message={`Failed to load learning analytics: ${errMsg}`} onRetry={() => refresh()} />
      </div>
    );
  }

  const summary = overview?.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <PageBreadCrumb pageTitle="Learning Analytics" />
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Understand lesson engagement, completion, difficulty, and learner progression.
          </p>
        </div>
        <button
          onClick={() => refresh()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh Data
        </button>
      </div>

      <AnalyticsTabs />

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StyledSelect
            id="learning-analytics-date-range"
            label="Date Range"
            value={preset}
            onChange={(e) => setPreset(e.target.value as DatePreset)}
            options={[
              { value: '7', label: 'Last 7 days' },
              { value: '30', label: 'Last 30 days' },
              { value: '90', label: 'Last 90 days' },
              { value: 'all', label: 'All time' },
            ]}
            fullWidth
          />
          <StyledSelect
            id="learning-analytics-course"
            label="Course"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            options={[
              { value: '', label: 'All Courses' },
              ...courseOptions.map((c) => ({ value: c.id, label: c.title || c.course_key || c.id })),
            ]}
            fullWidth
          />
          <StyledSelect
            id="learning-analytics-language"
            label="Language"
            value={languageId}
            onChange={(e) => setLanguageId(e.target.value)}
            options={[
              { value: '', label: 'All Languages' },
              ...languages.map((lang: any) => ({ value: lang.id, label: lang.name })),
            ]}
            fullWidth
          />
          <div className="flex items-end">
            <button
              onClick={() => {
                setPreset('30');
                setCourseId('');
                setLanguageId('');
                setSearch('');
              }}
              className="w-full px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <AnalyticsPanelSkeleton key={i} heightClassName="h-32" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard label="Unique Learners" value={formatCount(summary?.unique_learners)} />
          <MetricCard
            label="Lesson Sessions"
            value={formatCount(summary?.sessions_started)}
            subtext={`${formatCount(summary?.sessions_completed)} completed`}
          />
          <MetricCard
            label="Session Completion Rate"
            value={formatRate(summary?.session_completion_rate)}
            subtext={summary ? `${summary.sessions_completed} / ${summary.sessions_started} sessions` : undefined}
          />
          <MetricCard
            label="First-Attempt Accuracy"
            value={formatRate(summary?.first_attempt_accuracy)}
            tooltip="Session-exercises answered correctly on the first response, out of all distinct session-exercises attempted."
          />
          <MetricCard
            label="Repeat-Session Rate"
            value={formatRate(summary?.repeat_user_rate)}
            tooltip="Share of learners who started 2 or more structured-lesson sessions in total across any lesson in this scope - may reflect deliberate practice, not failure. See the per-lesson repeat rate on a lesson's detail page for same-lesson repeats specifically."
          />
          <MetricCard
            label="Median Wall-Clock Duration"
            value={formatDurationMs(summary?.median_wall_clock_duration_ms)}
            tooltip="Time from session start to completion. May include time the app was backgrounded - this is not active study time."
          />
        </div>
      )}

      {/* Lesson performance table */}
      <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Lesson Performance</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Click a lesson to see exercise-level detail and drop-off.
            </p>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search lesson or course…"
            className="w-full sm:w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>
        {isLoading ? (
          <AnalyticsPanelSkeleton heightClassName="h-64" />
        ) : (
          <LessonPerformanceTable rows={overview?.sections ?? []} searchQuery={search} />
        )}
      </div>

      {/* Lessons needing attention - transparent sort, no synthetic score */}
      {!isLoading && needsAttention.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Lessons Needing Attention</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Lowest first-attempt accuracy among lessons with at least {LOW_SAMPLE_THRESHOLD} sessions - a
            transparent sort of the same metrics above, not a hidden score.
          </p>
          <LessonPerformanceTable rows={needsAttention} />
        </div>
      )}
    </div>
  );
}

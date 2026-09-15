'use client';

import React, { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import LearnerJourneyTimeline from '@/components/analytics/learning/LearnerJourneyTimeline';
import { AnalyticsPanelSkeleton, AnalyticsErrorPanel } from '@/components/analytics/learning/AnalyticsEmptyState';
import { useLearnerJourney, useAdminCoursesList } from '@/hooks/useApi';
import { StyledSelect } from '@/components/ui/form/StyledSelect';

type DatePreset = '7' | '30' | '90' | 'all';

function presetToDateFrom(preset: DatePreset): string | undefined {
  if (preset === 'all') return undefined;
  const days = Number(preset);
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export default function LearnerJourneyPage() {
  const params = useParams<{ userId: string }>();
  const userId = params?.userId;
  const [preset, setPreset] = useState<DatePreset>('all');
  const [courseId, setCourseId] = useState('');
  const dateFrom = useMemo(() => presetToDateFrom(preset), [preset]);

  const { journey, isLoading, isError, refresh } = useLearnerJourney(userId, {
    dateFrom,
    courseId: courseId || undefined,
  });
  const { data: coursesData } = useAdminCoursesList({ limit: 200 });
  const courseOptions = (coursesData?.items ?? []) as Array<{ id: string; title?: string; course_key?: string }>;

  if (isError) {
    const errMsg = (isError as any)?.response?.data?.detail || (isError as any)?.message || 'Failed to load learner journey.';
    const status = (isError as any)?.response?.status;
    const title = status === 404 ? 'Learner not found' : 'Failed to load learner journey';
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
          <PageBreadCrumb pageTitle="Learner Journey" />
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 font-mono">{userId}</p>
        </div>
        <button
          onClick={() => refresh()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh Data
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StyledSelect
            id="learner-journey-date-range"
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
            id="learner-journey-course"
            label="Course"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            options={[
              { value: '', label: 'All Courses' },
              ...courseOptions.map((c) => ({ value: c.id, label: c.title || c.course_key || c.id })),
            ]}
            fullWidth
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Session Timeline</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Sessions in the order they occurred (started_at). This chronology is never re-derived from
          lesson_attempt_number, which is informational only.
        </p>
        {isLoading ? (
          <AnalyticsPanelSkeleton heightClassName="h-96" />
        ) : (
          <LearnerJourneyTimeline sessions={journey ?? []} />
        )}
      </div>
    </div>
  );
}

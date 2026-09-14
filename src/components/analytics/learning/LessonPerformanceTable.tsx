'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import type { AnalyticsOverviewSectionRow } from '@/types/learning-analytics';
import { formatDurationMs, formatRate } from '@/lib/formatAnalytics';
import { AnalyticsEmptyState } from './AnalyticsEmptyState';

type SortKey = 'sessions' | 'completion' | 'accuracy' | 'repeat' | 'duration';

/** Null-safe comparator: rows with a null metric always sort last,
 * regardless of direction, per the explicit "define null placement"
 * requirement - a lesson with no data should never appear to be the "best"
 * or "worst" performer by accident. */
function compareNullsLast(a: number | null, b: number | null, direction: 1 | -1): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (a - b) * direction;
}

export default function LessonPerformanceTable({
  rows,
  searchQuery = '',
}: {
  rows: AnalyticsOverviewSectionRow[];
  searchQuery?: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('sessions');
  const [direction, setDirection] = useState<1 | -1>(-1);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.section_title ?? '').toLowerCase().includes(q) ||
        (r.course_title ?? '').toLowerCase().includes(q),
    );
  }, [rows, searchQuery]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      switch (sortKey) {
        case 'sessions':
          return (a.sessions_started - b.sessions_started) * direction;
        case 'completion':
          return compareNullsLast(a.session_completion_rate, b.session_completion_rate, direction);
        case 'accuracy':
          return compareNullsLast(a.first_attempt_accuracy, b.first_attempt_accuracy, direction);
        case 'repeat':
          return compareNullsLast(a.repeat_user_rate, b.repeat_user_rate, direction);
        case 'duration':
          return compareNullsLast(a.median_wall_clock_duration_ms, b.median_wall_clock_duration_ms, direction);
        default:
          return 0;
      }
    });
    return copy;
  }, [filtered, sortKey, direction]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setDirection((d) => (d === 1 ? -1 : 1) as 1 | -1);
    } else {
      setSortKey(key);
      setDirection(-1);
    }
  };

  if (rows.length === 0) {
    return <AnalyticsEmptyState message="No learning analytics for this period yet." hint="Analytics appear after learners use an app version with Learning Analytics instrumentation." />;
  }

  const headerButton = (key: SortKey, label: string) => (
    <button
      onClick={() => toggleSort(key)}
      className="flex items-center gap-1 uppercase text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
    >
      {label}
      {sortKey === key && <span>{direction === 1 ? '▲' : '▼'}</span>}
    </button>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Lesson / Section</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Course</th>
            <th className="px-4 py-3 text-right"><div className="flex justify-end">{headerButton('sessions', 'Sessions')}</div></th>
            <th className="px-4 py-3 text-right"><div className="flex justify-end">{headerButton('completion', 'Completion')}</div></th>
            <th className="px-4 py-3 text-right"><div className="flex justify-end">{headerButton('accuracy', 'First-Attempt Acc.')}</div></th>
            <th className="px-4 py-3 text-right"><div className="flex justify-end">{headerButton('repeat', 'Repeat Rate')}</div></th>
            <th className="px-4 py-3 text-right"><div className="flex justify-end">{headerButton('duration', 'Median Duration')}</div></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {sorted.map((row) => (
            <tr key={row.section_id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
              <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                <Link href={`/analytics/learning/lessons/${row.section_id}`} className="hover:underline">
                  {row.section_title ?? row.section_id}
                </Link>
              </td>
              <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{row.course_title ?? '—'}</td>
              <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                {row.sessions_started.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                {formatRate(row.session_completion_rate)}
              </td>
              <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                {formatRate(row.first_attempt_accuracy)}
              </td>
              <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                {formatRate(row.repeat_user_rate)}
              </td>
              <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                {formatDurationMs(row.median_wall_clock_duration_ms)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <AnalyticsEmptyState message="No lessons match your search." />
      )}
    </div>
  );
}

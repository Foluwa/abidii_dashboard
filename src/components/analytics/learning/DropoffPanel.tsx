import React from 'react';
import type { AnalyticsDropoffRow } from '@/types/learning-analytics';
import { AnalyticsEmptyState } from './AnalyticsEmptyState';

/** Horizontal bar list - same visual pattern as the existing "Error
 * Categories" panel in the game analytics page, not a new chart library. */
export default function DropoffPanel({ rows }: { rows: AnalyticsDropoffRow[] }) {
  if (rows.length === 0) {
    return <AnalyticsEmptyState message="No drop-off recorded for this period." />;
  }

  const maxDropped = Math.max(...rows.map((r) => r.sessions_dropped), 1);

  return (
    <div className="space-y-3">
      {rows.map((row, idx) => {
        const label = row.exercise_index === null ? 'Before first exercise' : `Step ${row.exercise_index + 1}`;
        const widthPct = Math.max((row.sessions_dropped / maxDropped) * 100, 8);
        const tooltip = [
          `${row.unique_users_dropped} unique user(s)`,
          row.percent_of_started_sessions !== null
            ? `${(row.percent_of_started_sessions * 100).toFixed(1)}% of started sessions`
            : null,
          row.exercise_type ? `Type: ${row.exercise_type}` : null,
        ]
          .filter(Boolean)
          .join(' · ');

        return (
          <div key={idx} className="flex items-center gap-3" title={tooltip}>
            <div className="w-40 shrink-0 truncate text-sm font-medium text-gray-900 dark:text-white">
              {label}
            </div>
            <div className="flex-1">
              <div className="h-5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="flex h-5 items-center justify-end rounded-full bg-orange-500 px-2 text-xs font-medium text-white"
                  style={{ width: `${widthPct}%` }}
                >
                  {row.sessions_dropped}
                </div>
              </div>
            </div>
            <div className="w-16 shrink-0 text-right text-sm text-gray-500 dark:text-gray-400">
              {row.percent_of_started_sessions !== null
                ? `${(row.percent_of_started_sessions * 100).toFixed(0)}%`
                : '—'}
            </div>
          </div>
        );
      })}
      <p className="pt-1 text-xs text-gray-400 dark:text-gray-500">
        Drop-off includes sessions that were not completed and have been inactive beyond the analytics
        inactivity threshold - it does not necessarily mean the learner explicitly gave up.
      </p>
    </div>
  );
}

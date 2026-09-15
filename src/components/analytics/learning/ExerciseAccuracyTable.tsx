import React from 'react';
import type { AnalyticsExerciseAccuracyRow } from '@/types/learning-analytics';
import { formatRate } from '@/lib/formatAnalytics';
import { AnalyticsEmptyState } from './AnalyticsEmptyState';

/** Exercise identity in the UI is index/type, never the raw exercise_key -
 * the key is still available for debugging via the row's title attribute. */
export default function ExerciseAccuracyTable({
  rows,
}: {
  rows: AnalyticsExerciseAccuracyRow[];
}) {
  if (rows.length === 0) {
    return <AnalyticsEmptyState message="No exercise attempts recorded for this period." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Step</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">First Attempt</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Eventual</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Attempts to Correct</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Attempts (n)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {rows.map((row) => (
            <tr key={row.exercise_key} title={`exercise_key: ${row.exercise_key}`} className="hover:bg-gray-50 dark:hover:bg-gray-800">
              <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                {row.exercise_index !== null ? `Step ${row.exercise_index + 1}` : '—'}
              </td>
              <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{row.exercise_type ?? '—'}</td>
              <td className="px-4 py-3 text-right">
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatRate(row.first_attempt_accuracy)}
                </span>
                <span className="ml-1 text-xs text-gray-400">
                  ({row.first_attempt_correct}/{row.first_attempt_count})
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatRate(row.eventual_accuracy)}
                </span>
                <span className="ml-1 text-xs text-gray-400">
                  ({row.eventual_correct_count}/{row.first_attempt_count})
                </span>
              </td>
              <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                {row.eventual_correct_count > 0 && row.mean_attempts_to_correct !== null
                  ? row.mean_attempts_to_correct.toFixed(1)
                  : '—'}
              </td>
              <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">
                {row.raw_attempt_rows.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

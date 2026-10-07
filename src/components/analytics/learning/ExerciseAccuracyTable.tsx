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
        <thead className="border-b">
          <tr>
            <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Step</th>
            <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Type</th>
            <th className="px-4 py-2.5 text-right text-sm font-medium text-muted-foreground">First Attempt</th>
            <th className="px-4 py-2.5 text-right text-sm font-medium text-muted-foreground">Eventual</th>
            <th className="px-4 py-2.5 text-right text-sm font-medium text-muted-foreground">Attempts to Correct</th>
            <th className="px-4 py-2.5 text-right text-sm font-medium text-muted-foreground">Attempts (n)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.exercise_key} title={`exercise_key: ${row.exercise_key}`} className="hover:bg-muted/50">
              <td className="px-4 py-3 font-medium text-foreground">
                {row.exercise_index !== null ? `Step ${row.exercise_index + 1}` : '—'}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{row.exercise_type ?? '—'}</td>
              <td className="px-4 py-3 text-right">
                <span className="font-semibold text-foreground">
                  {formatRate(row.first_attempt_accuracy)}
                </span>
                <span className="ml-1 text-xs text-gray-400">
                  ({row.first_attempt_correct}/{row.first_attempt_count})
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="font-semibold text-foreground">
                  {formatRate(row.eventual_accuracy)}
                </span>
                <span className="ml-1 text-xs text-gray-400">
                  ({row.eventual_correct_count}/{row.first_attempt_count})
                </span>
              </td>
              <td className="px-4 py-3 text-right text-foreground">
                {row.eventual_correct_count > 0 && row.mean_attempts_to_correct !== null
                  ? row.mean_attempts_to_correct.toFixed(1)
                  : '—'}
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">
                {row.raw_attempt_rows.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

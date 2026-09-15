import React from 'react';
import type { AnalyticsFunnelVersionRow } from '@/types/learning-analytics';
import { formatRate, formatVersionLabel } from '@/lib/formatAnalytics';
import { AnalyticsEmptyState } from './AnalyticsEmptyState';

/** Only rendered by the caller when there's more than one version - a
 * single-version section has nothing to compare. NULL (legacy/unknown) is
 * always its own row here, never merged into a known version. This
 * component never states "Version B is better" - different cohorts, small
 * samples, and different dates can confound a naive comparison, so it only
 * shows the numbers with sample sizes and lets a human interpret them. */
export default function VersionComparisonTable({
  rows,
  currentHash,
}: {
  rows: AnalyticsFunnelVersionRow[];
  currentHash?: string | null;
}) {
  if (rows.length === 0) {
    return <AnalyticsEmptyState message="No version data available." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Version</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Sessions</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Completion</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {rows.map((row) => (
            <tr
              key={row.blueprint_content_hash ?? 'legacy'}
              title={row.blueprint_content_hash ?? undefined}
              className="hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                {formatVersionLabel(row.blueprint_content_hash, {
                  isCurrent: currentHash != null && row.blueprint_content_hash === currentHash,
                })}
              </td>
              <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                {row.sessions_started.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right">
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatRate(row.session_completion_rate)}
                </span>
                <span className="ml-1 text-xs text-gray-400">
                  ({row.sessions_completed}/{row.sessions_started})
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

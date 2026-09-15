import React from 'react';

/** Shared empty/error state - matches the existing GameAnalyticsPage
 * "No X available for this period" pattern rather than introducing a new
 * visual language for one panel. */
export function AnalyticsEmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="py-8 text-center">
      <p className="text-gray-500 dark:text-gray-400">{message}</p>
      {hint && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
    </div>
  );
}

export function AnalyticsPanelSkeleton({ heightClassName = 'h-64' }: { heightClassName?: string }) {
  return <div className={`${heightClassName} animate-pulse rounded bg-gray-200 dark:bg-gray-800`} />;
}

export function AnalyticsErrorPanel({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20">
      <p className="text-sm font-medium text-red-700 dark:text-red-400">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700"
        >
          Retry
        </button>
      )}
    </div>
  );
}

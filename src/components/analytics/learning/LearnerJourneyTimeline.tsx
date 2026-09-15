import React from 'react';
import type { AnalyticsUserJourneySession } from '@/types/learning-analytics';
import { formatDurationMs, formatRate, formatVersionLabel } from '@/lib/formatAnalytics';
import { AnalyticsEmptyState } from './AnalyticsEmptyState';

const INACTIVITY_LIKELY_ABANDONED_MS = 24 * 60 * 60 * 1000; // matches backend default drop-off threshold

function sessionStatusLabel(session: AnalyticsUserJourneySession): string {
  if (session.status === 'completed') return 'Completed';
  if (session.explicit_exit_at) return 'Exited';
  const lastActivity = new Date(session.last_activity_at).getTime();
  if (Date.now() - lastActivity > INACTIVITY_LIKELY_ABANDONED_MS) {
    return 'Inactive / likely abandoned';
  }
  return 'In progress';
}

function sessionDurationMs(session: AnalyticsUserJourneySession): number | null {
  if (!session.completed_at) return null;
  return new Date(session.completed_at).getTime() - new Date(session.started_at).getTime();
}

/** Renders sessions in EXACTLY the order the backend returned them
 * (started_at ASC, id ASC) - this component must never re-sort using
 * lesson_attempt_number, which is informational only and proven not
 * concurrency-safe (see LEARNING_ANALYTICS_METRICS.md). */
export default function LearnerJourneyTimeline({ sessions }: { sessions: AnalyticsUserJourneySession[] }) {
  if (sessions.length === 0) {
    return (
      <AnalyticsEmptyState
        message="No structured learning analytics recorded for this learner yet."
        hint="Possible reasons: an older app version, no lessons started, or analytics instrumentation not yet shipped to this user's client."
      />
    );
  }

  return (
    <ol className="space-y-4">
      {sessions.map((session, idx) => {
        const status = sessionStatusLabel(session);
        const isCompleted = session.status === 'completed';
        return (
          <li
            key={session.session_id}
            className="relative rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  #{idx + 1} · {new Date(session.started_at).toLocaleString()}
                </p>
                <p className="font-medium text-gray-900 dark:text-white">{session.blueprint_key}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{session.lesson_kind}</p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  isCompleted
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                    : status === 'Inactive / likely abandoned'
                    ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    : status === 'Exited'
                    ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                }`}
              >
                {status}
              </span>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-gray-400 dark:text-gray-500">Final score</dt>
                <dd className="text-gray-900 dark:text-white">{session.final_score ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 dark:text-gray-500">Exercises</dt>
                <dd className="text-gray-900 dark:text-white">
                  {session.completed_steps ?? '—'} / {session.total_steps ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 dark:text-gray-500">Attempts</dt>
                <dd className="text-gray-900 dark:text-white">{session.attempt_count}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 dark:text-gray-500">First-attempt accuracy</dt>
                <dd className="text-gray-900 dark:text-white">{formatRate(session.first_attempt_accuracy)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 dark:text-gray-500">Duration</dt>
                <dd className="text-gray-900 dark:text-white">{formatDurationMs(sessionDurationMs(session))}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 dark:text-gray-500">Content version</dt>
                <dd className="text-gray-900 dark:text-white" title={session.blueprint_content_hash ?? undefined}>
                  {formatVersionLabel(session.blueprint_content_hash)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 dark:text-gray-500">App version</dt>
                <dd className="text-gray-900 dark:text-white">{session.app_version ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 dark:text-gray-500">Platform</dt>
                <dd className="text-gray-900 dark:text-white">{session.platform ?? '—'}</dd>
              </div>
            </dl>
          </li>
        );
      })}
    </ol>
  );
}

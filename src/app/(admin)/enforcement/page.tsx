"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

/**
 * Slice 2.9: Minimal Dashboard Observability UI for Phase 2 Enforcement
 * 
 * Read-only admin page that surfaces Slice 2.8 backend endpoints:
 * - GET /api/v1/admin/enforcement/flags
 * - GET /api/v1/admin/enforcement/events
 * - GET /api/v1/admin/enforcement/metrics
 * 
 * IMPORTANT: This UI is read-only. No flag editing/toggling capability.
 */

interface EnforcementFlag {
  flag_name: string;
  enabled: boolean;
  description: string;
  category: string;
  impact: string;
  default_value: boolean;
}

interface EnforcementFlagsResponse {
  flags: EnforcementFlag[];
  timestamp: string;
  environment: string;
}

interface EventSummary {
  event_type: string;
  flag_name: string;
  count: number;
  lesson_count: number;
  sample_lesson_keys: string[];
  last_occurrence: string;
}

interface EnforcementEventsResponse {
  time_period_hours: number;
  total_events: number;
  summaries: EventSummary[];
  timestamp: string;
}

interface SchemaVersionDist {
  version: number;
  count: number;
  percentage: number;
}

interface EnforcementMetricsResponse {
  publish_rejections_24h: number;
  runtime_downgrades_24h: number;
  schema_version_distribution: SchemaVersionDist[];
  total_blueprints: number;
  available_blueprints: number;
  coming_soon_blueprints: number;
  timestamp: string;
}

// API fetch functions. Routed through apiClient (not raw fetch) so the
// /api/v1/admin/ -> /api/admin/ proxy rewrite and Authorization header
// (sessionStorage, not localStorage — this is the only place that used to
// read the wrong storage) are handled the same way as every other admin page.
async function fetchEnforcementFlags(): Promise<EnforcementFlagsResponse> {
  const response = await apiClient.get<EnforcementFlagsResponse>(
    "/api/v1/admin/enforcement/flags"
  );
  return response.data;
}

async function fetchEnforcementEvents(hours: number = 24): Promise<EnforcementEventsResponse> {
  const response = await apiClient.get<EnforcementEventsResponse>(
    `/api/v1/admin/enforcement/events?hours=${hours}`
  );
  return response.data;
}

async function fetchEnforcementMetrics(): Promise<EnforcementMetricsResponse> {
  const response = await apiClient.get<EnforcementMetricsResponse>(
    "/api/v1/admin/enforcement/metrics"
  );
  return response.data;
}

export default function EnforcementObservabilityPage() {
  const [eventTimeRange, setEventTimeRange] = useState<number>(24);

  // Query hooks
  const {
    data: flagsData,
    isLoading: flagsLoading,
    error: flagsError,
  } = useQuery({
    queryKey: ["enforcement-flags"],
    queryFn: fetchEnforcementFlags,
    refetchInterval: 60000, // Refresh every minute
  });

  const {
    data: eventsData,
    isLoading: eventsLoading,
    error: eventsError,
  } = useQuery({
    queryKey: ["enforcement-events", eventTimeRange],
    queryFn: () => fetchEnforcementEvents(eventTimeRange),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const {
    data: metricsData,
    isLoading: metricsLoading,
    error: metricsError,
  } = useQuery({
    queryKey: ["enforcement-metrics"],
    queryFn: fetchEnforcementMetrics,
    refetchInterval: 60000, // Refresh every minute
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Phase 2 Enforcement Observability
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Monitor enforcement flag states, events, and system metrics. Read-only view. (Slice 2.8 + 2.9)
          </p>
        </div>

        {/* Enforcement Flags Section */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Enforcement Flags
          </h2>
          {flagsLoading && <div className="text-gray-600">Loading flags...</div>}
          {flagsError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              Error: {flagsError.message}
            </div>
          )}
          {flagsData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {flagsData.flags.map((flag) => (
                <div
                  key={flag.flag_name}
                  className={`p-4 rounded-lg border-2 ${
                    flag.enabled
                      ? "bg-green-50 border-green-300 dark:bg-green-900/20 dark:border-green-700"
                      : "bg-gray-50 border-gray-300 dark:bg-gray-800 dark:border-gray-700"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {flag.flag_name}
                        </h3>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${
                            flag.enabled
                              ? "bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200"
                              : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                          }`}
                        >
                          {flag.enabled ? "ON" : "OFF"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {flag.description}
                      </p>
                      <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-500">
                        <span>
                          <strong>Category:</strong> {flag.category}
                        </span>
                        <span>
                          <strong>Impact:</strong> {flag.impact}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-500 font-mono">
                    {flag.flag_name}
                  </div>
                </div>
              ))}
            </div>
          )}
          {flagsData && (
            <div className="mt-4 text-xs text-gray-500 dark:text-gray-500">
              Last updated: {new Date(flagsData.timestamp).toLocaleString()}
            </div>
          )}
        </section>

        {/* Quick Metrics Section */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Quick Metrics (24h)
          </h2>
          {metricsLoading && <div className="text-gray-600">Loading metrics...</div>}
          {metricsError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              Error: {metricsError.message}
            </div>
          )}
          {metricsData && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Publish Rejections
                </div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {metricsData.publish_rejections_24h}
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Runtime Downgrades
                </div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {metricsData.runtime_downgrades_24h}
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Available Blueprints
                </div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {metricsData.available_blueprints}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  of {metricsData.total_blueprints} total
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Coming Soon
                </div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {metricsData.coming_soon_blueprints}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {((metricsData.coming_soon_blueprints / metricsData.total_blueprints) * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Schema Version Distribution */}
        {metricsData && metricsData.schema_version_distribution.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Schema Version Distribution
            </h2>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Version
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Count
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Percentage
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {metricsData.schema_version_distribution.map((dist) => (
                    <tr key={dist.version}>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-white font-mono">
                        v{dist.version}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                        {dist.count}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded h-2">
                            <div
                              className="bg-blue-600 dark:bg-blue-500 h-2 rounded"
                              style={{ width: `${dist.percentage}%` }}
                            />
                          </div>
                          <span className="text-xs">{dist.percentage.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Enforcement Events Section */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Enforcement Events
            </h2>
            <div className="flex gap-2">
              {[1, 24, 72, 168].map((hours) => (
                <button
                  key={hours}
                  onClick={() => setEventTimeRange(hours)}
                  className={`px-3 py-1 text-sm rounded ${
                    eventTimeRange === hours
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                  }`}
                >
                  {hours}h
                </button>
              ))}
            </div>
          </div>
          {eventsLoading && <div className="text-gray-600">Loading events...</div>}
          {eventsError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              Error: {eventsError.message}
            </div>
          )}
          {eventsData && (
            <>
              <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                Showing {eventsData.total_events} events in the last {eventsData.time_period_hours} hours
              </div>
              {eventsData.summaries.length === 0 ? (
                <div className="bg-gray-50 dark:bg-gray-800 p-8 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
                  <p className="text-gray-600 dark:text-gray-400">
                    No enforcement events in the selected time period.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {eventsData.summaries.map((summary, idx) => (
                    <div
                      key={idx}
                      className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {summary.event_type.replace(/_/g, " ").toUpperCase()}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Flag: <span className="font-mono">{summary.flag_name}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-gray-900 dark:text-white">
                            {summary.count}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-500">events</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Lessons Affected:</span>
                          <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                            {summary.lesson_count}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Last Occurrence:</span>
                          <span className="ml-2 font-mono text-xs text-gray-900 dark:text-white">
                            {new Date(summary.last_occurrence).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      {summary.sample_lesson_keys.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                            Sample Lessons:
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {summary.sample_lesson_keys.slice(0, 5).map((key) => (
                              <span
                                key={key}
                                className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-xs font-mono rounded"
                              >
                                {key}
                              </span>
                            ))}
                            {summary.sample_lesson_keys.length > 5 && (
                              <span className="px-2 py-1 text-xs text-gray-500">
                                +{summary.sample_lesson_keys.length - 5} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* Footer Note */}
        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-900 dark:text-blue-200">
            <strong>Note:</strong> This page is read-only. To modify enforcement flags, use the
            backend admin API or environment variables. See{" "}
            <a href="#" className="underline">
              PHASE2_CANARY_ROLLOUT_PLAN.md
            </a>{" "}
            for safe rollout procedures.
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { apiClient } from "@/lib/api";
import Alert from "@/components/ui/alert/SimpleAlert";

interface CronJob {
  name: string;
  schedule: string;
  enabled: boolean;
  next_run: string;
  last_run: string | null;
  last_status: string | null;
  description: string;
}

interface CronJobRun {
  job_name: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  duration_seconds: number | null;
  error_message: string | null;
}

interface CronJobsResponse {
  jobs: CronJob[];
  recent_runs: CronJobRun[];
  total_jobs: number;
  enabled_jobs: number;
}

function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(dateStr: string | null): string {
  const date = parseDate(dateStr);
  return date ? date.toLocaleString() : "Never";
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "N/A";
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${(seconds / 60).toFixed(1)}m`;
}

export default function CronJobsPage() {
  const [data, setData] = useState<CronJobsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const response = await apiClient.get("/api/v1/admin/cron/jobs");
      const payload = response.data ?? {};

      const safeData: CronJobsResponse = {
        jobs: Array.isArray(payload.jobs) ? payload.jobs : [],
        recent_runs: Array.isArray(payload.recent_runs) ? payload.recent_runs : [],
        total_jobs: Number.isFinite(payload.total_jobs) ? payload.total_jobs : 0,
        enabled_jobs: Number.isFinite(payload.enabled_jobs) ? payload.enabled_jobs : 0,
      };

      setData(safeData);
      setLastUpdatedAt(new Date());
      setError(null);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const message = typeof detail === "string" ? detail : err?.message;
      setError(message || "Failed to fetch cron jobs");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 60000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const jobs = useMemo(() => {
    if (!data) return [];
    return [...data.jobs].sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const recentRuns = useMemo(() => {
    if (!data) return [];
    return [...data.recent_runs].sort((a, b) => {
      const left = parseDate(a.started_at)?.getTime() ?? 0;
      const right = parseDate(b.started_at)?.getTime() ?? 0;
      return right - left;
    });
  }, [data]);

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "success":
      case "completed":
        return (
          <span className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
            Success
          </span>
        );
      case "failed":
      case "error":
        return (
          <span className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-200">
            Failed
          </span>
        );
      case "running":
      case "processing":
        return (
          <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            Running
          </span>
        );
      default:
        return (
          <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200">
            Unknown
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <PageBreadcrumb pageTitle="Cron Jobs" />
        <button
          type="button"
          onClick={fetchJobs}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {error && (
        <Alert variant="error" className="mb-6">
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <div className="space-y-3">
            {Array.from({ length: 8 }, (_, idx) => (
              <div key={idx} className="h-10 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        </div>
      ) : !data ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
          No cron data available.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Jobs</h3>
              <p className="mt-2 text-3xl font-bold text-gray-800 dark:text-white">{data.total_jobs}</p>
            </div>
            <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Enabled</h3>
              <p className="mt-2 text-3xl font-bold text-green-600 dark:text-green-400">{data.enabled_jobs}</p>
            </div>
            <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Disabled</h3>
              <p className="mt-2 text-3xl font-bold text-gray-600 dark:text-gray-400">
                {Math.max(0, data.total_jobs - data.enabled_jobs)}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
            <div className="border-b border-gray-200 p-6 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Scheduled Jobs</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Job Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Schedule
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Next Run
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Last Run
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Last Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {jobs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                        No scheduled jobs found.
                      </td>
                    </tr>
                  ) : (
                    jobs.map((job) => (
                      <tr key={job.name} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-800 dark:text-white">{job.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{job.description || "—"}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                          <code className="rounded bg-gray-100 px-2 py-1 dark:bg-gray-700">{job.schedule}</code>
                        </td>
                        <td className="px-6 py-4">
                          {job.enabled ? (
                            <span className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                              Enabled
                            </span>
                          ) : (
                            <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                              Disabled
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{formatDate(job.next_run)}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{formatDate(job.last_run)}</td>
                        <td className="px-6 py-4">{getStatusBadge(job.last_status)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
            <div className="border-b border-gray-200 p-6 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Recent Executions</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Job Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Started
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Completed
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Error
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {recentRuns.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                        No recent executions found.
                      </td>
                    </tr>
                  ) : (
                    recentRuns.map((run, index) => (
                      <tr key={`${run.job_name}-${run.started_at}-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-800 dark:text-white">{run.job_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{formatDate(run.started_at)}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{formatDate(run.completed_at)}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{formatDuration(run.duration_seconds)}</td>
                        <td className="px-6 py-4">{getStatusBadge(run.status)}</td>
                        <td className="max-w-md px-6 py-4 text-sm text-red-600 dark:text-red-400">
                          {run.error_message ? <span className="block truncate">{run.error_message}</span> : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            Auto-refreshing every minute
            {lastUpdatedAt ? ` • Last updated ${lastUpdatedAt.toLocaleTimeString()}` : ""}
          </div>
        </div>
      )}
    </div>
  );
}

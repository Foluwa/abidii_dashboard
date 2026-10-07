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

export function CronJobsContent({ showHeader = true, isActive = true }: { showHeader?: boolean; isActive?: boolean }) {
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
    if (!isActive) return;
    fetchJobs();
    const interval = setInterval(fetchJobs, 60000);
    return () => clearInterval(interval);
  }, [fetchJobs, isActive]);

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
          <span className="rounded bg-muted px-2 py-1 text-xs font-medium text-foreground">
            Unknown
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        {showHeader ? <PageBreadcrumb pageTitle="Cron Jobs" /> : <div />}
        <button
          type="button"
          onClick={fetchJobs}
          className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
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
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="space-y-3">
            {Array.from({ length: 8 }, (_, idx) => (
              <div key={idx} className="h-10 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </div>
      ) : !data ? (
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          No cron data available.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-lg bg-card p-6 shadow">
              <h3 className="text-sm font-medium text-muted-foreground">Total Jobs</h3>
              <p className="mt-2 text-3xl font-bold text-foreground">{data.total_jobs}</p>
            </div>
            <div className="rounded-lg bg-card p-6 shadow">
              <h3 className="text-sm font-medium text-muted-foreground">Enabled</h3>
              <p className="mt-2 text-3xl font-bold text-green-600 dark:text-green-400">{data.enabled_jobs}</p>
            </div>
            <div className="rounded-lg bg-card p-6 shadow">
              <h3 className="text-sm font-medium text-muted-foreground">Disabled</h3>
              <p className="mt-2 text-3xl font-bold text-muted-foreground">
                {Math.max(0, data.total_jobs - data.enabled_jobs)}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg bg-card shadow">
            <div className="border-b border-border p-6">
              <h3 className="text-lg font-semibold text-foreground">Scheduled Jobs</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-sm font-medium text-muted-foreground">
                      Job Name
                    </th>
                    <th className="px-3 py-2.5 text-left text-sm font-medium text-muted-foreground">
                      Schedule
                    </th>
                    <th className="px-3 py-2.5 text-left text-sm font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="px-3 py-2.5 text-left text-sm font-medium text-muted-foreground">
                      Next Run
                    </th>
                    <th className="px-3 py-2.5 text-left text-sm font-medium text-muted-foreground">
                      Last Run
                    </th>
                    <th className="px-3 py-2.5 text-left text-sm font-medium text-muted-foreground">
                      Last Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {jobs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">
                        No scheduled jobs found.
                      </td>
                    </tr>
                  ) : (
                    jobs.map((job) => (
                      <tr key={job.name} className="hover:bg-accent">
                        <td className="px-3 py-2.5">
                          <div>
                            <div className="text-sm font-medium text-foreground">{job.name}</div>
                            <div className="text-xs text-muted-foreground">{job.description || "—"}</div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-sm text-muted-foreground">
                          <code className="rounded bg-muted px-2 py-1">{job.schedule}</code>
                        </td>
                        <td className="px-3 py-2.5">
                          {job.enabled ? (
                            <span className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                              Enabled
                            </span>
                          ) : (
                            <span className="rounded bg-muted px-2 py-1 text-xs font-medium text-foreground">
                              Disabled
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-sm text-muted-foreground">{formatDate(job.next_run)}</td>
                        <td className="px-3 py-2.5 text-sm text-muted-foreground">{formatDate(job.last_run)}</td>
                        <td className="px-3 py-2.5">{getStatusBadge(job.last_status)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg bg-card shadow">
            <div className="border-b border-border p-6">
              <h3 className="text-lg font-semibold text-foreground">Recent Executions</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-sm font-medium text-muted-foreground">
                      Job Name
                    </th>
                    <th className="px-3 py-2.5 text-left text-sm font-medium text-muted-foreground">
                      Started
                    </th>
                    <th className="px-3 py-2.5 text-left text-sm font-medium text-muted-foreground">
                      Completed
                    </th>
                    <th className="px-3 py-2.5 text-left text-sm font-medium text-muted-foreground">
                      Duration
                    </th>
                    <th className="px-3 py-2.5 text-left text-sm font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="px-3 py-2.5 text-left text-sm font-medium text-muted-foreground">
                      Error
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentRuns.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">
                        No recent executions found.
                      </td>
                    </tr>
                  ) : (
                    recentRuns.map((run, index) => (
                      <tr key={`${run.job_name}-${run.started_at}-${index}`} className="hover:bg-accent">
                        <td className="px-3 py-2.5 text-sm font-medium text-foreground">{run.job_name}</td>
                        <td className="px-3 py-2.5 text-sm text-muted-foreground">{formatDate(run.started_at)}</td>
                        <td className="px-3 py-2.5 text-sm text-muted-foreground">{formatDate(run.completed_at)}</td>
                        <td className="px-3 py-2.5 text-sm text-muted-foreground">{formatDuration(run.duration_seconds)}</td>
                        <td className="px-3 py-2.5">{getStatusBadge(run.status)}</td>
                        <td className="max-w-md px-3 py-2.5 text-sm text-red-600 dark:text-red-400">
                          {run.error_message ? <span className="block truncate">{run.error_message}</span> : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            Auto-refreshing every minute
            {lastUpdatedAt ? ` • Last updated ${lastUpdatedAt.toLocaleTimeString()}` : ""}
          </div>
        </div>
      )}
    </div>
  );
}

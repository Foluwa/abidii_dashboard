"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Pagination from "@/components/tables/Pagination";
import Button from "@/components/ui/button/Button";
import {
  getMlReadiness,
  getMlTrainingJob,
  getMlTrainingJobLogs,
  applyVerifiedPromotionManifest,
  dryRunVerifiedPromotionManifest,
  generateVerifiedPromotionManifest,
  getVerifiedPromotionCollectionGaps,
  getVerifiedPromotionCandidatePreview,
  getVerifiedPromotionManifest,
  getVerifiedPromotionReadiness,
  listMlModelVersions,
  listMlTrainingJobs,
  listVerifiedPromotionCandidates,
  listVerifiedPromotionManifests,
  promoteMlModelVersion,
  rollbackMlModelVersion,
  updateVerifiedPromotionCandidates,
  type MlModelVersion,
  type MlReadinessResponse,
  type MlTrainingJob,
  type MlTrainingJobEvent,
  type VerifiedPromotionCandidate,
  type VerifiedPromotionCollectionGapResponse,
  type VerifiedPromotionManifest,
  type VerifiedPromotionReadinessResponse,
  validateVerifiedPromotionManifest,
} from "@/lib/adminMlApi";

const PAGE_SIZE = 20;

function formatDate(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatPercent(value?: number | null) {
  return `${Math.round(Number(value || 0))}%`;
}

function formatMetricPercent(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function formatNumber(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString();
}

function pickMetric(metrics: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!metrics) return null;
  for (const key of keys) {
    const value = metrics[key];
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) return Number(value);
  }
  return null;
}

function statusClass(status?: string | null) {
  if (status === "succeeded" || status === "production" || status === "active") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
  }
  if (status === "failed" || status === "error") {
    return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
  }
  if (status === "running" || status === "staging") {
    return "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200";
  }
  if (status === "queued") {
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
  }
  return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
}

function StatusPill({ status }: { status?: string | null }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(status)}`}>
      {status || "unknown"}
    </span>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
      {message}
    </div>
  );
}

function InlineSuccess({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
      {message}
    </div>
  );
}

function LoadingBlock({ label = "Loading..." }: { label?: string }) {
  return <div className="rounded-lg border border-gray-200 p-4 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">{label}</div>;
}

function SummaryCard({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{value}</div>
      {detail ? <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{detail}</div> : null}
    </div>
  );
}

function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function JsonPreview({ value }: { value: unknown }) {
  return (
    <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-4 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-300">
      {JSON.stringify(value ?? {}, null, 2)}
    </pre>
  );
}

function getLatestSmoke(jobs: MlTrainingJob[]) {
  return jobs.find((job) => {
    const path = job.dataset_path || "";
    const params = job.parameters || {};
    return path.startsWith("smoke://") || params.smoke_test_only === true || params.diagnostic_hold_seconds === 0;
  });
}

function useMlOverview() {
  const [readiness, setReadiness] = useState<MlReadinessResponse | null>(null);
  const [jobs, setJobs] = useState<MlTrainingJob[]>([]);
  const [models, setModels] = useState<MlModelVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [readinessData, jobData, modelData] = await Promise.all([
        getMlReadiness(300),
        listMlTrainingJobs({ limit: 50, offset: 0 }),
        listMlModelVersions({ limit: 20, offset: 0 }),
      ]);
      setReadiness(readinessData);
      setJobs(jobData.items);
      setModels(modelData.items);
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.response?.data?.detail ?? err?.message ?? "Unable to load ML training data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { readiness, jobs, models, loading, error, refresh };
}

export function MLTrainingOverviewPage() {
  const { readiness, jobs, models, loading, error, refresh } = useMlOverview();
  const latestSmoke = useMemo(() => getLatestSmoke(jobs), [jobs]);
  const runningJobs = readiness?.training_jobs.running || 0;
  const succeededJobs = readiness?.training_jobs.succeeded || 0;

  return (
    <div className="space-y-6 p-6">
      <PageBreadCrumb pageTitle="ML Training" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ML Training</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Remote handwriting training readiness, smoke status, jobs, and model versions.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/operations/ml-training/jobs">
            <Button variant="outline" size="sm">Jobs</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>Refresh</Button>
        </div>
      </div>

      {error ? <InlineError message={error} /> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Readiness Threshold" value={readiness?.threshold ?? "-"} detail="verified samples per label gate" />
        <SummaryCard label="Running Jobs" value={runningJobs} />
        <SummaryCard label="Succeeded Jobs" value={succeededJobs} />
        <SummaryCard label="Model Versions" value={models.length} detail={`${readiness?.model_versions.production || 0} production`} />
      </div>

      <Panel title="Dataset Readiness">
        {loading && !readiness ? (
          <LoadingBlock />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-800">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                  <th className="px-3 py-2">Language</th>
                  <th className="px-3 py-2">Labels</th>
                  <th className="px-3 py-2">Gate</th>
                  <th className="px-3 py-2">Sample Labels</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {(readiness?.languages || []).map((language) => (
                  <tr key={language.language_code}>
                    <td className="px-3 py-3 font-medium text-gray-900 dark:text-white">{language.language_code}</td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{language.label_count}</td>
                    <td className="px-3 py-3"><StatusPill status={language.label_count > 0 ? "active" : "pending"} /></td>
                    <td className="px-3 py-3 text-gray-500 dark:text-gray-400">{language.labels.slice(0, 12).join(", ")}{language.labels.length > 12 ? "..." : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Latest Smoke Status" action={<Link className="text-sm font-medium text-brand-600" href="/operations/ml-training/jobs">View all</Link>}>
          {latestSmoke ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2"><StatusPill status={latestSmoke.status} /><span className="text-gray-700 dark:text-gray-300">{latestSmoke.current_stage}</span></div>
              <div className="font-mono text-xs text-gray-500 dark:text-gray-400">{latestSmoke.id}</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>Progress: {formatPercent(latestSmoke.progress_percentage)}</div>
                <div>Executor: {latestSmoke.executor_type}</div>
                <div>Instance: {latestSmoke.external_job_id || "-"}</div>
                <div>Finished: {formatDate(latestSmoke.finished_at)}</div>
              </div>
            </div>
          ) : loading ? <LoadingBlock /> : <div className="text-sm text-gray-500 dark:text-gray-400">No smoke jobs found.</div>}
        </Panel>

        <Panel title="Training Trigger">
          <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <p>Full training launch remains intentionally disabled from the dashboard until backend execution is approved.</p>
            <Button disabled size="sm">Start Training Coming Soon</Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function JobsTable({ jobs }: { jobs: MlTrainingJob[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-800">
        <thead>
          <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Language</th>
            <th className="px-3 py-2">Stage</th>
            <th className="px-3 py-2">Progress</th>
            <th className="px-3 py-2">Created</th>
            <th className="px-3 py-2">Instance</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {jobs.map((job) => (
            <tr key={job.id}>
              <td className="px-3 py-3"><StatusPill status={job.status} /></td>
              <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{job.language_code || "-"}</td>
              <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{job.current_stage}</td>
              <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{formatPercent(job.progress_percentage)}</td>
              <td className="px-3 py-3 text-gray-500 dark:text-gray-400">{formatDate(job.created_at)}</td>
              <td className="max-w-48 truncate px-3 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{job.external_job_id || "-"}</td>
              <td className="px-3 py-3 text-right">
                <Link className="text-sm font-medium text-brand-600" href={`/operations/ml-training/jobs/${job.id}`}>Open</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MLTrainingJobsPage() {
  const [jobs, setJobs] = useState<MlTrainingJob[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offset = (page - 1) * PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listMlTrainingJobs({
        status: statusFilter || undefined,
        language_code: languageFilter || undefined,
        limit: PAGE_SIZE,
        offset,
      });
      setJobs(response.items);
      setTotal(response.total);
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? "Unable to load ML training jobs.");
    } finally {
      setLoading(false);
    }
  }, [languageFilter, offset, statusFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-6 p-6">
      <PageBreadCrumb pageTitle="Training Jobs" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Training Jobs</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Queued, running, and completed ML training jobs.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>Refresh</Button>
      </div>
      {error ? <InlineError message={error} /> : null}
      <Panel title="Jobs">
        <div className="mb-4 flex flex-wrap gap-3">
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white">
            <option value="">All statuses</option>
            {["queued", "running", "succeeded", "failed", "cancelled"].map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <select value={languageFilter} onChange={(event) => { setLanguageFilter(event.target.value); setPage(1); }} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white">
            <option value="">All languages</option>
            <option value="yor">yor</option>
            <option value="eng">eng</option>
          </select>
        </div>
        {loading && jobs.length === 0 ? <LoadingBlock /> : jobs.length > 0 ? <JobsTable jobs={jobs} /> : <div className="text-sm text-gray-500 dark:text-gray-400">No jobs found.</div>}
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </Panel>
    </div>
  );
}

function metadataFromJob(job: MlTrainingJob) {
  const params = job.parameters || {};
  return {
    executor: job.executor_type,
    lambda_instance_id: job.external_job_id,
    logs_path: job.logs_path,
    dataset_path: job.dataset_path,
    dataset_version: job.dataset_version,
    model_target: job.model_status_target,
    callback_token_redacted: params.callback_token_redacted === true,
  };
}

export function MLTrainingJobDetailPage() {
  const params = useParams<{ id: string }>();
  const jobId = params?.id;
  const [job, setJob] = useState<MlTrainingJob | null>(null);
  const [events, setEvents] = useState<MlTrainingJobEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const [jobData, logsData] = await Promise.all([getMlTrainingJob(jobId), getMlTrainingJobLogs(jobId)]);
      setJob(jobData);
      setEvents(logsData.events);
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? "Unable to load training job.");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-6 p-6">
      <PageBreadCrumb pageTitle="Training Job Detail" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Training Job Detail</h1>
          <p className="mt-1 font-mono text-xs text-gray-500 dark:text-gray-400">{jobId}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>Refresh</Button>
      </div>
      {error ? <InlineError message={error} /> : null}
      {loading && !job ? <LoadingBlock /> : null}
      {job ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <SummaryCard label="Status" value={job.status} detail={job.current_stage} />
            <SummaryCard label="Progress" value={formatPercent(job.progress_percentage)} />
            <SummaryCard label="Language" value={job.language_code || "-"} />
            <SummaryCard label="Attempts" value={`${job.attempt_count}/${job.max_attempts}`} />
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div className="h-full bg-brand-500" style={{ width: `${Math.min(100, Math.max(0, Number(job.progress_percentage || 0)))}%` }} />
          </div>
          {job.error_message ? <InlineError message={job.error_message} /> : null}
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Lambda Metadata"><JsonPreview value={metadataFromJob(job)} /></Panel>
            <Panel title="Timing">
              <div className="grid gap-3 text-sm text-gray-700 dark:text-gray-300">
                <div>Queued: {formatDate(job.queued_at)}</div>
                <div>Started: {formatDate(job.started_at)}</div>
                <div>Heartbeat: {formatDate(job.heartbeat_at)}</div>
                <div>Finished: {formatDate(job.finished_at)}</div>
              </div>
            </Panel>
          </div>
          <Panel title="Events / Logs">
            <div className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <StatusPill status={event.event_type} />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{event.message}</span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(event.created_at)}</span>
                  </div>
                  {event.details ? <div className="mt-3"><JsonPreview value={event.details} /></div> : null}
                </div>
              ))}
              {events.length === 0 ? <div className="text-sm text-gray-500 dark:text-gray-400">No events recorded.</div> : null}
            </div>
          </Panel>
        </>
      ) : null}
    </div>
  );
}

export function MLModelVersionsPage() {
  const [models, setModels] = useState<MlModelVersion[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listMlModelVersions({
        status: statusFilter || undefined,
        language_code: languageFilter || undefined,
        limit: 50,
        offset: 0,
      });
      setModels(response.items);
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? "Unable to load model versions.");
    } finally {
      setLoading(false);
    }
  }, [languageFilter, statusFilter]);

  const runModelAction = useCallback(async (model: MlModelVersion, action: "promote" | "rollback") => {
    if (!model.id) return;
    setActionId(model.id);
    setError(null);
    setSuccess(null);
    try {
      const response = action === "promote"
        ? await promoteMlModelVersion(model.id)
        : await rollbackMlModelVersion(model.id);
      setSuccess(response.message);
      await refresh();
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? `Unable to ${action} model version.`);
    } finally {
      setActionId(null);
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-6 p-6">
      <PageBreadCrumb pageTitle="Model Versions" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Model Versions</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Staging and production handwriting model registry entries.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>Refresh</Button>
      </div>
      {error ? <InlineError message={error} /> : null}
      {success ? <InlineSuccess message={success} /> : null}
      <Panel title="Versions">
        <div className="mb-4 flex flex-wrap gap-3">
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white">
            <option value="">All statuses</option>
            <option value="staging">staging</option>
            <option value="production">production</option>
            <option value="archived">archived</option>
          </select>
          <select value={languageFilter} onChange={(event) => setLanguageFilter(event.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white">
            <option value="">All languages</option>
            <option value="yor">yor</option>
            <option value="eng">eng</option>
          </select>
        </div>
        {loading && models.length === 0 ? <LoadingBlock /> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-800">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Language</th>
                  <th className="px-3 py-2">Version</th>
                  <th className="px-3 py-2">Model</th>
                  <th className="px-3 py-2">Validation</th>
                  <th className="px-3 py-2">Test</th>
                  <th className="px-3 py-2">Samples</th>
                  <th className="px-3 py-2">Performance</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {models.map((model, index) => {
                  const busy = actionId === model.id;
                  const canPromote = Boolean(model.id) && model.status !== "production" && !busy;
                  const canRollback = Boolean(model.id) && model.status === "production" && !busy;
                  return (
                    <tr key={model.id || `${model.model_name}-${index}`}>
                      <td className="px-3 py-3"><StatusPill status={model.status} /></td>
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{model.language_code || "-"}</td>
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{model.version || "-"}</td>
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{model.model_name || model.model_type || "-"}</td>
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{formatMetricPercent(model.validation_accuracy)}</td>
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{formatMetricPercent(model.test_accuracy)}</td>
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{formatNumber(model.training_dataset_size)}</td>
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                        {formatMetricPercent(pickMetric(model.metrics, ["macro_f1", "f1_macro"]))}
                      </td>
                      <td className="px-3 py-3 text-gray-500 dark:text-gray-400">{formatDate(model.created_at)}</td>
                      <td className="px-3 py-3">
                        <div className="flex gap-2">
                          <Button
                            disabled={!canPromote}
                            size="sm"
                            variant="outline"
                            onClick={() => void runModelAction(model, "promote")}
                          >
                            {busy ? "Working..." : "Promote"}
                          </Button>
                          <Button
                            disabled={!canRollback}
                            size="sm"
                            variant="outline"
                            onClick={() => void runModelAction(model, "rollback")}
                          >
                            {busy ? "Working..." : "Rollback"}
                          </Button>
                        </div>
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {model.status === "production" ? "Rollback restores latest archived version." : "Promote makes this production."}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {models.length === 0 ? <div className="p-4 text-sm text-gray-500 dark:text-gray-400">No model versions found.</div> : null}
          </div>
        )}
      </Panel>
    </div>
  );
}

function countFor(manifest: VerifiedPromotionManifest, status: string) {
  return manifest.status_counts?.[status] ?? 0;
}

export function MLVerifiedPromotionManifestsPage() {
  const [manifests, setManifests] = useState<VerifiedPromotionManifest[]>([]);
  const [readiness, setReadiness] = useState<VerifiedPromotionReadinessResponse | null>(null);
  const [collectionGaps, setCollectionGaps] = useState<VerifiedPromotionCollectionGapResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [manifestResponse, readinessResponse, gapResponse] = await Promise.all([
        listVerifiedPromotionManifests(),
        getVerifiedPromotionReadiness(300),
        getVerifiedPromotionCollectionGaps({ target_low: 300, target_high: 500 }),
      ]);
      setManifests(manifestResponse.items);
      setReadiness(readinessResponse);
      setCollectionGaps(gapResponse);
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? "Unable to load verified promotion manifests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const generate = useCallback(async () => {
    if (!window.confirm("Generate a new pending manifest from R2 source pools? This is read-only but may take a while.")) return;
    setGenerating(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await generateVerifiedPromotionManifest("all");
      setSuccess(`Generated ${(result.run_id as string) || "new manifest"}.`);
      await refresh();
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? "Unable to generate manifest.");
    } finally {
      setGenerating(false);
    }
  }, [refresh]);

  return (
    <div className="space-y-6 p-6">
      <PageBreadCrumb pageTitle="Verified Dataset Review" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Verified Dataset Review</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Review handwriting samples before promotion into datasets/verified/*.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>Refresh</Button>
          <Button size="sm" onClick={() => void generate()} disabled={generating}>{generating ? "Generating..." : "Generate Pending Manifest"}</Button>
        </div>
      </div>
      {error ? <InlineError message={error} /> : null}
      {success ? <InlineSuccess message={success} /> : null}
      <Panel title="Verified Readiness" action={<Link href="/operations/ml-training" className="text-sm text-brand-600 hover:underline">ML Training overview</Link>}>
        <div className="grid gap-4 md:grid-cols-2">
          {(readiness?.languages || []).map((lang) => (
            <div key={lang.language} className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold uppercase text-gray-900 dark:text-white">{lang.language}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">target {lang.threshold}/class</div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <SummaryCard label="Ready Classes" value={lang.ready_count} />
                <SummaryCard label="Gaps" value={lang.not_ready_count} />
              </div>
              <div className="mt-3 max-h-40 overflow-auto text-xs text-gray-600 dark:text-gray-300">
                {lang.priority_gaps.slice(0, 20).map((gap) => (
                  <div key={gap.label} className="flex justify-between border-b border-gray-100 py-1 dark:border-gray-800">
                    <span>{gap.label}</span><span>{gap.count}/{lang.threshold}</span>
                  </div>
                ))}
                {lang.priority_gaps.length === 0 ? "All priority classes ready." : null}
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Missing / Low Sample Classes">
        <div className="mb-3 text-sm text-gray-600 dark:text-gray-400">
          Focused collection targets for handwriting classes blocking the verified-data gate. Counts include reviewed manifest approvals as pending impact, but do not assume promotion has been applied.
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-800">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                <th className="px-3 py-2">Class</th>
                <th className="px-3 py-2">Candidates</th>
                <th className="px-3 py-2">Approved Pending</th>
                <th className="px-3 py-2">Verified</th>
                <th className="px-3 py-2">Projected</th>
                <th className="px-3 py-2">Need 300</th>
                <th className="px-3 py-2">Need 500</th>
                <th className="px-3 py-2">Collection Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {(collectionGaps?.items || []).slice(0, 40).map((gap) => (
                <tr key={`${gap.language}-${gap.label}`} className="text-gray-700 dark:text-gray-200">
                  <td className="px-3 py-2 font-medium">{gap.language} {gap.label}</td>
                  <td className="px-3 py-2">{gap.current_candidates}</td>
                  <td className="px-3 py-2">{gap.approved_pending_samples}</td>
                  <td className="px-3 py-2">{gap.verified_samples}</td>
                  <td className="px-3 py-2">{gap.projected_after_approved_apply}</td>
                  <td className="px-3 py-2">{gap.needed_to_300}</td>
                  <td className="px-3 py-2">{gap.needed_to_500}</td>
                  <td className="px-3 py-2 font-medium">{gap.collection_target}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {collectionGaps?.items.length === 0 ? <div className="p-4 text-sm text-gray-500 dark:text-gray-400">No focused collection gaps available.</div> : null}
        </div>
      </Panel>
      <Panel title="Manifests">
        {loading && manifests.length === 0 ? <LoadingBlock /> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-800">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                  <th className="px-3 py-2">Manifest</th>
                  <th className="px-3 py-2">Candidates</th>
                  <th className="px-3 py-2">Approved</th>
                  <th className="px-3 py-2">Rejected</th>
                  <th className="px-3 py-2">Pending</th>
                  <th className="px-3 py-2">Validation</th>
                  <th className="px-3 py-2">Apply</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {manifests.map((manifest) => (
                  <tr key={manifest.id}>
                    <td className="px-3 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{manifest.id}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{formatDate(manifest.created_at)}</div>
                    </td>
                    <td className="px-3 py-3">{manifest.candidate_count}</td>
                    <td className="px-3 py-3">{countFor(manifest, "approved")}</td>
                    <td className="px-3 py-3">{countFor(manifest, "rejected")}</td>
                    <td className="px-3 py-3">{countFor(manifest, "pending")}</td>
                    <td className="px-3 py-3"><StatusPill status={manifest.validation_status} /></td>
                    <td className="px-3 py-3"><StatusPill status={manifest.apply_status} /></td>
                    <td className="px-3 py-3">
                      <Link href={`/operations/ml-training/manifests/${manifest.id}`} className="text-brand-600 hover:underline">Review</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {manifests.length === 0 ? <div className="p-4 text-sm text-gray-500 dark:text-gray-400">No manifests found.</div> : null}
          </div>
        )}
      </Panel>
    </div>
  );
}

function CandidatePreview({ manifestId, candidate }: { manifestId: string; candidate: VerifiedPromotionCandidate }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getVerifiedPromotionCandidatePreview(manifestId, candidate.candidate_id);
      setUrl(response.preview_url);
    } finally {
      setLoading(false);
    }
  }, [candidate.candidate_id, manifestId]);

  return (
    <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={candidate.label} loading="lazy" className="max-h-full max-w-full object-contain" />
      ) : (
        <button onClick={() => void load()} className="px-2 text-xs text-brand-600 hover:underline" disabled={loading}>
          {loading ? "Loading..." : "Preview"}
        </button>
      )}
    </div>
  );
}

export function MLVerifiedPromotionManifestDetailPage() {
  const params = useParams<{ id: string }>();
  const manifestId = String(params?.id || "");
  const [manifest, setManifest] = useState<VerifiedPromotionManifest | null>(null);
  const [candidates, setCandidates] = useState<VerifiedPromotionCandidate[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [language, setLanguage] = useState("");
  const [label, setLabel] = useState("");
  const [reviewStatus, setReviewStatus] = useState("");
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [conflictOnly, setConflictOnly] = useState(false);
  const [problemOnly, setProblemOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const limit = 25;

  const refresh = useCallback(async () => {
    if (!manifestId) return;
    setLoading(true);
    setError(null);
    try {
      const [detail, candidateResponse] = await Promise.all([
        getVerifiedPromotionManifest(manifestId),
        listVerifiedPromotionCandidates(manifestId, {
          language: language || undefined,
          label: label || undefined,
          review_status: reviewStatus || undefined,
          priority_only: priorityOnly,
          conflict_only: conflictOnly,
          problem_only: problemOnly,
          limit,
          offset,
        }),
      ]);
      setManifest(detail);
      setCandidates(candidateResponse.items);
      setTotal(candidateResponse.total);
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? "Unable to load manifest.");
    } finally {
      setLoading(false);
    }
  }, [conflictOnly, label, language, manifestId, offset, priorityOnly, problemOnly, reviewStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateVisible = useCallback(async (status: "pending" | "approved" | "rejected", candidateIds?: string[]) => {
    const ids = candidateIds || candidates.map((candidate) => candidate.candidate_id);
    if (ids.length === 0) return;
    if (candidateIds === undefined && !window.confirm(`Set ${ids.length} visible candidates to ${status}?`)) return;
    setError(null);
    setSuccess(null);
    try {
      const response = await updateVerifiedPromotionCandidates(manifestId, ids, status);
      setSuccess(`Updated ${response.updated} candidate(s).`);
      await refresh();
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? "Unable to update candidates.");
    }
  }, [candidates, manifestId, refresh]);

  const runPanelAction = useCallback(async (action: "validate" | "dry-run" | "apply") => {
    setError(null);
    setSuccess(null);
    try {
      let response: Record<string, unknown>;
      if (action === "validate") response = await validateVerifiedPromotionManifest(manifestId);
      else if (action === "dry-run") response = await dryRunVerifiedPromotionManifest(manifestId);
      else {
        const confirmation = window.prompt(`Type APPLY ${manifestId} to write approved samples to datasets/verified/*`);
        if (!confirmation) return;
        response = await applyVerifiedPromotionManifest(manifestId, confirmation);
      }
      setReport(response);
      setSuccess(`${action} completed.`);
      await refresh();
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? `Unable to ${action} manifest.`);
    }
  }, [manifestId, refresh]);

  return (
    <div className="space-y-6 p-6">
      <PageBreadCrumb pageTitle="Verified Manifest Review" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{manifestId}</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Approve or reject candidates before verified dataset promotion.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>Refresh</Button>
      </div>
      {error ? <InlineError message={error} /> : null}
      {success ? <InlineSuccess message={success} /> : null}
      {manifest ? (
        <div className="grid gap-4 md:grid-cols-4">
          <SummaryCard label="Candidates" value={manifest.candidate_count} />
          <SummaryCard label="Approved" value={countFor(manifest, "approved")} />
          <SummaryCard label="Rejected" value={countFor(manifest, "rejected")} />
          <SummaryCard label="Pending" value={countFor(manifest, "pending")} />
        </div>
      ) : null}
      <Panel title="Validation & Apply">
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          Apply writes approved samples to datasets/verified/*. Pending and rejected candidates are never promoted.
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void runPanelAction("validate")}>Validate Manifest</Button>
          <Button variant="outline" size="sm" onClick={() => void runPanelAction("dry-run")}>Dry-run Promotion</Button>
          <Button size="sm" onClick={() => void runPanelAction("apply")}>Apply Approved Promotion</Button>
        </div>
        {report ? <div className="mt-4"><JsonPreview value={report} /></div> : null}
      </Panel>
      <Panel title="Candidates">
        <div className="mb-4 flex flex-wrap gap-3">
          <select value={language} onChange={(event) => { setOffset(0); setLanguage(event.target.value); }} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white">
            <option value="">All languages</option><option value="yor">yor</option><option value="eng">eng</option>
          </select>
          <select value={reviewStatus} onChange={(event) => { setOffset(0); setReviewStatus(event.target.value); }} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white">
            <option value="">All statuses</option><option value="pending">pending</option><option value="approved">approved</option><option value="rejected">rejected</option>
          </select>
          <input value={label} onChange={(event) => { setOffset(0); setLabel(event.target.value); }} placeholder="Label" className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked={priorityOnly} onChange={(event) => { setOffset(0); setPriorityOnly(event.target.checked); }} /> Priority only</label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked={conflictOnly} onChange={(event) => { setOffset(0); setConflictOnly(event.target.checked); }} /> Conflicts</label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked={problemOnly} onChange={(event) => { setOffset(0); setProblemOnly(event.target.checked); }} /> Problems</label>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void updateVisible("approved")}>Approve Visible</Button>
          <Button variant="outline" size="sm" onClick={() => void updateVisible("rejected")}>Reject Visible</Button>
          <Button variant="outline" size="sm" onClick={() => void updateVisible("pending")}>Reset Visible</Button>
        </div>
        <div className="space-y-3">
          {candidates.map((candidate) => (
            <div key={candidate.candidate_id} className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="flex flex-col gap-4 md:flex-row">
                <CandidatePreview manifestId={manifestId} candidate={candidate} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={candidate.review_status} />
                    {candidate.label_conflict ? <StatusPill status="conflict" /> : null}
                    <span className="font-semibold text-gray-900 dark:text-white">{candidate.language} / {candidate.canonical_label}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{candidate.source_type}</span>
                  </div>
                  <div className="mt-2 break-all text-xs text-gray-500 dark:text-gray-400">{candidate.source_key}</div>
                  <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                    prediction {candidate.model_prediction || "-"} · confidence {candidate.confidence ?? "-"} · {candidate.width}x{candidate.height}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(candidate.reason_for_inclusion || []).map((reason) => <span key={reason} className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">{reason}</span>)}
                  </div>
                </div>
                <div className="flex shrink-0 flex-row gap-2 md:flex-col">
                  <Button size="sm" variant="outline" onClick={() => void updateVisible("approved", [candidate.candidate_id])}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => void updateVisible("rejected", [candidate.candidate_id])}>Reject</Button>
                  <Button size="sm" variant="outline" onClick={() => void updateVisible("pending", [candidate.candidate_id])}>Pending</Button>
                </div>
              </div>
            </div>
          ))}
          {loading ? <LoadingBlock /> : null}
          {!loading && candidates.length === 0 ? <div className="text-sm text-gray-500 dark:text-gray-400">No candidates match these filters.</div> : null}
        </div>
        <div className="mt-4">
          <Pagination currentPage={Math.floor(offset / limit) + 1} totalPages={Math.max(1, Math.ceil(total / limit))} onPageChange={(page) => setOffset((page - 1) * limit)} />
        </div>
      </Panel>
      <ConfirmationModal
        isOpen={!!visibleUpdateConfirm}
        onClose={() => setVisibleUpdateConfirm(null)}
        onConfirm={() => {
          if (visibleUpdateConfirm) void updateVisible(visibleUpdateConfirm.status, visibleUpdateConfirm.ids, true);
        }}
        title="Update Visible Candidates"
        message={`Set ${visibleUpdateConfirm?.ids.length || 0} visible candidates to ${visibleUpdateConfirm?.status || "pending"}?`}
        confirmText="Update Candidates"
        variant="warning"
        isLoading={loading}
      />
      <Modal
        isOpen={applyConfirmOpen}
        onClose={() => {
          if (!promotionLoading) {
            setApplyConfirmOpen(false);
            setApplyConfirmationText("");
          }
        }}
        title="Apply training dataset promotion"
        maxWidth="md"
        showCloseButton={!promotionLoading}
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            This copies approved candidate images into datasets/training/*. It does not run training.
          </div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Type exactly <span className="font-mono">PROMOTE {manifestId}</span>
          </label>
          <input
            value={applyConfirmationText}
            onChange={(event) => setApplyConfirmationText(event.target.value)}
            placeholder={`PROMOTE ${manifestId}`}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setApplyConfirmOpen(false);
                setApplyConfirmationText("");
              }}
              disabled={promotionLoading}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void runPromotionApply()}
              disabled={promotionLoading || applyConfirmationText !== `PROMOTE ${manifestId}`}
            >
              Apply Promotion
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={visionConfirmOpen}
        onClose={() => {
          if (!visionJobLoading) {
            setVisionConfirmOpen(false);
            setVisionConfirmationText("");
          }
        }}
        title="Create Vision Label Job"
        maxWidth="md"
        showCloseButton={!visionJobLoading}
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            This sends candidate images to OpenAI for handwriting label suggestions. Estimated cost: ${visionEstimate?.estimated_cost.low.toFixed(3)}–${visionEstimate?.estimated_cost.high.toFixed(3)} USD.
            Suggestions do not approve or promote candidates.
          </div>
          {visionEstimate?.requires_confirmation ? (
            <>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Type exactly <span className="font-mono">VISION LABEL {manifestId}</span>
              </label>
              <input
                value={visionConfirmationText}
                onChange={(event) => setVisionConfirmationText(event.target.value)}
                placeholder={`VISION LABEL ${manifestId}`}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setVisionConfirmOpen(false);
                setVisionConfirmationText("");
              }}
              disabled={visionJobLoading}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void runVisionJob()}
              disabled={
                visionJobLoading ||
                (visionEstimate?.requires_confirmation === true &&
                  visionConfirmationText !== `VISION LABEL ${manifestId}`)
              }
            >
              Create Vision Job
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function MLVisionJobsPage() {
  const [jobs, setJobs] = useState<Array<Record<string, unknown>>>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [providerFilter, setProviderFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [providers, setProviders] = useState<VisionProvidersResponse | null>(null);
  const limit = 20;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [providersResult] = await Promise.all([
        getHandwritingVisionProviders().catch(() => ({ providers: [] })),
      ]);
      setProviders(providersResult);
      const { listHandwritingVisionJobs } = await import("@/lib/adminMlApi");
      const result = await listHandwritingVisionJobs({
        status: statusFilter || undefined,
        provider: providerFilter || undefined,
        limit,
        offset,
      });
      setJobs(result.items.map((item) => ({ ...item })));
      setTotal(result.total);
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? "Unable to load vision jobs.");
    } finally {
      setLoading(false);
    }
  }, [limit, offset, statusFilter, providerFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCancel = useCallback(async (jobId: string) => {
    setError(null);
    setSuccess(null);
    try {
      const { cancelHandwritingVisionJob } = await import("@/lib/adminMlApi");
      await cancelHandwritingVisionJob(jobId);
      setSuccess(`Vision job ${jobId} cancelled.`);
      await refresh();
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? "Unable to cancel job.");
    }
  }, [refresh]);

  const handlePoll = useCallback(async (jobId: string) => {
    setError(null);
    setSuccess(null);
    try {
      const result = await pollHandwritingVisionJob(jobId);
      setSuccess(`Poll: ${result.status}${result.message ? ` - ${result.message}` : ""}`);
      await refresh();
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? "Unable to poll job.");
    }
  }, [refresh]);

  const handleImport = useCallback(async (jobId: string) => {
    setError(null);
    setSuccess(null);
    try {
      const result = await importHandwritingVisionJobResults(jobId);
      setSuccess(`Import: ${result.completed_count ?? 0} completed, ${result.failed_count ?? 0} failed`);
      await refresh();
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? "Unable to import results.");
    }
  }, [refresh]);

  return (
    <div className="space-y-6 p-6">
      <PageBreadCrumb pageTitle="Vision Label Jobs" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vision Label Jobs</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Vision model labeling jobs for handwriting candidate review.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>Refresh</Button>
      </div>
      {error ? <InlineError message={error} /> : null}
      {success ? <InlineSuccess message={success} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Providers</h3>
          <div className="mt-2 space-y-2">
            {providers?.providers?.map((p) => (
              <div key={p.name} className="flex items-center gap-2 text-sm">
                <StatusPill status={p.enabled ? "approved" : "rejected"} />
                <span className="font-medium text-gray-900 dark:text-white">{p.name}</span>
                <span className="text-gray-500 dark:text-gray-400">
                  {p.enabled ? `model: ${p.default_model}` : p.disabled_reason}
                </span>
              </div>
            )) || <div className="text-sm text-gray-500 dark:text-gray-400">Loading providers...</div>}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Info</h3>
          <div className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-300">
            <p>Suggestions assist review, never auto-approve.</p>
            <p>Batch mode preferred for cost savings (50% discount).</p>
            <p>Sync mode available for single-candidate suggestions.</p>
          </div>
        </div>
      </div>
      <Panel title="Jobs">
        <div className="mb-4 flex flex-wrap gap-3">
          <select value={statusFilter} onChange={(event) => { setOffset(0); setStatusFilter(event.target.value); }} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white">
            <option value="">All statuses</option>
            <option value="queued">queued</option>
            <option value="running">running</option>
            <option value="completed">completed</option>
            <option value="failed">failed</option>
            <option value="cancelled">cancelled</option>
          </select>
          <select value={providerFilter} onChange={(event) => { setOffset(0); setProviderFilter(event.target.value); }} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white">
            <option value="">All providers</option>
            <option value="openai">openai</option>
            <option value="deepseek">deepseek</option>
          </select>
        </div>
        <div className="space-y-3">
          {jobs.map((job) => (
            <div key={String(job.id)} className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={String(job.status)} />
                <span className="font-semibold text-gray-900 dark:text-white">{String(job.provider)} / {String(job.model)}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{String(job.mode)}</span>
                {job.manifest_id ? <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">{String(job.manifest_id).slice(0, 8)}...</span> : null}
              </div>
              <div className="mt-2 grid gap-2 text-sm text-gray-700 dark:text-gray-300 md:grid-cols-3">
                <div><span className="font-medium">Requested:</span> {Number(job.request_count)}</div>
                <div><span className="font-medium">Completed:</span> {Number(job.completed_count)}</div>
                <div><span className="font-medium">Failed:</span> {Number(job.failed_count)}</div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {job.created_at ? <span className="text-xs text-gray-500 dark:text-gray-400">Created: {formatDate(String(job.created_at))}</span> : null}
                {job.completed_at ? <span className="text-xs text-gray-500 dark:text-gray-400">Completed: {formatDate(String(job.completed_at))}</span> : null}
              </div>
              {job.error_message ? (
                <div className="mt-2 rounded bg-red-100 p-2 text-xs text-red-800 dark:bg-red-500/20 dark:text-red-200">{String(job.error_message)}</div>
              ) : null}
              {job.provider_batch_id ? (
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">Batch: {String(job.provider_batch_id).slice(0, 30)}...</div>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <Link href={`/operations/ml-training/vision-jobs/${String(job.id)}`} className="inline-flex items-center justify-center font-medium gap-2 rounded-lg transition px-4 py-2 text-xs bg-brand-500 text-white shadow-theme-xs hover:bg-brand-600">View</Link>
                {String(job.status) === "queued" || String(job.status) === "running" ? (
                  <Button size="sm" variant="outline" onClick={() => void handleCancel(String(job.id))}>Cancel</Button>
                ) : null}
                {String(job.status) === "queued" || String(job.status) === "running" ? (
                  <Button size="sm" variant="outline" onClick={() => void handlePoll(String(job.id))}>Poll</Button>
                ) : null}
                {(String(job.status) === "completed" || String(job.status) === "running") && job.provider_batch_id ? (
                  <Button size="sm" variant="outline" onClick={() => void handleImport(String(job.id))}>Import Results</Button>
                ) : null}
              </div>
            </div>
          ))}
          {loading ? <LoadingBlock /> : null}
          {!loading && jobs.length === 0 ? <div className="text-sm text-gray-500 dark:text-gray-400">No vision jobs found.</div> : null}
        </div>
        <div className="mt-4">
          <Pagination currentPage={Math.floor(offset / limit) + 1} totalPages={Math.max(1, Math.ceil(total / limit))} onPageChange={(page) => setOffset((page - 1) * limit)} />
        </div>
      </Panel>
    </div>
  );
}

export function MLVisionJobDetailPage() {
  const params = useParams<{ id: string }>();
  const jobId = String(params?.id || "");
  const [job, setJob] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getHandwritingVisionJob(jobId);
      setJob(result as unknown as Record<string, unknown>);
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? "Unable to load job.");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handlePoll = useCallback(async () => {
    setError(null);
    try {
      const result = await pollHandwritingVisionJob(jobId);
      setSuccess(`Poll: ${result.status}${result.message ? ` - ${result.message}` : ""}`);
      await refresh();
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? "Unable to poll.");
    }
  }, [jobId, refresh]);

  const handleImport = useCallback(async () => {
    setError(null);
    try {
      const result = await importHandwritingVisionJobResults(jobId);
      setSuccess(`Import: ${result.completed_count ?? 0} completed, ${result.failed_count ?? 0} failed`);
      await refresh();
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? "Unable to import.");
    }
  }, [jobId, refresh]);

  const handleCancel = useCallback(async () => {
    setError(null);
    try {
      const { cancelHandwritingVisionJob } = await import("@/lib/adminMlApi");
      await cancelHandwritingVisionJob(jobId);
      setSuccess("Job cancelled.");
      await refresh();
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? "Unable to cancel.");
    }
  }, [jobId, refresh]);

  const items = (Array.isArray(job?.items) ? job.items : []) as Array<Record<string, unknown>>;

  return (
    <div className="space-y-6 p-6">
      <PageBreadCrumb pageTitle="Vision Job Detail" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            <Link href="/operations/ml-training/vision-jobs" className="text-brand-500 hover:underline">Vision Jobs</Link>
            {" / "}{jobId.slice(0, 8)}...
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>Refresh</Button>
          {String(job?.status) === "queued" || String(job?.status) === "running" ? (
            <Button variant="outline" size="sm" onClick={() => void handlePoll()}>Poll</Button>
          ) : null}
          {(String(job?.status) === "completed" || String(job?.status) === "running") && job?.provider_batch_id ? (
            <Button variant="outline" size="sm" onClick={() => void handleImport()}>Import Results</Button>
          ) : null}
          {String(job?.status) === "queued" || String(job?.status) === "running" ? (
            <Button variant="outline" size="sm" onClick={() => void handleCancel()}>Cancel</Button>
          ) : null}
        </div>
      </div>
      {error ? <InlineError message={error} /> : null}
      {success ? <InlineSuccess message={success} /> : null}
      {loading ? <LoadingBlock /> : null}
      {!loading && job ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <SummaryCard label="Status" value={String(job.status)} />
            <SummaryCard label="Provider" value={`${String(job.provider)} / ${String(job.model)}`} />
            <SummaryCard label="Mode" value={String(job.mode)} />
            <SummaryCard label="Requested" value={String(job.request_count)} />
            <SummaryCard label="Completed" value={String(job.completed_count)} />
            <SummaryCard label="Failed" value={String(job.failed_count)} />
            <SummaryCard label="Created" value={formatDate(String(job.created_at || ""))} />
            <SummaryCard label="Completed at" value={formatDate(String(job.completed_at || null))} />
          </div>
          {job.manifest_id ? (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Manifest: <Link href={`/operations/ml-training/manifests/${String(job.manifest_id)}`} className="text-brand-500 hover:underline">{String(job.manifest_id)}</Link>
            </div>
          ) : null}
          {job.provider_batch_id ? (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              OpenAI Batch: <span className="font-mono">{String(job.provider_batch_id)}</span>
            </div>
          ) : null}
          {job.estimated_cost ? (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Estimated cost: ${String((job.estimated_cost as Record<string, unknown>)?.low ?? "-")}–${String((job.estimated_cost as Record<string, unknown>)?.high ?? "-")} USD
            </div>
          ) : null}
          {job.error_message ? (
            <div className="rounded bg-red-100 p-3 text-sm text-red-800 dark:bg-red-500/20 dark:text-red-200">{String(job.error_message)}</div>
          ) : null}

          <Panel title={`Items (${items.length})`}>
            <div className="space-y-2">
              {items.map((item) => {
                const suggestion = item.parsed_suggestion as Record<string, unknown> | undefined;
                return (
                  <div key={String(item.id)} className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-white/[0.03]">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill status={String(item.status)} />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        Candidate: {String(item.candidate_id).slice(0, 8)}...
                      </span>
                      {job.manifest_id ? (
                        <Link href={`/operations/ml-training/manifests/${String(job.manifest_id)}`} className="text-xs text-brand-500 hover:underline">
                          View in manifest
                        </Link>
                      ) : null}
                    </div>
                    {suggestion ? (
                      <div className="mt-2 grid gap-1 text-sm text-gray-700 dark:text-gray-300 md:grid-cols-3">
                        <div>Label: <span className="font-medium">{String(suggestion.predicted_label ?? "-")}</span></div>
                        <div>Case: <span className="font-medium">{String(suggestion.case_group ?? "-")}</span></div>
                        <div>Confidence: <span className="font-medium">{String(suggestion.confidence ?? "-")}</span></div>
                        <div className="md:col-span-2">Recommendation: <span className="font-medium">{String(suggestion.review_recommendation ?? "-")}</span></div>
                        <div>Reason: <span className="text-xs">{String(suggestion.reason ?? "-")}</span></div>
                      </div>
                    ) : item.status === "failed" && item.error_message ? (
                      <div className="mt-2 rounded bg-red-100 p-2 text-xs text-red-800 dark:bg-red-500/20 dark:text-red-200">{String(item.error_message)}</div>
                    ) : null}
                  </div>
                );
              })}
              {items.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">No items found.</div>
              ) : null}
            </div>
          </Panel>
        </>
      ) : null}
      {!loading && !job ? <div className="text-sm text-gray-500 dark:text-gray-400">Job not found.</div> : null}
    </div>
  );
}

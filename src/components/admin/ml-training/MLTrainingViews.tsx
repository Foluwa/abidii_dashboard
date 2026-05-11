"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Pagination from "@/components/tables/Pagination";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import { ConfirmationModal } from "@/components/ui/modal/ConfirmationModal";
import {
  getMlReadiness,
  getMlTrainingJob,
  getMlTrainingJobLogs,
  getHandwritingDatasetReadiness,
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
  uploadHandwritingCandidateSamples,
  type HandwritingDatasetReadinessResponse,
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
  if (status === "ready") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
  }
  if (status === "low") {
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
  }
  if (status === "missing") {
    return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
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

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null) : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function isDryRunApplyAllowed(report: Record<string, unknown> | null, manifest: VerifiedPromotionManifest | null) {
  if (!report || report.mode !== "dry-run") return false;
  const validationErrors = asRecordArray(report.validation_errors);
  const failed = Number(report.failed ?? 0);
  return report.valid === true && failed === 0 && validationErrors.length === 0 && countFor(manifest, "pending") === 0;
}

function PromotionReportPreview({
  report,
  manifest,
}: {
  report: Record<string, unknown>;
  manifest: VerifiedPromotionManifest | null;
}) {
  const filesToCopy = asRecordArray(report.files_to_copy);
  const perClassImpact = asRecordArray(report.per_class_impact);
  const skippedFiles = asRecordArray(report.skipped_files);
  const validationErrors = asRecordArray(report.validation_errors);
  const manifestUpdates = asRecord(report.manifest_updates);
  const beforeCounts = asRecord(report.before_verified_counts);
  const applyAllowed = isDryRunApplyAllowed(report, manifest);

  return (
    <div className="space-y-5">
      <div className={`rounded-lg border p-4 text-sm ${applyAllowed ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200" : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"}`}>
        Real apply is {applyAllowed ? "allowed by this dry-run preview" : "blocked"}.{" "}
        {!applyAllowed ? "Resolve validation errors, failed copy checks, or pending candidates before applying." : null}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard label="Mode" value={String(report.mode ?? "-")} />
        <SummaryCard label="Approved Rows" value={Number(report.approved_rows ?? 0)} />
        <SummaryCard label="Would Copy" value={filesToCopy.length} />
        <SummaryCard label="Validation Errors" value={validationErrors.length} />
      </div>

      <Panel title="Files That Would Be Promoted">
        {filesToCopy.length > 0 ? (
          <div className="max-h-72 overflow-auto">
            <table className="min-w-full divide-y divide-gray-100 text-xs dark:divide-gray-800">
              <thead>
                <tr className="text-left uppercase text-gray-500 dark:text-gray-400">
                  <th className="px-3 py-2">Source Path</th>
                  <th className="px-3 py-2">Destination Path</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filesToCopy.map((file, index) => (
                  <tr key={`${file.source_key}-${file.target_key}-${index}`}>
                    <td className="break-all px-3 py-2 text-gray-700 dark:text-gray-300">{String(file.source_key ?? "-")}</td>
                    <td className="break-all px-3 py-2 text-gray-700 dark:text-gray-300">{String(file.target_key ?? "-")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="text-sm text-gray-500 dark:text-gray-400">No files would be promoted.</div>}
      </Panel>

      <Panel title="Per-Class Count Impact">
        {perClassImpact.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-800">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                  <th className="px-3 py-2">Class</th>
                  <th className="px-3 py-2">Approved Pending</th>
                  <th className="px-3 py-2">Before Verified</th>
                  <th className="px-3 py-2">After Verified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {perClassImpact.map((item, index) => (
                  <tr key={`${item.language}-${item.label}-${index}`}>
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{String(item.language ?? "-")} {String(item.label ?? "-")}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{String(item.approved_pending ?? 0)}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{String(item.before_verified_count ?? 0)}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{String(item.after_verified_count ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="text-sm text-gray-500 dark:text-gray-400">No per-class impact reported.</div>}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Manifest Changes"><JsonPreview value={manifestUpdates} /></Panel>
        <Panel title="Before Verified Counts"><JsonPreview value={beforeCounts} /></Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Skipped Files">
          {skippedFiles.length > 0 ? <JsonPreview value={skippedFiles} /> : <div className="text-sm text-gray-500 dark:text-gray-400">No skipped files.</div>}
        </Panel>
        <Panel title="Validation Errors">
          {validationErrors.length > 0 ? <JsonPreview value={validationErrors} /> : <div className="text-sm text-gray-500 dark:text-gray-400">No validation errors.</div>}
        </Panel>
      </div>
    </div>
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
  const [datasetReadiness, setDatasetReadiness] = useState<HandwritingDatasetReadinessResponse | null>(null);
  const [jobs, setJobs] = useState<MlTrainingJob[]>([]);
  const [models, setModels] = useState<MlModelVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [readinessData, datasetReadinessData, jobData, modelData] = await Promise.all([
        getMlReadiness(300),
        getHandwritingDatasetReadiness({ target_min_count: 300, target_high_count: 500 }),
        listMlTrainingJobs({ limit: 50, offset: 0 }),
        listMlModelVersions({ limit: 20, offset: 0 }),
      ]);
      setReadiness(readinessData);
      setDatasetReadiness(datasetReadinessData);
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

  return { readiness, datasetReadiness, jobs, models, loading, error, refresh };
}

export function MLTrainingOverviewPage() {
  const { readiness, datasetReadiness, jobs, models, loading, error, refresh } = useMlOverview();
  const [classSearch, setClassSearch] = useState("");
  const [classLanguageFilter, setClassLanguageFilter] = useState("");
  const [classStatusFilter, setClassStatusFilter] = useState("");
  const [classPage, setClassPage] = useState(1);
  const latestSmoke = useMemo(() => getLatestSmoke(jobs), [jobs]);
  const runningJobs = readiness?.training_jobs.running || 0;
  const succeededJobs = readiness?.training_jobs.succeeded || 0;
  const globalDataset = datasetReadiness?.global_readiness;
  const readinessPageSize = 25;
  const filteredReadinessClasses = useMemo(() => {
    const search = classSearch.trim().toLowerCase();
    return (datasetReadiness?.classes || []).filter((item) => {
      if (search && !item.class_label.toLowerCase().includes(search)) return false;
      if (classLanguageFilter && item.language !== classLanguageFilter && item.script_group !== classLanguageFilter) return false;
      if (classStatusFilter && item.readiness_status !== classStatusFilter) return false;
      return true;
    });
  }, [classLanguageFilter, classSearch, classStatusFilter, datasetReadiness?.classes]);
  const readinessTotalPages = Math.max(1, Math.ceil(filteredReadinessClasses.length / readinessPageSize));
  const paginatedReadinessClasses = filteredReadinessClasses.slice((classPage - 1) * readinessPageSize, classPage * readinessPageSize);

  return (
    <div className="space-y-6 p-6">
      <PageBreadCrumb pageTitle="ML Training" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ML Training</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Remote handwriting training readiness, smoke status, jobs, and model versions.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/system/ml-training/jobs">
            <Button variant="outline" size="sm">Jobs</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>Refresh</Button>
        </div>
      </div>

      {error ? <InlineError message={error} /> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Readiness Threshold" value={readiness?.threshold ?? "-"} detail="verified samples per label gate" />
        <SummaryCard label="Ready Classes" value={globalDataset?.ready_classes ?? "-"} detail={`${globalDataset?.blocking_classes ?? "-"} blocking`} />
        <SummaryCard label="Missing Classes" value={globalDataset?.missing_classes ?? "-"} />
        <SummaryCard label="Approved Pending" value={globalDataset?.approved_pending_samples ?? "-"} detail={globalDataset?.can_run_dry_run_promotion ? "dry-run available" : "nothing approved yet"} />
      </div>

      <Panel title="Dataset Readiness">
        {loading && !datasetReadiness ? (
          <LoadingBlock />
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              Full training is disabled. {globalDataset?.next_best_action || "Collect and verify handwriting samples first."}
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <SummaryCard label="Total Classes" value={globalDataset?.total_classes ?? "-"} />
              <SummaryCard label="Low Classes" value={globalDataset?.low_classes ?? "-"} />
              <SummaryCard label="Can Dry-run" value={globalDataset?.can_run_dry_run_promotion ? "Yes" : "No"} />
              <SummaryCard label="Full Training" value={globalDataset?.can_run_full_training ? "Allowed" : "Disabled"} />
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
              <input
                value={classSearch}
                onChange={(event) => {
                  setClassSearch(event.target.value);
                  setClassPage(1);
                }}
                placeholder="Search class label"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
              <select
                value={classLanguageFilter}
                onChange={(event) => {
                  setClassLanguageFilter(event.target.value);
                  setClassPage(1);
                }}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              >
                <option value="">All languages</option>
                <option value="eng">English</option>
                <option value="yor">Yoruba</option>
              </select>
              <select
                value={classStatusFilter}
                onChange={(event) => {
                  setClassStatusFilter(event.target.value);
                  setClassPage(1);
                }}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              >
                <option value="">All statuses</option>
                <option value="missing">missing</option>
                <option value="low">low</option>
                <option value="ready">ready</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-800">
                <thead>
                  <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                    <th className="px-3 py-2">Class</th>
                    <th className="px-3 py-2">Candidates</th>
                    <th className="px-3 py-2">Verified</th>
                    <th className="px-3 py-2">Approved Pending</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Blocking</th>
                    <th className="px-3 py-2">Progress</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {paginatedReadinessClasses.map((item) => {
                    const percent = Math.min(100, Math.round((item.verified_count / item.target_min_count) * 100));
                    return (
                      <tr key={`${item.language}-${item.class_label}`} className={item.is_blocking_training ? "bg-red-50/50 dark:bg-red-950/10" : undefined}>
                        <td className="px-3 py-3 font-medium text-gray-900 dark:text-white">{item.script_group} {item.class_label}</td>
                        <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{item.candidate_count}</td>
                        <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{item.verified_count}</td>
                        <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{item.approved_pending_count}</td>
                        <td className="px-3 py-3"><StatusPill status={item.readiness_status} /></td>
                        <td className="px-3 py-3">{item.is_blocking_training ? <StatusPill status="missing" /> : <StatusPill status="ready" />}</td>
                        <td className="px-3 py-3">
                          <div className="h-2 w-28 rounded-full bg-gray-100 dark:bg-gray-800">
                            <div className="h-2 rounded-full bg-brand-500" style={{ width: `${percent}%` }} />
                          </div>
                        </td>
                        <td className="px-3 py-3 text-gray-500 dark:text-gray-400">{item.recommended_action}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredReadinessClasses.length === 0 ? <div className="p-4 text-sm text-gray-500 dark:text-gray-400">No classes match these filters.</div> : null}
            </div>
            <Pagination currentPage={Math.min(classPage, readinessTotalPages)} totalPages={readinessTotalPages} onPageChange={setClassPage} />
          </div>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Latest Smoke Status" action={<Link className="text-sm font-medium text-brand-600" href="/system/ml-training/jobs">View all</Link>}>
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
            <p>Full training launch remains intentionally disabled until the verified dataset gate passes, dry-run promotion is reviewed, and backend execution is explicitly approved.</p>
            <p>Blocking classes: {globalDataset?.blocking_classes ?? "-"}. Threshold: {datasetReadiness?.target_min_count ?? 300} verified samples per focused class.</p>
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
  const [pendingModelAction, setPendingModelAction] = useState<{ model: MlModelVersion; action: "promote" | "rollback" } | null>(null);
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
      setPendingModelAction(null);
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
                  const canPromote = Boolean(model.id) && model.status === "staging" && !busy;
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
                            onClick={() => setPendingModelAction({ model, action: "promote" })}
                          >
                            {busy ? "Working..." : "Promote"}
                          </Button>
                          <Button
                            disabled={!canRollback}
                            size="sm"
                            variant="outline"
                            onClick={() => setPendingModelAction({ model, action: "rollback" })}
                          >
                            {busy ? "Working..." : "Rollback"}
                          </Button>
                        </div>
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {model.status === "production" ? "Rollback restores latest archived version after confirmation." : model.status === "staging" ? "Promotion is staging-only and requires backend checks." : "Only staging rows can be promoted from here."}
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
      <ConfirmationModal
        isOpen={!!pendingModelAction}
        onClose={() => setPendingModelAction(null)}
        onConfirm={() => {
          if (pendingModelAction) void runModelAction(pendingModelAction.model, pendingModelAction.action);
        }}
        title={pendingModelAction?.action === "promote" ? "Promote Model Version" : "Rollback Model Version"}
        message={`${pendingModelAction?.action === "promote" ? "Promote" : "Rollback"} ${pendingModelAction?.model.language_code || "unknown"} ${pendingModelAction?.model.version || pendingModelAction?.model.id || ""}? Use this only for safe staging/dev model rows.`}
        confirmText={pendingModelAction?.action === "promote" ? "Promote" : "Rollback"}
        variant="warning"
        isLoading={!!actionId}
      />
    </div>
  );
}

function countFor(manifest: VerifiedPromotionManifest | null | undefined, status: string) {
  return manifest?.status_counts?.[status] ?? 0;
}

export function MLVerifiedPromotionManifestsPage() {
  const [manifests, setManifests] = useState<VerifiedPromotionManifest[]>([]);
  const [readiness, setReadiness] = useState<VerifiedPromotionReadinessResponse | null>(null);
  const [collectionGaps, setCollectionGaps] = useState<VerifiedPromotionCollectionGapResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadLanguage, setUploadLanguage] = useState<"yor" | "eng">("eng");
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadContributor, setUploadContributor] = useState("");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadValidationErrors, setUploadValidationErrors] = useState<Record<string, unknown>[]>([]);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
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
    setGenerating(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await generateVerifiedPromotionManifest("all", { dry_run: true });
      setSuccess(`Manifest refresh preview ready. ${(result.manifest_changes as any)?.would_generate_new_manifest ? "A new manifest would be generated." : ""}`);
      await refresh();
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? "Unable to generate manifest.");
    } finally {
      setGenerating(false);
      setShowGenerateConfirm(false);
    }
  }, [refresh]);

  const uploadCandidates = useCallback(async () => {
    if (!uploadLabel.trim() || uploadFiles.length === 0) {
      setError("Choose a class label and at least one image.");
      return;
    }
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await uploadHandwritingCandidateSamples({
        language: uploadLanguage,
        class_label: uploadLabel,
        source: "dashboard_upload",
        contributor_id: uploadContributor.trim() || undefined,
        files: uploadFiles,
      });
      const validationErrors = asRecordArray(result.validation_errors);
      setUploadValidationErrors(validationErrors);
      setSuccess(`Uploaded ${result.uploaded_count ?? 0} candidate(s); ${result.rejected_count ?? 0} rejected by validation.`);
      setUploadFiles([]);
      if (Number(result.uploaded_count ?? 0) > 0 && result.manifest_id) {
        setSuccess(`Uploaded ${result.uploaded_count ?? 0} candidate(s) into review manifest ${String(result.manifest_id)}; ${result.rejected_count ?? 0} rejected by validation.`);
      }
      await refresh();
    } catch (err: any) {
      setUploadValidationErrors(asRecordArray(err?.response?.data?.detail?.validation_errors));
      setError(err?.response?.data?.detail?.message ?? err?.message ?? "Unable to upload handwriting candidates.");
    } finally {
      setUploading(false);
    }
  }, [refresh, uploadContributor, uploadFiles, uploadLabel, uploadLanguage]);

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
          <Button size="sm" onClick={() => setShowGenerateConfirm(true)} disabled={generating}>{generating ? "Generating..." : "Generate Pending Manifest"}</Button>
        </div>
      </div>
      {error ? <InlineError message={error} /> : null}
      {success ? <InlineSuccess message={success} /> : null}
      <Panel title="Verified Readiness" action={<Link href="/system/ml-training" className="text-sm text-brand-600 hover:underline">ML Training overview</Link>}>
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
      <Panel title="Candidate Upload">
        <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
          Upload stores files as review candidates only. It never writes directly to datasets/verified/* and does not make samples available for training until they are reviewed and promoted.
        </div>
        <div className="grid gap-3 md:grid-cols-[160px_1fr_1fr_2fr_auto]">
          <select value={uploadLanguage} onChange={(event) => setUploadLanguage(event.target.value as "yor" | "eng")} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white">
            <option value="eng">English</option>
            <option value="yor">Yoruba</option>
          </select>
          <input value={uploadLabel} onChange={(event) => setUploadLabel(event.target.value)} placeholder="Class label, e.g. F or ẹ́" className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
          <input value={uploadContributor} onChange={(event) => setUploadContributor(event.target.value)} placeholder="Contributor/session (optional)" className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
          <input
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => setUploadFiles(Array.from(event.target.files || []))}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
          <Button size="sm" onClick={() => void uploadCandidates()} disabled={uploading || uploadFiles.length === 0}>
            {uploading ? "Uploading..." : "Upload Candidates"}
          </Button>
        </div>
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Selected files: {uploadFiles.length}. After upload, review them in the manifest detail page before promotion.
        </div>
        {uploadValidationErrors.length > 0 ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <div className="font-medium">Upload validation errors</div>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {uploadValidationErrors.map((item, index) => (
                <li key={`${item.filename}-${item.error}-${index}`}>
                  {String(item.filename ?? "file")}: {String(item.error ?? "validation_failed")}
                  {item.details ? ` (${JSON.stringify(item.details)})` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
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
      <ConfirmationModal
        isOpen={showGenerateConfirm}
        onClose={() => setShowGenerateConfirm(false)}
        onConfirm={() => void generate()}
        title="Preview Manifest Refresh"
        message="Preview manifest refresh from R2 source pools? This is read-only and will not promote samples or run training."
        confirmText="Preview Refresh"
        variant="info"
        isLoading={generating}
      />
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [visibleUpdateConfirm, setVisibleUpdateConfirm] = useState<{ ids: string[]; status: "pending" | "approved" | "rejected" } | null>(null);
  const [applyConfirmOpen, setApplyConfirmOpen] = useState(false);
  const [applyConfirmationText, setApplyConfirmationText] = useState("");
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
      setSelectedIds(new Set());
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? "Unable to load manifest.");
    } finally {
      setLoading(false);
    }
  }, [conflictOnly, label, language, manifestId, offset, priorityOnly, problemOnly, reviewStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateVisible = useCallback(async (status: "pending" | "approved" | "rejected", candidateIds?: string[], confirmed = false) => {
    const ids = candidateIds || candidates.map((candidate) => candidate.candidate_id);
    if (ids.length === 0) return;
    if (candidateIds === undefined && !confirmed) {
      setVisibleUpdateConfirm({ ids, status });
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      const response = await updateVerifiedPromotionCandidates(manifestId, ids, status);
      setSuccess(`Updated ${response.updated} candidate(s).`);
      setVisibleUpdateConfirm(null);
      await refresh();
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? "Unable to update candidates.");
    }
  }, [candidates, manifestId, refresh]);

  const selectedCandidateIds = useMemo(() => Array.from(selectedIds), [selectedIds]);
  const approvedCount = manifest ? countFor(manifest, "approved") : 0;
  const applyAllowed = isDryRunApplyAllowed(report, manifest);
  const applyBlockedReason = approvedCount === 0
    ? "Approve at least one candidate first."
    : !report || report.mode !== "dry-run"
      ? "Run and review a successful dry-run before applying."
      : countFor(manifest, "pending") > 0
        ? "Resolve all pending candidates before applying."
        : !applyAllowed
          ? "Dry-run reported validation errors or failed checks."
          : "";

  const runPanelAction = useCallback(async (action: "validate" | "dry-run" | "apply") => {
    setError(null);
    setSuccess(null);
    try {
      let response: Record<string, unknown>;
      if (action === "validate") response = await validateVerifiedPromotionManifest(manifestId);
      else if (action === "dry-run") response = await dryRunVerifiedPromotionManifest(manifestId);
      else {
        response = await applyVerifiedPromotionManifest(manifestId, applyConfirmationText);
        setApplyConfirmOpen(false);
        setApplyConfirmationText("");
      }
      setReport(response);
      setSuccess(`${action} completed.`);
      await refresh();
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? `Unable to ${action} manifest.`);
    }
  }, [applyConfirmationText, manifestId, refresh]);

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
          <Button variant="outline" size="sm" onClick={() => void runPanelAction("dry-run")} disabled={approvedCount === 0}>Dry-run Promotion</Button>
          <Button size="sm" onClick={() => setApplyConfirmOpen(true)} disabled={!applyAllowed}>Apply Approved Promotion</Button>
        </div>
        {applyBlockedReason ? <div className="mt-3 text-sm text-amber-700 dark:text-amber-300">Apply blocked: {applyBlockedReason}</div> : null}
        {report ? (
          <div className="mt-4">
            {report.mode ? <PromotionReportPreview report={report} manifest={manifest} /> : <JsonPreview value={report} />}
          </div>
        ) : null}
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
          <Button variant="outline" size="sm" onClick={() => setVisibleUpdateConfirm({ ids: selectedCandidateIds, status: "approved" })} disabled={selectedCandidateIds.length === 0}>Approve Selected</Button>
          <Button variant="outline" size="sm" onClick={() => setVisibleUpdateConfirm({ ids: selectedCandidateIds, status: "rejected" })} disabled={selectedCandidateIds.length === 0}>Reject Selected</Button>
          <Button variant="outline" size="sm" onClick={() => setVisibleUpdateConfirm({ ids: selectedCandidateIds, status: "pending" })} disabled={selectedCandidateIds.length === 0}>Reset Selected</Button>
          <Button variant="outline" size="sm" onClick={() => void updateVisible("approved")}>Approve Visible</Button>
        </div>
        <div className="space-y-3">
          {candidates.map((candidate) => (
            <div key={candidate.candidate_id} className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="flex flex-col gap-4 md:flex-row">
                <CandidatePreview manifestId={manifestId} candidate={candidate} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(candidate.candidate_id)}
                      onChange={(event) => {
                        setSelectedIds((previous) => {
                          const next = new Set(previous);
                          if (event.target.checked) next.add(candidate.candidate_id);
                          else next.delete(candidate.candidate_id);
                          return next;
                        });
                      }}
                    />
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
                  <Button size="sm" variant="outline" onClick={() => void updateVisible("approved", [candidate.candidate_id], true)}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => void updateVisible("rejected", [candidate.candidate_id], true)}>Reject</Button>
                  <Button size="sm" variant="outline" onClick={() => void updateVisible("pending", [candidate.candidate_id], true)}>Pending</Button>
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
          setApplyConfirmOpen(false);
          setApplyConfirmationText("");
        }}
        title="Apply verified promotion"
        maxWidth="md"
        showCloseButton={!loading}
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            This writes approved samples to datasets/verified/*. Pending and rejected candidates are not promoted.
          </div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Type exactly <span className="font-mono">APPLY {manifestId}</span>
          </label>
          <input
            value={applyConfirmationText}
            onChange={(event) => setApplyConfirmationText(event.target.value)}
            placeholder={`APPLY ${manifestId}`}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
          {applyConfirmationText !== `APPLY ${manifestId}` ? (
            <div className="mt-1 text-xs text-red-600 dark:text-red-300">Confirmation text must exactly match APPLY {manifestId}.</div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setApplyConfirmOpen(false);
                setApplyConfirmationText("");
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void runPanelAction("apply")}
              disabled={loading || applyConfirmationText !== `APPLY ${manifestId}`}
            >
              Apply Promotion
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

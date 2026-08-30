"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { useToast } from "@/contexts/ToastContext";
import { useConfirm } from "@/hooks/useConfirm";
import { StyledSelect } from "@/components/ui/form/StyledSelect";
import {
  InlineError,
  InlineSuccess,
  JsonPreview,
  LoadingBlock,
  Panel,
  StatusPill,
  SummaryCard,
  formatDate,
} from "./MLTrainingViews";
import {
  cancelHandwritingVisionJob,
  createHandwritingVisionJob,
  estimateHandwritingVisionJob,
  getHandwritingVisionJob,
  listHandwritingVisionJobs,
  listHandwritingVisionProviders,
  pollHandwritingVisionJob,
  type HandwritingVisionCostEstimate,
  type HandwritingVisionJob,
  type HandwritingVisionProvider,
} from "@/lib/adminMlApi";

export function MLHandwritingVisionJobsPage() {
  const toast = useToast();
  const { confirm, modal: confirmModal } = useConfirm();
  const [jobs, setJobs] = useState<HandwritingVisionJob[]>([]);
  const [providers, setProviders] = useState<HandwritingVisionProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [provider, setProvider] = useState<"openai" | "deepseek">("openai");
  const [model, setModel] = useState("");
  const [manifestId, setManifestId] = useState("");
  const [mode, setMode] = useState<"sync" | "batch">("batch");
  const [maxCandidates, setMaxCandidates] = useState("50");
  const [estimate, setEstimate] = useState<HandwritingVisionCostEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobResponse, providerResponse] = await Promise.all([
        listHandwritingVisionJobs({ limit: 50, offset: 0 }),
        listHandwritingVisionProviders(),
      ]);
      setJobs(jobResponse.items);
      setProviders(providerResponse.providers);
      const defaultProvider = providerResponse.providers.find((p) => p.name === provider);
      if (defaultProvider && !model) setModel(defaultProvider.default_model);
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? "Unable to load vision jobs.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runEstimate = useCallback(async () => {
    setEstimating(true);
    setError(null);
    try {
      const result = await estimateHandwritingVisionJob({
        provider,
        model,
        manifest_id: manifestId || undefined,
        mode,
        max_candidates: Number(maxCandidates) || 50,
        filters: { review_status: "approved", vision_status: "not_requested" },
      });
      setEstimate(result);
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? "Unable to estimate vision job cost.");
    } finally {
      setEstimating(false);
    }
  }, [manifestId, maxCandidates, mode, model, provider]);

  const createJob = useCallback(async () => {
    let confirmation: string | undefined;
    if (estimate?.requires_confirmation) {
      // Above the cost/count threshold - typed confirmation phrase, the
      // stronger gate the backend itself requires.
      confirmation = window.prompt(`Type "${estimate.confirmation_text}" to start this vision job`) || undefined;
      if (!confirmation) return;
    } else {
      // Below the threshold, requires_confirmation is false - but this is
      // still a real paid LLM API call, just a cheaper one, and used to
      // dispatch with zero confirmation at all.
      const confirmed = await confirm({
        title: "Start Vision Job",
        message: `Start a ${mode} vision-labeling job via ${provider} against up to ${maxCandidates || 50} approved candidates? This calls a paid ${provider} API.`,
        confirmLabel: "Start Job",
        variant: "warning",
      });
      if (!confirmed) return;
    }

    setCreating(true);
    setError(null);
    try {
      const job = await createHandwritingVisionJob({
        provider,
        model,
        manifest_id: manifestId || undefined,
        mode,
        max_candidates: Number(maxCandidates) || 50,
        filters: { review_status: "approved", vision_status: "not_requested" },
        confirmation,
      });
      toast.success(`Vision job started: ${job.job_id || job.id || ""}`.trim());
      setEstimate(null);
      await refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail?.message ?? err?.message ?? "Unable to start vision job.");
    } finally {
      setCreating(false);
    }
  }, [estimate, manifestId, maxCandidates, mode, model, provider, refresh, toast, confirm]);

  return (
    <div className="space-y-6 p-6">
      {confirmModal}
      <PageBreadCrumb pageTitle="Vision Jobs" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vision Jobs</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            LLM-assisted labeling suggestions for candidates - assist only, suggestions must be explicitly accepted
            in <Link href="/operations/ml-training/candidate-manifests" className="text-brand-500 hover:underline">Candidate Review</Link>.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>Refresh</Button>
      </div>
      {error ? <InlineError message={error} /> : null}

      <Panel title="Start a Vision Job">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <StyledSelect
            value={provider}
            onChange={(event) => setProvider(event.target.value as "openai" | "deepseek")}
            options={providers.map((p) => ({ value: p.name, label: `${p.name}${p.enabled ? "" : " (disabled)"}` }))}
          />
          <input
            value={model}
            onChange={(event) => setModel(event.target.value)}
            placeholder="model"
            className="w-48 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
          <input
            value={manifestId}
            onChange={(event) => setManifestId(event.target.value)}
            placeholder="Manifest id (optional)"
            className="w-64 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
          <StyledSelect
            value={mode}
            onChange={(event) => setMode(event.target.value as "sync" | "batch")}
            options={[
              { value: "batch", label: "batch" },
              { value: "sync", label: "sync" },
            ]}
          />
          <input
            value={maxCandidates}
            onChange={(event) => setMaxCandidates(event.target.value.replace(/\D/g, ""))}
            placeholder="Max candidates"
            inputMode="numeric"
            className="w-36 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          Targets approved candidates with no vision suggestion requested yet. Estimate cost before starting - jobs
          above the configured cost/count threshold require typing an exact confirmation phrase.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void runEstimate()} disabled={estimating}>
            {estimating ? "Estimating..." : "Estimate Cost"}
          </Button>
          <Button size="sm" onClick={() => void createJob()} disabled={creating}>
            {creating ? "Starting..." : "Start Vision Job"}
          </Button>
        </div>
        {estimate ? (
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <SummaryCard label="Candidates" value={estimate.candidate_count} />
            <SummaryCard
              label="Estimated Cost"
              value={`$${estimate.estimated_cost.low.toFixed(2)}-$${estimate.estimated_cost.high.toFixed(2)}`}
            />
            <SummaryCard label="Confirmation Required" value={estimate.requires_confirmation ? "Yes" : "No"} />
            <SummaryCard label="Blocked" value={estimate.blocked ? estimate.blocked_reason || "Yes" : "No"} />
          </div>
        ) : null}
      </Panel>

      <Panel title="Jobs">
        {loading && jobs.length === 0 ? (
          <LoadingBlock />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-800">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                  <th className="px-3 py-2">Job</th>
                  <th className="px-3 py-2">Provider / Model</th>
                  <th className="px-3 py-2">Mode</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Requested</th>
                  <th className="px-3 py-2">Completed</th>
                  <th className="px-3 py-2">Failed</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="px-3 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{job.id}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{formatDate(job.created_at)}</div>
                    </td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{job.provider} / {job.model}</td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{job.mode}</td>
                    <td className="px-3 py-3"><StatusPill status={job.status} /></td>
                    <td className="px-3 py-3">{job.request_count}</td>
                    <td className="px-3 py-3">{job.completed_count}</td>
                    <td className="px-3 py-3">{job.failed_count}</td>
                    <td className="px-3 py-3">
                      <Link href={`/operations/ml-training/vision-jobs/${job.id}`} className="text-brand-600 hover:underline">
                        Detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {jobs.length === 0 ? <div className="p-4 text-sm text-gray-500 dark:text-gray-400">No vision jobs yet.</div> : null}
          </div>
        )}
      </Panel>
    </div>
  );
}

export function MLHandwritingVisionJobDetailPage() {
  const { confirm, modal: confirmModal } = useConfirm();
  const params = useParams<{ id: string }>();
  const jobId = String(params?.id || "");
  const [job, setJob] = useState<HandwritingVisionJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const refresh = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const detail = await getHandwritingVisionJob(jobId);
      setJob(detail);
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? "Unable to load vision job.");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const pollNow = useCallback(async () => {
    setWorking(true);
    setError(null);
    setSuccess(null);
    try {
      await pollHandwritingVisionJob(jobId);
      setSuccess("Polled provider for updates.");
      await refresh();
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? "Unable to poll vision job.");
    } finally {
      setWorking(false);
    }
  }, [jobId, refresh]);

  const cancel = useCallback(async () => {
    const confirmed = await confirm({
      title: "Cancel Vision Job",
      message: "Cancel this vision job? Any candidates it hasn't already labeled will not be processed.",
      confirmLabel: "Yes, Cancel Job",
      variant: "danger",
    });
    if (!confirmed) return;

    setWorking(true);
    setError(null);
    setSuccess(null);
    try {
      await cancelHandwritingVisionJob(jobId);
      setSuccess("Job cancelled.");
      await refresh();
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? "Unable to cancel vision job.");
    } finally {
      setWorking(false);
    }
  }, [jobId, refresh, confirm]);

  const isTerminal = job && ["completed", "failed", "cancelled"].includes(job.status);

  return (
    <div className="space-y-6 p-6">
      {confirmModal}
      <PageBreadCrumb pageTitle="Vision Job Detail" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{jobId}</h1>
          {job ? <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{job.provider} / {job.model} - {job.mode}</p> : null}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>Refresh</Button>
          {!isTerminal ? (
            <>
              <Button variant="outline" size="sm" onClick={() => void pollNow()} disabled={working}>Poll Now</Button>
              <Button size="sm" onClick={() => void cancel()} disabled={working}>Cancel Job</Button>
            </>
          ) : null}
        </div>
      </div>
      {error ? <InlineError message={error} /> : null}
      {success ? <InlineSuccess message={success} /> : null}

      {loading && !job ? (
        <LoadingBlock />
      ) : job ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <SummaryCard label="Status" value={job.status} />
            <SummaryCard label="Requested" value={job.request_count} />
            <SummaryCard label="Completed" value={job.completed_count} />
            <SummaryCard label="Failed" value={job.failed_count} />
          </div>
          {job.error_message ? <InlineError message={job.error_message} /> : null}
          <Panel title="Items">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-800">
                <thead>
                  <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                    <th className="px-3 py-2">Candidate</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Suggestion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {(job.items || []).map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 font-mono text-xs">{item.candidate_id}</td>
                      <td className="px-3 py-2"><StatusPill status={item.status} /></td>
                      <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
                        {item.parsed_suggestion
                          ? `${(item.parsed_suggestion as any).case_group || ""} ${(item.parsed_suggestion as any).predicted_label || ""}`.trim()
                          : item.error_message || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(job.items || []).length === 0 ? <div className="p-4 text-sm text-gray-500 dark:text-gray-400">No items.</div> : null}
            </div>
          </Panel>
          <Panel title="Raw Job Payload">
            <JsonPreview value={job} />
          </Panel>
        </>
      ) : null}
    </div>
  );
}

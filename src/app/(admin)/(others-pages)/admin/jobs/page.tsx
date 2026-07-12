"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Pagination from "@/components/tables/Pagination";
import { ConfirmationModal } from "@/components/ui/modal/ConfirmationModal";
import { Modal } from "@/components/ui/modal";
import { StyledSelect } from "@/components/ui/form/StyledSelect";
import { useToast } from "@/contexts/ToastContext";
import {
  cancelAdminJob,
  listAdminJobs,
  retryAdminJob,
  type AdminJob,
  type AdminJobStatus,
} from "@/lib/adminJobsApi";
import { useAdminJob } from "@/hooks/useAdminJob";

const STATUS_OPTIONS = ["", "queued", "running", "completed", "failed", "cancelled"];
const TYPE_OPTIONS = [
  "",
  "example_generation",
  "missing_sense_generation",
  "proverb_cleanup",
  "time_phrase_processing",
];

function formatDate(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function statusClass(status: AdminJobStatus | string) {
  if (status === "completed") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
  if (status === "failed") return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
  if (status === "running") return "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200";
  if (status === "cancelled") return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  const [expanded, setExpanded] = useState(false);
  const text = JSON.stringify(value ?? null, null, 2);
  const shouldTruncate = text.length > 1200;
  const visibleText = shouldTruncate && !expanded ? `${text.slice(0, 1200)}\n...` : text;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
        {shouldTruncate ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
        ) : null}
      </div>
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words p-4 text-xs text-gray-700 dark:text-gray-300">
        {visibleText}
      </pre>
    </div>
  );
}

function JobDetailModal({
  jobId,
  onClose,
  onChanged,
}: {
  jobId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const { job, loading, error, refresh } = useAdminJob(jobId);
  const [confirmAction, setConfirmAction] = useState<"cancel" | "retry" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const handleConfirmedAction = async () => {
    if (!job || !confirmAction) return;
    setActionLoading(true);
    try {
      if (confirmAction === "cancel") {
        await cancelAdminJob(job.id);
        toast.success("Job cancelled");
      } else {
        await retryAdminJob(job.id);
        toast.success("Retry queued");
      }
      setConfirmAction(null);
      await refresh();
      onChanged();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? err?.message ?? "Job action failed");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <Modal isOpen={Boolean(jobId)} onClose={onClose} title="Admin Job Detail" maxWidth="4xl">
        {loading && !job ? (
          <div className="text-sm text-gray-600 dark:text-gray-300">Loading job...</div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        ) : job ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="font-mono text-sm text-gray-700 dark:text-gray-300">{job.id}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(job.status)}`}>
                    {job.status}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    {job.type}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {job.status === "queued" || job.status === "running" ? (
                  <button
                    type="button"
                    onClick={() => setConfirmAction("cancel")}
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10"
                  >
                    Cancel
                  </button>
                ) : null}
                {job.status === "failed" ? (
                  <button
                    type="button"
                    onClick={() => setConfirmAction("retry")}
                    className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
                  >
                    Retry
                  </button>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              {[
                ["Progress", `${Math.round(job.progress.percent)}%`],
                ["Current", `${job.progress.current}/${job.progress.total}`],
                ["Created", formatDate(job.created_at)],
                ["Completed", formatDate(job.completed_at)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                  <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
                  <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{value}</div>
                </div>
              ))}
            </div>

            {job.error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                {job.error}
              </div>
            ) : null}

            <JsonBlock title="Payload" value={job.payload} />
            <JsonBlock title="Result" value={job.result} />
          </div>
        ) : null}
      </Modal>

      <ConfirmationModal
        isOpen={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirmedAction}
        title={confirmAction === "cancel" ? "Cancel Job" : "Retry Job"}
        message={
          confirmAction === "cancel"
            ? "This will stop the job if it has not already completed. Proceed?"
            : "This will create a new job with the same payload. Proceed?"
        }
        confirmText={confirmAction === "cancel" ? "Cancel Job" : "Retry Job"}
        variant={confirmAction === "cancel" ? "danger" : "warning"}
        isLoading={actionLoading}
      />
    </>
  );
}

export default function AdminJobsPage() {
  const toast = useToast();
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [limit, setLimit] = useState(20);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const offset = (page - 1) * limit;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasActiveJobs = useMemo(() => jobs.some((job) => job.status === "queued" || job.status === "running"), [jobs]);

  const refreshJobs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listAdminJobs({
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        limit,
        offset,
      });
      setJobs(response.items);
      setTotal(response.total);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? err?.message ?? "Failed to load admin jobs");
    } finally {
      setLoading(false);
    }
  }, [limit, offset, statusFilter, toast, typeFilter]);

  useEffect(() => {
    void refreshJobs();
  }, [refreshJobs]);

  useEffect(() => {
    if (!hasActiveJobs) return;
    const intervalId = window.setInterval(() => {
      void refreshJobs();
    }, 3000);
    return () => window.clearInterval(intervalId);
  }, [hasActiveJobs, refreshJobs]);

  return (
    <div className="space-y-6 p-6">
      <PageBreadCrumb pageTitle="Admin Jobs" />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Jobs</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Persistent operational jobs sorted by newest first.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshJobs()}
          disabled={loading}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <StyledSelect
              label="Status"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              options={STATUS_OPTIONS.map((status) => ({
                value: status,
                label: status || "All statuses",
              }))}
              fullWidth
            />
          </div>
          <div>
            <StyledSelect
              label="Type"
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value);
                setPage(1);
              }}
              options={TYPE_OPTIONS.map((type) => ({
                value: type,
                label: type || "All types",
              }))}
              fullWidth
            />
          </div>
          <div>
            <StyledSelect
              label="Page Size"
              value={limit}
              onChange={(event) => {
                setLimit(Number(event.target.value));
                setPage(1);
              }}
              options={[10, 20, 50, 100].map((value) => ({ value, label: String(value) }))}
              fullWidth
            />
          </div>
          <div className="flex items-end text-sm text-gray-600 dark:text-gray-300">
            {total} total jobs
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                {["Job ID", "Type", "Status", "Progress", "Created", "Completed", "Actions"].map((label) => (
                  <th key={label} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-sm text-gray-600 dark:text-gray-300">
                    No admin jobs found.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                    <td className="px-4 py-3 text-xs font-mono text-gray-700 dark:text-gray-300">
                      <button type="button" onClick={() => setSelectedJobId(job.id)} className="hover:underline">
                        {job.id}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{job.type}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(job.status)}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {Math.round(job.progress.percent)}%
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDate(job.created_at)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDate(job.completed_at)}</td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        type="button"
                        onClick={() => setSelectedJobId(job.id)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5"
                      >
                        View Result
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm text-gray-600 dark:text-gray-300">
          Showing {jobs.length ? offset + 1 : 0}-{offset + jobs.length} of {total}
        </div>
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      <JobDetailModal
        jobId={selectedJobId}
        onClose={() => setSelectedJobId(null)}
        onChanged={() => void refreshJobs()}
      />

      <div className="text-sm text-gray-600 dark:text-gray-300">
        Need to create jobs? Use <Link href="/content/words" className="text-brand-600 hover:underline">Words Import</Link>,{" "}
        <Link href="/content/proverbs" className="text-brand-600 hover:underline">Proverbs</Link>, or{" "}
        <Link href="/content/time-phrases" className="text-brand-600 hover:underline">Time Phrases</Link>.
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import { useToast } from "@/contexts/ToastContext";
import { createAudioReconciliationJob, type AdminJob, type AdminJobStatus } from "@/lib/adminJobsApi";
import { useAdminJob } from "@/hooks/useAdminJob";

interface BrokenAudioItem {
  content_type: string;
  content_id: string;
  label: string;
  audio_url: string;
  reason: string;
}

interface AudioReconciliationResult {
  checked: number;
  broken_count: number;
  broken: BrokenAudioItem[];
}

function statusClass(status: AdminJobStatus | string) {
  if (status === "completed") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
  if (status === "failed") return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
  if (status === "running") return "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200";
  return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
}

export default function AudioReconciliationPage() {
  const toast = useToast();
  const [job, setJob] = useState<AdminJob | null>(null);
  const [starting, setStarting] = useState(false);

  const tracked = useAdminJob(job?.id);
  const currentJob = tracked.job ?? job;
  const result = (currentJob?.result ?? null) as AudioReconciliationResult | null;
  const isActive = currentJob?.status === "queued" || currentJob?.status === "running";

  const startCheck = async () => {
    setStarting(true);
    try {
      const created = await createAudioReconciliationJob();
      setJob(created);
      toast.info("Audio reconciliation check started - this scans every published phrase's audio URL.");
    } catch (error) {
      toast.error(error);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div>
      <PageBreadCrumb pageTitle="Audio Reconciliation" />

      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:p-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Check for broken audio references
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
              Checks every published phrase&apos;s stored audio URL and reports any that don&apos;t
              actually resolve. Read-only - this only reports, it doesn&apos;t regenerate or
              modify anything. Found via a live incident where ~55% of phrases had broken audio
              after a bucket migration.
            </p>
          </div>
          <button
            type="button"
            onClick={startCheck}
            disabled={starting || isActive}
            className="inline-flex shrink-0 items-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white dark:text-gray-900 hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isActive ? "Checking..." : "Check for orphaned audio"}
          </button>
        </div>

        {currentJob && (
          <div className="mt-6 border-t border-gray-200 pt-5 dark:border-gray-800">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(
                  currentJob.status
                )}`}
              >
                {currentJob.status}
              </span>
              {isActive && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {currentJob.progress.current} / {currentJob.progress.total || "?"} phrases checked
                </span>
              )}
              {currentJob.error && (
                <span className="text-sm text-red-600 dark:text-red-400">{currentJob.error}</span>
              )}
              <Link
                href={`/admin/jobs?type=content_audio_reconciliation`}
                className="ml-auto text-sm text-brand-600 hover:underline dark:text-brand-400"
              >
                View in Jobs list
              </Link>
            </div>

            {result && (
              <div className="mt-5">
                <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-2 sm:max-w-md">
                  <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Checked</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                      {result.checked}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Broken</p>
                    <p
                      className={`text-2xl font-semibold ${
                        result.broken_count > 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {result.broken_count}
                    </p>
                  </div>
                </div>

                {result.broken.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                      <thead className="bg-gray-50 dark:bg-gray-800/40">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                            Content
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                            Reason
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                            Audio URL
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                        {result.broken.map((item) => (
                          <tr key={item.content_id}>
                            <td className="px-4 py-2.5 text-sm text-gray-900 dark:text-white">
                              <div className="font-medium">{item.label || "(no text)"}</div>
                              <div className="text-xs text-gray-400">
                                {item.content_type} &middot; {item.content_id}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-sm text-red-600 dark:text-red-400">
                              {item.reason}
                            </td>
                            <td className="max-w-xs truncate px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400">
                              <span title={item.audio_url}>{item.audio_url}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {result.broken_count > result.broken.length && (
                      <p className="border-t border-gray-200 px-4 py-2.5 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                        Showing first {result.broken.length} of {result.broken_count} broken items.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

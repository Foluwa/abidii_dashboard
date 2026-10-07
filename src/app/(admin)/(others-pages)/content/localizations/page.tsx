"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import { useToast } from "@/contexts/ToastContext";
import {
  createContentLocalizationJob,
  listContentLocalizations,
  publishContentLocalizations,
  type AdminJob,
  type AdminJobStatus,
  type ContentLocalizationLocale,
  type ContentLocalizationRow,
} from "@/lib/adminJobsApi";
import { useAdminJob } from "@/hooks/useAdminJob";
import { StyledSelect } from "@/components/ui/form/StyledSelect";

const LOCALES: { value: ContentLocalizationLocale; label: string }[] = [
  { value: "fr", label: "French" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
];

function statusClass(status: AdminJobStatus | string) {
  if (status === "completed") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
  if (status === "failed") return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
  if (status === "running") return "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200";
  return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
}

function rowStatusClass(status: string) {
  if (status === "published") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
  if (status === "stale") return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
  return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
}

export default function ContentLocalizationsPage() {
  const toast = useToast();
  const [locale, setLocale] = useState<ContentLocalizationLocale>("fr");
  const [job, setJob] = useState<AdminJob | null>(null);
  const [starting, setStarting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [rows, setRows] = useState<ContentLocalizationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingRows, setLoadingRows] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("machine_draft");

  const tracked = useAdminJob(job?.id);
  const currentJob = tracked.job ?? job;
  const isActive = currentJob?.status === "queued" || currentJob?.status === "running";

  const loadRows = useCallback(async () => {
    setLoadingRows(true);
    try {
      const res = await listContentLocalizations({
        locale,
        status: statusFilter || undefined,
        limit: 200,
      });
      setRows(res.items);
      setTotal(res.total);
    } catch (error) {
      toast.error(error);
    } finally {
      setLoadingRows(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, statusFilter]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (currentJob?.status === "completed") {
      void loadRows();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentJob?.status]);

  const startGeneration = async () => {
    setStarting(true);
    try {
      const created = await createContentLocalizationJob(locale);
      setJob(created);
      toast.info(`Generating ${locale} translations for course/unit/section text - this may take a minute.`);
    } catch (error) {
      toast.error(error);
    } finally {
      setStarting(false);
    }
  };

  const publishAll = async () => {
    setPublishing(true);
    try {
      const res = await publishContentLocalizations(locale);
      toast.success(`Published ${res.published_count} ${locale} translations.`);
      await loadRows();
    } catch (error) {
      toast.error(error);
    } finally {
      setPublishing(false);
    }
  };

  const publishOne = async (id: string) => {
    try {
      await publishContentLocalizations(locale, [id]);
      toast.success("Published.");
      await loadRows();
    } catch (error) {
      toast.error(error);
    }
  };

  const draftCount = rows.filter((r) => r.status === "machine_draft" || r.status === "reviewed").length;

  return (
    <div>
      <PageBreadCrumb pageTitle="Content Localizations" />

      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:p-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Generate course/unit/section translations
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
              Machine-translates course, unit, and section titles/descriptions into French or
              Portuguese via an LLM. Writes as machine_draft only - nothing is served to users
              until you spot-check and publish below. See abidii_localisation.md.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StyledSelect
              value={locale}
              onChange={(e) => setLocale(e.target.value as ContentLocalizationLocale)}
              options={LOCALES}
            />
            <button
              type="button"
              onClick={startGeneration}
              disabled={starting || isActive}
              className="inline-flex shrink-0 items-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white dark:text-gray-900 hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isActive ? "Generating..." : "Generate translations"}
            </button>
          </div>
        </div>

        {currentJob && (
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-gray-200 pt-5 dark:border-gray-800">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(
                currentJob.status
              )}`}
            >
              {currentJob.status}
            </span>
            {isActive && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {currentJob.progress.current} / {currentJob.progress.total || "?"} fields
              </span>
            )}
            {currentJob.error && (
              <span className="text-sm text-red-600 dark:text-red-400">{currentJob.error}</span>
            )}
            <Link
              href={`/admin/jobs?type=content_localization_generate`}
              className="ml-auto text-sm text-brand-600 hover:underline dark:text-brand-400"
            >
              View in Jobs list
            </Link>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:p-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {LOCALES.find((l) => l.value === locale)?.label} translations
            </h3>
            <StyledSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: "", label: "All statuses" },
                { value: "machine_draft", label: "Draft (unpublished)" },
                { value: "published", label: "Published" },
                { value: "stale", label: "Stale" },
              ]}
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">{total} rows</span>
          </div>
          <button
            type="button"
            onClick={publishAll}
            disabled={publishing || draftCount === 0}
            className="inline-flex shrink-0 items-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {publishing ? "Publishing..." : `Publish all drafts (${draftCount})`}
          </button>
        </div>

        <div className="mt-5 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800/40">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                  Entity
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                  Field
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                  Translation
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                  Status
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {loadingRows && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    Loading...
                  </td>
                </tr>
              )}
              {!loadingRows && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    No rows for this locale/status.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-2.5 text-xs text-gray-400">
                    {row.entity_type}
                    <div className="truncate max-w-[10rem]" title={row.entity_id}>
                      {row.entity_id}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400">{row.field_name}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-900 dark:text-white">{row.value}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${rowStatusClass(
                        row.status
                      )}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {row.status !== "published" && (
                      <button
                        type="button"
                        onClick={() => publishOne(row.id)}
                        className="text-xs text-brand-600 hover:underline dark:text-brand-400"
                      >
                        Publish
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

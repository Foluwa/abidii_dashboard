import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";
import InlineAudioPlayer from "@/components/ui/audio/InlineAudioPlayer";
import type { Proverb } from "@/types/api";
import { SquarePen, Trash2, Volume2 } from "lucide-react";

interface ProverbsDataTableProps {
  proverbs: Proverb[];
  isLoading: boolean;
  selectedProverbs?: string[];
  onSelectProverb?: (proverbId: string) => void;
  onSelectAll?: () => void;
  onEdit: (proverb: Proverb) => void;
  onDelete: (proverbId: string) => void;
  onRegenerateAudio: (proverb: Proverb) => void;
  onAcceptAudio?: (proverbId: string, versionId: string) => Promise<void>;
  onRejectAudio?: (proverbId: string, versionId: string) => Promise<void>;
}

export default function ProverbsDataTable({
  proverbs,
  isLoading,
  selectedProverbs = [],
  onSelectProverb,
  onSelectAll,
  onEdit,
  onDelete,
  onRegenerateAudio,
  onAcceptAudio,
  onRejectAudio,
}: ProverbsDataTableProps) {
  const renderPublishBadge = (proverb: Proverb) => (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        proverb.is_published
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
      }`}
    >
      {proverb.is_published ? "Published" : "Draft"}
    </span>
  );

  const getAudioFormat = (proverb: Proverb) => {
    if (proverb.audio_format) {
      return proverb.audio_format.toUpperCase();
    }

    if (!proverb.audio_url) {
      return null;
    }

    try {
      const pathname = new URL(proverb.audio_url).pathname.toLowerCase();
      const extension = pathname.split(".").pop();
      return extension ? extension.toUpperCase() : null;
    } catch {
      const extension = proverb.audio_url.split("?")[0].split(".").pop();
      return extension ? extension.toUpperCase() : null;
    }
  };

  const renderAlignmentBadge = (proverb: Proverb) => {
    if (!proverb.alignment_status) {
      return null;
    }

    const statusClasses = {
      draft: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
      reviewed: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
      approved: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
      stale: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
    };

    const label = proverb.alignment_status.charAt(0).toUpperCase() + proverb.alignment_status.slice(1);
    const detail = proverb.alignment_status === "stale" && proverb.alignment_stale_reason
      ? `Alignment stale: ${proverb.alignment_stale_reason.replaceAll("_", " ")}`
      : `Alignment ${proverb.alignment_status}`;

    return (
      <span
        title={detail}
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClasses[proverb.alignment_status]}`}
      >
        {label} Alignment
      </span>
    );
  };

  const renderAlignmentJobBadge = (proverb: Proverb) => {
    if (!proverb.alignment_job_status) {
      return null;
    }

    const statusClasses = {
      queued: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
      processing: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
      completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
      failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
      cancelled: "bg-muted text-foreground",
      superseded: "bg-muted text-foreground",
    };

    const providerDetail = [proverb.alignment_job_provider, proverb.alignment_job_engine].filter(Boolean).join(" / ");
    const detail = proverb.alignment_job_status === "failed" && proverb.alignment_job_error
      ? `Auto-alignment failed: ${proverb.alignment_job_error}`
      : providerDetail
        ? `Latest auto-alignment job ${proverb.alignment_job_status} via ${providerDetail}`
        : `Latest auto-alignment job ${proverb.alignment_job_status}`;

    return (
      <span
        title={detail}
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClasses[proverb.alignment_job_status]}`}
      >
        Align {proverb.alignment_job_status.charAt(0).toUpperCase() + proverb.alignment_job_status.slice(1)}
      </span>
    );
  };

  const renderRegenerationBadge = (status?: string | null, error?: string | null) => {
    if (!status) {
      return null;
    }

    if (status === "queued") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          Audio Queued
        </span>
      );
    }

    if (status === "processing") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
          Audio Processing
        </span>
      );
    }

    if (status !== "failed") {
      return null;
    }

    return (
      <span
        title={error || "The latest audio regeneration attempt failed."}
        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
      >
        Audio Failed
      </span>
    );
  };

  const isRegenerationPending = (status?: string | null) => status === "queued" || status === "processing";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <>
    {/* Desktop Table View */}
    <div className="hidden lg:block bg-card rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {onSelectAll && (
                <th className="px-3 py-3.5 text-left text-sm font-medium text-muted-foreground w-12">
                  <input
                    type="checkbox"
                    checked={selectedProverbs.length === proverbs.length && proverbs.length > 0}
                    onChange={onSelectAll}
                    className="h-4 w-4 rounded border-input text-brand-600 focus:ring-brand-500 dark:bg-gray-800"
                  />
                </th>
              )}
              <th className="px-3 py-3.5 text-left text-sm font-medium text-muted-foreground">
                Proverb
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-medium text-muted-foreground">
                Category
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-medium text-muted-foreground">
                Alignment
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-medium text-muted-foreground">
                Audio
              </th>
              <th className="px-3 py-3.5 text-right text-sm font-medium text-muted-foreground">
                Actions
              </th>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border">
            {proverbs.length > 0 ? (
              proverbs.map((proverb) => (
                <TableRow key={proverb.id}>
                  {onSelectProverb && (
                    <TableCell className="px-5 py-4 text-start w-12">
                      <input
                        type="checkbox"
                        checked={selectedProverbs.includes(proverb.id)}
                        onChange={() => onSelectProverb(proverb.id)}
                        className="h-4 w-4 rounded border-input text-brand-600 focus:ring-brand-500 dark:bg-gray-800"
                      />
                    </TableCell>
                  )}
                  {/* Proverb */}
                  <TableCell className="px-5 py-4 max-w-xs">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-foreground truncate">
                        {proverb.proverb}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {proverb.translation}
                      </div>
                    </div>
                  </TableCell>

                  {/* Category */}
                  <TableCell className="px-5 py-4">
                    <div className="flex flex-col items-start gap-2">
                      {proverb.category ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400">
                          {proverb.category}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                      {renderPublishBadge(proverb)}
                    </div>
                  </TableCell>

                  {/* Alignment */}
                  <TableCell className="px-5 py-4">
                    <div className="flex flex-col items-start gap-2">
                      {renderAlignmentBadge(proverb)}
                      {renderAlignmentJobBadge(proverb)}
                      {!proverb.alignment_status && !proverb.alignment_job_status && (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </div>
                  </TableCell>

                  {/* Audio */}
                  <TableCell className="px-5 py-4">
                    {/* Pending candidate -- show before current */}
                      {proverb.pending_audio_version && (
                        <div className="min-w-[280px] max-w-md rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-800 dark:text-amber-200">
                              Pending Review
                            </span>
                          </div>
                          {proverb.pending_audio_version.audio_url && (
                            <InlineAudioPlayer src={proverb.pending_audio_version.audio_url} size="md" />
                          )}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                const btn = e.currentTarget as HTMLButtonElement;
                                btn.disabled = true;
                                btn.textContent = "...";
                                try {
                                  await onAcceptAudio?.(proverb.id, proverb.pending_audio_version!.id);
                                } finally {
                                  btn.disabled = false;
                                  btn.textContent = "Accept";
                                }
                              }}
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 transition-colors"
                            >
                              Accept
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                const btn = e.currentTarget as HTMLButtonElement;
                                btn.disabled = true;
                                btn.textContent = "...";
                                try {
                                  await onRejectAudio?.(proverb.id, proverb.pending_audio_version!.id);
                                } finally {
                                  btn.disabled = false;
                                  btn.textContent = "Reject";
                                }
                              }}
                              className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 transition-colors dark:border-red-700 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-900/20"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Current approved audio */}
                      {proverb.audio_url ? (
                        <div className="min-w-[280px] max-w-md space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {getAudioFormat(proverb) && (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                {getAudioFormat(proverb)}
                              </span>
                            )}
                            <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-green-700 dark:bg-green-800 dark:text-green-200">
                              Approved
                            </span>
                            {renderRegenerationBadge(proverb.last_regeneration_status, proverb.last_regeneration_error)}
                          </div>
                          <InlineAudioPlayer src={proverb.audio_url} size="md" />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {renderRegenerationBadge(proverb.last_regeneration_status, proverb.last_regeneration_error)}
                          <span className="text-xs text-muted-foreground">No audio</span>
                        </div>
                      )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onRegenerateAudio(proverb)}
                        disabled={isRegenerationPending(proverb.last_regeneration_status)}
                        className="inline-flex items-center rounded-lg p-2 text-brand-600 transition-colors hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50 disabled:cursor-not-allowed dark:text-brand-400 dark:hover:bg-brand-900/20"
                        title={
                          proverb.last_regeneration_status === "queued"
                            ? "Queued"
                            : proverb.last_regeneration_status === "processing"
                              ? "Processing..."
                              : "Regenerate Audio"
                        }
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onEdit(proverb)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50 hover:text-brand-700 dark:text-brand-400 dark:hover:bg-brand-900/20"
                      >
                        <SquarePen className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => onDelete(proverb.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <td
                  colSpan={onSelectAll ? 6 : 5}
                  className="px-3 py-12 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-sm font-medium">No proverbs found</p>
                    <p className="text-xs text-muted-foreground">
                      Try adjusting your filters or add a new proverb
                    </p>
                  </div>
                </td>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>

    {/* Mobile Grid View */}
    <div className="lg:hidden grid grid-cols-1 gap-4">
      {isLoading ? (
        <div className="flex items-center justify-center h-64 bg-card rounded-lg border border-border">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
        </div>
      ) : proverbs.length > 0 ? (
        proverbs.map((proverb) => (
          <div
            key={proverb.id}
            className="bg-card rounded-lg border border-border p-4"
          >
            {/* Proverb */}
            <div className="mb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase mb-1">
                      Proverb
                    </div>
                    <div className="text-base font-semibold text-foreground">
                      {proverb.proverb}
                    </div>
                  </div>
                  {onSelectProverb && (
                    <input
                      type="checkbox"
                      checked={selectedProverbs.includes(proverb.id)}
                      onChange={() => onSelectProverb(proverb.id)}
                      className="mt-1 h-4 w-4 rounded border-input text-brand-600 focus:ring-brand-500 dark:bg-gray-800"
                    />
                  )}
              </div>
            </div>

            {/* Translation */}
            <div className="mb-3">
              <div className="text-xs font-medium text-muted-foreground uppercase mb-1">
                Translation
              </div>
              <div className="text-sm text-muted-foreground">
                {proverb.translation}
              </div>
            </div>

            {/* Meaning */}
            {proverb.meaning && (
              <div className="mb-3">
                <div className="text-xs font-medium text-muted-foreground uppercase mb-1">
                  Meaning
                </div>
                <div className="text-sm text-muted-foreground">
                  {proverb.meaning}
                </div>
              </div>
            )}

            {/* Category */}
            {proverb.category && (
              <div className="mb-3">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400">
                  {proverb.category}
                </span>
              </div>
            )}

            <div className="mb-3">
              {renderPublishBadge(proverb)}
            </div>

            {(proverb.alignment_status || proverb.alignment_job_status) && (
              <div className="mb-3">
                <div className="text-xs font-medium text-muted-foreground uppercase mb-1">
                  Alignment
                </div>
                <div className="flex flex-wrap gap-2">
                  {renderAlignmentBadge(proverb)}
                  {renderAlignmentJobBadge(proverb)}
                </div>
              </div>
            )}

            {/* Audio */}
            <div className="mb-3">
              <div className="mb-1 flex items-center gap-2">
                <div className="text-xs font-medium text-muted-foreground uppercase">
                  Audio
                </div>
                {getAudioFormat(proverb) && (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {getAudioFormat(proverb)}
                  </span>
                )}
              </div>
              {proverb.last_regeneration_status && (
                <div className="mb-2">
                  {renderRegenerationBadge(proverb.last_regeneration_status, proverb.last_regeneration_error)}
                </div>
              )}
              {proverb.audio_url ? (
                <InlineAudioPlayer src={proverb.audio_url} size="md" />
              ) : (
                <div className="text-xs text-muted-foreground">No audio</div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 border-t border-border pt-3">
              <button
                onClick={() => onRegenerateAudio(proverb)}
                disabled={isRegenerationPending(proverb.last_regeneration_status)}
                className="flex-1 inline-flex items-center justify-center rounded-lg px-3 py-2 text-brand-600 bg-brand-50 hover:bg-brand-100 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-brand-900/20 dark:text-brand-400"
                title={
                  proverb.last_regeneration_status === "queued"
                    ? "Queued"
                    : proverb.last_regeneration_status === "processing"
                      ? "Processing..."
                      : "Regenerate Audio"
                }
              >
                <Volume2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => onEdit(proverb)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-brand-600 bg-brand-50 hover:bg-brand-100 dark:bg-brand-900/20 dark:text-brand-400"
              >
                <SquarePen className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                onClick={() => onDelete(proverb.id)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          </div>
        ))
      ) : (
        <div className="flex flex-col items-center gap-2 p-12 bg-card rounded-lg border border-border">
          <p className="text-sm font-medium text-muted-foreground">No proverbs found</p>
          <p className="text-xs text-muted-foreground">
            Try adjusting your filters or add a new proverb
          </p>
        </div>
      )}
    </div>
    </>
  );
}

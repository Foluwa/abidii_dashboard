"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Pagination from "@/components/tables/Pagination";
import Button from "@/components/ui/button/Button";
import { useToast } from "@/contexts/ToastContext";
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
  applyHandwritingPromotion,
  bulkUpdateHandwritingCandidates,
  createHandwritingCandidateManifest,
  dryRunHandwritingPromotion,
  getHandwritingCandidateManifest,
  getHandwritingCandidatePreviewUrl,
  listHandwritingCandidateManifests,
  listHandwritingCandidates,
  updateHandwritingCandidate,
  type HandwritingCandidate,
  type HandwritingCandidateManifest,
  type HandwritingPromotionResult,
} from "@/lib/adminMlApi";

const PAGE_SIZE = 25;

function statusCountFor(manifest: HandwritingCandidateManifest, status: string) {
  return manifest.status_counts?.[status] ?? 0;
}

export function MLHandwritingCandidateManifestsPage() {
  const toast = useToast();
  const [manifests, setManifests] = useState<HandwritingCandidateManifest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [languageFilter, setLanguageFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [sourcePrefix, setSourcePrefix] = useState("");
  const [createLanguage, setCreateLanguage] = useState<"yor" | "eng">("yor");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listHandwritingCandidateManifests({
        language_code: languageFilter || undefined,
        limit: 50,
        offset: 0,
      });
      setManifests(response.items);
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message ?? err?.message ?? "Unable to load candidate manifests.");
    } finally {
      setLoading(false);
    }
  }, [languageFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createManifest = useCallback(async () => {
    setCreating(true);
    try {
      const result = await createHandwritingCandidateManifest({
        language_code: createLanguage,
        source: "drawings",
        source_prefix: sourcePrefix || undefined,
        dry_run: false,
      });
      toast.success(`Created manifest ${(result.manifest as any)?.id ?? ""}.`.trim());
      await refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail?.message ?? err?.message ?? "Unable to create manifest.");
    } finally {
      setCreating(false);
    }
  }, [createLanguage, refresh, sourcePrefix, toast]);

  return (
    <div className="space-y-6 p-6">
      <PageBreadCrumb pageTitle="Candidate Review" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Candidate Review</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            DB-backed handwriting candidate review - imports from R2 <code>drawings/</code>, reviews approve/reject
            individually or in bulk, then promotes approved candidates straight into <code>datasets/training/</code>.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/operations/ml-training/vision-jobs">
            <Button variant="outline" size="sm">Vision Jobs</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>Refresh</Button>
        </div>
      </div>
      {error ? <InlineError message={error} /> : null}

      <Panel title="Import New Manifest">
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Scans an R2 prefix (default <code>drawings/{"{language}"}/</code>) and creates a manifest of candidate
          rows for review. Never touches <code>datasets/training/</code> until promotion is explicitly applied.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <StyledSelect
            value={createLanguage}
            onChange={(event) => setCreateLanguage(event.target.value as "yor" | "eng")}
            options={[
              { value: "yor", label: "Yoruba" },
              { value: "eng", label: "English" },
            ]}
          />
          <input
            value={sourcePrefix}
            onChange={(event) => setSourcePrefix(event.target.value)}
            placeholder={`drawings/${createLanguage}/ (default)`}
            className="w-72 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
          <Button size="sm" onClick={() => void createManifest()} disabled={creating}>
            {creating ? "Creating..." : "Create Manifest"}
          </Button>
        </div>
      </Panel>

      <Panel
        title="Manifests"
        action={
          <StyledSelect
            value={languageFilter}
            onChange={(event) => setLanguageFilter(event.target.value)}
            options={[
              { value: "", label: "All languages" },
              { value: "yor", label: "yor" },
              { value: "eng", label: "eng" },
            ]}
          />
        }
      >
        {loading && manifests.length === 0 ? (
          <LoadingBlock />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-800">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                  <th className="px-3 py-2">Manifest</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Approved</th>
                  <th className="px-3 py-2">Rejected</th>
                  <th className="px-3 py-2">Pending</th>
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
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                      {manifest.language_code} / {manifest.source}
                    </td>
                    <td className="px-3 py-3"><StatusPill status={manifest.status} /></td>
                    <td className="px-3 py-3">{statusCountFor(manifest, "approved")}</td>
                    <td className="px-3 py-3">{statusCountFor(manifest, "rejected")}</td>
                    <td className="px-3 py-3">{statusCountFor(manifest, "pending")}</td>
                    <td className="px-3 py-3">
                      <Link href={`/operations/ml-training/candidate-manifests/${manifest.id}`} className="text-brand-600 hover:underline">
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {manifests.length === 0 ? <div className="p-4 text-sm text-gray-500 dark:text-gray-400">No candidate manifests found.</div> : null}
          </div>
        )}
      </Panel>
    </div>
  );
}

function CandidateImagePreview({ candidate }: { candidate: HandwritingCandidate }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getHandwritingCandidatePreviewUrl(candidate.id);
      setUrl(response.preview_url);
    } finally {
      setLoading(false);
    }
  }, [candidate.id]);

  return (
    <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={candidate.final_label || candidate.raw_label || "candidate"} loading="lazy" className="max-h-full max-w-full object-contain" />
      ) : (
        <button onClick={() => void load()} className="px-2 text-xs text-brand-600 hover:underline" disabled={loading}>
          {loading ? "Loading..." : "Preview"}
        </button>
      )}
    </div>
  );
}

export function MLHandwritingCandidateManifestDetailPage() {
  const toast = useToast();
  const params = useParams<{ id: string }>();
  const manifestId = String(params?.id || "");
  const [manifest, setManifest] = useState<HandwritingCandidateManifest | null>(null);
  const [candidates, setCandidates] = useState<HandwritingCandidate[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [caseGroup, setCaseGroup] = useState("");
  const [label, setLabel] = useState("");
  const [reviewStatus, setReviewStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [promotionResult, setPromotionResult] = useState<HandwritingPromotionResult | null>(null);
  const [promoting, setPromoting] = useState(false);

  const refresh = useCallback(async () => {
    if (!manifestId) return;
    setLoading(true);
    setError(null);
    try {
      const [detail, candidateResponse] = await Promise.all([
        getHandwritingCandidateManifest(manifestId),
        listHandwritingCandidates({
          manifest_id: manifestId,
          case_group: caseGroup || undefined,
          label: label || undefined,
          review_status: reviewStatus || undefined,
          limit: PAGE_SIZE,
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
  }, [caseGroup, label, manifestId, offset, reviewStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateVisible = useCallback(
    async (status: "pending" | "approved" | "rejected", candidateIds?: string[]) => {
      const ids = candidateIds || candidates.map((candidate) => candidate.id);
      if (ids.length === 0) return;
      if (candidateIds === undefined && !window.confirm(`Set ${ids.length} visible candidates to ${status}?`)) return;
      setError(null);
      setSuccess(null);
      try {
        if (ids.length === 1) {
          await updateHandwritingCandidate(ids[0], { review_status: status });
        } else {
          await bulkUpdateHandwritingCandidates({ candidate_ids: ids, review_status: status });
        }
        setSuccess(`Updated ${ids.length} candidate(s).`);
        await refresh();
      } catch (err: any) {
        setError(err?.response?.data?.detail?.message ?? err?.message ?? "Unable to update candidates.");
      }
    },
    [candidates, refresh]
  );

  const runPromotion = useCallback(
    async (apply: boolean) => {
      setPromoting(true);
      setError(null);
      setSuccess(null);
      try {
        let result: HandwritingPromotionResult;
        if (!apply) {
          result = await dryRunHandwritingPromotion(manifestId);
        } else {
          const confirmation = window.prompt(`Type PROMOTE ${manifestId} to copy approved candidates into datasets/training/*`);
          if (!confirmation) {
            setPromoting(false);
            return;
          }
          result = await applyHandwritingPromotion(manifestId, confirmation);
        }
        setPromotionResult(result);
        setSuccess(`Promotion ${apply ? "applied" : "dry-run"} completed.`);
        if (apply) await refresh();
      } catch (err: any) {
        setError(err?.response?.data?.detail?.message ?? err?.message ?? "Unable to run promotion.");
      } finally {
        setPromoting(false);
      }
    },
    [manifestId, refresh]
  );

  return (
    <div className="space-y-6 p-6">
      <PageBreadCrumb pageTitle="Candidate Manifest Review" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{manifestId}</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Approve or reject candidates before promotion into datasets/training/*.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>Refresh</Button>
      </div>
      {error ? <InlineError message={error} /> : null}
      {success ? <InlineSuccess message={success} /> : null}
      {manifest ? (
        <div className="grid gap-4 md:grid-cols-4">
          <SummaryCard label="Approved" value={statusCountFor(manifest, "approved")} />
          <SummaryCard label="Rejected" value={statusCountFor(manifest, "rejected")} />
          <SummaryCard label="Pending" value={statusCountFor(manifest, "pending")} />
          <SummaryCard label="Status" value={manifest.status} />
        </div>
      ) : null}

      <Panel title="Promotion">
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          Promotion copies approved candidates into <code>datasets/training/{"{language}"}/alphabets/{"{case}"}/{"{label}"}/</code>.
          Blocked while any candidates remain pending. Apply requires typing an exact confirmation phrase.
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void runPromotion(false)} disabled={promoting}>
            {promoting ? "Working..." : "Dry-run Promotion"}
          </Button>
          <Button size="sm" onClick={() => void runPromotion(true)} disabled={promoting}>
            {promoting ? "Working..." : "Apply Promotion"}
          </Button>
        </div>
        {promotionResult ? (
          <div className="mt-4 space-y-3">
            {promotionResult.per_class_impact.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-800">
                  <thead>
                    <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                      <th className="px-3 py-2">Class</th>
                      <th className="px-3 py-2">Before</th>
                      <th className="px-3 py-2">Added</th>
                      <th className="px-3 py-2">After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {promotionResult.per_class_impact.map((impact) => (
                      <tr key={impact.class_id}>
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{impact.class_id}</td>
                        <td className="px-3 py-2">{impact.before}</td>
                        <td className="px-3 py-2">{impact.would_add || impact.added}</td>
                        <td className="px-3 py-2">{impact.after}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <JsonPreview value={promotionResult} />
          </div>
        ) : null}
      </Panel>

      <Panel title="Candidates">
        <div className="mb-4 flex flex-wrap gap-3">
          <StyledSelect
            value={caseGroup}
            onChange={(event) => { setOffset(0); setCaseGroup(event.target.value); }}
            options={[
              { value: "", label: "All cases" },
              { value: "LOWER_CASE", label: "Lower case" },
              { value: "UPPER_CASE", label: "Upper case" },
            ]}
          />
          <StyledSelect
            value={reviewStatus}
            onChange={(event) => { setOffset(0); setReviewStatus(event.target.value); }}
            options={[
              { value: "", label: "All statuses" },
              { value: "pending", label: "pending" },
              { value: "approved", label: "approved" },
              { value: "rejected", label: "rejected" },
            ]}
          />
          <input
            value={label}
            onChange={(event) => { setOffset(0); setLabel(event.target.value); }}
            placeholder="Label"
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void updateVisible("approved")}>Approve Visible</Button>
          <Button variant="outline" size="sm" onClick={() => void updateVisible("rejected")}>Reject Visible</Button>
          <Button variant="outline" size="sm" onClick={() => void updateVisible("pending")}>Reset Visible</Button>
        </div>
        <div className="space-y-3">
          {candidates.map((candidate) => (
            <div key={candidate.id} className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="flex flex-col gap-4 md:flex-row">
                <CandidateImagePreview candidate={candidate} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={candidate.review_status} />
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {candidate.language_code} / {candidate.final_case_group || "-"} / {candidate.final_label || candidate.raw_label || "-"}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{candidate.source_type}</span>
                    {candidate.vision_status !== "not_requested" ? <StatusPill status={`vision:${candidate.vision_status}`} /> : null}
                  </div>
                  <div className="mt-2 break-all text-xs text-gray-500 dark:text-gray-400">{candidate.source_key}</div>
                  {candidate.suggested_label ? (
                    <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                      vision suggestion: {candidate.suggested_case_group} / {candidate.suggested_label}
                      {candidate.vision_confidence != null ? ` (${(candidate.vision_confidence * 100).toFixed(0)}%)` : ""}
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-row gap-2 md:flex-col">
                  <Button size="sm" variant="outline" onClick={() => void updateVisible("approved", [candidate.id])}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => void updateVisible("rejected", [candidate.id])}>Reject</Button>
                  <Button size="sm" variant="outline" onClick={() => void updateVisible("pending", [candidate.id])}>Pending</Button>
                </div>
              </div>
            </div>
          ))}
          {loading ? <LoadingBlock /> : null}
          {!loading && candidates.length === 0 ? <div className="text-sm text-gray-500 dark:text-gray-400">No candidates match these filters.</div> : null}
        </div>
        <div className="mt-4">
          <Pagination
            currentPage={Math.floor(offset / PAGE_SIZE) + 1}
            totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
            onPageChange={(page) => setOffset((page - 1) * PAGE_SIZE)}
          />
        </div>
      </Panel>
    </div>
  );
}

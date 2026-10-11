"use client";

/**
 * Learning patterns (content_patterns) - e.g. Yorùbá number formation
 * rules. Formerly its own page at /content/patterns; now a section of the
 * Numbers page because every row is a number_formation pattern and every
 * consumer is a numbers feature:
 *  - the app's Numbers hub pattern list (GET /languages/{code}/patterns)
 *  - the numbers-practice primer micro-lesson + pattern exposure
 *    (POST /games/numbers/identify/preflight → LearningPathService)
 *  - the Tutor's number explanations and suggested questions
 *  - lesson blueprint `pattern_codes` validation
 * /content/patterns redirects to /content/numbers?section=patterns.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, Layers, Pencil, Plus, Trash2 } from "lucide-react";

import { apiClient } from "@/lib/api";
import { useAdminLanguages } from "@/hooks/useApi";
import { useToast } from "@/contexts/ToastContext";
import { useConfirm } from "@/hooks/useConfirm";
import { Modal } from "@/components/ui/modal";
import { StyledSelect } from "@/components/ui/form/StyledSelect";
import { Pill, type PillTone } from "@/components/subscriptions/subscriptionDisplay";
import type { ContentPattern } from "@/types/content";

export const PATTERN_CATEGORIES = [
  { value: "number_formation", label: "Number Formation" },
  { value: "grammar", label: "Grammar" },
  { value: "pronunciation", label: "Pronunciation" },
  { value: "vocabulary", label: "Vocabulary" },
  { value: "cultural", label: "Cultural" },
];

const DIFFICULTIES = [
  { value: 1, label: "1 - Very Easy" },
  { value: 2, label: "2 - Easy" },
  { value: 3, label: "3 - Medium" },
  { value: 4, label: "4 - Hard" },
  { value: 5, label: "5 - Very Hard" },
];

const DIFFICULTY_TONE: Record<number, PillTone> = {
  1: "green",
  2: "teal",
  3: "yellow",
  4: "amber",
  5: "red",
};

export function DifficultyPill({ difficulty }: { difficulty: number }) {
  return (
    <Pill tone={DIFFICULTY_TONE[difficulty] ?? "neutral"} title={`Difficulty ${difficulty} of 5`}>
      Difficulty {difficulty}
    </Pill>
  );
}

const ROW_ICON_BUTTON_CLASS =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg text-brand-600 hover:bg-brand-50 hover:text-brand-900 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-brand-400 dark:hover:bg-brand-900/30 dark:hover:text-brand-300";
const ROW_DANGER_ICON_BUTTON_CLASS =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-destructive/30 dark:text-red-400 dark:hover:bg-red-900/30 dark:hover:text-red-300";
const INPUT_CLASS =
  "block w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

interface PatternForm {
  language_id: string;
  pattern_key: string;
  title: string;
  subtitle: string;
  description: string;
  difficulty: number;
  category: string;
  sort_order: number;
  configText: string;
}

interface LanguageOption {
  id: string;
  name: string;
  iso_639_3: string;
}

/** Display order: sort_order then pattern_key (same as GET /admin/patterns). */
export function sortPatterns<T extends { sort_order: number; pattern_key: string }>(
  patterns: ReadonlyArray<T>,
): T[] {
  return [...patterns].sort(
    (a, b) => a.sort_order - b.sort_order || a.pattern_key.localeCompare(b.pattern_key),
  );
}

interface ContentPatternsPanelProps {
  /** The Numbers page's language filter; undefined = all languages. */
  languageId?: string;
}

export function ContentPatternsPanel({ languageId }: ContentPatternsPanelProps) {
  const toast = useToast();
  // The toast context value is a fresh object on every provider render;
  // keep it out of fetchPatterns' deps so a toast can't trigger a refetch loop.
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const { confirm, modal: confirmModal } = useConfirm();
  const { languages } = useAdminLanguages();
  const searchParams = useSearchParams();
  const focused = searchParams?.get("section") === "patterns";
  const sectionRef = useRef<HTMLElement>(null);

  const [open, setOpen] = useState(focused);
  const [patterns, setPatterns] = useState<ContentPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState<PatternForm | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const languageList = (languages || []) as LanguageOption[];
  const languageName = (id: string) => languageList.find((l) => l.id === id)?.name ?? "";

  const fetchPatterns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<ContentPattern[]>("/api/v1/admin/patterns", {
        params: languageId ? { language_id: languageId } : undefined,
      });
      setPatterns(sortPatterns(res.data || []));
    } catch {
      toastRef.current.error("Failed to fetch patterns");
      setPatterns([]);
    } finally {
      setLoading(false);
    }
  }, [languageId]);

  useEffect(() => {
    fetchPatterns();
  }, [fetchPatterns]);

  useEffect(() => {
    if (focused) sectionRef.current?.scrollIntoView?.({ block: "start" });
  }, [focused]);

  const defaultLanguageId = () =>
    languageId || languageList.find((l) => l.iso_639_3 === "yor")?.id || languageList[0]?.id || "";

  const openCreate = () => {
    setEditingId(null);
    setForm({
      language_id: defaultLanguageId(),
      pattern_key: "",
      title: "",
      subtitle: "",
      description: "",
      difficulty: 1,
      category: "number_formation",
      sort_order: patterns.length ? Math.max(...patterns.map((p) => p.sort_order)) + 1 : 1,
      configText: "{}",
    });
  };

  const openEdit = (p: ContentPattern) => {
    setEditingId(p.id);
    setForm({
      language_id: p.language_id,
      pattern_key: p.pattern_key,
      title: p.title,
      subtitle: p.subtitle || "",
      description: p.description || "",
      difficulty: p.difficulty,
      category: p.category || "number_formation",
      sort_order: p.sort_order,
      configText: JSON.stringify(p.config || {}, null, 2),
    });
  };

  const handleDelete = async (p: ContentPattern) => {
    if (
      !(await confirm({
        title: "Delete pattern",
        message: `Delete "${p.title}" (${p.pattern_key})? The app's Numbers hub, practice primers and Tutor read these patterns, and learners' exposure progress references them.`,
        confirmLabel: "Delete",
        variant: "danger",
      }))
    ) {
      return;
    }
    try {
      await apiClient.delete(`/api/v1/admin/patterns/${p.id}`);
      toast.success("Pattern deleted");
      fetchPatterns();
    } catch {
      toast.error("Failed to delete pattern");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    let config: Record<string, unknown>;
    try {
      const parsed = JSON.parse(form.configText.trim() || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      config = parsed;
    } catch {
      toast.error("Configuration must be a JSON object");
      return;
    }
    const body = {
      pattern_key: form.pattern_key.trim(),
      title: form.title.trim(),
      subtitle: form.subtitle,
      description: form.description,
      difficulty: form.difficulty,
      category: form.category,
      sort_order: form.sort_order,
      config,
    };
    setIsSubmitting(true);
    try {
      if (editingId) {
        await apiClient.put(`/api/v1/admin/patterns/${editingId}`, body);
        toast.success("Pattern updated");
      } else {
        await apiClient.post("/api/v1/admin/patterns", { ...body, language_id: form.language_id });
        toast.success("Pattern created");
      }
      setForm(null);
      fetchPatterns();
    } catch {
      toast.error(editingId ? "Failed to update pattern" : "Failed to create pattern");
    } finally {
      setIsSubmitting(false);
    }
  };

  const setField = <K extends keyof PatternForm>(key: K, value: PatternForm[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  return (
    <section
      ref={sectionRef}
      id="patterns"
      aria-labelledby="patterns-heading"
      className="overflow-hidden rounded-xl border border-border bg-card shadow-theme-xs"
    >
      {confirmModal}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-5 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="patterns-body"
          className="flex min-w-0 items-center gap-2 text-left"
        >
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <span className="min-w-0">
            <span id="patterns-heading" className="block text-sm font-semibold text-foreground">
              Formation patterns{" "}
              <span className="font-normal text-muted-foreground">
                ({loading ? "…" : patterns.length})
              </span>
            </span>
            <span className="block text-xs text-muted-foreground">
              Rules that explain how number words are built - shown in the app&apos;s Numbers hub,
              practice primers and Tutor
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            openCreate();
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Add Pattern
        </button>
      </div>

      {open && (
        <div id="patterns-body">
          {loading ? (
            <div className="flex h-32 items-center justify-center" role="status" aria-label="Loading">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
            </div>
          ) : patterns.length === 0 ? (
            <div className="px-5 py-12 text-center text-muted-foreground">
              <Layers className="mx-auto mb-3 h-8 w-8" aria-hidden="true" />
              <p>No patterns for this language</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {patterns.map((p, index) => {
                const expanded = expandedId === p.id;
                const hasConfig = p.config && Object.keys(p.config).length > 0;
                return (
                  <li key={p.id} data-testid={`pattern-row-${p.pattern_key}`}>
                    <div className="flex items-center gap-3 px-5 py-2.5 hover:bg-accent">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : p.id)}
                        aria-expanded={expanded}
                        aria-label={`${expanded ? "Collapse" : "Expand"} ${p.title}`}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <span
                          className="w-6 shrink-0 text-right text-sm tabular-nums text-muted-foreground"
                          title="Position (sort order)"
                          data-testid="pattern-position"
                        >
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">{p.title}</span>
                          {p.subtitle && (
                            <span className="block truncate text-xs text-muted-foreground">{p.subtitle}</span>
                          )}
                        </span>
                      </button>
                      <div className="hidden shrink-0 items-center gap-2 sm:flex">
                        <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                          {p.pattern_key}
                        </span>
                        {!languageId && languageName(p.language_id) && (
                          <Pill tone="blue">{languageName(p.language_id)}</Pill>
                        )}
                        {p.category && p.category !== "number_formation" && (
                          <Pill tone="indigo">
                            {PATTERN_CATEGORIES.find((c) => c.value === p.category)?.label ?? p.category}
                          </Pill>
                        )}
                        <DifficultyPill difficulty={p.difficulty} />
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          aria-label={`Edit ${p.title}`}
                          title="Edit"
                          className={ROW_ICON_BUTTON_CLASS}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p)}
                          aria-label={`Delete ${p.title}`}
                          title="Delete"
                          className={ROW_DANGER_ICON_BUTTON_CLASS}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    {expanded && (
                      <div className="space-y-3 border-t border-border bg-muted/20 px-5 py-4 pl-14 text-sm">
                        <p className="text-muted-foreground">{p.description || "No description."}</p>
                        {hasConfig && (
                          <div>
                            <h4 className="mb-1 text-xs font-medium text-foreground">Configuration</h4>
                            <pre className="overflow-x-auto rounded-lg bg-muted/50 p-3 text-xs">
                              {JSON.stringify(p.config, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <Modal
        isOpen={form !== null}
        onClose={isSubmitting ? () => {} : () => setForm(null)}
        title={editingId ? "Edit Pattern" : "Add Pattern"}
        maxWidth="2xl"
        showCloseButton={!isSubmitting}
      >
        {form && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <StyledSelect
                label="Language"
                value={form.language_id}
                onChange={(e) => setField("language_id", String(e.target.value))}
                options={languageList.map((l) => ({ value: l.id, label: l.name }))}
                disabled={!!editingId}
                fullWidth
              />
              <StyledSelect
                label="Category"
                value={form.category}
                onChange={(e) => setField("category", String(e.target.value))}
                options={PATTERN_CATEGORIES}
                fullWidth
              />
            </div>
            <div>
              <label htmlFor="pattern-key" className="mb-1 block text-sm font-medium text-foreground">
                Pattern Key *
              </label>
              <input
                id="pattern-key"
                value={form.pattern_key}
                onChange={(e) => setField("pattern_key", e.target.value)}
                placeholder="e.g. SUBTRACTIVE_15_19"
                className={`${INPUT_CLASS} font-mono`}
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Lesson blueprints reference this key in pattern_codes.
              </p>
            </div>
            <div>
              <label htmlFor="pattern-title" className="mb-1 block text-sm font-medium text-foreground">
                Title *
              </label>
              <input
                id="pattern-title"
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
                placeholder="e.g. Subtractive Pattern (15-19)"
                className={INPUT_CLASS}
                required
              />
            </div>
            <div>
              <label htmlFor="pattern-subtitle" className="mb-1 block text-sm font-medium text-foreground">
                Subtitle
              </label>
              <input
                id="pattern-subtitle"
                value={form.subtitle}
                onChange={(e) => setField("subtitle", e.target.value)}
                placeholder="Short description shown in lists"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="pattern-description" className="mb-1 block text-sm font-medium text-foreground">
                Description
              </label>
              <textarea
                id="pattern-description"
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                rows={4}
                placeholder="Full explanation of the pattern..."
                className={INPUT_CLASS}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <StyledSelect
                label="Difficulty"
                value={form.difficulty}
                onChange={(e) => setField("difficulty", Number(e.target.value))}
                options={DIFFICULTIES}
                fullWidth
              />
              <div>
                <label htmlFor="pattern-sort" className="mb-1 block text-sm font-medium text-foreground">
                  Sort Order
                </label>
                <input
                  id="pattern-sort"
                  type="number"
                  min={0}
                  value={form.sort_order}
                  onChange={(e) => setField("sort_order", Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className={INPUT_CLASS}
                />
              </div>
            </div>
            <div>
              <label htmlFor="pattern-config" className="mb-1 block text-sm font-medium text-foreground">
                Configuration (JSON)
              </label>
              <textarea
                id="pattern-config"
                value={form.configText}
                onChange={(e) => setField("configText", e.target.value)}
                rows={5}
                spellCheck={false}
                className={`${INPUT_CLASS} font-mono text-xs`}
              />
            </div>
            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setForm(null)}
                disabled={isSubmitting}
                className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !form.language_id}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-brand-700 disabled:opacity-50"
              >
                {isSubmitting ? "Saving..." : editingId ? "Update" : "Create"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}

export default ContentPatternsPanel;

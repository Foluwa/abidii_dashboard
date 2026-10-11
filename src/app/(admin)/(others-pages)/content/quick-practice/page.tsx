"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";

import { apiClient } from "@/lib/api";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Alert from "@/components/ui/alert/SimpleAlert";
import { Modal } from "@/components/ui/modal";
import { StyledSelect } from "@/components/ui/form/StyledSelect";
import { useToast } from "@/contexts/ToastContext";
import { useConfirm } from "@/hooks/useConfirm";
import { Pill } from "@/components/subscriptions/subscriptionDisplay";
import {
  QuickPracticeIcon,
  getQuickPracticeIconOptions,
  getSortOrderFixes,
  sortQuickPracticeItems,
} from "@/components/content/quickPractice";

interface QuickPracticeItem {
  id?: string;
  item_id: string;
  title: string;
  subtitle: string;
  icon: string;
  sort_order: number;
  enabled: boolean;
}

const TH_CLASS = "px-3 py-2.5 text-left text-sm font-medium text-muted-foreground";
const TD_CLASS = "px-3 py-2.5 text-sm";
const ROW_ICON_BUTTON_CLASS =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg text-brand-600 hover:bg-brand-50 hover:text-brand-900 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-brand-400 dark:hover:bg-brand-900/30 dark:hover:text-brand-300";
const ROW_DANGER_ICON_BUTTON_CLASS =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-destructive/30 dark:text-red-400 dark:hover:bg-red-900/30 dark:hover:text-red-300";
const ARROW_BUTTON_CLASS =
  "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-30";
const INPUT_CLASS =
  "block w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-60";

function errorDetail(e: unknown, fallback: string): string {
  const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
}

export default function QuickPracticePage() {
  const toast = useToast();
  const { confirm, modal: confirmModal } = useConfirm();
  const [items, setItems] = useState<QuickPracticeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<QuickPracticeItem | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  const sortedItems = useMemo(() => sortQuickPracticeItems(items), [items]);

  const fetchItems = useCallback(async () => {
    try {
      const res = await apiClient.get("/api/v1/admin/quick-practice");
      setItems(res.data.items || []);
      setError("");
    } catch (e: unknown) {
      setError(errorDetail(e, "Failed to load items"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const putItem = (item: QuickPracticeItem) =>
    apiClient.put(`/api/v1/admin/quick-practice/${encodeURIComponent(item.item_id)}`, item);

  /** Renumber to a clean 0..n-1 (fixes duplicate sort_order values). */
  const normalizeOrder = async () => {
    for (const { item, sort_order } of getSortOrderFixes(items)) {
      await putItem({ ...item, sort_order });
    }
  };

  const closeForm = () => {
    setEditing(null);
    setIsNew(false);
  };

  const handleSave = async () => {
    if (!editing || !editing.item_id.trim() || !editing.title.trim()) return;
    // PUT is an upsert keyed by item_id - don't let "Add" silently
    // overwrite an existing item.
    if (isNew && items.some((i) => i.item_id === editing.item_id.trim())) {
      toast.error(`An item with ID "${editing.item_id.trim()}" already exists`);
      return;
    }
    setIsSaving(true);
    try {
      await putItem({ ...editing, item_id: editing.item_id.trim() });
      toast.success("Saved");
      closeForm();
      await fetchItems();
    } catch (e: unknown) {
      toast.error(errorDetail(e, "Failed to save"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (item: QuickPracticeItem) => {
    if (
      item.enabled &&
      !(await confirm({
        title: "Disable item",
        message: `"${item.title}" will be hidden from the Quick Practice carousel on learners' home screen.`,
        confirmLabel: "Disable",
        variant: "warning",
      }))
    ) {
      return;
    }
    setBusyItemId(item.item_id);
    try {
      await putItem({ ...item, enabled: !item.enabled });
      await fetchItems();
    } catch (e: unknown) {
      toast.error(errorDetail(e, "Failed to update item"));
    } finally {
      setBusyItemId(null);
    }
  };

  const handleReorder = async (item_id: string, direction: -1 | 1) => {
    setBusyItemId(item_id);
    try {
      // Duplicate sort_order values (two rows at 3) make a swap ambiguous -
      // renumber first so the move always does what the arrows show.
      await normalizeOrder();
      await apiClient.post(`/api/v1/admin/quick-practice/reorder`, { item_id, direction });
      await fetchItems();
    } catch (e: unknown) {
      toast.error(errorDetail(e, "Failed to reorder"));
      await fetchItems();
    } finally {
      setBusyItemId(null);
    }
  };

  const handleDelete = async (item: QuickPracticeItem) => {
    if (
      !(await confirm({
        title: "Delete item",
        message: `Delete "${item.title}" (${item.item_id}) from the Quick Practice carousel? This cannot be undone.`,
        confirmLabel: "Delete",
        variant: "danger",
      }))
    ) {
      return;
    }
    setBusyItemId(item.item_id);
    try {
      await apiClient.delete(`/api/v1/admin/quick-practice/${encodeURIComponent(item.item_id)}`);
      toast.success("Deleted");
      await fetchItems();
    } catch (e: unknown) {
      toast.error(errorDetail(e, "Failed to delete"));
    } finally {
      setBusyItemId(null);
    }
  };

  const handleNew = () => {
    setIsNew(true);
    setEditing({
      item_id: "",
      title: "",
      subtitle: "",
      icon: "style",
      sort_order: sortedItems.length,
      enabled: true,
    });
  };

  return (
    <div className="space-y-6">
      {confirmModal}
      <PageBreadCrumb
        pageTitle="Quick Practice"
        description="Manage Quick Practice carousel items on the home screen"
        actions={
          <button
            type="button"
            onClick={handleNew}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Add Item
          </button>
        }
      />

      {error && <Alert variant="error">{error}</Alert>}

      <div className="bg-card rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center" role="status" aria-label="Loading">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="border-b">
                <tr>
                  <th className={TH_CLASS}>Order</th>
                  <th className={TH_CLASS}>ID</th>
                  <th className={TH_CLASS}>Title</th>
                  <th className={TH_CLASS}>Icon</th>
                  <th className={TH_CLASS}>Subtitle</th>
                  <th className={TH_CLASS}>Enabled</th>
                  <th className={TH_CLASS}>Actions</th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {sortedItems.map((item, index) => {
                  const busy = busyItemId !== null;
                  return (
                    <tr key={item.item_id} className="hover:bg-accent" data-testid={`qp-row-${item.item_id}`}>
                      <td className={`${TD_CLASS} whitespace-nowrap`}>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleReorder(item.item_id, -1)}
                            disabled={busy || index === 0}
                            aria-label={`Move ${item.title} up`}
                            title="Move up"
                            className={ARROW_BUTTON_CLASS}
                          >
                            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReorder(item.item_id, 1)}
                            disabled={busy || index === sortedItems.length - 1}
                            aria-label={`Move ${item.title} down`}
                            title="Move down"
                            className={ARROW_BUTTON_CLASS}
                          >
                            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <span
                            className="ml-2 w-5 text-right tabular-nums text-foreground"
                            data-testid="qp-position"
                          >
                            {index + 1}
                          </span>
                        </div>
                      </td>
                      <td className={`${TD_CLASS} whitespace-nowrap font-mono text-xs text-muted-foreground`}>
                        {item.item_id}
                      </td>
                      <td className={`${TD_CLASS} font-medium text-foreground`}>{item.title}</td>
                      <td className={TD_CLASS}>
                        <QuickPracticeIcon name={item.icon} />
                      </td>
                      <td className={`${TD_CLASS} text-muted-foreground`}>{item.subtitle || "—"}</td>
                      <td className={`${TD_CLASS} whitespace-nowrap`}>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={item.enabled}
                            aria-label={`${item.title}: ${item.enabled ? "enabled" : "disabled"}`}
                            title={item.enabled ? "Enabled (click to disable)" : "Disabled (click to enable)"}
                            onClick={() => handleToggle(item)}
                            disabled={busy}
                            className="inline-flex disabled:opacity-50"
                          >
                            <span
                              className={`flex h-6 w-10 items-center rounded-full transition-colors ${item.enabled ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}`}
                            >
                              <span
                                className={`h-4 w-4 rounded-full bg-white transition-transform ${item.enabled ? "translate-x-5" : "translate-x-1"}`}
                              />
                            </span>
                          </button>
                          <Pill tone={item.enabled ? "green" : "neutral"}>
                            {item.enabled ? "Enabled" : "Disabled"}
                          </Pill>
                        </div>
                      </td>
                      <td className={`${TD_CLASS} whitespace-nowrap`}>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setIsNew(false);
                              setEditing({ ...item });
                            }}
                            aria-label={`Edit ${item.title}`}
                            title="Edit"
                            className={ROW_ICON_BUTTON_CLASS}
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            disabled={busy}
                            aria-label={`Delete ${item.title}`}
                            title="Delete"
                            className={ROW_DANGER_ICON_BUTTON_CLASS}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {sortedItems.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-12 text-center text-muted-foreground">
                      No Quick Practice items yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={editing !== null}
        onClose={isSaving ? () => {} : closeForm}
        title={isNew ? "Add Item" : "Edit Item"}
        maxWidth="md"
        showCloseButton={!isSaving}
      >
        {editing && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <div>
              <label htmlFor="qp-item-id" className="mb-1 block text-sm font-medium text-foreground">
                Item ID *
              </label>
              <input
                id="qp-item-id"
                value={editing.item_id}
                onChange={(e) => setEditing({ ...editing, item_id: e.target.value })}
                disabled={!isNew}
                className={`${INPUT_CLASS} font-mono`}
                placeholder="e.g. flashcards"
              />
              {!isNew && (
                <p className="mt-1 text-xs text-muted-foreground">
                  The ID is the app&apos;s route key and can&apos;t be changed.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="qp-title" className="mb-1 block text-sm font-medium text-foreground">
                Title *
              </label>
              <input
                id="qp-title"
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                className={INPUT_CLASS}
                placeholder="e.g. Flashcards"
              />
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <StyledSelect
                  label="Icon"
                  value={editing.icon}
                  onChange={(e) => setEditing({ ...editing, icon: String(e.target.value) })}
                  options={getQuickPracticeIconOptions(editing.icon)}
                  fullWidth
                />
              </div>
              <div className="pb-1">
                <QuickPracticeIcon name={editing.icon} />
              </div>
            </div>
            <div>
              <label htmlFor="qp-subtitle" className="mb-1 block text-sm font-medium text-foreground">
                Subtitle
              </label>
              <input
                id="qp-subtitle"
                value={editing.subtitle}
                onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })}
                className={INPUT_CLASS}
                placeholder="Optional subtitle"
              />
            </div>
            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <button
                type="button"
                onClick={closeForm}
                disabled={isSaving}
                className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || !editing.item_id.trim() || !editing.title.trim()}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-brand-700 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

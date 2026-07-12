"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import Alert from "@/components/ui/alert/SimpleAlert";
import Pagination from "@/components/tables/Pagination";
import { StyledSelect } from "@/components/ui/form/StyledSelect";
import {
  useSubscriptions,
  useSubscriptionAttempts,
  useSubscriptionEvents,
  useSubscriptionStats,
} from "@/hooks/useApi";

type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "expired" | "";
type SubscriptionProvider = "apple" | "google" | "stripe" | "manual" | "";

interface Subscription {
  id: string;
  user_id: string;
  user_email: string | null;
  user_display_name?: string | null;
  plan_id: string | null;
  status: string;
  provider: string;
  platform: string;
  trial_end?: string | null;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end?: boolean;
  canceled_at?: string | null;
  auto_renew_enabled?: boolean | null;
}

interface SubscriptionEvent {
  id: string;
  subscription_id: string;
  user_id: string;
  user_email: string | null;
  event_type: string;
  plan_id: string;
  status: string;
  platform: string;
  provider: string;
  created_at: string;
}

interface SubscriptionAttempt {
  id: string;
  user_id: string;
  user_email: string | null;
  subscription_id: string | null;
  provider: string;
  platform: string;
  product_id: string | null;
  plan_id: string | null;
  success: boolean;
  status: string | null;
  message: string | null;
  created_at: string;
}

type SubscriptionsView = "subscriptions" | "events" | "attempts";

export function SubscriptionsPageContent({
  initialView = "subscriptions",
}: {
  initialView?: SubscriptionsView;
}) {
  const router = useRouter();
  const [activeView, setActiveView] = useState<SubscriptionsView>(initialView);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<SubscriptionStatus>("");
  const [provider, setProvider] = useState<SubscriptionProvider>("");
  const [userSearch, setUserSearch] = useState("");
  const limit = 20;
  const eventsLimit = 20;
  const attemptsLimit = 20;
  const [eventsPage, setEventsPage] = useState(1);
  const [eventsSearch, setEventsSearch] = useState("");
  const [eventsEventType, setEventsEventType] = useState("");
  const [eventsPlatform, setEventsPlatform] = useState("");
  const [attemptsPage, setAttemptsPage] = useState(1);
  const [attemptsSearch, setAttemptsSearch] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createUserQ, setCreateUserQ] = useState("");
  const [createUserSuggestionsOpen, setCreateUserSuggestionsOpen] = useState(false);
  const [createUserSuggestionsLoading, setCreateUserSuggestionsLoading] = useState(false);
  const [createUserSuggestions, setCreateUserSuggestions] = useState<
    Array<{ id: string; email: string | null; display_name: string | null; role?: string }>
  >([]);
  const createUserSuggestReqIdRef = useRef(0);
  const [createPlanId, setCreatePlanId] = useState("");
  const [createStatus, setCreateStatus] = useState<SubscriptionStatus>("active");
  const [createStart, setCreateStart] = useState("");
  const [createEnd, setCreateEnd] = useState("");
  const [createReason, setCreateReason] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editSub, setEditSub] = useState<Subscription | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editReason, setEditReason] = useState("");

  const [editPlanId, setEditPlanId] = useState<string>("");
  const [editStatus, setEditStatus] = useState<string>("");
  const [editStart, setEditStart] = useState<string>("");
  const [editEnd, setEditEnd] = useState<string>("");

  useEffect(() => {
    setActiveView(initialView);
  }, [initialView]);

  const {
    subscriptions,
    total,
    isLoading,
    isError,
    refresh: refreshSubscriptions,
  } = useSubscriptions({
    page,
    limit,
    status: status || undefined,
    provider: provider || undefined,
    search: userSearch || undefined,
  });

  const {
    stats,
    isLoading: statsLoading,
    refresh: refreshStats,
  } = useSubscriptionStats({
    user_q: userSearch || undefined,
  });

  const {
    events,
    total: eventsTotal,
    isLoading: eventsLoading,
    isError: eventsError,
    refresh: refreshEvents,
  } = useSubscriptionEvents({
    page: eventsPage,
    limit: eventsLimit,
    days: 30,
    provider: provider || undefined,
    platform: eventsPlatform || undefined,
    event_type: eventsEventType || undefined,
    user_q: eventsSearch || undefined,
  });

  const {
    attempts,
    total: attemptsTotal,
    isLoading: attemptsLoading,
    isError: attemptsError,
    refresh: refreshAttempts,
  } = useSubscriptionAttempts({
    page: attemptsPage,
    limit: attemptsLimit,
    days: 30,
    provider: provider || undefined,
    user_q: attemptsSearch || undefined,
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const subscriptionTotalPages = Math.max(1, Math.ceil(total / limit));
  const eventsTotalPages = Math.max(1, Math.ceil(eventsTotal / eventsLimit));
  const attemptsTotalPages = Math.max(1, Math.ceil(attemptsTotal / attemptsLimit));

  const toDatetimeLocalValue = (iso: string | null | undefined) => {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const min = pad(date.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  };

  const openCreate = () => {
    setCreateError(null);
    setCreateSaving(false);
    setCreateUserQ("");
    setCreateUserSuggestionsOpen(false);
    setCreateUserSuggestionsLoading(false);
    setCreateUserSuggestions([]);
    setCreatePlanId("");
    setCreateStatus("active");
    setCreateStart("");
    setCreateEnd("");
    setCreateReason("");
    setCreateOpen(true);
  };

  const closeCreate = () => {
    if (createSaving) return;
    setCreateOpen(false);
    setCreateError(null);
    setCreateUserSuggestionsOpen(false);
  };

  useEffect(() => {
    if (!createOpen) return;

    const q = createUserQ.trim();
    const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);
    if (!q || q.length < 2 || uuidLike) {
      setCreateUserSuggestions([]);
      setCreateUserSuggestionsLoading(false);
      setCreateUserSuggestionsOpen(false);
      return;
    }

    const myReqId = ++createUserSuggestReqIdRef.current;
    setCreateUserSuggestionsLoading(true);

    const handle = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        params.set("limit", "8");
        params.set("offset", "0");
        params.set("search", q);

        const res = await apiClient.get(`/api/v1/admin/users?${params.toString()}`);
        if (createUserSuggestReqIdRef.current !== myReqId) return;

        const users = (res?.data?.users || []) as Array<any>;
        const suggestions = users.map((u) => ({
          id: String(u.id),
          email: u.email ?? null,
          display_name: u.display_name ?? null,
          role: u.role,
        }));

        setCreateUserSuggestions(suggestions);
        setCreateUserSuggestionsOpen(true);
      } catch {
        if (createUserSuggestReqIdRef.current !== myReqId) return;
        setCreateUserSuggestions([]);
        setCreateUserSuggestionsOpen(false);
      } finally {
        if (createUserSuggestReqIdRef.current !== myReqId) return;
        setCreateUserSuggestionsLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(handle);
  }, [createOpen, createUserQ]);

  const saveCreate = async () => {
    if (!createUserQ.trim()) {
      setCreateError("User (id or email) is required.");
      return;
    }
    if (!createPlanId.trim()) {
      setCreateError("Plan ID is required.");
      return;
    }
    if (!createReason.trim()) {
      setCreateError("Reason is required.");
      return;
    }
    if (!createStart || !createEnd) {
      setCreateError("Start and Expires are required.");
      return;
    }

    setCreateSaving(true);
    setCreateError(null);

    try {
      await apiClient.post("/api/v1/admin/subscriptions/manual", {
        user_q: createUserQ.trim(),
        plan_id: createPlanId.trim(),
        status: createStatus || "active",
        current_period_start: new Date(createStart).toISOString(),
        current_period_end: new Date(createEnd).toISOString(),
        reason: createReason.trim(),
      });

      await Promise.all([
        refreshSubscriptions(),
        refreshStats(),
        refreshEvents(),
        refreshAttempts(),
      ]);

      setCreateOpen(false);
    } catch (err: any) {
      setCreateError(err?.response?.data?.detail || err?.message || "Failed to create manual subscription");
    } finally {
      setCreateSaving(false);
    }
  };

  const openEdit = (sub: Subscription) => {
    setEditError(null);
    setEditReason("");
    setEditSub(sub);
    setEditPlanId(sub.plan_id || "");
    setEditStatus(sub.status || "");
    setEditStart(toDatetimeLocalValue(sub.current_period_start));
    setEditEnd(toDatetimeLocalValue(sub.current_period_end));
    setEditOpen(true);
  };

  const closeEdit = () => {
    if (editSaving) return;
    setEditOpen(false);
    setEditSub(null);
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!editSub) return;
    if (!editReason.trim()) {
      setEditError("Reason is required.");
      return;
    }
    setEditSaving(true);
    setEditError(null);

    try {
      const body: any = {
        reason: editReason.trim(),
      };

      if (editPlanId.trim()) body.plan_id = editPlanId.trim();
      if (editStatus) body.status = editStatus;
      if (editStart) body.current_period_start = new Date(editStart).toISOString();
      if (editEnd) body.current_period_end = new Date(editEnd).toISOString();

      await apiClient.patch(`/api/v1/admin/subscriptions/${editSub.id}`, body);

      // Refresh list + related panels
      await Promise.all([
        refreshSubscriptions(),
        refreshStats(),
        refreshEvents(),
        refreshAttempts(),
      ]);

      setEditOpen(false);
      setEditSub(null);
    } catch (err: any) {
      setEditError(err?.response?.data?.detail || err?.message || "Failed to update subscription");
    } finally {
      setEditSaving(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "trialing":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "past_due":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "canceled":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "expired":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case "apple":
        return <svg className="inline h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>;
      case "google":
        return <svg className="inline h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>;
      case "stripe":
        return <svg className="inline h-4 w-4" viewBox="0 0 24 24"><path fill="#635BFF" d="M13.976 9.15c-2.172-.806-3.356-1.683-3.356-2.833 0-1.294 1.074-2.242 2.8-2.242 2.464 0 3.467 1.017 4.034 2.07l2.196-1.234C18.402 3.176 16.296 2 13.42 2 10.13 2 7.69 3.695 7.69 6.52c0 2.188 1.676 3.312 4.424 4.316 2.19.806 2.96 1.58 2.96 2.682 0 1.45-1.17 2.418-2.91 2.418-2.543 0-3.934-1.187-4.57-2.753L5.3 14.527C6.326 16.9 8.59 18.4 12.296 18.4c3.3 0 6.17-1.83 6.17-5.048 0-3.07-2.17-3.606-4.49-4.202z"/></svg>;
      case "manual":
        return "🛠️";
      default:
        return "📱";
    }
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "—";

    // Some browsers (notably Safari) may not parse ISO strings with
    // >3 fractional-second digits (e.g. 2026-02-14T15:58:55.442485Z).
    // Truncate to milliseconds to keep rendering stable.
    const normalized = dateString.replace(
      /(\.\d{3})\d+(Z|[+-]\d{2}:\d{2})$/,
      "$1$2"
    );

    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return dateString;

    try {
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="p-6">
      {/* Create Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white dark:bg-gray-800 shadow-lg">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add Manual Subscription</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Grant premium manually (no payment charge)
                </p>
              </div>
              <button
                onClick={closeCreate}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {createError && (
                <Alert variant="error">{createError}</Alert>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  User (ID or email)
                </label>
                <div className="relative">
                  <input
                    value={createUserQ}
                    onChange={(e) => {
                      setCreateUserQ(e.target.value);
                      setCreateError(null);
                    }}
                    onFocus={() => {
                      if (createUserSuggestions.length > 0) setCreateUserSuggestionsOpen(true);
                    }}
                    onBlur={() => {
                      window.setTimeout(() => setCreateUserSuggestionsOpen(false), 150);
                    }}
                    placeholder="Type email or name to search"
                    className="block w-full h-11 px-3 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />

                  {createUserSuggestionsLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400">
                      Searching…
                    </div>
                  )}

                  {createUserSuggestionsOpen && createUserSuggestions.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-hidden">
                      {createUserSuggestions.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setCreateUserQ(u.email || u.id);
                            setCreateUserSuggestionsOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <div className="text-sm text-gray-900 dark:text-white">
                            {u.email || "(no email)"}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {u.display_name ? `${u.display_name} • ` : ""}
                            {u.id.slice(0, 8)}…
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Plan ID</label>
                  <input
                    value={createPlanId}
                    onChange={(e) => setCreatePlanId(e.target.value)}
                    placeholder="premium_monthly"
                    className="block w-full h-11 px-3 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <StyledSelect
                    label="Status"
                    value={createStatus}
                    onChange={(e) => setCreateStatus(e.target.value as SubscriptionStatus)}
                    options={[
                      { value: "active", label: "active" },
                      { value: "trialing", label: "trialing" },
                      { value: "past_due", label: "past_due" },
                      { value: "canceled", label: "canceled" },
                      { value: "expired", label: "expired" },
                    ]}
                    fullWidth
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start</label>
                  <input
                    type="datetime-local"
                    value={createStart}
                    onChange={(e) => setCreateStart(e.target.value)}
                    className="block w-full h-11 px-3 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expires</label>
                  <input
                    type="datetime-local"
                    value={createEnd}
                    onChange={(e) => setCreateEnd(e.target.value)}
                    className="block w-full h-11 px-3 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason (required)</label>
                <textarea
                  value={createReason}
                  onChange={(e) => setCreateReason(e.target.value)}
                  rows={3}
                  placeholder="e.g., Manual premium grant for QA"
                  className="block w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2">
              <button
                onClick={closeCreate}
                disabled={createSaving}
                className="px-4 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={saveCreate}
                disabled={createSaving}
                className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {createSaving ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editOpen && editSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white dark:bg-gray-800 shadow-lg">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Subscription</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {editSub.user_email || editSub.user_id}
                </p>
              </div>
              <button
                onClick={closeEdit}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {editError && (
                <Alert variant="error">{editError}</Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Plan ID</label>
                  <input
                    value={editPlanId}
                    onChange={(e) => setEditPlanId(e.target.value)}
                    placeholder="premium_monthly"
                    className="block w-full h-11 px-3 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <StyledSelect
                    label="Status"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    options={[
                      { value: "active", label: "active" },
                      { value: "trialing", label: "trialing" },
                      { value: "past_due", label: "past_due" },
                      { value: "canceled", label: "canceled" },
                      { value: "expired", label: "expired" },
                    ]}
                    fullWidth
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start</label>
                  <input
                    type="datetime-local"
                    value={editStart}
                    onChange={(e) => setEditStart(e.target.value)}
                    className="block w-full h-11 px-3 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expires</label>
                  <input
                    type="datetime-local"
                    value={editEnd}
                    onChange={(e) => setEditEnd(e.target.value)}
                    className="block w-full h-11 px-3 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason (required)</label>
                <textarea
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  rows={3}
                  placeholder="e.g., Manual override for testing payment failure"
                  className="block w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2">
              <button
                onClick={closeEdit}
                disabled={editSaving}
                className="px-4 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={editSaving}
                className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {editSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Billing Operations
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            View and manage user subscriptions
          </p>
        </div>
        <button
          onClick={openCreate}
          className="h-11 px-4 rounded-md bg-blue-600 text-white hover:bg-blue-700"
        >
          Add Manual Subscription
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Subscriptions</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {statsLoading ? "..." : stats?.total ?? 0}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Active Subscriptions</p>
              <p className="text-2xl font-semibold text-green-600">
                {statsLoading ? "..." : stats?.active ?? 0}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Trial</p>
              <p className="text-2xl font-semibold text-blue-600">
                {statsLoading ? "..." : stats?.trial ?? 0}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Expired/Canceled</p>
              <p className="text-2xl font-semibold text-red-600">
                {statsLoading ? "..." : (stats?.expired ?? 0) + (stats?.canceled ?? 0)}
              </p>
            </div>
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 p-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              User
            </label>
            <input
              value={userSearch}
              onChange={(e) => {
                setUserSearch(e.target.value);
                setPage(1);
              }}
              placeholder="User ID, email, or username"
              className="block w-full sm:w-96 lg:w-[32rem] h-12 px-4 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base"
            />
          </div>

          <div>
            <StyledSelect
              label="Status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as SubscriptionStatus);
                setPage(1);
              }}
              options={[
                { value: "", label: "All Statuses" },
                { value: "active", label: "Active" },
                { value: "trialing", label: "Trialing" },
                { value: "past_due", label: "Past Due" },
                { value: "canceled", label: "Canceled" },
                { value: "expired", label: "Expired" },
              ]}
              className="w-full sm:w-56"
              fullWidth
            />
          </div>

          <div>
            <StyledSelect
              label="Provider"
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value as SubscriptionProvider);
                setPage(1);
              }}
              options={[
                { value: "", label: "All Providers" },
                { value: "apple", label: "Apple" },
                { value: "google", label: "Google" },
                { value: "stripe", label: "Stripe" },
                { value: "manual", label: "Manual" },
              ]}
              className="w-full sm:w-56"
              fullWidth
            />
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {[
          ["subscriptions", "Subscriptions"],
          ["events", "Subscription Events"],
          ["attempts", "Verification Attempts"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              const nextView = value as SubscriptionsView;
              setActiveView(nextView);
              router.push(
                nextView === "subscriptions"
                  ? "/subscriptions"
                  : nextView === "events"
                    ? "/subscriptions/events"
                    : "/subscriptions/attempts"
              );
            }}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              activeView === value
                ? "bg-blue-600 text-white"
                : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
        Use tabs for <span className="font-medium">Recent Subscription Events</span> and{" "}
        <span className="font-medium">Recent Verification Attempts</span>.
      </p>

      {/* Table */}
      {activeView === "subscriptions" && (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center h-64 text-red-500">
            Failed to load subscriptions
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Plan
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Provider
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Start Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Expires
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {subscriptions?.map((sub: Subscription) => (
                    <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {sub.user_email || "No email"}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {sub.user_id?.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {sub.plan_id || "—"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(sub.status)}`}>
                          {sub.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 dark:text-white">
                          {getProviderIcon(sub.provider)} {sub.provider}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(sub.current_period_start)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(sub.current_period_end)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => openEdit(sub)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            Edit
                          </button>
                          <a
                            href={`/community/users/${sub.user_id}`}
                            className="text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100"
                          >
                            View User
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!subscriptions || subscriptions.length === 0) && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                        No subscriptions found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {total === 0 ? 0 : (page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} subscriptions
                </div>
                <div className="ml-auto">
                  <Pagination
                    currentPage={page}
                    totalPages={subscriptionTotalPages}
                    onPageChange={(nextPage) => setPage(nextPage)}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      )}

      {/* Recent Subscription Events */}
      {activeView === "events" && (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Subscription Events</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Webhook + system lifecycle events (renewals, cancellations, refunds, failures)
          </p>
        </div>

        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Search</label>
              <input
                value={eventsSearch}
                onChange={(e) => {
                  setEventsSearch(e.target.value);
                  setEventsPage(1);
                }}
                placeholder="User id, email, username"
                className="block w-full sm:w-80 h-11 px-3 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <StyledSelect
                label="Event type"
                value={eventsEventType}
                onChange={(e) => {
                  setEventsEventType(e.target.value);
                  setEventsPage(1);
                }}
                options={[
                  { value: "", label: "All event types" },
                  { value: "purchase", label: "Purchase" },
                  { value: "renewal", label: "Renewal" },
                  { value: "cancellation", label: "Cancellation" },
                ]}
                className="w-full sm:w-56"
                fullWidth
              />
            </div>
            <div>
              <StyledSelect
                label="Platform"
                value={eventsPlatform}
                onChange={(e) => {
                  setEventsPlatform(e.target.value);
                  setEventsPage(1);
                }}
                options={[
                  { value: "", label: "All platforms" },
                  { value: "ios", label: "iOS" },
                  { value: "android", label: "Android" },
                ]}
                className="w-full sm:w-48"
                fullWidth
              />
            </div>
          </div>
        </div>

        {eventsLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : eventsError ? (
          <div className="flex items-center justify-center h-48 text-red-500">Failed to load events</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Event
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Plan
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Provider
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {events?.map((ev: SubscriptionEvent) => (
                    <tr key={ev.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDateTime(ev.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {ev.user_email || "No email"}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{ev.user_id?.slice(0, 8)}...</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {ev.event_type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {ev.plan_id || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(
                            ev.status
                          )}`}
                        >
                          {ev.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {getProviderIcon(ev.provider)} {ev.provider} ({ev.platform})
                      </td>
                    </tr>
                  ))}
                  {(!events || events.length === 0) && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
                        No events found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {eventsTotal === 0 ? 0 : (eventsPage - 1) * eventsLimit + 1} to {Math.min(eventsPage * eventsLimit, eventsTotal)} of {eventsTotal} events
                </div>
                <div className="ml-auto">
                  <Pagination
                    currentPage={eventsPage}
                    totalPages={eventsTotalPages}
                    onPageChange={(nextPage) => setEventsPage(nextPage)}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      )}

      {/* Recent Verification Attempts */}
      {activeView === "attempts" && (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Verification Attempts</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Client receipt verification attempts (including failures/expired/invalid)
          </p>
        </div>

        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Search</label>
              <input
                value={attemptsSearch}
                onChange={(e) => {
                  setAttemptsSearch(e.target.value);
                  setAttemptsPage(1);
                }}
                placeholder="User id, email, username"
                className="block w-full sm:w-80 h-11 px-3 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
        </div>

        {attemptsLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : attemptsError ? (
          <div className="flex items-center justify-center h-48 text-red-500">Failed to load attempts</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Provider
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Result
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Plan / Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Message
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {attempts?.map((at: SubscriptionAttempt) => (
                    <tr key={at.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDateTime(at.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {at.user_email || "No email"}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{at.user_id?.slice(0, 8)}...</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {getProviderIcon(at.provider)} {at.provider} ({at.platform})
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            at.success
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                          }`}
                        >
                          {at.success ? "success" : "failed"}{at.status ? ` (${at.status})` : ""}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        <div>{at.plan_id || "—"}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{at.product_id || "—"}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-md truncate">
                        {at.message || "—"}
                      </td>
                    </tr>
                  ))}
                  {(!attempts || attempts.length === 0) && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
                        No attempts found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {attemptsTotal === 0 ? 0 : (attemptsPage - 1) * attemptsLimit + 1} to {Math.min(attemptsPage * attemptsLimit, attemptsTotal)} of {attemptsTotal} attempts
                </div>
                <div className="ml-auto">
                  <Pagination
                    currentPage={attemptsPage}
                    totalPages={attemptsTotalPages}
                    onPageChange={(nextPage) => setAttemptsPage(nextPage)}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      )}
    </div>
  );
}

export default function SubscriptionsPage() {
  return <SubscriptionsPageContent initialView="subscriptions" />;
}

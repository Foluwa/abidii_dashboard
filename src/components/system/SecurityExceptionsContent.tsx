"use client";

import React, { useCallback, useEffect, useState } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import { apiClient } from "@/lib/api";
import { ConfirmationModal } from "@/components/ui/modal/ConfirmationModal";
import { useToast } from "@/contexts/ToastContext";

interface DeviceSecurityException {
  id: string;
  email: string;
  note: string | null;
  created_at: string;
}

export function SecurityExceptionsContent({ showHeader = true }: { showHeader?: boolean }) {
  const toast = useToast();
  const [items, setItems] = useState<DeviceSecurityException[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<DeviceSecurityException | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get("/api/v1/security/device-exceptions");
      setItems(response.data?.items ?? []);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? err?.message ?? "Failed to load exception list");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    setIsSubmitting(true);
    try {
      await apiClient.post("/api/v1/security/device-exceptions", {
        email: email.trim(),
        note: note.trim() || undefined,
      });
      toast.success(`${email.trim()} added to the exception list`);
      setEmail("");
      setNote("");
      await fetchItems();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? err?.message ?? "Failed to add exception");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/api/v1/security/device-exceptions/${pendingDelete.id}`);
      toast.success(`${pendingDelete.email} removed from the exception list`);
      setPendingDelete(null);
      await fetchItems();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? err?.message ?? "Failed to remove exception");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {showHeader && <PageBreadCrumb pageTitle="Device Security Exceptions" />}

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
        Accounts on this list are exempt from the device-compromised auto-lock
        (root/jailbreak detection). Reactivating a locked account here alone
        does not stop it from being re-locked on the next app launch - the
        email must be added below too.
      </div>

      <form
        onSubmit={handleAdd}
        className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="person@example.com"
            className="w-full rounded-lg border border-input px-3 py-2 text-sm dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Founder testing account"
            className="w-full rounded-lg border border-input px-3 py-2 text-sm dark:bg-gray-800 dark:text-white"
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting || !email.trim()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isSubmitting ? "Adding..." : "Add exception"}
        </button>
      </form>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted-foreground border-b">
            <tr>
              <th className="px-4 py-2.5">Email</th>
              <th className="px-4 py-2.5">Note</th>
              <th className="px-4 py-2.5">Added</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  No exceptions configured.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-medium text-foreground">{item.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.note || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(item.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setPendingDelete(item)}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmationModal
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        title="Remove exception"
        message={`Remove ${pendingDelete?.email} from the device security exception list? Their account will be locked again the next time a flagged device reports in.`}
        confirmText="Remove"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}

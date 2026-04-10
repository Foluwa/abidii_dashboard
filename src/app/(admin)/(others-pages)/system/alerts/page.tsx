"use client";

import React, { useMemo, useState } from "react";
import { useAlertHistory } from "@/hooks/useApi";
import type { AlertCategory, AlertHistoryItem, AlertLevel } from "@/types/api";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Alert from "@/components/ui/alert/SimpleAlert";
import StatusBadge from "@/components/admin/StatusBadge";
import { StyledSelect } from "@/components/ui/form/StyledSelect";
import Pagination from "@/components/tables/Pagination";

function parseApiTimestamp(timestamp?: string | null): Date | null {
  if (!timestamp) return null;

  let normalized = timestamp.replace(/(\.\d{3})\d+/, "$1");
  const hasTimezone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(normalized);
  if (!hasTimezone) normalized = `${normalized}Z`;

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTimestamp(timestamp?: string | null): string {
  const date = parseApiTimestamp(timestamp);
  return date ? date.toLocaleString() : "—";
}

function sanitizeMessageHtml(message: string): string {
  let html = message || "";
  html = html.replace(/\n/g, "<br/>");
  html = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  html = html.replace(/\son\w+=("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  html = html.replace(/javascript:/gi, "");
  return html;
}

function getLevelBadgeStatus(alertLevel: AlertLevel) {
  switch (alertLevel) {
    case "critical":
    case "error":
      return "error" as const;
    case "warning":
      return "warning" as const;
    default:
      return "info" as const;
  }
}

export default function AlertsPage() {
  const [level, setLevel] = useState<AlertLevel | undefined>(undefined);
  const [category, setCategory] = useState<AlertCategory | undefined>(undefined);
  const [page, setPage] = useState(1);
  const limit = 50;

  const { alerts, isLoading, isError } = useAlertHistory({ level, category, page, limit });
  const items = alerts?.items ?? [];
  const total = alerts?.total ?? 0;
  const totalPages = Math.max(1, alerts?.pages ?? (Math.ceil(total / limit) || 1));

  const sortedItems = useMemo(() => {
    return [...items].sort((a: AlertHistoryItem, b: AlertHistoryItem) => {
      const left = parseApiTimestamp(a.sent_at)?.getTime() ?? 0;
      const right = parseApiTimestamp(b.sent_at)?.getTime() ?? 0;
      return right - left;
    });
  }, [items]);

  return (
    <div className="space-y-6">
      <div>
        <PageBreadCrumb pageTitle="Alert History" />
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          View system alerts and notifications (auto-refreshes every 60 seconds)
        </p>
      </div>

      {isError && (
        <Alert variant="error">
          Failed to load alert history. Please check your API connection.
        </Alert>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap gap-4">
          <StyledSelect
            label="Level"
            value={level || ""}
            onChange={(e) => {
              const next = e.target.value as AlertLevel;
              setLevel(next || undefined);
              setPage(1);
            }}
            options={[
              { value: "", label: "All Levels" },
              { value: "info", label: "Info" },
              { value: "warning", label: "Warning" },
              { value: "error", label: "Error" },
              { value: "critical", label: "Critical" },
            ]}
            placeholder="All Levels"
          />

          <StyledSelect
            label="Category"
            value={category || ""}
            onChange={(e) => {
              const next = e.target.value as AlertCategory;
              setCategory(next || undefined);
              setPage(1);
            }}
            options={[
              { value: "", label: "All Categories" },
              { value: "telegram", label: "Telegram" },
              { value: "system", label: "System" },
              { value: "resource", label: "Resource" },
              { value: "error", label: "Error" },
            ]}
            placeholder="All Categories"
          />

          {(level || category) && (
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setLevel(undefined);
                  setCategory(undefined);
                  setPage(1);
                }}
                className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <div className="p-6">
            <div className="space-y-3">
              {Array.from({ length: 8 }, (_, idx) => (
                <div key={idx} className="h-11 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
              ))}
            </div>
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No alerts found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-800/70">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Sent At
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Level
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Delivery
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Message
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Error
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {sortedItems.map((alert: AlertHistoryItem) => (
                  <tr key={alert.id} className="align-top hover:bg-gray-50 dark:hover:bg-gray-800/60">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {formatTimestamp(alert.sent_at)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={getLevelBadgeStatus(alert.alert_level)} label={alert.alert_level} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 dark:bg-gray-800 dark:text-gray-300">
                        {alert.alert_category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded px-2 py-1 text-xs font-medium ${
                          alert.sent_successfully
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                        }`}
                      >
                        {alert.sent_successfully ? "Sent" : "Failed"}
                      </span>
                    </td>
                    <td className="max-w-xl px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                      <div
                        className="space-y-1 break-words"
                        dangerouslySetInnerHTML={{ __html: sanitizeMessageHtml(alert.message) }}
                      />
                    </td>
                    <td className="max-w-md px-4 py-3 text-sm text-rose-600 dark:text-rose-300">
                      {alert.error_message || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && total > limit && (
          <div className="border-t border-gray-200 px-4 py-3 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} alerts
              </p>
              <div className="ml-auto">
                <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import React, { useMemo } from "react";

import { useRecentActivity } from "@/hooks/useApi";

type RecentActivityItem = {
  id: string;
  source: string;
  timestamp: string;
  actor_user_id?: string | null;
  actor_email?: string | null;
  actor_display_name?: string | null;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  details?: Record<string, unknown> | null;
};

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function summarize(item: RecentActivityItem): string {
  if (item.source === "subscription_events") {
    const details = (item.details || {}) as any;
    const plan = details?.plan_id ? ` (${details.plan_id})` : "";
    return `${item.action}${plan}`;
  }

  return item.action;
}

export default function RecentActivityFeed() {
  const { data, isLoading, isError } = useRecentActivity(10, 30);

  const items = useMemo(() => data as RecentActivityItem[], [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[120px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-[120px] gap-2">
        <p className="text-sm text-red-500">
          Failed to load recent activity
          {isError?.response?.status ? ` (HTTP ${isError.response.status})` : ""}
        </p>
        {isError?.message && (
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center max-w-md">
            {isError.message}
          </p>
        )}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="flex items-center justify-center h-[350px]">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Activity feed will be displayed here once user actions are tracked.
        </p>
      </div>
    );
  }

  return (
    <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
      <div className="space-y-3 pr-2">
        {items.map((item) => {
          const actor =
            item.actor_display_name || item.actor_email || "Unknown actor";

          return (
            <div
              key={`${item.source}:${item.id}`}
              className="rounded-lg border border-gray-200 bg-gray-50/50 px-4 py-3 dark:border-white/[0.05] dark:bg-white/[0.02]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {summarize(item)}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">
                    {actor}
                    {item.target_type ? ` • ${item.target_type}` : ""}
                  </div>
                </div>
                <div className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                  {formatTimestamp(item.timestamp)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

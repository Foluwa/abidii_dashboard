"use client";

import { useCallback, useEffect, useState } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { apiClient } from "@/lib/api";
import { StyledSelect } from "@/components/ui/form/StyledSelect";
import Alert from "@/components/ui/alert/SimpleAlert";

interface IdempotencyStats {
  total_keys: number;
  expired_keys: number;
  active_keys: number;
  hit_rate: number;
  avg_ttl_seconds: number;
  recent_duplicate_attempts: number;
}

function toSafeNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function normalizeHitRate(rawValue: unknown): number {
  const numeric = toSafeNumber(rawValue, 0);
  // Backends may return ratio (0..1) or percentage (0..100).
  const normalized = numeric > 0 && numeric <= 1 ? numeric * 100 : numeric;
  return Math.max(0, Math.min(100, normalized));
}

export default function IdempotencyPage() {
  const [stats, setStats] = useState<IdempotencyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/api/v1/admin/health/idempotency?days=${days}`);
      const data = response.data ?? {};

      const totalKeys = Math.max(0, Math.round(toSafeNumber(data.total_keys)));
      const activeKeys = Math.max(0, Math.round(toSafeNumber(data.active_keys)));
      const rawExpired = Math.round(toSafeNumber(data.expired_keys));
      const inferredExpired = Math.max(0, totalKeys - activeKeys);

      const normalized: IdempotencyStats = {
        total_keys: totalKeys,
        active_keys: activeKeys,
        expired_keys: rawExpired >= 0 ? rawExpired : inferredExpired,
        hit_rate: normalizeHitRate(data.hit_rate),
        avg_ttl_seconds: Math.max(0, toSafeNumber(data.avg_ttl_seconds)),
        recent_duplicate_attempts: Math.max(0, Math.round(toSafeNumber(data.recent_duplicate_attempts))),
      };

      setStats(normalized);
      setError(null);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const message = typeof detail === "string" ? detail : err?.message;
      setError(message || "Failed to fetch idempotency stats");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div className="space-y-6">
      <PageBreadcrumb pageTitle="Idempotency Health" />

      {error && (
        <Alert variant="error" className="mb-6">
          {error}
        </Alert>
      )}

      <div className="mb-6 flex items-end gap-4">
        <StyledSelect
          label="Time Range"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          options={[
            { value: 1, label: "Last 24 hours" },
            { value: 7, label: "Last 7 days" },
            { value: 30, label: "Last 30 days" },
            { value: 90, label: "Last 90 days" },
          ]}
        />
        <button
          type="button"
          onClick={fetchStats}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }, (_, idx) => (
              <div key={idx} className="h-28 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        </div>
      ) : !stats ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
          No idempotency metrics available for the selected range.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Keys</h3>
              </div>
              <p className="text-3xl font-bold text-gray-800 dark:text-white">{stats.total_keys.toLocaleString()}</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Unique request keys</p>
            </div>

            <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Keys</h3>
              </div>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                {stats.active_keys.toLocaleString()}
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Currently cached</p>
            </div>

            <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Duplicate Attempts</h3>
              </div>
              <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                {stats.recent_duplicate_attempts.toLocaleString()}
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Prevented duplicates</p>
            </div>
          </div>

          <div className="rounded-lg bg-white shadow dark:bg-gray-800">
            <div className="border-b border-gray-200 p-6 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Idempotency Performance</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <h4 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">Hit Rate</h4>
                  <div className="flex items-center gap-4">
                    <div className="h-4 flex-1 rounded-full bg-gray-200 dark:bg-gray-700">
                      <div
                        className="h-4 rounded-full bg-green-600 transition-all"
                        style={{ width: `${stats.hit_rate}%` }}
                      />
                    </div>
                    <span className="text-lg font-semibold text-gray-800 dark:text-white">
                      {stats.hit_rate.toFixed(1)}%
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Requests served from cache</p>
                </div>

                <div className="space-y-2">
                  <h4 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">Average TTL</h4>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Seconds:</span>
                    <span className="text-sm font-medium text-gray-800 dark:text-white">
                      {stats.avg_ttl_seconds.toFixed(0)}s
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Minutes:</span>
                    <span className="text-sm font-medium text-gray-800 dark:text-white">
                      {(stats.avg_ttl_seconds / 60).toFixed(1)}m
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Expired Keys:</span>
                    <span className="text-sm font-medium text-gray-800 dark:text-white">
                      {stats.expired_keys.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-800 dark:bg-blue-900/20">
            <h4 className="mb-1 text-sm font-medium text-blue-900 dark:text-blue-200">About Idempotency</h4>
            <p className="text-sm text-blue-800 dark:text-blue-300">
              Idempotency middleware prevents duplicate request processing by caching request signatures.
              This helps keep billing, write operations, and retried requests consistent.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

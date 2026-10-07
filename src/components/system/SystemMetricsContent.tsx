"use client";

import { useState, useEffect, useCallback } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { apiClient } from "@/lib/api";
import Alert from "@/components/ui/alert/SimpleAlert";

interface SystemMetrics {
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  swap_percent: number;
  cpu_count: number;
  memory_available_mb: number;
  memory_total_mb: number;
  disk_free_gb: number;
  disk_total_gb: number;
  load_average: number[];
  uptime_seconds: number;
}

export function SystemMetricsContent({ showHeader = true, isActive = true }: { showHeader?: boolean; isActive?: boolean }) {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await apiClient.get("/api/v1/admin/metrics/system");
      const data = response.data;
      // Ensure all numeric fields exist with defaults
      const safeMetrics = {
        cpu_percent: data.cpu_percent ?? 0,
        memory_percent: data.memory_percent ?? 0,
        disk_percent: data.disk_percent ?? 0,
        swap_percent: data.swap_percent ?? 0,
        cpu_count: data.cpu_count ?? 0,
        memory_available_mb: data.memory_available_mb ?? 0,
        memory_total_mb: data.memory_total_mb ?? 0,
        disk_free_gb: data.disk_free_gb ?? 0,
        disk_total_gb: data.disk_total_gb ?? 0,
        load_average: data.load_average ?? [0, 0, 0],
        uptime_seconds: data.uptime_seconds ?? 0,
      };
      setMetrics(safeMetrics);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to fetch metrics");
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll every 30s only while the tab is active. Deactivation clears the
  // interval; reactivation fetches once and restarts the interval.
  useEffect(() => {
    if (!isActive) return;
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [fetchMetrics, isActive]);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const getStatusColor = (percent: number) => {
    if (percent < 70) return "text-green-600 dark:text-green-400";
    if (percent < 85) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      {showHeader && <PageBreadcrumb pageTitle="System Metrics" />}

      {error && (
        <Alert variant="error" className="mb-6">
          {error}
        </Alert>
      )}

      {metrics && (
        <div className="space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* CPU */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">CPU Usage</h3>
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <p className={`text-3xl font-bold ${getStatusColor(metrics.cpu_percent)}`}>
                {metrics.cpu_percent.toFixed(1)}%
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {metrics.cpu_count} cores
              </p>
            </div>

            {/* Memory */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Memory Usage</h3>
                <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
              </div>
              <p className={`text-3xl font-bold ${getStatusColor(metrics.memory_percent)}`}>
                {metrics.memory_percent.toFixed(1)}%
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {(metrics.memory_available_mb / 1024).toFixed(1)}GB / {(metrics.memory_total_mb / 1024).toFixed(1)}GB
              </p>
            </div>

            {/* Disk */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Disk Usage</h3>
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className={`text-3xl font-bold ${getStatusColor(metrics.disk_percent)}`}>
                {metrics.disk_percent.toFixed(1)}%
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {metrics.disk_free_gb.toFixed(1)}GB free of {metrics.disk_total_gb.toFixed(1)}GB
              </p>
            </div>

            {/* Uptime */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">System Uptime</h3>
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">
                {formatUptime(metrics.uptime_seconds)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Running smoothly
              </p>
            </div>
          </div>

          {/* Detailed Metrics */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                Detailed System Information
              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Load Average</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">1 minute:</span>
                      <span className="text-sm font-medium text-gray-800 dark:text-white">
                        {metrics.load_average[0]?.toFixed(2) || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">5 minutes:</span>
                      <span className="text-sm font-medium text-gray-800 dark:text-white">
                        {metrics.load_average[1]?.toFixed(2) || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">15 minutes:</span>
                      <span className="text-sm font-medium text-gray-800 dark:text-white">
                        {metrics.load_average[2]?.toFixed(2) || "N/A"}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Swap Memory</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Usage:</span>
                      <span className={`text-sm font-medium ${getStatusColor(metrics.swap_percent)}`}>
                        {metrics.swap_percent.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Auto-refresh indicator */}
          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            Auto-refreshing every 30 seconds
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import React from "react";
import { useSystemStatus, useServicesStatus } from "@/hooks/useApi";
import StatusBadge, { StatusType } from "@/components/admin/StatusBadge";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Alert from "@/components/ui/alert/SimpleAlert";

function serviceStatusBadgeType(status: string): StatusType {
  if (status === "online") return "online";
  if (status === "offline") return "offline";
  return "inactive";
}

export default function SystemStatusPage() {
  const { status, isLoading, isError, refresh } = useSystemStatus();
  const { services, refresh: refreshServices } = useServicesStatus();

  const handleRefresh = () => {
    refresh();
    refreshServices();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="System Status" />
        <div className="p-6 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 animate-pulse">
          <div className="h-8 bg-gray-200 rounded dark:bg-gray-700 w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded dark:bg-gray-700"></div>
            <div className="h-4 bg-gray-200 rounded dark:bg-gray-700"></div>
            <div className="h-4 bg-gray-200 rounded dark:bg-gray-700"></div>
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="System Status" />
        <Alert variant="error">
          Failed to load system status. Please check your API connection.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <PageBreadCrumb pageTitle="System Status" />
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Real-time system health monitoring (auto-refreshes every 60 seconds)
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
        >
          Refresh Now
        </button>
      </div>

      {/* Infrastructure Services Card */}
      {services.length > 0 && (
        <div className="p-6 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
          <h3 className="mb-6 text-lg font-semibold text-gray-900 dark:text-white">
            Infrastructure Services
          </h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <div
                key={service.name}
                className="p-4 border border-gray-200 rounded-lg dark:border-gray-800"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {service.name}
                  </h4>
                  <StatusBadge
                    status={serviceStatusBadgeType(service.status)}
                    label={
                      service.status === "not_configured"
                        ? "Not configured"
                        : undefined
                    }
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {service.status === "online" && service.latency_ms != null
                    ? `Responding in ${service.latency_ms}ms`
                    : service.status === "not_configured"
                      ? "No connection configured for this environment"
                      : service.detail || "Unreachable"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Status Card */}
      {status && (
        <div className="p-6 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
          <h3 className="mb-6 text-lg font-semibold text-gray-900 dark:text-white">
            System Health Indicators
          </h3>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Monitoring Status */}
            <div className="p-4 border border-gray-200 rounded-lg dark:border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Monitoring Service
                </h4>
                <StatusBadge status={status.monitoring_enabled ? 'online' : 'offline'} />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {status.monitoring_enabled 
                  ? 'All systems are being monitored' 
                  : 'Monitoring is currently disabled'}
              </p>
            </div>

            {/* Telegram Connection */}
            <div className="p-4 border border-gray-200 rounded-lg dark:border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Telegram Bot
                </h4>
                <StatusBadge status={status.telegram_connected ? 'success' : 'error'} />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {status.telegram_connected 
                  ? 'Connected and ready to send alerts' 
                  : 'Bot is disconnected or not configured'}
              </p>
            </div>

            {/* Circuit Breaker */}
            <div className="p-4 border border-gray-200 rounded-lg dark:border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Circuit Breaker
                </h4>
                <StatusBadge 
                  status={status.circuit_breaker_open ? 'error' : 'success'}
                  label={status.circuit_breaker_open ? 'Open' : 'Closed'}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {status.circuit_breaker_open 
                  ? 'Service protection is active due to failures' 
                  : 'All services operating normally'}
              </p>
            </div>

            {/* Alert Queue */}
            <div className="p-4 border border-gray-200 rounded-lg dark:border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Alert Queue
                </h4>
                <StatusBadge 
                  status={status.alert_queue_size > 10 ? 'warning' : 'info'}
                  label={status.alert_queue_size.toString()}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {status.alert_queue_size === 0 
                  ? 'No pending alerts' 
                  : `${status.alert_queue_size} alerts queued for processing`}
              </p>
            </div>

            {/* System Uptime */}
            <div className="p-4 border border-gray-200 rounded-lg dark:border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  System Uptime
                </h4>
                <span className="px-2 py-1 text-xs font-medium text-brand-700 bg-brand-100 rounded dark:bg-brand-900 dark:text-brand-300">
                  {Math.floor(status.uptime_seconds / 3600)}h {Math.floor((status.uptime_seconds % 3600) / 60)}m
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Time since last restart
              </p>
            </div>

            {/* Config Cache Age */}
            <div className="p-4 border border-gray-200 rounded-lg dark:border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Configuration Cache
                </h4>
                <span className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded dark:bg-gray-800 dark:text-gray-300">
                  {Math.floor(status.config_cache_age_seconds)}s old
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Time since configuration was last cached
              </p>
            </div>
          </div>

          {/* Last Updated */}
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Last updated: {new Date().toLocaleString()} • Auto-refreshes in 60 seconds
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

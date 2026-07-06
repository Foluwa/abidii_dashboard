"use client";

import React from "react";
import Link from "next/link";
import { useSystemStatus, useSystemStats } from "@/hooks/useApi";
import StatCard from "@/components/admin/StatCard";
import StatusBadge from "@/components/admin/StatusBadge";
import { GridIcon, UserCircleIcon, ListIcon } from "@/icons";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Alert from "@/components/ui/alert/SimpleAlert";
import PlatformDistributionChart from "@/components/charts/PlatformDistributionChart";
import MonthlySalesChart from "@/components/ecommerce/MonthlySalesChart";
import MonthlySubscriberGrowthChart from "@/components/charts/MonthlySubscriberGrowthChart";
import DailyActiveUsersChart from "@/components/charts/DailyActiveUsersChart";
import CountryMap from "@/components/ecommerce/CountryMap";
import RecentActivityFeed from "@/components/dashboard/RecentActivityFeed";
import BillingPlansCard from "@/components/billing/BillingPlansCard";

export default function Dashboard() {
  const { status, isLoading: statusLoading, isError: statusError } = useSystemStatus();
  const { stats, isLoading: statsLoading, isError: statsError } = useSystemStats();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <PageBreadCrumb pageTitle="Dashboard" />
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Welcome to Abidii Admin Dashboard - Monitor and manage your language learning platform
          </p>
        </div>
      </div>

      {/* System Status Alert */}
      {statusError && (
        <Alert variant="error">
          Failed to load system status. Please check your API connection.
        </Alert>
      )}

      {/* System Health Status */}
      {status && (
        <div className="p-4 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              System Health
            </h3>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400"
            >
              Refresh
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Monitoring</p>
              <StatusBadge status={status.monitoring_enabled ? 'online' : 'offline'} />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Telegram</p>
              <StatusBadge status={status.telegram_connected ? 'success' : 'error'} />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Circuit Breaker</p>
              <StatusBadge status={status.circuit_breaker_open ? 'error' : 'success'} 
                label={status.circuit_breaker_open ? 'Open' : 'Closed'} />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Alert Queue</p>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {status.alert_queue_size}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Uptime</p>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {Math.floor(status.uptime_seconds / 3600)}h
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Config Cache</p>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {Math.floor(status.config_cache_age_seconds)}s
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Users"
          value={stats?.total_users?.toLocaleString() ?? '0'}
          icon={<UserCircleIcon />}
          isLoading={statsLoading}
        />
        <StatCard
          label="Active Today"
          value={stats?.active_users_today?.toLocaleString() ?? '0'}
          icon={<UserCircleIcon />}
          isLoading={statsLoading}
        />
        <StatCard
          label="Lesson Blueprints"
          value={stats?.total_lessons?.toLocaleString() ?? '0'}
          icon={<ListIcon />}
          isLoading={statsLoading}
        />
        <StatCard
          label="Total Words"
          value={stats?.total_words?.toLocaleString() ?? '0'}
          icon={<GridIcon />}
          isLoading={statsLoading}
        />
      </div>

      {/* Quick Actions */}
      <div className="p-6 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/content/words"
            className="p-4 text-center transition-colors border border-gray-200 rounded-lg hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
          >
            <GridIcon className="w-8 h-8 mx-auto mb-2 text-brand-600 dark:text-brand-400" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">Words Import</p>
          </Link>
          <Link
            href="/curriculum/lesson-blueprints"
            className="p-4 text-center transition-colors border border-gray-200 rounded-lg hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
          >
            <ListIcon className="w-8 h-8 mx-auto mb-2 text-brand-600 dark:text-brand-400" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">Lesson Blueprints</p>
          </Link>
          <Link
            href="/audio/jobs"
            className="p-4 text-center transition-colors border border-gray-200 rounded-lg hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
          >
            <GridIcon className="w-8 h-8 mx-auto mb-2 text-brand-600 dark:text-brand-400" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">Audio Jobs</p>
          </Link>
          <Link
            href="/media/orphan-assets"
            className="p-4 text-center transition-colors border border-gray-200 rounded-lg hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
          >
            <GridIcon className="w-8 h-8 mx-auto mb-2 text-brand-600 dark:text-brand-400" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">Orphan Assets</p>
          </Link>
        </div>
      </div>

      {/* Billing Plans */}
      <BillingPlansCard />

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Platform Distribution Chart */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="border-b border-gray-100 bg-gray-50/50 px-5 py-3 dark:border-white/[0.05] dark:bg-white/[0.02]">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Platform Distribution
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Users grouped by latest device platform (iOS/Android/unknown)
            </p>
          </div>
          <div className="p-5">
            <PlatformDistributionChart />
          </div>
        </div>

        {/* Monthly User Growth Chart */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="border-b border-gray-100 bg-gray-50/50 px-5 py-3 dark:border-white/[0.05] dark:bg-white/[0.02]">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Monthly User Growth
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              New user registrations per month
            </p>
          </div>
          <div className="p-5">
            <MonthlySalesChart />
          </div>
        </div>
      </div>

      {/* Subscriber Growth Chart */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="border-b border-gray-100 bg-gray-50/50 px-5 py-3 dark:border-white/[0.05] dark:bg-white/[0.02]">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Monthly Subscriber Growth
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            New premium subscribers per month (first-time only)
          </p>
        </div>
        <div className="p-5">
          <MonthlySubscriberGrowthChart />
        </div>
      </div>

      {/* Daily Active Users Chart */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="border-b border-gray-100 bg-gray-50/50 px-5 py-3 dark:border-white/[0.05] dark:bg-white/[0.02]">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Daily Active Users
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Distinct users with at least one session per day, last 30 days
          </p>
        </div>
        <div className="p-5">
          <DailyActiveUsersChart />
        </div>
      </div>

      {/* Demographics + Recent Activity Row (70/30 on desktop) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-10">
        {/* Customer Demographics Map (70%) */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white lg:col-span-7 dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="border-b border-gray-100 bg-gray-50/50 px-5 py-3 dark:border-white/[0.05] dark:bg-white/[0.02]">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Customer Demographics
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Geographic distribution of users worldwide
            </p>
          </div>
          <div className="p-5">
            <CountryMap />
          </div>
        </div>

        {/* Recent Activity (30%) */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white lg:col-span-3 dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="border-b border-gray-100 bg-gray-50/50 px-5 py-3 dark:border-white/[0.05] dark:bg-white/[0.02]">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Recent Activity
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Latest admin and subscription events
            </p>
          </div>
          <div className="p-5">
            <RecentActivityFeed />
          </div>
        </div>
      </div>
    </div>
  );
}

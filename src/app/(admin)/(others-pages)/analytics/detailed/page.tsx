"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import AnalyticsTabs from "@/components/analytics/AnalyticsTabs";
import { countryName, countryFlagEmoji } from "@/lib/country-utils";
import {
  useFluencyDistribution,
  useMostActiveUsers,
  useActivityByHour,
  useFeatureUsage,
  useFavoritedWords,
  useSubscriptionChurn,
  useGeoDistributionActiveUsers,
} from "@/hooks/useApi";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

type TimeRange = "24h" | "7d" | "30d" | "6m" | "all";

const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: "24h", label: "24 Hours" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "1 Month" },
  { key: "6m", label: "6 Months" },
  { key: "all", label: "All Time" },
];

// Mirrors admin_analytics.py's _TIME_RANGE_TO_DAYS - kept in sync manually
// since /geo/active takes a raw window_days param rather than time_range.
const WINDOW_DAYS_FOR_RANGE: Record<TimeRange, number> = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
  "6m": 182,
  all: 3650,
};

const FLUENCY_LABELS: Record<string, string> = {
  new: "New",
  beginner: "Beginner",
  basic: "Basic",
  confident: "Confident",
  fluent: "Fluent",
  unknown: "Not set",
};

const FLUENCY_COLORS: Record<string, string> = {
  new: "#94a3b8",
  beginner: "#465FFF",
  basic: "#0BA5EC",
  confident: "#F79009",
  fluent: "#12B76A",
  unknown: "#d1d5db",
};

function formatMs(ms: number): string {
  if (!ms) return "0m";
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] sm:p-6">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">{title}</h3>
      {subtitle && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function LoadingBlock() {
  return (
    <div className="flex h-48 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand-600"></div>
    </div>
  );
}

function EmptyBlock({ label = "No data available for this range" }: { label?: string }) {
  return (
    <div className="flex h-48 items-center justify-center text-sm text-gray-500 dark:text-gray-400">
      {label}
    </div>
  );
}

function FluencyPieChart({ timeRange }: { timeRange: TimeRange }) {
  const { data, total, isLoading } = useFluencyDistribution(timeRange);

  if (isLoading) return <Card title="Fluency Distribution"><LoadingBlock /></Card>;
  if (!data.length) return <Card title="Fluency Distribution"><EmptyBlock /></Card>;

  const labels = data.map((d: { proficiency_level: string }) => FLUENCY_LABELS[d.proficiency_level] || d.proficiency_level);
  const series = data.map((d: { count: number }) => d.count);
  const colors = data.map((d: { proficiency_level: string }) => FLUENCY_COLORS[d.proficiency_level] || "#64748b");

  const options: ApexOptions = {
    colors,
    chart: { fontFamily: "Outfit, sans-serif", type: "donut", height: 280 },
    labels,
    legend: { position: "bottom", labels: { colors: "#64748b" } },
    plotOptions: {
      pie: {
        donut: {
          size: "65%",
          labels: {
            show: true,
            total: { show: true, label: "Users", fontSize: "14px", color: "#64748b", formatter: () => String(total) },
          },
        },
      },
    },
    dataLabels: { enabled: false },
    tooltip: { y: { formatter: (val: number) => `${val} users` } },
  };

  return (
    <Card title="Fluency Distribution" subtitle="Self-reported Yoruba fluency at onboarding">
      <ReactApexChart options={options} series={series} type="donut" height={280} />
    </Card>
  );
}

function TopCountriesCard({ timeRange }: { timeRange: TimeRange }) {
  const { data, isLoading } = useGeoDistributionActiveUsers(WINDOW_DAYS_FOR_RANGE[timeRange], false);
  const top10 = [...data]
    .sort((a: { count: number }, b: { count: number }) => b.count - a.count)
    .slice(0, 10);

  if (isLoading) return <Card title="Top 10 Countries"><LoadingBlock /></Card>;
  if (!top10.length) return <Card title="Top 10 Countries"><EmptyBlock /></Card>;

  const maxCount = Math.max(...top10.map((c: { count: number }) => c.count));

  return (
    <Card title="Top 10 Countries" subtitle="Active users in range, by most recent derived country">
      <div className="space-y-3">
        {top10.map((c: { country_code: string; count: number; percentage: number }) => (
          <div key={c.country_code} className="flex items-center gap-3">
            <span className="w-8 text-lg">{countryFlagEmoji(c.country_code) || "🏳️"}</span>
            <span className="w-32 truncate text-sm text-gray-700 dark:text-gray-300">
              {c.country_code === "UN" ? "Unknown" : countryName(c.country_code)}
            </span>
            <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className="h-2 rounded-full bg-brand-500"
                style={{ width: `${(c.count / maxCount) * 100}%` }}
              />
            </div>
            <span className="w-16 text-right text-sm font-medium text-gray-900 dark:text-white">{c.count}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function MostActiveUsersCard({ timeRange }: { timeRange: TimeRange }) {
  const [sortBy, setSortBy] = useState<"xp" | "sessions" | "time">("xp");
  const { data, isLoading } = useMostActiveUsers(timeRange, sortBy);

  return (
    <Card title="Most Active Users">
      <div className="mb-4 flex gap-2">
        {(["xp", "sessions", "time"] as const).map((option) => (
          <button
            key={option}
            onClick={() => setSortBy(option)}
            className={`rounded-lg px-3 py-1 text-xs font-medium ${
              sortBy === option
                ? "bg-brand-500 text-white"
                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
            }`}
          >
            {option === "xp" ? "Total XP" : option === "sessions" ? "Sessions" : "Time Spent"}
          </button>
        ))}
      </div>
      {isLoading ? (
        <LoadingBlock />
      ) : !data.length ? (
        <EmptyBlock />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                <th className="pb-2">User</th>
                <th className="pb-2 text-right">Sessions</th>
                <th className="pb-2 text-right">Time</th>
                <th className="pb-2 text-right">Total XP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {data.map((u: {
                user_id: string; display_name: string | null;
                total_sessions: number; total_time_ms: number; total_xp: number;
              }) => (
                <tr key={u.user_id}>
                  <td className="py-2 text-gray-900 dark:text-white">{u.display_name || "Anonymous"}</td>
                  <td className="py-2 text-right text-gray-600 dark:text-gray-300">{u.total_sessions}</td>
                  <td className="py-2 text-right text-gray-600 dark:text-gray-300">{formatMs(u.total_time_ms)}</td>
                  <td className="py-2 text-right font-medium text-purple-600 dark:text-purple-400">{u.total_xp.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ActivityByHourChart({ timeRange }: { timeRange: TimeRange }) {
  const { data, basis, isLoading } = useActivityByHour(timeRange);

  if (isLoading) return <Card title="Activity by Hour of Day"><LoadingBlock /></Card>;

  const categories = data.map((d: { hour: number }) => `${d.hour}:00`);
  const series = [{ name: "Sessions", data: data.map((d: { session_count: number }) => d.session_count) }];

  const options: ApexOptions = {
    chart: { fontFamily: "Outfit, sans-serif", type: "bar", height: 260, toolbar: { show: false } },
    colors: ["#465FFF"],
    plotOptions: { bar: { borderRadius: 3, columnWidth: "60%" } },
    dataLabels: { enabled: false },
    xaxis: { categories, labels: { style: { colors: "#64748b" }, rotate: -45 } },
    yaxis: { labels: { style: { colors: "#64748b" } } },
    grid: { borderColor: "#e5e7eb" },
    tooltip: { y: { formatter: (val: number) => `${val} sessions` } },
  };

  return (
    <Card title="Activity by Hour of Day (UTC)" subtitle={basis}>
      <ReactApexChart options={options} series={series} type="bar" height={260} />
    </Card>
  );
}

function FeatureUsageChart({ timeRange }: { timeRange: TimeRange }) {
  const { data, basis, isLoading } = useFeatureUsage(timeRange);

  if (isLoading) return <Card title="Most-Used Features"><LoadingBlock /></Card>;
  if (!data.length) return <Card title="Most-Used Features"><EmptyBlock /></Card>;

  const categories = data.map((d: { feature: string }) => d.feature.replace("game:", ""));
  const series = [{ name: "Uses", data: data.map((d: { count: number }) => d.count) }];

  const options: ApexOptions = {
    chart: { fontFamily: "Outfit, sans-serif", type: "bar", height: 280, toolbar: { show: false } },
    colors: ["#12B76A"],
    plotOptions: { bar: { borderRadius: 3, horizontal: true } },
    dataLabels: { enabled: false },
    xaxis: { categories, labels: { style: { colors: "#64748b" } } },
    grid: { borderColor: "#e5e7eb" },
  };

  return (
    <Card title="Most-Used Features" subtitle={basis}>
      <ReactApexChart options={options} series={series} type="bar" height={280} />
    </Card>
  );
}

function FavoritedWordsCard({ timeRange }: { timeRange: TimeRange }) {
  const { data, isLoading } = useFavoritedWords(timeRange);

  return (
    <Card title="Most Favorited Words">
      {isLoading ? (
        <LoadingBlock />
      ) : !data.length ? (
        <EmptyBlock />
      ) : (
        <div className="space-y-2">
          {data.map((w: { lemma_id: string; word: string; favorite_count: number }, idx: number) => (
            <div key={w.lemma_id} className="flex items-center justify-between text-sm">
              <span className="text-gray-700 dark:text-gray-300">
                <span className="mr-2 text-gray-400">#{idx + 1}</span>
                {w.word}
              </span>
              <span className="font-medium text-gray-900 dark:text-white">{w.favorite_count}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function SubscriptionChurnCard({ timeRange }: { timeRange: TimeRange }) {
  const { items, churnedCount, scheduledToLapseCount, isLoading } = useSubscriptionChurn(timeRange);

  return (
    <Card title="Subscription Churn & Non-Renewals">
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-red-50 p-3 dark:bg-red-500/10">
          <p className="text-xs text-gray-500 dark:text-gray-400">Churned in range</p>
          <p className="text-2xl font-semibold text-red-600 dark:text-red-400">{churnedCount}</p>
        </div>
        <div className="rounded-lg bg-orange-50 p-3 dark:bg-orange-500/10">
          <p className="text-xs text-gray-500 dark:text-gray-400">Won&apos;t renew (scheduled)</p>
          <p className="text-2xl font-semibold text-orange-600 dark:text-orange-400">{scheduledToLapseCount}</p>
        </div>
      </div>
      {isLoading ? (
        <LoadingBlock />
      ) : !items.length ? (
        <EmptyBlock label="No churn or non-renewals in this range" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                <th className="pb-2">User</th>
                <th className="pb-2">Plan</th>
                <th className="pb-2">Status</th>
                <th className="pb-2 text-right">Period End</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {items.map((s: {
                user_id: string; display_name: string | null; email: string | null;
                plan_id: string; status: string; current_period_end: string; cancel_at_period_end: boolean;
              }) => (
                <tr key={s.user_id}>
                  <td className="py-2 text-gray-900 dark:text-white">{s.display_name || s.email || "Unknown"}</td>
                  <td className="py-2 text-gray-600 dark:text-gray-300">{s.plan_id}</td>
                  <td className="py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                      s.status === "canceled" || s.status === "expired"
                        ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                        : "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400"
                    }`}>
                      {s.status === "canceled" || s.status === "expired" ? "Churned" : "Won't renew"}
                    </span>
                  </td>
                  <td className="py-2 text-right text-gray-600 dark:text-gray-300">
                    {new Date(s.current_period_end).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function DetailedAnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");

  return (
    <div className="space-y-6">
      <div>
        <PageBreadCrumb pageTitle="Detailed Analytics" />
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Granular user-behavior insight across fluency, activity, geography, and subscriptions.
        </p>
      </div>

      <AnalyticsTabs />

      <div className="flex flex-wrap gap-2">
        {TIME_RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setTimeRange(r.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              timeRange === r.key
                ? "bg-brand-500 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-800 dark:hover:bg-gray-800"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <FluencyPieChart timeRange={timeRange} />
        <TopCountriesCard timeRange={timeRange} />
        <MostActiveUsersCard timeRange={timeRange} />
        <ActivityByHourChart timeRange={timeRange} />
        <FeatureUsageChart timeRange={timeRange} />
        <FavoritedWordsCard timeRange={timeRange} />
        <div className="lg:col-span-2">
          <SubscriptionChurnCard timeRange={timeRange} />
        </div>
      </div>
    </div>
  );
}

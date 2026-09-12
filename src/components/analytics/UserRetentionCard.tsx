"use client";

import React from "react";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";
import { useUserRetention } from "@/hooks/useApi";
import type { RetentionDayStat } from "@/types/admin-analytics";

// Dynamically import ApexCharts with no SSR (browser-only) - same pattern
// as DailyActiveUsersChart/MonthlySalesChart.
const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

function formatPercent(rate: number | null): string {
  if (rate === null) return "—";
  return Number.isInteger(rate) ? `${rate}%` : `${rate.toFixed(1)}%`;
}

function KpiSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/50 px-4 py-3 dark:border-white/[0.05] dark:bg-white/[0.02]">
      <div className="h-3 w-12 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
      <div className="mt-2 h-6 w-14 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
      <div className="mt-2 h-2.5 w-20 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
    </div>
  );
}

function RetentionKpi({
  label,
  stat,
}: {
  label: string;
  stat: RetentionDayStat;
}) {
  const unavailable = stat.eligible_users === 0;
  return (
    <div
      className="rounded-lg border border-gray-200 bg-gray-50/50 px-4 py-3 dark:border-white/[0.05] dark:bg-white/[0.02]"
      title={
        unavailable
          ? "Not enough user history to calculate this metric"
          : `${stat.retained_users} of ${stat.eligible_users} eligible users returned exactly ${label.toLowerCase()} after signing up`
      }
    >
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
        {formatPercent(stat.rate)}
      </div>
      <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
        {unavailable
          ? "Not enough data"
          : `${stat.retained_users} of ${stat.eligible_users} eligible users`}
      </div>
    </div>
  );
}

export default function UserRetentionCard() {
  const { data, isLoading, isError, refresh } = useUserRetention(4);

  const categories = (data?.weekly_returning_users || []).map((item) =>
    new Date(`${item.week_start}T00:00:00Z`).toLocaleDateString("default", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    })
  );
  const seriesData = (data?.weekly_returning_users || []).map((item) => item.returning_users);
  const activeUsersByIndex = (data?.weekly_returning_users || []).map((item) => item.active_users);

  const options: ApexOptions = {
    colors: ["#465FFF"],
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "area",
      height: 160,
      toolbar: { show: false },
      zoom: { enabled: false },
    },
    dataLabels: { enabled: false },
    stroke: { curve: "smooth", width: 2 },
    fill: {
      type: "gradient",
      gradient: { opacityFrom: 0.35, opacityTo: 0 },
    },
    xaxis: {
      categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
      tooltip: { enabled: false },
    },
    yaxis: {
      title: { text: undefined },
      labels: { formatter: (val: number) => Math.round(val).toString() },
    },
    tooltip: {
      y: {
        formatter: (val: number, opts) => {
          const idx = opts?.dataPointIndex ?? -1;
          const active = idx >= 0 ? activeUsersByIndex[idx] : undefined;
          return active !== undefined
            ? `${val.toLocaleString()} returning users (${active.toLocaleString()} active users total)`
            : `${val.toLocaleString()} returning users`;
        },
      },
    },
    grid: {
      borderColor: "#e5e7eb",
      strokeDashArray: 4,
      yaxis: { lines: { show: true } },
    },
  };

  const series = [{ name: "Returning users", data: seriesData }];

  const summary = data?.monthly_summary;
  const change = summary?.absolute_change ?? 0;
  const changeColor =
    change > 0
      ? "text-green-600 dark:text-green-400"
      : change < 0
        ? "text-red-600 dark:text-red-400"
        : "text-gray-500 dark:text-gray-400";
  const changeArrow = change > 0 ? "↑" : change < 0 ? "↓" : "→";
  const changeLabel = change > 0 ? "increase" : change < 0 ? "decrease" : "no change";

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
      <div className="border-b border-gray-100 bg-gray-50/50 px-5 py-3 dark:border-white/[0.05] dark:bg-white/[0.02]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              User Retention
            </h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Percentage of new users who return after signing up
            </p>
          </div>
          <button
            type="button"
            onClick={() => refresh()}
            className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 p-5">
        {isError ? (
          <div className="flex h-[280px] flex-col items-center justify-center gap-2">
            <p className="text-sm text-red-500">
              Failed to load user retention
              {isError?.response?.status ? ` (HTTP ${isError.response.status})` : ""}
            </p>
            {isError?.message && (
              <p className="max-w-md text-center text-xs text-gray-500 dark:text-gray-400">
                {isError.message}
              </p>
            )}
            <button
              onClick={() => refresh()}
              className="mt-1 rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        ) : isLoading ? (
          <div aria-busy="true" aria-label="Loading user retention data">
            <div className="grid grid-cols-3 gap-3">
              <KpiSkeleton />
              <KpiSkeleton />
              <KpiSkeleton />
            </div>
            <div className="mt-4 h-[160px] animate-pulse rounded bg-gray-100 dark:bg-white/5" />
            <div className="mt-4 h-4 w-2/3 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
          </div>
        ) : !data || (data.retention.day_1.eligible_users === 0 &&
            data.retention.day_7.eligible_users === 0 &&
            data.retention.day_30.eligible_users === 0) ? (
          <div className="flex h-[280px] items-center justify-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Not enough user history to calculate this metric
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <RetentionKpi label="Day 1" stat={data.retention.day_1} />
              <RetentionKpi label="Day 7" stat={data.retention.day_7} />
              <RetentionKpi label="Day 30" stat={data.retention.day_30} />
            </div>

            <div className="mt-4">
              <h4 className="px-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                Returning users
              </h4>
              {seriesData.length === 0 ? (
                <div className="flex h-[160px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  No weekly activity data available
                </div>
              ) : (
                <div id="chartUserRetention" className="-ml-4">
                  <ReactApexChart options={options} series={series} type="area" height={160} />
                </div>
              )}
              {/* Accessible tabular summary alongside the chart - keyboard/
                  screen-reader users get the same data without relying on
                  hover tooltips. */}
              <table className="sr-only">
                <caption>Returning users by week</caption>
                <thead>
                  <tr>
                    <th>Week</th>
                    <th>Returning users</th>
                    <th>Active users</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.weekly_returning_users || []).map((item) => (
                    <tr key={item.week_start}>
                      <td>{item.week_start} to {item.week_end}</td>
                      <td>{item.returning_users}</td>
                      <td>{item.active_users}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {summary && (
              <p className="mt-4 px-1 text-sm text-gray-700 dark:text-gray-300">
                {summary.returning_users} of {summary.eligible_users} users returned this month
                {" · "}
                <span className={changeColor}>
                  <span aria-hidden="true">{changeArrow}</span>{" "}
                  {Math.abs(change)} vs last month ({changeLabel})
                </span>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import React from "react";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";
import { useDailyActiveUsers } from "@/hooks/useApi";
import { chartTheme } from "@/components/charts/chartTheme";
import { useTheme } from "@/context/ThemeContext";

// Dynamically import ApexCharts with no SSR (browser-only)
const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

interface DailyActiveUsersItem {
  date: string;
  count: number;
  new_users?: number;
  returning_users?: number;
}

/**
 * Daily Active Users Chart
 * Stacked per day: returning users (account created on an earlier day) and
 * new users (signed up that day). The stack height is the day's total.
 */
export default function DailyActiveUsersChart({ days = 30 }: { days?: number }) {
  const { data: dauData, average, isLoading, isError } = useDailyActiveUsers(days);
  const { theme } = useTheme();
  const c = chartTheme(theme);

  const categories = dauData.map((item: DailyActiveUsersItem) =>
    new Date(`${item.date}T00:00:00Z`).toLocaleDateString("default", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    })
  );
  // Older backends only return `count`; fall back to a single total series.
  const hasSplit = dauData.some(
    (item: DailyActiveUsersItem) => typeof item.new_users === "number"
  );

  const options: ApexOptions = {
    colors: hasSplit ? ["#465FFF", "#12B76A"] : ["#465FFF"],
    chart: {
      fontFamily: c.fontFamily,
      type: "area",
      height: 220,
      stacked: hasSplit,
      toolbar: {
        show: false,
      },
      zoom: {
        enabled: false,
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      curve: "smooth",
      width: 2,
    },
    fill: {
      type: "gradient",
      gradient: {
        opacityFrom: 0.35,
        opacityTo: 0,
      },
    },
    xaxis: {
      categories: categories,
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
      tooltip: {
        enabled: false,
      },
    },
    yaxis: {
      title: {
        text: undefined,
      },
    },
    legend: {
      show: hasSplit,
      position: "top",
      horizontalAlign: "left",
      fontFamily: c.fontFamily,
    },
    tooltip: {
      shared: true,
      y: {
        formatter: function (val: number) {
          return val.toLocaleString();
        },
      },
    },
    grid: {
      borderColor: c.grid,
      strokeDashArray: 4,
      yaxis: {
        lines: {
          show: true,
        },
      },
    },
  };

  const series = hasSplit
    ? [
        {
          name: "Returning users",
          data: dauData.map((item: DailyActiveUsersItem) => item.returning_users ?? 0),
        },
        {
          name: "New users",
          data: dauData.map((item: DailyActiveUsersItem) => item.new_users ?? 0),
        },
      ]
    : [
        {
          name: "Daily Active Users",
          data: dauData.map((item: DailyActiveUsersItem) => item.count),
        },
      ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[220px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-[220px] gap-2">
        <p className="text-sm text-red-500">
          Failed to load daily active users
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

  if (dauData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[220px] text-gray-500">
        No activity data available
      </div>
    );
  }

  return (
    <div className="overflow-hidden">
      <div className="flex items-baseline justify-between px-1 pb-2">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Daily Active Users
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Avg: {average.toLocaleString(undefined, { maximumFractionDigits: 1 })}/day
        </p>
      </div>
      <div id="chartDailyActiveUsers" className="-ml-4">
        <ReactApexChart options={options} series={series} type="area" height={220} />
      </div>
    </div>
  );
}

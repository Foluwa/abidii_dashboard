"use client";

import React from "react";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";
import { useDailyActiveUsers } from "@/hooks/useApi";

// Dynamically import ApexCharts with no SSR (browser-only)
const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

interface DailyActiveUsersItem {
  date: string;
  count: number;
}

/**
 * Daily Active Users Chart
 * Shows the count of distinct users with at least one session per day
 */
export default function DailyActiveUsersChart({ days = 30 }: { days?: number }) {
  const { data: dauData, average, isLoading, isError } = useDailyActiveUsers(days);

  const categories = dauData.map((item: DailyActiveUsersItem) =>
    new Date(`${item.date}T00:00:00Z`).toLocaleDateString("default", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    })
  );
  const seriesData = dauData.map((item: DailyActiveUsersItem) => item.count);

  const options: ApexOptions = {
    colors: ["#465FFF"],
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "area",
      height: 220,
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
    tooltip: {
      y: {
        formatter: function (val: number) {
          return val.toLocaleString() + " active users";
        },
      },
    },
    grid: {
      borderColor: "#e5e7eb",
      strokeDashArray: 4,
      yaxis: {
        lines: {
          show: true,
        },
      },
    },
  };

  const series = [
    {
      name: "Daily Active Users",
      data: seriesData,
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

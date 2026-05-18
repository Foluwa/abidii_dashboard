"use client";

import React from "react";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";
import { useMonthlySubscriberGrowth } from "@/hooks/useApi";

// Dynamically import ApexCharts with no SSR (browser-only)
const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

interface GrowthDataItem {
  month: string;
  count: number;
}

interface ChartPoint {
  label: string;
  value: number;
}

/**
 * Monthly Subscriber Growth Chart
 * Shows the number of new subscribers each month (first-time subscribers only)
 */
export default function MonthlySubscriberGrowthChart() {
  const { data: growthData, isLoading, isError } = useMonthlySubscriberGrowth(12);

  // Transform API data to chart format
  const chartPoints: ChartPoint[] = growthData
    .map((item: GrowthDataItem) => {
      const [year, month] = String(item.month || "").split("-").map((value) => Number(value));
      if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
        return null;
      }
      const date = new Date(Date.UTC(year, month - 1, 1));
      return {
        label: date.toLocaleString("default", { month: "short", year: "2-digit", timeZone: "UTC" }),
        value: item.count,
      };
    })
    .filter((point: ChartPoint | null): point is ChartPoint => point !== null);
  const categories = chartPoints.map((point) => point.label);
  const seriesData = chartPoints.map((point) => point.value);

  const options: ApexOptions = {
    colors: ["#10B981"], // Green for subscriber growth
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "bar",
      height: 180,
      toolbar: {
        show: false,
      },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "39%",
        borderRadius: 4,
        borderRadiusApplication: "end",
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      show: true,
      width: 2,
      colors: ["transparent"],
    },
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "left",
      fontFamily: "Outfit",
    },
    xaxis: {
      categories: categories,
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
    },
    yaxis: {
      title: {
        text: undefined,
      },
    },
    fill: {
      opacity: 1,
    },
    tooltip: {
      y: {
        formatter: function (val: number) {
          return val.toLocaleString() + " subscribers";
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
      name: "New Subscribers",
      data: seriesData,
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[180px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-[180px] gap-2">
        <p className="text-sm text-red-500">
          Failed to load subscriber growth data
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

  if (chartPoints.length === 0) {
    return (
      <div className="flex items-center justify-center h-[180px] text-gray-500">
        No subscriber data available
      </div>
    );
  }

  return (
    <div className="overflow-hidden">
      <div id="chartSubscriberGrowth" className="-ml-4">
        <ReactApexChart
          options={options}
          series={series}
          type="bar"
          height={180}
        />
      </div>
    </div>
  );
}

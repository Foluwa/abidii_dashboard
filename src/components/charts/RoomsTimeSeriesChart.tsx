"use client";
import React from "react";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

interface RoomsTimeSeriesChartProps {
  title: string;
  categories: string[];
  series: { name: string; data: number[] }[];
  colors?: string[];
  height?: number;
}

/**
 * Presentational multi-series bar chart for room-analytics daily
 * breakdowns (rooms_by_day, participation_by_day). Data/loading/error
 * states are owned by the parent page - this only renders what it's given.
 */
export default function RoomsTimeSeriesChart({
  title,
  categories,
  series,
  colors = ["#465FFF", "#12B76A", "#F79009"],
  height = 220,
}: RoomsTimeSeriesChartProps) {
  const options: ApexOptions = {
    colors,
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "bar",
      height,
      toolbar: { show: false },
      zoom: { enabled: false },
      stacked: false,
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "55%",
        borderRadius: 4,
        borderRadiusApplication: "end",
      },
    },
    dataLabels: { enabled: false },
    stroke: { show: true, width: 2, colors: ["transparent"] },
    xaxis: {
      categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "left",
      fontFamily: "Outfit",
    },
    grid: {
      borderColor: "#e5e7eb",
      strokeDashArray: 4,
      yaxis: { lines: { show: true } },
    },
    fill: { opacity: 1 },
    tooltip: {
      y: { formatter: (val: number) => `${val}` },
    },
  };

  const hasData = categories.length > 0 && series.some((s) => s.data.some((v) => v > 0));

  return (
    <div className="overflow-hidden">
      <h3 className="px-1 pb-2 text-sm font-medium text-gray-700 dark:text-gray-300">{title}</h3>
      {hasData ? (
        <div className="max-w-full overflow-x-auto custom-scrollbar">
          <div className="min-w-[600px]">
            <ReactApexChart options={options} series={series} type="bar" height={height} />
          </div>
        </div>
      ) : (
        <div
          className="flex items-center justify-center text-sm text-gray-500 dark:text-gray-400"
          style={{ height }}
        >
          No activity in this period
        </div>
      )}
    </div>
  );
}

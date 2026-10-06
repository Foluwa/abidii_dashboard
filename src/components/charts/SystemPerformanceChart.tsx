"use client";
import { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useSystemMetrics } from "@/hooks/useApi";
import { useState } from "react";
import { MoreDotIcon } from "@/icons";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { chartTheme } from "@/components/charts/chartTheme";
import { useTheme } from "@/context/ThemeContext";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

export default function SystemPerformanceChart() {
  const { metrics, isLoading, isError } = useSystemMetrics();
  const [isOpen, setIsOpen] = useState(false);
  const { theme } = useTheme();
  const c = chartTheme(theme);

  const options: ApexOptions = {
    colors: ["#465fff", "#10b981", "#f59e0b"],
    chart: {
      fontFamily: c.fontFamily,
      type: "line",
      height: 250,
      toolbar: {
        show: false,
      },
    },
    stroke: {
      curve: "smooth",
      width: 3,
    },
    dataLabels: {
      enabled: false,
    },
    xaxis: {
      categories: ["Now"],
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
      labels: {
        style: {
          colors: c.text,
          fontSize: "12px",
        },
      },
    },
    yaxis: {
      min: 0,
      max: 100,
      labels: {
        style: {
          colors: c.text,
          fontSize: "12px",
        },
        formatter: (val: number) => `${val.toFixed(0)}%`,
      },
    },
    grid: {
      borderColor: c.grid,
      strokeDashArray: 5,
    },
    legend: {
      position: "top",
      horizontalAlign: "right",
      labels: {
        colors: c.text,
      },
    },
    tooltip: {
      y: {
        formatter: (val: number) => `${val.toFixed(1)}%`,
      },
    },
  };

  const series = [
    {
      name: "CPU Usage",
      data: [metrics?.cpu_usage || 0],
    },
    {
      name: "Memory Usage",
      data: [metrics?.memory_usage || 0],
    },
    {
      name: "Disk Usage",
      data: [metrics?.disk_usage || 0],
    },
  ];

  function toggleDropdown() {
    setIsOpen(!isOpen);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900 sm:p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          System Performance
        </h3>
        <p className="mt-4 text-sm text-red-500">Failed to load system metrics</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900 sm:p-6">
      <div className="flex justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            System Performance
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Real-time server health monitoring
          </p>
        </div>

        <div className="relative inline-block">
          <button onClick={toggleDropdown} className="dropdown-toggle">
            <MoreDotIcon className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300" />
          </button>
          <Dropdown
            isOpen={isOpen}
            onClose={closeDropdown}
            className="w-40 p-2"
          >
            <DropdownItem
              onItemClick={closeDropdown}
              className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              Refresh
            </DropdownItem>
            <DropdownItem
              onItemClick={closeDropdown}
              className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              View Details
            </DropdownItem>
          </Dropdown>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-blue-50 rounded-lg dark:bg-blue-900/20">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">CPU Usage</p>
              <p className="text-2xl font-semibold text-blue-600 dark:text-blue-400">
                {metrics?.cpu_usage?.toFixed(1) || 0}%
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg dark:bg-green-900/20">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Memory</p>
              <p className="text-2xl font-semibold text-green-600 dark:text-green-400">
                {metrics?.memory_usage?.toFixed(1) || 0}%
              </p>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg dark:bg-amber-900/20">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Disk</p>
              <p className="text-2xl font-semibold text-amber-600 dark:text-amber-400">
                {metrics?.disk_usage?.toFixed(1) || 0}%
              </p>
            </div>
          </div>

          <div className="overflow-hidden">
            <ReactApexChart
              options={options}
              series={series}
              type="line"
              height={250}
            />
          </div>
        </>
      )}
    </div>
  );
}

"use client";
import { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useSystemStats } from "@/hooks/useApi";
import { useState } from "react";
import { MoreDotIcon } from "@/icons";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { chartTheme } from "@/components/charts/chartTheme";
import { useTheme } from "@/context/ThemeContext";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

export default function UserActivityGaugeChart() {
  const { stats, isLoading, isError } = useSystemStats();
  const [isOpen, setIsOpen] = useState(false);
  const { theme } = useTheme();
  const c = chartTheme(theme);

  const totalUsers = stats?.total_users || 0;
  const activeUsers = stats?.active_users_today || 0;
  const inactiveUsers = totalUsers - activeUsers;
  const activityRate = totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;

  const options: ApexOptions = {
    colors: ["#10b981"],
    chart: {
      fontFamily: c.fontFamily,
      type: "radialBar",
      height: 320,
    },
    plotOptions: {
      radialBar: {
        startAngle: -135,
        endAngle: 135,
        hollow: {
          size: "65%",
          background: "transparent",
        },
        track: {
          background: c.grid,
          strokeWidth: "100%",
        },
        dataLabels: {
          name: {
            offsetY: -10,
            color: c.text,
            fontSize: "14px",
            fontWeight: 500,
          },
          value: {
            offsetY: 5,
            color: c.heading,
            fontSize: "32px",
            fontWeight: 700,
            formatter: (val: number) => `${val.toFixed(1)}%`,
          },
        },
      },
    },
    fill: {
      type: "gradient",
      gradient: {
        shade: "dark",
        type: "horizontal",
        shadeIntensity: 0.5,
        gradientToColors: ["#34d399"],
        inverseColors: false,
        opacityFrom: 1,
        opacityTo: 1,
        stops: [0, 100],
      },
    },
    stroke: {
      lineCap: "round",
    },
    labels: ["Activity Rate"],
  };

  const series = [activityRate];

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
          User Activity
        </h3>
        <p className="mt-4 text-sm text-red-500">Failed to load stats</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900 sm:p-6">
      <div className="flex justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            User Activity
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Active vs inactive users today
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
              Export Data
            </DropdownItem>
          </Dropdown>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-80">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <ReactApexChart
            options={options}
            series={series}
            type="radialBar"
            height={320}
          />
          
          <div className="grid grid-cols-2 gap-4 w-full mt-2">
            <div className="p-4 bg-green-50 rounded-lg dark:bg-green-900/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Active Today</span>
              </div>
              <p className="text-2xl font-semibold text-green-600 dark:text-green-400">
                {activeUsers.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(1) : 0}% of total
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg dark:bg-gray-800">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Inactive</span>
              </div>
              <p className="text-2xl font-semibold text-gray-600 dark:text-gray-400">
                {inactiveUsers.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {totalUsers > 0 ? ((inactiveUsers / totalUsers) * 100).toFixed(1) : 0}% of total
              </p>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg dark:bg-blue-900/20 w-full">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total Users</span>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                {totalUsers.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

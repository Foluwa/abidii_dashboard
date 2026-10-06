"use client";
import { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useUsers } from "@/hooks/useApi";
import { useState } from "react";
import { MoreDotIcon } from "@/icons";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { chartTheme } from "@/components/charts/chartTheme";
import { useTheme } from "@/context/ThemeContext";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

export default function SubscriptionDistributionChart() {
  const { users, isLoading, isError } = useUsers({ limit: 1000 });
  const [isOpen, setIsOpen] = useState(false);
  const { theme } = useTheme();
  const c = chartTheme(theme);

  // Count users by subscription type (assuming users have a subscription_type or is_premium field)
  const subscriptionCounts = users?.users?.reduce((acc: any, user: any) => {
    const isPremium = user.is_premium || user.subscription_type === 'premium' || user.subscription_type === 'pro';
    const key = isPremium ? 'premium' : 'free';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, { free: 0, premium: 0 }) || { free: 0, premium: 0 };

  const freeCount = subscriptionCounts.free || 0;
  const premiumCount = subscriptionCounts.premium || 0;
  const total = freeCount + premiumCount;

  const options: ApexOptions = {
    colors: ["#94a3b8", "#fbbf24"],
    chart: {
      fontFamily: c.fontFamily,
      type: "donut",
      height: 300,
    },
    labels: ["Free", "Premium"],
    legend: {
      position: "bottom",
      horizontalAlign: "center",
      labels: {
        colors: c.text,
      },
    },
    plotOptions: {
      pie: {
        donut: {
          size: "65%",
          labels: {
            show: true,
            total: {
              show: true,
              label: "Total Users",
              fontSize: "14px",
              color: c.text,
              formatter: () => total.toString(),
            },
            value: {
              fontSize: "22px",
              fontWeight: 600,
              color: c.heading,
            },
          },
        },
      },
    },
    dataLabels: {
      enabled: false,
    },
    responsive: [
      {
        breakpoint: 480,
        options: {
          chart: {
            height: 250,
          },
          legend: {
            position: "bottom",
          },
        },
      },
    ],
    tooltip: {
      y: {
        formatter: (val: number) => {
          const percentage = ((val / total) * 100).toFixed(1);
          return `${val} users (${percentage}%)`;
        },
      },
    },
  };

  const series = [freeCount, premiumCount];

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
          Subscription Distribution
        </h3>
        <p className="mt-4 text-sm text-red-500">Failed to load user data</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900 sm:p-6">
      <div className="flex justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Subscription Distribution
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Free vs Premium users
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
              Export Data
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
        <div className="flex items-center justify-center h-80">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <ReactApexChart
            options={options}
            series={series}
            type="donut"
            height={300}
          />
          
          <div className="grid grid-cols-2 gap-4 mt-6 w-full">
            <div className="p-3 bg-gray-50 rounded-lg dark:bg-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#94a3b8]"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Free</span>
              </div>
              <p className="text-xl font-semibold text-gray-900 dark:text-white mt-1">
                {freeCount}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {total > 0 ? ((freeCount / total) * 100).toFixed(1) : 0}%
              </p>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg dark:bg-amber-900/20">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#fbbf24]"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Premium</span>
              </div>
              <p className="text-xl font-semibold text-amber-600 dark:text-amber-400 mt-1">
                {premiumCount}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {total > 0 ? ((premiumCount / total) * 100).toFixed(1) : 0}%
              </p>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg dark:bg-blue-900/20 w-full">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Conversion Rate</p>
            <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
              {total > 0 ? ((premiumCount / total) * 100).toFixed(2) : 0}%
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

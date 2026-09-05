"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { name: "Overview", href: "/analytics" },
  { name: "Players", href: "/analytics/players" },
  { name: "Rooms", href: "/analytics/rooms" },
  { name: "Curriculum Ops", href: "/analytics/curriculum-ops" },
];

export default function AnalyticsTabs() {
  const pathname = usePathname();

  return (
    <div className="overflow-x-auto border-b border-gray-200 dark:border-gray-700">
      <nav className="flex min-w-max -mb-px space-x-8" aria-label="Analytics sections">
        {tabs.map((tab) => (
          <Link
            key={tab.name}
            href={tab.href}
            className={`border-b-2 px-1 py-4 text-sm font-medium ${
              pathname === tab.href
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            {tab.name}
          </Link>
        ))}
      </nav>
    </div>
  );
}

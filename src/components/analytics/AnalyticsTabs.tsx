"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { name: "Overview", href: "/analytics" },
  { name: "Players", href: "/analytics/players" },
  { name: "Rooms", href: "/analytics/rooms" },
  { name: "Curriculum Ops", href: "/analytics/curriculum-ops" },
  { name: "Detailed", href: "/analytics/detailed" },
  { name: "Learning", href: "/analytics/learning" },
  { name: "Learning Path", href: "/analytics/learning-path" },
  { name: "Email Sign-in", href: "/analytics/email-signin" },
];

/** Exact match, or a sub-page of the tab ("/analytics/learning/x") - but
 * never a sibling that only shares a prefix ("/analytics/learning-path"). */
export function isTabActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (pathname === href) return true;
  return href !== "/analytics" && pathname.startsWith(`${href}/`);
}

export default function AnalyticsTabs() {
  const pathname = usePathname();

  return (
    <div className="overflow-x-auto border-b border-border">
      <nav className="flex min-w-max -mb-px space-x-8" aria-label="Analytics sections">
        {tabs.map((tab) => (
          <Link
            key={tab.name}
            href={tab.href}
            className={`border-b-2 px-1 py-4 text-sm font-medium ${
              isTabActive(pathname, tab.href)
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-muted-foreground hover:border-gray-300 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {tab.name}
          </Link>
        ))}
      </nav>
    </div>
  );
}

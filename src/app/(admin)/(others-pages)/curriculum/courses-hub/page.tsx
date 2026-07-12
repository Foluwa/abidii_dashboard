"use client";

import React, { useState } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";

// Reuse the existing standalone page components as tab content — same
// pattern already used by system/configuration/page.tsx.
import CoursesListPage from "@/app/(admin)/(others-pages)/curriculum/courses/page";
import PublishingReadinessPage from "@/app/(admin)/(others-pages)/curriculum/publishing/page";

type CoursesTab = "all" | "readiness";

const TABS: { key: CoursesTab; label: string }[] = [
  { key: "all", label: "All Courses" },
  { key: "readiness", label: "Publishing Readiness" },
];

export default function CoursesHubPage() {
  const [activeTab, setActiveTab] = useState<CoursesTab>("all");

  return (
    <div className="space-y-6">
      <div>
        <PageBreadCrumb pageTitle="Courses" />
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage courses and check their publishing readiness
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex -mb-px space-x-8">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === tab.key
                  ? "border-brand-500 text-brand-600 dark:text-brand-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "all" && <CoursesListPage />}
      {activeTab === "readiness" && <PublishingReadinessPage />}
    </div>
  );
}

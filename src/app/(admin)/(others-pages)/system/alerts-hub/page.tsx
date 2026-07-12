"use client";

import React, { useState } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";

// Reuse the existing standalone page components as tab content — same
// pattern already used by system/configuration/page.tsx. Testing is just
// 3 buttons that fire test alerts into the same pipeline Alerts displays,
// not enough content to justify its own top-level nav entry.
import AlertsPage from "@/app/(admin)/(others-pages)/system/alerts/page";
import TestingPage from "@/app/(admin)/(others-pages)/system/testing/page";

type AlertsTab = "history" | "testing";

const TABS: { key: AlertsTab; label: string }[] = [
  { key: "history", label: "Alert History" },
  { key: "testing", label: "Send Test Alert" },
];

export default function AlertsHubPage() {
  const [activeTab, setActiveTab] = useState<AlertsTab>("history");

  return (
    <div className="space-y-6">
      <div>
        <PageBreadCrumb pageTitle="Alerts" />
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Review alert history and test the alerting pipeline
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
      {activeTab === "history" && <AlertsPage />}
      {activeTab === "testing" && <TestingPage />}
    </div>
  );
}

"use client";

import React, { useState } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";

// Import the three existing page components
import PlatformConfigPage from "@/app/(admin)/(others-pages)/system/config/page";
import AppConfigPage from "@/app/(admin)/(others-pages)/settings/app-config/page";
import LanguageSettingsPage from "@/app/(admin)/(others-pages)/settings/language-settings/page";

type ConfigTab = "platform" | "application" | "language";

const TABS: { key: ConfigTab; label: string }[] = [
  { key: "platform", label: "Feature Flags" },
  { key: "application", label: "App Settings" },
  { key: "language", label: "Language" },
];

export default function ConfigurationPage() {
  const [activeTab, setActiveTab] = useState<ConfigTab>("platform");

  return (
    <div className="space-y-6">
      <div>
        <PageBreadCrumb pageTitle="Configuration" />
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage platform settings, application configuration, and language practice limits
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
      {activeTab === "platform" && <PlatformConfigPage />}
      {activeTab === "application" && <AppConfigPage />}
      {activeTab === "language" && <LanguageSettingsPage />}
    </div>
  );
}

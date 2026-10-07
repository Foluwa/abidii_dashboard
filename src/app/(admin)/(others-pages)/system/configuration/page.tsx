"use client";

import React from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import { UrlTabs, type UrlTab } from "@/components/ui/url-tabs";

// Import the extracted content components
import { PlatformConfigContent } from "@/components/system/PlatformConfigContent";
import { AppConfigContent } from "@/components/settings/AppConfigContent";
import { LanguageSettingsContent } from "@/components/settings/LanguageSettingsContent";
import { ForceUpdateContent } from "@/components/settings/ForceUpdateContent";
import { EmailTemplatesContent } from "@/components/system/EmailTemplatesContent";

const TABS: UrlTab[] = [
  { key: "platform", label: "Feature Flags" },
  { key: "application", label: "App Settings" },
  { key: "language", label: "Language" },
  { key: "force-update", label: "Force Update" },
  { key: "email", label: "Email Templates" },
];

export default function ConfigurationPage() {
  return (
    <div className="space-y-6">
      <div>
        <PageBreadCrumb pageTitle="Configuration" />
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage platform settings, application configuration, and language practice limits
        </p>
      </div>

      <UrlTabs
        tabs={TABS}
        defaultKey="platform"
        renderTab={(key) => {
          if (key === "application") {
            return <AppConfigContent showHeader={false} />;
          }
          if (key === "language") {
            return <LanguageSettingsContent showHeader={false} />;
          }
          if (key === "force-update") {
            return <ForceUpdateContent showHeader={false} />;
          }
          if (key === "email") {
            return <EmailTemplatesContent showHeader={false} />;
          }
          return <PlatformConfigContent showHeader={false} />;
        }}
      />
    </div>
  );
}

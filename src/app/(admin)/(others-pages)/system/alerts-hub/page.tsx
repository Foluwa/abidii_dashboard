"use client";

import React from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import { UrlTabs, type UrlTab } from "@/components/ui/url-tabs";

// Reuse the extracted content components as tab content — same
// pattern already used by system/configuration/page.tsx. Testing is just
// 3 buttons that fire test alerts into the same pipeline Alerts displays,
// not enough content to justify its own top-level nav entry.
import { AlertsContent } from "@/components/system/AlertsContent";
import { TestingContent } from "@/components/system/TestingContent";

const TABS: UrlTab[] = [
  { key: "history", label: "Alert History" },
  { key: "testing", label: "Send Test Alert" },
];

export default function AlertsHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <PageBreadCrumb pageTitle="Alerts" />
        <p className="mt-1 text-sm text-muted-foreground">
          Review alert history and test the alerting pipeline
        </p>
      </div>

      <UrlTabs
        tabs={TABS}
        defaultKey="history"
        renderTab={(key) => {
          if (key === "testing") {
            return <TestingContent showHeader={false} />;
          }
          return <AlertsContent showHeader={false} />;
        }}
      />
    </div>
  );
}

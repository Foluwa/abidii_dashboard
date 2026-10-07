"use client";

import React from "react";

import { CronJobsContent } from "@/components/system/CronJobsContent";
import { AdminJobsContent } from "@/components/system/AdminJobsContent";
import { UrlTabs, type UrlTab } from "@/components/ui/url-tabs";

const TABS: UrlTab[] = [
  { key: "cron", label: "Cron Jobs" },
  { key: "admin", label: "Admin Jobs" },
];

export default function JobsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Jobs
        </h1>
        <p className="text-sm text-muted-foreground">
          Monitor scheduled cron jobs and admin background jobs
        </p>
      </div>

      <UrlTabs
        tabs={TABS}
        defaultKey="cron"
        renderTab={(key, isActive) => {
          if (key === "admin") {
            return <AdminJobsContent showHeader={false} isActive={isActive} />;
          }
          return <CronJobsContent showHeader={false} isActive={isActive} />;
        }}
      />
    </div>
  );
}

"use client";

import React from "react";

import { ComposeContent } from "@/components/notifications/ComposeContent";
import { HistoryContent } from "@/components/notifications/HistoryContent";
import { DailyContent } from "@/components/notifications/DailyContent";
import { UrlTabs, type UrlTab } from "@/components/ui/url-tabs";

const TABS: UrlTab[] = [
  { key: "compose", label: "Compose" },
  { key: "history", label: "History" },
  { key: "daily", label: "Daily Content" },
];

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl tracking-tight text-foreground">
          Notifications
        </h1>
        <p className="text-sm text-muted-foreground">
          Compose pushes, review history, and manage daily content
        </p>
      </div>

      <UrlTabs
        tabs={TABS}
        defaultKey="compose"
        renderTab={(key, isActive) => {
          if (key === "history") {
            return <HistoryContent showHeader={false} isActive={isActive} />;
          }
          if (key === "daily") {
            return <DailyContent showHeader={false} isActive={isActive} />;
          }
          return <ComposeContent showHeader={false} isActive={isActive} />;
        }}
      />
    </div>
  );
}

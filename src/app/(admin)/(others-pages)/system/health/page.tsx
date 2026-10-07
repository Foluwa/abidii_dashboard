"use client";

import React from "react";

import { SystemStatusContent } from "@/components/system/SystemStatusContent";
import { SystemMetricsContent } from "@/components/system/SystemMetricsContent";
import { IdempotencyContent } from "@/components/system/IdempotencyContent";
import { UrlTabs, type UrlTab } from "@/components/ui/url-tabs";

const TABS: UrlTab[] = [
  { key: "status", label: "Status" },
  { key: "metrics", label: "Metrics" },
  { key: "idempotency", label: "Idempotency" },
];

export default function HealthPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl tracking-tight text-foreground">
          System Health
        </h1>
        <p className="text-sm text-muted-foreground">
          Monitor system status, resource metrics, and idempotency health
        </p>
      </div>

      <UrlTabs
        tabs={TABS}
        defaultKey="status"
        renderTab={(key, isActive) => {
          if (key === "metrics") {
            return <SystemMetricsContent showHeader={false} isActive={isActive} />;
          }
          if (key === "idempotency") {
            return <IdempotencyContent showHeader={false} />;
          }
          return <SystemStatusContent showHeader={false} isActive={isActive} />;
        }}
      />
    </div>
  );
}

"use client";

import React from "react";

import { EnforcementContent } from "@/components/system/EnforcementContent";
import { SecurityExceptionsContent } from "@/components/system/SecurityExceptionsContent";
import { UrlTabs, type UrlTab } from "@/components/ui/url-tabs";

const TABS: UrlTab[] = [
  { key: "enforcement", label: "Enforcement" },
  { key: "exceptions", label: "Security Exceptions" },
];

export default function SecurityPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl tracking-tight text-foreground">
          Security
        </h1>
        <p className="text-sm text-muted-foreground">
          Monitor enforcement and manage security exceptions
        </p>
      </div>

      <UrlTabs
        tabs={TABS}
        defaultKey="enforcement"
        renderTab={(key, isActive) => {
          if (key === "exceptions") {
            return <SecurityExceptionsContent showHeader={false} />;
          }
          return <EnforcementContent showHeader={false} isActive={isActive} />;
        }}
      />
    </div>
  );
}

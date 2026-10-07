"use client";

import React from "react";

import { CoursesListContent } from "@/components/curriculum/CoursesListContent";
import { PublishingReadinessContent } from "@/components/curriculum/PublishingReadinessContent";
import { UrlTabs, type UrlTab } from "@/components/ui/url-tabs";

const TABS: UrlTab[] = [
  { key: "all", label: "All Courses" },
  { key: "readiness", label: "Publishing Readiness" },
];

export default function CoursesHubPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Courses
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage courses and check their publishing readiness
        </p>
      </div>

      <UrlTabs
        tabs={TABS}
        defaultKey="all"
        renderTab={(key) =>
          key === "readiness" ? (
            <PublishingReadinessContent showHeader={false} />
          ) : (
            <CoursesListContent showHeader={false} />
          )
        }
      />
    </div>
  );
}

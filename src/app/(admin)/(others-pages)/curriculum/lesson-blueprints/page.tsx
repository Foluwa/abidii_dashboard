"use client";

import React from "react";

import { LessonBlueprintsContent } from "@/components/curriculum/LessonBlueprintsContent";
import { LessonImportContent } from "@/components/curriculum/LessonImportContent";
import { BlueprintAssetsContent } from "@/components/curriculum/BlueprintAssetsContent";
import { UrlTabs, type UrlTab } from "@/components/ui/url-tabs";

const TABS: UrlTab[] = [
  { key: "blueprints", label: "Blueprints" },
  { key: "import", label: "Import" },
  { key: "assets", label: "Assets" },
];

export default function LessonBlueprintsHubPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Lesson Blueprints
        </h1>
        <p className="text-sm text-muted-foreground">
          Author blueprints, import lessons, and manage blueprint assets
        </p>
      </div>

      <UrlTabs
        tabs={TABS}
        defaultKey="blueprints"
        renderTab={(key) => {
          if (key === "import") {
            return <LessonImportContent showHeader={false} />;
          }
          if (key === "assets") {
            return <BlueprintAssetsContent showHeader={false} />;
          }
          return <LessonBlueprintsContent showHeader={false} />;
        }}
      />
    </div>
  );
}

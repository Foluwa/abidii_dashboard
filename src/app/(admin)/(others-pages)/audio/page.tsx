"use client";

import React from "react";

import { VoicesContent } from "@/components/audio/VoicesContent";
import { GenerateContent } from "@/components/audio/GenerateContent";
import { AudioJobsContent } from "@/components/audio/AudioJobsContent";
import { UrlTabs, type UrlTab } from "@/components/ui/url-tabs";

const TABS: UrlTab[] = [
  { key: "voices", label: "Voices" },
  { key: "generate", label: "Generate" },
  { key: "jobs", label: "Jobs" },
];

export default function AudioPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Audio
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage voices, generate audio, and monitor audio jobs
        </p>
      </div>

      <UrlTabs
        tabs={TABS}
        defaultKey="voices"
        renderTab={(key, isActive) => {
          if (key === "generate") {
            return <GenerateContent showHeader={false} isActive={isActive} />;
          }
          if (key === "jobs") {
            return <AudioJobsContent showHeader={false} isActive={isActive} />;
          }
          return <VoicesContent showHeader={false} isActive={isActive} />;
        }}
      />
    </div>
  );
}

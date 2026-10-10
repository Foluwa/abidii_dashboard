"use client";

import React, { useState } from "react";
import { useSearchParams } from "next/navigation";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";

// Reuse the existing standalone page components as tab content — same
// pattern already used by system/configuration/page.tsx. Each of these 7
// pages is a near-identical CRUD table over a different content type, so
// one tabbed page replaces 7 separate sidebar entries.
import WordsPage from "@/app/(admin)/(others-pages)/content/words/page";
import PhrasesPage from "@/app/(admin)/(others-pages)/content/phrases/page";
import TimePhrasesPage from "@/app/(admin)/(others-pages)/content/time-phrases/page";
import SentencesPage from "@/app/(admin)/(others-pages)/content/sentences/page";
import ProverbsPage from "@/app/(admin)/(others-pages)/content/proverbs/page";
import LettersPage from "@/app/(admin)/(others-pages)/content/letters/page";
import NumbersPage from "@/app/(admin)/(others-pages)/content/numbers/page";
import CollectionsPage from "@/app/(admin)/(others-pages)/content/collections/page";

type LibraryTab =
  | "words"
  | "phrases"
  | "timePhrases"
  | "sentences"
  | "proverbs"
  | "letters"
  | "numbers"
  | "collections";

const TABS: { key: LibraryTab; label: string }[] = [
  { key: "collections", label: "Collections" },
  { key: "words", label: "Words" },
  { key: "phrases", label: "Phrases" },
  { key: "timePhrases", label: "Time Phrases" },
  { key: "sentences", label: "Sentences" },
  { key: "proverbs", label: "Proverbs" },
  { key: "letters", label: "Letters" },
  { key: "numbers", label: "Numbers" },
];

/**
 * ?tab=<key> opens that tab. A ?search=... link (e.g. /content/library?search=penis)
 * is a word search - the Words tab reads it - so it opens Words.
 */
function initialLibraryTab(params: { get(name: string): string | null } | null): LibraryTab {
  const tab = params?.get("tab");
  if (tab && TABS.some((t) => t.key === tab)) return tab as LibraryTab;
  if (params?.get("search")) return "words";
  return "collections";
}

export default function ContentLibraryPage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<LibraryTab>(() => initialLibraryTab(searchParams));

  return (
    <div className="space-y-6">
      <div>
        <PageBreadCrumb pageTitle="Content Library" />
        <p className="mt-1 text-sm text-muted-foreground">
          Browse and manage all editorial content types from one workspace
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-border overflow-x-auto">
        <nav className="flex -mb-px space-x-8 w-max">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                
                py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap
                ${activeTab === tab.key
                  ? "border-brand-500 text-brand-600 dark:text-brand-400"
                  : "border-transparent text-muted-foreground hover:text-gray-700 hover:border-gray-300 dark:hover:text-gray-300"
                }

              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "words" && <WordsPage />}
      {activeTab === "phrases" && <PhrasesPage />}
      {activeTab === "timePhrases" && <TimePhrasesPage />}
      {activeTab === "sentences" && <SentencesPage />}
      {activeTab === "proverbs" && <ProverbsPage />}
      {activeTab === "letters" && <LettersPage />}
      {activeTab === "numbers" && <NumbersPage />}
      {activeTab === "collections" && <CollectionsPage />}
    </div>
  );
}

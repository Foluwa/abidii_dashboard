"use client";

import React, { useState } from "react";
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

type LibraryTab =
  | "words"
  | "phrases"
  | "timePhrases"
  | "sentences"
  | "proverbs"
  | "letters"
  | "numbers";

const TABS: { key: LibraryTab; label: string }[] = [
  { key: "words", label: "Words" },
  { key: "phrases", label: "Phrases" },
  { key: "timePhrases", label: "Time Phrases" },
  { key: "sentences", label: "Sentences" },
  { key: "proverbs", label: "Proverbs" },
  { key: "letters", label: "Letters" },
  { key: "numbers", label: "Numbers" },
];

export default function ContentLibraryPage() {
  const [activeTab, setActiveTab] = useState<LibraryTab>("words");

  return (
    <div className="space-y-6">
      <div>
        <PageBreadCrumb pageTitle="Content Library" />
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Browse and manage all editorial content types from one workspace
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <nav className="flex -mb-px space-x-8 w-max">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap
                ${activeTab === tab.key
                  ? "border-brand-500 text-brand-600 dark:text-brand-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
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
    </div>
  );
}

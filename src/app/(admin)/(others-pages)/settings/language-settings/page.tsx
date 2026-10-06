"use client";

import React, { useState, useEffect } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import { useLanguages } from "@/hooks/useApi";
import { apiClient } from "@/lib/api";
import { Language } from "@/types/api";
import Alert from "@/components/ui/alert/SimpleAlert";

interface NumbersAvailability {
  min_available: number;
  max_available: number;
  actual_max_in_db: number | null;
  recommended_ranges: Array<{ label: string; min: number; max: number }>;
}

interface LanguageWithStats extends Language {
  max_practice_numbers?: number | null;
  numbersAvailability?: NumbersAvailability;
}

export default function LanguageSettingsPage() {
  const { languages, isLoading, isError, refresh } = useLanguages();
  const [languagesWithStats, setLanguagesWithStats] = useState<LanguageWithStats[]>([]);
  const [editingLanguage, setEditingLanguage] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [saving, setSaving] = useState<string | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Load numbers availability for each language
  useEffect(() => {
    const loadStats = async () => {
      if (!languages || languages.length === 0) return;
      
      setLoadingStats(true);
      const withStats: LanguageWithStats[] = [];
      
      for (const lang of languages) {
        try {
          const response = await apiClient.get(
            `/api/v1/games/numbers/availability/by-code?lang_code=${lang.iso_639_3}`
          );
          withStats.push({
            ...lang,
            numbersAvailability: response.data,
          });
        } catch {
          withStats.push({ ...lang });
        }
      }
      
      setLanguagesWithStats(withStats);
      setLoadingStats(false);
    };
    
    loadStats();
  }, [languages]);

  const handleSave = async (languageId: string) => {
    setSaving(languageId);
    
    try {
      const value = editValue.trim() === "" ? null : parseInt(editValue, 10);
      
      await apiClient.put(`/api/v1/languages/${languageId}`, {
        max_practice_numbers: value,
      });
      
      // Refresh data
      await refresh();
      
      // Re-fetch the availability for this language
      const lang = languagesWithStats.find(l => l.id === languageId);
      if (lang) {
        const response = await apiClient.get(
          `/api/v1/games/numbers/availability/by-code?lang_code=${lang.iso_639_3}`
        );
        setLanguagesWithStats(prev => 
          prev.map(l => l.id === languageId ? { ...l, numbersAvailability: response.data } : l)
        );
      }
      
      setEditingLanguage(null);
      setEditValue("");
    } catch (error) {
      console.error("Failed to update:", error);
      alert("Failed to update language settings");
    } finally {
      setSaving(null);
    }
  };

  const startEditing = (lang: LanguageWithStats) => {
    setEditingLanguage(lang.id);
    // Pre-fill with configured max if set, otherwise leave empty to use DB max
    const configuredMax = lang.numbersAvailability?.max_available;
    const actualMax = lang.numbersAvailability?.actual_max_in_db;
    
    // If configured max equals actual max, it means no custom limit is set
    if (configuredMax && actualMax && configuredMax < actualMax) {
      setEditValue(configuredMax.toString());
    } else {
      setEditValue("");
    }
  };

  if (isLoading || loadingStats) {
    return (
      <div className="p-6">
        <PageBreadCrumb pageTitle="Language Practice Settings" />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading...</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <PageBreadCrumb pageTitle="Language Practice Settings" />
          <Alert variant="error">
            Failed to load languages. Please check your API connection.
          </Alert>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageBreadCrumb pageTitle="Language Practice Settings" />
      
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Numbers Practice Range Limits
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Configure the maximum number range available for practice per language.
          Leave empty to use the actual maximum from the database.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Language
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                ISO Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Numbers in DB
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Practice Limit
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Effective Max
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {languagesWithStats.map((lang) => {
              const actualMax = lang.numbersAvailability?.actual_max_in_db || 0;
              const effectiveMax = lang.numbersAvailability?.max_available || actualMax;
              const hasCustomLimit = effectiveMax < actualMax;
              
              return (
                <tr key={lang.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {lang.flag_emoji && (
                        <span className="mr-2 text-xl">{lang.flag_emoji}</span>
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {lang.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {lang.native_name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-700 rounded">
                      {lang.iso_639_3}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {actualMax > 0 ? (
                      <span className="font-medium">{actualMax.toLocaleString()}</span>
                    ) : (
                      <span className="text-gray-400">No data</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingLanguage === lang.id ? (
                      <input
                        type="number"
                        min="1"
                        max={actualMax || 100000}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="Use DB max"
                        className="w-32 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded 
                                   bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                   focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      />
                    ) : (
                      <span className={`text-sm ${hasCustomLimit ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-gray-400'}`}>
                        {hasCustomLimit ? effectiveMax.toLocaleString() : "Not set"}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-medium ${
                      hasCustomLimit 
                        ? 'text-amber-600 dark:text-amber-400' 
                        : 'text-green-600 dark:text-green-400'
                    }`}>
                      {effectiveMax > 0 ? effectiveMax.toLocaleString() : '-'}
                    </span>
                    {hasCustomLimit && (
                      <span className="ml-2 text-xs text-gray-500">(limited)</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    {editingLanguage === lang.id ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleSave(lang.id)}
                          disabled={saving === lang.id}
                          className="px-3 py-1 text-xs font-medium text-white dark:text-gray-900 bg-brand-500 hover:bg-brand-600 
                                     rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {saving === lang.id ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={() => {
                            setEditingLanguage(null);
                            setEditValue("");
                          }}
                          className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 
                                     hover:text-gray-900 dark:hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditing(lang)}
                        className="px-3 py-1 text-xs font-medium text-brand-600 dark:text-brand-400 
                                   hover:text-brand-700 dark:hover:text-brand-300"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">
          How it works
        </h3>
        <ul className="mt-2 text-sm text-blue-700 dark:text-blue-400 list-disc list-inside space-y-1">
          <li><strong>Numbers in DB</strong>: Total numbers available in your database for this language</li>
          <li><strong>Practice Limit</strong>: Optional maximum you can set to restrict the practice range</li>
          <li><strong>Effective Max</strong>: The actual maximum users will see (min of DB max and Practice Limit)</li>
          <li>Leave Practice Limit empty to allow users to practice all available numbers</li>
        </ul>
      </div>
    </div>
  );
}

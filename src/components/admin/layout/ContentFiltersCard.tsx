/**
 * ContentFiltersCard
 * Unified filters card shell for content management pages
 */

import React from 'react';
import { ChevronDown, ChevronUp, Funnel, X } from "lucide-react";

interface ContentFiltersCardProps {
  children: React.ReactNode;
  activeFilterCount?: number;
  onClearAll?: () => void;
  showAdvanced?: boolean;
  onToggleAdvanced?: () => void;
  advancedLabel?: string;
}

export function ContentFiltersCard({
  children,
  activeFilterCount = 0,
  onClearAll,
  showAdvanced = false,
  onToggleAdvanced,
  advancedLabel = 'Advanced',
}: ContentFiltersCardProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-theme-xs">
      <div className="border-b border-border bg-muted/40 px-5 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Filters</h3>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && onClearAll && (
              <button
                onClick={onClearAll}
                className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
              >
                <X className="h-3 w-3" />
                Clear all ({activeFilterCount})
              </button>
            )}
            {onToggleAdvanced && (
              <button
                onClick={onToggleAdvanced}
                className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
              >
                <Funnel className="h-3 w-3" />
                {advancedLabel}
                {showAdvanced ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

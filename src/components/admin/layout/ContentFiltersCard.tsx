/**
 * ContentFiltersCard
 * Unified filters card shell for content management pages
 */

import React from 'react';
import { FiFilter, FiX, FiChevronDown, FiChevronUp } from 'react-icons/fi';

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
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
      <div className="border-b border-gray-100 bg-gray-50/50 px-5 py-3 dark:border-white/[0.05] dark:bg-white/[0.02]">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Filters</h3>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && onClearAll && (
              <button
                onClick={onClearAll}
                className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
              >
                <FiX className="h-3 w-3" />
                Clear all ({activeFilterCount})
              </button>
            )}
            {onToggleAdvanced && (
              <button
                onClick={onToggleAdvanced}
                className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <FiFilter className="h-3 w-3" />
                {advancedLabel}
                {showAdvanced ? (
                  <FiChevronUp className="h-3 w-3" />
                ) : (
                  <FiChevronDown className="h-3 w-3" />
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

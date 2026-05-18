/**
 * ActiveFilterChips
 * Displays active filter chips with individual clear buttons
 */

import React from 'react';
import { FiX } from 'react-icons/fi';

interface FilterChip {
  label: string;
  onClear: () => void;
}

interface ActiveFilterChipsProps {
  filters: FilterChip[];
}

export function ActiveFilterChips({ filters }: ActiveFilterChipsProps) {
  if (filters.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4 dark:border-white/[0.05]">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Active:</span>
      {filters.map((filter, idx) => (
        <span
          key={idx}
          className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-400"
        >
          {filter.label}
          <button
            onClick={filter.onClear}
            className="hover:text-brand-900"
            aria-label={`Clear filter ${filter.label}`}
          >
            <FiX className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

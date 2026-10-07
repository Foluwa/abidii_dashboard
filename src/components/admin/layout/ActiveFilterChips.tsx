/**
 * ActiveFilterChips
 * Displays active filter chips with individual clear buttons
 */

import React from 'react';
import { X } from "lucide-react";

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
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
      <span className="text-xs font-medium text-muted-foreground">Active:</span>
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
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

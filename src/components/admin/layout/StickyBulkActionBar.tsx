/**
 * StickyBulkActionBar
 * Sticky action bar that appears when items are selected
 */

import React from 'react';
import { Trash2, Volume2, X } from "lucide-react";

export interface BulkAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'danger';
  icon?: React.ReactNode;
}

interface StickyBulkActionBarProps {
  selectedCount: number;
  onClear: () => void;
  actions: BulkAction[];
  itemName?: string;
}

export function StickyBulkActionBar({
  selectedCount,
  onClear,
  actions,
  itemName = 'item',
}: StickyBulkActionBarProps) {
  if (selectedCount === 0) return null;

  const itemLabel = selectedCount === 1 ? itemName : `${itemName}s`;

  return (
    <div className="sticky top-4 z-30 rounded-xl border border-border bg-white/95 p-4 shadow-lg backdrop-blur-sm dark:bg-gray-900/95">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">
          {selectedCount} {itemLabel} selected
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onClear}
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            Clear
          </button>
          {actions.map((action, idx) => {
            const isDanger = action.variant === 'danger';
            const baseClasses =
              'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-gray-900';
            const colorClasses = isDanger
              ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
              : 'bg-brand-600 text-white dark:text-gray-900 hover:bg-brand-700 focus:ring-brand-500';

            return (
              <button
                key={idx}
                onClick={action.onClick}
                disabled={action.disabled || action.loading}
                className={`${baseClasses} ${colorClasses}`}
              >
                {action.icon}
                {action.loading ? 'Loading...' : action.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

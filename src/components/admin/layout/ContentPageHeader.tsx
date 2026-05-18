/**
 * ContentPageHeader
 * Unified header for content management pages
 */

import React from 'react';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import { FiPlus } from 'react-icons/fi';

interface ContentPageHeaderProps {
  title: string;
  subtitle?: string;
  onAdd?: () => void;
  addLabel?: string;
  addDisabled?: boolean;
  children?: React.ReactNode; // e.g. selected count, extra header buttons
}

export function ContentPageHeader({
  title,
  subtitle,
  onAdd,
  addLabel = 'Add',
  addDisabled = false,
  children,
}: ContentPageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <PageBreadCrumb pageTitle={title} />
        {subtitle && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        {children}
        {onAdd && (
          <button
            onClick={onAdd}
            disabled={addDisabled}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-gray-900"
          >
            <FiPlus className="h-4 w-4" />
            {addLabel}
          </button>
        )}
      </div>
    </div>
  );
}

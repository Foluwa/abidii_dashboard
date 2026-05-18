/**
 * ContentStatsCard
 * Single stat card for content management pages
 */

import React from 'react';
import { IconType } from 'react-icons';

interface ContentStatsCardProps {
  label: string;
  value: string | number;
  icon: IconType;
  iconBgClass?: string;
  iconTextClass?: string;
}

export function ContentStatsCard({
  label,
  value,
  icon: Icon,
  iconBgClass = 'bg-brand-100 dark:bg-brand-900/20',
  iconTextClass = 'text-brand-600 dark:text-brand-400',
}: ContentStatsCardProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          </div>
          <div className={`flex h-12 w-12 items-center justify-center rounded-full ${iconBgClass}`}>
            <Icon className={`h-6 w-6 ${iconTextClass}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

interface ContentStatsGridProps {
  children: React.ReactNode;
  cols?: 2 | 3 | 4;
}

export function ContentStatsGrid({ children, cols = 4 }: ContentStatsGridProps) {
  const colClass =
    cols === 2
      ? 'sm:grid-cols-2'
      : cols === 3
      ? 'sm:grid-cols-2 lg:grid-cols-3'
      : 'sm:grid-cols-2 lg:grid-cols-4';

  return (
    <div className={`grid grid-cols-1 gap-4 ${colClass}`}>
      {children}
    </div>
  );
}

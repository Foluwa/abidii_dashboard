/**
 * Stat Card Component
 * Displays a metric with label, value, and optional trend
 */

import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  isLoading?: boolean;
}

export default function StatCard({ label, value, icon, trend, isLoading }: StatCardProps) {
  if (isLoading) {
    return (
      <div className="p-6 bg-card border border-border rounded-lg animate-pulse">
        <div className="h-4 bg-muted rounded w-24 mb-4"></div>
        <div className="h-8 bg-muted rounded w-32"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-card border border-border rounded-lg hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold text-foreground">
            {value}
          </p>
          
          {trend && (
            <div className="flex items-center mt-2">
              <span
                className={`text-sm font-medium ${
                  trend.isPositive
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
              <span className="ml-2 text-xs text-muted-foreground">
                vs last period
              </span>
            </div>
          )}
        </div>
        
        {icon && (
          <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-brand-50 dark:bg-brand-900/20">
            <div className="text-brand-600 dark:text-brand-400">
              {icon}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

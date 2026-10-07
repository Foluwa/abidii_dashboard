import React from 'react';
import { isLowSample } from '@/lib/formatAnalytics';

interface MetricCardProps {
  label: string;
  value: string;
  subtext?: string;
  tooltip?: string;
  sampleSize?: number;
}

/** One KPI card. `value` and `subtext` are pre-formatted by the caller
 * (formatAnalytics helpers) - this component only lays them out, it never
 * computes or reinterprets a rate itself. */
export default function MetricCard({ label, value, subtext, tooltip, sampleSize }: MetricCardProps) {
  const lowSample = sampleSize !== undefined && isLowSample(sampleSize);
  return (
    <div
      className="p-6 bg-card border border-border rounded-lg"
      title={tooltip}
    >
      <div className="flex items-center gap-1.5">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {tooltip && (
          <span
            aria-label={tooltip}
            title={tooltip}
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-input text-[10px] text-muted-foreground"
          >
            i
          </span>
        )}
      </div>
      <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
      {subtext && (
        <p className="mt-1 text-xs text-muted-foreground">
          {subtext}
          {lowSample && (
            <span className="ml-2 rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-medium text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300">
              Low sample (n={sampleSize})
            </span>
          )}
        </p>
      )}
    </div>
  );
}

'use client';

import React, { useMemo, useState } from 'react';

import Badge from '@/components/ui/badge/Badge';
import StatusBadge from '@/components/admin/StatusBadge';
import type { ValidationIssuePayload, ValidationResultPayload } from '@/types/curriculum';

type FilterTab = 'all' | 'errors' | 'warnings';

export default function ValidationResultViewer({
  validation,
  onJumpToPath,
}: {
  validation: ValidationResultPayload | null | undefined;
  onJumpToPath?: (path: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const { issues, errorsCount, warningsCount } = useMemo(() => {
    const errors = validation?.errors || [];
    const warnings = validation?.warnings || [];

    const all: ValidationIssuePayload[] = [...errors, ...warnings];

    const filtered =
      activeTab === 'errors'
        ? errors
        : activeTab === 'warnings'
        ? warnings
        : all;

    return {
      issues: filtered,
      errorsCount: errors.length,
      warningsCount: warnings.length,
    };
  }, [activeTab, validation]);

  const status = validation?.status || 'unknown';
  const unknownValidationTooltip =
    'Validation has not been run yet, validation metadata is stale, or the blueprint was promoted outside the normal validate/publish workflow.';
  const statusBadge =
    status === 'valid' ? (
      <StatusBadge status="success" label="Valid" />
    ) : status === 'invalid' ? (
      <StatusBadge status="error" label="Invalid" />
    ) : (
      <span title={unknownValidationTooltip}>
        <StatusBadge status="error" label="Unknown" />
      </span>
    );

  return (
    <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Validation</h3>
            {statusBadge}
            {validation?.can_publish ? (
              <Badge color="success" variant="solid" size="sm">
                Can publish
              </Badge>
            ) : (
              <Badge color="dark" variant="solid" size="sm">
                Cannot publish
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <span>
              Validated:{' '}
              <span className="text-gray-900 dark:text-white">
                {validation?.validated_at ? new Date(validation.validated_at).toLocaleString() : '—'}
              </span>
            </span>
            <span className="text-gray-300 dark:text-gray-700">|</span>
            <span>
              Errors:{' '}
              <span className="text-gray-900 dark:text-white">{validation?.blocking_error_count ?? errorsCount}</span>
            </span>
            <span className="text-gray-300 dark:text-gray-700">|</span>
            <span>
              Warnings:{' '}
              <span className="text-gray-900 dark:text-white">{validation?.warning_count ?? warningsCount}</span>
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-3 flex gap-4">
          {(
            [
              { key: 'all', label: `All (${errorsCount + warningsCount})` },
              { key: 'errors', label: `Errors (${errorsCount})` },
              { key: 'warnings', label: `Warnings (${warningsCount})` },
            ] as Array<{ key: FilterTab; label: string }>
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-2 px-3 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {!validation ? (
          <div className="text-sm text-gray-600 dark:text-gray-400">No validation data available.</div>
        ) : issues.length === 0 ? (
          <div className="text-sm text-gray-600 dark:text-gray-400">No issues in this view.</div>
        ) : (
          <div className="space-y-3">
            {issues.map((issue, idx) => (
              <div
                key={`${issue.code}-${issue.path}-${idx}`}
                className="p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        color={issue.severity === 'ERROR' ? 'error' : 'warning'}
                        variant="solid"
                        size="sm"
                      >
                        {issue.severity}
                      </Badge>
                      <span className="text-xs font-semibold text-gray-900 dark:text-white">{issue.code}</span>
                      <span className="text-xs text-gray-600 dark:text-gray-400 font-mono break-all">
                        {issue.path}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">{issue.message}</p>
                  </div>
                  {onJumpToPath && issue.path ? (
                    <button
                      type="button"
                      onClick={() => onJumpToPath(issue.path)}
                      className="shrink-0 rounded-lg border border-brand-300 bg-white px-3 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50 dark:border-brand-800 dark:bg-gray-900 dark:text-brand-300 dark:hover:bg-brand-950/30"
                    >
                      Edit field
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * GoogleSheetsBulkImport Component
 * Reusable component for importing content from Google Sheets
 * 
 * Usage:
 * <GoogleSheetsBulkImport
 *   contentType="phrases"
 *   onImportComplete={() => refreshData()}
 *   expectedColumns={[
 *     { name: 'language_id', required: true, description: 'UUID of the language' },
 *     { name: 'phrase', required: true, description: 'The phrase text' },
 *     // ... more columns
 *   ]}
 * />
 */

'use client';

import React, { useState } from 'react';
import { useToast } from '@/contexts/ToastContext';
import { apiClient } from '@/lib/api';

export interface ColumnDefinition {
  name: string;
  required: boolean;
  description: string;
  example?: string;
}

interface ValidationIssue {
  row_number: number;
  field?: string;
  message: string;
  severity: string;
}

interface ValidationResponse {
  valid: boolean;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  issues: ValidationIssue[];
  preview: any[];
}

interface Props {
  contentType: string;
  onImportComplete: () => void;
  expectedColumns: ColumnDefinition[];
  defaultLanguageId?: string;
}

export function GoogleSheetsBulkImport({
  contentType,
  onImportComplete,
  expectedColumns,
  defaultLanguageId,
}: Props) {
  const toast = useToast();
  const [sheetReference, setSheetReference] = useState('');
  const [worksheetTitle, setWorksheetTitle] = useState('');
  const [headerRow, setHeaderRow] = useState(1);
  const [languageId, setLanguageId] = useState(defaultLanguageId || '');
  
  const [validating, setValidating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [validation, setValidation] = useState<ValidationResponse | null>(null);
  const [showColumnInfo, setShowColumnInfo] = useState(false);

  const handleValidate = async () => {
    const trimmedReference = sheetReference.trim();
    const trimmedWorksheet = worksheetTitle.trim();

    if (!trimmedReference) {
      toast.error('Enter a Google Sheet URL or spreadsheet ID first.');
      return;
    }
    if (!trimmedWorksheet) {
      toast.error('Enter the worksheet title to import.');
      return;
    }

    setValidating(true);
    setValidation(null);
    try {
      const result = await apiClient.post<ValidationResponse>(
        `/api/v1/admin/bulk-import/${contentType}/validate`,
        {
          content_type: contentType,
          worksheet_title: trimmedWorksheet,
          header_row: headerRow,
          language_id: languageId || undefined,
          ...(trimmedReference.startsWith('http')
            ? { sheet_url: trimmedReference }
            : { spreadsheet_id: trimmedReference }),
        },
        { timeout: 120000 }
      );
      setValidation(result.data);
      if (result.data.valid) {
        toast.success(`Validation passed! ${result.data.valid_rows} rows ready to import.`);
      } else {
        toast.error(`Validation failed. ${result.data.invalid_rows} rows have errors.`);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.detail ?? error?.message ?? 'Validation failed');
      setValidation(null);
    } finally {
      setValidating(false);
    }
  };

  const handleApply = async () => {
    if (!validation || !validation.valid) {
      toast.error('Please validate first and fix all errors.');
      return;
    }

    const trimmedReference = sheetReference.trim();
    const trimmedWorksheet = worksheetTitle.trim();

    setApplying(true);
    try {
      const result = await apiClient.post(
        `/api/v1/admin/bulk-import/${contentType}/apply`,
        {
          content_type: contentType,
          worksheet_title: trimmedWorksheet,
          header_row: headerRow,
          language_id: languageId || undefined,
          ...(trimmedReference.startsWith('http')
            ? { sheet_url: trimmedReference }
            : { spreadsheet_id: trimmedReference }),
        },
        { timeout: 300000 }
      );
      toast.success(`Import complete! ${result.data.created_count} ${contentType} created.`);
      setValidation(null);
      setSheetReference('');
      setWorksheetTitle('');
      onImportComplete();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail ?? error?.message ?? 'Import failed');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Bulk Import from Google Sheets
        </h2>
        <button
          type="button"
          onClick={() => setShowColumnInfo(!showColumnInfo)}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {showColumnInfo ? 'Hide' : 'Show'} expected columns
        </button>
      </div>

      {showColumnInfo && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Expected columns in your Google Sheet:
          </p>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            {expectedColumns.map((col) => (
              <li key={col.name}>
                <span className="font-mono text-xs bg-gray-200 dark:bg-gray-600 px-1 rounded">
                  {col.name}
                </span>
                {col.required && (
                  <span className="text-red-600 dark:text-red-400 ml-1">*required</span>
                )}
                : {col.description}
                {col.example && (
                  <span className="text-gray-500 dark:text-gray-500 ml-1">
                    (e.g., {col.example})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Google Sheet URL or Spreadsheet ID
          </label>
          <input
            type="text"
            value={sheetReference}
            onChange={(e) => setSheetReference(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/... or just the ID"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Worksheet Title
            </label>
            <input
              type="text"
              value={worksheetTitle}
              onChange={(e) => setWorksheetTitle(e.target.value)}
              placeholder="e.g., phrases, sentences"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Header Row
            </label>
            <input
              type="number"
              value={headerRow}
              onChange={(e) => setHeaderRow(Number(e.target.value))}
              min={1}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleValidate}
            disabled={validating || applying}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {validating ? 'Validating...' : 'Validate'}
          </button>

          {validation && validation.valid && (
            <button
              type="button"
              onClick={handleApply}
              disabled={applying || validating}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {applying ? 'Importing...' : `Import ${validation.valid_rows} rows`}
            </button>
          )}
        </div>
      </div>

      {validation && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Validation Results
            </h3>
            <div className="flex gap-3 text-sm">
              <span className="text-green-600 dark:text-green-400">
                ✓ {validation.valid_rows} valid
              </span>
              {validation.invalid_rows > 0 && (
                <span className="text-red-600 dark:text-red-400">
                  ✗ {validation.invalid_rows} invalid
                </span>
              )}
            </div>
          </div>

          {validation.issues.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-3">
              <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
                Errors found:
              </p>
              <ul className="text-sm text-red-700 dark:text-red-400 space-y-1 max-h-60 overflow-y-auto">
                {validation.issues.slice(0, 20).map((issue, idx) => (
                  <li key={idx}>
                    Row {issue.row_number}
                    {issue.field && ` (${issue.field})`}: {issue.message}
                  </li>
                ))}
                {validation.issues.length > 20 && (
                  <li className="text-gray-600 dark:text-gray-400">
                    + {validation.issues.length - 20} more errors...
                  </li>
                )}
              </ul>
            </div>
          )}

          {validation.preview.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Preview (first {validation.preview.length} rows):
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-600">
                      {Object.keys(validation.preview[0] || {}).map((key) => (
                        <th
                          key={key}
                          className="px-2 py-1 text-left text-gray-700 dark:text-gray-300"
                        >
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {validation.preview.map((row, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-gray-200 dark:border-gray-600"
                      >
                        {Object.values(row).map((val: any, colIdx) => (
                          <td
                            key={colIdx}
                            className="px-2 py-1 text-gray-600 dark:text-gray-400"
                          >
                            {String(val).substring(0, 50)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

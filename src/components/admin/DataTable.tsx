/**
 * Advanced DataTable Component
 * Enhanced table with sorting, filtering, pagination, and actions
 */

import React, { useState } from 'react';
import { TableColumn, SortConfig } from '@/types/common';

interface DataTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  onRowClick?: (item: T) => void;
  actions?: (item: T) => React.ReactNode;
  loading?: boolean;
  emptyMessage?: string;
  hoverable?: boolean;
  selectedIds?: string[];
  onSelect?: (id: string) => void;
  onSelectAll?: () => void;
}

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyExtractor,
  onSort,
  onRowClick,
  actions,
  loading = false,
  emptyMessage = 'No data available',
  hoverable = true,
  selectedIds,
  onSelect,
  onSelectAll,
}: DataTableProps<T>) {
  const allSelected = data.length > 0 && data.every((item) => selectedIds?.includes(keyExtractor(item)));
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  const handleSort = (key: string) => {
    if (!onSort) return;

    let direction: 'asc' | 'desc' = 'asc';
    
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }

    setSortConfig({ key, direction });
    onSort(key, direction);
  };

  const getSortIcon = (columnKey: string) => {
    if (!sortConfig || sortConfig.key !== columnKey) {
      return (
        <svg className="w-4 h-4 ml-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }

    if (sortConfig.direction === 'asc') {
      return (
        <svg className="w-4 h-4 ml-1 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      );
    }

    return (
      <svg className="w-4 h-4 ml-1 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
        <svg className="w-16 h-16 mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-lg font-medium">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
    {/* Desktop Table View */}
    <div className="hidden lg:block overflow-hidden border border-gray-200 rounded-lg dark:border-gray-800">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              {selectedIds !== undefined && (
                <th scope="col" className="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onSelectAll}
                    className="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  scope="col"
                  className={`px-6 py-3 text-${column.align || 'left'} text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400`}
                  style={{ width: column.width }}
                >
                  {column.sortable ? (
                    <button
                      onClick={() => handleSort(String(column.key))}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none"
                    >
                      {column.label}
                      {getSortIcon(String(column.key))}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
              {actions && (
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-800">
            {data.map((item) => {
              const itemId = keyExtractor(item);
              const isSelected = selectedIds?.includes(itemId) ?? false;
              return (
              <tr
                key={itemId}
                onClick={() => onRowClick?.(item)}
                className={`
                  ${hoverable ? 'hover:bg-gray-50 dark:hover:bg-gray-800/50' : ''}
                  ${onRowClick ? 'cursor-pointer' : ''}
                  transition-colors
                `}
              >
                {selectedIds !== undefined && (
                  <td className="px-4 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onSelect?.(itemId)}
                      className="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700"
                    />
                  </td>
                )}
                {columns.map((column) => {
                  const value = item[column.key as keyof T];
                  return (
                    <td
                      key={String(column.key)}
                      className={`px-6 py-4 whitespace-nowrap text-sm text-${column.align || 'left'}`}
                    >
                      {column.render ? (
                        <div className="text-gray-900 dark:text-gray-100">
                          {column.render(value, item)}
                        </div>
                      ) : (
                        <span className="text-gray-900 dark:text-gray-100">
                          {value !== null && value !== undefined ? String(value) : '-'}
                        </span>
                      )}
                    </td>
                  );
                })}
                {actions && (
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2" onClick={(e) => e.stopPropagation()}>
                      {actions(item)}
                    </div>
                  </td>
                )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>

    {/* Mobile Grid View */}
    <div className="lg:hidden grid grid-cols-1 gap-4">
      {loading ? (
        <div className="flex items-center justify-center py-12 rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400 rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <svg className="w-16 h-16 mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-lg font-medium">{emptyMessage}</p>
        </div>
      ) : (
        data.map((item) => {
          const itemId = keyExtractor(item);
          const isSelected = selectedIds?.includes(itemId) ?? false;
          return (
          <div
            key={itemId}
            onClick={() => onRowClick?.(item)}
            className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 ${
              onRowClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50' : ''
            }`}
          >
            {selectedIds !== undefined && (
              <div className="flex items-center mb-3 pb-3 border-b border-gray-200 dark:border-gray-800">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    e.stopPropagation();
                    onSelect?.(itemId);
                  }}
                  className="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700"
                />
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">Select</span>
              </div>
            )}
            {columns.map((column) => {
              const value = item[column.key as keyof T];
              return (
                <div key={String(column.key)} className="mb-3 last:mb-0">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                    {column.label}
                  </div>
                  <div className="text-sm text-gray-900 dark:text-gray-100">
                    {column.render ? (
                      column.render(value, item)
                    ) : (
                      <span>{value !== null && value !== undefined ? String(value) : '-'}</span>
                    )}
                  </div>
                </div>
              );
            })}
            {actions && (
              <div className="flex items-center gap-2 border-t border-gray-200 dark:border-gray-800 pt-3 mt-3">
                {actions(item)}
              </div>
            )}
          </div>
          );
        })
      )}
    </div>
    </>
  );
}

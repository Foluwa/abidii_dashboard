'use client';

import React, { useState } from 'react';

import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import Pagination from '@/components/tables/Pagination';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useContentSafetySummary, useFlaggedWords } from '@/hooks/useApi';
import { apiClient } from '@/lib/api';

const CATEGORY_OPTIONS = [
  { label: 'All categories', value: '' },
  { label: 'Sexual', value: 'sexual' },
  { label: 'Profanity', value: 'profanity' },
  { label: 'Violence', value: 'violence' },
  { label: 'Crime', value: 'crime' },
  { label: 'Drugs', value: 'drugs' },
  { label: 'Self-harm', value: 'self_harm' },
  { label: 'Hate', value: 'hate' },
];

const th = 'px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300';
const td = 'px-4 py-3 text-sm text-gray-800 dark:text-gray-200 align-top';

/**
 * Words flagged as not safe for children (backend migration 195). Flagged
 * words are hidden from every learner-facing surface. Admins can unflag a
 * false positive or start a classification run for unchecked words.
 */
export function ContentSafetyContent({ showHeader = true, isActive = true }: { showHeader?: boolean; isActive?: boolean }) {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const limit = 50;

  const summary = useContentSafetySummary();
  const { data, isLoading, isError, refresh } = useFlaggedWords({
    page,
    limit,
    category: category || undefined,
  });
  const items = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / limit));

  const unflag = async (id: string, lemma: string) => {
    try {
      await apiClient.patch(`/api/v1/admin/content-safety/lemmas/${id}`, { is_sensitive: false });
      toast.success(`"${lemma}" is visible to learners again`);
      refresh();
      summary.refresh();
    } catch {
      toast.error(`Could not update "${lemma}"`);
    }
  };

  const runClassification = async () => {
    try {
      await apiClient.post('/api/v1/admin/content-safety/classify', { limit: 200000 });
      toast.success('Classification started. Refresh in a few minutes.');
      summary.refresh();
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      toast.error(status === 409 ? 'A run is already in progress' : 'Could not start classification');
    }
  };

  const s = summary.data;

  return (
    <>
      {showHeader && <PageBreadCrumb pageTitle="Content Safety" />}

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            ['Words', s?.total],
            ['Checked', s?.checked],
            ['Not yet checked', s?.unchecked],
            ['Hidden from learners', s?.flagged],
          ].map(([label, value]) => (
            <div
              key={label as string}
              className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
            >
              <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                {value === undefined ? '…' : Number(value).toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="w-60">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">Category</label>
            <div className="mt-1">
              <StyledSelect
                options={CATEGORY_OPTIONS}
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={runClassification}
              disabled={s?.classification_running}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white dark:text-gray-900 hover:bg-brand-600 disabled:opacity-50"
            >
              {s?.classification_running ? 'Classification running…' : 'Classify unchecked words'}
            </button>
          )}
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800" role="table">
            <thead className="bg-gray-50 dark:bg-gray-800/40">
              <tr>
                <th className={th}>Word</th>
                <th className={th}>Meaning</th>
                <th className={th}>Category</th>
                <th className={th}>Why</th>
                <th className={th}>Flagged by</th>
                {isAdmin && <th className={th}>Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {isLoading && (
                <tr><td className={td} colSpan={6}>Loading…</td></tr>
              )}
              {isError && (
                <tr><td className={td} colSpan={6}>Failed to load flagged words.</td></tr>
              )}
              {!isLoading && !isError && items.length === 0 && (
                <tr><td className={td} colSpan={6}>No flagged words.</td></tr>
              )}
              {items.map((w) => (
                <tr key={w.id}>
                  <td className={`${td} font-medium`}>{w.lemma}</td>
                  <td className={td}>{w.meanings || '—'}</td>
                  <td className={td}>{w.category ?? '—'}</td>
                  <td className={td}>{w.reason ?? '—'}</td>
                  <td className={td}>{w.source === 'admin' ? 'Admin' : 'AI'}</td>
                  {isAdmin && (
                    <td className={td}>
                      <button
                        type="button"
                        onClick={() => unflag(w.id, w.lemma)}
                        className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                      >
                        Unflag
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-4">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={(p) => setPage(p)} />
          </div>
        </div>
      </div>
    </>
  );
}

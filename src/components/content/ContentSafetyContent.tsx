'use client';

import React, { useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';

import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import Pagination from '@/components/tables/Pagination';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import { ConfirmationModal } from '@/components/ui/modal/ConfirmationModal';
import {
  HiddenFromLearnersBadge,
  WordSafetyActionButton,
  WordSafetyDialog,
  type WordSafetyTarget,
} from '@/components/content/WordSafetyDialog';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  useContentSafetySearch,
  useContentSafetySummary,
  useFlaggedWords,
  type WordSafetyStatus,
} from '@/hooks/useApi';
import { useDebounce } from '@/hooks/useDebounce';
import { SENSITIVE_CATEGORIES, categoryLabel, startClassification } from '@/lib/contentSafetyApi';

const CATEGORY_OPTIONS = [
  { label: 'All categories', value: '' },
  ...SENSITIVE_CATEGORIES.map((c) => ({ label: c.label, value: c.value })),
];

const STATUS_OPTIONS: { label: string; value: WordSafetyStatus }[] = [
  { label: 'Any status', value: 'all' },
  { label: 'Hidden', value: 'flagged' },
  { label: 'Visible (checked)', value: 'safe' },
  { label: 'Not yet checked', value: 'unchecked' },
];

const th = 'px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300';
const td = 'px-4 py-3 text-sm text-gray-800 dark:text-gray-200 align-top';

function flaggedBy(source: string | null | undefined) {
  if (source === 'admin') return 'Admin';
  if (source) return 'AI';
  return '—';
}

/**
 * Words flagged as not safe for children (backend migration 195). Flagged
 * words are hidden from every learner-facing surface. Anyone with dashboard
 * access can search any word and see its status; only admins can hide or
 * unhide a word, or start an AI check run. New words are also checked
 * automatically every night by the backend worker.
 */
export function ContentSafetyContent({ showHeader = true, isActive = true }: { showHeader?: boolean; isActive?: boolean }) {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const limit = 50;

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<WordSafetyStatus>('all');
  const [searchPage, setSearchPage] = useState(1);
  const searchLimit = 25;
  const debouncedQuery = useDebounce(query, 300);

  const [dialogWord, setDialogWord] = useState<WordSafetyTarget | null>(null);
  const [confirmRecheck, setConfirmRecheck] = useState(false);

  const summary = useContentSafetySummary();
  const { data, isLoading, isError, refresh } = useFlaggedWords({
    page,
    limit,
    category: category || undefined,
  });
  const search = useContentSafetySearch({ q: debouncedQuery, status, page: searchPage, limit: searchLimit });

  const items = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / limit));
  const results = search.data?.items ?? [];
  const searchPages = Math.max(1, Math.ceil((search.data?.total ?? 0) / searchLimit));

  const refreshAll = () => {
    refresh();
    summary.refresh();
    search.refresh();
  };

  const runClassification = async (recheckClassifierSafe: boolean) => {
    try {
      await startClassification({ recheckClassifierSafe });
      toast.success(
        recheckClassifierSafe
          ? 'Re-check started for unchecked and AI-cleared words. Refresh in a few minutes.'
          : 'Classification started. Refresh in a few minutes.',
      );
      summary.refresh();
    } catch (e: unknown) {
      const code = (e as { response?: { status?: number } })?.response?.status;
      toast.error(
        code === 409
          ? 'A run is already in progress'
          : code === 503
            ? 'The AI check is not configured on the server (OPENAI_API_KEY)'
            : 'Could not start classification',
      );
    }
  };

  const s = summary.data;
  const running = !!s?.classification_running;

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
              className="rounded-xl border border-border bg-card p-4"
            >
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {value === undefined ? '…' : Number(value).toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        {/* Find any word (not only flagged ones) to hide or unhide it. */}
        <section className="rounded-xl border border-border bg-card" aria-labelledby="find-word-heading">
          <div className="space-y-3 border-b border-border p-5">
            <div>
              <h2 id="find-word-heading" className="text-base font-semibold text-foreground">Find a word</h2>
              <p className="text-sm text-muted-foreground">
                Search by English word or Yoruba translation. Tone marks are optional: &quot;oko&quot; finds &quot;okó&quot;.
                {!isAdmin && ' Only admins can hide or unhide words.'}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="relative min-w-0 flex-1 basis-64">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <SearchIcon className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSearchPage(1);
                  }}
                  placeholder="e.g. penis or oko"
                  aria-label="Search words"
                  className="block w-full rounded-lg border border-input bg-card py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
              <div className="w-52">
                <StyledSelect
                  options={STATUS_OPTIONS}
                  value={status}
                  aria-label="Status"
                  onValueChange={(v) => {
                    setStatus(v as WordSafetyStatus);
                    setSearchPage(1);
                  }}
                />
              </div>
            </div>
          </div>

          {debouncedQuery.trim() ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border" role="table" aria-label="Search results">
                <thead className="border-b">
                  <tr>
                    <th className={th}>Word</th>
                    <th className={th}>Meaning</th>
                    <th className={th}>Status</th>
                    <th className={th}>Decided by</th>
                    {isAdmin && <th className={th}>Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {search.isLoading && (
                    <tr><td className={td} colSpan={5}>Searching…</td></tr>
                  )}
                  {search.isError && (
                    <tr><td className={td} colSpan={5}>Search failed.</td></tr>
                  )}
                  {!search.isLoading && !search.isError && results.length === 0 && (
                    <tr><td className={td} colSpan={5}>No words match &quot;{debouncedQuery.trim()}&quot;.</td></tr>
                  )}
                  {results.map((w) => {
                    const yoruba = w.yoruba.join(', ');
                    return (
                      <tr key={w.id} data-testid={`search-row-${w.id}`}>
                        <td className={td}>
                          <div className="font-medium">{yoruba || <span className="italic text-muted-foreground">No Yoruba</span>}</div>
                          <div className="text-xs text-muted-foreground">{w.lemma}{w.pos ? ` · ${w.pos}` : ''}</div>
                        </td>
                        <td className={td}>{w.meanings || '—'}</td>
                        <td className={td}>
                          {w.is_sensitive ? (
                            <>
                              <HiddenFromLearnersBadge category={w.category} />
                              {w.reason ? <div className="mt-1 text-xs text-muted-foreground">{w.reason}</div> : null}
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {w.checked_at ? 'Visible' : 'Visible · not yet checked'}
                            </span>
                          )}
                        </td>
                        <td className={td}>{w.checked_at ? flaggedBy(w.source) : '—'}</td>
                        {isAdmin && (
                          <td className={td}>
                            <WordSafetyActionButton
                              word={w}
                              onClick={() =>
                                setDialogWord({
                                  id: w.id,
                                  lemma: w.lemma,
                                  yoruba: yoruba || null,
                                  is_sensitive: w.is_sensitive,
                                  category: w.category,
                                  reason: w.reason,
                                  source: w.source,
                                })
                              }
                            />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {searchPages > 1 && (
                <div className="p-4">
                  <Pagination currentPage={searchPage} totalPages={searchPages} onPageChange={(p) => setSearchPage(p)} />
                </div>
              )}
            </div>
          ) : null}
        </section>

        <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-border bg-card p-5">
          <div className="w-60">
            <label className="block text-xs font-medium text-muted-foreground">Category</label>
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
          <div className="flex flex-col items-end gap-2">
            {isAdmin && (
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmRecheck(true)}
                  disabled={running}
                  className="rounded-lg border border-input px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
                >
                  Re-check AI-cleared words
                </button>
                <button
                  type="button"
                  onClick={() => runClassification(false)}
                  disabled={running}
                  className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-brand-600 disabled:opacity-50"
                >
                  {running ? 'Classification running…' : 'Classify unchecked words'}
                </button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">New words are checked automatically every night.</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="min-w-full divide-y divide-border" role="table" aria-label="Hidden words">
            <thead className="border-b">
              <tr>
                <th className={th}>Word</th>
                <th className={th}>Meaning</th>
                <th className={th}>Category</th>
                <th className={th}>Why</th>
                <th className={th}>Flagged by</th>
                {isAdmin && <th className={th}>Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
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
                  <td className={td}>{categoryLabel(w.category)}</td>
                  <td className={td}>{w.reason ?? '—'}</td>
                  <td className={td}>{flaggedBy(w.source)}</td>
                  {isAdmin && (
                    <td className={td}>
                      <WordSafetyActionButton
                        word={{ is_sensitive: true, lemma: w.lemma }}
                        onClick={() =>
                          setDialogWord({
                            id: w.id,
                            lemma: w.lemma,
                            is_sensitive: true,
                            category: w.category,
                            reason: w.reason,
                            source: w.source,
                          })
                        }
                      />
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

      {isAdmin && (
        <WordSafetyDialog word={dialogWord} onClose={() => setDialogWord(null)} onSaved={refreshAll} />
      )}

      <ConfirmationModal
        isOpen={confirmRecheck}
        onClose={() => setConfirmRecheck(false)}
        onConfirm={() => {
          setConfirmRecheck(false);
          runClassification(true);
        }}
        title="Re-check AI-cleared words"
        message="Ask the AI again about every word it previously judged safe (plus unchecked words). Words an admin decided, and words already hidden, are not touched. This calls OpenAI for every such word."
        confirmText="Start re-check"
        cancelText="Cancel"
        variant="warning"
      />
    </>
  );
}

'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { ApexOptions } from 'apexcharts';

import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import Pagination from '@/components/tables/Pagination';
import StatusBadge from '@/components/admin/StatusBadge';
import DatePicker from '@/components/form/date-picker';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import { useLanguages } from '@/hooks/useApi';
import { useToast } from '@/contexts/ToastContext';
import {
  listDailyContentFeed,
  getAudienceTrend,
  listTeaserQuizFeed,
  getTeaserQuizStats,
  getDailyContentOpenRateBreakdown,
  overrideDailyWord,
  getNotificationSchedule,
  updateNotificationSchedule,
  searchDictionary,
  getDailyContentPreview,
} from '@/lib/notificationsApi';
import { apiClient } from '@/lib/api';
import type {
  DailyContentFeedItem,
  AudienceSnapshotItem,
  TeaserQuizFeedItem,
  TeaserQuizStats,
  NotificationSchedule,
  DictionarySearchResult,
  OpenRateBreakdownItem,
  OpenRateDimension,
  DailyContentPreviewItem,
} from '@/types/notifications';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function openRate(item: DailyContentFeedItem): number {
  if (item.sent_count === 0) return 0;
  return Math.round((item.open_count / item.sent_count) * 100);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// A row is "scheduled" (not yet sent) if it's dated in the future, or
// dated today but the job hasn't run yet — either way sent_count is 0
// so far. Once sent_count > 0 it's a real send, even if it happens to
// still be "today."
function isUpcoming(item: DailyContentFeedItem): boolean {
  return item.content_date >= todayIso() && item.sent_count === 0;
}

// ---------------------------------------------------------------------------
// Granular open-rate breakdown charts (country / fluency / device / premium)
// ---------------------------------------------------------------------------

const BREAKDOWN_DIMENSIONS: { key: OpenRateDimension; label: string }[] = [
  { key: 'country', label: 'By Country' },
  { key: 'fluency', label: 'By Fluency' },
  { key: 'device', label: 'By Device' },
  { key: 'premium', label: 'Premium vs Free' },
];

function BreakdownChart({ dimension, label }: { dimension: OpenRateDimension; label: string }) {
  const [items, setItems] = useState<OpenRateBreakdownItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    // `dimension` is fixed for the lifetime of a given BreakdownChart
    // instance (the parent renders one per dimension with a stable `key`,
    // so a change would unmount/remount rather than update in place) - the
    // initial `loading: true` / `error: false` state values already cover
    // the one real run, so state is only ever touched from the async
    // callbacks below, not synchronously in the effect body.
    let cancelled = false;
    getDailyContentOpenRateBreakdown({ dimension, days: 30 })
      .then((data) => {
        if (!cancelled) {
          setItems(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [dimension]);

  // Top 8 groups by volume keeps a "by country" chart legible instead of
  // rendering a bar for every country that's ever received one notification.
  const topItems = useMemo(() => items.slice(0, 8), [items]);

  const options: ApexOptions = {
    chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'Outfit, sans-serif' },
    plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '55%' } },
    colors: ['#465FFF'],
    dataLabels: { enabled: true, formatter: (val) => `${val}%`, style: { colors: ['#fff'] } },
    xaxis: {
      categories: topItems.map((i) => i.group_label),
      max: 100,
      labels: { formatter: (val) => `${val}%` },
    },
    grid: { xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } },
    tooltip: {
      y: {
        formatter: (val, opts) => {
          const item = topItems[opts.dataPointIndex];
          return item ? `${val}% (${item.open_count}/${item.sent_count})` : `${val}%`;
        },
      },
    },
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{label}</h3>
      {loading ? (
        <div className="flex h-48 items-center justify-center text-sm text-gray-400">Loading…</div>
      ) : error ? (
        <div className="flex h-48 items-center justify-center text-sm text-red-500">Failed to load.</div>
      ) : topItems.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-gray-400">No data yet.</div>
      ) : (
        <ReactApexChart
          options={options}
          series={[{ name: 'Open rate', data: topItems.map((i) => i.open_rate) }]}
          type="bar"
          height={Math.max(180, topItems.length * 36)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Users-without-a-push-token stat card
// ---------------------------------------------------------------------------

function NoPushTokenStat() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get('/api/v1/admin/users', { params: { has_push_token: false, limit: 1 } })
      .then((res) => {
        if (!cancelled) setCount(res.data?.total ?? null);
      })
      .catch(() => {
        if (!cancelled) setCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
        No Push Token
      </div>
      <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
        {count === null ? '—' : count.toLocaleString()}
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Proxy for &quot;never granted / revoked notification permission&quot; — the app doesn&apos;t
        report real OS permission state, this is just &quot;no active token on file.&quot;{' '}
        <Link href="/users?has_push_token=false" className="text-brand-600 hover:underline dark:text-brand-400">
          View users
        </Link>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Daily Content tab
// ---------------------------------------------------------------------------

function DailyContentTab({
  feed,
  loading,
  onRefresh,
}: {
  feed: DailyContentFeedItem[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [page, setPage] = useState(1);
  const [languageFilter, setLanguageFilter] = useState('all');
  const limit = 25;

  const languageOptions = useMemo(() => {
    const codes = Array.from(new Set(feed.map((f) => f.language_code))).sort();
    return ['all', ...codes];
  }, [feed]);

  const filtered = useMemo(
    () => (languageFilter === 'all' ? feed : feed.filter((f) => f.language_code === languageFilter)),
    [feed, languageFilter]
  );

  // Reset to page 1 when the filter changes - adjusted during render (React's
  // documented pattern for this) rather than in an effect, so there's no
  // extra render showing page 2 of a now-different filtered list first.
  const [prevLanguageFilter, setPrevLanguageFilter] = useState(languageFilter);
  if (languageFilter !== prevLanguageFilter) {
    setPrevLanguageFilter(languageFilter);
    setPage(1);
  }

  const totalDays = filtered.length;
  const totalSent = filtered.reduce((sum, item) => sum + item.sent_count, 0);
  const totalOpens = filtered.reduce((sum, item) => sum + item.open_count, 0);
  const overallOpenRate = totalSent > 0 ? Math.round((totalOpens / totalSent) * 100) : 0;

  const totalPages = Math.max(1, Math.ceil(totalDays / limit));
  const pageItems = useMemo(() => filtered.slice((page - 1) * limit, page * limit), [filtered, page]);
  const pageStart = totalDays === 0 ? 0 : (page - 1) * limit + 1;
  const pageEnd = totalDays === 0 ? 0 : Math.min(page * limit, totalDays);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Days Sent</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{totalDays.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Total Recipients</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{totalSent.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Total Opens</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{totalOpens.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Open Rate</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{overallOpenRate}%</div>
        </div>
      </div>

      {/* Granular open-rate breakdowns — last 30 days, existing tables only */}
      <div className="grid gap-4 lg:grid-cols-2">
        {BREAKDOWN_DIMENSIONS.map((d) => (
          <BreakdownChart key={d.key} dimension={d.key} label={d.label} />
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Daily Content Feed</h2>
          <div className="flex items-center gap-2">
            <div className="w-40">
              <StyledSelect
                value={languageFilter}
                onChange={(e) => setLanguageFilter(e.target.value)}
                options={languageOptions.map((code) => ({
                  value: code,
                  label: code === 'all' ? 'All languages' : code,
                }))}
                fullWidth
              />
            </div>
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-800 hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Content</th>
                <th className="px-3 py-3">Language</th>
                <th className="px-3 py-3 text-right">Recipients</th>
                <th className="px-3 py-3 text-right">Android</th>
                <th className="px-3 py-3 text-right">iOS</th>
                <th className="px-3 py-3 text-right">Failed</th>
                <th className="px-3 py-3 text-right">Opens</th>
                <th className="px-3 py-3 text-right">Open Rate</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
                    No daily content sent yet.
                  </td>
                </tr>
              ) : (
                pageItems.map((item) => (
                  <tr key={item.content_log_id} className="border-b border-gray-100 align-top dark:border-gray-800">
                    <td className="px-3 py-3">
                      {isUpcoming(item) ? (
                        <StatusBadge status="pending" label="Scheduled" />
                      ) : (
                        <StatusBadge status="success" label="Sent" />
                      )}
                    </td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{formatDate(item.content_date)}</td>
                    <td className="px-3 py-3 capitalize text-gray-700 dark:text-gray-300">{item.content_type}</td>
                    <td className="px-3 py-3 font-medium text-gray-900 dark:text-white">{item.content_text || '—'}</td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{item.language_code}</td>
                    <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">{item.sent_count.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">{item.android_sent.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">{item.ios_sent.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">{item.failed_count.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">{item.open_count.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">{openRate(item)}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {pageStart} to {pageEnd} of {totalDays} entries
          </p>
          <div className="ml-auto">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Teaser Quiz tab
// ---------------------------------------------------------------------------

function TeaserQuizTab({ stats }: { stats: TeaserQuizStats | null }) {
  const [feedItems, setFeedItems] = useState<TeaserQuizFeedItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [languageFilter, setLanguageFilter] = useState('all');
  const { languages } = useLanguages();
  const limit = 25;

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTeaserQuizFeed({
        limit,
        offset: (page - 1) * limit,
        language_code: languageFilter === 'all' ? undefined : languageFilter,
      });
      setFeedItems(res.items);
      setTotal(res.total);
    } catch {
      setFeedItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, languageFilter]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  // Same render-time reset pattern as DailyContentTab above.
  const [prevLanguageFilter, setPrevLanguageFilter] = useState(languageFilter);
  if (languageFilter !== prevLanguageFilter) {
    setPrevLanguageFilter(languageFilter);
    setPage(1);
  }

  const teaserCorrectRate =
    stats && stats.total_answered > 0 ? Math.round((stats.total_correct / stats.total_answered) * 100) : 0;
  const teaserOpenRate =
    stats && stats.total_sent > 0 ? Math.round((stats.total_opened / stats.total_sent) * 100) : 0;

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Quizzes Sent (30d)</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{(stats?.total_sent ?? 0).toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Open Rate</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{teaserOpenRate}%</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Answered</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{(stats?.total_answered ?? 0).toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Correct Rate</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{teaserCorrectRate}%</div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Teaser Quiz Feed</h2>
          <div className="w-40">
            <StyledSelect
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value)}
              options={[
                { value: 'all', label: 'All languages' },
                ...(languages ?? []).map((lang: { iso_639_3: string; name: string }) => ({
                  value: lang.iso_639_3,
                  label: lang.name,
                })),
              ]}
              fullWidth
            />
          </div>
        </div>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Most recent first. A low correct rate or a confusing prompt here is worth investigating before more users see it.
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                <th className="px-3 py-3">Sent</th>
                <th className="px-3 py-3">Word</th>
                <th className="px-3 py-3">Question</th>
                <th className="px-3 py-3">Language</th>
                <th className="px-3 py-3">Opened</th>
                <th className="px-3 py-3">Answered</th>
                <th className="px-3 py-3 text-right">XP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : feedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
                    No teaser quizzes sent yet.
                  </td>
                </tr>
              ) : (
                feedItems.map((item) => (
                  <tr key={item.quiz_log_id} className="border-b border-gray-100 align-top dark:border-gray-800">
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{formatDateTime(item.sent_at)}</td>
                    <td className="px-3 py-3 font-medium text-gray-900 dark:text-white">{item.word_text}</td>
                    <td className="max-w-[280px] truncate px-3 py-2 text-gray-700 dark:text-gray-300">{item.prompt_text}</td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{item.language_code}</td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{item.opened_at ? '✅' : '—'}</td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                      {item.was_correct === null ? '—' : item.was_correct ? '✅ Correct' : '❌ Incorrect'}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">{item.xp_awarded}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {total === 0 ? 0 : (page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} entries
          </p>
          <div className="ml-auto">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DailyContentNotificationsPage() {
  const toast = useToast();
  const { languages } = useLanguages();
  const [feed, setFeed] = useState<DailyContentFeedItem[]>([]);
  const [trend, setTrend] = useState<AudienceSnapshotItem[]>([]);
  const [preview, setPreview] = useState<DailyContentPreviewItem[]>([]);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'daily' | 'teaser'>('daily');
  const overrideSectionRef = useRef<HTMLDivElement | null>(null);

  const [teaserStats, setTeaserStats] = useState<TeaserQuizStats | null>(null);

  // Schedule settings section
  const [schedule, setSchedule] = useState<NotificationSchedule | null>(null);
  const [dailyWordTime, setDailyWordTime] = useState('08:00');
  const [teaserQuizTime, setTeaserQuizTime] = useState('14:30');
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Daily word override section
  const [overrideDate, setOverrideDate] = useState(todayIso());
  const [overrideLanguage, setOverrideLanguage] = useState('yor');
  const [wordQuery, setWordQuery] = useState('');
  const [wordResults, setWordResults] = useState<DictionarySearchResult[]>([]);
  const [selectedWord, setSelectedWord] = useState<DictionarySearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [savingOverride, setSavingOverride] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [feedItems, trendItems, teaserStatsItem, scheduleItem] = await Promise.all([
        listDailyContentFeed({ limit: 200, offset: 0 }),
        getAudienceTrend({ days: 30 }),
        getTeaserQuizStats({ days: 30 }),
        getNotificationSchedule(),
      ]);
      setFeed(feedItems);
      // Trend comes back most-recent-first; charts read left-to-right.
      setTrend([...trendItems].reverse());
      setTeaserStats(teaserStatsItem);
      setSchedule(scheduleItem);
      setDailyWordTime(scheduleItem.daily_word_time);
      setTeaserQuizTime(scheduleItem.teaser_quiz_time);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail ?? error?.message ?? 'Failed to load daily content data');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const refreshPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const items = await getDailyContentPreview({ days: 7, language_code: overrideLanguage });
      setPreview(items);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail ?? error?.message ?? 'Failed to load upcoming daily words');
    } finally {
      setPreviewLoading(false);
    }
  }, [overrideLanguage, toast]);

  useEffect(() => {
    void refreshPreview();
  }, [refreshPreview]);

  const handleEditPreviewRow = useCallback((item: DailyContentPreviewItem) => {
    setOverrideDate(item.content_date);
    setOverrideLanguage(item.language_code);
    setSelectedWord(null);
    setWordQuery('');
    overrideSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Debounced dictionary search for the override form.
  useEffect(() => {
    if (!wordQuery.trim()) {
      setWordResults([]);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const results = await searchDictionary(wordQuery, overrideLanguage);
        setWordResults(results);
      } catch {
        setWordResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [wordQuery, overrideLanguage]);

  const handleSaveSchedule = useCallback(async () => {
    setSavingSchedule(true);
    try {
      const updated = await updateNotificationSchedule({
        daily_word_time: dailyWordTime,
        teaser_quiz_time: teaserQuizTime,
      });
      setSchedule(updated);
      toast.success(
        `Schedule updated — applies within 5 minutes (daily word ${updated.daily_word_time} UTC, teaser quiz ${updated.teaser_quiz_time} UTC)`
      );
    } catch (error: any) {
      toast.error(error?.response?.data?.detail ?? error?.message ?? 'Failed to update schedule');
    } finally {
      setSavingSchedule(false);
    }
  }, [dailyWordTime, teaserQuizTime, toast]);

  const handleSaveOverride = useCallback(async () => {
    if (!selectedWord) {
      toast.error('Search and select a word first');
      return;
    }
    setSavingOverride(true);
    try {
      const result = await overrideDailyWord({
        content_date: overrideDate,
        language_code: overrideLanguage,
        word_id: selectedWord.id,
      });
      toast.success(`Daily word for ${result.content_date} set to "${result.word_text}"`);
      setSelectedWord(null);
      setWordQuery('');
      void refresh();
      void refreshPreview();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail ?? error?.message ?? 'Failed to set override');
    } finally {
      setSavingOverride(false);
    }
  }, [selectedWord, overrideDate, overrideLanguage, toast, refresh, refreshPreview]);

  const chartOptions: ApexOptions = {
    chart: { fontFamily: 'Outfit, sans-serif', height: 280, type: 'area', toolbar: { show: false } },
    colors: ['#465FFF', '#9CB9FF', '#34D399'],
    stroke: { curve: 'smooth', width: [2, 2, 2] },
    fill: { type: 'gradient', gradient: { opacityFrom: 0.35, opacityTo: 0 } },
    markers: { size: 0, hover: { size: 5 } },
    grid: { xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
    dataLabels: { enabled: false },
    legend: { show: true, position: 'top', horizontalAlign: 'left' },
    xaxis: {
      type: 'category',
      categories: trend.map((t) => formatDate(t.snapshot_date)),
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { style: { fontSize: '12px', colors: ['#6B7280'] } } },
    tooltip: { enabled: true },
  };
  const chartSeries = [
    { name: 'Total eligible', data: trend.map((t) => t.total_eligible) },
    { name: 'Android', data: trend.map((t) => t.android_eligible) },
    { name: 'iOS', data: trend.map((t) => t.ios_eligible) },
  ];

  return (
    <div className="space-y-6">
      <PageBreadCrumb pageTitle="Daily Content Notifications" />

      {/* Schedule settings */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">Send Time</h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          UTC. Changes apply within 5 minutes — no restart needed. Current: {schedule?.daily_word_time ?? '—'} (daily word), {schedule?.teaser_quiz_time ?? '—'} (teaser quiz).
        </p>
        <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
          <div>
            <DatePicker
              id="send-time-daily-word"
              mode="time"
              label="Daily Word"
              placeholder="HH:MM"
              defaultDate={dailyWordTime}
              onChange={(_dates, timeStr) => setDailyWordTime(timeStr)}
            />
          </div>
          <div>
            <DatePicker
              id="send-time-teaser-quiz"
              mode="time"
              label="Teaser Quiz"
              placeholder="HH:MM"
              defaultDate={teaserQuizTime}
              onChange={(_dates, timeStr) => setTeaserQuizTime(timeStr)}
            />
          </div>
          <button
            type="button"
            onClick={() => void handleSaveSchedule()}
            disabled={savingSchedule}
            className="h-11 rounded-lg bg-brand-500 px-6 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingSchedule ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Manual daily word override */}
      <div
        ref={overrideSectionRef}
        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">Override Daily Word</h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Force a specific word from the dictionary for today or a future date. Past dates aren&apos;t allowed.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <DatePicker
              id="override-date-picker"
              label="Date"
              placeholder="Select date"
              defaultDate={overrideDate}
              minDate={todayIso()}
              onChange={(_dates, dateStr) => setOverrideDate(dateStr)}
            />
          </div>
          <div>
            <StyledSelect
              label="Language"
              value={overrideLanguage}
              onChange={(e) => setOverrideLanguage(e.target.value)}
              options={
                (languages ?? []).length > 0
                  ? (languages ?? []).map((lang: { id: string; name: string; iso_639_3: string }) => ({
                      value: lang.iso_639_3,
                      label: `${lang.name} (${lang.iso_639_3})`,
                    }))
                  : [{ value: 'yor', label: 'Yoruba (yor)' }]
              }
              fullWidth
            />
          </div>
          <div className="relative sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Word</label>
            <input
              type="text"
              value={selectedWord ? selectedWord.lemma : wordQuery}
              onChange={(e) => {
                setSelectedWord(null);
                setWordQuery(e.target.value);
              }}
              placeholder="Search the dictionary..."
              className="block h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            />
            {!selectedWord && wordQuery.trim() && (
              <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                {searching ? (
                  <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">Searching...</div>
                ) : wordResults.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No matches found.</div>
                ) : (
                  wordResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => {
                        setSelectedWord(result);
                        setWordResults([]);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <span className="font-medium text-gray-900 dark:text-white">{result.lemma}</span>
                      {result.glosses.length > 0 && (
                        <span className="ml-2 text-gray-500 dark:text-gray-400">— {result.glosses[0]}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleSaveOverride()}
          disabled={savingOverride || !selectedWord}
          className="mt-4 h-11 rounded-lg bg-brand-500 px-6 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {savingOverride ? 'Saving...' : 'Set Word'}
        </button>
      </div>

      {/* Upcoming daily words preview */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">Upcoming Daily Words (next 7 days)</h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          The auto-picker only chooses a day&apos;s word when it actually runs that day — everything below
          &quot;Locked&quot; is a preview of what it would pick right now, and can still shift if the dictionary
          changes before that date arrives. Click Edit to force a different word for any day.
        </p>
        {previewLoading ? (
          <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">Loading preview...</p>
        ) : preview.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">No eligible words found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Word</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">English</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {preview.map((item) => (
                  <tr key={item.content_date}>
                    <td className="px-3 py-3 text-sm text-gray-900 dark:text-white">{formatDate(item.content_date)}</td>
                    <td className="px-3 py-3 text-sm font-medium text-gray-900 dark:text-white">{item.word_text}</td>
                    <td className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">{item.english_lemma}</td>
                    <td className="px-3 py-3">
                      <StatusBadge
                        status={item.source === 'locked' ? 'success' : 'info'}
                        label={item.source === 'locked' ? 'Locked' : 'Preview'}
                      />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleEditPreviewRow(item)}
                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/30"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audience trend + permission-proxy stat */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Push-Eligible Audience (30 days)</h2>
          {trend.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              No audience snapshots yet — the daily snapshot job populates this over time.
            </p>
          ) : (
            <div className="max-w-full overflow-x-auto custom-scrollbar">
              <div className="min-w-[600px]">
                <ReactApexChart options={chartOptions} series={chartSeries} type="area" height={280} />
              </div>
            </div>
          )}
        </div>
        <NoPushTokenStat />
      </div>

      {/* Daily Content / Teaser Quiz tabs */}
      <div className="flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-900 w-fit">
        <button
          onClick={() => setActiveTab('daily')}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'daily'
              ? 'bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white'
              : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
          }`}
        >
          Daily Content Feed
        </button>
        <button
          onClick={() => setActiveTab('teaser')}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'teaser'
              ? 'bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white'
              : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
          }`}
        >
          Teaser Quiz Feed
        </button>
      </div>

      {activeTab === 'daily' ? (
        <DailyContentTab feed={feed} loading={loading} onRefresh={refresh} />
      ) : (
        <TeaserQuizTab stats={teaserStats} />
      )}
    </div>
  );
}

'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
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
  overrideDailyWord,
  getNotificationSchedule,
  updateNotificationSchedule,
  searchDictionary,
} from '@/lib/notificationsApi';
import type {
  DailyContentFeedItem,
  AudienceSnapshotItem,
  TeaserQuizFeedItem,
  TeaserQuizStats,
  NotificationSchedule,
  DictionarySearchResult,
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

export default function DailyContentNotificationsPage() {
  const toast = useToast();
  const { languages } = useLanguages();
  const [feed, setFeed] = useState<DailyContentFeedItem[]>([]);
  const [trend, setTrend] = useState<AudienceSnapshotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);

  // Teaser quiz section
  const [teaserFeed, setTeaserFeed] = useState<TeaserQuizFeedItem[]>([]);
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
      const [feedItems, trendItems, teaserItems, teaserStatsItem, scheduleItem] = await Promise.all([
        listDailyContentFeed({ limit: 200, offset: 0 }),
        getAudienceTrend({ days: 30 }),
        listTeaserQuizFeed({ limit: 100, offset: 0 }),
        getTeaserQuizStats({ days: 30 }),
        getNotificationSchedule(),
      ]);
      setFeed(feedItems);
      // Trend comes back most-recent-first; charts read left-to-right.
      setTrend([...trendItems].reverse());
      setTeaserFeed(teaserItems);
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
    } catch (error: any) {
      toast.error(error?.response?.data?.detail ?? error?.message ?? 'Failed to set override');
    } finally {
      setSavingOverride(false);
    }
  }, [selectedWord, overrideDate, overrideLanguage, toast, refresh]);

  const totalDays = feed.length;
  const totalSent = feed.reduce((sum, item) => sum + item.sent_count, 0);
  const totalOpens = feed.reduce((sum, item) => sum + item.open_count, 0);
  const overallOpenRate = totalSent > 0 ? Math.round((totalOpens / totalSent) * 100) : 0;

  const totalPages = Math.max(1, Math.ceil(totalDays / limit));
  const pageItems = useMemo(
    () => feed.slice((page - 1) * limit, page * limit),
    [feed, page, limit]
  );
  const pageStart = totalDays === 0 ? 0 : (page - 1) * limit + 1;
  const pageEnd = totalDays === 0 ? 0 : Math.min(page * limit, totalDays);

  const teaserCorrectRate =
    teaserStats && teaserStats.total_answered > 0
      ? Math.round((teaserStats.total_correct / teaserStats.total_answered) * 100)
      : 0;
  const teaserOpenRate =
    teaserStats && teaserStats.total_sent > 0
      ? Math.round((teaserStats.total_opened / teaserStats.total_sent) * 100)
      : 0;

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
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
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

      {/* Daily word stats + audience trend + feed */}
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

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
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

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Daily Content Feed</h2>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-800 hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
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

      {/* Teaser quiz */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Quizzes Sent (30d)</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{(teaserStats?.total_sent ?? 0).toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Open Rate</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{teaserOpenRate}%</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Answered</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{(teaserStats?.total_answered ?? 0).toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Correct Rate</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{teaserCorrectRate}%</div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">Teaser Quiz Feed</h2>
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
              ) : teaserFeed.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
                    No teaser quizzes sent yet.
                  </td>
                </tr>
              ) : (
                teaserFeed.map((item) => (
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
      </div>
    </div>
  );
}

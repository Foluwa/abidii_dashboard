'use client';

import React, { useState } from 'react';
import { Download } from 'lucide-react';

import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import Pagination from '@/components/tables/Pagination';
import StatusBadge from '@/components/admin/StatusBadge';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import { Modal } from '@/components/ui/modal';
import { apiClient } from '@/lib/api';
import { feedbackQuery, useAdminFeedbackList, useAdminFeedbackSummary } from '@/hooks/useApi';
import type { FeedbackItem, FeedbackStatus, FeedbackSummary } from '@/types/feedback';

// Responses from the website's feedback form (abidii.app/feedback), which
// replaced the Google Form in app 1.0.8. Keys match the backend's
// app/services/feedback_service.py.
const FEATURE_LABELS: Record<string, string> = {
  lessons: 'Lessons',
  alphabet: 'Alphabet',
  tracing: 'Tracing letters',
  tone_game: 'Tone game',
  spelling_bee: 'Spelling Bee',
  dictionary: 'Dictionary',
  flashcards: 'Flashcards',
  word_of_day: 'Word of the day',
  proverbs: 'Proverbs',
  numbers: 'Numbers',
  time_teller: 'Time Teller',
  animals: 'Animals',
  keyboard: 'Yorùbá keyboard',
  multiplayer: 'Live games',
  leaderboard: 'Leaderboard',
  missions: 'Daily missions',
};
const LANGUAGE_LABELS: Record<string, string> = { en: 'English', yo: 'Yorùbá', fr: 'French', es: 'Spanish', pt: 'Portuguese' };
const PLATFORM_LABELS: Record<string, string> = { ios: 'iPhone', android: 'Android', web: 'Web', other: 'Other' };
const USAGE_LABELS: Record<number, string> = { 1: '1 · Rarely', 2: '2', 3: '3', 4: '4', 5: '5 · Daily' };

const STATUS_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'New', value: 'new' },
  { label: 'Read', value: 'read' },
  { label: 'Archived', value: 'archived' },
];
const PLATFORM_OPTIONS = [{ label: 'All', value: '' }, ...Object.entries(PLATFORM_LABELS).map(([value, label]) => ({ value, label }))];
const LANGUAGE_OPTIONS = [{ label: 'All', value: '' }, ...Object.entries(LANGUAGE_LABELS).map(([value, label]) => ({ value, label }))];

function statusBadge(status: FeedbackStatus) {
  if (status === 'new') return <StatusBadge status="warning" label="New" />;
  if (status === 'read') return <StatusBadge status="info" label="Read" />;
  return <StatusBadge status="info" label="Archived" />;
}

function device(item: FeedbackItem) {
  return [
    item.platform ? PLATFORM_LABELS[item.platform] ?? item.platform : null,
    LANGUAGE_LABELS[item.app_language ?? item.page_locale] ?? item.app_language ?? item.page_locale,
    item.app_version ? `v${item.app_version}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function FeedbackContent() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [platform, setPlatform] = useState('');
  const [language, setLanguage] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<FeedbackItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const limit = 50;

  const filters = { status: status || undefined, platform: platform || undefined, language: language || undefined, q: q || undefined };
  const { data, isLoading, isError, mutate } = useAdminFeedbackList({ page, limit, ...filters });
  const summary = useAdminFeedbackSummary();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  async function setItemStatus(item: FeedbackItem, next: FeedbackStatus) {
    setSaving(true);
    try {
      await apiClient.patch(`/api/v1/admin/feedback/${item.id}`, { status: next });
      setSelected({ ...item, status: next });
      await Promise.all([mutate(), summary.mutate()]);
    } finally {
      setSaving(false);
    }
  }

  function open(item: FeedbackItem) {
    setSelected(item);
    // Opening a new response marks it as read.
    if (item.status === 'new') void setItemStatus(item, 'read');
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const res = await apiClient.get(`/api/v1/admin/feedback/export.csv${feedbackQuery(filters)}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `abidii_feedback_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageBreadCrumb pageTitle="Feedback" />

      <div className="space-y-6">
        <SummaryCards summary={summary.data} />
        {summary.data && summary.data.total > 0 && <FeatureBars summary={summary.data} />}

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <Filter label="Status" options={STATUS_OPTIONS} value={status} onChange={(v) => { setPage(1); setStatus(v); }} />
            <Filter label="Device" options={PLATFORM_OPTIONS} value={platform} onChange={(v) => { setPage(1); setPlatform(v); }} />
            <Filter label="Language" options={LANGUAGE_OPTIONS} value={language} onChange={(v) => { setPage(1); setLanguage(v); }} />
            <form
              className="md:col-span-1"
              onSubmit={(e) => {
                e.preventDefault();
                setPage(1);
                setQ(search.trim());
              }}
            >
              <label className="block text-xs font-medium text-muted-foreground">Search text or email</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Press Enter to search"
                className="mt-1 h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground"
              />
            </form>
            <div className="flex items-end">
              <button
                type="button"
                onClick={exportCsv}
                disabled={exporting}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-60"
              >
                <Download className="size-4" />
                {exporting ? 'Exporting…' : 'Export CSV'}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border" role="table">
              <thead className="border-b">
                <tr>
                  {['Received', 'Device', 'Usage', 'Recommend', 'What to improve', 'Status', ''].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading && <Row colSpan={7}>Loading…</Row>}
                {isError && <Row colSpan={7}>Failed to load feedback.</Row>}
                {!isLoading && !isError && items.length === 0 && <Row colSpan={7}>No feedback yet.</Row>}
                {!isLoading &&
                  !isError &&
                  items.map((item) => (
                    <tr key={item.id} className={item.status === 'new' ? 'bg-primary/5' : undefined}>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-foreground">{new Date(item.created_at).toLocaleString()}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-foreground">{device(item)}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{item.usage_frequency}/5</td>
                      <td className="px-4 py-3 text-sm text-foreground">{item.recommend_score ?? '—'}</td>
                      <td className="max-w-xs truncate px-4 py-3 text-sm text-foreground" title={item.improve_text ?? ''}>
                        {item.improve_text || item.other_text || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm">{statusBadge(item.status)}</td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          type="button"
                          onClick={() => open(item)}
                          className="rounded-lg border border-input bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">{total} responses</p>
          <div className="ml-auto">
            <Pagination currentPage={page} totalPages={pages} onPageChange={setPage} />
          </div>
        </div>
      </div>

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Feedback" maxWidth="2xl">
        {selected && (
          <div className="space-y-4 text-sm text-foreground">
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
              <span>{new Date(selected.created_at).toLocaleString()}</span>
              <span>·</span>
              <span>{device(selected)}</span>
              <span>·</span>
              <span>{selected.source === 'app' ? 'From the app' : 'From the website'}</span>
              <span className="ml-auto">{statusBadge(selected.status)}</span>
            </div>
            <dl className="grid grid-cols-1 gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
              <Detail label="How often">{USAGE_LABELS[selected.usage_frequency]}</Detail>
              <Detail label="Would recommend (0–10)">{selected.recommend_score ?? '—'}</Detail>
              <Detail label="Features used">
                {selected.features_used.map((f) => FEATURE_LABELS[f] ?? f).join(', ') || '—'}
              </Detail>
              <Detail label="Favourite">{selected.favourite_feature ? FEATURE_LABELS[selected.favourite_feature] : '—'}</Detail>
              {selected.features_used.includes('tracing') && (
                <Detail label="Tracing accuracy">{selected.tracing_rating ? `${selected.tracing_rating}/5` : '—'}</Detail>
              )}
              <Detail label="Reply to">
                {selected.contact_email ? (
                  <a href={`mailto:${selected.contact_email}?subject=Your%20Abidii%20feedback`} className="text-primary hover:underline">
                    {selected.contact_email}
                  </a>
                ) : (
                  'No email given'
                )}
              </Detail>
            </dl>
            <TextBlock label="What should we improve?" text={selected.improve_text} />
            <TextBlock label="Anything else?" text={selected.other_text} />
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              {(['new', 'read', 'archived'] as const)
                .filter((s) => s !== selected.status)
                .map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={saving}
                    onClick={() => setItemStatus(selected, s)}
                    className="rounded-lg border border-input bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 disabled:opacity-60"
                  >
                    {s === 'new' ? 'Mark as new' : s === 'read' ? 'Mark as read' : 'Archive'}
                  </button>
                ))}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function SummaryCards({ summary }: { summary?: FeedbackSummary }) {
  const fmt = (n: number | null | undefined, digits = 1) => (n == null ? '—' : n.toFixed(digits));
  const cards = [
    { label: 'Responses', value: summary?.total ?? '—' },
    { label: 'New', value: summary?.unread ?? '—' },
    { label: 'NPS', value: summary?.nps ?? '—', hint: summary ? `${summary.recommend_answers} answers` : undefined },
    { label: 'Avg. usage (1–5)', value: fmt(summary?.avg_usage_frequency) },
    { label: 'Avg. tracing (1–5)', value: fmt(summary?.avg_tracing_rating) },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{c.value}</p>
          {c.hint && <p className="mt-0.5 text-xs text-muted-foreground">{c.hint}</p>}
        </div>
      ))}
    </div>
  );
}

function FeatureBars({ summary }: { summary: FeedbackSummary }) {
  const rows = Object.entries(summary.features_used).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map(([, n]) => n));
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground">Features used (and picked as favourite)</h3>
      <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-2">
        {rows.map(([key, n]) => (
          <div key={key} className="flex items-center gap-3 text-sm">
            <span className="w-36 shrink-0 text-muted-foreground">{FEATURE_LABELS[key] ?? key}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(n / max) * 100}%` }} />
            </div>
            <span className="w-16 shrink-0 text-right tabular-nums text-foreground">
              {n}
              {summary.favourite_feature[key] ? <span className="text-muted-foreground"> · ★{summary.favourite_feature[key]}</span> : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Filter({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground">{label}</label>
      <div className="mt-1">
        <StyledSelect options={options} value={value} onValueChange={onChange} />
      </div>
    </div>
  );
}

function Row({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={colSpan}>
        {children}
      </td>
    </tr>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

function TextBlock({ label, text }: { label: string; text: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3">{text || '—'}</p>
    </div>
  );
}

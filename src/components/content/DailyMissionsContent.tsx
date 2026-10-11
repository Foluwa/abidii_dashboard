'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ListFilter, Mic, Route, X } from 'lucide-react';

import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import Pagination from '@/components/tables/Pagination';
import MetricCard from '@/components/analytics/learning/MetricCard';
import { Pill, SubscriptionUserCell, type PillTone } from '@/components/subscriptions/subscriptionDisplay';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import { useAdminMissionClaims, useAdminMissionsSummary } from '@/hooks/useApi';
import {
  KIND_LABEL,
  MISSION_KINDS,
  type MissionKind,
  claimsByKindPerDay,
  formatPercent,
  missionLabel,
  missionRates,
  missionTotals,
  ratio,
} from '@/lib/dailyMissions';

const DAY_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

const KIND_TONE: Record<MissionKind, PillTone> = {
  lesson: 'blue',
  game: 'purple',
  speak: 'amber',
  review: 'teal',
};

const KIND_COLOR: Record<MissionKind, string> = {
  lesson: 'var(--chart-1)',
  game: 'var(--chart-4)',
  speak: 'var(--chart-3)',
  review: 'var(--chart-2)',
};

const ROW_ICON_BUTTON_CLASS =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg text-brand-600 hover:bg-brand-50 hover:text-brand-900 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-brand-400 dark:hover:bg-brand-900/30 dark:hover:text-brand-300';

const TH = 'whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground';
const TH_NUM = `${TH} text-right`;
const TD = 'px-4 py-3 text-sm text-foreground';
const TD_NUM = `${TD} text-right tabular-nums`;

const dayTick = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
function formatDay(iso: string) {
  return dayTick.format(new Date(`${iso}T00:00:00Z`));
}

export function MissionKindPill({ kind }: { kind: MissionKind | null }) {
  if (!kind) return <Pill tone="neutral">Other</Pill>;
  return <Pill tone={KIND_TONE[kind]}>{KIND_LABEL[kind]}</Pill>;
}

/** Inline bar for a rate, with the percentage beside it. */
function RateBar({ rate }: { rate: number | null }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:block" aria-hidden="true">
        <div className="h-full rounded-full bg-[var(--chart-1)]" style={{ width: `${Math.round((rate ?? 0) * 100)}%` }} />
      </div>
      <span className="w-10 text-right tabular-nums">{formatPercent(rate)}</span>
    </div>
  );
}

export function DailyMissionsContent({ showHeader = true }: { showHeader?: boolean }) {
  const [days, setDays] = useState('14');
  const summary = useAdminMissionsSummary(Number(days));

  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [missionId, setMissionId] = useState('');
  const [day, setDay] = useState('');
  const claims = useAdminMissionClaims({
    page,
    limit,
    missionId: missionId || undefined,
    day: day || undefined,
  });

  const items = useMemo(() => summary.data?.items ?? [], [summary.data]);
  const catalog = useMemo(() => summary.data?.catalog ?? [], [summary.data]);
  const totals = useMemo(() => missionTotals(items), [items]);
  const perDay = useMemo(() => claimsByKindPerDay(items, catalog), [items, catalog]);
  const rates = useMemo(() => missionRates(items, catalog), [items, catalog]);
  const kindsInChart = MISSION_KINDS.filter((k) => perDay.some((p) => p[k] > 0));
  const chartConfig = Object.fromEntries(
    MISSION_KINDS.map((k) => [k, { label: KIND_LABEL[k], color: KIND_COLOR[k] }]),
  ) satisfies ChartConfig;

  const missionOptions = useMemo(
    () => [{ label: 'All missions', value: '' }, ...rates.map((m) => ({ label: m.label, value: m.id }))],
    [rates],
  );

  const claimItems = claims.data?.items ?? [];
  const total = claims.data?.total ?? 0;
  const totalPages = claims.data?.pages || Math.max(1, Math.ceil(total / limit));
  const pageStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const pageEnd = total === 0 ? 0 : Math.min(page * limit, total);

  const showDayClaims = (value: string) => {
    setPage(1);
    setDay(value);
    document.getElementById('mission-claims')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      {showHeader && <PageBreadCrumb pageTitle="Daily Missions" />}

      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl space-y-1 text-sm text-muted-foreground">
            <p>
              Each learner gets 3 small goals a day (a lesson goal, a game goal, and a speaking or review goal),
              counted by the server from what they actually did. Missions are daily, not per course unit. Days are
              learners&apos; local days. Read-only: the mission list is set in the backend.
            </p>
            <p>
              <Link href="/analytics/learning-path" className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline dark:text-brand-400">
                <Route className="h-4 w-4" aria-hidden="true" />
                Progress through courses, units and lessons: Analytics → Learning Path
              </Link>
            </p>
          </div>
          <div className="w-full md:w-48">
            <StyledSelect
              id="missions-days"
              label="Period"
              options={DAY_OPTIONS}
              value={days}
              onValueChange={(value) => setDays(value)}
              fullWidth
            />
          </div>
        </div>

        {summary.isError && (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-destructive">
            Failed to load the missions summary.
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Missions claimed"
            value={summary.isLoading ? '…' : totals.claims.toLocaleString()}
            subtext={totals.today ? `${totals.today.claims.toLocaleString()} today` : undefined}
            tooltip="Missions completed and claimed in the period. A mission only counts once the learner claims it."
          />
          <MetricCard
            label="Claim rate"
            value={summary.isLoading ? '…' : formatPercent(totals.claimRate)}
            subtext={`${totals.claims.toLocaleString()} of ${totals.assigned.toLocaleString()} missions given`}
            tooltip="Claimed missions out of all missions handed out in the period."
          />
          <MetricCard
            label="Finished all missions"
            value={summary.isLoading ? '…' : formatPercent(totals.allClaimedRate)}
            subtext={`${totals.allClaimed.toLocaleString()} of ${totals.learnerDays.toLocaleString()} learner-days`}
            tooltip="Share of learner-days where the learner claimed every mission they were given that day."
          />
          <MetricCard
            label="Learners with missions"
            value={summary.isLoading ? '…' : (totals.today?.learners_assigned ?? 0).toLocaleString()}
            subtext={
              totals.avgLearnersPerDay !== null
                ? `today · ${Math.round(totals.avgLearnersPerDay).toLocaleString()} a day on average · ${totals.bonus.toLocaleString()} bonus cowries paid`
                : undefined
            }
            tooltip="Learners who opened their missions (missions are assigned on first view)."
          />
        </div>

        {/* Claims per day */}
        <Card>
          <CardHeader>
            <CardTitle>Missions claimed per day</CardTitle>
            <CardDescription>By mission type · {DAY_OPTIONS.find((o) => o.value === days)?.label}</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.isLoading ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Loading…</div>
            ) : totals.claims === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                No missions claimed in this period
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-64 w-full" aria-label="Missions claimed per day by type">
                <BarChart data={perDay} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={10} minTickGap={16} tickFormatter={(v) => formatDay(String(v))} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} width={36} allowDecimals={false} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(v) => formatDay(String(v))} />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  {kindsInChart.map((k, i) => (
                    <Bar
                      key={k}
                      dataKey={k}
                      stackId="claims"
                      fill={`var(--color-${k})`}
                      stroke="var(--color-card)"
                      strokeWidth={1}
                      radius={i === kindsInChart.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                      maxBarSize={40}
                    />
                  ))}
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Missions: catalog + how each performs */}
        <Card>
          <CardHeader>
            <CardTitle>Missions</CardTitle>
            <CardDescription>
              What learners can be given, and how often each is completed in the period. Lowest claim rates show
              the goals learners find hardest.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead>
                  <tr>
                    <th className={TH}>Mission</th>
                    <th className={TH}>Type</th>
                    <th className={TH_NUM}>Target</th>
                    <th className={TH_NUM}>Given</th>
                    <th className={TH_NUM}>Claimed</th>
                    <th className={TH_NUM}>Claim rate</th>
                    <th className={`${TH} text-right`}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rates.map((m) => (
                    <tr key={m.id}>
                      <td className={TD}>
                        <div className="font-medium">{m.label}</div>
                        <div className="mt-0.5 flex items-center gap-2 font-mono text-xs text-muted-foreground">
                          {m.id}
                          {m.requiresMic && (
                            <span className="inline-flex items-center gap-0.5 font-sans" title="Only given when the microphone is usable">
                              <Mic className="h-3 w-3" aria-hidden="true" /> mic
                            </span>
                          )}
                          {!m.inCatalog && <Pill tone="neutral">Retired</Pill>}
                        </div>
                      </td>
                      <td className={TD}>
                        <MissionKindPill kind={m.kind} />
                      </td>
                      <td className={TD_NUM}>{m.target ?? '—'}</td>
                      <td className={TD_NUM}>{m.assigned.toLocaleString()}</td>
                      <td className={TD_NUM}>{m.claims.toLocaleString()}</td>
                      <td className={TD_NUM}>
                        <RateBar rate={m.claimRate} />
                      </td>
                      <td className={`${TD} text-right`}>
                        <button
                          type="button"
                          className={ROW_ICON_BUTTON_CLASS}
                          aria-label={`Show claims for ${m.label}`}
                          title="Show claims"
                          onClick={() => {
                            setPage(1);
                            setMissionId(m.id);
                            document.getElementById('mission-claims')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
                          }}
                        >
                          <ListFilter className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!summary.isLoading && rates.length === 0 && (
                    <tr>
                      <td className={`${TD} text-muted-foreground`} colSpan={7}>
                        No missions.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Day by day, compact (the chart's data as a table) */}
        <details className="group rounded-xl border border-border bg-card">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-foreground">
            Day by day
            <span className="ml-2 font-normal text-muted-foreground">({items.length} days)</span>
          </summary>
          <div className="overflow-x-auto border-t border-border">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr>
                  <th className={TH}>Day</th>
                  <th className={TH_NUM}>Learners</th>
                  <th className={TH_NUM}>Claimed</th>
                  <th className={TH_NUM}>Claim rate</th>
                  <th className={TH_NUM}>All done</th>
                  <th className={TH_NUM}>Bonus</th>
                  <th className={`${TH} text-right`}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((row) => (
                  <tr key={row.day}>
                    <td className={TD}>{formatDay(row.day)}</td>
                    <td className={TD_NUM}>{row.learners_assigned}</td>
                    <td className={TD_NUM}>
                      {row.claims} <span className="text-muted-foreground">/ {row.missions_assigned}</span>
                    </td>
                    <td className={TD_NUM}>{formatPercent(ratio(row.claims, row.missions_assigned))}</td>
                    <td className={TD_NUM}>{row.all_claimed ?? '—'}</td>
                    <td className={TD_NUM}>{row.bonus}</td>
                    <td className={`${TD} text-right`}>
                      <button
                        type="button"
                        className={ROW_ICON_BUTTON_CLASS}
                        aria-label={`Show claims on ${row.day}`}
                        title="Show this day's claims"
                        onClick={() => showDayClaims(row.day)}
                      >
                        <ListFilter className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        {/* Recent claims */}
        <Card id="mission-claims">
          <CardHeader>
            <CardTitle>Recent claims</CardTitle>
            <CardDescription>Who claimed what, newest first.</CardDescription>
            <CardAction>
              <span className="text-sm tabular-nums text-muted-foreground">{total.toLocaleString()} claims</span>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4 px-0">
            <div className="grid grid-cols-1 gap-3 px-6 md:grid-cols-3">
              <StyledSelect
                id="mission-filter"
                label="Mission"
                options={missionOptions}
                value={missionId}
                onValueChange={(value) => {
                  setPage(1);
                  setMissionId(value);
                }}
                fullWidth
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="mission-day">
                  Day
                </label>
                <div className="flex gap-2">
                  <input
                    id="mission-day"
                    type="date"
                    value={day}
                    onChange={(e) => {
                      setPage(1);
                      setDay(e.target.value);
                    }}
                    className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {day && (
                    <button
                      type="button"
                      onClick={() => {
                        setPage(1);
                        setDay('');
                      }}
                      className={ROW_ICON_BUTTON_CLASS}
                      aria-label="Clear day"
                      title="Clear day"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead>
                  <tr>
                    <th className={TH}>Learner</th>
                    <th className={TH}>Mission</th>
                    <th className={TH}>Day</th>
                    <th className={TH_NUM}>Progress</th>
                    <th className={TH_NUM}>Bonus</th>
                    <th className={TH}>Claimed at</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {claims.isLoading && (
                    <tr>
                      <td className={`${TD} text-muted-foreground`} colSpan={6}>
                        Loading…
                      </td>
                    </tr>
                  )}
                  {claims.isError && (
                    <tr>
                      <td className={`${TD} text-muted-foreground`} colSpan={6}>
                        Failed to load mission claims.
                      </td>
                    </tr>
                  )}
                  {!claims.isLoading && !claims.isError && claimItems.length === 0 && (
                    <tr>
                      <td className={`${TD} text-muted-foreground`} colSpan={6}>
                        No claims found.
                      </td>
                    </tr>
                  )}
                  {claimItems.map((row) => (
                    <tr key={row.id}>
                      <td className={TD}>
                        <SubscriptionUserCell row={row} />
                      </td>
                      <td className={TD}>
                        <div className="flex items-center gap-2">
                          <MissionKindPill kind={rates.find((m) => m.id === row.mission_id)?.kind ?? null} />
                          <span>{missionLabel(row.mission_id)}</span>
                        </div>
                      </td>
                      <td className={`${TD} whitespace-nowrap`}>{formatDay(row.mission_day)}</td>
                      <td className={TD_NUM}>
                        {row.progress} / {row.target}
                      </td>
                      <td className={TD_NUM}>{row.bonus}</td>
                      <td className={`${TD} whitespace-nowrap text-muted-foreground`}>
                        {new Date(row.claimed_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 px-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {pageStart} to {pageEnd} of {total} claims
              </p>
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={(p) => setPage(p)} />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

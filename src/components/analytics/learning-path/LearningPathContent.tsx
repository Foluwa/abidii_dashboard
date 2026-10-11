'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts';
import { ChevronDown, ChevronRight, Target } from 'lucide-react';

import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import AnalyticsTabs from '@/components/analytics/AnalyticsTabs';
import MetricCard from '@/components/analytics/learning/MetricCard';
import {
  AnalyticsEmptyState,
  AnalyticsErrorPanel,
  AnalyticsPanelSkeleton,
} from '@/components/analytics/learning/AnalyticsEmptyState';
import { Pill } from '@/components/subscriptions/subscriptionDisplay';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import { useLearningPath } from '@/hooks/useApi';
import { formatCount, formatDurationMs, formatRate } from '@/lib/formatAnalytics';
import { type RangeKey, RANGE_OPTIONS, formatBucketLabel, formatBucketTick, perGranularity } from '@/lib/dashboardRange';
import {
  type FunnelRow,
  biggestDropOffs,
  completionsByUnitSeries,
  funnelRows,
  sectionShareOfPremium,
} from '@/lib/learningPath';
import type { LearnerTier, LearningPathResponse, LearningPathUnit } from '@/types/learning-path';

const TIER_OPTIONS: { value: LearnerTier; label: string }[] = [
  { value: 'all', label: 'All learners' },
  { value: 'free', label: 'Free learners' },
  { value: 'premium', label: 'Premium learners' },
];

const SERIES_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

const TH = 'whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground';
const TH_NUM = `${TH} text-right`;
const TD = 'px-4 py-3 text-sm text-foreground';
const TD_NUM = `${TD} text-right tabular-nums`;

function ChartFrame({
  isEmpty,
  emptyMessage,
  children,
}: {
  isEmpty: boolean;
  emptyMessage: string;
  children: React.ReactNode;
}) {
  if (isEmpty) {
    return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">{emptyMessage}</div>;
  }
  return <>{children}</>;
}

function funnelTooltipLabel(rows: FunnelRow[]) {
  return (label: unknown) => {
    const row = rows.find((r) => r.label === label);
    return row ? `${row.label} ${row.title} · ${row.unitTitle}` : String(label);
  };
}

/** Learners reaching / completing each lesson, in path order. */
export function LessonFunnelChart({ rows }: { rows: FunnelRow[] }) {
  const config = {
    reached: { label: 'Started', color: 'var(--chart-1)' },
    completed: { label: 'Completed', color: 'var(--chart-2)' },
  } satisfies ChartConfig;
  return (
    <ChartFrame isEmpty={rows.every((r) => r.reached === 0)} emptyMessage="No learners started this course in the period">
      <ChartContainer config={config} className="h-72 w-full" aria-label="Learners reaching each lesson">
        <AreaChart data={rows} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} minTickGap={12} />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} width={40} allowDecimals={false} />
          <ChartTooltip content={<ChartTooltipContent labelFormatter={funnelTooltipLabel(rows)} />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Area dataKey="reached" type="stepAfter" stroke="var(--color-reached)" strokeWidth={2} fill="var(--color-reached)" fillOpacity={0.12} />
          <Area dataKey="completed" type="stepAfter" stroke="var(--color-completed)" strokeWidth={2} fill="var(--color-completed)" fillOpacity={0.12} />
        </AreaChart>
      </ChartContainer>
    </ChartFrame>
  );
}

/** Median wall-clock minutes per lesson. */
export function TimePerLessonChart({ rows }: { rows: FunnelRow[] }) {
  const config = { medianMinutes: { label: 'Median minutes', color: 'var(--chart-4)' } } satisfies ChartConfig;
  return (
    <ChartFrame isEmpty={rows.every((r) => r.medianMinutes === null)} emptyMessage="No completed lesson sessions in the period">
      <ChartContainer config={config} className="h-64 w-full" aria-label="Median time per lesson">
        <BarChart data={rows} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} minTickGap={12} />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} width={40} unit="m" />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={funnelTooltipLabel(rows)}
                formatter={(value, _name, item) => {
                  const row = item?.payload as FunnelRow | undefined;
                  return (
                    <div className="flex flex-col gap-0.5">
                      <span>Median {value} min (n={row?.timedSessions ?? 0})</span>
                      {row?.activeMinutes !== null && row?.activeMinutes !== undefined && (
                        <span className="text-muted-foreground">Answering {row.activeMinutes} min</span>
                      )}
                    </div>
                  );
                }}
              />
            }
          />
          <Bar dataKey="medianMinutes" fill="var(--color-medianMinutes)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ChartContainer>
    </ChartFrame>
  );
}

/** Active learners, new learners and lesson completions per bucket. */
export function ProgressOverTimeChart({ data }: { data: LearningPathResponse }) {
  const granularity = data.range.granularity;
  const config = {
    active_learners: { label: 'Active learners', color: 'var(--chart-1)' },
    new_learners: { label: 'New learners', color: 'var(--chart-2)' },
    lesson_completions: { label: 'Lessons completed', color: 'var(--chart-3)' },
  } satisfies ChartConfig;
  const points = data.series.map((p) => ({ ...p, start: p.period_start, end: p.period_end }));
  const empty = points.every((p) => !p.active_learners && !p.lesson_completions && !p.new_learners);
  return (
    <ChartFrame isEmpty={empty} emptyMessage="No learning activity in this period">
      <ChartContainer config={config} className="h-64 w-full" aria-label="Learning progress over time">
        <LineChart data={points} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="start"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            minTickGap={16}
            tickFormatter={(v) => formatBucketTick(String(v), granularity)}
          />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} width={40} allowDecimals={false} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const p = payload?.[0]?.payload as { start: string; end: string; partial: boolean } | undefined;
                  return p ? formatBucketLabel(p.start, p.end, granularity, p.partial) : '';
                }}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          {(['active_learners', 'new_learners', 'lesson_completions'] as const).map((key) => (
            <Line key={key} dataKey={key} type="monotone" stroke={`var(--color-${key})`} strokeWidth={2} dot={points.length <= 31 ? { r: 3 } : false} />
          ))}
        </LineChart>
      </ChartContainer>
    </ChartFrame>
  );
}

/** Lesson completions per bucket, stacked by unit (top 4 + other). */
export function CompletionsByUnitChart({ data }: { data: LearningPathResponse }) {
  const granularity = data.range.granularity;
  const { keys, points } = useMemo(() => completionsByUnitSeries(data.series, data.units), [data]);
  const config = Object.fromEntries(
    keys.map((k, i) => [k.key, { label: k.label, color: SERIES_COLORS[i % SERIES_COLORS.length] }]),
  ) satisfies ChartConfig;
  return (
    <ChartFrame isEmpty={keys.length === 0} emptyMessage="No lessons completed in this period">
      <ChartContainer config={config} className="h-64 w-full" aria-label="Lesson completions by unit">
        <BarChart data={points} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="start"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            minTickGap={16}
            tickFormatter={(v) => formatBucketTick(String(v), granularity)}
          />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} width={40} allowDecimals={false} />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const p = payload?.[0]?.payload as { start: string; end: string; partial: boolean } | undefined;
                  return p ? formatBucketLabel(p.start, p.end, granularity, p.partial) : '';
                }}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          {keys.map((k, i) => (
            <Bar
              key={k.key}
              dataKey={k.key}
              stackId="units"
              fill={`var(--color-${k.key})`}
              stroke="var(--color-card)"
              strokeWidth={1}
              radius={i === keys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              maxBarSize={40}
            >
              {points.map((p) => (
                <Cell key={String(p.start)} fillOpacity={p.partial ? 0.5 : 1} />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ChartContainer>
    </ChartFrame>
  );
}

function ProgressBar({ rate }: { rate: number | null }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:block" aria-hidden="true">
        <div className="h-full rounded-full bg-[var(--chart-2)]" style={{ width: `${Math.round((rate ?? 0) * 100)}%` }} />
      </div>
      <span className="w-12 text-right tabular-nums">{formatRate(rate)}</span>
    </div>
  );
}

/** Units with their lessons (expandable). */
export function UnitProgressTable({ units, funnel }: { units: LearningPathUnit[]; funnel: FunnelRow[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const dropOffBySection = useMemo(() => {
    const map = new Map<number, number | null>();
    funnel.forEach((r) => map.set(r.position, r.dropOff));
    return map;
  }, [funnel]);

  if (units.length === 0) return <AnalyticsEmptyState message="This course has no units yet." />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-border">
        <thead>
          <tr>
            <th className={TH}>Unit / lesson</th>
            <th className={TH_NUM}>Started</th>
            <th className={TH_NUM}>Completed</th>
            <th className={TH_NUM}>Completion</th>
            <th className={TH_NUM} title="Share of the previous lesson's learners who never started this one">
              Drop-off
            </th>
            <th className={TH_NUM} title="Median wall-clock time of completed sessions (unit: sum of its lessons' medians)">
              Typical time
            </th>
            <th className={TH_NUM} title="Median total answering time per completed session">
              Answering
            </th>
            <th className={TH_NUM}>Premium</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {units.map((unit) => {
            const expanded = !!open[unit.unit_id];
            return (
              <React.Fragment key={unit.unit_id}>
                <tr className="bg-muted/30">
                  <td className={TD}>
                    <button
                      type="button"
                      className="flex items-center gap-2 text-left font-medium hover:underline"
                      aria-expanded={expanded}
                      aria-label={`${expanded ? 'Hide' : 'Show'} lessons in ${unit.title}`}
                      onClick={() => setOpen((o) => ({ ...o, [unit.unit_id]: !expanded }))}
                    >
                      {expanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                      )}
                      <span>
                        Unit {unit.position}: {unit.title}
                      </span>
                    </button>
                    <div className="ml-6 mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      {unit.live_sections} lessons
                      {!unit.live && <Pill tone="neutral">Hidden</Pill>}
                    </div>
                  </td>
                  <td className={TD_NUM}>{formatCount(unit.learners_started)}</td>
                  <td className={TD_NUM}>{formatCount(unit.learners_completed)}</td>
                  <td className={TD_NUM}>
                    <ProgressBar rate={unit.completion_rate} />
                  </td>
                  <td className={TD_NUM}>—</td>
                  <td className={TD_NUM}>{formatDurationMs(unit.typical_wall_clock_ms)}</td>
                  <td className={TD_NUM}>{formatDurationMs(unit.typical_active_ms)}</td>
                  <td className={TD_NUM}>—</td>
                </tr>
                {expanded &&
                  unit.sections.map((s) => {
                    const drop = dropOffBySection.get(s.position);
                    return (
                      <tr key={s.section_id} className={s.live ? undefined : 'opacity-60'}>
                        <td className={`${TD} pl-12`}>
                          <div>{s.title}</div>
                          <div className="mt-0.5 flex items-center gap-2 font-mono text-xs text-muted-foreground">
                            {s.section_key}
                            {!s.live && <Pill tone="neutral">Hidden</Pill>}
                          </div>
                        </td>
                        <td className={TD_NUM}>{formatCount(s.learners_started)}</td>
                        <td className={TD_NUM}>{formatCount(s.learners_completed)}</td>
                        <td className={TD_NUM}>
                          <ProgressBar rate={s.completion_rate} />
                        </td>
                        <td className={TD_NUM}>
                          {drop === null || drop === undefined ? (
                            '—'
                          ) : (
                            <Pill tone={drop >= 0.3 ? 'red' : drop >= 0.15 ? 'yellow' : 'neutral'}>{formatRate(drop)}</Pill>
                          )}
                        </td>
                        <td className={TD_NUM} title={s.timed_sessions ? `${s.timed_sessions} completed sessions` : undefined}>
                          {formatDurationMs(s.median_wall_clock_ms)}
                        </td>
                        <td className={TD_NUM}>{formatDurationMs(s.median_active_ms)}</td>
                        <td className={TD_NUM}>{formatRate(sectionShareOfPremium(s))}</td>
                      </tr>
                    );
                  })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function LearningPathContent() {
  const [range, setRange] = useState<RangeKey>('30d');
  const [tier, setTier] = useState<LearnerTier>('all');
  const [courseId, setCourseId] = useState('');
  const { data, isLoading, isError, refresh } = useLearningPath({ courseId: courseId || undefined, range, tier });

  const funnel = useMemo(() => funnelRows(data?.units ?? []), [data]);
  const drops = useMemo(() => biggestDropOffs(funnel), [funnel]);
  const s = data?.summary;
  const per = perGranularity(data?.range.granularity);

  return (
    <div className="space-y-6">
      <div>
        <PageBreadCrumb pageTitle="Learning Path" />
        <p className="mt-1 text-sm text-muted-foreground">
          How learners move through a course: who starts and finishes each unit and lesson, where they stop, and how
          long lessons take.
        </p>
      </div>

      <AnalyticsTabs />

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StyledSelect
            id="learning-path-course"
            label="Course"
            value={courseId || data?.course?.id || ''}
            onValueChange={(value) => setCourseId(value)}
            options={(data?.courses ?? []).map((c) => ({ value: c.id, label: c.title }))}
            placeholder="Course"
            fullWidth
          />
          <StyledSelect
            id="learning-path-range"
            label="Date range"
            value={range}
            onValueChange={(value) => setRange(value as RangeKey)}
            options={RANGE_OPTIONS}
            fullWidth
          />
          <StyledSelect
            id="learning-path-tier"
            label="Learners"
            value={tier}
            onValueChange={(value) => setTier(value as LearnerTier)}
            options={TIER_OPTIONS}
            fullWidth
          />
        </div>
      </div>

      {isError ? (
        <AnalyticsErrorPanel message="Failed to load learning path analytics." onRetry={() => refresh()} />
      ) : isLoading || !data ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <AnalyticsPanelSkeleton key={i} heightClassName="h-32" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="New learners"
              value={formatCount(s?.cohort_learners)}
              subtext={tier === 'all' && s ? `${formatCount(s.cohort_free)} free · ${formatCount(s.cohort_premium)} premium` : undefined}
              tooltip="Learners whose first lesson in this course started in the period. The funnel and unit table follow these learners' progress to date."
            />
            <MetricCard
              label="Finished the course"
              value={formatRate(s?.course_completion_rate)}
              subtext={s ? `${formatCount(s.course_completed)} of ${formatCount(s.cohort_learners)} new learners · ${s.live_sections} lessons` : undefined}
              tooltip="New learners who have completed every live lesson in the course."
            />
            <MetricCard
              label="Active learners"
              value={formatCount(s?.active_learners)}
              subtext={s ? `${formatCount(s.lesson_completions)} lessons completed` : undefined}
              tooltip="Anyone who started, worked on or completed a lesson in this course in the period."
            />
            <MetricCard
              label="Median lesson time"
              value={formatDurationMs(s?.median_wall_clock_ms)}
              subtext={s ? `${formatDurationMs(s.median_active_ms)} answering · ${formatCount(s.timed_sessions)} sessions` : undefined}
              sampleSize={s?.timed_sessions}
              tooltip="Median start-to-finish time of completed lesson sessions (can include time the app was in the background). Answering = median total time spent answering exercises."
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Lesson funnel</CardTitle>
              <CardDescription>
                How many of the {formatCount(s?.cohort_learners)} new learners reached and completed each lesson, in
                course order (unit.lesson).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LessonFunnelChart rows={funnel} />
              {drops.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                  <span className="inline-flex items-center gap-1 font-medium text-foreground">
                    <Target className="h-4 w-4" aria-hidden="true" /> Biggest drop-offs:
                  </span>
                  {drops.map((d) => (
                    <Pill key={d.position} tone="red" title={`${d.unitTitle}`}>
                      {d.label} {d.title} · {formatRate(d.dropOff)} stop before it
                    </Pill>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Learning over time</CardTitle>
                <CardDescription>Learners and completed lessons {per} · {data.range.label}</CardDescription>
              </CardHeader>
              <CardContent>
                <ProgressOverTimeChart data={data} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Lessons completed by unit</CardTitle>
                <CardDescription>Busiest units {per} · {data.range.label}</CardDescription>
              </CardHeader>
              <CardContent>
                <CompletionsByUnitChart data={data} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Time per lesson</CardTitle>
              <CardDescription>
                Median start-to-finish minutes of lessons completed in the period. Hover for the answering time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TimePerLessonChart rows={funnel} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Units and lessons</CardTitle>
              <CardDescription>Open a unit to see its lessons. Counts follow the new learners above.</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <UnitProgressTable units={data.units} funnel={funnel} />
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            UTC days. Premium = has an active or trial subscription now. Admin and deleted accounts are excluded. Daily
            mission activity is on{' '}
            <Link href="/content/daily-missions" className="underline">
              Content → Daily Missions
            </Link>
            ; per-exercise accuracy is on the{' '}
            <Link href="/analytics/learning" className="underline">
              Learning
            </Link>{' '}
            tab.
          </p>
        </>
      )}
    </div>
  );
}

"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { ListChecks } from "lucide-react";

import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import AnalyticsTabs from "@/components/analytics/AnalyticsTabs";
import MetricCard from "@/components/analytics/learning/MetricCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { LoadErrorState } from "@/components/content/onboarding/shared";
import { useAcquisitionAnalytics, useAcquisitionOptions } from "@/hooks/useApi";
import {
  answerRate,
  formatRate,
  lastNDaysRange,
  maskEmailsInText,
  pivotByCountry,
  pivotOverTime,
  rankSources,
  sourceLabel,
} from "@/lib/acquisition";
import { countryFlagEmoji, countryName } from "@/lib/country-utils";

const PRESETS = [7, 30, 90] as const;
/** Sources beyond this many share one neutral "All other answers" series. */
const MAX_TIME_SERIES = 4;
const REST_KEY = "rest";

const TH = "whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground";
const TH_NUM = `${TH} text-right`;
const TD = "px-4 py-2.5 text-sm text-foreground";
const TD_NUM = `${TD} text-right tabular-nums`;
const DATE_INPUT =
  "h-10 rounded-lg border border-input bg-transparent px-3 text-sm text-foreground focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/20 dark:bg-gray-900";

const dayTick = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const formatDay = (iso: string) => dayTick.format(new Date(`${iso}T00:00:00Z`));

function EmptyChart({ children }: { children: React.ReactNode }) {
  return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">{children}</div>;
}

export default function AcquisitionAnalyticsPage() {
  const [range, setRange] = useState(() => lastNDaysRange(30));
  const rangeValid = !!range.from && !!range.to && range.from <= range.to;
  const { analytics, isLoading, isError, refresh } = useAcquisitionAnalytics(
    rangeValid ? range.from : "",
    rangeValid ? range.to : "",
  );
  const { options } = useAcquisitionOptions();
  const activePreset = PRESETS.find((n) => {
    const r = lastNDaysRange(n);
    return r.from === range.from && r.to === range.to;
  });

  const bySource = useMemo(() => analytics?.by_source ?? [], [analytics]);
  const ranked = useMemo(() => rankSources(bySource), [bySource]);
  const label = (source: string) => sourceLabel(source, options);

  // Bar chart: one series (answers), one bar per source.
  const sourceBars = ranked.map((source) => ({
    source: label(source),
    count: bySource.find((r) => r.source === source)?.count ?? 0,
  }));
  const sourceChartConfig = { count: { label: "Answers", color: "var(--chart-1)" } } satisfies ChartConfig;

  // Over time: the biggest sources keep their own colour; the rest fold into one gray series.
  const shown = ranked.slice(0, MAX_TIME_SERIES);
  const folded = ranked.slice(MAX_TIME_SERIES);
  const seriesKey = (source: string) => {
    const i = shown.indexOf(source);
    return i >= 0 ? `s${i}` : REST_KEY;
  };
  const overTime = (() => {
    const rows = pivotOverTime(analytics?.over_time ?? [], ranked, range.from, range.to, (s) => `src:${s}`);
    return rows.map((row) => {
      const out: Record<string, string | number> = { day: row.day };
      shown.forEach((s, i) => (out[`s${i}`] = Number(row[`src:${s}`] ?? 0)));
      if (folded.length) out[REST_KEY] = folded.reduce((sum, s) => sum + Number(row[`src:${s}`] ?? 0), 0);
      return out;
    });
  })();
  const timeKeys = [...shown.map((_, i) => `s${i}`), ...(folded.length ? [REST_KEY] : [])];
  const timeChartConfig: ChartConfig = Object.fromEntries([
    ...shown.map((s, i) => [`s${i}`, { label: label(s), color: `var(--chart-${i + 1})` }]),
    [REST_KEY, { label: `All other answers (${folded.length})`, theme: { light: "#94a3b8", dark: "#64748b" } }],
  ]);
  const hasTimeData = (analytics?.over_time ?? []).some((r) => r.count > 0);

  const countries = useMemo(() => pivotByCountry(analytics?.by_country ?? []), [analytics]);
  const otherTexts = analytics?.other_texts ?? [];
  const total = analytics?.total_answered ?? 0;
  const signups = analytics?.total_signups ?? 0;
  const rate = answerRate(total, signups);

  const loadingValue = isLoading ? "…" : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <PageBreadCrumb pageTitle="How users heard about Abidii" />
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Answers to &quot;How did you hear about Abidii?&quot; from onboarding. The question is optional, so the answer
            rate shows how many new sign-ups answered it.{" "}
            <Link
              href="/content/onboarding?tab=acquisition"
              className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              <ListChecks className="h-4 w-4" aria-hidden="true" />
              Edit the answer options
            </Link>
          </p>
        </div>
        <button
          onClick={() => refresh()}
          className="rounded-lg bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Refresh Data
        </button>
      </div>

      <AnalyticsTabs />

      {/* Date range */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <div>
          <label htmlFor="acq-from" className="mb-1 block text-xs font-medium text-muted-foreground">
            From
          </label>
          <input
            id="acq-from"
            type="date"
            className={DATE_INPUT}
            value={range.from}
            max={range.to || undefined}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          />
        </div>
        <div>
          <label htmlFor="acq-to" className="mb-1 block text-xs font-medium text-muted-foreground">
            To
          </label>
          <input
            id="acq-to"
            type="date"
            className={DATE_INPUT}
            value={range.to}
            min={range.from || undefined}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          />
        </div>
        <div className="flex gap-1" role="group" aria-label="Quick ranges">
          {PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={activePreset === n}
              onClick={() => setRange(lastNDaysRange(n))}
              className={`h-10 rounded-lg px-3 text-sm font-medium ${
                activePreset === n
                  ? "bg-brand-600 text-white"
                  : "border border-border text-foreground hover:bg-muted"
              }`}
            >
              Last {n} days
            </button>
          ))}
        </div>
        {!rangeValid && <p className="text-sm text-destructive">Pick a start date on or before the end date.</p>}
      </div>

      {isError ? (
        <LoadErrorState error={isError} what="acquisition analytics" onRetry={() => refresh()} />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricCard
              label="Answered"
              value={loadingValue ?? total.toLocaleString()}
              tooltip="Learners who picked an answer in the period."
            />
            <MetricCard
              label="Sign-ups"
              value={loadingValue ?? signups.toLocaleString()}
              tooltip="New accounts created in the period."
            />
            <MetricCard
              label="Answer rate"
              value={loadingValue ?? formatRate(rate)}
              subtext={isLoading ? undefined : `${total.toLocaleString()} of ${signups.toLocaleString()} sign-ups`}
              tooltip="Answered ÷ sign-ups. The question can be skipped."
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {/* By source */}
            <Card>
              <CardHeader>
                <CardTitle>Answers by source</CardTitle>
                <CardDescription>Number of learners who picked each answer</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <EmptyChart>Loading…</EmptyChart>
                ) : sourceBars.length === 0 ? (
                  <EmptyChart>No answers in this period</EmptyChart>
                ) : (
                  <ChartContainer
                    config={sourceChartConfig}
                    className="w-full"
                    style={{ height: Math.max(160, sourceBars.length * 36 + 24), aspectRatio: "auto" }}
                    aria-label="Answers by source"
                  >
                    <BarChart data={sourceBars} layout="vertical" margin={{ left: 0, right: 40, top: 0, bottom: 0 }}>
                      <CartesianGrid horizontal={false} />
                      <XAxis type="number" hide allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="source"
                        tickLine={false}
                        axisLine={false}
                        width={140}
                        tickMargin={8}
                      />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator />} />
                      <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} maxBarSize={24}>
                        <LabelList dataKey="count" position="right" className="fill-foreground" fontSize={12} />
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Over time */}
            <Card>
              <CardHeader>
                <CardTitle>Answers over time</CardTitle>
                <CardDescription>
                  Per day, by source
                  {folded.length ? ` · top ${MAX_TIME_SERIES} shown, the rest grouped` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <EmptyChart>Loading…</EmptyChart>
                ) : !hasTimeData ? (
                  <EmptyChart>No answers in this period</EmptyChart>
                ) : (
                  <ChartContainer config={timeChartConfig} className="h-64 w-full" aria-label="Answers per day by source">
                    <BarChart data={overTime} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="day"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={10}
                        minTickGap={16}
                        tickFormatter={(v) => formatDay(String(v))}
                      />
                      <YAxis tickLine={false} axisLine={false} tickMargin={8} width={36} allowDecimals={false} />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent labelFormatter={(v) => formatDay(String(v))} />}
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                      {timeKeys.map((k, i) => (
                        <Bar
                          key={k}
                          dataKey={k}
                          stackId="answers"
                          fill={`var(--color-${k})`}
                          stroke="var(--color-card)"
                          strokeWidth={1}
                          radius={i === timeKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                          maxBarSize={40}
                        />
                      ))}
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Country × source */}
          <Card>
            <CardHeader>
              <CardTitle>By country</CardTitle>
              <CardDescription>Answers per source in each country (from the learner&apos;s sign-up country)</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              {isLoading ? (
                <EmptyChart>Loading…</EmptyChart>
              ) : countries.length === 0 ? (
                <p className="px-6 text-sm text-muted-foreground">No answers in this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border">
                    <thead>
                      <tr>
                        <th className={TH}>Country</th>
                        <th className={TH_NUM}>Total</th>
                        {ranked.map((s) => (
                          <th key={s} className={TH_NUM}>
                            {label(s)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {countries.map((row) => (
                        <tr key={row.country ?? "unknown"}>
                          <td className={`${TD} whitespace-nowrap`}>
                            {row.country ? (
                              <>
                                {countryFlagEmoji(row.country)} {countryName(row.country)}
                              </>
                            ) : (
                              <span className="text-muted-foreground">Unknown</span>
                            )}
                          </td>
                          <td className={`${TD_NUM} font-medium`}>{row.total.toLocaleString()}</td>
                          {ranked.map((s) => (
                            <td key={s} className={TD_NUM}>
                              {row.bySource[s] ? (
                                row.bySource[s].toLocaleString()
                              ) : (
                                <span className="text-muted-foreground/60">·</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Other free text */}
          <Card>
            <CardHeader>
              <CardTitle>&quot;Other&quot; answers</CardTitle>
              <CardDescription>
                What learners typed when none of the options fit. Repeated answers may be worth adding as an option.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <EmptyChart>Loading…</EmptyChart>
              ) : otherTexts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No free-text answers in this period.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {[...otherTexts]
                    .sort((a, b) => b.count - a.count)
                    .map((row, i) => (
                      <li key={`${row.text}-${i}`} className="flex items-start justify-between gap-4 py-2 text-sm">
                        <span className="break-words text-foreground">{maskEmailsInText(row.text)}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">×{row.count.toLocaleString()}</span>
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

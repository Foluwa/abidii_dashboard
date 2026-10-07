"use client";

import React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useUserRetention } from "@/hooks/useApi";
import type { RetentionDayStat } from "@/types/admin-analytics";

const chartConfig = {
  returning: {
    label: "Returning users",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const axisWeekFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function formatPercent(rate: number | null): string {
  if (rate === null) return "—";
  return Number.isInteger(rate) ? `${rate}%` : `${rate.toFixed(1)}%`;
}

function KpiSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
      <div className="h-3 w-12 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-6 w-14 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-2.5 w-20 animate-pulse rounded bg-muted" />
    </div>
  );
}

function RetentionKpi({
  label,
  stat,
}: {
  label: string;
  stat: RetentionDayStat;
}) {
  const unavailable = stat.eligible_users === 0;
  return (
    <div
      className="rounded-lg border border-border bg-muted/40 px-4 py-3"
      title={
        unavailable
          ? "Not enough user history to calculate this metric"
          : `${stat.retained_users} of ${stat.eligible_users} eligible users returned exactly ${label.toLowerCase()} after signing up`
      }
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold text-foreground">
        {formatPercent(stat.rate)}
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">
        {unavailable
          ? "Not enough data"
          : `${stat.retained_users} of ${stat.eligible_users} eligible users`}
      </div>
    </div>
  );
}

/**
 * Day 1/7/30 retention is cohort-based (users who signed up early enough to
 * have completed that window) and is NOT filtered by the dashboard range -
 * incomplete cohorts are never shown as finished. When `range` is set it
 * only sets how many completed weeks the returning-users chart covers.
 */
export default function UserRetentionCard({
  weeks = 4,
  range,
  rangeText,
}: {
  weeks?: number;
  range?: string;
  rangeText?: string;
}) {
  const { data, isLoading, isError, refresh } = useUserRetention(weeks, range);

  const chartData = (data?.weekly_returning_users || []).map((item) => ({
    date: `${item.week_start}T00:00:00Z`,
    returning: item.returning_users,
    active: item.active_users,
  }));

  const summary = data?.monthly_summary;
  const change = summary?.absolute_change ?? 0;
  const changeColor =
    change > 0
      ? "text-green-600 dark:text-green-400"
      : change < 0
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";
  const changeArrow = change > 0 ? "↑" : change < 0 ? "↓" : "→";
  const changeLabel = change > 0 ? "increase" : change < 0 ? "decrease" : "no change";

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>User Retention</CardTitle>
        <CardDescription>
          Day 1/7/30 return rates by signup cohort (completed windows only)
          {rangeText ? ` · weekly returning users: ${rangeText}` : ""}
        </CardDescription>
        <CardAction>
          <button
            type="button"
            onClick={() => refresh()}
            className="text-sm text-primary hover:underline"
          >
            Refresh
          </button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isError ? (
          <div className="flex h-[280px] flex-col items-center justify-center gap-2">
            <p className="text-sm text-destructive">
              Failed to load user retention
              {isError?.response?.status ? ` (HTTP ${isError.response.status})` : ""}
            </p>
            {isError?.message && (
              <p className="max-w-md text-center text-xs text-muted-foreground">
                {isError.message}
              </p>
            )}
            <button
              onClick={() => refresh()}
              className="mt-1 rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/80"
            >
              Retry
            </button>
          </div>
        ) : isLoading ? (
          <div aria-busy="true" aria-label="Loading user retention data">
            <div className="grid grid-cols-3 gap-3">
              <KpiSkeleton />
              <KpiSkeleton />
              <KpiSkeleton />
            </div>
            <div className="mt-4 h-[160px] animate-pulse rounded bg-muted" />
            <div className="mt-4 h-4 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        ) : !data ||
          (data.retention.day_1.eligible_users === 0 &&
            data.retention.day_7.eligible_users === 0 &&
            data.retention.day_30.eligible_users === 0) ? (
          <div className="flex h-[280px] items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Not enough user history to calculate this metric
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <RetentionKpi label="Day 1" stat={data.retention.day_1} />
              <RetentionKpi label="Day 7" stat={data.retention.day_7} />
              <RetentionKpi label="Day 30" stat={data.retention.day_30} />
            </div>

            <div className="mt-4">
              <h4 className="px-1 text-xs font-medium text-foreground">
                Returning users
              </h4>
              {chartData.length === 0 ? (
                <div className="flex h-[160px] items-center justify-center text-sm text-muted-foreground">
                  No weekly activity data available
                </div>
              ) : (
                <ChartContainer config={chartConfig} className="h-[160px] w-full">
                  <AreaChart data={chartData} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="fill-retention-returning" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-returning)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="var(--color-returning)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="4" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      tickMargin={8}
                      axisLine={false}
                      tickFormatter={(value) =>
                        axisWeekFormatter.format(new Date(String(value)))
                      }
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      width={32}
                      tickFormatter={(value) => Math.round(Number(value)).toString()}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(value) =>
                            axisWeekFormatter.format(new Date(String(value)))
                          }
                          formatter={(value, _name, item) => {
                            const active = (item?.payload as { active?: number } | undefined)?.active;
                            return active !== undefined
                              ? `${Number(value).toLocaleString()} returning users (${active.toLocaleString()} active users total)`
                              : `${Number(value).toLocaleString()} returning users`;
                          }}
                        />
                      }
                    />
                    <Area
                      dataKey="returning"
                      type="natural"
                      fill="url(#fill-retention-returning)"
                      stroke="var(--color-returning)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              )}
              <table className="sr-only">
                <caption>Returning users by week</caption>
                <thead>
                  <tr>
                    <th>Week</th>
                    <th>Returning users</th>
                    <th>Active users</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.weekly_returning_users || []).map((item) => (
                    <tr key={item.week_start}>
                      <td>{item.week_start} to {item.week_end}</td>
                      <td>{item.returning_users}</td>
                      <td>{item.active_users}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {summary && (
              <p className="mt-4 px-1 text-sm text-muted-foreground">
                {summary.returning_users} of {summary.eligible_users} users returned this month
                {" · "}
                <span className={changeColor}>
                  <span aria-hidden="true">{changeArrow}</span>{" "}
                  {Math.abs(change)} vs last month ({changeLabel})
                </span>
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

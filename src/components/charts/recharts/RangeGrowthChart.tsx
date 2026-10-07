"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

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
import { useRangeSeries } from "@/hooks/useApi";
import {
  type RangeKey,
  formatBucketLabel,
  formatBucketTick,
  perGranularity,
  rangeLabel,
} from "@/lib/dashboardRange";

const COPY = {
  "user-growth": {
    title: "User Growth",
    noun: "New accounts",
    empty: "No new accounts in this period",
    error: "Failed to load user growth",
    color: "var(--chart-1)",
  },
  "subscriber-growth": {
    title: "Subscriber Growth",
    noun: "First-time subscribers",
    empty: "No new subscribers in this period",
    error: "Failed to load subscriber growth",
    color: "var(--chart-2)",
  },
} as const;

/**
 * New accounts / first-time subscribers across the dashboard range, grouped
 * by day (7d, 30d), week (6m) or month (1y, all). Buckets cut by the range
 * bounds - or still in progress - are drawn faded and marked "(partial)".
 */
export function RangeGrowthChart({
  kind,
  range,
}: {
  kind: "user-growth" | "subscriber-growth";
  range: RangeKey;
}) {
  const copy = COPY[kind];
  const { data, isLoading, isError } = useRangeSeries(kind, range);
  const granularity = data?.range.granularity;
  const points = (data?.data ?? []).map((p) => ({
    start: p.period_start,
    end: p.period_end,
    partial: p.partial,
    value: p.count,
  }));
  const config = {
    value: { label: copy.noun, color: copy.color },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>
          {copy.noun} {perGranularity(granularity)} · {rangeLabel(range)}
        </CardDescription>
        <CardAction>
          {data && (
            <span className="text-2xl font-semibold tabular-nums leading-none">
              {data.total.toLocaleString()}
            </span>
          )}
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : isError ? (
          <div className="flex h-64 items-center justify-center text-sm text-destructive">
            {copy.error}
          </div>
        ) : points.length === 0 || data?.total === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            {copy.empty}
          </div>
        ) : (
          <ChartContainer config={config} className="h-64 w-full">
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
              <YAxis tickLine={false} axisLine={false} tickMargin={8} width={36} allowDecimals={false} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => {
                      const p = payload?.[0]?.payload as
                        | { start: string; end: string; partial: boolean }
                        | undefined;
                      return p ? formatBucketLabel(p.start, p.end, granularity, p.partial) : "";
                    }}
                  />
                }
              />
              <Bar dataKey="value" fill="var(--color-value)" radius={[6, 6, 0, 0]} maxBarSize={40}>
                {points.map((p) => (
                  <Cell key={p.start} fillOpacity={p.partial ? 0.45 : 1} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          {kind === "user-growth"
            ? "Accounts created in the period (deleted accounts excluded)."
            : "Users whose first active or trial subscription started in the period."}{" "}
          UTC days.
        </p>
      </CardContent>
    </Card>
  );
}

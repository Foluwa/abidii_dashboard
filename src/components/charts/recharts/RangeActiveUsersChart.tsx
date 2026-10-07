"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

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
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useRangeSeries } from "@/hooks/useApi";
import {
  type RangeKey,
  formatBucketLabel,
  formatBucketTick,
  rangeLabel,
} from "@/lib/dashboardRange";

const chartConfig = {
  returning: { label: "Returning", color: "var(--chart-1)" },
  new: { label: "New", color: "var(--chart-2)" },
} satisfies ChartConfig;

const TITLES = {
  day: { title: "Daily Active Users", unit: "DAU" },
  week: { title: "Weekly Active Users", unit: "WAU" },
  month: { title: "Monthly Active Users", unit: "MAU" },
} as const;

/**
 * Distinct active learners per day (DAU), week (WAU) or month (MAU) for the
 * dashboard range, split into new (account created in the same bucket) and
 * returning. The headline number is distinct learners across the whole
 * range - not the sum of buckets, which would count people repeatedly.
 */
export function RangeActiveUsersChart({ range }: { range: RangeKey }) {
  const { data, isLoading, isError } = useRangeSeries("active-users", range);
  const granularity = data?.range.granularity ?? "day";
  const titles = TITLES[granularity];
  const points = (data?.data ?? []).map((p) => ({
    start: p.period_start,
    end: p.period_end,
    partial: p.partial,
    returning: p.returning_users ?? 0,
    new: p.new_users ?? 0,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{titles.title}</CardTitle>
        <CardDescription>
          Distinct active learners ({titles.unit}) · {rangeLabel(range)}
        </CardDescription>
        <CardAction>
          {data && (
            <div className="text-right">
              <div className="text-2xl font-semibold tabular-nums leading-none">
                {data.total.toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">active in period</div>
            </div>
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
            Failed to load active users
          </div>
        ) : points.length === 0 || data?.total === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            No learner activity in this period
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-64 w-full">
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
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="returning" stackId="a" fill="var(--color-returning)" maxBarSize={40} />
              <Bar
                dataKey="new"
                stackId="a"
                fill="var(--color-new)"
                radius={[6, 6, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ChartContainer>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          A learner counts once per bucket. “New” = account created in the same
          bucket. UTC days.
        </p>
      </CardContent>
    </Card>
  );
}

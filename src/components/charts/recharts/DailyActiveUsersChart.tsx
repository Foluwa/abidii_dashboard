"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useDailyActiveUsers } from "@/hooks/useApi";

interface DailyActiveUsersItem {
  date: string;
  count: number;
  new_users?: number;
  returning_users?: number;
}

const chartConfig = {
  returning: {
    label: "Returning users",
    color: "var(--chart-1)",
  },
  new: {
    label: "New users",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const axisDayFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function DailyActiveUsersChart({ days = 30 }: { days?: number }) {
  const { data: dauData, average, isLoading, isError } = useDailyActiveUsers(days);

  const hasSplit = (dauData ?? []).some(
    (item: DailyActiveUsersItem) => typeof item.new_users === "number"
  );

  const chartData = (dauData ?? []).map((item: DailyActiveUsersItem) => ({
    date: `${item.date}T00:00:00Z`,
    returning: item.returning_users ?? 0,
    new: item.new_users ?? 0,
    total: item.count,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Active Users</CardTitle>
        <CardDescription>
          Distinct users with a session per day, last {days} days
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : isError ? (
          <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
            Failed to load daily active users
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
            No activity data available
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-52 w-full">
            <AreaChart data={chartData} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fill-returning" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-returning)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-returning)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fill-new" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-new)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-new)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="4" />
              <XAxis
                dataKey="date"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) =>
                  axisDayFormatter.format(new Date(String(value)))
                }
              />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} width={40} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) =>
                      axisDayFormatter.format(new Date(String(value)))
                    }
                  />
                }
              />
              {hasSplit ? (
                <>
                  <Area
                    dataKey="returning"
                    type="natural"
                    fill="url(#fill-returning)"
                    stroke="var(--color-returning)"
                    strokeWidth={2}
                    stackId="a"
                  />
                  <Area
                    dataKey="new"
                    type="natural"
                    fill="url(#fill-new)"
                    stroke="var(--color-new)"
                    strokeWidth={2}
                    stackId="a"
                  />
                </>
              ) : (
                <Area
                  dataKey="total"
                  type="natural"
                  fill="url(#fill-returning)"
                  stroke="var(--color-returning)"
                  strokeWidth={2}
                />
              )}
            </AreaChart>
          </ChartContainer>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Avg: {average.toLocaleString(undefined, { maximumFractionDigits: 1 })}/day
        </p>
      </CardContent>
    </Card>
  );
}

"use client";

import { Cell, Pie, PieChart } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { usePlatformDistribution } from "@/hooks/useApi";

// Explicit bright hex (SVG `fill` presentation attributes don't resolve
// CSS `var()`, so the donut cells need concrete colours).
const platformConfig: Record<string, { label: string; color: string }> = {
  ios: { label: "iOS", color: "#38BDF8" },
  android: { label: "Android", color: "#34D399" },
  unknown: { label: "Unknown", color: "#A78BFA" },
};

const chartConfig = {
  ios: { label: "iOS", color: "#38BDF8" },
  android: { label: "Android", color: "#34D399" },
  unknown: { label: "Unknown", color: "#A78BFA" },
} satisfies ChartConfig;

export function PlatformDistributionChart() {
  const { distribution, total, isLoading, isError } = usePlatformDistribution();

  const chartData: { name: string; label: string; count: number; color: string }[] =
    distribution.map((item: { platform: string; count: number }) => {
      const key = item.platform?.toLowerCase() || "unknown";
      const cfg = platformConfig[key] || {
        label: item.platform,
        color: "#FB7185",
      };
      return { name: key, label: cfg.label, count: item.count, color: cfg.color };
    });
  const resolvedTotal =
    total > 0
      ? total
      : chartData.reduce((s: number, d) => s + d.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform Distribution</CardTitle>
        <CardDescription>
          Users by device operating system
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : isError ? (
          <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
            Failed to load platform data
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
            No platform distribution data available
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <ChartContainer config={chartConfig} className="h-44 w-full">
              <PieChart>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      hideLabel
                      formatter={(value) => {
                        const pct =
                          resolvedTotal > 0
                            ? ((Number(value) / resolvedTotal) * 100).toFixed(1)
                            : "0";
                        return `${value.toLocaleString()} users (${pct}%)`;
                      }}
                    />
                  }
                />
                <Pie
                  data={chartData}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={45}
                  outerRadius={70}
                  strokeWidth={2}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
              </PieChart>
            </ChartContainer>
            <div className="grid w-full grid-cols-3 gap-2">
              {chartData.map((entry) => (
                <div
                  key={entry.name}
                  className="flex flex-col items-center gap-1 rounded-lg border border-border p-2 text-center"
                >
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    {entry.label}
                  </div>
                  <span className="text-lg font-semibold tabular-nums">
                    {entry.count.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {resolvedTotal > 0
                      ? ((entry.count / resolvedTotal) * 100).toFixed(1)
                      : 0}
                    %
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

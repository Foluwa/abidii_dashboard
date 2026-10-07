"use client";

import { Cell, Pie, PieChart } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { usePlatformDistribution } from "@/hooks/useApi";
import { chartTheme } from "@/components/charts/chartTheme";
import { useTheme } from "@/context/ThemeContext";

interface PlatformSlice {
  name: string;
  label: string;
  count: number;
  color: string;
}

/**
 * Signed-in (Google/Apple) accounts by the platform of their most recently
 * used device - a current snapshot, so the dashboard's date range does not
 * apply. The centred total is always the sum of the slices shown, so it can
 * never disagree with the segments/legend.
 */
export function PlatformDistributionChart() {
  const { distribution, isLoading, isError } = usePlatformDistribution();
  const { theme } = useTheme();
  const colors = chartTheme(theme).colors;

  const config: Record<string, { label: string; color: string }> = {
    ios: { label: "iOS", color: colors[0] },
    android: { label: "Android", color: colors[1] },
    unknown: { label: "Unknown", color: colors[3] },
  };

  const chartData: PlatformSlice[] = (
    distribution as { platform?: string | null; count?: number | string }[]
  )
    .map((item) => {
      const key = item.platform?.toLowerCase() || "unknown";
      const cfg = config[key] || { label: item.platform || "Unknown", color: colors[4] };
      return {
        name: key,
        label: cfg.label,
        count: Number(item.count) || 0,
        color: cfg.color,
      };
    })
    .filter((d) => d.count > 0);

  const resolvedTotal = chartData.reduce((s, d) => s + d.count, 0);

  const chartConfig = {
    ios: { label: "iOS", color: config.ios.color },
    android: { label: "Android", color: config.android.color },
    unknown: { label: "Unknown", color: config.unknown.color },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform Distribution</CardTitle>
        <CardDescription>
          Signed-in users by their latest device · current, all time
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
            <div className="relative h-44 w-44">
              <ChartContainer config={chartConfig} className="h-44 w-44">
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
                          return `${Number(value).toLocaleString()} users (${pct}%)`;
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
                </PieChart>
              </ChartContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-semibold tabular-nums text-foreground">
                  {resolvedTotal.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground">Total users</span>
              </div>
            </div>
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

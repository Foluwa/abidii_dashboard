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
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useMonthlyUserGrowth } from "@/hooks/useApi";

interface GrowthDataItem {
  month: string;
  count: number;
}

const chartConfig = {
  users: {
    label: "New Users",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const axisMonthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });
const tooltipMonthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "2-digit",
});

function transform(data: GrowthDataItem[]) {
  return data
    .map((item) => {
      const [year, month] = String(item.month || "")
        .split("-")
        .map((v) => Number(v));
      if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
        return null;
      }
      return {
        date: new Date(Date.UTC(year, month - 1, 1)).toISOString(),
        users: item.count,
      };
    })
    .filter((p): p is { date: string; users: number } => p !== null);
}

export function MonthlyUserGrowthChart() {
  const { data: growthData, isLoading, isError } = useMonthlyUserGrowth(12);
  const chartData = transform(growthData ?? []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly User Growth</CardTitle>
        <CardDescription>
          New users per month over the last 12 months
        </CardDescription>
        <CardAction>
          <span className="text-xs text-muted-foreground">Last 12 months</span>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : isError ? (
          <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
            Failed to load monthly user growth
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
            No monthly user growth data available
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-72 w-full">
            <BarChart data={chartData} barSize={38} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
              <defs>
                <pattern
                  id="growth-users-pattern"
                  width="4"
                  height="4"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <rect width="6" height="6" fill="var(--color-users)" fillOpacity="0.15" />
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="6"
                    stroke="var(--color-users)"
                    strokeWidth="1.25"
                    strokeOpacity="0.4"
                  />
                </pattern>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="0" />
              <XAxis
                dataKey="date"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) =>
                  axisMonthFormatter.format(new Date(String(value)))
                }
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={40}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    hideIndicator
                    labelFormatter={(value) =>
                      tooltipMonthFormatter.format(new Date(String(value)))
                    }
                  />
                }
              />
              <Bar
                dataKey="users"
                fill="url(#growth-users-pattern)"
                radius={[8, 8, 0, 0]}
                stroke="var(--color-users)"
                strokeOpacity={0.5}
                strokeWidth={0.5}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

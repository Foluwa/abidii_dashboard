"use client";
import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chartTheme } from "@/components/charts/chartTheme";
import { useTheme } from "@/context/ThemeContext";

interface RoomsTimeSeriesChartProps {
  title: string;
  categories: string[];
  series: { name: string; data: number[] }[];
  colors?: string[];
  height?: number;
}

/**
 * Presentational multi-series bar chart for room-analytics daily
 * breakdowns (rooms_by_day, participation_by_day). Data/loading/error
 * states are owned by the parent page - this only renders what it's given.
 */
export default function RoomsTimeSeriesChart({
  title,
  categories,
  series,
  colors,
  height = 220,
}: RoomsTimeSeriesChartProps) {
  const { theme } = useTheme();
  const c = chartTheme(theme);
  const resolvedColors = colors ?? c.colors;

  const data = categories.map((category, index) => {
    const row: Record<string, string | number> = { category };
    series.forEach((s) => {
      row[s.name] = s.data[index] ?? 0;
    });
    return row;
  });

  const hasData = categories.length > 0 && series.some((s) => s.data.some((v) => v > 0));

  return (
    <div className="overflow-hidden">
      <h3 className="px-1 pb-2 text-sm font-medium text-gray-700 dark:text-gray-300">{title}</h3>
      {hasData ? (
        <div className="max-w-full overflow-x-auto custom-scrollbar">
          <div className="min-w-[600px]" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4" vertical={false} stroke={c.grid} />
                <XAxis
                  dataKey="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: c.text, fontSize: 12, fontFamily: c.fontFamily }}
                  tickMargin={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: c.text, fontSize: 12, fontFamily: c.fontFamily }}
                  width={40}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}
                  contentStyle={{
                    background: theme === "dark" ? "#18181b" : "#ffffff",
                    border: `1px solid ${c.grid}`,
                    borderRadius: 8,
                    fontFamily: c.fontFamily,
                    fontSize: 12,
                    color: c.heading,
                  }}
                  labelStyle={{ color: c.heading }}
                  itemStyle={{ color: c.text }}
                  formatter={(value) => String(value)}
                />
                <Legend
                  verticalAlign="top"
                  align="left"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontFamily: c.fontFamily, fontSize: 12, color: c.text, paddingBottom: 8 }}
                />
                {series.map((s, index) => (
                  <Bar
                    key={s.name}
                    dataKey={s.name}
                    fill={resolvedColors[index % resolvedColors.length]}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div
          className="flex items-center justify-center text-sm text-gray-500 dark:text-gray-400"
          style={{ height }}
        >
          No activity in this period
        </div>
      )}
    </div>
  );
}

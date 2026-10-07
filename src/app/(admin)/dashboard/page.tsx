"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen,
  CreditCard,
  FileAudio,
  FileWarning,
  Grid3x3,
  TrendingDown,
  TrendingUp,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react";

import { useRangeSummary, useSystemStatus, useSystemStats } from "@/hooks/useApi";
import type { RangeSummaryMetric } from "@/hooks/useApi";
import { StyledSelect } from "@/components/ui/form/StyledSelect";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RangeGrowthChart } from "@/components/charts/recharts/RangeGrowthChart";
import { RangeActiveUsersChart } from "@/components/charts/recharts/RangeActiveUsersChart";
import { PlatformDistributionChart } from "@/components/charts/recharts/PlatformDistributionChart";
import CountryMap from "@/components/ecommerce/CountryMap";
import RecentActivityFeed from "@/components/dashboard/RecentActivityFeed";
import BillingPlansCard from "@/components/billing/BillingPlansCard";
import UserRetentionCard from "@/components/analytics/UserRetentionCard";
import {
  RANGE_OPTIONS,
  type RangeKey,
  DEFAULT_RANGE,
  parseRange,
  previousPeriodLabel,
  rangeLabel,
} from "@/lib/dashboardRange";

const positive =
  "border-green-200 bg-green-500/10 text-green-700 dark:border-green-900/40 dark:bg-green-500/15 dark:text-green-300";
const negative = "border-destructive/20 bg-destructive/10 text-destructive";

/** "+12%" style change vs the previous equal-length period. */
function Delta({ metric }: { metric?: RangeSummaryMetric }) {
  if (!metric || metric.previous === null || metric.previous === undefined) return null;
  const { value, previous } = metric;
  if (previous === 0) {
    if (value === 0) return null;
    return (
      <Badge variant="outline" className={positive}>
        <TrendingUp />
        New
      </Badge>
    );
  }
  const pct = ((value - previous) / previous) * 100;
  const up = pct >= 0;
  return (
    <Badge variant="outline" className={up ? positive : negative}>
      {up ? <TrendingUp /> : <TrendingDown />}
      {up ? "+" : ""}
      {pct.toFixed(Math.abs(pct) < 10 ? 1 : 0)}%
    </Badge>
  );
}

function KpiCard({
  label,
  icon: Icon,
  value,
  loading,
  metric,
  footnote,
  range,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: number | undefined;
  loading: boolean;
  metric?: RangeSummaryMetric;
  footnote: string;
  range?: RangeKey;
}) {
  const comparison = range ? previousPeriodLabel(range) : null;
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardAction>
          <Icon className="size-4 text-muted-foreground" />
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-3xl leading-none tracking-tight tabular-nums">
            {loading ? "—" : (value ?? 0).toLocaleString()}
          </span>
          {!loading && <Delta metric={metric} />}
        </div>
        <p className="text-sm">
          {metric && metric.previous !== null && comparison ? (
            <>
              <span className="font-medium text-foreground">
                {metric.previous.toLocaleString()}
              </span>{" "}
              <span className="text-muted-foreground">{comparison}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{footnote}</span>
          )}
        </p>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { status, isError: statusError } = useSystemStatus();
  const { stats, isLoading: statsLoading } = useSystemStats();

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The URL is the source of truth: refresh, back/forward and shared links
  // all keep the selected range; other query params are preserved.
  const range = parseRange(searchParams.get("range"));
  const label = rangeLabel(range);
  const { data: summary, isLoading: summaryLoading } = useRangeSummary(range);

  const handleRangeChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === DEFAULT_RANGE) {
      params.delete("range");
    } else {
      params.set("range", value);
    }
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl tracking-tight text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Learners, subscriptions and platform health for Abidii. Period
              figures use UTC days.
            </p>
          </div>
          <div className="w-48">
            <StyledSelect
              label="Date range"
              value={range}
              onValueChange={handleRangeChange}
              options={RANGE_OPTIONS}
              fullWidth
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label={`New Users · ${label}`}
            icon={UserPlus}
            value={summary?.new_users.value}
            loading={summaryLoading}
            metric={summary?.new_users}
            footnote="Accounts created in the period"
            range={range}
          />
          <KpiCard
            label={`Active Learners · ${label}`}
            icon={UserRound}
            value={summary?.active_users.value}
            loading={summaryLoading}
            metric={summary?.active_users}
            footnote="Distinct learners active in the period"
            range={range}
          />
          <KpiCard
            label={`New Subscribers · ${label}`}
            icon={CreditCard}
            value={summary?.new_subscribers.value}
            loading={summaryLoading}
            metric={summary?.new_subscribers}
            footnote="First-time subscribers in the period"
            range={range}
          />
          <KpiCard
            label="Total Users · All time"
            icon={Users}
            value={stats?.total_users}
            loading={statsLoading}
            footnote="Lifetime total, not affected by the range"
          />
        </div>

        <Card className="py-4">
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex items-center justify-between gap-3 sm:block">
              <div className="text-xs text-muted-foreground">Active today · now</div>
              <div className="text-xl font-medium tabular-nums">
                {statsLoading ? "—" : (stats?.active_users_today ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 sm:block">
              <div className="text-xs text-muted-foreground">Lesson blueprints · current</div>
              <div className="text-xl font-medium tabular-nums">
                {statsLoading ? "—" : (stats?.total_lessons ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 sm:block">
              <div className="text-xs text-muted-foreground">Dictionary words · current</div>
              <div className="text-xl font-medium tabular-nums">
                {statsLoading ? "—" : (stats?.total_words ?? 0).toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {statusError && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">
            Failed to load system status. Please check your API connection.
          </CardContent>
        </Card>
      )}

      {status && (
        <Card>
          <CardHeader>
            <CardDescription>System Health</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Monitoring</div>
                <Badge
                  variant="outline"
                  className={
                    status.monitoring_enabled
                      ? "border-green-200 bg-green-500/10 text-green-700 dark:border-green-900/40 dark:bg-green-500/15 dark:text-green-300"
                      : "border-destructive/20 bg-destructive/10 text-destructive"
                  }
                >
                  {status.monitoring_enabled ? "Online" : "Offline"}
                </Badge>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Telegram</div>
                <Badge
                  variant="outline"
                  className={
                    status.telegram_connected
                      ? "border-green-200 bg-green-500/10 text-green-700 dark:border-green-900/40 dark:bg-green-500/15 dark:text-green-300"
                      : "border-destructive/20 bg-destructive/10 text-destructive"
                  }
                >
                  {status.telegram_connected ? "Connected" : "Disconnected"}
                </Badge>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Circuit Breaker</div>
                <Badge
                  variant="outline"
                  className={
                    status.circuit_breaker_open
                      ? "border-destructive/20 bg-destructive/10 text-destructive"
                      : "border-green-200 bg-green-500/10 text-green-700 dark:border-green-900/40 dark:bg-green-500/15 dark:text-green-300"
                  }
                >
                  {status.circuit_breaker_open ? "Open" : "Closed"}
                </Badge>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Alert Queue</div>
                <div className="text-lg font-medium tabular-nums">
                  {status.alert_queue_size}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Uptime</div>
                <div className="text-lg font-medium tabular-nums">
                  {Math.floor(status.uptime_seconds / 3600)}h
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Config Cache</div>
                <div className="text-lg font-medium tabular-nums">
                  {Math.floor(status.config_cache_age_seconds)}s
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        <RangeGrowthChart kind="user-growth" range={range} />
        <RangeActiveUsersChart range={range} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        <RangeGrowthChart kind="subscriber-growth" range={range} />
        <UserRetentionCard range={range} rangeText={label} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        <PlatformDistributionChart />
        <Card>
          <CardHeader>
            <CardDescription>Customer Demographics</CardDescription>
            <span className="text-xs text-muted-foreground">
              All users by last known country · current, all time
            </span>
          </CardHeader>
          <CardContent>
            <CountryMap />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        <BillingPlansCard />
        <Card>
          <CardHeader>
            <CardDescription>Recent Activity</CardDescription>
            <span className="text-xs text-muted-foreground">
              Latest admin and subscription events · {label}
            </span>
          </CardHeader>
          <CardContent>
            <RecentActivityFeed range={range} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardDescription>Quick Actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/content/words"
              className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 text-center text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Grid3x3 className="size-5 text-muted-foreground" />
              Words Import
            </Link>
            <Link
              href="/curriculum/lesson-blueprints"
              className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 text-center text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <BookOpen className="size-5 text-muted-foreground" />
              Lesson Blueprints
            </Link>
            <Link
              href="/audio?tab=jobs"
              className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 text-center text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <FileAudio className="size-5 text-muted-foreground" />
              Audio Jobs
            </Link>
            <Link
              href="/content/ops?tab=orphans"
              className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 text-center text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <FileWarning className="size-5 text-muted-foreground" />
              Orphan Assets
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

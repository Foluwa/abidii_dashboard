"use client";

import React from "react";
import Link from "next/link";
import { BookOpen, Grid3x3, Users, UserRound } from "lucide-react";

import { useSystemStatus, useSystemStats } from "@/hooks/useApi";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MonthlyUserGrowthChart } from "@/components/charts/recharts/MonthlyUserGrowthChart";
import { DailyActiveUsersChart } from "@/components/charts/recharts/DailyActiveUsersChart";
import { PlatformDistributionChart } from "@/components/charts/recharts/PlatformDistributionChart";
import { MonthlySubscriberGrowthChart } from "@/components/charts/recharts/MonthlySubscriberGrowthChart";
import CountryMap from "@/components/ecommerce/CountryMap";
import RecentActivityFeed from "@/components/dashboard/RecentActivityFeed";
import BillingPlansCard from "@/components/billing/BillingPlansCard";
import UserRetentionCard from "@/components/analytics/UserRetentionCard";

export default function Dashboard() {
  const { status, isError: statusError } = useSystemStatus();
  const { stats, isLoading: statsLoading } = useSystemStats();

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <section className="space-y-5">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitor and manage your language learning platform.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader>
              <CardDescription>Total Users</CardDescription>
              <CardAction>
                <Users className="size-4 text-muted-foreground" />
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-2">
              <span className="text-3xl leading-none tracking-tight">
                {statsLoading
                  ? "—"
                  : (stats?.total_users ?? 0).toLocaleString()}
              </span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Active Today</CardDescription>
              <CardAction>
                <UserRound className="size-4 text-muted-foreground" />
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-3xl leading-none tracking-tight">
                  {statsLoading
                    ? "—"
                    : (stats?.active_users_today ?? 0).toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Lesson Blueprints</CardDescription>
              <CardAction>
                <BookOpen className="size-4 text-muted-foreground" />
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-2">
              <span className="text-3xl leading-none tracking-tight">
                {statsLoading
                  ? "—"
                  : (stats?.total_lessons ?? 0).toLocaleString()}
              </span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Total Words</CardDescription>
              <CardAction>
                <Grid3x3 className="size-4 text-muted-foreground" />
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-2">
              <span className="text-3xl leading-none tracking-tight">
                {statsLoading
                  ? "—"
                  : (stats?.total_words ?? 0).toLocaleString()}
              </span>
            </CardContent>
          </Card>
        </div>
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
        <BillingPlansCard />
        <UserRetentionCard />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        <MonthlyUserGrowthChart />
        <PlatformDistributionChart />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MonthlySubscriberGrowthChart />
        <Card>
          <CardHeader>
            <CardDescription>Customer Demographics</CardDescription>
            <span className="text-xs text-muted-foreground">
              Geographic distribution of users worldwide
            </span>
          </CardHeader>
          <CardContent>
            <CountryMap />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        <DailyActiveUsersChart />
        <Card>
          <CardHeader>
            <CardDescription>Recent Activity</CardDescription>
            <span className="text-xs text-muted-foreground">
              Latest admin and subscription events
            </span>
          </CardHeader>
          <CardContent>
            <RecentActivityFeed />
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
              href="/audio/jobs"
              className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 text-center text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Grid3x3 className="size-5 text-muted-foreground" />
              Audio Jobs
            </Link>
            <Link
              href="/content/audit-log/orphan-assets"
              className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 text-center text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Grid3x3 className="size-5 text-muted-foreground" />
              Orphan Assets
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

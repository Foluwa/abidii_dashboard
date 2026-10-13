"use client";

import React, { useState } from "react";
import { useEmailSignInAnalytics } from "@/hooks/useApi";
import type { EmailSignInBreakdown } from "@/types/admin-analytics";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Alert from "@/components/ui/alert/SimpleAlert";
import { StyledSelect } from "@/components/ui/form/StyledSelect";
import AnalyticsTabs from "@/components/analytics/AnalyticsTabs";
import RoomsTimeSeriesChart from "@/components/charts/RoomsTimeSeriesChart";

const formatDateShort = (dateStr: string) =>
  new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("default", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

const formatPercent = (rate: number | null) => (rate == null ? "—" : `${(rate * 100).toFixed(0)}%`);

const formatSeconds = (seconds: number | null) => {
  if (seconds == null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
};

const PLATFORM_LABELS: Record<string, string> = { ios: "iPhone", android: "Android", unknown: "Unknown" };
const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  fr: "French",
  es: "Spanish",
  pt: "Portuguese",
  yo: "Yorùbá",
  unknown: "Unknown",
};

const LIMIT_LABELS: Record<string, string> = {
  resend_wait: "Resend within 60 s",
  email_hourly: "5 codes per address per hour",
  email_daily: "10 codes per address per day",
  ip_hourly: "10 codes per network per hour",
  locked: "Address locked",
};

/** A low verify rate is the main warning sign (spam folder, confusing email
 * or screen); colour it so it stands out. */
const rateClass = (rate: number | null) =>
  rate == null
    ? "text-muted-foreground"
    : rate >= 0.7
      ? "text-green-600 dark:text-green-400"
      : rate >= 0.4
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";

function BreakdownTable({
  title,
  rows,
  labels,
}: {
  title: string;
  rows: EmailSignInBreakdown[];
  labels: Record<string, string>;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 overflow-x-auto">
      <h3 className="text-sm font-medium text-foreground mb-3">{title}</h3>
      {rows.length ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 pr-3 font-medium"></th>
              <th className="py-1 pr-3 font-medium text-right">Addresses</th>
              <th className="py-1 pr-3 font-medium text-right">Codes</th>
              <th className="py-1 pr-3 font-medium text-right">Verified</th>
              <th className="py-1 pr-3 font-medium text-right">Rate</th>
              <th className="py-1 font-medium text-right">Median time</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-border">
                <td className="py-2 pr-3 text-foreground">{labels[row.key] ?? row.key}</td>
                <td className="py-2 pr-3 text-right">{row.addresses.toLocaleString()}</td>
                <td className="py-2 pr-3 text-right">{row.codes_sent.toLocaleString()}</td>
                <td className="py-2 pr-3 text-right">{row.verified.toLocaleString()}</td>
                <td className={`py-2 pr-3 text-right font-medium ${rateClass(row.verify_rate)}`}>
                  {formatPercent(row.verify_rate)}
                </td>
                <td className="py-2 text-right">{formatSeconds(row.median_seconds_to_verify)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-muted-foreground">No data in this period.</p>
      )}
    </div>
  );
}

export default function EmailSignInAnalyticsPage() {
  const [days, setDays] = useState(30);
  const { analytics, isLoading, isError, refresh } = useEmailSignInAnalytics(days);

  if (isError) {
    const errMsg = isError?.response?.data?.detail || isError?.message || "Failed to load email sign-in analytics.";
    const status = isError?.response?.status;
    return (
      <div className="p-6 space-y-4">
        <Alert variant="error">
          <div className="font-medium">Failed to load email sign-in analytics</div>
          <div className="text-sm mt-1">
            {errMsg}
            {status ? ` (HTTP ${status})` : ""}
          </div>
        </Alert>
        <button
          onClick={() => refresh()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const funnel = analytics?.funnel;
  const abuse = analytics?.abuse;
  const daily = analytics?.daily || [];

  const summaryCards: { label: string; value: React.ReactNode; hint?: string; className?: string }[] = funnel
    ? [
        { label: "Addresses sent a code", value: funnel.addresses.toLocaleString() },
        {
          label: "Codes sent",
          value: funnel.codes_sent.toLocaleString(),
          hint: `${funnel.resends.toLocaleString()} resends`,
        },
        { label: "Verified", value: funnel.verified.toLocaleString() },
        {
          label: "Verify rate",
          value: formatPercent(funnel.verify_rate),
          className: rateClass(funnel.verify_rate),
          hint: "Verified ÷ addresses",
        },
        { label: "Median time to verify", value: formatSeconds(funnel.median_seconds_to_verify) },
        {
          label: "Expired, never verified",
          value: funnel.expired_unverified.toLocaleString(),
          hint: `${funnel.not_verified.toLocaleString()} not verified in total`,
        },
        { label: "New accounts by email", value: funnel.new_accounts.toLocaleString() },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <PageBreadCrumb pageTitle="Email Sign-in Analytics" />
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in with an emailed 6-digit code. Built from hashed records only: no email addresses are stored
            or shown. A low verify rate usually means the code email went to spam.
          </p>
        </div>
        <button
          onClick={() => refresh()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          Refresh Data
        </button>
      </div>

      <AnalyticsTabs />

      <div className="bg-card border border-border rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StyledSelect
            label="Time Period"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            options={[
              { value: 1, label: "Today" },
              { value: 7, label: "Last 7 Days" },
              { value: 30, label: "Last 30 Days" },
              { value: 90, label: "Last 90 Days" },
            ]}
            helperText="Records are kept for 90 days."
            fullWidth
          />
        </div>
      </div>

      {/* Funnel */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
          {summaryCards.map(({ label, value, hint, className }) => (
            <div key={label} className="p-4 bg-card border border-border rounded-lg">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className={`text-2xl font-semibold ${className ?? "text-foreground"}`}>{value}</p>
              {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Daily */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-card border border-border rounded-lg p-4">
          {isLoading ? (
            <div className="h-[220px] bg-muted rounded-lg animate-pulse" />
          ) : (
            <RoomsTimeSeriesChart
              title="Codes Sent vs Verified"
              categories={daily.map((d) => formatDateShort(d.date))}
              series={[
                { name: "Codes sent", data: daily.map((d) => d.codes_sent) },
                { name: "Verified", data: daily.map((d) => d.verified) },
                { name: "Expired", data: daily.map((d) => d.expired) },
              ]}
              colors={["#38bdf8", "#34d399", "#f59e0b"]}
            />
          )}
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          {isLoading ? (
            <div className="h-[220px] bg-muted rounded-lg animate-pulse" />
          ) : (
            <RoomsTimeSeriesChart
              title="Wrong Codes and Limits Hit"
              categories={daily.map((d) => formatDateShort(d.date))}
              series={[
                { name: "Wrong codes", data: daily.map((d) => d.wrong) },
                { name: "Limits hit", data: daily.map((d) => d.limited) },
              ]}
              colors={["#f87171", "#a78bfa"]}
            />
          )}
        </div>
      </div>

      {/* Breakdowns */}
      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownTable title="By Platform" rows={analytics?.by_platform || []} labels={PLATFORM_LABELS} />
        <BreakdownTable title="By App Language" rows={analytics?.by_language || []} labels={LANGUAGE_LABELS} />
      </div>

      {/* Abuse */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-foreground mb-3">Limits Hit</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground">Wrong codes entered</span>
              <span className="text-muted-foreground">{(abuse?.wrong_codes ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground">Address locks (1 hour)</span>
              <span className="text-muted-foreground">{(abuse?.locks ?? 0).toLocaleString()}</span>
            </div>
            {(abuse?.limited_by_reason || []).map((row) => (
              <div key={row.reason} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{LIMIT_LABELS[row.reason] ?? row.reason}</span>
                <span className="text-muted-foreground">{row.count.toLocaleString()}</span>
              </div>
            ))}
            {!abuse?.limited_by_reason?.length && !isLoading && (
              <p className="text-sm text-muted-foreground">No limits hit in this period.</p>
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-foreground mb-1">Locked Addresses</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Shown by hash. To check one address, ask Claude to hash it the same way.
          </p>
          <div className="space-y-2">
            {(abuse?.locked_addresses || []).map((row) => (
              <div key={row.address} className="flex items-center justify-between text-sm">
                <span className="font-mono text-foreground">{row.address}…</span>
                <span className="text-muted-foreground">
                  {row.locks}× · {formatDateShort(row.last_locked_at.slice(0, 10))}
                </span>
              </div>
            ))}
            {!abuse?.locked_addresses?.length && !isLoading && (
              <p className="text-sm text-muted-foreground">None in this period.</p>
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-foreground mb-1">Busiest Networks</h3>
          <p className="text-xs text-muted-foreground mb-3">
            By hashed IP. Many addresses from one network can mean someone is testing emails.
          </p>
          <div className="space-y-2">
            {(abuse?.busiest_networks || []).map((row) => (
              <div key={row.network} className="flex items-center justify-between text-sm">
                <span className="font-mono text-foreground">{row.network}…</span>
                <span className="text-muted-foreground">
                  {row.codes_sent} codes · {row.addresses} addr.{row.limited ? ` · ${row.limited} limited` : ""}
                </span>
              </div>
            ))}
            {!abuse?.busiest_networks?.length && !isLoading && (
              <p className="text-sm text-muted-foreground">None in this period.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

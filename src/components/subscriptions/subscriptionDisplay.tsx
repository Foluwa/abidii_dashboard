"use client";

import React from "react";
import { UserAvatar } from "@/components/common/UserAvatar";

/**
 * Shared display helpers for the Subscriptions / Subscription Events /
 * Verification Attempts tables: plan + status pills and the user cell.
 *
 * The dashboard has no i18n layer - labels are plain English, like the
 * rest of the admin UI.
 */

// Same shape as the Status pill these tables already used.
export const PILL_BASE_CLASS =
  "inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-xs font-medium";

const TONE = {
  green: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  red: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  teal: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
  indigo: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  purple: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  neutral: "bg-gray-100 text-muted-foreground dark:bg-gray-900/30",
} as const;

export type PillTone = keyof typeof TONE;

export function Pill({
  tone,
  children,
  title,
}: {
  tone: PillTone;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <span className={`${PILL_BASE_CLASS} ${TONE[tone]}`} title={title} data-tone={tone}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export type PlanPeriod = "monthly" | "annual" | "lifetime";

/**
 * Fallback for the plan picker when GET /api/v1/billing/plans (the backend's
 * source of truth) can't be reached. Keep in sync with billing.py's
 * `base_plans`.
 */
export const KNOWN_PLAN_IDS = ["premium_monthly", "premium_annual"] as const;

const PLAN_PERIOD_DISPLAY: Record<PlanPeriod, { label: string; tone: PillTone }> = {
  monthly: { label: "Monthly", tone: "indigo" },
  annual: { label: "Annual", tone: "purple" },
  lifetime: { label: "Lifetime", tone: "amber" },
};

/**
 * Billing period from a plan/product id. Covers the backend plan ids
 * (premium_monthly / premium_annual) plus store-style product ids
 * (abidii.premium.monthly, *_yearly, P1M/P1Y base plans...).
 */
export function getPlanPeriod(planId: string | null | undefined): PlanPeriod | null {
  const v = (planId || "").trim().toLowerCase();
  if (!v) return null;
  if (/lifetime/.test(v)) return "lifetime";
  if (/(annual|yearly|(^|[^a-z])year([^a-z]|$)|(^|[^a-z0-9])(p1y|12m|1y)([^a-z0-9]|$))/.test(v)) return "annual";
  if (/(monthly|(^|[^a-z])month([^a-z]|$)|(^|[^a-z0-9])(p1m|1m)([^a-z0-9]|$))/.test(v)) return "monthly";
  return null;
}

export function getPlanDisplay(planId: string | null | undefined): { label: string; tone: PillTone } | null {
  const raw = (planId || "").trim();
  if (!raw) return null;
  const period = getPlanPeriod(raw);
  if (period) return PLAN_PERIOD_DISPLAY[period];
  return { label: raw, tone: "neutral" };
}

export function PlanPill({ planId }: { planId: string | null | undefined }) {
  const display = getPlanDisplay(planId);
  if (!display) return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <Pill tone={display.tone} title={planId || undefined}>
      {display.label}
    </Pill>
  );
}

/** Select options for a plan picker: label "Monthly (premium_monthly)", value = exact plan id. */
export function getPlanOptions(
  planIds: ReadonlyArray<string>,
  currentValue?: string | null,
): Array<{ value: string; label: string }> {
  const ids = Array.from(new Set(planIds.filter(Boolean)));
  // Never drop a value an existing subscription already has.
  if (currentValue && !ids.includes(currentValue)) ids.push(currentValue);
  return ids.map((id) => {
    const period = getPlanPeriod(id);
    return { value: id, label: period ? `${PLAN_PERIOD_DISPLAY[period].label} (${id})` : id };
  });
}

// ---------------------------------------------------------------------------
// Status / event type / attempt result
// ---------------------------------------------------------------------------

const SUBSCRIPTION_STATUS_TONE: Record<string, PillTone> = {
  active: "green",
  trialing: "blue",
  pending: "yellow",
  past_due: "yellow",
  paused: "yellow",
  canceled: "yellow",
  expired: "red",
  refunded: "red",
};

export function getSubscriptionStatusTone(status: string | null | undefined): PillTone {
  return SUBSCRIPTION_STATUS_TONE[(status || "").toLowerCase()] ?? "neutral";
}

export function SubscriptionStatusPill({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-sm text-muted-foreground">—</span>;
  return <Pill tone={getSubscriptionStatusTone(status)}>{status}</Pill>;
}

const EVENT_TYPE_DISPLAY: Record<string, { label: string; tone: PillTone }> = {
  subscription_started: { label: "Started", tone: "green" },
  subscription_granted_admin: { label: "Granted (admin)", tone: "green" },
  trial_started: { label: "Trial started", tone: "blue" },
  subscription_renewed: { label: "Renewed", tone: "teal" },
  trial_converted: { label: "Trial converted", tone: "teal" },
  subscription_recovered: { label: "Recovered", tone: "teal" },
  subscription_canceled: { label: "Canceled", tone: "yellow" },
  subscription_expired: { label: "Expired", tone: "red" },
  subscription_refunded: { label: "Refunded", tone: "red" },
  refund_issued: { label: "Refund issued", tone: "red" },
  payment_failed: { label: "Payment failed", tone: "red" },
  subscription_revoked_admin: { label: "Revoked (admin)", tone: "red" },
};

export function getEventTypeDisplay(eventType: string | null | undefined): { label: string; tone: PillTone } | null {
  const raw = (eventType || "").trim();
  if (!raw) return null;
  return EVENT_TYPE_DISPLAY[raw.toLowerCase()] ?? { label: raw, tone: "neutral" };
}

export function EventTypePill({ eventType }: { eventType: string | null | undefined }) {
  const display = getEventTypeDisplay(eventType);
  if (!display) return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <Pill tone={display.tone} title={eventType || undefined}>
      {display.label}
    </Pill>
  );
}

export function getAttemptResultTone(success: boolean, status: string | null | undefined): PillTone {
  if (success) return "green";
  // An expired receipt is a legitimately lapsed purchase, not a broken one.
  if ((status || "").toLowerCase() === "expired") return "yellow";
  return "red";
}

export function AttemptResultPill({ success, status }: { success: boolean; status: string | null | undefined }) {
  return (
    <Pill tone={getAttemptResultTone(success, status)}>
      {success ? "success" : "failed"}
      {status ? ` (${status})` : ""}
    </Pill>
  );
}

// ---------------------------------------------------------------------------
// User cell
// ---------------------------------------------------------------------------

export interface SubscriptionUserFields {
  user_id: string;
  user_email?: string | null;
  user_display_name?: string | null;
  user_username?: string | null;
  user_avatar_svg?: string | null;
  user_picture_url?: string | null;
}

/**
 * Avatar + name. Primary line is the display name (else @username, else
 * email); secondary line is @username when there's also a display name.
 * The email stays available as a hover tooltip for admins.
 */
export function SubscriptionUserCell({ row }: { row: SubscriptionUserFields }) {
  const username = row.user_username ? `@${row.user_username}` : null;
  const primary = row.user_display_name || username || row.user_email || "Unknown user";
  const secondary = row.user_display_name && username ? username : null;
  const tooltip = [row.user_email, row.user_id].filter(Boolean).join(" · ");

  return (
    <div className="flex items-center gap-3" title={tooltip || undefined}>
      <UserAvatar
        size="w-8 h-8"
        showPremiumBadge={false}
        user={{
          id: row.user_id,
          display_name: row.user_display_name,
          username: row.user_username,
          email: row.user_email,
          avatar_svg: row.user_avatar_svg,
          picture_url: row.user_picture_url,
        }}
      />
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{primary}</div>
        {secondary && <div className="text-xs text-muted-foreground">{secondary}</div>}
      </div>
    </div>
  );
}

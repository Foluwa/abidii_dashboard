"use client";

import React, { useState } from "react";
import Image from "next/image";
import { usePlayerDetail, useUserDetail } from "@/hooks/useApi";
import Alert from "@/components/ui/alert/SimpleAlert";
import StatusBadge from "@/components/admin/StatusBadge";
import ConfirmationModal from "@/components/modals/ConfirmationModal";
import { apiClient, handleApiError } from "@/lib/api";
import type { UserRole } from "@/types/auth";
import { cleanSvgForDisplay, getAvatarColor, getInitials } from "@/lib/svg-utils";
import { countryName, countryFlagEmoji } from "@/lib/country-utils";
import {
  Activity,
  Award,
  BadgeCheck,
  Ban,
  Check,
  Copy,
  Flame,
  GraduationCap,
  RotateCcw,
  Star,
  Trash2,
  TriangleAlert,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { UserDetail } from "@/types/api";

type ModalType = "deactivate" | "reactivate" | "delete" | "purge" | null;
type DailyActivity = {
  date: string;
  sessions: number;
  avg_score?: number;
};
type GameBreakdown = {
  game_key: string;
  sessions: number;
  avg_score: number;
  accuracy: number;
  perfect_scores: number;
  total_time_ms: number;
};
type GameSession = {
  session_id: string;
  date: string;
  game_key: string;
  language_name?: string | null;
  score: number;
  correct: number;
  wrong: number;
  duration_ms: number;
  is_perfect: boolean;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
};

const formatShortDateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "Never";

const PLATFORM_LABELS: Record<string, string> = { ios: "iOS", android: "Android", web: "Web", macos: "macOS" };
const platformLabel = (value?: string | null) =>
  value ? PLATFORM_LABELS[value.toLowerCase()] ?? value.charAt(0).toUpperCase() + value.slice(1) : null;

/** "eng" / "yo" → "English" / "Yoruba"; falls back to the raw code. */
const languageName = (code?: string | null) => {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) || code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
};

const formatDate = (value?: string | null) => {
  if (!value) return "Never";
  return new Date(value).toLocaleDateString();
};

const formatGameName = (value?: string | null) =>
  value ? value.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Unknown game";

const formatDuration = (milliseconds?: number | null) => {
  const totalSeconds = Math.max(0, Math.round(Number(milliseconds || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

const dateKey = (date: Date) => {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const buildActivityWeeks = (dailyActivity: DailyActivity[] = []) => {
  const byDate = new Map(
    dailyActivity.map((day) => [
      day.date.slice(0, 10),
      {
        date: day.date.slice(0, 10),
        sessions: Number(day.sessions || 0),
        avg_score: Number(day.avg_score || 0),
      },
    ])
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(today.getDate() - 364);

  const cells: Array<DailyActivity | null> = Array.from(
    { length: start.getDay() },
    () => null
  );

  for (let cursor = new Date(start); cursor <= today; cursor.setDate(cursor.getDate() + 1)) {
    const key = dateKey(cursor);
    cells.push(byDate.get(key) ?? { date: key, sessions: 0, avg_score: 0 });
  }

  const weeks: Array<Array<DailyActivity | null>> = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }

  return weeks;
};

const activityCellClass = (sessions: number) => {
  if (sessions >= 8) return "bg-emerald-700 dark:bg-emerald-500";
  if (sessions >= 5) return "bg-emerald-600 dark:bg-emerald-600";
  if (sessions >= 2) return "bg-emerald-400 dark:bg-emerald-700";
  if (sessions >= 1) return "bg-emerald-200 dark:bg-emerald-900";
  return "bg-muted";
};

function ActivityHeatMap({
  dailyActivity,
  isLoading,
}: {
  dailyActivity?: DailyActivity[];
  isLoading: boolean;
}) {
  const weeks = buildActivityWeeks(dailyActivity);
  const totalSessions = dailyActivity?.reduce((sum, day) => sum + Number(day.sessions || 0), 0) ?? 0;
  const activeDays = dailyActivity?.filter((day) => Number(day.sessions || 0) > 0).length ?? 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Activity
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Daily game/session activity over the last 365 days
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{totalSessions}</span> sessions ·{" "}
          <span className="font-semibold text-foreground">{activeDays}</span> active days
        </div>
      </div>

      {isLoading ? (
        <div className="h-32 rounded-lg bg-muted animate-pulse" />
      ) : (
        <>
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-1 min-w-max">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="grid grid-rows-7 gap-1">
                  {Array.from({ length: 7 }).map((_, dayIndex) => {
                    const day = week[dayIndex] ?? null;
                    return day ? (
                      <div
                        key={day.date}
                        className={`h-3 w-3 rounded-sm ${activityCellClass(day.sessions)}`}
                        title={`${new Date(day.date).toLocaleDateString()}: ${day.sessions} session${day.sessions === 1 ? "" : "s"}, ${day.avg_score ?? 0}% avg score`}
                      />
                    ) : (
                      <div key={`empty-${weekIndex}-${dayIndex}`} className="h-3 w-3" />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
            <span>Less</span>
            <div className="h-3 w-3 rounded-sm bg-muted" />
            <div className="h-3 w-3 rounded-sm bg-emerald-200 dark:bg-emerald-900" />
            <div className="h-3 w-3 rounded-sm bg-emerald-400 dark:bg-emerald-700" />
            <div className="h-3 w-3 rounded-sm bg-emerald-600 dark:bg-emerald-600" />
            <div className="h-3 w-3 rounded-sm bg-emerald-700 dark:bg-emerald-500" />
            <span>More</span>
          </div>
        </>
      )}
    </div>
  );
}

export function UserDetailPanel({
  userId,
  onActionComplete,
}: {
  userId: string;
  onActionComplete?: (action: "delete" | "purge" | "deactivate" | "reactivate") => void;
}) {
  const { user, isLoading, isError, refresh } = useUserDetail(userId);
  const { player, isLoading: isActivityLoading } = usePlayerDetail(userId, {
    days: 365,
  });

  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const getRoleBadgeStatus = (userRole: UserRole) => {
    switch (userRole) {
      case "admin":
        return "error" as const;
      case "manager":
        return "warning" as const;
      case "user":
        return "info" as const;
      default:
        return "info" as const;
    }
  };

  const handleAction = async (action: ModalType) => {
    if (!action || !userId) return;

    setActionLoading(true);
    setActionError(null);

    try {
      let endpoint = "";
      let method: "post" | "delete" = "post";

      switch (action) {
        case "deactivate":
          endpoint = `/api/v1/admin/users/${userId}/deactivate`;
          break;
        case "reactivate":
          endpoint = `/api/v1/admin/users/${userId}/reactivate`;
          break;
        case "delete":
          endpoint = `/api/v1/admin/users/${userId}`;
          method = "delete";
          break;
        case "purge":
          endpoint = `/api/v1/admin/users/${userId}/purge`;
          method = "delete";
          break;
      }

      await apiClient[method](endpoint);
      setActiveModal(null);
      onActionComplete?.(action);
      if (action === "delete" || action === "purge") {
        return;
      }
      refresh();
    } catch (err) {
      setActionError(handleApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const modalConfig = {
    deactivate: {
      title: "Deactivate User",
      message: `Are you sure you want to deactivate this user? They will not be able to log in until reactivated.`,
      confirmLabel: "Deactivate",
      variant: "warning" as const,
    },
    reactivate: {
      title: "Reactivate User",
      message: `Are you sure you want to reactivate this user? They will be able to log in again.`,
      confirmLabel: "Reactivate",
      variant: "info" as const,
    },
    delete: {
      title: "Soft Delete User",
      message: `Are you sure you want to delete this user? The user will be marked as deleted but their data will be retained.`,
      confirmLabel: "Delete",
      variant: "danger" as const,
    },
    purge: {
      title: "Permanently Purge User",
      message: `⚠️ WARNING: This action is IRREVERSIBLE. All user data including learning progress, subscriptions, and analytics will be permanently deleted. Are you absolutely sure?`,
      confirmLabel: "Permanently Delete",
      variant: "danger" as const,
    },
  };

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading user">
        <div className="flex items-center gap-4">
          <div className="size-14 animate-pulse rounded-full bg-muted" />
          <div className="space-y-2">
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            <div className="h-3 w-56 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (isError || !user) {
    return (
      <Alert variant="error">
        Failed to load user details. The user may not exist or there was an API error.
      </Alert>
    );
  }

  const u = user as UserDetail;
  const lastRequestAt =
    u.last_active_at ??
    (u.last_request_at === undefined ? u.last_login_at : u.last_request_at);
  const avatarSource = cleanSvgForDisplay(u.avatar_svg) || cleanSvgForDisplay(u.picture_url) || null;
  const avatarLabel = u.display_name || u.email || "User";
  const isPremium = Boolean(u.has_premium || u.is_premium);
  const gameBreakdown = (player?.game_breakdown || []) as GameBreakdown[];
  const recentSessions = (player?.recent_sessions || []) as GameSession[];
  const maxGameSessions = Math.max(1, ...gameBreakdown.map((game) => Number(game.sessions || 0)));

  const totalSessionsForAvg = Number(player?.total_sessions || 0);
  const avgSessionTimeMs = totalSessionsForAvg > 0
    ? Number(player?.total_time_ms || 0) / totalSessionsForAvg
    : 0;
  const topGame = gameBreakdown.length > 0
    ? [...gameBreakdown].sort((a, b) => Number(b.sessions || 0) - Number(a.sessions || 0))[0]
    : null;
  const loadingText = <span className="text-muted-foreground">Loading…</span>;

  return (
    // Container queries: the same panel sits in the narrow drawer and on the
    // full /users/[id] page, so it lays out by its own width, not the viewport.
    <div className="@container space-y-5">
      {activeModal && (
        <ConfirmationModal
          isOpen={!!activeModal}
          onClose={() => setActiveModal(null)}
          onConfirm={() => handleAction(activeModal)}
          title={modalConfig[activeModal].title}
          message={modalConfig[activeModal].message}
          confirmLabel={modalConfig[activeModal].confirmLabel}
          variant={modalConfig[activeModal].variant}
          isLoading={actionLoading}
        />
      )}

      {actionError && <Alert variant="error">{actionError}</Alert>}

      {/* Identity */}
      <div className="flex flex-col gap-4 @xl:flex-row @xl:items-start @xl:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="relative inline-flex shrink-0">
            {avatarSource && !avatarFailed ? (
              <Image
                src={avatarSource}
                alt={`${avatarLabel} avatar`}
                width={56}
                height={56}
                unoptimized
                className="size-14 rounded-full bg-muted object-cover ring-1 ring-border"
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <div className={`flex size-14 items-center justify-center rounded-full ${getAvatarColor(u.id || avatarLabel)}`}>
                <span className="text-lg font-semibold text-white">{getInitials(avatarLabel)}</span>
              </div>
            )}
            {isPremium && (
              <span className="absolute -bottom-0.5 -right-0.5 inline-flex size-6 items-center justify-center rounded-full border-2 border-background bg-amber-400 text-amber-950" title="Premium member" aria-label="Premium member">
                <Award className="size-3.5" aria-hidden="true" />
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold leading-tight text-foreground">{avatarLabel}</h2>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
              {u.username && <span className="text-foreground/80">@{u.username}</span>}
              {u.username && <span aria-hidden="true">·</span>}
              <span className="truncate">{u.email || "No email"}</span>
              {u.email_verified && (
                <BadgeCheck className="size-4 shrink-0 text-sky-600 dark:text-sky-400" aria-label="Email verified" />
              )}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={getRoleBadgeStatus(u.role)} label={u.role} />
              <StatusBadge status={u.is_active ? "success" : "error"} label={u.is_active ? "Active" : "Inactive"} />
              {isPremium && <StatusBadge status="warning" label="Premium" />}
              <CopyIdButton id={u.id} />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {u.is_active ? (
            <ActionButton icon={Ban} onClick={() => setActiveModal("deactivate")}>Deactivate</ActionButton>
          ) : (
            <ActionButton icon={RotateCcw} onClick={() => setActiveModal("reactivate")}>Reactivate</ActionButton>
          )}
          <ActionButton icon={Trash2} onClick={() => setActiveModal("delete")}>Soft delete</ActionButton>
          <ActionButton icon={TriangleAlert} destructive onClick={() => setActiveModal("purge")}>Purge</ActionButton>
        </div>
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 gap-3 @lg:grid-cols-4">
        <StatTile icon={Zap} label="Total XP" value={(u.total_xp ?? 0).toLocaleString()} />
        <StatTile icon={Flame} label="Streak" value={`${u.current_streak ?? 0}d`} hint={`Best ${u.longest_streak ?? 0}d`} />
        <StatTile icon={GraduationCap} label="Level" value={u.current_level ?? 1} hint={u.proficiency_level ? u.proficiency_level.replace(/_/g, " ") : undefined} />
        <StatTile icon={Activity} label="Sessions" value={(u.total_sessions ?? 0).toLocaleString()} hint={avgSessionTimeMs > 0 ? `Avg ${formatDuration(avgSessionTimeMs)}` : undefined} />
      </div>

      <div className="grid gap-4 @4xl:grid-cols-2">
        <Section title="Profile">
          <Rows
            rows={[
              ["Display name", u.display_name || "Not set"],
              ["Email", u.email || "Not set"],
              ["Sign-in", <span key="p" className="capitalize">{u.provider || "device"}</span>],
              ["Country", u.country_code ? `${countryFlagEmoji(u.country_code)} ${countryName(u.country_code)}` : "Unknown"],
              ["Time zone", u.timezone || "Unknown"],
              ["App language", u.ui_locale_name ? `${u.ui_locale_name}${u.ui_locale_source ? ` (${u.ui_locale_source})` : ""}` : "Unknown"],
              ["Native language", languageName(u.native_language_code) ?? "Not set"],
              ["Joined", formatDate(u.created_at) === "Never" ? "Unknown" : formatDate(u.created_at)],
              ["Last request", <RelativeTime key="lr" value={lastRequestAt} />],
              ["Experiment cohort", u.experiment_cohort || "None"],
            ]}
          />
        </Section>

        <div className="space-y-4">
          <Section title="Learning">
            <Rows
              rows={[
                ["Learning", u.current_language_name || "Unknown"],
                ["Languages", u.languages_learning ?? 0],
                ["Fluency", <span key="f" className="capitalize">{u.proficiency_level?.replace(/_/g, " ") || "Not available"}</span>],
                ["Last study day", formatDate(u.last_activity_date)],
                ["Global rank", u.global_alltime_rank ? `#${u.global_alltime_rank}` : "Unranked"],
                [
                  u.rank_language_name ? `${u.rank_language_name} rank` : "Language rank",
                  u.language_alltime_rank ? `#${u.language_alltime_rank}` : "Unranked",
                ],
                ["Top game", isActivityLoading ? loadingText : topGame ? `${formatGameName(topGame.game_key)} · ${topGame.sessions}` : "None yet"],
              ]}
            />
          </Section>

          <Section title="Subscription">
            {isPremium ? (
              <Rows
                rows={[
                  ["Plan", u.premium_plan_id || "Premium"],
                  ["Status", <span key="s" className="capitalize">{u.premium_status || "active"}</span>],
                  ["Renews / ends", formatDate(u.premium_current_period_end)],
                  ["Store", <span key="st">{[platformLabel(u.premium_provider), platformLabel(u.premium_platform)].filter(Boolean).join(" · ") || "Unknown"}</span>],
                ]}
              />
            ) : (
              <p className="py-1 text-sm text-muted-foreground">Free plan · no active subscription</p>
            )}
          </Section>
        </div>
      </div>

      {(u.device_platform || u.device_name || u.device_app_version || u.device_id || u.last_ip_address || u.push_enabled != null) && (
        <Section title="Device">
          <Rows
            columns
            rows={[
              ["Platform", platformLabel(u.device_platform) ?? "Unknown"],
              ["Device", u.device_name || "Unknown"],
              ["App version", u.device_app_version ? `v${u.device_app_version}${u.device_build_number ? ` (${u.device_build_number})` : ""}` : "Unknown"],
              ["Push notifications", u.push_enabled == null ? "Unknown" : u.push_enabled ? "On" : "Off"],
              ...(u.device_id ? ([["Device ID", <span key="d" className="font-mono text-xs">{u.device_id}</span>]] as Row[]) : []),
              ...(u.last_ip_address ? ([["Last IP", <span key="ip" className="font-mono text-xs">{u.last_ip_address}</span>]] as Row[]) : []),
            ]}
          />
        </Section>
      )}

      {/* Games */}
      <Section
        title="Game performance"
        description={isActivityLoading ? "Loading…" : `${(player?.total_rounds ?? 0).toLocaleString()} rounds · ${Number(player?.avg_score ?? 0).toFixed(1)}% avg score · ${Number(player?.accuracy ?? 0).toFixed(1)}% accuracy · ${formatDuration(player?.total_time_ms)} played`}
      >
        {gameBreakdown.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 font-medium">Game</th>
                  <th className="w-1/3 px-3 py-2 font-medium">Sessions</th>
                  <th className="px-3 py-2 text-right font-medium">Accuracy</th>
                  <th className="px-3 py-2 text-right font-medium">Perfect</th>
                  <th className="py-2 pl-3 text-right font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {gameBreakdown.map((game) => (
                  <tr key={game.game_key}>
                    <td className="py-2.5 pr-3 font-medium text-foreground">{formatGameName(game.game_key)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-foreground/70" style={{ width: `${Math.max(4, (Number(game.sessions || 0) / maxGameSessions) * 100)}%` }} />
                        </div>
                        <span className="w-8 text-right tabular-nums text-muted-foreground">{game.sessions}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{Number(game.accuracy || 0).toFixed(1)}%</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{game.perfect_scores || 0}</td>
                    <td className="py-2.5 pl-3 text-right tabular-nums">{formatDuration(game.total_time_ms)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">No game activity recorded.</p>
        )}
      </Section>

      <Section title="Recent sessions" flush>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-y border-border bg-muted/40">
                <th className="px-5 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Game</th>
                <th className="px-3 py-2 font-medium">Language</th>
                <th className="px-3 py-2 text-right font-medium">Score</th>
                <th className="px-3 py-2 text-right font-medium">Answers</th>
                <th className="px-5 py-2 text-right font-medium">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentSessions.map((session) => (
                <tr key={session.session_id}>
                  <td className="whitespace-nowrap px-5 py-2.5 text-muted-foreground">{formatShortDateTime(session.date)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
                    {formatGameName(session.game_key)}
                    {session.is_perfect && <Star className="ml-1.5 inline size-3.5 fill-amber-400 text-amber-400" aria-label="Perfect score" />}
                  </td>
                  <td className="px-3 py-2.5">{session.language_name || "—"}</td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">{Number(session.score || 0).toFixed(1)}%</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <span className="text-emerald-600 dark:text-emerald-400">{session.correct || 0}</span>
                    <span className="text-muted-foreground"> / </span>
                    <span className="text-red-600 dark:text-red-400">{session.wrong || 0}</span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-right tabular-nums">{formatDuration(session.duration_ms)}</td>
                </tr>
              ))}
              {!recentSessions.length && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">No game sessions recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <ActivityHeatMap dailyActivity={player?.daily_activity} isLoading={isActivityLoading} />
    </div>
  );
}

type Row = [React.ReactNode, React.ReactNode];

function Section({
  title,
  description,
  flush,
  children,
}: {
  title: string;
  description?: string;
  flush?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xs">
      <header className="px-5 pb-2 pt-4">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </header>
      <div className={flush ? "" : "px-5 pb-4"}>{children}</div>
    </section>
  );
}

/** Label / value list: label muted on the left, value right-aligned. */
function Rows({ rows, columns }: { rows: Row[]; columns?: boolean }) {
  return (
    <dl className={columns ? "grid gap-x-8 @lg:grid-cols-2" : ""}>
      {rows.map(([label, value], index) => (
        <div
          key={index}
          className={
            "flex items-baseline justify-between gap-4 border-b border-border/60 py-2 text-sm last:border-0" +
            // Two columns: the odd second-to-last item also ends its column.
            (columns ? " @lg:[&:nth-last-child(2):nth-child(odd)]:border-0" : "")
          }
        >
          <dt className="shrink-0 text-muted-foreground">{label}</dt>
          <dd className="min-w-0 truncate text-right font-medium text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs font-medium">{label}</span>
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs capitalize text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ActionButton({
  icon: Icon,
  destructive,
  onClick,
  children,
}: {
  icon: LucideIcon;
  destructive?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 " +
        (destructive
          ? "bg-destructive text-white hover:bg-destructive/90"
          : "border border-input bg-background text-foreground hover:bg-accent")
      }
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {children}
    </button>
  );
}

function CopyIdButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(id).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          },
          () => undefined,
        );
      }}
      title={id}
      aria-label={copied ? "User ID copied" : "Copy user ID"}
      className="inline-flex h-[22px] items-center gap-1 rounded-md border border-border px-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {copied ? <Check className="size-3" aria-hidden="true" /> : <Copy className="size-3" aria-hidden="true" />}
      {id.slice(0, 8)}
    </button>
  );
}

function RelativeTime({ value }: { value?: string | null }) {
  // "Now" is captured once per mount so renders stay pure.
  const [now] = useState(() => Date.now());
  if (!value) return <>Never</>;
  const date = new Date(value);
  const diffSeconds = Math.round((date.getTime() - now) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const [unit, seconds] = units.find(([, s]) => Math.abs(diffSeconds) >= s) ?? ["second", 1];
  return (
    <time dateTime={date.toISOString()} title={date.toLocaleString()}>
      {rtf.format(Math.round(diffSeconds / seconds), unit)}
    </time>
  );
}

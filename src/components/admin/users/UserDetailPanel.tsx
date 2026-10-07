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
import { Award } from "lucide-react";

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
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-col gap-2 mb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Activity Heat Map
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Daily game/session activity over the last 365 days
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
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
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand-600"></div>
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

  const lastRequestAt =
    user.last_active_at ??
    (user.last_request_at === undefined ? user.last_login_at : user.last_request_at);
  const avatarSource = cleanSvgForDisplay(user.avatar_svg) || cleanSvgForDisplay(user.picture_url) || null;
  const avatarLabel = user.display_name || user.email || "User";
  const isPremium = Boolean(user.has_premium || user.is_premium);
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

  return (
    <div className="space-y-4">
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

      {/* Header + actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="relative inline-flex shrink-0">
            {avatarSource && !avatarFailed ? (
              <Image
                src={avatarSource}
                alt={`${avatarLabel} avatar`}
                width={48}
                height={48}
                unoptimized
                className="h-12 w-12 rounded-full object-cover bg-muted"
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <div className={`h-12 w-12 rounded-full ${getAvatarColor(user.id || avatarLabel)} flex items-center justify-center`}>
                <span className="font-semibold text-white">{getInitials(avatarLabel)}</span>
              </div>
            )}
            {isPremium && (
              <span className="absolute -bottom-1 -right-1 inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-amber-400 text-amber-950 shadow-sm" title="Premium member" aria-label="Premium member">
                <Award className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{avatarLabel}</h2>
            <p className="text-sm text-muted-foreground">
              {user.email || "No email"} · #{user.id.slice(0, 8)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <StatusBadge status={getRoleBadgeStatus(user.role)} label={user.role} />
          <StatusBadge status={user.is_active ? "success" : "error"} label={user.is_active ? "Active" : "Inactive"} />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {user.is_active ? (
          <button
            onClick={() => setActiveModal("deactivate")}
            className="px-3 py-1.5 text-sm font-medium text-yellow-700 bg-yellow-100 rounded-lg hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/50"
          >
            Deactivate
          </button>
        ) : (
          <button
            onClick={() => setActiveModal("reactivate")}
            className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
          >
            Reactivate
          </button>
        )}
        <button
          onClick={() => setActiveModal("delete")}
          className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
        >
          Soft Delete
        </button>
        <button
          onClick={() => setActiveModal("purge")}
          className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
        >
          Purge
        </button>
      </div>

      {/* Learning Progress */}
      <div className="p-4 bg-card border border-border rounded-lg">
        <h3 className="mb-4 text-base font-semibold text-foreground">Learning Progress</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 text-center border border-border rounded-lg">
            <p className="text-xl font-bold text-brand-600 dark:text-brand-400">{(user.total_sessions ?? 0).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Sessions</p>
          </div>
          <div className="p-3 text-center border border-border rounded-lg">
            <p className="text-xl font-bold text-brand-600 dark:text-brand-400">{user.languages_learning ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Languages Learning</p>
          </div>
          <div className="p-3 text-center border border-border rounded-lg">
            <p className="text-xl font-bold text-brand-600 dark:text-brand-400">Level {user.current_level ?? 1}</p>
            <p className="text-xs text-muted-foreground mt-1">Current Level</p>
          </div>
          <div className="p-3 text-center border border-border rounded-lg">
            <p className="text-xl font-bold text-brand-600 dark:text-brand-400">{isPremium ? "Premium" : "Free"}</p>
            <p className="text-xs text-muted-foreground mt-1">Account Type</p>
          </div>
        </div>
      </div>

      {/* User Information */}
      <div className="p-4 bg-card border border-border rounded-lg">
        <h3 className="mb-4 text-base font-semibold text-foreground">User Information</h3>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          {[
            ["Display Name", user.display_name || "Not set"],
            ["Email", user.email || "Not set"],
            ["Auth Provider", user.provider || "device"],
            ["Learning Language", user.current_language_name || "Unknown"],
            ["Language", user.ui_locale_name || "Unknown"],
            ["Language Source", user.ui_locale_source || "Unknown"],
            ["Fluency", user.proficiency_level?.replace(/_/g, " ") || "Not available"],
            ["Total XP", (user.total_xp ?? 0).toLocaleString()],
            ["Current Streak", `${user.current_streak ?? 0} days`],
            ["Longest Streak", `${user.longest_streak ?? 0} days`],
            ["Created At", formatDate(user.created_at) === "Never" ? "Unknown" : formatDate(user.created_at)],
            ["Last Request", formatDateTime(lastRequestAt)],
            ["Last Study Day", formatDate(user.last_activity_date)],
            ["Avg. Session Time", isActivityLoading ? "Loading…" : avgSessionTimeMs > 0 ? formatDuration(avgSessionTimeMs) : "Not available"],
            ["Leaderboard Rank", user.global_alltime_rank ? `#${user.global_alltime_rank} globally` : "Unranked"],
            ["Most Played Game", isActivityLoading ? "Loading…" : topGame ? `${formatGameName(topGame.game_key)} (${topGame.sessions} sessions)` : "No games played yet"],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
              <dd
                className={`mt-0.5 text-sm text-foreground ${
                  // Capitalise enum-style values only; names, emails and
                  // dates must show exactly as stored.
                  ["Auth Provider", "Language Source", "Fluency"].includes(label) ? "capitalize" : ""
                }`}
              >
                {String(value)}
              </dd>
            </div>
          ))}
        </dl>
        {user.country_code && (
          <div className="mt-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Country</dt>
            <dd className="mt-0.5 text-sm text-foreground">
              {countryFlagEmoji(user.country_code)} {countryName(user.country_code)}
            </dd>
          </div>
        )}
        {(user.device_platform ||
          user.device_name ||
          user.device_app_version ||
          user.device_id ||
          user.last_ip_address) && (
          <div className="mt-4 border-t border-border pt-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Device
            </div>
            <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
              {user.device_platform && (
                <div>
                  <dt className="text-xs text-muted-foreground">Platform</dt>
                  <dd className="text-sm text-foreground capitalize">{user.device_platform}</dd>
                </div>
              )}
              {user.device_name && (
                <div>
                  <dt className="text-xs text-muted-foreground">Device Name</dt>
                  <dd className="text-sm text-foreground">{user.device_name}</dd>
                </div>
              )}
              {user.device_app_version && (
                <div>
                  <dt className="text-xs text-muted-foreground">App Version</dt>
                  <dd className="text-sm text-foreground">
                    v{user.device_app_version}
                    {user.device_build_number ? ` (${user.device_build_number})` : ""}
                  </dd>
                </div>
              )}
              {user.device_id && (
                <div>
                  <dt className="text-xs text-muted-foreground">Device ID</dt>
                  <dd className="text-sm font-mono text-foreground break-all">{user.device_id}</dd>
                </div>
              )}
              {user.last_ip_address && (
                <div>
                  <dt className="text-xs text-muted-foreground">Last IP Address</dt>
                  <dd className="text-sm font-mono text-foreground">{user.last_ip_address}</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </div>

      {/* Game performance summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          ["Game Sessions", player?.total_sessions ?? 0],
          ["Rounds Played", player?.total_rounds ?? 0],
          ["Average Score", `${Number(player?.avg_score ?? 0).toFixed(1)}%`],
          ["Accuracy", `${Number(player?.accuracy ?? 0).toFixed(1)}%`],
          ["Time Played", formatDuration(player?.total_time_ms)],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Games played */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-base font-semibold text-foreground">Games played</h3>
        <div className="mt-4 space-y-4">
          {gameBreakdown.map((game) => (
            <div key={game.game_key}>
              <div className="mb-1.5 flex items-center justify-between gap-4 text-sm">
                <span className="font-medium text-foreground">{formatGameName(game.game_key)}</span>
                <span className="text-muted-foreground">{game.sessions} sessions · {Number(game.avg_score || 0).toFixed(1)}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(4, (Number(game.sessions || 0) / maxGameSessions) * 100)}%` }} />
              </div>
            </div>
          ))}
          {!gameBreakdown.length && <p className="py-8 text-center text-sm text-gray-500">No game activity recorded.</p>}
        </div>
      </div>

      {/* Performance by game */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-base font-semibold text-foreground">Performance by game</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr><th className="py-2.5 pr-4">Game</th><th className="px-3 py-2.5 text-right">Accuracy</th><th className="px-3 py-2.5 text-right">Perfect</th><th className="py-2.5 pl-3 text-right">Time</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {gameBreakdown.map((game) => (
                <tr key={game.game_key}><td className="py-3 pr-4 font-medium text-foreground">{formatGameName(game.game_key)}</td><td className="px-3 py-3 text-right">{Number(game.accuracy || 0).toFixed(1)}%</td><td className="px-3 py-3 text-right">{game.perfect_scores || 0}</td><td className="py-3 pl-3 text-right">{formatDuration(game.total_time_ms)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent game sessions */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="p-4">
          <h3 className="text-base font-semibold text-foreground">Recent game sessions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground border-b"><tr><th className="px-4 py-2.5">Date</th><th className="px-4 py-2.5">Game</th><th className="px-4 py-2.5">Language</th><th className="px-4 py-2.5 text-right">Score</th><th className="px-4 py-2.5 text-right">Answers</th><th className="px-4 py-2.5 text-right">Duration</th></tr></thead>
            <tbody className="divide-y divide-border">
              {recentSessions.map((session) => (
                <tr key={session.session_id}><td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDateTime(session.date)}</td><td className="px-4 py-3 font-medium text-foreground">{formatGameName(session.game_key)}{session.is_perfect && <span className="ml-2 text-amber-500" title="Perfect score">★</span>}</td><td className="px-4 py-3">{session.language_name || "—"}</td><td className="px-4 py-3 text-right font-semibold">{Number(session.score || 0).toFixed(1)}%</td><td className="px-4 py-3 text-right text-emerald-600">{session.correct || 0}<span className="text-gray-400"> / </span><span className="text-red-500">{session.wrong || 0}</span></td><td className="px-4 py-3 text-right">{formatDuration(session.duration_ms)}</td></tr>
              ))}
              {!recentSessions.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500">No game sessions recorded.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <ActivityHeatMap dailyActivity={player?.daily_activity} isLoading={isActivityLoading} />
    </div>
  );
}

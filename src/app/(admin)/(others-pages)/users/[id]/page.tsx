"use client";

import React, { useState } from "react";
import { usePlayerDetail, useUserDetail } from "@/hooks/useApi";
import { useParams, useRouter } from "next/navigation";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Alert from "@/components/ui/alert/SimpleAlert";
import StatusBadge from "@/components/admin/StatusBadge";
import ConfirmationModal from "@/components/modals/ConfirmationModal";
import { apiClient, handleApiError } from "@/lib/api";
import type { UserRole } from "@/types/auth";

type ModalType = "deactivate" | "reactivate" | "delete" | "purge" | null;
type DailyActivity = {
  date: string;
  sessions: number;
  avg_score?: number;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
};

const formatDate = (value?: string | null) => {
  if (!value) return "Never";
  return new Date(value).toLocaleDateString();
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
  return "bg-gray-100 dark:bg-gray-800";
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
    <div className="p-6 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
      <div className="flex flex-col gap-2 mb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Activity Heat Map
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Daily game/session activity over the last 365 days
          </p>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-300">
          <span className="font-semibold text-gray-900 dark:text-white">{totalSessions}</span> sessions ·{" "}
          <span className="font-semibold text-gray-900 dark:text-white">{activeDays}</span> active days
        </div>
      </div>

      {isLoading ? (
        <div className="h-32 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
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
          <div className="flex items-center gap-2 mt-4 text-xs text-gray-500 dark:text-gray-400">
            <span>Less</span>
            <div className="h-3 w-3 rounded-sm bg-gray-100 dark:bg-gray-800" />
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

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  // User IDs are UUIDs - do NOT convert to Number
  const userId = params.id as string;
  const { user, isLoading, isError, refresh } = useUserDetail(userId);
  const { player, isLoading: isActivityLoading } = usePlayerDetail(userId, {
    days: 365,
  });
  
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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

      // Auth rides on the httpOnly cookie apiClient sends automatically -
      // this used to build its own fetch() with a token read from
      // localStorage under a key ("admin_token") nothing in the app ever
      // wrote, so this action has been silently broken until now.
      await apiClient[method](endpoint);

      // Close modal
      setActiveModal(null);
      
      // For delete/purge, redirect to users list
      if (action === "delete" || action === "purge") {
        router.push("/users");
      } else {
        // For activate/deactivate, refresh the data
        refresh();
      }
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
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="User Details" />
        <div className="p-6 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 animate-pulse">
          <div className="space-y-4">
            <div className="h-8 bg-gray-200 rounded dark:bg-gray-700 w-1/4"></div>
            <div className="h-4 bg-gray-200 rounded dark:bg-gray-700"></div>
            <div className="h-4 bg-gray-200 rounded dark:bg-gray-700"></div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="User Details" />
        <Alert variant="error">
          Failed to load user details. The user may not exist or there was an API error.
        </Alert>
      </div>
    );
  }

  const lastRequestAt =
    user.last_request_at === undefined ? user.last_login_at : user.last_request_at;

  return (
    <div className="space-y-6">
      {/* Confirmation Modal */}
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

      {/* Error Alert */}
      {actionError && (
        <Alert variant="error">
          {actionError}
        </Alert>
      )}

      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <PageBreadCrumb pageTitle="User Details" />
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Detailed information for user #{user.id.slice(0, 8)}...
          </p>
        </div>
        <div className="flex gap-2">
          {user.is_active ? (
            <button
              onClick={() => setActiveModal("deactivate")}
              className="px-4 py-2 text-sm font-medium text-yellow-700 bg-yellow-100 rounded-lg hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/50"
            >
              Deactivate
            </button>
          ) : (
            <button
              onClick={() => setActiveModal("reactivate")}
              className="px-4 py-2 text-sm font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
            >
              Reactivate
            </button>
          )}
          <button
            onClick={() => setActiveModal("delete")}
            className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
          >
            Soft Delete
          </button>
          <button
            onClick={() => setActiveModal("purge")}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
          >
            Purge
          </button>
        </div>
      </div>

      {/* User Info Card */}
      <div className="p-6 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
        <div className="flex items-start justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            User Information
          </h3>
          <div className="flex gap-2">
            <StatusBadge status={getRoleBadgeStatus(user.role)} label={user.role} />
            <StatusBadge status={user.is_active ? "success" : "error"} 
              label={user.is_active ? "Active" : "Inactive"} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Display Name
            </label>
            <p className="text-base text-gray-900 dark:text-white">
              {user.display_name || "Not set"}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Email
            </label>
            <p className="text-base text-gray-900 dark:text-white">
              {user.email || "Not set"}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Auth Provider
            </label>
            <p className="text-base text-gray-900 dark:text-white capitalize">
              {user.provider || "device"}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Current Level
            </label>
            <p className="text-base text-gray-900 dark:text-white">
              Level {user.current_level ?? 1}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Current Streak
            </label>
            <p className="text-base text-gray-900 dark:text-white">
              {user.current_streak ?? 0} days
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Longest Streak
            </label>
            <p className="text-base text-gray-900 dark:text-white">
              {user.longest_streak ?? 0} days
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Total XP
            </label>
            <p className="text-base text-gray-900 dark:text-white">
              {(user.total_xp ?? 0).toLocaleString()}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Created At
            </label>
            <p className="text-base text-gray-900 dark:text-white">
              {formatDate(user.created_at) === "Never" ? "Unknown" : formatDate(user.created_at)}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Last Request
            </label>
            <p className="text-base text-gray-900 dark:text-white">
              {formatDateTime(lastRequestAt)}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Last Study Day
            </label>
            <p className="text-base text-gray-900 dark:text-white">
              {formatDate(user.last_activity_date)}
            </p>
          </div>
        </div>
      </div>

      <ActivityHeatMap
        dailyActivity={player?.daily_activity}
        isLoading={isActivityLoading}
      />

      {/* Learning Progress Card */}
      <div className="p-6 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
        <h3 className="mb-6 text-lg font-semibold text-gray-900 dark:text-white">
          Learning Progress
        </h3>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="p-4 text-center border border-gray-200 rounded-lg dark:border-gray-800">
            <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">
              {(user.total_sessions ?? 0).toLocaleString()}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Total Sessions
            </p>
          </div>

          <div className="p-4 text-center border border-gray-200 rounded-lg dark:border-gray-800">
            <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">
              {user.languages_learning ?? 0}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Languages Learning
            </p>
          </div>

          <div className="p-4 text-center border border-gray-200 rounded-lg dark:border-gray-800">
            <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">
              Level {user.current_level ?? 1}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Current Level
            </p>
          </div>

          <div className="p-4 text-center border border-gray-200 rounded-lg dark:border-gray-800">
            <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">
              {user.is_premium ? "Premium" : "Free"}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Account Type
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useAdminRoomsAnalytics, useLanguages } from "@/hooks/useApi";
import type { RoomTypeFilterValue, RoomStatusFilterValue, RecentRoomItem } from "@/types/admin-analytics";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Alert from "@/components/ui/alert/SimpleAlert";
import Pagination from "@/components/tables/Pagination";
import { StyledSelect } from "@/components/ui/form/StyledSelect";
import AnalyticsTabs from "@/components/analytics/AnalyticsTabs";
import RoomsTimeSeriesChart from "@/components/charts/RoomsTimeSeriesChart";
import { cleanSvgForDisplay, getAvatarColor, getInitials } from "@/lib/svg-utils";

/** Tiny avatar + name cell for a room's host - previously just showed a bare
 * "—" whenever display_name was empty, with no way to identify who the
 * host actually was. Falls back to email, then a generic label, matching
 * the same fallback chain the users pages already use. */
function HostCell({ host }: { host: RecentRoomItem["host"] }) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  if (!host.id) {
    return <span className="text-muted-foreground">—</span>;
  }

  const label = host.display_name || host.email || "Unknown user";
  const avatarSource = cleanSvgForDisplay(host.avatar_svg) || cleanSvgForDisplay(host.picture_url) || null;

  return (
    <div className="flex items-center gap-2">
      {avatarSource && !avatarFailed ? (
        <Image
          src={avatarSource}
          alt={`${label} avatar`}
          width={20}
          height={20}
          unoptimized
          className="h-5 w-5 rounded-full object-cover bg-muted"
          referrerPolicy="no-referrer"
          onError={() => setAvatarFailed(true)}
        />
      ) : (
        <div className={`flex h-5 w-5 items-center justify-center rounded-full ${getAvatarColor(host.id || label)}`}>
          <span className="text-[9px] font-semibold text-white">{getInitials(label)}</span>
        </div>
      )}
      <span className="truncate text-xs text-foreground">{label}</span>
    </div>
  );
}

const formatDateShort = (dateStr: string) =>
  new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("default", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

const formatDateTime = (dateStr: string | null) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDuration = (seconds: number) => {
  if (!seconds || seconds <= 0) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  active: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const ROOM_TYPE_BADGE_CLASSES: Record<string, string> = {
  standard: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  instant: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

export default function RoomsAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [roomType, setRoomType] = useState<RoomTypeFilterValue>("all");
  const [status, setStatus] = useState<RoomStatusFilterValue>("all");
  const [languageId, setLanguageId] = useState("");
  const [page, setPage] = useState(1);

  const { analytics, isLoading, isError, refresh } = useAdminRoomsAnalytics({
    days,
    roomType,
    status,
    languageId: languageId || undefined,
    page,
    pageSize: 20,
  });
  const { languages } = useLanguages();

  if (isError) {
    const errMsg = isError?.response?.data?.detail || isError?.message || "Failed to load room analytics.";
    const status = isError?.response?.status;
    return (
      <div className="p-6 space-y-4">
        <Alert variant="error">
          <div className="font-medium">Failed to load room analytics</div>
          <div className="text-sm mt-1">
            {errMsg}
            {status ? ` (HTTP ${status})` : ""}
          </div>
        </Alert>
        <button
          onClick={() => refresh()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const summary = analytics?.summary;
  const recentRooms = analytics?.recent_rooms;
  const totalPages = recentRooms?.total_pages || 1;

  const summaryCards: { label: string; value: React.ReactNode }[] = summary
    ? [
        { label: "Total Rooms", value: summary.total_rooms.toLocaleString() },
        { label: "Active", value: summary.active_rooms.toLocaleString() },
        { label: "Completed", value: summary.completed_rooms.toLocaleString() },
        { label: "Cancelled", value: summary.cancelled_rooms.toLocaleString() },
        { label: "Unique Hosts", value: summary.unique_hosts.toLocaleString() },
        { label: "Unique Participants", value: summary.unique_participants.toLocaleString() },
        { label: "Avg Participants / Room", value: summary.average_participants_per_room.toFixed(2) },
        { label: "Avg Room Duration", value: formatDuration(summary.average_room_duration_seconds) },
        { label: "Games Played", value: summary.total_games_played.toLocaleString() },
        { label: "Avg Score", value: `${summary.average_score.toFixed(1)}%` },
        { label: "Accuracy", value: `${summary.accuracy_percent.toFixed(1)}%` },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <PageBreadCrumb pageTitle="Rooms Analytics" />
          <p className="mt-1 text-sm text-muted-foreground">
            Multiplayer room activity across standard (long-lived) rooms and instant sessions
          </p>
        </div>
        <button
          onClick={() => refresh()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh Data
        </button>
      </div>

      <AnalyticsTabs />

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StyledSelect
            label="Time Period"
            value={days}
            onChange={(e) => {
              setDays(Number(e.target.value));
              setPage(1);
            }}
            options={[
              { value: 7, label: "Last 7 Days" },
              { value: 30, label: "Last 30 Days" },
              { value: 90, label: "Last 90 Days" },
            ]}
            fullWidth
          />
          <StyledSelect
            label="Room Type"
            value={roomType}
            onChange={(e) => {
              setRoomType(e.target.value as RoomTypeFilterValue);
              setPage(1);
            }}
            options={[
              { value: "all", label: "All Types" },
              { value: "standard", label: "Standard (long-lived)" },
              { value: "instant", label: "Instant" },
            ]}
            fullWidth
          />
          <StyledSelect
            label="Status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as RoomStatusFilterValue);
              setPage(1);
            }}
            options={[
              { value: "all", label: "All Statuses" },
              { value: "active", label: "Active" },
              { value: "completed", label: "Completed" },
              { value: "cancelled", label: "Cancelled" },
            ]}
            fullWidth
          />
          <StyledSelect
            label="Language"
            value={languageId}
            onChange={(e) => {
              setLanguageId(e.target.value);
              setPage(1);
            }}
            options={[
              { value: "", label: "All Languages" },
              ...languages.map((lang: any) => ({ value: lang.id, label: lang.name })),
            ]}
            helperText="Only instant rooms carry a language. Standard (long-lived) rooms have no language attribution in the schema, so filtering by language always shows 0 standard rooms — this is a known data limitation, not a bug."
            fullWidth
          />
        </div>
      </div>

      {/* Summary cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
          {summaryCards.map(({ label, value }) => (
            <div key={label} className="p-4 bg-card border border-border rounded-lg">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-2xl font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-card border border-border rounded-lg p-4">
          {isLoading ? (
            <div className="h-[220px] bg-muted rounded-lg animate-pulse" />
          ) : (
            <RoomsTimeSeriesChart
              title="Rooms Created vs Completed"
              categories={(analytics?.rooms_by_day || []).map((d) => formatDateShort(d.date))}
              series={[
                { name: "Created", data: (analytics?.rooms_by_day || []).map((d) => d.rooms_created) },
                { name: "Completed", data: (analytics?.rooms_by_day || []).map((d) => d.rooms_completed) },
              ]}
            />
          )}
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          {isLoading ? (
            <div className="h-[220px] bg-muted rounded-lg animate-pulse" />
          ) : (
            <RoomsTimeSeriesChart
              title="Participation"
              categories={(analytics?.participation_by_day || []).map((d) => formatDateShort(d.date))}
              series={[
                { name: "Joins", data: (analytics?.participation_by_day || []).map((d) => d.joins) },
                { name: "Unique Participants", data: (analytics?.participation_by_day || []).map((d) => d.unique_participants) },
              ]}
              colors={["#34d399", "#38bdf8"]}
            />
          )}
        </div>
      </div>

      {/* Breakdown: type / status / game types */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-foreground mb-3">Rooms by Type</h3>
          <div className="space-y-2">
            {(analytics?.rooms_by_type || []).map((row) => (
              <div key={row.room_type} className="flex items-center justify-between text-sm">
                <span className="capitalize text-foreground">{row.room_type}</span>
                <span className="text-muted-foreground">
                  {row.room_count.toLocaleString()} ({row.percentage.toFixed(1)}%)
                </span>
              </div>
            ))}
            {!analytics?.rooms_by_type?.length && !isLoading && (
              <p className="text-sm text-muted-foreground">No data in this period.</p>
            )}
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-foreground mb-3">Rooms by Status</h3>
          <div className="space-y-2">
            {(analytics?.rooms_by_status || []).map((row) => (
              <div key={row.status} className="flex items-center justify-between text-sm">
                <span className="capitalize text-foreground">{row.status}</span>
                <span className="text-muted-foreground">
                  {row.room_count.toLocaleString()} ({row.percentage.toFixed(1)}%)
                </span>
              </div>
            ))}
            {!analytics?.rooms_by_status?.length && !isLoading && (
              <p className="text-sm text-muted-foreground">No data in this period.</p>
            )}
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-foreground mb-3">
            Popular Game Types
            <span className="ml-2 text-xs font-normal text-muted-foreground">(standard rooms only)</span>
          </h3>
          <div className="space-y-2">
            {(analytics?.popular_game_types || []).map((row) => (
              <div key={row.game_type} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{row.game_type}</span>
                <span className="text-muted-foreground">
                  {row.games_played.toLocaleString()} played · {row.accuracy_percent.toFixed(0)}% acc.
                </span>
              </div>
            ))}
            {!analytics?.popular_game_types?.length && !isLoading && (
              <p className="text-sm text-muted-foreground">
                No standard-room game data in this period{languageId ? " (or excluded by the language filter)" : ""}.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Recent rooms table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">Recent Rooms</h3>
          <p className="text-sm text-muted-foreground mt-1">{recentRooms?.total || 0} rooms match the current filters</p>
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading rooms...</p>
          </div>
        ) : recentRooms && recentRooms.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Host</th>
                  <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Language</th>
                  <th className="px-4 py-2.5 text-right text-sm font-medium text-muted-foreground">Participants</th>
                  <th className="px-4 py-2.5 text-right text-sm font-medium text-muted-foreground">Games</th>
                  <th className="px-4 py-2.5 text-right text-sm font-medium text-muted-foreground">Avg Score</th>
                  <th className="px-4 py-2.5 text-right text-sm font-medium text-muted-foreground">Duration</th>
                  <th className="px-4 py-2.5 text-left text-sm font-medium text-muted-foreground">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentRooms.items.map((room) => (
                  <tr key={room.room_id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${ROOM_TYPE_BADGE_CLASSES[room.room_type] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}>
                        {room.room_type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE_CLASSES[room.status] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}>
                        {room.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-sm text-foreground">
                      <HostCell host={room.host} />
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-sm text-foreground">
                      {room.language.name || <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-right text-sm text-foreground">
                      {room.participant_count}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-right text-sm text-foreground">
                      {room.game_count}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-right text-sm text-foreground">
                      {room.average_score.toFixed(1)}%
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-right text-sm text-foreground">
                      {formatDuration(room.actual_duration_seconds)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-sm text-muted-foreground">
                      {formatDateTime(room.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            No rooms found matching your filters. Try adjusting the time period or filters above.
          </div>
        )}

        {recentRooms && recentRooms.total > 0 && (
          <div className="flex items-center justify-between border-t border-border px-6 py-4">
            <span className="text-sm text-muted-foreground">
              Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, recentRooms.total)} of {recentRooms.total} rooms
            </span>
            <div className="ml-auto">
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </div>
        )}
      </div>

      {/* Known limitations, sourced from the backend response so this stays
          accurate if the backend's documented gaps ever change. */}
      {analytics?.limitations && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
          <h2 className="font-semibold">Known data limitations</h2>
          <ul className="mt-2 space-y-1 text-sm list-disc list-inside">
            <li>Time spent per participant is an estimate ({analytics.limitations.participant_presence_basis.replace(/_/g, " ")}), not a measured session duration.</li>
            <li>Score and game-type breakdowns cover {analytics.limitations.scores_and_game_type_breakdown_scope.replace(/_/g, " ")}; instant sessions have no per-question correct/answered data.</li>
            <li>Standard (long-lived) rooms have {analytics.limitations.standard_room_language_attribution} language attribution — the language filter only ever matches instant rooms.</li>
            {!analytics.limitations.cancelled_status_supported && (
              <li>The &quot;cancelled&quot; room status is not currently produced by the app - filtering by it will always show 0 rooms.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

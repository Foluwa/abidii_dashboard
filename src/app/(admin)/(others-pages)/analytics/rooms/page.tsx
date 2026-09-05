"use client";

import React, { useState } from "react";
import { useAdminRoomsAnalytics, useLanguages } from "@/hooks/useApi";
import type { RoomTypeFilterValue, RoomStatusFilterValue } from "@/types/admin-analytics";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Alert from "@/components/ui/alert/SimpleAlert";
import Pagination from "@/components/tables/Pagination";
import { StyledSelect } from "@/components/ui/form/StyledSelect";
import AnalyticsTabs from "@/components/analytics/AnalyticsTabs";
import RoomsTimeSeriesChart from "@/components/charts/RoomsTimeSeriesChart";

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
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
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
      <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 p-4">
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
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
          {summaryCards.map(({ label, value }) => (
            <div key={label} className="p-4 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
              <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 p-4">
          {isLoading ? (
            <div className="h-[220px] bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
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
        <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 p-4">
          {isLoading ? (
            <div className="h-[220px] bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
          ) : (
            <RoomsTimeSeriesChart
              title="Participation"
              categories={(analytics?.participation_by_day || []).map((d) => formatDateShort(d.date))}
              series={[
                { name: "Joins", data: (analytics?.participation_by_day || []).map((d) => d.joins) },
                { name: "Unique Participants", data: (analytics?.participation_by_day || []).map((d) => d.unique_participants) },
              ]}
              colors={["#12B76A", "#465FFF"]}
            />
          )}
        </div>
      </div>

      {/* Breakdown: type / status / game types */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Rooms by Type</h3>
          <div className="space-y-2">
            {(analytics?.rooms_by_type || []).map((row) => (
              <div key={row.room_type} className="flex items-center justify-between text-sm">
                <span className="capitalize text-gray-700 dark:text-gray-300">{row.room_type}</span>
                <span className="text-gray-500 dark:text-gray-400">
                  {row.room_count.toLocaleString()} ({row.percentage.toFixed(1)}%)
                </span>
              </div>
            ))}
            {!analytics?.rooms_by_type?.length && !isLoading && (
              <p className="text-sm text-gray-500 dark:text-gray-400">No data in this period.</p>
            )}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Rooms by Status</h3>
          <div className="space-y-2">
            {(analytics?.rooms_by_status || []).map((row) => (
              <div key={row.status} className="flex items-center justify-between text-sm">
                <span className="capitalize text-gray-700 dark:text-gray-300">{row.status}</span>
                <span className="text-gray-500 dark:text-gray-400">
                  {row.room_count.toLocaleString()} ({row.percentage.toFixed(1)}%)
                </span>
              </div>
            ))}
            {!analytics?.rooms_by_status?.length && !isLoading && (
              <p className="text-sm text-gray-500 dark:text-gray-400">No data in this period.</p>
            )}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Popular Game Types
            <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">(standard rooms only)</span>
          </h3>
          <div className="space-y-2">
            {(analytics?.popular_game_types || []).map((row) => (
              <div key={row.game_type} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-300">{row.game_type}</span>
                <span className="text-gray-500 dark:text-gray-400">
                  {row.games_played.toLocaleString()} played · {row.accuracy_percent.toFixed(0)}% acc.
                </span>
              </div>
            ))}
            {!analytics?.popular_game_types?.length && !isLoading && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No standard-room game data in this period{languageId ? " (or excluded by the language filter)" : ""}.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Recent rooms table */}
      <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Rooms</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{recentRooms?.total || 0} rooms match the current filters</p>
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-500 dark:text-gray-400">Loading rooms...</p>
          </div>
        ) : recentRooms && recentRooms.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Host</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Language</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Participants</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Games</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg Score</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Duration</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {recentRooms.items.map((room) => (
                  <tr key={room.room_id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${ROOM_TYPE_BADGE_CLASSES[room.room_type] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}>
                        {room.room_type}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE_CLASSES[room.status] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}>
                        {room.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {room.host.display_name || <span className="text-gray-400 dark:text-gray-500">—</span>}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {room.language.name || <span className="text-gray-400 dark:text-gray-500">—</span>}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                      {room.participant_count}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                      {room.game_count}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                      {room.average_score.toFixed(1)}%
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                      {formatDuration(room.actual_duration_seconds)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDateTime(room.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No rooms found matching your filters. Try adjusting the time period or filters above.
          </div>
        )}

        {recentRooms && recentRooms.total > 0 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">
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

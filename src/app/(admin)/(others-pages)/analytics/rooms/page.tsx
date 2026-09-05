"use client";

import AnalyticsTabs from "@/components/analytics/AnalyticsTabs";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import { FiActivity, FiClock, FiHome, FiUsers } from "react-icons/fi";

const requestedMetrics = [
  { label: "Active rooms", icon: FiActivity, detail: "Stored as game_rooms.status, but no current admin API exposes an aggregate." },
  { label: "Rooms per day", icon: FiHome, detail: "Can be calculated from game_rooms.created_at once an admin read endpoint exists." },
  { label: "Average time spent", icon: FiClock, detail: "Room and instant-session duration fields exist, but are not exposed to the dashboard." },
  { label: "Users joining", icon: FiUsers, detail: "room_participants records joins; the current room API only reads one known room at a time." },
];

export default function RoomsAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <PageBreadCrumb pageTitle="Rooms Analytics" />
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Multiplayer room telemetry available through the current dashboard APIs
        </p>
      </div>

      <AnalyticsTabs />

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
        <h2 className="font-semibold">Room aggregates are not exposed by the current backend API</h2>
        <p className="mt-1 text-sm">
          This dashboard-only implementation deliberately does not estimate room metrics from solo game sessions. The database records the required events, but the only existing room read endpoints require a known room ID.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {requestedMetrics.map(({ label, icon: Icon, detail }) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"><Icon className="h-5 w-5" /></span>
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">Not exposed</span>
            </div>
            <h3 className="mt-4 font-semibold text-gray-900 dark:text-white">{label}</h3>
            <p className="mt-2 text-sm leading-5 text-gray-500 dark:text-gray-400">{detail}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Data already captured</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">No schema migration is needed for a future API-backed version of this tab.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/60"><h3 className="font-medium text-gray-900 dark:text-white">Long-lived rooms</h3><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Room type, status, creator, start/end times, winner, participants, scores, games completed and last activity.</p></div>
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/60"><h3 className="font-medium text-gray-900 dark:text-white">Instant sessions</h3><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Player count, winner, leaderboard, game types, language, start/end times and duration.</p></div>
        </div>
      </div>
    </div>
  );
}

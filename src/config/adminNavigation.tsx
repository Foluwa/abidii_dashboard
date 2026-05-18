"use client";

import React from "react";
import {
  BoxCubeIcon,
  GridIcon,
  ListIcon,
  PageIcon,
  PieChartIcon,
  TableIcon,
  UserCircleIcon,
} from "@/icons";

export type AdminNavItem = {
  name: string;
  icon?: React.ReactNode;
  path?: string;
  activePaths?: string[];
  permission?: string;
  pro?: boolean;
  new?: boolean;
  subItems?: AdminNavItem[];
};

export const mainNavigationItems: AdminNavItem[] = [
  {
    name: "Dashboard",
    icon: <GridIcon />,
    path: "/dashboard",
  },
  {
    name: "Reports",
    icon: <PieChartIcon />,
    permission: "users:read",
    subItems: [
      { name: "Game Analytics", path: "/reports/game-analytics" },
      {
        name: "Player Analytics",
        path: "/reports/player-analytics",
      },
      {
        name: "Curriculum Ops",
        path: "/reports/curriculum-ops",
      },
    ],
  },
  {
    name: "Content",
    icon: <ListIcon />,
    permission: "content:read",
    subItems: [
      {
        name: "Library",
        subItems: [
          { name: "Words", path: "/content/library/words" },
          { name: "Phrases", path: "/content/library/phrases" },
          { name: "Time Phrases", path: "/content/library/time-phrases" },
          { name: "Sentences", path: "/content/library/sentences" },
          { name: "Proverbs", path: "/content/library/proverbs" },
          { name: "Letters", path: "/content/library/letters" },
          { name: "Numbers", path: "/content/library/numbers" },
        ],
      },
      {
        name: "Learning Items",
        path: "/content/learning-items",
      },
      { name: "Languages", path: "/content/languages" },
    ],
  },
  {
    name: "Curriculum",
    icon: <PageIcon />,
    permission: "content:read",
    subItems: [
      {
        name: "Courses",
        subItems: [
          { name: "All Courses", path: "/curriculum/courses" },
          { name: "Publishing Readiness", path: "/curriculum/publishing" },
        ],
      },
      { name: "Curriculum Editor", path: "/curriculum/editor" },
      {
        name: "Lesson Blueprints",
        path: "/curriculum/lesson-blueprints",
      },
    ],
  },
  {
    name: "Media",
    icon: <PieChartIcon />,
    subItems: [
      { name: "Voices", path: "/audio/voices", permission: "audio:read" },
      { name: "Audio Jobs", path: "/audio/jobs", permission: "audio:read" },
      { name: "Audio Generate", path: "/audio/generate", permission: "audio:read" },
      { name: "Orphan Assets", path: "/content/audit-log/orphan-assets", permission: "content:read" },
    ],
  },
  {
    name: "Notifications",
    icon: <BellIcon />,
    permission: "users:read",
    subItems: [
      { name: "Compose", path: "/notifications" },
      { name: "History", path: "/notifications/history" },
    ],
  },
  {
    name: "Community",
    icon: <UserCircleIcon />,
    subItems: [
      { name: "Users", path: "/users", permission: "users:read" },
      { name: "Admins", path: "/users/admins", permission: "users:read" },
      { name: "Subscriptions", path: "/subscriptions", permission: "users:read" },
    ],
  },
  {
    name: "System",
    icon: <TableIcon />,
    subItems: [
      { name: "Status", path: "/system/status", permission: "system:read" },
      { name: "Metrics", path: "/system/metrics", permission: "system:read" },
      { name: "Alerts", path: "/system/alerts", permission: "system:read" },
      { name: "Cron Jobs", path: "/system/cron", permission: "system:read" },
      { name: "Admin Jobs", path: "/admin/jobs", permission: "system:read" },
      { name: "ML Training", path: "/operations/ml-training", permission: "system:read" },
      { name: "Configuration", path: "/system/configuration" },
      { name: "Audit Log", path: "/content/audit-log", permission: "content:read" },
      { name: "Testing", path: "/system/testing", permission: "testing:access" },
    ],
  },
];

export const personalNavigationItems: AdminNavItem[] = [
  {
    name: "Settings",
    icon: <BoxCubeIcon />,
    subItems: [
      { name: "Profile", path: "/profile" },
      { name: "Change Password", path: "/settings/change-password" },
    ],
  },
];

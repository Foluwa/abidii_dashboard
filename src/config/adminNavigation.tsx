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
      { name: "Media Library", path: "/media/library", permission: "content:read" },
      {
        name: "Audio",
        permission: "audio:read",
        subItems: [
          { name: "Voices", path: "/media/audio/voices" },
          { name: "Audio Jobs", path: "/media/audio/jobs" },
          { name: "Audio Generate", path: "/media/audio/generate" },
        ],
      },
      {
        name: "Orphan Assets",
        path: "/media/orphan-assets",
        permission: "content:read",
      },
    ],
  },
  {
    name: "Notifications",
    icon: <PieChartIcon />,
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
      {
        name: "Users",
        subItems: [
          { name: "All Users", path: "/community/users", permission: "users:read" },
          { name: "Admins", path: "/community/users/admins", permission: "users:read" },
        ],
      },
      {
        name: "Billing",
        subItems: [
          { name: "Subscriptions", path: "/community/billing", permission: "users:read" },
          { name: "Events", path: "/community/billing/events", permission: "users:read" },
          {
            name: "Verification Attempts",
            path: "/community/billing/verification-attempts",
            permission: "users:read",
          },
        ],
      },
    ],
  },
  {
    name: "System",
    icon: <TableIcon />,
    subItems: [
      {
        name: "Observability",
        permission: "system:read",
        subItems: [
          { name: "Status", path: "/system/observability/status" },
          { name: "Metrics", path: "/system/observability/metrics" },
          { name: "Alerts", path: "/system/observability/alerts" },
          { name: "Cron Jobs", path: "/system/observability/cron-jobs" },
        ],
      },
      {
        name: "Jobs",
        permission: "system:read",
        subItems: [
          { name: "Admin Jobs", path: "/system/jobs/admin" },
        ],
      },
      {
        name: "ML Training",
        permission: "system:read",
        subItems: [
          { name: "Overview", path: "/system/ml-training" },
          { name: "Training Jobs", path: "/system/ml-training/jobs" },
          { name: "Verified Review", path: "/system/ml-training/manifests" },
          { name: "Model Versions", path: "/system/ml-training/models" },
        ],
      },
      {
        name: "Configuration",
        subItems: [
          { name: "Platform", path: "/system/configuration/platform", permission: "system:read" },
          { name: "Application", path: "/system/configuration/application" },
          { name: "Language", path: "/system/configuration/language" },
        ],
      },
      { name: "Audit Log", path: "/system/audit-log", permission: "content:read" },
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

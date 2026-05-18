"use client";

import React from "react";
import {
  BoxCubeIcon,
  GridIcon,
  ListIcon,
  PieChartIcon,
  TableIcon,
  UserCircleIcon,
  AudioIcon,
  BellIcon,
  GroupIcon,
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
    name: "Analytics",
    icon: <PieChartIcon />,
    permission: "users:read",
    path: "/analytics",
    activePaths: ["/analytics/players", "/analytics/curriculum-ops"],
  },
  {
    name: "Content",
    icon: <ListIcon />,
    permission: "content:read",
    subItems: [
      { name: "Words", path: "/content/words" },
      { name: "Phrases", path: "/content/phrases" },
      { name: "Time Phrases", path: "/content/time-phrases" },
      { name: "Sentences", path: "/content/sentences" },
      { name: "Proverbs", path: "/content/proverbs" },
      { name: "Letters", path: "/content/letters" },
      { name: "Numbers", path: "/content/numbers" },
      { name: "Learning Items", path: "/content/learning-items" },
      { name: "Languages", path: "/content/languages" },
      { name: "Curriculum Editor", path: "/curriculum/editor" },
      { name: "Lesson Blueprints", path: "/curriculum/lesson-blueprints" },
      { name: "Courses", path: "/curriculum/courses" },
      { name: "Publishing Readiness", path: "/curriculum/publishing" },
    ],
  },
  {
    name: "Media",
    icon: <AudioIcon />,
    subItems: [
      { name: "Media Library", path: "/media/library", permission: "content:read" },
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
    icon: <GroupIcon />,
    subItems: [
      { name: "Users", path: "/users", permission: "users:read" },
      { name: "Admins", path: "/users/admins", permission: "users:read" },
      { name: "Subscriptions", path: "/community/billing", permission: "users:read" },
      { name: "Billing Events", path: "/community/billing/events", permission: "users:read" },
      {
        name: "Verification Attempts",
        path: "/community/billing/verification-attempts",
        permission: "users:read",
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
          { name: "Status", path: "/system/status" },
          { name: "Metrics", path: "/system/metrics" },
          { name: "Alerts", path: "/system/alerts" },
          { name: "Cron Jobs", path: "/system/cron" },
        ],
      },
      { name: "Admin Jobs", path: "/system/jobs/admin", permission: "system:read" },
      {
        name: "ML Training",
        permission: "system:read",
        subItems: [
          { name: "Overview", path: "/operations/ml-training" },
          { name: "Training Jobs", path: "/operations/ml-training/jobs" },
          { name: "Verified Review", path: "/operations/ml-training/manifests" },
          { name: "Vision Jobs", path: "/operations/ml-training/vision-jobs" },
          { name: "Model Versions", path: "/operations/ml-training/models" },
        ],
      },
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

"use client";

import React from "react";
import {
  BellIcon,
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
    name: "Content",
    icon: <ListIcon />,
    permission: "content:read",
    subItems: [
      {
        name: "Library",
        subItems: [
          { name: "Words", path: "/content/words" },
          { name: "Phrases", path: "/content/phrases" },
          { name: "Time Phrases", path: "/content/time-phrases" },
          { name: "Sentences", path: "/content/sentences" },
          { name: "Proverbs", path: "/content/proverbs" },
          { name: "Letters", path: "/content/letters" },
          { name: "Numbers", path: "/content/numbers" },
        ],
      },
      {
        name: "Dictionary Import",
        path: "/content/dictionary-import",
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
    name: "Analytics",
    icon: <PieChartIcon />,
    path: "/analytics",
    permission: "users:read",
  },
  {
    name: "Media",
    icon: <BoxCubeIcon />,
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
      { name: "Email Templates", path: "/system/email-templates" },
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

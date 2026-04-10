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
    name: "Overview",
    icon: <GridIcon />,
    subItems: [
      { name: "Overview Home", path: "/overview" },
      { name: "Dashboard", path: "/dashboard" },
      { name: "Analytics", path: "/overview/analytics", activePaths: ["/analytics"], permission: "users:read" },
      {
        name: "Player Analytics",
        path: "/overview/analytics/players",
        activePaths: ["/analytics/players"],
        permission: "users:read",
      },
      {
        name: "Curriculum Ops",
        path: "/overview/analytics/curriculum-ops",
        activePaths: ["/analytics/curriculum-ops"],
        permission: "users:read",
      },
    ],
  },
  {
    name: "Content",
    icon: <ListIcon />,
    permission: "content:read",
    subItems: [
      { name: "Content Home", path: "/content" },
      {
        name: "Content Library",
        path: "/content/library",
        subItems: [
          { name: "Words", path: "/content/library/words", activePaths: ["/content/words"] },
          { name: "Phrases", path: "/content/library/phrases", activePaths: ["/content/phrases"] },
          { name: "Time Phrases", path: "/content/library/time-phrases", activePaths: ["/content/time-phrases"] },
          { name: "Sentences", path: "/content/library/sentences", activePaths: ["/content/sentences"] },
          { name: "Proverbs", path: "/content/library/proverbs", activePaths: ["/content/proverbs"] },
          { name: "Letters", path: "/content/library/letters", activePaths: ["/content/letters"] },
          { name: "Numbers", path: "/content/library/numbers", activePaths: ["/content/numbers"] },
          { name: "Games View", path: "/content/library/games", activePaths: ["/games"] },
        ],
      },
      {
        name: "Learning Items",
        path: "/content/learning-items",
      },
      { name: "Languages", path: "/content/languages" },
      {
        name: "Imports",
        path: "/content/imports",
        subItems: [
          { name: "Dictionary Import", path: "/content/imports", activePaths: ["/content/dictionary-import"] },
        ],
      },
    ],
  },
  {
    name: "Curriculum",
    icon: <PageIcon />,
    permission: "content:read",
    subItems: [
      { name: "Curriculum Home", path: "/curriculum" },
      { name: "Courses", path: "/curriculum/courses", activePaths: ["/content/curriculum/courses"] },
      { name: "Curriculum Editor", path: "/curriculum/editor", activePaths: ["/content/curriculum/editor"] },
      {
        name: "Lesson Blueprints",
        path: "/curriculum/lesson-blueprints",
        activePaths: ["/content/curriculum/lesson-blueprints"],
      },
      { name: "Lessons", path: "/curriculum/lessons", activePaths: ["/content/lessons"] },
      { name: "Publishing & Readiness", path: "/curriculum/publishing", activePaths: ["/content/curriculum/readiness"] },
    ],
  },
  {
    name: "Media",
    icon: <PieChartIcon />,
    subItems: [
      { name: "Media Home", path: "/media" },
      { name: "Media Library", path: "/media/library", activePaths: ["/content/curriculum/assets"], permission: "content:read" },
      { name: "Voices", path: "/media/voices", activePaths: ["/audio/voices"], permission: "audio:read" },
      { name: "Audio Jobs", path: "/media/audio-jobs", activePaths: ["/audio/jobs"], permission: "audio:read" },
      { name: "Audio Generate", path: "/media/audio-generate", activePaths: ["/audio/generate"], permission: "audio:read" },
      {
        name: "Orphan Assets",
        path: "/media/orphan-assets",
        activePaths: ["/content/audit-log/orphan-assets"],
        permission: "content:read",
      },
    ],
  },
  {
    name: "Community",
    icon: <UserCircleIcon />,
    subItems: [
      { name: "Community Home", path: "/community" },
      {
        name: "Users",
        path: "/community/users",
        subItems: [
          { name: "All Users", path: "/community/users", activePaths: ["/users"], permission: "users:read" },
          { name: "Admins", path: "/community/users/admins", activePaths: ["/users/admins"], permission: "users:read" },
        ],
      },
      {
        name: "Billing",
        path: "/community/billing",
        subItems: [
          { name: "Subscriptions", path: "/community/billing", activePaths: ["/subscriptions"], permission: "users:read" },
          { name: "Events", path: "/community/billing/events", activePaths: ["/subscriptions/events"], permission: "users:read" },
          {
            name: "Verification Attempts",
            path: "/community/billing/verification-attempts",
            activePaths: ["/subscriptions/attempts"],
            permission: "users:read",
          },
        ],
      },
    ],
  },
  {
    name: "Operations",
    icon: <TableIcon />,
    subItems: [
      { name: "Operations Home", path: "/operations" },
      { name: "Status", path: "/operations/status", activePaths: ["/system/status"], permission: "system:read" },
      { name: "Metrics", path: "/operations/metrics", activePaths: ["/system/metrics"], permission: "system:read" },
      { name: "Alerts", path: "/operations/alerts", activePaths: ["/system/alerts"], permission: "system:read" },
      { name: "Cron Jobs", path: "/operations/cron-jobs", activePaths: ["/system/cron"], permission: "system:read" },
      { name: "Idempotency", path: "/operations/idempotency", activePaths: ["/system/idempotency"], permission: "system:read" },
      {
        name: "Configuration",
        path: "/operations/configuration",
        subItems: [
          { name: "Overview", path: "/operations/configuration" },
          { name: "Platform", path: "/operations/configuration/platform", activePaths: ["/system/config"], permission: "system:read" },
          { name: "Application", path: "/operations/configuration/application", activePaths: ["/settings/app-config"] },
          { name: "Language", path: "/operations/configuration/language", activePaths: ["/settings/language-settings"] },
        ],
      },
      { name: "Audit Log", path: "/operations/audit-log", activePaths: ["/content/audit-log"], permission: "content:read" },
      { name: "Testing", path: "/operations/testing", activePaths: ["/testing"], permission: "testing:access" },
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

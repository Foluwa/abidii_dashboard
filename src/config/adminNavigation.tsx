"use client";

import React from "react";
import {
  AudioLines,
  Bell,
  GraduationCap,
  Layers,
  LayoutDashboard,
  PieChart,
  Server,
  Settings,
  Users,
} from "lucide-react";

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
    icon: <LayoutDashboard className="size-5" />,
    path: "/dashboard",
  },
  {
    name: "Analytics",
    icon: <PieChart className="size-5" />,
    path: "/analytics",
    permission: "users:read",
  },
  {
    name: "Community",
    icon: <Users className="size-5" />,
    subItems: [
      { name: "Users", path: "/users", permission: "users:read" },
      { name: "Admins", path: "/users/admins", permission: "users:read" },
      { name: "Subscriptions", path: "/subscriptions", permission: "users:read" },
    ],
  },
  {
    name: "Content",
    icon: <Layers className="size-5" />,
    permission: "content:read",
    subItems: [
      {
        name: "Library",
        path: "/content/library",
        activePaths: [
          "/content/words",
          "/content/phrases",
          "/content/time-phrases",
          "/content/sentences",
          "/content/proverbs",
          "/content/letters",
          "/content/numbers",
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
      {
        name: "Quick Practice",
        path: "/content/quick-practice",
      },
      {
        name: "Audio Reconciliation",
        path: "/content/audio-reconciliation",
      },
      {
        name: "Localizations",
        path: "/content/localizations",
      },
      {
        name: "Patterns",
        path: "/content/patterns",
      },
      {
        name: "Conversation Scenes",
        path: "/content/conversation-scenes",
        permission: "content:read",
      },
      {
        name: "Daily Missions",
        path: "/content/daily-missions",
        permission: "content:read",
      },
      {
        name: "Content Ops",
        path: "/content/ops",
        activePaths: [
          "/content/audit-log",
          "/content/audit-log/orphan-assets",
          "/content/reports",
          "/content/content-safety",
        ],
      },
    ],
  },
  {
    name: "Curriculum",
    icon: <GraduationCap className="size-5" />,
    permission: "content:read",
    subItems: [
      {
        name: "Courses",
        path: "/curriculum/courses-hub",
        activePaths: ["/curriculum/courses", "/curriculum/publishing"],
      },
      { name: "Curriculum Editor", path: "/curriculum/editor" },
      {
        name: "Lesson Blueprints",
        path: "/curriculum/lesson-blueprints",
        activePaths: ["/curriculum/lesson-import", "/curriculum/assets"],
      },
    ],
  },
  {
    name: "Audio",
    icon: <AudioLines className="size-5" />,
    path: "/audio",
    activePaths: ["/audio/voices", "/audio/generate", "/audio/jobs"],
    permission: "audio:read",
  },
  {
    name: "Notifications",
    icon: <Bell className="size-5" />,
    path: "/notifications",
    activePaths: ["/notifications/history", "/notifications/daily"],
    permission: "users:read",
  },
  {
    name: "System",
    icon: <Server className="size-5" />,
    subItems: [
      {
        name: "Infrastructure",
        subItems: [
          {
            name: "Health",
            path: "/system/health",
            activePaths: ["/system/status", "/system/metrics", "/system/idempotency"],
            permission: "system:read",
          },
          {
            name: "Alerts",
            path: "/system/alerts-hub",
            activePaths: ["/system/alerts", "/system/testing"],
            permission: "system:read",
          },
          {
            name: "Security",
            path: "/system/security",
            activePaths: ["/enforcement", "/system/security-exceptions"],
            permission: "system:read",
          },
        ],
      },
      {
        name: "Jobs",
        subItems: [
          {
            name: "Jobs",
            path: "/system/jobs",
            activePaths: ["/system/cron", "/admin/jobs"],
            permission: "system:read",
          },
          { name: "ML Training", path: "/operations/ml-training", permission: "system:read" },
        ],
      },
      {
        name: "Platform",
        subItems: [
          {
            name: "Configuration",
            path: "/system/configuration",
            activePaths: ["/system/email-templates"],
          },
        ],
      },
    ],
  },
];

export const personalNavigationItems: AdminNavItem[] = [
  {
    name: "Settings",
    icon: <Settings className="size-5" />,
    path: "/settings",
    activePaths: ["/profile", "/settings/change-password"],
  },
];

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
      },
      {
        name: "Lesson Import",
        path: "/curriculum/lesson-import",
      },
      {
        name: "Blueprint Assets",
        path: "/curriculum/assets",
      },
    ],
  },
  {
    name: "Media",
    icon: <AudioLines className="size-5" />,
    subItems: [
      { name: "Voices", path: "/audio/voices", permission: "audio:read" },
      { name: "Audio Jobs", path: "/audio/jobs", permission: "audio:read" },
      { name: "Audio Generate", path: "/audio/generate", permission: "audio:read" },
    ],
  },
  {
    name: "Notifications",
    icon: <Bell className="size-5" />,
    permission: "users:read",
    subItems: [
      { name: "Compose", path: "/notifications" },
      { name: "History", path: "/notifications/history" },
      { name: "Daily Content", path: "/notifications/daily" },
    ],
  },
  {
    name: "System",
    icon: <Server className="size-5" />,
    subItems: [
      {
        name: "Infrastructure",
        subItems: [
          { name: "Status", path: "/system/status", permission: "system:read" },
          { name: "Metrics", path: "/system/metrics", permission: "system:read" },
          {
            name: "Alerts",
            path: "/system/alerts-hub",
            activePaths: ["/system/alerts", "/system/testing"],
            permission: "system:read",
          },
          { name: "Idempotency", path: "/system/idempotency", permission: "system:read" },
          { name: "Enforcement", path: "/enforcement", permission: "system:read" },
          { name: "Security Exceptions", path: "/system/security-exceptions", permission: "system:read" },
        ],
      },
      {
        name: "Jobs",
        subItems: [
          { name: "Cron Jobs", path: "/system/cron", permission: "system:read" },
          { name: "Admin Jobs", path: "/admin/jobs", permission: "system:read" },
          { name: "ML Training", path: "/operations/ml-training", permission: "system:read" },
          { name: "Candidate Review", path: "/operations/ml-training/candidate-manifests", permission: "system:read" },
        ],
      },
      {
        name: "Platform",
        subItems: [
          { name: "Configuration", path: "/system/configuration" },
          { name: "Email Templates", path: "/system/email-templates" },
        ],
      },
      {
        name: "Content Ops",
        subItems: [
          { name: "Audit Log", path: "/content/audit-log", permission: "content:read" },
          { name: "Orphan Assets", path: "/content/audit-log/orphan-assets", permission: "content:read" },
          { name: "Content Reports", path: "/content/reports", permission: "content:read" },
          { name: "Content Safety", path: "/content/content-safety", permission: "content:read" },
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

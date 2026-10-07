"use client";
import React from "react";
import { useAuth } from "@/context/AuthContext";

function formatDate(value?: string | null) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not available";
  return parsed.toLocaleString();
}

function formatRole(value?: string | null) {
  if (!value) return "User";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function UserInfoCard() {
  const { user } = useAuth();

  const rows = [
    ["Email", user?.email || "Not available"],
    ["Role", formatRole(user?.role)],
    ["User ID", user?.id || "Not available"],
    ["Created", formatDate(user?.created_at)],
    ["Last Updated", formatDate(user?.updated_at)],
  ];

  return (
    <div className="p-5 border border-border rounded-2xl lg:p-6">
      <h4 className="text-lg font-semibold text-foreground lg:mb-6">
        Account Information
      </h4>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-7 2xl:gap-x-32">
        {rows.map(([label, value]) => (
          <div key={label}>
            <p className="mb-2 text-xs leading-normal text-muted-foreground">
              {label}
            </p>
            <p className="break-all text-sm font-medium text-foreground">
              {value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

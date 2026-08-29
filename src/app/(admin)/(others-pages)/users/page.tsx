"use client";

import React, { useState } from "react";
import { useUsers, useLanguages, useUserCountries } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import { apiClient } from "@/lib/api";
import type { UserRole } from "@/types/auth";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Alert from "@/components/ui/alert/SimpleAlert";
import StatusBadge from "@/components/admin/StatusBadge";
import { StyledSelect } from "@/components/ui/form/StyledSelect";
import Pagination from "@/components/tables/Pagination";
import Link from "next/link";
import { FaApple, FaGoogle, FaGlobe, FaMobileAlt } from "react-icons/fa";
import { FiEye, FiTrash2, FiUserCheck, FiUserX } from "react-icons/fi";
import { cleanSvgForDisplay, getAvatarColor, getInitials } from "@/lib/svg-utils";

type TabRole = "all" | UserRole;
type ActionType = "deactivate" | "reactivate" | "delete" | "purge";

// App/interface-language display list - see abidii_app_language.md §8.2.
// Fixed (not fetched), since ui_locale is a small closed allowlist, unlike
// the dynamic learning-language list above. No "Unknown" filter option:
// the admin API's ui_locale filter doesn't support a null match.
const APP_LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
  { value: "pt", label: "Portuguese (Brazil)" },
  { value: "yo", label: "Yorùbá" },
];

interface ActionConfirm {
  userId: string;
  action: ActionType;
  userName: string;
}

type SortOption = "created_desc" | "created_asc" | "active_desc" | "active_asc";

const toDateBoundary = (value: string, endOfDay = false) => {
  if (!value) return undefined;
  const time = endOfDay ? "23:59:59.999" : "00:00:00.000";
  return new Date(`${value}T${time}`).toISOString();
};

const countryName = (code: string) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
};

function UserAvatar({ user, size = "w-10 h-10" }: { user: any; size?: string }) {
  const [failed, setFailed] = useState(false);
  const source = cleanSvgForDisplay(user.avatar_svg) || user.picture_url || null;
  const label = user.display_name || user.email || "User";

  if (source && !failed) {
    return (
      <img
        src={source}
        alt={`${label} avatar`}
        className={`${size} rounded-full object-cover bg-gray-100 dark:bg-gray-700`}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className={`${size} rounded-full ${getAvatarColor(user.id || label)} flex items-center justify-center`}>
      <span className="font-semibold text-sm text-white">{getInitials(label)}</span>
    </div>
  );
}

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabRole>("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  
  // Advanced filters
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [appLanguageFilter, setAppLanguageFilter] = useState<string>("all");
  const [minXp, setMinXp] = useState<string>("");
  const [maxXp, setMaxXp] = useState<string>("");
  const [lastLoginAfter, setLastLoginAfter] = useState<string>("");
  const [lastLoginBefore, setLastLoginBefore] = useState<string>("");
  const [sortOption, setSortOption] = useState<SortOption>("created_desc");
  const [showFilters, setShowFilters] = useState(false);
  
  // Action confirmation modal
  const [actionConfirm, setActionConfirm] = useState<ActionConfirm | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const role = activeTab === "all" ? undefined : activeTab;
  const isActive = statusFilter === "all" ? undefined : statusFilter === "active";
  const provider = providerFilter === "all" ? undefined : providerFilter;
  const countryCode = countryFilter === "all" ? undefined : countryFilter;
  const languageCode = languageFilter === "all" ? undefined : languageFilter;
  const uiLocale = appLanguageFilter === "all" ? undefined : appLanguageFilter;
  const debouncedSearch = useDebounce(search, 300);
  const { languages } = useLanguages();
  const { countries } = useUserCountries();
  const [sortBy, sortOrder] = sortOption.startsWith("active")
    ? (["last_active_at", sortOption.endsWith("asc") ? "asc" : "desc"] as const)
    : (["created_at", sortOption.endsWith("asc") ? "asc" : "desc"] as const);

  const { users, isLoading, isError, refresh } = useUsers({
    search: debouncedSearch,
    role,
    page,
    limit,
    is_active: isActive,
    provider,
    country_code: countryCode,
    language_code: languageCode,
    ui_locale: uiLocale,
    min_xp: minXp ? parseInt(minXp) : undefined,
    max_xp: maxXp ? parseInt(maxXp) : undefined,
    last_login_after: toDateBoundary(lastLoginAfter),
    last_login_before: toDateBoundary(lastLoginBefore, true),
    sort_by: sortBy,
    sort_order: sortOrder,
  });

  const totalPages = users ? Math.max(1, Math.ceil(users.total / limit)) : 1;

  const tabs: { label: string; value: TabRole; count?: number }[] = [
    { label: "All Users", value: "all" },
    { label: "Admins", value: "admin" },
    { label: "Managers", value: "manager" },
    { label: "Users", value: "user" },
  ];

  const handleTabChange = (tab: TabRole) => {
    setActiveTab(tab);
    setPage(1);
  };

  const handleAction = async () => {
    if (!actionConfirm) return;
    
    setActionLoading(true);
    try {
      const { userId, action } = actionConfirm;
      
      switch (action) {
        case "deactivate":
          await apiClient.post(`/api/v1/admin/users/${userId}/deactivate`);
          setSuccessMessage("User deactivated successfully");
          break;
        case "reactivate":
          await apiClient.post(`/api/v1/admin/users/${userId}/reactivate`);
          setSuccessMessage("User reactivated successfully");
          break;
        case "delete":
          await apiClient.delete(`/api/v1/admin/users/${userId}`);
          setSuccessMessage("User deleted successfully");
          break;
        case "purge":
          await apiClient.delete(`/api/v1/admin/users/${userId}/purge`);
          setSuccessMessage("User and all data purged successfully");
          break;
      }
      
      setActionConfirm(null);
      refresh();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || `Failed to ${actionConfirm.action} user`);
      setTimeout(() => setErrorMessage(""), 5000);
    } finally {
      setActionLoading(false);
    }
  };

  const getActionMessage = (action: ActionType, userName: string) => {
    switch (action) {
      case "deactivate":
        return `Are you sure you want to deactivate "${userName}"? They will not be able to log in.`;
      case "reactivate":
        return `Are you sure you want to reactivate "${userName}"? They will be able to log in again.`;
      case "delete":
        return `Are you sure you want to delete "${userName}"? This action cannot be undone.`;
      case "purge":
        return `⚠️ DANGER: Are you sure you want to PURGE "${userName}"? This will delete the user AND all their learning data, progress, and sessions. This action is IRREVERSIBLE.`;
    }
  };

  const getProviderLabel = (provider: string) => {
    switch (provider) {
      case "google": return "Google";
      case "apple": return "Apple";
      case "device": return "Device";
      case "email": return "Email";
      default: return provider || "Unknown";
    }
  };

  const getProviderBadgeStatus = (provider: string) => {
    switch (provider) {
      case "google": return "info" as const;
      case "apple": return "success" as const;
      case "device": return "warning" as const;
      default: return "info" as const;
    }
  };

  const getRoleBadgeStatus = (userRole: UserRole) => {
    switch (userRole) {
      case "admin":
        return "error" as const;
      case "manager":
        return "warning" as const;
      case "user":
        return "info" as const;
      default:
        return "info" as const;
    }
  };

  const countryFlag = (code?: string | null) => {
    if (!code || code.trim().length !== 2) return null;
    const cc = code.trim().toUpperCase();
    return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
  };

  const getDeviceIcon = (platform: string | null) => {
    const commonClassName = "h-5 w-5 text-gray-900 dark:text-white";

    switch (platform?.toLowerCase()) {
      case "ios":
        return <FaApple className={commonClassName} aria-label="Apple (iOS)" />;
      case "android":
        return <FaGoogle className={commonClassName} aria-label="Google (Android)" />;
      case "web":
        return <FaGlobe className={commonClassName} aria-label="Web" />;
      default:
        return <FaMobileAlt className={commonClassName} aria-label="Device" />;
    }
  };

  const formatLastRequest = (lastRequestAt: string | null | undefined) => {
    if (!lastRequestAt) return "Never";
    const date = new Date(lastRequestAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) {
      const remainderMins = diffMins - diffHours * 60;
      return remainderMins > 0 ? `${diffHours}h ${remainderMins}m ago` : `${diffHours}h ago`;
    }
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Prefer last_active_at (devices.last_seen_at, touched on every app
  // startup/foreground report) over last_request_at/last_login_at, which
  // only update on explicit sign-in and go stale under offline-first
  // sessions - see the same reasoning on the backend's last_login_after/
  // before filters and the last_active_at sort option above.
  const getLastRequestAt = (user: {
    last_active_at?: string | null;
    last_request_at?: string | null;
    last_login_at?: string | null;
  }) =>
    user.last_active_at ??
    (user.last_request_at === undefined ? user.last_login_at : user.last_request_at);

  if (isError) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="Users" />
        <Alert variant="error">
          Failed to load users. Please check your API connection.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <PageBreadCrumb pageTitle="Users" />
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage all platform users
        </p>
      </div>

      {/* Success/Error Messages */}
      {successMessage && <Alert variant="success">{successMessage}</Alert>}
      {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

      {/* Tabs and Filters */}
      <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
        {/* Role Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-800">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => handleTabChange(tab.value)}
                className={`px-6 py-3 text-sm font-medium whitespace-nowrap transition-colors relative ${
                  activeTab === tab.value
                    ? "text-brand-600 dark:text-brand-400"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
              >
                {tab.label}
                {activeTab === tab.value && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600 dark:bg-brand-400" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Search Filter */}
        <div className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Search
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by name or email..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <StyledSelect
              label="Status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as "all" | "active" | "inactive");
                setPage(1);
              }}
              options={[
                { value: "all", label: "All Status" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" }
              ]}
            />

            <StyledSelect
              label="Provider"
              value={providerFilter}
              onChange={(e) => {
                setProviderFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: "all", label: "All Providers" },
                { value: "google", label: "Google" },
                { value: "apple", label: "Apple" },
                { value: "device", label: "Device" },
                { value: "email", label: "Email" }
              ]}
            />

            <StyledSelect
              label="Country"
              value={countryFilter}
              onChange={(e) => {
                setCountryFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: "all", label: "All Countries" },
                ...[...(countries || [])]
                  .sort((a: any, b: any) => countryName(a.country_code).localeCompare(countryName(b.country_code)))
                  .map((item: any) => ({
                    value: item.country_code,
                    label: `${countryFlag(item.country_code) || ""} ${countryName(item.country_code)} (${item.count})`.trim(),
                  })),
              ]}
            />

            <StyledSelect
              label="Language"
              value={languageFilter}
              onChange={(e) => {
                setLanguageFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: "all", label: "All Languages" },
                ...(languages?.map((lang: any) => ({
                  value: lang.iso_639_3,
                  label: lang.name
                })) || [])
              ]}
            />

            <StyledSelect
              label="App Language"
              value={appLanguageFilter}
              onChange={(e) => {
                setAppLanguageFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: "all", label: "All App Languages" },
                ...APP_LANGUAGE_OPTIONS,
              ]}
            />

            <StyledSelect
              label="Sort By"
              value={sortOption}
              onChange={(e) => {
                setSortOption(e.target.value as SortOption);
                setPage(1);
              }}
              options={[
                { value: "active_desc", label: "Most Recently Seen" },
                { value: "active_asc", label: "Least Recently Seen" },
                { value: "created_desc", label: "Newest Signups" },
                { value: "created_asc", label: "Oldest Signups" },
              ]}
            />

            <StyledSelect
              label="Per Page"
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              options={[
                { value: 20, label: "20" },
                { value: 50, label: "50" },
                { value: 100, label: "100" }
              ]}
            />

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
            >
              {showFilters ? "Hide Filters" : "More Filters"}
            </button>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="min-w-[150px]">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Min XP
                  </label>
                  <input
                    type="number"
                    value={minXp}
                    onChange={(e) => {
                      setMinXp(e.target.value);
                      setPage(1);
                    }}
                    placeholder="0"
                    min="0"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                <div className="min-w-[150px]">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Max XP
                  </label>
                  <input
                    type="number"
                    value={maxXp}
                    onChange={(e) => {
                      setMaxXp(e.target.value);
                      setPage(1);
                    }}
                    placeholder="No limit"
                    min="0"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                <div className="min-w-[170px]">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Last Request After
                  </label>
                  <input
                    type="date"
                    value={lastLoginAfter}
                    onChange={(e) => {
                      setLastLoginAfter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                <div className="min-w-[170px]">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Last Request Before
                  </label>
                  <input
                    type="date"
                    value={lastLoginBefore}
                    onChange={(e) => {
                      setLastLoginBefore(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                <button
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                    setProviderFilter("all");
                    setCountryFilter("all");
                    setLanguageFilter("all");
                    setAppLanguageFilter("all");
                    setMinXp("");
                    setMaxXp("");
                    setLastLoginAfter("");
                    setLastLoginBefore("");
                    setSortOption("created_desc");
                    setActiveTab("all");
                    setPage(1);
                  }}
                  className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  Clear All Filters
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto"></div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Device
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Country
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Learning
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      App Language
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Last Request
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      XP
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Role
                    </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Premium
                      </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {users && users.users && users.users.length > 0 ? (
                    users.users.map((user: any) => (
                      <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            {/* Avatar */}
                            <div className="flex-shrink-0">
                              <UserAvatar user={user} />
                            </div>
                            {/* Name and Email */}
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {user.display_name || user.name || "N/A"}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {user.email || "No email"}
                              </div>
                              <div className="flex items-center gap-1 mt-0.5">
                                <StatusBadge 
                                  status={getProviderBadgeStatus(user.provider)} 
                                  label={getProviderLabel(user.provider)} 
                                />
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center">{getDeviceIcon(user.device_platform)}</span>
                            <div>
                              <div className="text-sm text-gray-900 dark:text-white">
                                {user.device_platform ? user.device_platform.charAt(0).toUpperCase() + user.device_platform.slice(1) : "Unknown"}
                              </div>
                              {user.device_name && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px]" title={user.device_name}>
                                  {user.device_name}
                                </div>
                              )}
                              {user.device_app_version && (
                                <div className="text-xs text-gray-400 dark:text-gray-500">
                                  v{user.device_app_version}{user.device_build_number ? `(${user.device_build_number})` : ''}
                                </div>
                              )}
                              {user.device_id && (
                                <div
                                  className="text-xs font-mono text-gray-400 dark:text-gray-500 truncate max-w-[140px]"
                                  title={`Device ID: ${user.device_id}`}
                                >
                                  ID: {user.device_id}
                                </div>
                              )}
                              {user.last_ip_address && (
                                <div
                                  className="text-xs font-mono text-gray-400 dark:text-gray-500 truncate max-w-[140px]"
                                  title={`Last IP: ${user.last_ip_address}`}
                                >
                                  IP: {user.last_ip_address}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                            {countryFlag(user.country_code) && (
                              <span className="text-base leading-none">{countryFlag(user.country_code)}</span>
                            )}
                            <span>{user.country_code ? user.country_code.toUpperCase() : "—"}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {user.current_language_name ? (
                            <StatusBadge status="info" label={user.current_language_name} />
                          ) : (
                            <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {user.ui_locale_name ? (
                            <span title={user.ui_locale}>
                              <StatusBadge status="info" label={user.ui_locale_name} />
                            </span>
                          ) : (
                            <span
                              className="text-sm text-gray-400 dark:text-gray-500"
                              title="No ui_locale has been synced from a device yet"
                            >
                              Unknown
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600 dark:text-gray-400" title={getLastRequestAt(user) ? new Date(getLastRequestAt(user)!).toLocaleString() : "Never"}>
                            {formatLastRequest(getLastRequestAt(user))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {(user.total_xp ?? 0).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge status={getRoleBadgeStatus(user.role)} label={user.role} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {user.has_premium ? (
                            <StatusBadge status="success" label="Premium" />
                          ) : (
                            <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge status={user.is_active ? "success" : "error"} 
                            label={user.is_active ? "Active" : "Inactive"} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/users/${user.id}`}
                              aria-label={`View ${user.display_name || user.email || "user"}`}
                              title="View user"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-brand-600 hover:bg-brand-50 hover:text-brand-900 dark:text-brand-400 dark:hover:bg-brand-900/30 dark:hover:text-brand-300"
                            >
                              <FiEye className="h-5 w-5" aria-hidden="true" />
                            </Link>
                            {user.is_active ? (
                              <button
                                onClick={() => setActionConfirm({ userId: user.id, action: "deactivate", userName: user.display_name || user.email })}
                                aria-label={`Deactivate ${user.display_name || user.email || "user"}`}
                                title="Deactivate user"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-orange-600 hover:bg-orange-50 hover:text-orange-900 dark:text-orange-400 dark:hover:bg-orange-900/30 dark:hover:text-orange-300"
                              >
                                <FiUserX className="h-5 w-5" aria-hidden="true" />
                              </button>
                            ) : (
                              <button
                                onClick={() => setActionConfirm({ userId: user.id, action: "reactivate", userName: user.display_name || user.email })}
                                aria-label={`Reactivate ${user.display_name || user.email || "user"}`}
                                title="Reactivate user"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-green-600 hover:bg-green-50 hover:text-green-900 dark:text-green-400 dark:hover:bg-green-900/30 dark:hover:text-green-300"
                              >
                                <FiUserCheck className="h-5 w-5" aria-hidden="true" />
                              </button>
                            )}
                            <button
                              onClick={() => setActionConfirm({ userId: user.id, action: "delete", userName: user.display_name || user.email })}
                              aria-label={`Delete ${user.display_name || user.email || "user"}`}
                              title="Delete user"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 hover:text-red-900 dark:text-red-400 dark:hover:bg-red-900/30 dark:hover:text-red-300"
                            >
                              <FiTrash2 className="h-5 w-5" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={11} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                        No users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {users && totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Showing {(page - 1) * limit + 1} to {Math.min(page * limit, users.total)} of {users.total} users
                  </p>
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={(nextPage) => {
                      const clamped = Math.max(1, Math.min(totalPages, nextPage));
                      setPage(clamped);
                    }}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Action Confirmation Modal */}
      {actionConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Confirm {actionConfirm.action.charAt(0).toUpperCase() + actionConfirm.action.slice(1)}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              {getActionMessage(actionConfirm.action, actionConfirm.userName)}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setActionConfirm(null)}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={actionLoading}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${
                  actionConfirm.action === "purge" 
                    ? "bg-red-700 hover:bg-red-800" 
                    : actionConfirm.action === "delete"
                    ? "bg-red-600 hover:bg-red-700"
                    : actionConfirm.action === "deactivate"
                    ? "bg-orange-600 hover:bg-orange-700"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {actionLoading ? "Processing..." : `Yes, ${actionConfirm.action}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { useUsers } from "@/hooks/useApi";
import { apiClient } from "@/lib/api";
import type { UserRole } from "@/types/auth";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Alert from "@/components/ui/alert/SimpleAlert";
import StatusBadge from "@/components/admin/StatusBadge";
import { StyledSelect } from "@/components/ui/form/StyledSelect";
import Pagination from "@/components/tables/Pagination";
import Link from "next/link";
import { FaApple, FaGoogle, FaGlobe, FaMobileAlt } from "react-icons/fa";

type TabRole = "all" | UserRole;
type ActionType = "deactivate" | "reactivate" | "delete" | "purge";

interface ActionConfirm {
  userId: number;
  action: ActionType;
  userName: string;
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
  const [minXp, setMinXp] = useState<string>("");
  const [maxXp, setMaxXp] = useState<string>("");
  const [lastLoginAfter, setLastLoginAfter] = useState<string>("");
  const [lastLoginBefore, setLastLoginBefore] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  
  // Action confirmation modal
  const [actionConfirm, setActionConfirm] = useState<ActionConfirm | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const role = activeTab === "all" ? undefined : activeTab;
  const isActive = statusFilter === "all" ? undefined : statusFilter === "active";
  const provider = providerFilter === "all" ? undefined : providerFilter;
  
  const { users, isLoading, isError, refresh } = useUsers({ 
    search, 
    role, 
    page, 
    limit,
    is_active: isActive,
    provider,
    min_xp: minXp ? parseInt(minXp) : undefined,
    max_xp: maxXp ? parseInt(maxXp) : undefined,
    last_login_after: lastLoginAfter ? new Date(lastLoginAfter).toISOString() : undefined,
    last_login_before: lastLoginBefore ? new Date(lastLoginBefore).toISOString() : undefined,
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

  const formatLastLogin = (lastLoginAt: string | null) => {
    if (!lastLoginAt) return "Never";
    const date = new Date(lastLoginAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

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
                    Last Login After
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
                    Last Login Before
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
                    setMinXp("");
                    setMaxXp("");
                    setLastLoginAfter("");
                    setLastLoginBefore("");
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
                      Last Login
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
                              {user.avatar_svg ? (
                                <img 
                                  src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(user.avatar_svg)}`}
                                  alt={user.display_name || "User avatar"}
                                  className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center">
                                  <span className="text-brand-600 dark:text-brand-400 font-medium text-sm">
                                    {(user.display_name || user.email || "U").charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )}
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
                          <div className="text-sm text-gray-600 dark:text-gray-400" title={user.last_login_at ? new Date(user.last_login_at).toLocaleString() : "Never"}>
                            {formatLastLogin(user.last_login_at)}
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
                              href={`/community/users/${user.id}`}
                              className="text-brand-600 hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300"
                            >
                              View
                            </Link>
                            {user.is_active ? (
                              <button
                                onClick={() => setActionConfirm({ userId: user.id, action: "deactivate", userName: user.display_name || user.email })}
                                className="text-orange-600 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-300"
                              >
                                Deactivate
                              </button>
                            ) : (
                              <button
                                onClick={() => setActionConfirm({ userId: user.id, action: "reactivate", userName: user.display_name || user.email })}
                                className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                              >
                                Reactivate
                              </button>
                            )}
                            <button
                              onClick={() => setActionConfirm({ userId: user.id, action: "delete", userName: user.display_name || user.email })}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
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

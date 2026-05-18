"use client";

import React, { useState } from "react";
import { useUserDetail } from "@/hooks/useApi";
import { useParams, useRouter } from "next/navigation";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Alert from "@/components/ui/alert/SimpleAlert";
import StatusBadge from "@/components/admin/StatusBadge";
import ConfirmationModal from "@/components/modals/ConfirmationModal";
import type { UserRole } from "@/types/auth";

type ModalType = "deactivate" | "reactivate" | "delete" | "purge" | null;

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  // User IDs are UUIDs - do NOT convert to Number
  const userId = params.id as string;
  const { user, isLoading, isError, refresh } = useUserDetail(userId);
  
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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

  const handleAction = async (action: ModalType) => {
    if (!action || !userId) return;
    
    setActionLoading(true);
    setActionError(null);
    
    try {
      const token = localStorage.getItem("admin_token");
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
      
      let endpoint = "";
      let method = "POST";
      
      switch (action) {
        case "deactivate":
          endpoint = `/api/v1/admin/users/${userId}/deactivate`;
          break;
        case "reactivate":
          endpoint = `/api/v1/admin/users/${userId}/reactivate`;
          break;
        case "delete":
          endpoint = `/api/v1/admin/users/${userId}`;
          method = "DELETE";
          break;
        case "purge":
          endpoint = `/api/v1/admin/users/${userId}/purge`;
          method = "DELETE";
          break;
      }
      
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Action failed");
      }
      
      // Close modal
      setActiveModal(null);
      
      // For delete/purge, redirect to users list
      if (action === "delete" || action === "purge") {
        router.push("/users");
      } else {
        // For activate/deactivate, refresh the data
        refresh();
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setActionLoading(false);
    }
  };

  const modalConfig = {
    deactivate: {
      title: "Deactivate User",
      message: `Are you sure you want to deactivate this user? They will not be able to log in until reactivated.`,
      confirmLabel: "Deactivate",
      variant: "warning" as const,
    },
    reactivate: {
      title: "Reactivate User",
      message: `Are you sure you want to reactivate this user? They will be able to log in again.`,
      confirmLabel: "Reactivate",
      variant: "info" as const,
    },
    delete: {
      title: "Soft Delete User",
      message: `Are you sure you want to delete this user? The user will be marked as deleted but their data will be retained.`,
      confirmLabel: "Delete",
      variant: "danger" as const,
    },
    purge: {
      title: "Permanently Purge User",
      message: `⚠️ WARNING: This action is IRREVERSIBLE. All user data including learning progress, subscriptions, and analytics will be permanently deleted. Are you absolutely sure?`,
      confirmLabel: "Permanently Delete",
      variant: "danger" as const,
    },
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="User Details" />
        <div className="p-6 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 animate-pulse">
          <div className="space-y-4">
            <div className="h-8 bg-gray-200 rounded dark:bg-gray-700 w-1/4"></div>
            <div className="h-4 bg-gray-200 rounded dark:bg-gray-700"></div>
            <div className="h-4 bg-gray-200 rounded dark:bg-gray-700"></div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="User Details" />
        <Alert variant="error">
          Failed to load user details. The user may not exist or there was an API error.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Confirmation Modal */}
      {activeModal && (
        <ConfirmationModal
          isOpen={!!activeModal}
          onClose={() => setActiveModal(null)}
          onConfirm={() => handleAction(activeModal)}
          title={modalConfig[activeModal].title}
          message={modalConfig[activeModal].message}
          confirmLabel={modalConfig[activeModal].confirmLabel}
          variant={modalConfig[activeModal].variant}
          isLoading={actionLoading}
        />
      )}

      {/* Error Alert */}
      {actionError && (
        <Alert variant="error">
          {actionError}
        </Alert>
      )}

      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <PageBreadCrumb pageTitle="User Details" />
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Detailed information for user #{user.id.slice(0, 8)}...
          </p>
        </div>
        <div className="flex gap-2">
          {user.is_active ? (
            <button
              onClick={() => setActiveModal("deactivate")}
              className="px-4 py-2 text-sm font-medium text-yellow-700 bg-yellow-100 rounded-lg hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/50"
            >
              Deactivate
            </button>
          ) : (
            <button
              onClick={() => setActiveModal("reactivate")}
              className="px-4 py-2 text-sm font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
            >
              Reactivate
            </button>
          )}
          <button
            onClick={() => setActiveModal("delete")}
            className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
          >
            Soft Delete
          </button>
          <button
            onClick={() => setActiveModal("purge")}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
          >
            Purge
          </button>
        </div>
      </div>

      {/* User Info Card */}
      <div className="p-6 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
        <div className="flex items-start justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            User Information
          </h3>
          <div className="flex gap-2">
            <StatusBadge status={getRoleBadgeStatus(user.role)} label={user.role} />
            <StatusBadge status={user.is_active ? "success" : "error"} 
              label={user.is_active ? "Active" : "Inactive"} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Display Name
            </label>
            <p className="text-base text-gray-900 dark:text-white">
              {user.display_name || "Not set"}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Email
            </label>
            <p className="text-base text-gray-900 dark:text-white">
              {user.email || "Not set"}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Auth Provider
            </label>
            <p className="text-base text-gray-900 dark:text-white capitalize">
              {user.provider || "device"}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Current Level
            </label>
            <p className="text-base text-gray-900 dark:text-white">
              Level {user.current_level ?? 1}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Current Streak
            </label>
            <p className="text-base text-gray-900 dark:text-white">
              {user.current_streak ?? 0} days
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Longest Streak
            </label>
            <p className="text-base text-gray-900 dark:text-white">
              {user.longest_streak ?? 0} days
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Total XP
            </label>
            <p className="text-base text-gray-900 dark:text-white">
              {(user.total_xp ?? 0).toLocaleString()}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Created At
            </label>
            <p className="text-base text-gray-900 dark:text-white">
              {user.created_at ? new Date(user.created_at).toLocaleDateString() : "Unknown"}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Last Login
            </label>
            <p className="text-base text-gray-900 dark:text-white">
              {user.last_login_at ? new Date(user.last_login_at).toLocaleString() : "Never"}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Last Active
            </label>
            <p className="text-base text-gray-900 dark:text-white">
              {user.last_activity_date ? new Date(user.last_activity_date).toLocaleDateString() : "Never"}
            </p>
          </div>
        </div>
      </div>

      {/* Learning Progress Card */}
      <div className="p-6 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
        <h3 className="mb-6 text-lg font-semibold text-gray-900 dark:text-white">
          Learning Progress
        </h3>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="p-4 text-center border border-gray-200 rounded-lg dark:border-gray-800">
            <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">
              {(user.total_sessions ?? 0).toLocaleString()}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Total Sessions
            </p>
          </div>

          <div className="p-4 text-center border border-gray-200 rounded-lg dark:border-gray-800">
            <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">
              {user.languages_learning ?? 0}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Languages Learning
            </p>
          </div>

          <div className="p-4 text-center border border-gray-200 rounded-lg dark:border-gray-800">
            <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">
              Level {user.current_level ?? 1}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Current Level
            </p>
          </div>

          <div className="p-4 text-center border border-gray-200 rounded-lg dark:border-gray-800">
            <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">
              {user.is_premium ? "Premium" : "Free"}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Account Type
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

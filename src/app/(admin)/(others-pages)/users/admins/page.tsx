"use client";

import React, { useMemo, useState } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Alert from "@/components/ui/alert/SimpleAlert";
import { StyledSelect } from "@/components/ui/form/StyledSelect";
import { apiClient } from "@/lib/api";
import { useAdminUsers } from "@/hooks/useApi";
import { useRequireAuth } from "@/context/AuthContext";

type AdminRole = "admin" | "manager";

export default function AdminUsersPage() {
  const { isLoading: isAuthLoading } = useRequireAuth("users:read");
  const { admins, isLoading, isError, refresh } = useAdminUsers();

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [form, setForm] = useState({
    email: "",
    display_name: "",
    role: "manager" as AdminRole,
    password: "",
    confirm_password: "",
  });

  const sortedAdmins = useMemo(() => {
    return [...(admins || [])].sort((a: any, b: any) => {
      const at = new Date(a.created_at || 0).getTime();
      const bt = new Date(b.created_at || 0).getTime();
      return bt - at;
    });
  }, [admins]);

  const resetForm = () => {
    setForm({
      email: "",
      display_name: "",
      role: "manager",
      password: "",
      confirm_password: "",
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage("");
    setErrorMessage("");

    if (!form.email.trim()) {
      setErrorMessage("Email is required");
      return;
    }

    if (form.password.length < 12) {
      setErrorMessage("Password must be at least 12 characters long");
      return;
    }

    if (form.password !== form.confirm_password) {
      setErrorMessage("Passwords do not match");
      return;
    }

    setIsCreating(true);
    try {
      await apiClient.post("/api/v1/admin/admins", {
        email: form.email.trim(),
        display_name: form.display_name.trim() || form.email.trim().split("@")[0],
        role: form.role,
        password: form.password,
      });

      setSuccessMessage("Admin user created/updated successfully");
      resetForm();
      refresh();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || "Failed to create admin user");
      setTimeout(() => setErrorMessage(""), 5000);
    } finally {
      setIsCreating(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="Admin Users" />
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="Admin Users" />
        <Alert variant="error">Failed to load admin users.</Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <PageBreadCrumb pageTitle="Admin Users" />
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Create and manage admin dashboard accounts
        </p>
      </div>

      {successMessage && <Alert variant="success">{successMessage}</Alert>}
      {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

      <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create Admin User</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Use role <span className="font-medium">Manager</span> for content managers.
          </p>
        </div>

        <form onSubmit={handleCreate} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email *
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <StyledSelect
              label="Role *"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as AdminRole })}
              options={[
                { value: "manager", label: "Manager (Content Manager)" },
                { value: "admin", label: "Admin" },
              ]}
            />

            <div />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password *
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={12}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Minimum 12 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Confirm Password *
              </label>
              <input
                type="password"
                value={form.confirm_password}
                onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                required
                minLength={12}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isCreating}
              className="px-4 py-2 text-sm font-medium text-white dark:text-gray-900 bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-brand-500 dark:hover:bg-brand-600"
            >
              {isCreating ? "Creating..." : "Create Admin User"}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Existing Admin Users</h3>
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Last Login
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {sortedAdmins.length > 0 ? (
                  sortedAdmins.map((a: any) => (
                    <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {a.display_name || "(no name)"}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{a.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700 dark:text-gray-300">{a.role}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          {a.is_active ? "Active" : "Inactive"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {a.last_login_at ? new Date(a.last_login_at).toLocaleString() : "Never"}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                      No admin users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

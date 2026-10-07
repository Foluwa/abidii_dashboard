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
        <p className="mt-1 text-sm text-muted-foreground">
          Create and manage admin dashboard accounts
        </p>
      </div>

      {successMessage && <Alert variant="success">{successMessage}</Alert>}
      {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

      <div className="bg-card border border-border rounded-lg">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">Create Admin User</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Use role <span className="font-medium">Manager</span> for content managers.
          </p>
        </div>

        <form onSubmit={handleCreate} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Email *
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="w-full px-3 py-2 text-sm border border-input rounded-lg dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg dark:bg-gray-800 dark:text-white"
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
              <label className="block text-sm font-medium text-foreground mb-1">
                Password *
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={12}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg dark:bg-gray-800 dark:text-white"
              />
              <p className="mt-1 text-xs text-muted-foreground">Minimum 12 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Confirm Password *
              </label>
              <input
                type="password"
                value={form.confirm_password}
                onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                required
                minLength={12}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isCreating}
              className="px-4 py-2 text-sm font-medium text-primary-foreground bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-brand-500 dark:hover:bg-brand-600"
            >
              {isCreating ? "Creating..." : "Create Admin User"}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">Existing Admin Users</h3>
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="px-3 py-2.5 text-left text-sm font-medium text-muted-foreground">
                    User
                  </th>
                  <th className="px-3 py-2.5 text-left text-sm font-medium text-muted-foreground">
                    Role
                  </th>
                  <th className="px-3 py-2.5 text-left text-sm font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="px-3 py-2.5 text-left text-sm font-medium text-muted-foreground">
                    Last Login
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedAdmins.length > 0 ? (
                  sortedAdmins.map((a: any) => (
                    <tr key={a.id} className="hover:bg-muted/50">
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="text-sm font-medium text-foreground">
                          {a.display_name || "(no name)"}
                        </div>
                        <div className="text-xs text-muted-foreground">{a.email}</div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="text-sm text-foreground">{a.role}</div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="text-sm text-foreground">
                          {a.is_active ? "Active" : "Inactive"}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="text-sm text-muted-foreground">
                          {a.last_login_at ? new Date(a.last_login_at).toLocaleString() : "Never"}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
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

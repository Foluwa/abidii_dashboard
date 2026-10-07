"use client";

import React, { useState } from "react";
import { apiClient } from "@/lib/api";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Alert from "@/components/ui/alert/SimpleAlert";

export default function ChangePasswordPage() {
  const [formData, setFormData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    // Validate password length
    if (formData.new_password.length < 12) {
      setErrorMessage("New password must be at least 12 characters long");
      return;
    }

    // Validate passwords match
    if (formData.new_password !== formData.confirm_password) {
      setErrorMessage("New passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.post("/api/v1/auth/admin/change-password", {
        current_password: formData.current_password,
        new_password: formData.new_password,
      });
      setSuccessMessage("Password changed successfully");
      setFormData({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || "Failed to change password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <PageBreadCrumb pageTitle="Change Password" />
        <p className="mt-1 text-sm text-muted-foreground">
          Update your admin account password
        </p>
      </div>

      {/* Messages */}
      {successMessage && <Alert variant="success">{successMessage}</Alert>}
      {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

      {/* Change Password Form */}
      <div className="max-w-2xl p-6 bg-card border border-border rounded-lg">
        <h3 className="mb-6 text-lg font-semibold text-foreground">
          Change Your Password
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Current Password *
            </label>
            <input
              type="password"
              value={formData.current_password}
              onChange={(e) =>
                setFormData({ ...formData, current_password: e.target.value })
              }
              required
              className="w-full px-3 py-2 text-sm border border-input rounded-lg dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              New Password *
            </label>
            <input
              type="password"
              value={formData.new_password}
              onChange={(e) =>
                setFormData({ ...formData, new_password: e.target.value })
              }
              required
              minLength={12}
              className="w-full px-3 py-2 text-sm border border-input rounded-lg dark:bg-gray-800 dark:text-white"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Must be at least 12 characters long
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Confirm New Password *
            </label>
            <input
              type="password"
              value={formData.confirm_password}
              onChange={(e) =>
                setFormData({ ...formData, confirm_password: e.target.value })
              }
              required
              minLength={12}
              className="w-full px-3 py-2 text-sm border border-input rounded-lg dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-2 text-sm font-medium text-primary-foreground bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-brand-500 dark:hover:bg-brand-600"
            >
              {isLoading ? "Changing Password..." : "Change Password"}
            </button>
          </div>
        </form>
      </div>

      {/* Security Tips */}
      <div className="max-w-2xl p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-900/20 dark:border-blue-800">
        <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
          Password Security Tips
        </h4>
        <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
          <li>Use at least 12 characters</li>
          <li>Mix uppercase and lowercase letters</li>
          <li>Include numbers and special characters</li>
          <li>Avoid common words or personal information</li>
          <li>Do not reuse passwords from other accounts</li>
        </ul>
      </div>
    </div>
  );
}

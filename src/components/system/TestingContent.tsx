"use client";

import React, { useState } from "react";
import { apiClient } from "@/lib/api";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Alert from "@/components/ui/alert/SimpleAlert";
import { TriangleAlert } from "lucide-react";
import { ConfirmationModal } from "@/components/ui/modal/ConfirmationModal";

export function TestingContent({ showHeader = true }: { showHeader?: boolean }) {
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramResult, setTelegramResult] = useState("");
  const [criticalLoading, setCriticalLoading] = useState(false);
  const [criticalResult, setCriticalResult] = useState("");
  const [resourceLoading, setResourceLoading] = useState(false);
  const [resourceResult, setResourceResult] = useState("");
  const [showCriticalConfirm, setShowCriticalConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const testTelegram = async () => {
    setTelegramLoading(true);
    setTelegramResult("");
    setErrorMessage("");
    try {
      const response = await apiClient.post("/api/v1/admin/test-telegram");
      setTelegramResult(JSON.stringify(response.data, null, 2));
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || "Failed to send test Telegram message");
    } finally {
      setTelegramLoading(false);
    }
  };

  const testCriticalAlert = async () => {
    setCriticalLoading(true);
    setCriticalResult("");
    setErrorMessage("");
    try {
      const response = await apiClient.post("/api/v1/admin/test-critical-alert");
      setCriticalResult(JSON.stringify(response.data, null, 2));
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || "Failed to send critical alert");
    } finally {
      setCriticalLoading(false);
      setShowCriticalConfirm(false);
    }
  };

  const forceResourceCheck = async () => {
    setResourceLoading(true);
    setResourceResult("");
    setErrorMessage("");
    try {
      const response = await apiClient.post("/api/v1/admin/force-resource-check");
      setResourceResult(JSON.stringify(response.data, null, 2));
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || "Failed to force resource check");
    } finally {
      setResourceLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        {showHeader && (
          <>
            <PageBreadCrumb pageTitle="System Testing" />
            <p className="mt-1 text-sm text-muted-foreground">
              Test system functionality and alerting mechanisms
            </p>
          </>
        )}
      </div>

      {/* Error Message */}
      {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

      {/* Telegram Test */}
      <div className="p-6 bg-card border border-border rounded-lg">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Test Telegram Bot
            </h3>
            <p className="text-sm text-muted-foreground">
              Send a test message through the Telegram bot to verify connectivity.
            </p>
          </div>
          <button
            onClick={testTelegram}
            disabled={telegramLoading}
            className="px-4 py-2 text-sm font-medium text-primary-foreground bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {telegramLoading ? "Sending..." : "Send Test Message"}
          </button>
        </div>
        {telegramResult && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-foreground mb-2">
              Result:
            </h4>
            <pre className="p-4 text-xs text-foreground bg-muted/50 border border-border rounded-lg overflow-x-auto">
              {telegramResult}
            </pre>
          </div>
        )}
      </div>

      {/* Critical Alert Test */}
      <div className="p-6 bg-card border border-border rounded-lg">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Test Critical Alert
            </h3>
            <p className="text-sm text-muted-foreground">
              Trigger a critical alert to test the emergency notification system.
            </p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">
              <TriangleAlert className="mr-1.5 inline size-4 align-text-bottom" />
              Warning: This will send an urgent notification to all administrators.
            </p>
          </div>
          <button
            onClick={() => setShowCriticalConfirm(true)}
            disabled={criticalLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {criticalLoading ? "Sending..." : "Send Critical Alert"}
          </button>
        </div>
        {criticalResult && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-foreground mb-2">
              Result:
            </h4>
            <pre className="p-4 text-xs text-foreground bg-muted/50 border border-border rounded-lg overflow-x-auto">
              {criticalResult}
            </pre>
          </div>
        )}
      </div>

      {/* Resource Check Test */}
      <div className="p-6 bg-card border border-border rounded-lg">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Force Resource Check
            </h3>
            <p className="text-sm text-muted-foreground">
              Manually trigger a system resource check to verify all dependencies.
            </p>
          </div>
          <button
            onClick={forceResourceCheck}
            disabled={resourceLoading}
            className="px-4 py-2 text-sm font-medium text-primary-foreground bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resourceLoading ? "Checking..." : "Run Resource Check"}
          </button>
        </div>
        {resourceResult && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-foreground mb-2">
              Result:
            </h4>
            <pre className="p-4 text-xs text-foreground bg-muted/50 border border-border rounded-lg overflow-x-auto">
              {resourceResult}
            </pre>
          </div>
        )}
      </div>

      {/* Critical Alert Confirmation Modal */}
      <ConfirmationModal
        isOpen={showCriticalConfirm}
        onClose={() => setShowCriticalConfirm(false)}
        onConfirm={testCriticalAlert}
        title="Confirm Critical Alert Test"
        message="Are you sure you want to send a critical alert? This will notify all administrators immediately."
        confirmText="Yes, Send Alert"
        cancelText="Cancel"
        variant="danger"
        isLoading={criticalLoading}
      />
    </div>
  );
}

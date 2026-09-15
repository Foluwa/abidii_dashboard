"use client";

import React, { useEffect, useState } from "react";
import { useAppSettings } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/api";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Alert from "@/components/ui/alert/SimpleAlert";
import { useToast } from "@/contexts/ToastContext";

const SETTING_KEY = "app.min_supported_version";

type Platform = "ios" | "android";

type PlatformDraft = {
  versionNumber: string;
  minBuildNumber: string;
  message: string;
};

const emptyDraft: PlatformDraft = { versionNumber: "", minBuildNumber: "", message: "" };

type PlatformSaved = {
  version_number?: string;
  min_build_number?: number;
  message?: string;
};

function draftFromSaved(saved?: PlatformSaved): PlatformDraft {
  if (!saved) return { ...emptyDraft };
  return {
    versionNumber: saved.version_number ?? "",
    minBuildNumber: saved.min_build_number != null ? String(saved.min_build_number) : "",
    message: saved.message ?? "",
  };
}

const PLATFORM_LABELS: Record<Platform, string> = { ios: "iOS", android: "Android" };

export default function ForceUpdateConfigPage() {
  const toast = useToast();
  const { user, isAdmin } = useAuth();
  const { settings, isLoading, isError, refresh } = useAppSettings();
  const [drafts, setDrafts] = useState<Record<Platform, PlatformDraft>>({
    ios: { ...emptyDraft },
    android: { ...emptyDraft },
  });
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const existingRow = settings.find((s) => s.setting_key === SETTING_KEY);
  const savedValue = (existingRow?.setting_value ?? {}) as {
    ios?: PlatformSaved;
    android?: PlatformSaved;
  };

  // Hydrate the editable drafts whenever the server value changes - including
  // right after our own save (refresh() below), so the form always reflects
  // what actually landed rather than what was merely submitted.
  useEffect(() => {
    if (!existingRow) return;
    setDrafts({
      ios: draftFromSaved(savedValue.ios),
      android: draftFromSaved(savedValue.android),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingRow?.setting_value]);

  const updateDraft = (platform: Platform, field: keyof PlatformDraft, value: string) => {
    setDrafts((prev) => ({ ...prev, [platform]: { ...prev[platform], [field]: value } }));
  };

  const handleSave = async () => {
    setErrorMessage("");

    // A blank build-number field means "no requirement for this platform" -
    // that platform's key is omitted entirely rather than sent as 0/NaN, so
    // the mobile app's fallback logic sees it as genuinely not configured
    // instead of forcing every user on that platform to update.
    const buildPlatformValue = (draft: PlatformDraft): PlatformSaved | undefined => {
      const trimmedBuild = draft.minBuildNumber.trim();
      if (!trimmedBuild) return undefined;
      const parsedBuild = Number(trimmedBuild);
      if (!Number.isFinite(parsedBuild) || parsedBuild <= 0) {
        throw new Error(`${draft.minBuildNumber} is not a valid build number`);
      }
      return {
        min_build_number: parsedBuild,
        ...(draft.versionNumber.trim() ? { version_number: draft.versionNumber.trim() } : {}),
        ...(draft.message.trim() ? { message: draft.message.trim() } : {}),
      };
    };

    let iosValue: PlatformSaved | undefined;
    let androidValue: PlatformSaved | undefined;
    try {
      iosValue = buildPlatformValue(drafts.ios);
      androidValue = buildPlatformValue(drafts.android);
    } catch (e: any) {
      setErrorMessage(e.message);
      return;
    }

    // Building the full setting_value here (not a server-side patch) is what
    // keeps this non-destructive: both platforms' current values live in
    // this component's state together, so saving after editing only the iOS
    // card still sends Android's untouched value right along with it -
    // nothing gets silently dropped.
    const setting_value: Record<string, PlatformSaved> = {};
    if (iosValue) setting_value.ios = iosValue;
    if (androidValue) setting_value.android = androidValue;

    setIsSaving(true);
    try {
      await apiClient.put(`/api/v1/admin/configs/app-settings/${SETTING_KEY}`, {
        setting_value,
        category: "mobile",
        is_public: true,
        description:
          "Minimum supported app build number per platform. Users on a build below this are shown a non-dismissible update prompt. Managed from the dashboard's Force Update page.",
      });
      toast.success("Force-update requirement saved");
      refresh();
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || "Failed to save force-update setting");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="Force Update" />
        <div className="p-6 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 animate-pulse">
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded dark:bg-gray-700"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    const errorStatus = isError?.response?.status;
    const message =
      errorStatus === 401
        ? "Your session has expired. Please log in again."
        : errorStatus === 403
        ? `You don't have permission to view this page. Your role: ${user?.role || "unknown"}. Admin role required.`
        : "Failed to load force-update settings. Please check your API connection.";
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="Force Update" />
        <Alert variant="error">{message}</Alert>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="Force Update" />
        <Alert variant="warning">
          This page requires admin privileges. Your current role: {user?.role || "unknown"}
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <PageBreadCrumb pageTitle="Force Update" />
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Require users below a given build number to update before continuing to use the app.
          Set independently per platform - App Store review and Play Store rollouts don&apos;t
          always land at the same time, so one platform can be required to update without
          incorrectly blocking users on the other.
        </p>
      </div>

      {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {(["ios", "android"] as Platform[]).map((platform) => {
          const saved = savedValue[platform];
          const isEnforcing = saved?.min_build_number != null;
          return (
            <div
              key={platform}
              className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 overflow-hidden"
            >
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {PLATFORM_LABELS[platform]}
                  </h3>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      isEnforcing
                        ? "text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900"
                        : "text-gray-600 bg-gray-100 dark:text-gray-300 dark:bg-gray-800"
                    }`}
                  >
                    {isEnforcing ? `Enforcing build ≥ ${saved!.min_build_number}` : "Not set"}
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Version number
                    </label>
                    <input
                      type="text"
                      value={drafts[platform].versionNumber}
                      onChange={(e) => updateDraft(platform, "versionNumber", e.target.value)}
                      placeholder="e.g. 1.4.0"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Human-readable, for reference only - the build number below is what
                      actually gates the app.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Minimum build number
                    </label>
                    <input
                      type="number"
                      value={drafts[platform].minBuildNumber}
                      onChange={(e) => updateDraft(platform, "minBuildNumber", e.target.value)}
                      placeholder="e.g. 1788710700"
                      className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Leave blank to not require an update on {PLATFORM_LABELS[platform]}.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Message (optional)
                    </label>
                    <textarea
                      value={drafts[platform].message}
                      onChange={(e) => updateDraft(platform, "message", e.target.value)}
                      rows={2}
                      placeholder="Shown instead of the default update-prompt copy"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
        {existingRow && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Last updated: {new Date(existingRow.updated_at).toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}

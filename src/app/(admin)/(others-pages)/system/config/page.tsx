"use client";

import React, { useState } from "react";
import { useConfig } from "@/hooks/useApi";
import { apiClient } from "@/lib/api";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Alert from "@/components/ui/alert/SimpleAlert";
import StatusBadge from "@/components/admin/StatusBadge";
import { StyledSelect } from "@/components/ui/form/StyledSelect";
import { useToast } from "@/contexts/ToastContext";

interface ConfigItem {
  key: string;
  value_type: string;
  value_int?: number | null;
  value_bool?: boolean | null;
  value_text?: string | null;
  value_float?: number | null;
  description?: string;
  category?: string;
  is_active: boolean;
  updated_at?: string;
}

export default function ConfigPage() {
  const toast = useToast();
  const { config, isLoading, isError, refresh } = useConfig();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<any>("");
  const [editDescription, setEditDescription] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const getActualValue = (item: ConfigItem) => {
    switch (item.value_type) {
      case "int":
        return item.value_int ?? null;
      case "boolean":
        return item.value_bool ?? null;
      case "string":
        return item.value_text ?? null;
      case "float":
        return item.value_float ?? null;
      default:
        return item.value_text ?? null;
    }
  };

  const startEdit = (item: ConfigItem) => {
    setEditingKey(item.key);
    const actualValue = getActualValue(item);
    setEditValue(actualValue ?? (item.value_type === "boolean" ? false : ""));
    setEditDescription(item.description || "");
    setErrorMessage("");
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue("");
    setEditDescription("");
  };

  const saveEdit = async (key: string, valueType: string) => {
    if (!key) {
      setErrorMessage("Invalid configuration key");
      return;
    }
    setIsSaving(true);
    setErrorMessage("");
    try {
      const payload: any = { description: editDescription };
      
      switch (valueType) {
        case "int":
          payload.value_int = editValue === "" || editValue == null ? null : parseInt(editValue);
          break;
        case "boolean":
          payload.value_bool = editValue === true || editValue === "true";
          break;
        case "string":
          payload.value_text = editValue ?? "";
          break;
        case "float":
          payload.value_float = editValue === "" || editValue == null ? null : parseFloat(editValue);
          break;
      }

      await apiClient.put(`/api/v1/admin/configs/${key}`, payload);
      toast.success(`Configuration "${key}" updated successfully`);
      setEditingKey(null);
      refresh();
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || "Failed to update configuration");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (key: string, currentStatus: boolean) => {
    try {
      await apiClient.patch(`/api/v1/admin/configs/${key}/toggle`, {
        is_active: !currentStatus
      });
      toast.success(`Configuration "${key}" ${!currentStatus ? "enabled" : "disabled"}`);
      refresh();
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || "Failed to toggle configuration");
    }
  };

  const deleteConfig = async (key: string) => {
    if (!confirm(`Are you sure you want to delete "${key}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await apiClient.delete(`/api/v1/admin/configs/${key}`);
      toast.success(`Configuration "${key}" deleted`);
      refresh();
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || "Failed to delete configuration");
    }
  };

  const categories = config ? Array.from(new Set(config.map((c: any) => c.category).filter(Boolean))) : [];
  const filteredConfig = config?.filter((item: any) => 
    filterCategory === "all" || item.category === filterCategory
  ) || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="Feature Flags & Configuration" />
        <div className="p-6 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 animate-pulse">
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i: any) => (
              <div key={i} className="h-12 bg-gray-200 rounded dark:bg-gray-700"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="Feature Flags & Configuration" />
        <Alert variant="error">
          Failed to load configuration. Please check your API connection.
        </Alert>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <PageBreadCrumb pageTitle="Feature Flags & Configuration" />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Manage feature flags, limits, and dynamic configuration
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700"
          >
            + Create Config
          </button>
        </div>

        {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

        {categories.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter:</span>
            <button
              onClick={() => setFilterCategory("all")}
              className={`px-3 py-1 text-sm rounded-full ${
                filterCategory === "all" ? "bg-brand-600 text-white" : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
              }`}
            >
              All ({config?.length || 0})
            </button>
            {categories.map((cat: string) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1 text-sm rounded-full ${
                  filterCategory === cat ? "bg-brand-600 text-white" : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                }`}
              >
                {cat} ({config?.filter((c: any) => c.category === cat).length || 0})
              </button>
            ))}
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Key</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Value</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Category</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredConfig && filteredConfig.length > 0 ? (
                  filteredConfig.map((item: any, index: number) => (
                    <tr key={`${item.key}-${index}`} className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${!item.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <button
                          onClick={() => toggleActive(item.key, item.is_active)}
                          className={`w-10 h-6 rounded-full transition-colors ${item.is_active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                          title={item.is_active ? "Active (click to disable)" : "Inactive (click to enable)"}
                        >
                          <div className={`w-4 h-4 bg-white rounded-full transition-transform ${item.is_active ? 'translate-x-5' : 'translate-x-1'}`} />
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <code className="text-xs font-mono text-gray-900 dark:text-white break-all">{item.key}</code>
                      </td>
                      <td className="px-4 py-4">
                        {editingKey === item.key ? (
                          <div className="space-y-2">
                            {item.value_type === "boolean" ? (
                              <StyledSelect
                                value={String(editValue ?? false)}
                                onChange={(e) => setEditValue(e.target.value === "true")}
                                options={[
                                  { value: "true", label: "true" },
                                  { value: "false", label: "false" },
                                ]}
                                fullWidth
                              />
                            ) : (
                              <input
                                type={item.value_type === "int" || item.value_type === "float" ? "number" : "text"}
                                step={item.value_type === "float" ? "0.1" : "1"}
                                value={editValue ?? ""}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-full px-3 py-1 text-sm border border-gray-300 rounded dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                              />
                            )}
                          </div>
                        ) : (
                          (() => {
                            const actualValue = getActualValue(item);
                            if (actualValue == null) {
                              return (
                                <span className="text-sm font-semibold text-gray-400 dark:text-gray-500">—</span>
                              );
                            }

                            return (
                              <span className={`text-sm font-semibold ${
                                item.value_type === "boolean" 
                                  ? actualValue ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                  : "text-gray-900 dark:text-white"
                              }`}>
                                {String(actualValue)}
                              </span>
                            );
                          })()
                        )}
                      </td>
                      <td className="px-4 py-4 max-w-xs">
                        {editingKey === item.key ? (
                          <input
                            type="text"
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            className="w-full px-3 py-1 text-sm border border-gray-300 rounded dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                            placeholder="Description..."
                          />
                        ) : (
                          <span className="text-xs text-gray-500 dark:text-gray-400">{item.description || "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <StatusBadge status="info" label={item.value_type} />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded">
                          {item.category || "general"}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        {editingKey === item.key ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => saveEdit(item.key, item.value_type)}
                              disabled={isSaving}
                              className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
                            >
                              {isSaving ? "..." : "Save"}
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={isSaving}
                              className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-200 rounded hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => startEdit(item)}
                              className="px-3 py-1 text-xs font-medium text-brand-600 hover:text-brand-800 dark:text-brand-400"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteConfig(item.key)}
                              className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-800 dark:text-red-400"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                      {filterCategory !== "all" ? `No configurations found in "${filterCategory}" category` : "No configuration items found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-900/20 dark:border-blue-800">
          <div className="space-y-2">
            <p className="text-sm text-blue-800 dark:text-blue-300"><strong>💡 Tips:</strong></p>
            <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1 ml-4 list-disc">
              <li>Changes take effect immediately and invalidate caches automatically</li>
              <li>Toggle the switch to enable/disable configs without deleting them</li>
              <li><strong>vocabulary.free_daily_limit</strong> - Free user flashcard limit per day</li>
              <li><strong>vocabulary.premium_daily_limit</strong> - Premium user flashcard limit per day</li>
              <li>Use categories to organize related configs (e.g., &quot;vocabulary&quot;, &quot;offline&quot;, &quot;tts&quot;)</li>
            </ul>
          </div>
        </div>
      </div>

      {showCreateModal && <CreateConfigModal onClose={() => setShowCreateModal(false)} onSuccess={refresh} />}
    </>
  );
}

function CreateConfigModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    key: "",
    value_type: "int",
    value: "",
    description: "",
    category: "",
    is_active: true
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const payload: any = {
        key: formData.key,
        value_type: formData.value_type,
        description: formData.description,
        category: formData.category,
        is_active: formData.is_active
      };

      switch (formData.value_type) {
        case "int":
          payload.value_int = parseInt(formData.value);
          break;
        case "float":
          payload.value_float = parseFloat(formData.value);
          break;
        case "boolean":
          payload.value_bool = formData.value === "true";
          break;
        case "string":
          payload.value_text = formData.value;
          break;
      }

      await apiClient.post("/api/v1/admin/configs", payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create configuration");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Create New Configuration</h3>
        
        {error && <Alert variant="error" className="mb-4">{error}</Alert>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Key *</label>
            <input
              type="text"
              required
              pattern="[a-z0-9_.]+"
              value={formData.key}
              onChange={(e) => setFormData({...formData, key: e.target.value})}
              placeholder="e.g., vocabulary.free_daily_limit"
              className="w-full px-3 py-2 border border-gray-300 rounded dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
            <p className="text-xs text-gray-500 mt-1">Use lowercase, numbers, dots, underscores only</p>
          </div>

          <div>
            <StyledSelect
              label="Type *"
              value={formData.value_type}
              onChange={(e) => setFormData({...formData, value_type: e.target.value})}
              options={[
                { value: "int", label: "Integer" },
                { value: "float", label: "Float" },
                { value: "boolean", label: "Boolean" },
                { value: "string", label: "String" },
              ]}
              fullWidth
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Value *</label>
            {formData.value_type === "boolean" ? (
              <StyledSelect
                value={formData.value}
                onChange={(e) => setFormData({...formData, value: e.target.value})}
                options={[
                  { value: "", label: "Select..." },
                  { value: "true", label: "true" },
                  { value: "false", label: "false" },
                ]}
                fullWidth
              />
            ) : (
              <input
                type={formData.value_type === "int" || formData.value_type === "float" ? "number" : "text"}
                step={formData.value_type === "float" ? "0.1" : "1"}
                required
                value={formData.value}
                onChange={(e) => setFormData({...formData, value: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
              placeholder="e.g., vocabulary, offline, tts"
              className="w-full px-3 py-2 border border-gray-300 rounded dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
              className="rounded"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700 dark:text-gray-300">Active</label>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded hover:bg-brand-700 disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

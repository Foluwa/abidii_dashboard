"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Alert from "@/components/ui/alert/SimpleAlert";
import { useToast } from "@/contexts/ToastContext";
import { FiPlus, FiTrash2, FiArrowUp, FiArrowDown } from "react-icons/fi";

interface QuickPracticeItem {
  id?: string;
  item_id: string;
  title: string;
  subtitle: string;
  icon: string;
  sort_order: number;
  enabled: boolean;
}

export default function QuickPracticePage() {
  const toast = useToast();
  const [items, setItems] = useState<QuickPracticeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<QuickPracticeItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get("/api/v1/admin/quick-practice");
      setItems(res.data.items || []);
    } catch (e: any) {
      setError(e.response?.data?.detail || "Failed to load items");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  const handleSave = async () => {
    if (!editing || !editing.item_id.trim() || !editing.title.trim()) return;
    setIsSaving(true);
    try {
      await apiClient.put(`/api/v1/admin/quick-practice/${editing.item_id}`, editing);
      toast.success("Saved");
      setEditing(null);
      setShowForm(false);
      fetchItems();
    } catch (e: any) {
      toast.error(e.response?.data?.detail || "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (item: QuickPracticeItem) => {
    try {
      await apiClient.put(`/api/v1/admin/quick-practice/${item.item_id}`, { ...item, enabled: !item.enabled });
      fetchItems();
    } catch (e: any) {
      toast.error("Failed to toggle");
    }
  };

  const handleReorder = async (item_id: string, direction: number) => {
    try {
      await apiClient.post(`/api/v1/admin/quick-practice/reorder`, { item_id, direction });
      fetchItems();
    } catch (e: any) {
      toast.error("Failed to reorder");
    }
  };

  const handleNew = () => {
    setEditing({
      item_id: "",
      title: "",
      subtitle: "",
      icon: "style",
      sort_order: items.length,
      enabled: true,
    });
    setShowForm(true);
  };

  if (isLoading) return <div className="p-6"><PageBreadCrumb pageTitle="Quick Practice" /><p className="text-gray-500 dark:text-gray-400 mt-4">Loading...</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <PageBreadCrumb pageTitle="Quick Practice" />
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage Quick Practice carousel items on the home screen</p>
        </div>
        <button onClick={handleNew} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700">
          <FiPlus className="w-4 h-4" /> Add Item
        </button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 dark:border-white/[0.05] bg-gray-50 dark:bg-white/[0.02]">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Order</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">ID</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Title</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Icon</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Subtitle</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Enabled</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/[0.03]">
            {items.map((item, index) => (
              <tr key={item.item_id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleReorder(item.item_id, -1)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                      <FiArrowUp className="w-3 h-3" />
                    </button>
                    <button onClick={() => handleReorder(item.item_id, 1)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                      <FiArrowDown className="w-3 h-3" />
                    </button>
                    <span className="ml-2 text-gray-500 text-xs">{item.sort_order}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{item.item_id}</td>
                <td className="px-4 py-3 font-medium">{item.title}</td>
                <td className="px-4 py-3 font-mono text-xs">{item.icon}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{item.subtitle || "-"}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => handleToggle(item)}
                    className={`px-2 py-1 text-xs font-medium rounded-full ${item.enabled ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                    {item.enabled ? "Yes" : "No"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => { setEditing({ ...item }); setShowForm(true); }}
                    className="text-blue-600 dark:text-blue-400 hover:underline text-xs mr-3">Edit</button>
                  <button onClick={async () => { await apiClient.delete(`/api/v1/admin/quick-practice/${item.item_id}`); fetchItems(); }}
                    className="text-red-600 dark:text-red-400 hover:underline text-xs">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {showForm && editing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full m-4">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold">{editing.item_id ? "Edit Item" : "Add Item"}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Item ID *</label>
                <input value={editing.item_id} onChange={e => setEditing({ ...editing, item_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="e.g. flashcards" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="e.g. Flashcards" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Icon</label>
                <input value={editing.icon} onChange={e => setEditing({ ...editing, icon: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="e.g. style, book, timer" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subtitle</label>
                <input value={editing.subtitle} onChange={e => setEditing({ ...editing, subtitle: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Optional subtitle" />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
              <button onClick={() => { setShowForm(false); setEditing(null); }}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={handleSave} disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50">
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

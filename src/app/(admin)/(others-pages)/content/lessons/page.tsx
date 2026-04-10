"use client";

import React, { useState } from "react";
import { useLessons, useLanguages } from "@/hooks/useApi";
import { apiClient } from "@/lib/api";
import type { Lesson, Language, LessonStatus } from "@/types/api";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Toast from "@/components/ui/toast/Toast";
import { StyledSelect } from "@/components/ui/form/StyledSelect";
import StatusBadge from "@/components/admin/StatusBadge";
import { ConfirmationModal } from "@/components/ui/modal/ConfirmationModal";
import { Modal } from "@/components/ui/modal";
import Alert from "@/components/ui/alert/SimpleAlert";
import Pagination from "@/components/tables/Pagination";
import { FiGlobe, FiCheckCircle } from "react-icons/fi";

export default function LessonsPage() {
  const [selectedLanguage, setSelectedLanguage] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<LessonStatus | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [showModal, setShowModal] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);

  const { lessons, total, isLoading, isError, refresh } = useLessons({ 
    language_id: selectedLanguage, 
    status, 
    page, 
    limit 
  });
  const { languages, isLoading: isLanguagesLoading } = useLanguages();
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const getLanguageName = (languageId: unknown) => {
    const match = (languages || []).find((lang: any) => String(lang.id) === String(languageId));
    if (match?.name) return match.name;
    return isLanguagesLoading ? "..." : "Unknown";
  };

  const [formData, setFormData] = useState({
    language_id: 0,
    order: 1,
    title: "",
    description: "",
    image_url: "",
    status: "draft" as LessonStatus,
  });

  const openCreateModal = () => {
    setEditingLesson(null);
    setFormData({
      language_id: selectedLanguage || (languages?.[0]?.id ?? 0),
      order: 1,
      title: "",
      description: "",
      image_url: "",
      status: "draft",
    });
    setShowModal(true);
  };

  const openEditModal = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setFormData({
      language_id: lesson.language_id,
      order: lesson.order,
      title: lesson.title,
      description: lesson.description || "",
      image_url: lesson.image_url || "",
      status: lesson.status,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingLesson(null);
    setErrorMessage("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    
    try {
      if (editingLesson) {
        await apiClient.put(`/api/v1/admin/lessons/${editingLesson.id}`, formData);
        setSuccessMessage("Lesson updated successfully");
      } else {
        await apiClient.post("/api/v1/admin/lessons", formData);
        setSuccessMessage("Lesson created successfully");
      }
      closeModal();
      refresh();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || "Failed to save lesson");
    }
  };

  const handleDeleteClick = (lessonId: number, lessonTitle: string) => {
    setDeleteConfirm({ id: lessonId, name: lessonTitle });
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    
    try {
      await apiClient.delete(`/api/v1/admin/lessons/${deleteConfirm.id}`);
      setSuccessMessage("Lesson deleted successfully");
      refresh();
      setDeleteConfirm(null);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || "Failed to delete lesson");
      setTimeout(() => setErrorMessage(""), 5000);
    }
  };

  const getStatusBadgeStatus = (lessonStatus: LessonStatus) => {
    switch (lessonStatus) {
      case "published":
        return "success" as const;
      case "draft":
        return "warning" as const;
      case "archived":
        return "info" as const;
      default:
        return "info" as const;
    }
  };

  if (isError) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="Lessons" />
        <Alert variant="error">Failed to load lessons. Please check your API connection.</Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <PageBreadCrumb pageTitle="Lessons" />
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage learning lessons and course content
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
        >
          + Create Lesson
        </button>
      </div>

      {/* Messages */}
      {successMessage && <Toast type="success" message={successMessage} onClose={() => setSuccessMessage("")} />}
      {errorMessage && <Toast type="error" message={errorMessage} onClose={() => setErrorMessage("")} />}

      {/* Filters */}
      <div className="p-4 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
        <div className="flex flex-wrap gap-4">
          <div>
            <StyledSelect
              label="Language"
              value={(selectedLanguage || "").toString()}
              onChange={(e) => {
                setSelectedLanguage(e.target.value ? Number(e.target.value) : undefined);
                setPage(1);
              }}
              options={[
                { value: "", label: "All Languages" },
                ...(languages?.map((lang: any) => ({ value: lang.id.toString(), label: lang.name })) || []),
              ]}
              fullWidth
            />
          </div>

          <div>
            <StyledSelect
              label="Status"
              value={status || ""}
              onChange={(e) => {
                setStatus(e.target.value as LessonStatus || undefined);
                setPage(1);
              }}
              options={[
                { value: "", label: "All Status" },
                { value: "draft", label: "Draft" },
                { value: "published", label: "Published" },
                { value: "archived", label: "Archived" },
              ]}
              fullWidth
            />
          </div>

          <div>
            <StyledSelect
              label="Per Page"
              value={limit.toString()}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              options={[
                { value: "20", label: "20" },
                { value: "50", label: "50" },
                { value: "100", label: "100" },
              ]}
              fullWidth
            />
          </div>
        </div>
      </div>

      {/* Lessons - Table on Desktop, Grid on Mobile */}
      {isLoading ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 animate-pulse">
          <div className="space-y-4">
            {[1, 2, 3].map((i: any) => (
              <div key={i} className="h-20 bg-gray-200 rounded dark:bg-gray-700"></div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Table View - Hidden on Mobile */}
          <div className="hidden lg:block bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Order
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Lesson
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Language
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {lessons && lessons.length > 0 ? (
                    lessons.map((lesson: any) => (
                      <tr key={lesson.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                            {lesson.order}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            {lesson.image_url && (
                              <img
                                src={lesson.image_url}
                                alt={lesson.title}
                                className="w-12 h-12 object-cover rounded-lg"
                              />
                            )}
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {lesson.title}
                              </div>
                              {lesson.description && (
                                <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                                  {lesson.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <FiGlobe className="text-gray-400" size={14} />
                            <span className="text-sm text-gray-900 dark:text-white">
                              {getLanguageName(lesson.language_id)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <StatusBadge status={getStatusBadgeStatus(lesson.status)} label={lesson.status} />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => window.location.href = `/curriculum/lessons/${lesson.id}/builder`}
                              className="px-3 py-1 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
                            >
                              Build
                            </button>
                            <button
                              onClick={() => openEditModal(lesson)}
                              className="px-3 py-1 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteClick(lesson.id, lesson.title)}
                              className="px-3 py-1 text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                        No lessons found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Grid View - Hidden on Desktop */}
          <div className="grid grid-cols-1 gap-4 lg:hidden">
            {lessons && lessons.length > 0 ? (
              lessons.map((lesson: any) => (
                <div
                  key={lesson.id}
                  className="p-4 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800"
                >
                  {lesson.image_url && (
                    <img
                      src={lesson.image_url}
                      alt={lesson.title}
                      className="w-full h-40 object-cover rounded-lg mb-3"
                    />
                  )}
                  <div className="flex items-start justify-between mb-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                      Order: {lesson.order}
                    </span>
                    <StatusBadge status={getStatusBadgeStatus(lesson.status)} label={lesson.status} />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
                    {lesson.title}
                  </h3>
                  {lesson.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                      {lesson.description}
                    </p>
                  )}
                  <div className="flex items-center space-x-2 mb-3">
                    <FiGlobe className="text-gray-400" size={14} />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {getLanguageName(lesson.language_id)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => window.location.href = `/curriculum/lessons/${lesson.id}/builder`}
                      className="flex-1 px-3 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
                    >
                      Build
                    </button>
                    <button
                      onClick={() => openEditModal(lesson)}
                      className="flex-1 px-3 py-2 text-sm font-medium text-brand-600 border border-brand-600 rounded-lg hover:bg-brand-50 dark:text-brand-400 dark:border-brand-400 dark:hover:bg-brand-900/20"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteClick(lesson.id, lesson.title)}
                      className="px-3 py-2 text-sm font-medium text-red-600 border border-red-600 rounded-lg hover:bg-red-50 dark:text-red-400 dark:border-red-400 dark:hover:bg-red-900/20"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
                No lessons found
              </div>
            )}
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} lessons
              </p>
              <div className="ml-auto">
                <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
              </div>
            </div>
          )}
        </>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingLesson ? "Edit Lesson" : "Create New Lesson"}
        maxWidth="2xl"
      >
        {errorMessage && (
          <Alert variant="error" className="mb-4">{errorMessage}</Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <StyledSelect
              label="Language *"
              value={formData.language_id.toString()}
              onChange={(e) => setFormData({ ...formData, language_id: Number(e.target.value) })}
              options={[
                { value: "", label: "Select language" },
                ...(languages?.map((lang: any) => ({ value: lang.id.toString(), label: lang.name })) || []),
              ]}
              fullWidth
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Order *
            </label>
            <input
              type="number"
              value={formData.order}
              onChange={(e) => setFormData({ ...formData, order: Number(e.target.value) })}
              required
              min="1"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Image URL
            </label>
            <input
              type="url"
              value={formData.image_url}
              onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
              placeholder="https://..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div>
            <StyledSelect
              label="Status *"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as LessonStatus })}
              options={[
                { value: "draft", label: "Draft" },
                { value: "published", label: "Published" },
                { value: "archived", label: "Archived" },
              ]}
              fullWidth
              required
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
            >
              {editingLesson ? "Update" : "Create"}
            </button>
            <button
              type="button"
              onClick={closeModal}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Lesson"
        message={`Are you sure you want to delete lesson "${deleteConfirm?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}

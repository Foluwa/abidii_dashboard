"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Toast from "@/components/ui/toast/Toast";
import Alert from "@/components/ui/alert/Alert";
import { StyledSelect } from "@/components/ui/form/StyledSelect";
import { ConfirmationModal } from "@/components/ui/modal/ConfirmationModal";
import Pagination from "@/components/tables/Pagination";
import { FaMicrophone, FaPlay, FaPause } from "react-icons/fa";
import { FiServer } from "react-icons/fi";

interface Voice {
  id: string;
  provider: string;
  voice_id: string;
  voice_name: string;
  language_code: string;
  language_name?: string;
  gender?: string;
  age_group?: string;
  accent?: string;
  style_tags: string[];
  sample_audio_url?: string;
  is_active: boolean;
  provider_metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export default function VoicesPage() {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingVoice, setEditingVoice] = useState<Voice | null>(null);
  const [filterProvider, setFilterProvider] = useState<string>("");
  const [filterLanguage, setFilterLanguage] = useState<string>("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const limit = 20;

  const [formData, setFormData] = useState({
    provider: "google",
    voice_id: "",
    voice_name: "",
    language_code: "",
    gender: "",
    age_group: "",
    accent: "",
    style_tags: [] as string[],
    is_active: true,
    provider_metadata: {} as Record<string, any>,
  });

  useEffect(() => {
    fetchVoices();
  }, [page, filterProvider, filterLanguage]);

  const fetchVoices = async () => {
    setLoading(true);
    setError("");
    try {
      let url = `/api/v1/admin/audio/voices?page=${page}&limit=${limit}`;
      if (filterProvider) url += `&provider=${filterProvider}`;
      if (filterLanguage) url += `&language_code=${filterLanguage}`;

      const response = await apiClient.get(url);
      const data = response.data;
      const normalizedItems: Voice[] = (data.items || []).map((v: any) => ({
        ...v,
        style_tags: Array.isArray(v?.style_tags) ? v.style_tags : [],
        provider_metadata: v?.provider_metadata ?? {},
      }));
      setVoices(normalizedItems);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load voices");
      setVoices([]);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingVoice(null);
    setFormData({
      provider: "google",
      voice_id: "",
      voice_name: "",
      language_code: "",
      gender: "",
      age_group: "",
      accent: "",
      style_tags: [],
      is_active: true,
      provider_metadata: {},
    });
    setShowModal(true);
  };

  const openEditModal = (voice: Voice) => {
    setEditingVoice(voice);
    setFormData({
      provider: voice.provider,
      voice_id: voice.voice_id,
      voice_name: voice.voice_name,
      language_code: voice.language_code,
      gender: voice.gender || "",
      age_group: voice.age_group || "",
      accent: voice.accent || "",
      style_tags: voice.style_tags || [],
      is_active: voice.is_active,
      provider_metadata: voice.provider_metadata || {},
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingVoice(null);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      if (editingVoice) {
        await apiClient.put(`/api/v1/admin/audio/voices/${editingVoice.id}`, formData);
        setSuccessMessage("Voice updated successfully");
      } else {
        await apiClient.post("/api/v1/admin/audio/voices", formData);
        setSuccessMessage("Voice created successfully");
      }
      closeModal();
      fetchVoices();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error: any) {
      setError(error.response?.data?.detail || "Failed to save voice");
    }
  };

  const handleDeleteClick = (voiceId: string, voiceName: string) => {
    setDeleteConfirm({ id: voiceId, name: voiceName });
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      await apiClient.delete(`/api/v1/admin/audio/voices/${deleteConfirm.id}`);
      setSuccessMessage("Voice deleted successfully");
      fetchVoices();
      setDeleteConfirm(null);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error: any) {
      setError(error.response?.data?.detail || "Failed to delete voice");
      setTimeout(() => setError(""), 5000);
    }
  };

  const toggleAudio = (url: string | undefined) => {
    if (!url) return;
    if (playingAudio === url) {
      setPlayingAudio(null);
    } else {
      setPlayingAudio(url);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const pageStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const pageEnd = total === 0 ? 0 : Math.min(page * limit, total);

  return (
    <div className="p-6">
      <PageBreadCrumb pageTitle="Voices" />

      {successMessage && <Toast type="success" message={successMessage} onClose={() => setSuccessMessage("")} />}
      {error && <Toast type="error" message={error} onClose={() => setError("")} />}

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Voice Management</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage TTS voices across all providers
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add Voice
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <div className="flex-1">
          <StyledSelect
            label="Provider"
            value={filterProvider}
            onChange={(e) => {
              setFilterProvider(e.target.value);
              setPage(1);
            }}
            options={[
              { value: "", label: "All Providers" },
              { value: "google", label: "Google TTS" },
              { value: "spitch", label: "Spitch" },
              { value: "elevenlabs", label: "ElevenLabs" },
            ]}
            fullWidth
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Language
          </label>
          <input
            type="text"
            value={filterLanguage}
            onChange={(e) => {
              setFilterLanguage(e.target.value);
              setPage(1);
            }}
            placeholder="e.g., en-US, yo-NG"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      {/* Voices Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : voices.length === 0 ? (
          <div className="text-center py-12">
            <FaMicrophone className="mx-auto text-gray-400 text-5xl mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No voices found</p>
            <button
              onClick={openCreateModal}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add First Voice
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Voice
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Provider
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Language
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Sample
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {voices.map((voice) => (
                    <tr key={voice.id}>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {voice.voice_name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          ID: {voice.voice_id}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                          {voice.provider}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                        {voice.language_code}
                        {voice.language_name && (
                          <div className="text-xs text-gray-500">{voice.language_name}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                        {voice.gender && <div>Gender: {voice.gender}</div>}
                        {voice.accent && <div>Accent: {voice.accent}</div>}
                        {voice.style_tags.length > 0 && (
                          <div className="text-xs text-gray-500">
                            {voice.style_tags.join(", ")}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {voice.sample_audio_url ? (
                          <button
                            onClick={() => toggleAudio(voice.sample_audio_url)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                          >
                            {playingAudio === voice.sample_audio_url ? (
                              <FaPause />
                            ) : (
                              <FaPlay />
                            )}
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">No sample</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            voice.is_active
                              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                              : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {voice.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => openEditModal(voice)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteClick(voice.id, voice.voice_name)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 text-sm"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Showing {pageStart} to {pageEnd} of {total} voices
              </div>
              <div className="ml-auto">
                <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingVoice ? "Edit Voice" : "Add Voice"}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <Alert variant="error" title="Error" message={error} />}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <StyledSelect
                    label="Provider *"
                    value={formData.provider}
                    onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                    options={[
                      { value: "google", label: "Google TTS" },
                      { value: "spitch", label: "Spitch" },
                      { value: "elevenlabs", label: "ElevenLabs" },
                    ]}
                    fullWidth
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Voice ID *
                  </label>
                  <input
                    type="text"
                    value={formData.voice_id}
                    onChange={(e) => setFormData({ ...formData, voice_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Voice Name *
                  </label>
                  <input
                    type="text"
                    value={formData.voice_name}
                    onChange={(e) => setFormData({ ...formData, voice_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Language Code *
                  </label>
                  <input
                    type="text"
                    value={formData.language_code}
                    onChange={(e) => setFormData({ ...formData, language_code: e.target.value })}
                    placeholder="e.g., en-US, yo-NG"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <StyledSelect
                    label="Gender"
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    options={[
                      { value: "", label: "Not specified" },
                      { value: "male", label: "Male" },
                      { value: "female", label: "Female" },
                      { value: "neutral", label: "Neutral" },
                    ]}
                    fullWidth
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Age Group
                  </label>
                  <input
                    type="text"
                    value={formData.age_group}
                    onChange={(e) => setFormData({ ...formData, age_group: e.target.value })}
                    placeholder="e.g., adult, child, senior"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Accent
                  </label>
                  <input
                    type="text"
                    value={formData.accent}
                    onChange={(e) => setFormData({ ...formData, accent: e.target.value })}
                    placeholder="e.g., British, American, Nigerian"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="col-span-2 flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300"
                  />
                  <label htmlFor="is_active" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Active (available for TTS generation)
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingVoice ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audio Player (hidden) */}
      {playingAudio && (
        <audio
          src={playingAudio}
          autoPlay
          onEnded={() => setPlayingAudio(null)}
          className="hidden"
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Voice"
        message={`Are you sure you want to delete voice "${deleteConfirm?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}

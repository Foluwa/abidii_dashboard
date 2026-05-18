"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useLanguages } from "@/hooks/useApi";
import { apiClient } from "@/lib/api";
import type { Language } from "@/types/api";
import Toast from "@/components/ui/toast/Toast";
import Alert from "@/components/ui/alert/Alert";
import { StyledSelect } from "@/components/ui/form/StyledSelect";
import { ConfirmationModal } from "@/components/ui/modal/ConfirmationModal";
import { AudioWaveform } from "@/components/ui/audio/AudioWaveform";
import { GoogleSheetsBulkImport } from "@/components/admin/GoogleSheetsBulkImport";
import {
  ContentPageHeader,
  ContentStatsCard,
  ContentStatsGrid,
  ContentFiltersCard,
  ActiveFilterChips,
  StickyBulkActionBar,
} from '@/components/admin/layout';
import { FiBarChart2, FiCheckCircle, FiTrash2, FiVolume2, FiVolumeX } from "react-icons/fi";

interface Letter {
  id: string;
  language_id: string;
  glyph: string;
  display_name: string;
  is_digraph: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
  audio_url?: string;
}

export default function LettersPage() {
  const { languages } = useLanguages();
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");
  const [letters, setLetters] = useState<Letter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingLetter, setEditingLetter] = useState<Letter | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; glyph: string } | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [uploadingAudio, setUploadingAudio] = useState(false);

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    glyph: "",
    display_name: "",
    is_digraph: false,
    order_index: 0,
  });

  // Stats
  const stats = useMemo(() => {
    const digraphs = letters.filter((l) => l.is_digraph).length;
    const withAudio = letters.filter((l) => l.audio_url).length;
    const missingAudio = letters.length - withAudio;
    return { total: letters.length, digraphs, withAudio, missingAudio };
  }, [letters]);

  const fetchLetters = async (languageId: string) => {
    if (!languageId) return;
    
    setLoading(true);
    setError("");
    setSelectedIds([]);
    try {
      const response = await apiClient.get(`/api/v1/admin/content/letters?language_id=${languageId}`);
      
      // Handle different response structures
      const lettersData = response.data?.items || response.data || [];
      
      setLetters(Array.isArray(lettersData) ? lettersData : []);
    } catch (err: any) {
      console.error("Failed to load letters:", err);
      setError(err.response?.data?.detail || err.message || "Failed to load letters");
      setLetters([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = (languageId: string) => {
    setSelectedLanguage(languageId);
    if (languageId) {
      fetchLetters(languageId);
    } else {
      setLetters([]);
    }
  };

  useEffect(() => {
    if (!selectedLanguage && languages.length > 0) {
      const defaultLanguageId = languages[0].id;
      setSelectedLanguage(defaultLanguageId);
      fetchLetters(defaultLanguageId);
    }
  }, [languages, selectedLanguage]);

  const openCreateModal = () => {
    setEditingLetter(null);
    setFormData({
      glyph: "",
      display_name: "",
      is_digraph: false,
      order_index: letters.length,
    });
    setAudioFile(null);
    setAudioPreview(null);
    setShowModal(true);
  };

  const openEditModal = (letter: Letter) => {
    setEditingLetter(letter);
    setFormData({
      glyph: letter.glyph,
      display_name: letter.display_name,
      is_digraph: letter.is_digraph,
      order_index: letter.order_index,
    });
    setAudioFile(null);
    setAudioPreview(letter.audio_url || null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingLetter(null);
    setAudioFile(null);
    setAudioPreview(null);
    setError("");
  };

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('audio/')) {
        setError('Please select a valid audio file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('Audio file must be less than 5MB');
        return;
      }
      setAudioFile(file);
      setAudioPreview(URL.createObjectURL(file));
      setError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedLanguage) {
      setError("Please select a language first");
      return;
    }

    try {
      const payload = {
        ...formData,
        language_id: selectedLanguage,
      };

      let letterId: string;
      if (editingLetter) {
        await apiClient.put(`/api/v1/admin/content/letters/${editingLetter.id}`, payload);
        letterId = editingLetter.id;
        setSuccessMessage("Letter updated successfully");
      } else {
        const response = await apiClient.post("/api/v1/admin/content/letters", payload);
        letterId = response.data.id;
        setSuccessMessage("Letter created successfully");
      }

      // Upload audio if provided
      if (audioFile && letterId) {
        setUploadingAudio(true);
        const audioFormData = new FormData();
        audioFormData.append('audio', audioFile);
        
        try {
          await apiClient.post(`/api/v1/admin/content/letters/${letterId}/audio`, audioFormData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });
          setSuccessMessage(editingLetter ? "Letter and audio updated successfully" : "Letter and audio created successfully");
        } catch (audioError: any) {
          console.error('Audio upload error:', audioError);
          setError('Letter saved but audio upload failed: ' + (audioError.response?.data?.detail || audioError.message));
        } finally {
          setUploadingAudio(false);
        }
      }

      closeModal();
      fetchLetters(selectedLanguage);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to save letter");
    }
  };

  const handleDeleteClick = (letterId: string, glyph: string) => {
    setDeleteConfirm({ id: letterId, glyph });
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      await apiClient.delete(`/api/v1/admin/content/letters/${deleteConfirm.id}`);
      setSuccessMessage("Letter deleted successfully");
      setDeleteConfirm(null);
      fetchLetters(selectedLanguage);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to delete letter");
      setDeleteConfirm(null);
      setTimeout(() => setError(""), 5000);
    }
  };

  const handleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === letters.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(letters.map((l) => l.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} letter(s)?`)) return;

    setIsDeleting(true);
    try {
      await apiClient.post('/api/v1/admin/content/letters/bulk-delete', {
        letter_ids: selectedIds,
      });
      setSuccessMessage(`Deleted ${selectedIds.length} letter(s)`);
      setSelectedIds([]);
      fetchLetters(selectedLanguage);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to delete letters");
      setTimeout(() => setError(""), 5000);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {successMessage && <Toast type="success" message={successMessage} onClose={() => setSuccessMessage("")} />}
      {error && <Toast type="error" message={error} onClose={() => setError("")} />}

      <ContentPageHeader
        title="Letters"
        subtitle="Manage letters for each language"
        onAdd={openCreateModal}
        addLabel="Add Letter"
        addDisabled={!selectedLanguage}
      />

      {selectedLanguage && (
        <ContentStatsGrid cols={4}>
          <ContentStatsCard label="Total" value={stats.total} icon={FiBarChart2} />
          <ContentStatsCard label="Digraphs" value={stats.digraphs} icon={FiCheckCircle} iconBgClass="bg-purple-100 dark:bg-purple-900/20" iconTextClass="text-purple-600 dark:text-purple-400" />
          <ContentStatsCard label="With Audio" value={stats.withAudio} icon={FiVolume2} iconBgClass="bg-green-100 dark:bg-green-900/20" iconTextClass="text-green-600 dark:text-green-400" />
          <ContentStatsCard label="Missing Audio" value={stats.missingAudio} icon={FiVolumeX} iconBgClass="bg-red-100 dark:bg-red-900/20" iconTextClass="text-red-600 dark:text-red-400" />
        </ContentStatsGrid>
      )}

      <ContentFiltersCard>
        <div className="max-w-md">
          <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300">
            Language
          </label>
          <StyledSelect
            value={selectedLanguage}
            onChange={(e) => handleLanguageChange(e.target.value)}
            options={[
              { value: "", label: "-- Select a language --" },
              ...languages.map((lang: Language) => ({
                value: lang.id,
                label: `${lang.name} (${lang.native_name})`
              }))
            ]}
            fullWidth
          />
        </div>
      </ContentFiltersCard>

      {/* Bulk Import from Google Sheets (has built-in accordion) */}
      {selectedLanguage && (
        <GoogleSheetsBulkImport
          contentType="letters"
          onImportComplete={() => fetchLetters(selectedLanguage)}
          defaultLanguageId={selectedLanguage}
          defaultWorksheetTitle="yo_letters"
          expectedColumns={[
            { name: "source_row_key", required: true, description: "Stable spreadsheet row key", example: "letter_yor_001" },
            { name: "glyph", required: true, description: "Letter or digraph", example: "Ẹ" },
            { name: "display_name", required: true, description: "Display name", example: "Ẹ" },
            { name: "is_digraph", required: false, description: "TRUE for multi-character letters", example: "FALSE" },
            { name: "order_index", required: true, description: "Sort order", example: "7" },
            { name: "review_status", required: false, description: "Editorial review status", example: "approved" },
          ]}
        />
      )}

      <StickyBulkActionBar
        selectedCount={selectedIds.length}
        onClear={() => setSelectedIds([])}
        itemName="letter"
        actions={[
          {
            label: isDeleting ? 'Deleting...' : 'Delete Selected',
            onClick: handleBulkDelete,
            disabled: isDeleting,
            loading: isDeleting,
            variant: 'danger',
            icon: <FiTrash2 className="h-4 w-4" />,
          },
        ]}
      />

      {/* Letters Content */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
        </div>
      )}

      {!loading && selectedLanguage && letters.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">No letters found for this language</p>
          <button
            onClick={openCreateModal}
            className="mt-4 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
          >
            Add Your First Letter
          </button>
        </div>
      )}

      {/* Mobile Grid View */}
      {!loading && letters.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4 lg:hidden">
          {letters.map((letter) => {
            const isSelected = selectedIds.includes(letter.id);
            return (
              <div
                key={letter.id}
                className={`bg-white dark:bg-gray-800 rounded-lg border p-4 text-center hover:shadow-md transition-shadow ${
                  isSelected ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleSelect(letter.id)}
                    className="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                </div>
                <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                  {letter.glyph}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {letter.display_name}
                </div>
                {letter.is_digraph && (
                  <span className="inline-block px-2 py-1 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 rounded">
                    Digraph
                  </span>
                )}
                <div className="flex space-x-2 mt-3 justify-center">
                  <button
                    onClick={() => openEditModal(letter)}
                    className="px-2 py-1 text-xs bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteClick(letter.id, letter.glyph)}
                    className="px-2 py-1 text-xs bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded hover:bg-red-100 dark:hover:bg-red-900/30"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table View - Desktop Only */}
      {!loading && letters.length > 0 && (
        <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === letters.length && letters.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Glyph
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Display Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Order
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Audio
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {letters.map((letter) => {
                  const isSelected = selectedIds.includes(letter.id);
                  return (
                    <tr
                      key={letter.id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-900/50 ${
                        isSelected ? 'bg-brand-50 dark:bg-brand-900/10' : ''
                      }`}
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelect(letter.id)}
                          className="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {letter.glyph}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {letter.display_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {letter.order_index}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {letter.is_digraph ? (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                            Digraph
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            Single
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {letter.audio_url ? (
                          <div className="max-w-md">
                            <AudioWaveform
                              src={letter.audio_url}
                              height={40}
                              waveColor="#94a3b8"
                              progressColor="#3b82f6"
                              cursorColor="#1d4ed8"
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-600">No audio</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(letter)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClick(letter.id, letter.glyph)}
                            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full m-4">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingLetter ? "Edit Letter" : "Add Letter"}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <Alert variant="error" title="Error" message={error} />}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Glyph *
                </label>
                <input
                  type="text"
                  value={formData.glyph}
                  onChange={(e) => setFormData({ ...formData, glyph: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                  maxLength={10}
                  placeholder="e.g., A, Ẹ, GB (for digraph)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Display Name *
                </label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                  maxLength={20}
                  placeholder="e.g., Letter A, Ẹ"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Order Index *
                </label>
                <input
                  type="number"
                  value={formData.order_index}
                  onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                  min={0}
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_digraph"
                  checked={formData.is_digraph}
                  onChange={(e) => setFormData({ ...formData, is_digraph: e.target.checked })}
                  className="h-4 w-4 text-blue-600 rounded border-gray-300 dark:border-gray-600"
                />
                <label htmlFor="is_digraph" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Is Digraph (two or more letters representing one sound)
                </label>
              </div>

              {/* Audio Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Audio File (Optional)
                </label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioChange}
                  className="block w-full text-sm text-gray-900 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-white dark:bg-gray-700 focus:outline-none"
                />
                {audioPreview && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {audioFile ? 'New audio file selected' : 'Current audio'}
                    </p>
                    <audio controls className="w-full h-10">
                      <source src={audioPreview} />
                    </audio>
                  </div>
                )}
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Max file size: 5MB. Supported formats: MP3, WAV, OGG
                </p>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingAudio}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadingAudio ? "Uploading..." : editingLetter ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Letter"
        message={`Are you sure you want to delete the letter "${deleteConfirm?.glyph}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}

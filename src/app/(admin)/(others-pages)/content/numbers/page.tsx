"use client";

import React, { useCallback, useState } from "react";
import { useLanguages } from "@/hooks/useApi";
import { apiClient } from "@/lib/api";
import type { Language } from "@/types/api";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Toast from "@/components/ui/toast/Toast";
import Alert from "@/components/ui/alert/Alert";
import { GoogleSheetsBulkImport } from "@/components/admin/GoogleSheetsBulkImport";
import { StyledSelect } from "@/components/ui/form/StyledSelect";
import NumbersDataTable from "@/components/tables/NumbersDataTable";
import { Modal } from "@/components/ui/modal";
import { ConfirmationModal } from "@/components/ui/modal/ConfirmationModal";
import { RegenerateAudioModal, type RegenerateAudioTarget } from "@/components/modals/RegenerateAudioModal";
import Pagination from "@/components/tables/Pagination";
import { FiPlus, FiGlobe } from "react-icons/fi";

interface Number {
  id: string;
  language_id: string;
  number_value: number;
  number_type: string;
  word: string;
  word_normalized: string;
  written_form?: string;
  ordinal_word?: string;
  is_compound: boolean;
  base_numbers?: number[];
  formation_rule?: string;
  arithmetic_expression?: string;
  ipa_pronunciation?: string;
  number_system: string;
  cultural_context?: string;
  usage_notes?: string;
  difficulty_level: number;
  display_order: number;
  is_active: boolean;
  audio?: any[];
  last_regeneration_status?: string | null;
  last_regeneration_error?: string | null;
  last_regeneration_updated_at?: string | null;
  alignment_status?: "draft" | "reviewed" | "approved" | "stale" | null;
  alignment_updated_at?: string | null;
  alignment_stale_reason?: string | null;
  alignment_job_status?: "queued" | "processing" | "completed" | "failed" | "cancelled" | "superseded" | null;
  alignment_job_provider?: string | null;
  alignment_job_engine?: string | null;
  alignment_job_error?: string | null;
  alignment_job_updated_at?: string | null;
}

interface NumbersResponse {
  total: number;
  page: number;
  limit: number;
  items: Number[];
}

function isRegenerationPending(status?: string | null) {
  return status === "queued" || status === "processing";
}

function mapIso6393ToVoicePrefix(languageCode?: string | null) {
  switch ((languageCode || "").toLowerCase()) {
    case "yor":
      return "yo";
    case "eng":
      return "en";
    case "hau":
      return "ha";
    case "ibo":
      return "ig";
    case "swa":
      return "sw";
    default:
      return (languageCode || "").toLowerCase();
  }
}

function voiceProviderPriority(provider?: string | null) {
  if (provider === "google") return 0;
  if (provider === "elevenlabs") return 1;
  if (provider === "spitch") return 2;
  return 3;
}

export default function NumbersPage() {
  const [selectedLanguage, setSelectedLanguage] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [showModal, setShowModal] = useState(false);
  const [editingNumber, setEditingNumber] = useState<Number | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; word: string } | null>(null);
  
  const [numbers, setNumbers] = useState<Number[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [regenerationTarget, setRegenerationTarget] = useState<RegenerateAudioTarget | null>(null);
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>([]);
  const [isBulkRegenerating, setIsBulkRegenerating] = useState(false);
  const [showBulkRegenerateConfirm, setShowBulkRegenerateConfirm] = useState(false);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<any[]>([]);
  const [bulkRegenerateProvider, setBulkRegenerateProvider] = useState<string>("");
  const [bulkRegenerateVoiceId, setBulkRegenerateVoiceId] = useState<string>("");
  const [bulkRegenerateNumberIds, setBulkRegenerateNumberIds] = useState<string[]>([]);
  const [bulkVoiceLanguagePrefix, setBulkVoiceLanguagePrefix] = useState<string>("");
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const { languages } = useLanguages();

  const [formData, setFormData] = useState({
    language_id: "",
    number_value: 1,
    number_type: "cardinal",
    word: "",
    word_normalized: "",
    written_form: "",
    ordinal_word: "",
    is_compound: false,
    formation_rule: "",
    arithmetic_expression: "",
    ipa_pronunciation: "",
    number_system: "decimal",
    cultural_context: "",
    usage_notes: "",
    difficulty_level: 1,
    display_order: 1,
    is_active: true,
  });

  // Fetch numbers
  const fetchNumbers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      
      if (selectedLanguage) {
        params.append("language_id", selectedLanguage);
      }
      if (search) {
        params.append("search", search);
      }

      const response = await apiClient.get<NumbersResponse>(
        `/api/v1/admin/numbers?${params.toString()}`
      );
      
      // Deduplicate numbers to prevent duplicate key errors
      const seen = new Set<string>();
      const uniqueNumbers = response.data.items.filter((num) => {
        if (seen.has(num.id)) {
          return false;
        }
        seen.add(num.id);
        return true;
      });
      
      setNumbers(uniqueNumbers);
      setSelectedNumbers((current) => current.filter((numberId) => uniqueNumbers.some((number) => number.id === numberId)));
      setTotal(response.data.total);
    } catch (error) {
      console.error("Failed to fetch numbers:", error);
      setErrorMessage("Failed to load numbers");
    } finally {
      setIsLoading(false);
    }
  }, [limit, page, search, selectedLanguage]);

  React.useEffect(() => {
    fetchNumbers();
  }, [fetchNumbers]);

  const openCreateModal = () => {
    setEditingNumber(null);
    setFormData({
      language_id: selectedLanguage || (languages?.[0]?.id ?? ""),
      number_value: 1,
      number_type: "cardinal",
      word: "",
      word_normalized: "",
      written_form: "",
      ordinal_word: "",
      is_compound: false,
      formation_rule: "",
      arithmetic_expression: "",
      ipa_pronunciation: "",
      number_system: "decimal",
      cultural_context: "",
      usage_notes: "",
      difficulty_level: 1,
      display_order: 1,
      is_active: true,
    });
    setShowModal(true);
  };

  const openEditModal = (number: Number) => {
    setEditingNumber(number);
    setFormData({
      language_id: number.language_id,
      number_value: number.number_value,
      number_type: number.number_type,
      word: number.word,
      word_normalized: number.word_normalized,
      written_form: number.written_form || "",
      ordinal_word: number.ordinal_word || "",
      is_compound: number.is_compound,
      formation_rule: number.formation_rule || "",
      arithmetic_expression: number.arithmetic_expression || "",
      ipa_pronunciation: number.ipa_pronunciation || "",
      number_system: number.number_system,
      cultural_context: number.cultural_context || "",
      usage_notes: number.usage_notes || "",
      difficulty_level: number.difficulty_level,
      display_order: number.display_order,
      is_active: number.is_active,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingNumber(null);
    setErrorMessage("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    
    try {
      if (editingNumber) {
        await apiClient.put(`/api/v1/admin/numbers/${editingNumber.id}`, formData);
        setSuccessMessage("Number updated successfully");
      } else {
        await apiClient.post("/api/v1/admin/numbers", formData);
        setSuccessMessage("Number created successfully");
      }
      closeModal();
      fetchNumbers();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || "Failed to save number");
    }
  };

  const handleDeleteClick = (id: string, word: string) => {
    setDeleteConfirm({ id, word });
  };

  const handleRegenerateAudio = (number: Number) => {
    if (isRegenerationPending(number.last_regeneration_status)) {
      setErrorMessage("Audio regeneration is already in progress for this number");
      return;
    }

    const languageCode = (languages?.find((lang: any) => lang.id === number.language_id)?.iso_639_3 || "yor") as string;
    setRegenerationTarget({
      id: number.id,
      contentType: "number",
      displayText: number.word || `#${number.number_value}`,
      defaultText: number.word || `${number.number_value}`,
      languageCode,
      submitEndpoint: `/api/v1/admin/numbers/${number.id}/regenerate-audio`,
    });
    setShowRegenerateModal(true);
  };

  const toggleNumberSelection = (numberId: string) => {
    const number = numbers.find((item) => item.id === numberId);
    if (number && isRegenerationPending(number.last_regeneration_status)) {
      return;
    }
    setSelectedNumbers((current) => (
      current.includes(numberId)
        ? current.filter((id) => id !== numberId)
        : [...current, numberId]
    ));
  };

  const toggleSelectAllVisibleNumbers = () => {
    const selectableIds = numbers
      .filter((number) => !isRegenerationPending(number.last_regeneration_status))
      .map((number) => number.id);
    if (selectableIds.length === 0) {
      return;
    }
    const allSelected = selectableIds.every((id) => selectedNumbers.includes(id));
    if (allSelected) {
      setSelectedNumbers((current) => current.filter((id) => !selectableIds.includes(id)));
    } else {
      setSelectedNumbers((current) => Array.from(new Set([...current, ...selectableIds])));
    }
  };

  const handleBulkRegenerateAudio = async () => {
    const queueableIds = selectedNumbers.filter((id) => {
      const number = numbers.find((item) => item.id === id);
      return number && !isRegenerationPending(number.last_regeneration_status);
    });
    if (queueableIds.length === 0) {
      setErrorMessage("Select one or more numbers that are not already queued/processing");
      setTimeout(() => setErrorMessage(""), 3000);
      return;
    }

    const queueableNumbers = numbers.filter((number) => queueableIds.includes(number.id));
    const languageIds = Array.from(new Set(queueableNumbers.map((number) => number.language_id)));
    if (languageIds.length !== 1) {
      setErrorMessage("Bulk regeneration requires selected numbers from the same language");
      setTimeout(() => setErrorMessage(""), 5000);
      return;
    }

    const selectedLanguageRecord = (languages || []).find((lang: Language) => lang.id === languageIds[0]);
    const voicePrefix = mapIso6393ToVoicePrefix(selectedLanguageRecord?.iso_639_3);
    if (!voicePrefix) {
      setErrorMessage("Could not determine language voice mapping for selected numbers");
      setTimeout(() => setErrorMessage(""), 5000);
      return;
    }

    setIsLoadingVoices(true);
    try {
      const response = await apiClient.get("/api/v1/admin/audio/voices", {
        params: {
          language_code: voicePrefix,
          is_active: true,
          dedupe_aliases: true,
          page_size: 200,
        },
      });
      const voices = response.data.items || response.data.voices || [];
      if (!Array.isArray(voices) || voices.length === 0) {
        setErrorMessage(`No active voices available for language ${voicePrefix}`);
        setTimeout(() => setErrorMessage(""), 5000);
        return;
      }

      setAvailableVoices(voices);
      setBulkRegenerateProvider("");
      setBulkRegenerateVoiceId("");
      setBulkRegenerateNumberIds(queueableIds);
      setBulkVoiceLanguagePrefix(voicePrefix);
      setShowBulkRegenerateConfirm(true);
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || "Failed to load voices for bulk regeneration");
      setTimeout(() => setErrorMessage(""), 5000);
    } finally {
      setIsLoadingVoices(false);
    }
  };

  const confirmBulkRegenerateAudio = async () => {
    if (!bulkRegenerateProvider || !bulkRegenerateVoiceId) {
      setErrorMessage("Select a provider and voice before bulk regeneration");
      setTimeout(() => setErrorMessage(""), 4000);
      return;
    }

    if (bulkRegenerateNumberIds.length === 0) {
      setErrorMessage("No queueable numbers selected for bulk regeneration");
      setTimeout(() => setErrorMessage(""), 4000);
      return;
    }

    setIsBulkRegenerating(true);
    try {
      const response = await apiClient.post("/api/v1/admin/numbers/bulk/regenerate-audio", {
        number_ids: bulkRegenerateNumberIds,
        voice_id: bulkRegenerateVoiceId,
      });
      const result = response.data || {};
      const errors: Array<{ number_id?: string; detail?: string }> = Array.isArray(result.errors) ? result.errors : [];
      const failedIds = new Set(errors.map((error) => error.number_id).filter(Boolean) as string[]);
      const queuedIds = bulkRegenerateNumberIds.filter((id) => !failedIds.has(id));
      const queuedCount = Number(result.queued_count || queuedIds.length);
      const failedCount = Number(result.failed_count || failedIds.size);

      setNumbers((current) => current.map((number) => (
        queuedIds.includes(number.id)
          ? {
              ...number,
              last_regeneration_status: "queued",
              last_regeneration_error: null,
            }
          : number
      )));

      if (queuedCount > 0) {
        setSuccessMessage(
          failedCount > 0
            ? `Queued ${queuedCount} number(s); ${failedCount} could not be queued`
            : `Audio regeneration queued for ${queuedCount} number(s)`
        );
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        const firstError = errors.length > 0 ? errors[0]?.detail : null;
        setErrorMessage(firstError || "Bulk regeneration did not queue any numbers");
        setTimeout(() => setErrorMessage(""), 5000);
      }

      setSelectedNumbers((current) => current.filter((id) => !queuedIds.includes(id)));
      setShowBulkRegenerateConfirm(false);
      setBulkRegenerateProvider("");
      setBulkRegenerateVoiceId("");
      setBulkRegenerateNumberIds([]);
      setBulkVoiceLanguagePrefix("");
      fetchNumbers();
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || "Failed to queue bulk audio regeneration");
      setTimeout(() => setErrorMessage(""), 5000);
    } finally {
      setIsBulkRegenerating(false);
    }
  };

  const handleRequeueAlignment = async (number: Number) => {
    try {
      await apiClient.post(`/api/v1/admin/numbers/${number.id}/alignment/requeue`);
      setNumbers((current) => current.map((item) => (
        item.id === number.id
          ? {
              ...item,
              alignment_job_status: "queued",
              alignment_job_provider: "openai",
              alignment_job_engine: "whisper-1",
              alignment_job_error: null,
              alignment_job_updated_at: new Date().toISOString(),
            }
          : item
      )));
      setSuccessMessage(`Alignment queued for ${number.word}`);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || "Failed to queue number alignment");
      setTimeout(() => setErrorMessage(""), 5000);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      const id = deleteConfirm.id;
      await apiClient.delete(`/api/v1/admin/numbers/${id}`);
      setSuccessMessage("Number deleted successfully");
      setDeleteConfirm(null);
      fetchNumbers();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || "Failed to delete number");
      setDeleteConfirm(null);
      setTimeout(() => setErrorMessage(""), 3000);
    }
  };

  const selectableVisibleIds = numbers
    .filter((number) => !isRegenerationPending(number.last_regeneration_status))
    .map((number) => number.id);
  const allVisibleNumbersSelected = selectableVisibleIds.length > 0
    && selectableVisibleIds.every((id) => selectedNumbers.includes(id));

  return (
    <div className="p-6">
      <PageBreadCrumb pageTitle="Numbers" />

      <div className="mt-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Numbers Management
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Manage numbers (1-1000+) across all languages
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-300 dark:focus:ring-brand-800"
          >
            <FiPlus className="w-5 h-5" />
            Add Number
          </button>
        </div>

        {/* Alerts */}
        {successMessage && (
          <Toast type="success" message={successMessage} onClose={() => setSuccessMessage("")} />
        )}
        {errorMessage && (
          <Toast type="error" message={errorMessage} onClose={() => setErrorMessage("")} />
        )}

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2 flex-1 max-w-xs">
            <FiGlobe className="w-5 h-5 text-gray-400" />
            <StyledSelect
              value={selectedLanguage || ""}
              onChange={(e) => {
                setSelectedLanguage(e.target.value || undefined);
                setPage(1);
                setSelectedNumbers([]);
              }}
              options={[
                { value: "", label: "All Languages" },
                ...(languages?.map((lang: Language) => ({
                  value: lang.id,
                  label: lang.name
                })) || [])
              ]}
              fullWidth
            />
          </div>

          <div className="flex-1">
            <input
              type="text"
              placeholder="Search numbers..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Bulk Import from Google Sheets */}
        {selectedLanguage && (
          <div className="mb-6">
            <GoogleSheetsBulkImport
              contentType="numbers"
              onImportComplete={() => fetchNumbers()}
              expectedColumns={[
                { name: 'language_id', required: true, description: 'UUID of the language', example: '6e76e0ee-3df1-41d1-9548-ac3fed67a77b' },
                { name: 'number_value', required: true, description: 'Numeric value', example: '1' },
                { name: 'number_type', required: true, description: 'cardinal/ordinal', example: 'cardinal' },
                { name: 'word', required: true, description: 'Number word in target language', example: 'Ọkan' },
                { name: 'word_normalized', required: false, description: 'Normalized form', example: 'okan' },
                { name: 'written_form', required: false, description: 'Alternative written form', example: '' },
                { name: 'ordinal_word', required: false, description: 'Ordinal form', example: 'Èkíní' },
                { name: 'formation_rule', required: false, description: 'Formation pattern', example: 'base' },
                { name: 'difficulty_level', required: false, description: 'Difficulty 1-5', example: '1' },
              ]}
            />
          </div>
        )}

        {numbers.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleBulkRegenerateAudio}
              disabled={selectedNumbers.length === 0 || isBulkRegenerating || isLoadingVoices}
              className="px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingVoices ? "Loading voices..." : isBulkRegenerating ? "Queueing..." : "Regenerate Selected Audio"}
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {selectedNumbers.length === 0
                ? "Select one or more numbers to regenerate in bulk."
                : `${selectedNumbers.length} number${selectedNumbers.length === 1 ? "" : "s"} selected`}
            </span>
          </div>
        )}

        {/* Data Table */}
        <NumbersDataTable
          numbers={numbers}
          isLoading={isLoading}
          selectedNumbers={selectedNumbers}
          allVisibleNumbersSelected={allVisibleNumbersSelected}
          onToggleSelect={toggleNumberSelection}
          onToggleSelectAll={toggleSelectAllVisibleNumbers}
          onEdit={openEditModal}
          onRegenerateAudio={handleRegenerateAudio}
          onRequeueAlignment={handleRequeueAlignment}
          onDelete={(id) => {
            const number = numbers.find(n => n.id === id);
            handleDeleteClick(id, number?.word || `#${number?.number_value}` || 'this number');
          }}
          languages={languages || []}
        />

        {/* Pagination */}
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} numbers
          </p>
          <div className="ml-auto">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </div>
      </div>

      <Modal
        isOpen={showBulkRegenerateConfirm}
        onClose={() => {
          if (!isBulkRegenerating) {
            setShowBulkRegenerateConfirm(false);
            setBulkRegenerateProvider("");
            setBulkRegenerateVoiceId("");
            setBulkRegenerateNumberIds([]);
            setBulkVoiceLanguagePrefix("");
          }
        }}
        title={`Regenerate Audio for ${bulkRegenerateNumberIds.length} Number${bulkRegenerateNumberIds.length === 1 ? "" : "s"}`}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Provider *
            </label>
            <select
              value={bulkRegenerateProvider}
              onChange={(e) => {
                setBulkRegenerateProvider(e.target.value);
                setBulkRegenerateVoiceId("");
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            >
              <option value="">Select provider</option>
              {Array.from(
                new Set(
                  availableVoices
                    .filter((voice) => (
                      typeof voice.language_code === "string"
                      && (
                        voice.language_code === bulkVoiceLanguagePrefix
                        || voice.language_code.startsWith(`${bulkVoiceLanguagePrefix}-`)
                      )
                    ))
                    .map((voice) => String(voice.provider || "").trim())
                    .filter(Boolean)
                )
              )
                .sort((a, b) => voiceProviderPriority(a) - voiceProviderPriority(b) || a.localeCompare(b))
                .map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Voice *
            </label>
            <select
              value={bulkRegenerateVoiceId}
              onChange={(e) => setBulkRegenerateVoiceId(e.target.value)}
              disabled={!bulkRegenerateProvider}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-50"
            >
              <option value="">{bulkRegenerateProvider ? "Select voice" : "Select provider first"}</option>
              {availableVoices
                .filter((voice) => (
                  typeof voice.language_code === "string"
                  && voice.provider === bulkRegenerateProvider
                  && (
                    voice.language_code === bulkVoiceLanguagePrefix
                    || voice.language_code.startsWith(`${bulkVoiceLanguagePrefix}-`)
                  )
                ))
                .map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {(voice.display_name || voice.voice_name || voice.voice_code || "Unknown Voice")} ({voice.provider})
                  </option>
                ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Provider and voice are required for bulk regeneration.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={confirmBulkRegenerateAudio}
              disabled={isBulkRegenerating || !bulkRegenerateProvider || !bulkRegenerateVoiceId}
              className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBulkRegenerating ? "Regenerating..." : "Regenerate"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!isBulkRegenerating) {
                  setShowBulkRegenerateConfirm(false);
                  setBulkRegenerateProvider("");
                  setBulkRegenerateVoiceId("");
                  setBulkRegenerateNumberIds([]);
                  setBulkVoiceLanguagePrefix("");
                }
              }}
              disabled={isBulkRegenerating}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Create/Edit Modal */}
      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={closeModal}
          title={editingNumber ? "Edit Number" : "Create Number"}
          maxWidth="3xl"
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            {errorMessage && (
              <Alert variant="error" title="Error" message={errorMessage} />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Language */}
              <div>
                <StyledSelect
                  label="Language"
                  required
                  value={formData.language_id}
                  onChange={(e) => setFormData({ ...formData, language_id: e.target.value })}
                  options={[
                    { value: "", label: "Select Language" },
                    ...(languages?.map((lang: Language) => ({
                      value: lang.id,
                      label: lang.name
                    })) || [])
                  ]}
                  fullWidth
                />
              </div>

              {/* Number Value */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Number Value *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.number_value}
                  onChange={(e) => setFormData({ ...formData, number_value: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Word */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Word *
                </label>
                <input
                  type="text"
                  required
                  value={formData.word}
                  onChange={(e) => setFormData({ ...formData, word: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Word Normalized */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Normalized *
                </label>
                <input
                  type="text"
                  required
                  value={formData.word_normalized}
                  onChange={(e) => setFormData({ ...formData, word_normalized: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Number System */}
              <div>
                <StyledSelect
                  label="Number System"
                  required
                  value={formData.number_system}
                  onChange={(e) => setFormData({ ...formData, number_system: e.target.value })}
                  options={[
                    { value: "decimal", label: "Decimal" },
                    { value: "vigesimal", label: "Vigesimal" }
                  ]}
                  fullWidth
                />
              </div>

              {/* Difficulty */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Difficulty (1-5) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max="5"
                  value={formData.difficulty_level}
                  onChange={(e) => setFormData({ ...formData, difficulty_level: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            {/* IPA Pronunciation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                IPA Pronunciation
              </label>
              <input
                type="text"
                value={formData.ipa_pronunciation}
                onChange={(e) => setFormData({ ...formData, ipa_pronunciation: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Usage Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Usage Notes
              </label>
              <textarea
                rows={3}
                value={formData.usage_notes}
                onChange={(e) => setFormData({ ...formData, usage_notes: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex items-center justify-end gap-3 pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={closeModal}
                className="px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-4 focus:ring-gray-200 dark:focus:ring-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-300 dark:focus:ring-brand-800 transition-colors"
              >
                {editingNumber ? "Update Number" : "Create Number"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Number"
        message={`Are you sure you want to delete "${deleteConfirm?.word}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      <RegenerateAudioModal
        isOpen={showRegenerateModal}
        onClose={() => {
          setShowRegenerateModal(false);
          setRegenerationTarget(null);
        }}
        target={regenerationTarget}
        onSuccess={() => {
          if (regenerationTarget) {
            setNumbers((current) => current.map((number) => (
              number.id === regenerationTarget.id
                ? {
                    ...number,
                    last_regeneration_status: "queued",
                    last_regeneration_error: null,
                  }
                : number
            )));
          }
          fetchNumbers();
        }}
      />
    </div>
  );
}

import React from "react";
import { FiEdit, FiTrash2, FiHash, FiVolume2, FiRefreshCw } from "react-icons/fi";
import InlineAudioPlayer from "@/components/ui/audio/InlineAudioPlayer";

interface Number {
  id: string;
  language_id: string;
  number_value: number;
  number_type: string;
  word: string;
  word_normalized: string;
  is_compound: boolean;
  number_system: string;
  difficulty_level: number;
  display_order: number;
  is_active: boolean;
  // Backend returns these fields from number_audio join
  has_audio?: boolean;
  audio_url?: string; // This is s3_bucket_key
  last_regeneration_status?: string | null;
  last_regeneration_error?: string | null;
  alignment_status?: "draft" | "reviewed" | "approved" | "stale" | null;
  alignment_job_status?: "queued" | "processing" | "completed" | "failed" | "cancelled" | "superseded" | null;
  alignment_job_error?: string | null;
  // Legacy format (optional)
  audio?: Array<{
    id: string;
    s3_bucket_key: string;
    audio_duration_sec?: number;
  }>;
}

interface Language {
  id: string;
  name: string;
}

interface Props {
  numbers: Number[];
  isLoading: boolean;
  selectedNumbers: string[];
  allVisibleNumbersSelected: boolean;
  onToggleSelect: (numberId: string) => void;
  onToggleSelectAll: () => void;
  onEdit: (number: Number) => void;
  onDelete: (id: string) => void;
  onRegenerateAudio?: (number: Number) => void;
  onRequeueAlignment?: (number: Number) => void;
  languages: Language[];
}

const NumbersDataTable: React.FC<Props> = ({ 
  numbers, 
  isLoading, 
  selectedNumbers,
  allVisibleNumbersSelected,
  onToggleSelect,
  onToggleSelectAll,
  onEdit, 
  onDelete,
  onRegenerateAudio,
  onRequeueAlignment,
  languages 
}) => {
  const isRegenerationPending = (status?: string | null) => status === "queued" || status === "processing";

  const renderAlignmentBadge = (status?: Number["alignment_status"]) => {
    if (!status) return null;
    const classes: Record<string, string> = {
      draft: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
      reviewed: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
      approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
      stale: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${classes[status] || classes.draft}`}>
        Align {status}
      </span>
    );
  };

  const renderAlignmentJobBadge = (status?: Number["alignment_job_status"], error?: string | null) => {
    if (!status) return null;
    const classes: Record<string, string> = {
      queued: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
      processing: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
      completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
      failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
      cancelled: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
      superseded: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    };
    return (
      <span title={status === "failed" ? error || "Alignment failed" : `Alignment ${status}`} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${classes[status] || classes.queued}`}>
        Job {status}
      </span>
    );
  };

  const getLanguageName = (languageId: string) => {
    const lang = languages.find((l) => l.id === languageId);
    return lang?.name || "Unknown";
  };

  const getDifficultyBadge = (level: number) => {
    const colors = {
      1: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      2: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      3: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      4: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
      5: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    };
    return colors[level as keyof typeof colors] || colors[3];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (numbers.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <FiHash className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600 dark:text-gray-400">No numbers found</p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
          Try adjusting your filters or add new numbers
        </p>
      </div>
    );
  }

  return (
    <>
    {/* Desktop Table View */}
    <div className="hidden lg:block overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
      <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-800 dark:text-gray-400">
          <tr>
            <th scope="col" className="px-4 py-3">
              <input
                type="checkbox"
                checked={allVisibleNumbersSelected}
                onChange={onToggleSelectAll}
                className="h-4 w-4 rounded border-gray-300 text-brand-600"
                aria-label="Select all visible numbers"
              />
            </th>
            <th scope="col" className="px-6 py-3">Value</th>
            <th scope="col" className="px-6 py-3">Word</th>
            <th scope="col" className="px-6 py-3">Language</th>
            <th scope="col" className="px-6 py-3">Type</th>
            <th scope="col" className="px-6 py-3">System</th>
            <th scope="col" className="px-6 py-3">Difficulty</th>
            <th scope="col" className="px-6 py-3">Compound</th>
            <th scope="col" className="px-6 py-3">Alignment</th>
            <th scope="col" className="px-6 py-3">Audio</th>
            <th scope="col" className="px-6 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {numbers.map((number) => (
            <tr
              key={number.id}
              className="bg-white border-b dark:bg-gray-900 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <td className="px-4 py-4">
                <input
                  type="checkbox"
                  checked={selectedNumbers.includes(number.id)}
                  disabled={isRegenerationPending(number.last_regeneration_status)}
                  onChange={() => onToggleSelect(number.id)}
                  className="h-4 w-4 rounded border-gray-300 text-brand-600 disabled:opacity-40"
                  aria-label={`Select number ${number.word}`}
                />
              </td>
              {/* Value */}
              <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                {number.number_value}
              </td>

              {/* Word */}
              <td className="px-6 py-4">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {number.word}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {number.word_normalized}
                  </div>
                </div>
              </td>

              {/* Language */}
              <td className="px-6 py-4">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-300">
                  {getLanguageName(number.language_id)}
                </span>
              </td>

              {/* Type */}
              <td className="px-6 py-4">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                  {number.number_type}
                </span>
              </td>

              {/* Number System */}
              <td className="px-6 py-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  number.number_system === 'vigesimal' 
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {number.number_system}
                </span>
              </td>

              {/* Difficulty */}
              <td className="px-6 py-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDifficultyBadge(number.difficulty_level)}`}>
                  Level {number.difficulty_level}
                </span>
              </td>

              {/* Compound */}
              <td className="px-6 py-4">
                {number.is_compound ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300">
                    Compound
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                    Simple
                  </span>
                )}
              </td>

              {/* Alignment */}
              <td className="px-6 py-4">
                <div className="flex flex-col gap-1">
                  {renderAlignmentBadge(number.alignment_status)}
                  {renderAlignmentJobBadge(number.alignment_job_status, number.alignment_job_error)}
                </div>
              </td>

              {/* Audio */}
              <td className="px-4 py-3">
                {(number.has_audio && number.audio_url) || (number.audio && number.audio.length > 0) ? (
                  <div className="min-w-[280px] max-w-md space-y-1.5">
                    <InlineAudioPlayer src={number.audio_url || number.audio![0].s3_bucket_key} size="md" />
                    {number.last_regeneration_status === "processing" && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                        Regenerating audio
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <span className="text-xs italic text-gray-400 dark:text-gray-500">
                      No audio
                    </span>
                    {number.last_regeneration_status === "queued" && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        Audio queued
                      </span>
                    )}
                  </div>
                )}
                {number.last_regeneration_status === "failed" && number.last_regeneration_error && (
                  <div
                    title={number.last_regeneration_error}
                    className="mt-1 text-xs text-red-600 dark:text-red-400 max-w-xs truncate"
                  >
                    Last regeneration failed
                  </div>
                )}
              </td>

              {/* Actions */}
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onRequeueAlignment?.(number)}
                    className="p-2 text-orange-600 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-300"
                    title="Requeue Alignment"
                  >
                    <FiRefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onRegenerateAudio?.(number)}
                    disabled={isRegenerationPending(number.last_regeneration_status)}
                    className="p-2 text-emerald-600 hover:text-emerald-900 disabled:opacity-40 disabled:cursor-not-allowed dark:text-emerald-400 dark:hover:text-emerald-300"
                    title={isRegenerationPending(number.last_regeneration_status) ? "Audio regeneration in progress" : "Regenerate Audio"}
                  >
                    <FiVolume2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onEdit(number)}
                    className="p-2 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                    title="Edit"
                  >
                    <FiEdit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(number.id)}
                    className="p-2 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    title="Delete"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Mobile Grid View */}
    <div className="lg:hidden grid grid-cols-1 gap-4">
      {numbers.map((number) => (
        <div
          key={number.id}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
        >
          <div className="mb-3">
            <input
              type="checkbox"
              checked={selectedNumbers.includes(number.id)}
              disabled={isRegenerationPending(number.last_regeneration_status)}
              onChange={() => onToggleSelect(number.id)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 disabled:opacity-40"
              aria-label={`Select number ${number.word}`}
            />
          </div>
          {/* Number Value */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FiHash className="text-gray-400" size={20} />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {number.number_value}
              </span>
            </div>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDifficultyBadge(number.difficulty_level)}`}>
              Level {number.difficulty_level}
            </span>
          </div>

          {/* Word */}
          <div className="mb-3">
            <div className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              {number.word}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {number.word_normalized}
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-300">
              {getLanguageName(number.language_id)}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
              {number.number_type}
            </span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              number.number_system === 'vigesimal' 
                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
            }`}>
              {number.number_system}
            </span>
            {number.is_compound ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300">
                Compound
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                Simple
              </span>
            )}
          </div>

          {/* Audio */}
          {((number.has_audio && number.audio_url) || (number.audio && number.audio.length > 0)) && (
            <div className="mb-3">
              <InlineAudioPlayer src={number.audio_url || number.audio![0].s3_bucket_key} size="md" />
            </div>
          )}

          {(number.alignment_status || number.alignment_job_status) && (
            <div className="mb-3 flex flex-wrap gap-2">
              {renderAlignmentBadge(number.alignment_status)}
              {renderAlignmentJobBadge(number.alignment_job_status, number.alignment_job_error)}
            </div>
          )}

          {number.last_regeneration_status === "failed" && number.last_regeneration_error && (
            <div className="mb-3 text-xs text-red-600 dark:text-red-400">
              Last regeneration failed: {number.last_regeneration_error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 border-t border-gray-200 dark:border-gray-700 pt-3">
            <button
              onClick={() => onRequeueAlignment?.(number)}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:hover:bg-orange-900/30 rounded-lg transition-colors"
            >
              <FiRefreshCw className="w-4 h-4" />
              Align
            </button>
            <button
              onClick={() => onRegenerateAudio?.(number)}
              disabled={isRegenerationPending(number.last_regeneration_status)}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
            >
              <FiVolume2 className="w-4 h-4" />
              Audio
            </button>
            <button
              onClick={() => onEdit(number)}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
            >
              <FiEdit className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={() => onDelete(number.id)}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors"
            >
              <FiTrash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
    </>
  );
};

export default NumbersDataTable;

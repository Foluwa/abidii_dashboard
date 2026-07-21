import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";
import Badge from "../ui/badge/Badge";
import { FiTrash2, FiVolume2, FiSearch, FiFilter, FiEye } from "react-icons/fi";
import { ConfirmationModal } from "../ui/modal/ConfirmationModal";
import InlineAudioPlayer from "@/components/ui/audio/InlineAudioPlayer";

interface Word {
  id: string;
  headword?: string;
  word: string;
  lemma_normalized: string;
  pos: string;
  source_language_id?: string;
  language_id: string;
  source_language_name?: string | null;
  source_language_code?: string | null;
  language_name?: string | null;
  language_code?: string | null;
  primary_glosses?: Array<{
    id: string;
    text: string;
    gloss_index: number;
    language_id: string;
    language_name?: string | null;
    language_code?: string | null;
  }>;
  target_languages?: Array<{
    language_id: string;
    language_name?: string | null;
    language_code?: string | null;
  }>;
  translation_count?: number;
  primary_translation?: string | null;
  audio_key: string | null;
  audio_url?: string | null;
  audio_duration_sec: number | null;
  category: string | null;
  difficulty_level: number | null;
  usage_notes: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

interface WordsDataTableProps {
  words: Word[];
  isLoading: boolean;
  onDelete: (wordId: string) => void;
  onSearch: (query: string) => void;
  searchQuery: string;
  selectedWords?: string[];
  onSelectWord?: (wordId: string) => void;
  onSelectAll?: () => void;
  onRegenerateAudio?: (wordId: string) => void;
  onViewDetails?: (wordId: string) => void;
}

export default function WordsDataTable({
  words,
  isLoading,
  onDelete,
  onSearch,
  searchQuery,
  selectedWords = [],
  onSelectWord,
  onSelectAll,
  onRegenerateAudio,
  onViewDetails,
}: WordsDataTableProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; word: string } | null>(null);
  const [regeneratingAudio, setRegeneratingAudio] = useState<string | null>(null);

  const getDifficultyBadge = (level: number | null) => {
    if (!level) return null;
    const colors: Record<number, "success" | "info" | "warning" | "error"> = {
      1: "success",
      2: "success",
      3: "info",
      4: "warning",
      5: "error",
    };
    return (
      <Badge size="sm" color={colors[level] || "info"}>
        Level {level}
      </Badge>
    );
  };

  const getPOSBadge = (pos: string) => {
    const posColors: Record<string, string> = {
      noun: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      verb: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      adj: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
      adv: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
      pron: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
    };

    const colorClass = posColors[pos] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400";

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
        {pos.toUpperCase()}
      </span>
    );
  };

  const renderGlosses = (word: Word) => {
    const glosses = word.primary_glosses ?? [];
    if (!glosses.length) {
      return (
        <span className="text-xs italic text-gray-400 dark:text-gray-500">
          No translations yet
        </span>
      );
    }

    const visible = glosses.slice(0, 3);
    const remaining = Math.max((word.translation_count ?? glosses.length) - visible.length, 0);

    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {visible.map((gloss) => (
          <span
            key={gloss.id}
            className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            {gloss.text}
            {gloss.language_code ? (
              <span className="ml-1 text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {gloss.language_code}
              </span>
            ) : null}
          </span>
        ))}
        {remaining > 0 ? (
          <span className="text-xs text-gray-500 dark:text-gray-400">+{remaining} more</span>
        ) : null}
      </div>
    );
  };

  const getPrimaryTranslation = (word: Word) => {
    if (word.primary_translation) return word.primary_translation;
    return word.primary_glosses?.[0]?.text ?? null;
  };

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="flex items-center justify-center p-12">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-brand-600 dark:border-gray-700 dark:border-t-brand-500"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading lexicon entries...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    {/* Desktop Table View */}
    <div className="hidden lg:block overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
      {/* Search Bar */}
      <div className="border-b border-gray-100 bg-gray-50/50 px-5 py-4 dark:border-white/[0.05] dark:bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <FiSearch className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search headwords or translations..."
              className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
            />
          </div>
          <button className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800">
            <FiFilter className="h-4 w-4" />
            Filter
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="max-w-full overflow-x-auto">
        <div className="min-w-[1000px]">
          <Table>
            {/* Table Header */}
            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
              <TableRow>
                {onSelectAll && (
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 w-12"
                  >
                    <input
                      type="checkbox"
                      checked={selectedWords.length === words.length && words.length > 0}
                      onChange={onSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                    />
                  </TableCell>
                )}
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Word
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Part of Speech
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Translations
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Difficulty
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Status
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Audio
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-end text-theme-xs dark:text-gray-400"
                >
                  Actions
                </TableCell>
              </TableRow>
            </TableHeader>

            {/* Table Body */}
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {words && words.length > 0 ? (
                words.map((word) => (
                  <TableRow
                    key={word.id}
                    className="transition-colors hover:bg-gray-50/50 dark:hover:bg-white/[0.02]"
                  >
                    {/* Checkbox Column */}
                    {onSelectWord && (
                      <TableCell className="px-5 py-4 text-start w-12">
                        <input
                          type="checkbox"
                          checked={selectedWords.includes(word.id)}
                          onChange={() => onSelectWord(word.id)}
                          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                        />
                      </TableCell>
                    )}
                    {/* Word Column — Yoruba (what a learner sees) is the
                        headline, English lemma is the caption underneath.
                        Same pattern as the mobile dictionary screens. */}
                    <TableCell className="px-5 py-4 text-start">
                      <div className="flex flex-col gap-1">
                        <span className="text-lg font-semibold text-gray-900 dark:text-white">
                          {getPrimaryTranslation(word) || (
                            <span className="italic text-gray-400 dark:text-gray-500">
                              No translation
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {word.headword || word.word}
                          {(word.source_language_code || word.language_code) ? ` (${word.source_language_code || word.language_code})` : ''}
                        </span>
                        {word.lemma_normalized !== (word.headword || word.word).toLowerCase() && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Normalized: {word.lemma_normalized}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Part of Speech */}
                    <TableCell className="px-4 py-3 text-start">
                      {getPOSBadge(word.pos)}
                    </TableCell>

                    {/* Translations */}
                    <TableCell className="px-4 py-3 text-start">
                      <div className="max-w-md space-y-2">
                        {renderGlosses(word)}
                        {word.target_languages?.length ? (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Targets: {word.target_languages.map((lang) => lang.language_code || lang.language_name || 'unknown').join(', ')}
                          </div>
                        ) : null}
                      </div>
                    </TableCell>

                    {/* Difficulty */}
                    <TableCell className="px-4 py-3 text-start">
                      {word.difficulty_level ? (
                        getDifficultyBadge(word.difficulty_level)
                      ) : (
                        <span className="text-xs italic text-gray-400 dark:text-gray-500">
                          Not set
                        </span>
                      )}
                    </TableCell>

                    {/* Status */}
                    <TableCell className="px-4 py-3 text-start">
                      {word.is_published ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                          Draft
                        </span>
                      )}
                    </TableCell>

                    {/* Audio */}
                    <TableCell className="px-4 py-3 text-start">
                      {word.audio_url ? (
                        <div className="min-w-[280px] max-w-md">
                          <InlineAudioPlayer src={word.audio_url} size="md" />
                        </div>
                      ) : (
                        <span className="text-xs italic text-gray-400 dark:text-gray-500">
                          No audio
                        </span>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="px-4 py-3 text-end">
                      <div className="flex items-center justify-end gap-2">
                        {onViewDetails && (
                          <button
                            onClick={() => onViewDetails(word.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20"
                            title="View details"
                          >
                            <FiEye className="h-3.5 w-3.5" />
                            View
                          </button>
                        )}
                        {onRegenerateAudio && (
                          <button
                            onClick={() => {
                              setRegeneratingAudio(word.id);
                              onRegenerateAudio(word.id);
                              setTimeout(() => setRegeneratingAudio(null), 2000);
                            }}
                            disabled={regeneratingAudio === word.id}
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-purple-600 transition-colors hover:bg-purple-50 hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed dark:text-purple-400 dark:hover:bg-purple-900/20"
                            title="Regenerate audio"
                          >
                            <FiVolume2 className={`h-3.5 w-3.5 ${regeneratingAudio === word.id ? 'animate-pulse' : ''}`} />
                            {regeneratingAudio === word.id ? 'Regenerating...' : 'Audio'}
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteConfirm({ id: word.id, word: word.word })}
                          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          <FiTrash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <td
                    colSpan={9}
                    className="px-5 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <FiSearch className="h-12 w-12 text-gray-300 dark:text-gray-700" />
                      <p className="text-sm font-medium">No lexicon entries found</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        Try searching by headword or translation
                      </p>
                    </div>
                  </td>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm) {
            onDelete(deleteConfirm.id);
            setDeleteConfirm(null);
          }
        }}
        title="Delete Lexicon Entry"
        message={`Are you sure you want to delete "${deleteConfirm?.word}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>

    {/* Mobile Grid View */}
    <div className="lg:hidden">
      {/* Search Bar */}
      <div className="mb-4 rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] px-4 py-3">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <FiSearch className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search headwords or translations..."
            className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
          />
        </div>
      </div>

      {/* Grid Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12 rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-brand-600 dark:border-gray-700 dark:border-t-brand-500"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading lexicon entries...</p>
          </div>
        </div>
      ) : words && words.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {words.map((word) => (
            <div
              key={word.id}
              className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/[0.05] dark:bg-white/[0.03]"
            >
              {/* Word Header — Yoruba headline, English lemma as caption */}
              <div className="mb-3 flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl font-bold text-gray-900 dark:text-white">
                      {getPrimaryTranslation(word) || (
                        <span className="italic text-gray-400 dark:text-gray-500">
                          No translation
                        </span>
                      )}
                    </span>
                    {onSelectWord && (
                      <input
                        type="checkbox"
                        checked={selectedWords.includes(word.id)}
                        onChange={() => onSelectWord(word.id)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                      />
                    )}
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {word.headword || word.word}
                    {(word.source_language_code || word.language_code) ? ` (${word.source_language_code || word.language_code})` : ''}
                  </span>
                  {word.lemma_normalized !== (word.headword || word.word).toLowerCase() && (
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      Normalized: {word.lemma_normalized}
                    </span>
                  )}
                </div>
              </div>

              {/* Badges */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {getPOSBadge(word.pos)}
                {word.difficulty_level && getDifficultyBadge(word.difficulty_level)}
              </div>

              <div className="mb-3">
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  All Translations
                </div>
                {renderGlosses(word)}
              </div>

              {/* Category */}
              {word.category && (
                <div className="mb-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Category: </span>
                  <span className="text-sm text-gray-900 dark:text-white">{word.category}</span>
                </div>
              )}

              {/* Audio */}
              {word.audio_url && (
                <div className="mb-3">
                  <InlineAudioPlayer src={word.audio_url} size="md" />
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
                {onViewDetails && (
                  <button
                    onClick={() => onViewDetails(word.id)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                  >
                    <FiEye className="h-3.5 w-3.5" />
                    View
                  </button>
                )}
                {onRegenerateAudio && (
                  <button
                    onClick={() => {
                      setRegeneratingAudio(word.id);
                      onRegenerateAudio(word.id);
                      setTimeout(() => setRegeneratingAudio(null), 2000);
                    }}
                    disabled={regeneratingAudio === word.id}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-purple-600 transition-colors hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed dark:text-purple-400 dark:hover:bg-purple-900/20"
                  >
                    <FiVolume2 className={`h-3.5 w-3.5 ${regeneratingAudio === word.id ? 'animate-pulse' : ''}`} />
                    Audio
                  </button>
                )}
                <button
                  onClick={() => setDeleteConfirm({ id: word.id, word: word.word })}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <FiTrash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-12 dark:border-white/[0.05] dark:bg-white/[0.03]">
          <FiSearch className="h-12 w-12 text-gray-300 dark:text-gray-700" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No lexicon entries found</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Try adjusting your search or filters
          </p>
        </div>
      )}
    </div>
    </>
  );
}

"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useLanguages } from "@/hooks/useApi";
import { apiClient } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import {
  ContentPageHeader,
  ContentStatsCard,
  ContentStatsGrid,
  ContentFiltersCard,
  ActiveFilterChips,
  StickyBulkActionBar,
} from '@/components/admin/layout';
import Alert from "@/components/ui/alert/Alert";
import { StyledSelect } from "@/components/ui/form/StyledSelect";
import { Modal } from "@/components/ui/modal";
import { ConfirmationModal } from "@/components/ui/modal/ConfirmationModal";
import { AudioWaveform } from "@/components/ui/audio/AudioWaveform";
import InlineAudioPlayer from "@/components/ui/audio/InlineAudioPlayer";
import { RegenerateAudioModal } from "@/components/modals/RegenerateAudioModal";
import { GoogleSheetsBulkImport } from "@/components/admin/GoogleSheetsBulkImport";
import { scheduleQueuedAudioRefresh } from "@/lib/audioRegeneration";
import { createTimePhraseJob, type AdminJob } from "@/lib/adminJobsApi";
import { useAdminJob } from "@/hooks/useAdminJob";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Pagination from "@/components/tables/Pagination";
import { FiClock, FiTrash2, FiEdit2, FiVolume2, FiChevronDown, FiChevronUp, FiCheckSquare, FiSquare, FiBarChart2, FiCheckCircle, FiGitMerge, FiGlobe } from "react-icons/fi";

interface TimePhrase {
  id: string;
  language_id: string;
  phrase: string;
  translation: string;
  romanization?: string;
  difficulty_level?: number;
  category?: string;
  tags: string[];
  usage_context?: string;
  is_published: boolean;
  audio_url?: string;
  alignment_status?: string | null;
  alignment_updated_at?: string | null;
  alignment_stale_reason?: string | null;
  alignment_job_status?: AlignmentJobStatus | null;
  alignment_job_provider?: string | null;
  alignment_job_engine?: string | null;
  alignment_job_error?: string | null;
  alignment_job_updated_at?: string | null;
  last_regeneration_status?: string | null;
  last_regeneration_error?: string | null;
  created_at: string;
  updated_at: string;
}

function parseTimeValue(translation: string): number {
  const match = translation.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

type AlignmentStatus = "draft" | "reviewed" | "approved" | "stale";
type AlignmentJobStatus = "queued" | "processing" | "completed" | "failed" | "cancelled" | "superseded";

interface PhraseAlignmentSegment {
  segment_id: string;
  text: string;
  start_ms: number;
  end_ms: number;
}

interface PhraseAlignmentWord {
  word: string;
  start_ms: number;
  end_ms: number;
}

interface PhraseAlignment {
  id: string;
  content_type: string;
  content_id: string;
  audio_url: string;
  transcript_display: string;
  status: AlignmentStatus;
  source?: string | null;
  provider_used?: string | null;
  engine_used?: string | null;
  confidence?: number | null;
  version: number;
  word_timing_reliable: boolean;
  approved_at?: string | null;
  stale_at?: string | null;
  stale_reason?: string | null;
  updated_at: string;
  alignment_json: {
    segments: PhraseAlignmentSegment[];
    words: PhraseAlignmentWord[];
  };
}

const DEFAULT_WORD_ALIGNMENT_CONFIDENCE = 0.85;
const DEFAULT_WORD_SNAP_STEP_MS = 25;
const WORD_SNAP_STEP_OPTIONS = [10, 25, 50, 100];

const createDefaultAlignmentSegment = (text: string): PhraseAlignmentSegment => ({
  segment_id: "segment-1",
  text,
  start_ms: 0,
  end_ms: 0,
});

const createDefaultAlignmentWord = (): PhraseAlignmentWord => ({
  word: "",
  start_ms: 0,
  end_ms: 0,
});

const tokenizePhraseWords = (text: string): string[] => text.trim().split(/\s+/).filter(Boolean);

const seedAlignmentWords = (
  text: string,
  segment: PhraseAlignmentSegment,
  existingWords: PhraseAlignmentWord[] = []
): PhraseAlignmentWord[] => {
  const tokens = tokenizePhraseWords(text);
  if (tokens.length === 0) {
    return [];
  }

  if (existingWords.length === tokens.length) {
    return tokens.map((word, index) => ({
      word,
      start_ms: existingWords[index].start_ms,
      end_ms: existingWords[index].end_ms,
    }));
  }

  const duration = Math.max(segment.end_ms - segment.start_ms, tokens.length);
  return tokens.map((word, index) => {
    const start_ms = segment.start_ms + Math.floor((duration * index) / tokens.length);
    const computedEnd = segment.start_ms + Math.floor((duration * (index + 1)) / tokens.length);
    return {
      word,
      start_ms,
      end_ms: Math.max(start_ms + 1, computedEnd),
    };
  });
};

const clampMs = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const spreadWordsAcrossSegment = (
  words: PhraseAlignmentWord[],
  segment: PhraseAlignmentSegment,
): PhraseAlignmentWord[] => {
  const tokens = words.map((word) => word.word.trim()).filter(Boolean);
  if (tokens.length === 0) {
    return [];
  }

  const duration = Math.max(segment.end_ms - segment.start_ms, tokens.length);
  return tokens.map((word, index) => {
    const start_ms = segment.start_ms + Math.floor((duration * index) / tokens.length);
    const computedEnd = segment.start_ms + Math.floor((duration * (index + 1)) / tokens.length);
    return {
      word,
      start_ms,
      end_ms: Math.max(start_ms + 1, computedEnd),
    };
  });
};

function formatErrorMessage(error: any, fallbackMessage: string) {
  const detail = error?.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail) && detail.length > 0) {
    const firstError = detail[0];
    if (typeof firstError === "string") {
      return firstError;
    }
    return firstError?.msg || firstError?.message || JSON.stringify(firstError);
  }

  if (typeof detail === "object" && detail !== null) {
    return detail.msg || detail.message || JSON.stringify(detail);
  }

  return error?.message || fallbackMessage;
}

function renderAlignmentBadge(phrase: TimePhrase) {
  if (!phrase.alignment_status) {
    return null;
  }

  const statusClasses = {
    draft: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    reviewed: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
    approved: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
    stale: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  };

  const status = phrase.alignment_status as AlignmentStatus;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClasses[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)} Alignment
    </span>
  );
}

function renderAlignmentJobBadge(phrase: TimePhrase) {
  if (!phrase.alignment_job_status) {
    return null;
  }

  const statusClasses = {
    queued: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    processing: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
    completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
    cancelled: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    superseded: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  };

  const label = phrase.alignment_job_status.charAt(0).toUpperCase() + phrase.alignment_job_status.slice(1);
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClasses[phrase.alignment_job_status]}`}>
      Align {label}
    </span>
  );
}

function renderRegenerationBadge(status?: string | null, error?: string | null) {
  if (!status) {
    return null;
  }

  if (status === "queued") {
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Audio queued</span>;
  }

  if (status === "processing") {
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">Audio processing</span>;
  }

  if (status !== "failed") {
    return null;
  }

  return (
    <span
      title={error || "The latest audio regeneration attempt failed."}
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
    >
      Last regeneration failed
    </span>
  );
}

export default function TimePhrasesPage() {
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { languages } = useLanguages();

  // Basic state
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");
  const [timePhrases, setTimePhrases] = useState<TimePhrase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingPhrase, setEditingPhrase] = useState<TimePhrase | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; phrase: string } | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(50);

  // Filter state
  const [search, setSearch] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<number | undefined>(undefined);
  const [publishedFilter, setPublishedFilter] = useState<boolean | undefined>(undefined);
  const [alignmentFilter, setAlignmentFilter] = useState<string | undefined>(undefined);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Advanced filters
  const [hasAudio, setHasAudio] = useState<boolean | undefined>(undefined);
  const [startsWithFilter, setStartsWithFilter] = useState("");
  const [endsWithFilter, setEndsWithFilter] = useState("");
  const [containsFilter, setContainsFilter] = useState("");
  const [sortBy, setSortBy] = useState<'phrase' | 'translation' | 'created_at' | 'updated_at' | 'time'>('time');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Bulk operations
  const [selectedPhrases, setSelectedPhrases] = useState<string[]>([]);
  const [isBulkRegenerating, setIsBulkRegenerating] = useState(false);
  const [timePhraseAdminJob, setTimePhraseAdminJob] = useState<AdminJob | null>(null);
  const [timePhraseJobLoading, setTimePhraseJobLoading] = useState(false);
  const [timePhraseApplyConfirm, setTimePhraseApplyConfirm] = useState<"audio" | "alignment" | null>(null);
  const [showJobsAccordion, setShowJobsAccordion] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [regeneratingPhrase, setRegeneratingPhrase] = useState<TimePhrase | null>(null);
  const [alignmentRecord, setAlignmentRecord] = useState<PhraseAlignment | null>(null);
  const [alignmentStatus, setAlignmentStatus] = useState<AlignmentStatus>("draft");
  const [alignmentSegment, setAlignmentSegment] = useState<PhraseAlignmentSegment>(createDefaultAlignmentSegment(""));
  const [alignmentWords, setAlignmentWords] = useState<PhraseAlignmentWord[]>([]);
  const [alignmentConfidence, setAlignmentConfidence] = useState(DEFAULT_WORD_ALIGNMENT_CONFIDENCE);
  const [wordSnapStepMs, setWordSnapStepMs] = useState(DEFAULT_WORD_SNAP_STEP_MS);
  const [wordTimingsEnabled, setWordTimingsEnabled] = useState(false);
  const [resolvedAudioDurationMs, setResolvedAudioDurationMs] = useState<number | null>(null);
  const [previewingWordIndex, setPreviewingWordIndex] = useState<number | null>(null);
  const [alignmentLoading, setAlignmentLoading] = useState(false);
  const [alignmentSaving, setAlignmentSaving] = useState(false);
  const [alignmentError, setAlignmentError] = useState("");
  const wordPreviewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    language_id: "",
    phrase: "",
    translation: "",
    romanization: "",
    difficulty_level: 1,
    tags: "time",
    usage_context: "",
    is_published: false,
    audio_url: "",
  });

  const trackedTimePhraseAdminJob = useAdminJob(timePhraseAdminJob?.id);
  const currentTimePhraseAdminJob = trackedTimePhraseAdminJob.job ?? timePhraseAdminJob;

  // Initialize filters from URL params
  useEffect(() => {
    const langId = searchParams.get('language_id');
    const searchQ = searchParams.get('search');
    const pageP = searchParams.get('page');
    const limitP = searchParams.get('limit');
    const difficultyP = searchParams.get('difficulty');
    const publishedP = searchParams.get('is_published');
    const alignmentP = searchParams.get('alignment_status');
    const hasAudioP = searchParams.get('has_audio');
    const startsP = searchParams.get('starts_with');
    const endsP = searchParams.get('ends_with');
    const containsP = searchParams.get('contains');
    const sortByP = searchParams.get('sort_by');
    const sortDirP = searchParams.get('sort_dir');

    if (langId) setSelectedLanguage(langId);
    if (searchQ) setSearch(searchQ);
    if (pageP) setPage(Number(pageP));
    if (limitP) setLimit(Number(limitP));
    if (difficultyP) setDifficultyFilter(Number(difficultyP));
    if (publishedP) setPublishedFilter(publishedP === 'true');
    if (alignmentP) setAlignmentFilter(alignmentP);
    if (hasAudioP) setHasAudio(hasAudioP === 'true');
    if (startsP) setStartsWithFilter(startsP);
    if (endsP) setEndsWithFilter(endsP);
    if (containsP) setContainsFilter(containsP);
    if (sortByP) setSortBy(sortByP as any);
    if (sortDirP) setSortDir(sortDirP as any);

    // Auto-expand if any advanced filters are active
    if (hasAudioP || startsP || endsP || containsP) {
      setShowAdvancedFilters(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!selectedLanguage && !searchParams.get("language_id") && languages && languages.length > 0) {
      setSelectedLanguage(languages[0].id);
    }
  }, [languages, searchParams, selectedLanguage]);

  // Update URL when filters change
  const updateURL = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedLanguage) params.set('language_id', selectedLanguage);
    if (search) params.set('search', search);
    if (page > 1) params.set('page', page.toString());
    if (limit !== 50) params.set('limit', limit.toString());
    if (difficultyFilter) params.set('difficulty', difficultyFilter.toString());
    if (publishedFilter !== undefined) params.set('is_published', publishedFilter.toString());
    if (alignmentFilter) params.set('alignment_status', alignmentFilter);
    if (hasAudio !== undefined) params.set('has_audio', hasAudio.toString());
    if (startsWithFilter) params.set('starts_with', startsWithFilter);
    if (endsWithFilter) params.set('ends_with', endsWithFilter);
    if (containsFilter) params.set('contains', containsFilter);
    if (sortBy !== 'time') params.set('sort_by', sortBy);
    if (sortDir !== 'asc') params.set('sort_dir', sortDir);

    const queryString = params.toString();
    router.replace(`${pathname}${queryString ? '?' + queryString : ''}`, { scroll: false });
  }, [selectedLanguage, search, page, limit, difficultyFilter, publishedFilter, alignmentFilter, hasAudio, startsWithFilter, endsWithFilter, containsFilter, sortBy, sortDir, router, pathname]);

  // Debounced URL update
  useEffect(() => {
    const timer = setTimeout(updateURL, 300);
    return () => clearTimeout(timer);
  }, [updateURL]);

  // Active filters
  const activeFilters = [] as { label: string; onClear: () => void }[];
  if (selectedLanguage) {
    const lang = languages?.find((l: any) => l.id === selectedLanguage);
    activeFilters.push({ label: `Language: ${lang?.name || selectedLanguage}`, onClear: () => { setSelectedLanguage(""); setPage(1); } });
  }
  if (search) activeFilters.push({ label: `Search: "${search}"`, onClear: () => { setSearch(""); setPage(1); } });
  if (difficultyFilter !== undefined) activeFilters.push({ label: `Difficulty: ${difficultyFilter}`, onClear: () => { setDifficultyFilter(undefined); setPage(1); } });
  if (publishedFilter !== undefined) activeFilters.push({ label: publishedFilter ? 'Status: Published' : 'Status: Draft', onClear: () => { setPublishedFilter(undefined); setPage(1); } });
  if (alignmentFilter) activeFilters.push({ label: `Alignment: ${alignmentFilter}`, onClear: () => { setAlignmentFilter(undefined); setPage(1); } });
  if (hasAudio !== undefined) activeFilters.push({ label: `Has Audio: ${hasAudio ? 'Yes' : 'No'}`, onClear: () => { setHasAudio(undefined); setPage(1); } });
  if (startsWithFilter) activeFilters.push({ label: `Starts With: "${startsWithFilter}"`, onClear: () => { setStartsWithFilter(""); setPage(1); } });
  if (endsWithFilter) activeFilters.push({ label: `Ends With: "${endsWithFilter}"`, onClear: () => { setEndsWithFilter(""); setPage(1); } });
  if (containsFilter) activeFilters.push({ label: `Contains: "${containsFilter}"`, onClear: () => { setContainsFilter(""); setPage(1); } });

  // Clear all filters
  const clearAllFilters = () => {
    setSearch("");
    setDifficultyFilter(undefined);
    setPublishedFilter(undefined);
    setAlignmentFilter(undefined);
    setHasAudio(undefined);
    setStartsWithFilter("");
    setEndsWithFilter("");
    setContainsFilter("");
    setSortBy('phrase');
    setSortDir('asc');
    setPage(1);
  };

  // Stats
  const stats = useMemo(() => {
    const ready = timePhrases.filter((p) => p.is_published).length;
    const withAudio = timePhrases.filter((p) => !!p.audio_url).length;
    const aligned = timePhrases.filter((p) => p.alignment_status === 'approved' || p.alignment_status === 'reviewed').length;
    return { total, ready, withAudio, aligned };
  }, [timePhrases, total]);

  useEffect(() => {
    if (selectedLanguage) {
      fetchTimePhrases();
    }
  }, [selectedLanguage, page, limit, search, difficultyFilter, publishedFilter, alignmentFilter, hasAudio, startsWithFilter, endsWithFilter, containsFilter, sortBy, sortDir]);

  const fetchTimePhrases = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        category: 'time',
        page: page.toString(),
        page_size: limit.toString(),
      });

      if (selectedLanguage) params.set('language_id', selectedLanguage);
      if (search) params.set('search', search);
      if (difficultyFilter) params.set('difficulty', difficultyFilter.toString());
      if (publishedFilter !== undefined) params.set('is_published', publishedFilter.toString());
      if (alignmentFilter) params.set('alignment_status', alignmentFilter);

      const response = await apiClient.get(`/api/v1/admin/content/phrases?${params.toString()}`);
      let items = response.data.items || [];

      // Apply client-side filters that backend doesn't support
      if (hasAudio !== undefined) {
        items = items.filter((p: TimePhrase) => hasAudio ? !!p.audio_url : !p.audio_url);
      }
      if (startsWithFilter) {
        items = items.filter((p: TimePhrase) => 
          p.phrase.toLowerCase().startsWith(startsWithFilter.toLowerCase())
        );
      }
      if (endsWithFilter) {
        items = items.filter((p: TimePhrase) => 
          p.phrase.toLowerCase().endsWith(endsWithFilter.toLowerCase())
        );
      }
      if (containsFilter) {
        items = items.filter((p: TimePhrase) => 
          p.phrase.toLowerCase().includes(containsFilter.toLowerCase())
        );
      }

      // Apply sorting
      items.sort((a: TimePhrase, b: TimePhrase) => {
        let comparison = 0;
        switch (sortBy) {
          case 'phrase':
            comparison = a.phrase.localeCompare(b.phrase);
            break;
          case 'translation':
            comparison = a.translation.localeCompare(b.translation);
            break;
          case 'time':
            comparison = (parseTimeValue(a.translation) || 0) - (parseTimeValue(b.translation) || 0);
            break;
          case 'created_at':
            comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            break;
          case 'updated_at':
            comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
            break;
        }
        return sortDir === 'asc' ? comparison : -comparison;
      });

      setTimePhrases(items);
      setTotal(response.data.total || 0);
      setTotalPages(Math.ceil((response.data.total || 0) / limit));
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load time phrases");
      toast.error("Failed to load time phrases");
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingPhrase(null);
    setAlignmentRecord(null);
    setAlignmentStatus("draft");
    setAlignmentSegment(createDefaultAlignmentSegment(""));
    setAlignmentWords([]);
    setAlignmentConfidence(DEFAULT_WORD_ALIGNMENT_CONFIDENCE);
    setWordSnapStepMs(DEFAULT_WORD_SNAP_STEP_MS);
    setWordTimingsEnabled(false);
    setResolvedAudioDurationMs(null);
    setPreviewingWordIndex(null);
    setAlignmentError("");
    setFormData({
      language_id: selectedLanguage,
      phrase: "",
      translation: "",
      romanization: "",
      difficulty_level: 1,
      tags: "time",
      usage_context: "",
      is_published: false,
      audio_url: "",
    });
    setShowModal(true);
  };

  const loadAlignment = async (phrase: TimePhrase) => {
    setAlignmentLoading(true);
    setAlignmentError("");
    try {
      const response = await apiClient.get<PhraseAlignment>(`/api/v1/admin/content/phrases/${phrase.id}/alignment`);
      const alignment = response.data;
      const firstSegment = alignment.alignment_json.segments[0] || createDefaultAlignmentSegment(phrase.phrase);
      const words = alignment.alignment_json.words || [];
      setAlignmentRecord(alignment);
      setAlignmentStatus(alignment.status);
      setAlignmentSegment({
        segment_id: firstSegment.segment_id || "segment-1",
        text: phrase.phrase,
        start_ms: firstSegment.start_ms,
        end_ms: firstSegment.end_ms,
      });
      setAlignmentWords(words);
      setAlignmentConfidence(alignment.confidence ?? DEFAULT_WORD_ALIGNMENT_CONFIDENCE);
      setWordTimingsEnabled(words.length > 0);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setAlignmentRecord(null);
        setAlignmentStatus("draft");
        setAlignmentSegment(createDefaultAlignmentSegment(phrase.phrase));
        setAlignmentWords([]);
        setAlignmentConfidence(DEFAULT_WORD_ALIGNMENT_CONFIDENCE);
        setWordTimingsEnabled(false);
      } else {
        setAlignmentError(formatErrorMessage(err, "Failed to load phrase alignment"));
      }
    } finally {
      setAlignmentLoading(false);
    }
  };

  const openEditModal = async (phrase: TimePhrase) => {
    setEditingPhrase(phrase);
    setFormData({
      language_id: phrase.language_id,
      phrase: phrase.phrase,
      translation: phrase.translation,
      romanization: phrase.romanization || "",
      difficulty_level: phrase.difficulty_level || 1,
      tags: phrase.tags.join(", "),
      usage_context: phrase.usage_context || "",
      is_published: phrase.is_published,
      audio_url: phrase.audio_url || "",
    });
    setAlignmentRecord(null);
    setAlignmentStatus("draft");
    setAlignmentSegment(createDefaultAlignmentSegment(phrase.phrase));
    setAlignmentWords([]);
    setAlignmentConfidence(DEFAULT_WORD_ALIGNMENT_CONFIDENCE);
    setWordSnapStepMs(DEFAULT_WORD_SNAP_STEP_MS);
    setWordTimingsEnabled(false);
    setResolvedAudioDurationMs(null);
    setPreviewingWordIndex(null);
    setAlignmentError("");
    setShowModal(true);
    await loadAlignment(phrase);
  };

  const closeModal = () => {
    const audio = wordPreviewAudioRef.current;
    if (audio) {
      audio.pause();
      audio.src = "";
      wordPreviewAudioRef.current = null;
    }

    setShowModal(false);
    setEditingPhrase(null);
    setError("");
    setAlignmentRecord(null);
    setAlignmentWords([]);
    setAlignmentConfidence(DEFAULT_WORD_ALIGNMENT_CONFIDENCE);
    setWordTimingsEnabled(false);
    setResolvedAudioDurationMs(null);
    setPreviewingWordIndex(null);
    setAlignmentError("");
  };

  const validateAlignmentWords = () => {
    if (!wordTimingsEnabled) {
      return null;
    }

    for (const word of alignmentWords) {
      if (!word.word.trim()) {
        return "Each word timing needs text before it can be saved";
      }
      if (word.end_ms <= word.start_ms) {
        return `Word "${word.word}" has an end time that is not after its start time`;
      }
      if (word.start_ms < alignmentSegment.start_ms || word.end_ms > alignmentSegment.end_ms) {
        return `Word "${word.word}" must stay inside the segment window`;
      }
    }

    for (let index = 1; index < alignmentWords.length; index += 1) {
      if (alignmentWords[index].start_ms < alignmentWords[index - 1].end_ms) {
        return `Word timings overlap between "${alignmentWords[index - 1].word}" and "${alignmentWords[index].word}"`;
      }
    }

    return null;
  };

  const resolveAudioDurationMs = useCallback(async () => {
    if (resolvedAudioDurationMs && resolvedAudioDurationMs > 0) {
      return resolvedAudioDurationMs;
    }

    const audioUrl = formData.audio_url.trim();
    if (!audioUrl) {
      return null;
    }

    const durationMs = await new Promise<number | null>((resolve) => {
      const audio = new Audio();

      const cleanup = () => {
        audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
        audio.removeEventListener("error", handleError);
      };

      const handleLoadedMetadata = () => {
        cleanup();
        resolve(Number.isFinite(audio.duration) && audio.duration > 0 ? Math.round(audio.duration * 1000) : null);
      };

      const handleError = () => {
        cleanup();
        resolve(null);
      };

      audio.preload = "metadata";
      audio.addEventListener("loadedmetadata", handleLoadedMetadata);
      audio.addEventListener("error", handleError);
      audio.src = audioUrl;
    });

    if (durationMs && durationMs > 0) {
      setResolvedAudioDurationMs(durationMs);
    }

    return durationMs;
  }, [formData.audio_url, resolvedAudioDurationMs]);

  const ensureAlignmentWindow = async () => {
    if (alignmentSegment.end_ms > alignmentSegment.start_ms) {
      return alignmentSegment;
    }

    const durationMs = await resolveAudioDurationMs();
    if (!durationMs || durationMs <= 0) {
      setAlignmentError("Could not determine phrase audio duration automatically. Add or regenerate audio, then try again.");
      return null;
    }

    const safeStartMs = alignmentSegment.start_ms >= 0 && alignmentSegment.start_ms < durationMs
      ? alignmentSegment.start_ms
      : 0;
    const nextSegment = {
      ...alignmentSegment,
      start_ms: safeStartMs,
      end_ms: durationMs,
    };
    setAlignmentSegment(nextSegment);
    return nextSegment;
  };

  const stopWordPreview = useCallback(() => {
    const audio = wordPreviewAudioRef.current;
    if (audio) {
      audio.pause();
      audio.src = "";
      wordPreviewAudioRef.current = null;
    }
    setPreviewingWordIndex(null);
  }, []);

  const previewWordTiming = async (word: PhraseAlignmentWord, index: number) => {
    const audioUrl = formData.audio_url.trim();
    if (!audioUrl) {
      setAlignmentError("No phrase audio available for word preview");
      return;
    }

    if (previewingWordIndex === index) {
      stopWordPreview();
      return;
    }

    stopWordPreview();

    const audio = new Audio(audioUrl);
    const startSeconds = Math.max(0, word.start_ms / 1000);
    const endSeconds = Math.max(startSeconds + 0.01, word.end_ms / 1000);

    wordPreviewAudioRef.current = audio;
    setPreviewingWordIndex(index);
    setAlignmentError("");

    const cleanup = () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };

    const finishPlayback = () => {
      cleanup();
      if (wordPreviewAudioRef.current === audio) {
        audio.pause();
        audio.src = "";
        wordPreviewAudioRef.current = null;
      }
      setPreviewingWordIndex((current) => (current === index ? null : current));
    };

    const handleLoadedMetadata = async () => {
      try {
        audio.currentTime = startSeconds;
        await audio.play();
      } catch (playbackError) {
        console.error("Failed to preview time phrase word timing:", playbackError);
        setAlignmentError("Failed to play the selected word clip");
        finishPlayback();
      }
    };

    const handleTimeUpdate = () => {
      if (audio.currentTime >= endSeconds) {
        finishPlayback();
      }
    };

    const handleEnded = () => {
      finishPlayback();
    };

    const handleError = () => {
      setAlignmentError("Failed to load phrase audio for preview");
      finishPlayback();
    };

    audio.preload = "auto";
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.src = audioUrl;
  };

  useEffect(() => {
    setResolvedAudioDurationMs(null);
  }, [formData.audio_url]);

  useEffect(() => {
    if (!showModal || !editingPhrase || !formData.audio_url.trim()) {
      return;
    }
    if (alignmentSegment.end_ms > alignmentSegment.start_ms) {
      return;
    }

    let cancelled = false;

    void resolveAudioDurationMs().then((durationMs) => {
      if (cancelled || !durationMs || durationMs <= 0) {
        return;
      }

      setAlignmentSegment((current) => {
        if (current.end_ms > current.start_ms) {
          return current;
        }

        const safeStartMs = current.start_ms >= 0 && current.start_ms < durationMs
          ? current.start_ms
          : 0;
        return {
          ...current,
          start_ms: safeStartMs,
          end_ms: durationMs,
        };
      });
    });

    return () => {
      cancelled = true;
    };
  }, [showModal, editingPhrase, formData.audio_url, alignmentSegment.end_ms, alignmentSegment.start_ms, resolveAudioDurationMs]);

  useEffect(() => {
    return () => {
      stopWordPreview();
    };
  }, [stopWordPreview]);

  const syncWordsFromTranscript = async () => {
    const segment = await ensureAlignmentWindow();
    if (!segment) {
      return;
    }
    setAlignmentError("");
    setWordTimingsEnabled(true);
    setAlignmentWords(seedAlignmentWords(formData.phrase, segment, alignmentWords));
  };

  const addAlignmentWord = async () => {
    const segment = await ensureAlignmentWindow();
    if (!segment) {
      return;
    }

    setWordTimingsEnabled(true);
    setAlignmentWords((current) => {
      const fallbackStart = current.length > 0
        ? Math.min(current[current.length - 1].end_ms, segment.end_ms - 1)
        : segment.start_ms;

      return ([
        ...current,
        {
          ...createDefaultAlignmentWord(),
          start_ms: fallbackStart,
          end_ms: Math.min(segment.end_ms, fallbackStart + 100),
        },
      ]);
    });
  };

  const redistributeAlignmentWords = async () => {
    const segment = await ensureAlignmentWindow();
    if (!segment) {
      return;
    }
    setAlignmentError("");
    setWordTimingsEnabled(true);
    setAlignmentWords((current) => {
      const source = current.length > 0
        ? current
        : tokenizePhraseWords(formData.phrase).map((word) => ({ ...createDefaultAlignmentWord(), word }));
      return spreadWordsAcrossSegment(source, segment);
    });
  };

  const shiftAlignmentWord = (index: number, deltaMs: number) => {
    setAlignmentWords((current) => current.map((word, currentIndex) => {
      if (currentIndex !== index) {
        return word;
      }

      const duration = Math.max(1, word.end_ms - word.start_ms);
      const minStart = currentIndex === 0 ? alignmentSegment.start_ms : current[currentIndex - 1].end_ms;
      const maxEnd = currentIndex === current.length - 1 ? alignmentSegment.end_ms : current[currentIndex + 1].start_ms;
      const maxStart = Math.max(minStart, maxEnd - duration);
      const nextStart = clampMs(word.start_ms + deltaMs, minStart, maxStart);
      return {
        ...word,
        start_ms: nextStart,
        end_ms: Math.min(maxEnd, nextStart + duration),
      };
    }));
  };

  const expandAlignmentWord = (index: number, deltaMs: number, direction: "left" | "right") => {
    setAlignmentWords((current) => current.map((word, currentIndex) => {
      if (currentIndex !== index) {
        return word;
      }

      const minStart = currentIndex === 0 ? alignmentSegment.start_ms : current[currentIndex - 1].end_ms;
      const maxEnd = currentIndex === current.length - 1 ? alignmentSegment.end_ms : current[currentIndex + 1].start_ms;

      if (direction === "left") {
        const nextStart = Math.max(minStart, word.start_ms - deltaMs);
        return {
          ...word,
          start_ms: Math.min(nextStart, word.end_ms - 1),
        };
      }

      const nextEnd = Math.min(maxEnd, word.end_ms + deltaMs);
      return {
        ...word,
        end_ms: Math.max(word.start_ms + 1, nextEnd),
      };
    }));
  };

  const snapAlignmentWordEdge = (index: number, edge: "start" | "end") => {
    setAlignmentWords((current) => current.map((word, currentIndex) => {
      if (currentIndex !== index) {
        return word;
      }

      const minStart = currentIndex === 0 ? alignmentSegment.start_ms : current[currentIndex - 1].end_ms;
      const maxEnd = currentIndex === current.length - 1 ? alignmentSegment.end_ms : current[currentIndex + 1].start_ms;
      if (maxEnd <= minStart) {
        return word;
      }

      if (edge === "start") {
        return {
          ...word,
          start_ms: minStart,
          end_ms: Math.max(minStart + 1, word.end_ms),
        };
      }

      return {
        ...word,
        start_ms: Math.min(word.start_ms, maxEnd - 1),
        end_ms: maxEnd,
      };
    }));
  };

  const snapAlignmentWordToBounds = (index: number) => {
    setAlignmentWords((current) => current.map((word, currentIndex) => {
      if (currentIndex !== index) {
        return word;
      }

      const minStart = currentIndex === 0 ? alignmentSegment.start_ms : current[currentIndex - 1].end_ms;
      const maxEnd = currentIndex === current.length - 1 ? alignmentSegment.end_ms : current[currentIndex + 1].start_ms;
      if (maxEnd <= minStart) {
        return word;
      }

      return {
        ...word,
        start_ms: minStart,
        end_ms: Math.max(minStart + 1, maxEnd),
      };
    }));
  };

  const updateAlignmentWord = (index: number, field: keyof PhraseAlignmentWord, value: string | number) => {
    setAlignmentWords((current) => current.map((word, currentIndex) => (
      currentIndex === index
        ? { ...word, [field]: value }
        : word
    )));
  };

  const removeAlignmentWord = (index: number) => {
    setAlignmentWords((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const tags = formData.tags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t);
    if (!tags.includes("time")) {
      tags.push("time");
    }

    const payload = {
      ...formData,
      category: "time",
      tags,
      difficulty_level: Number(formData.difficulty_level),
      audio_url: formData.audio_url || undefined,
    };

    try {
      if (editingPhrase) {
        await apiClient.put(`/api/v1/admin/content/phrases/${editingPhrase.id}`, payload);
        toast.success("Time phrase updated successfully");
      } else {
        await apiClient.post("/api/v1/admin/content/phrases", payload);
        toast.success("Time phrase created successfully");
      }
      closeModal();
      fetchTimePhrases();
    } catch (err: any) {
      setError(formatErrorMessage(err, "Failed to save time phrase"));
      toast.error("Failed to save time phrase");
    }
  };

  const saveAlignment = async (status: AlignmentStatus) => {
    if (!editingPhrase) return;
    if (!formData.audio_url.trim()) {
      setAlignmentError("Add or regenerate audio before saving alignment timings");
      return;
    }
    if (alignmentSegment.end_ms <= alignmentSegment.start_ms) {
      setAlignmentError("Alignment end time must be greater than start time");
      return;
    }

    const wordValidationError = validateAlignmentWords();
    if (wordValidationError) {
      setAlignmentError(wordValidationError);
      return;
    }

    setAlignmentSaving(true);
    setAlignmentError("");
    try {
      const response = await apiClient.put<PhraseAlignment>(
        `/api/v1/admin/content/phrases/${editingPhrase.id}/alignment`,
        {
          audio_url: formData.audio_url,
          status,
          confidence: wordTimingsEnabled ? alignmentConfidence : null,
          segments: [
            {
              ...alignmentSegment,
              text: formData.phrase,
            },
          ],
          words: wordTimingsEnabled ? alignmentWords : [],
        }
      );
      setAlignmentRecord(response.data);
      setAlignmentStatus(response.data.status);
      setAlignmentWords(response.data.alignment_json.words || []);
      setAlignmentConfidence(response.data.confidence ?? DEFAULT_WORD_ALIGNMENT_CONFIDENCE);
      setWordTimingsEnabled((response.data.alignment_json.words || []).length > 0);
      fetchTimePhrases();
      toast.success(status === "reviewed" ? "Alignment saved for review" : "Alignment saved");
    } catch (err: any) {
      setAlignmentError(formatErrorMessage(err, "Failed to save alignment"));
    } finally {
      setAlignmentSaving(false);
    }
  };

  const approveAlignment = async () => {
    if (!editingPhrase) return;

    setAlignmentSaving(true);
    setAlignmentError("");
    try {
      const response = await apiClient.post<PhraseAlignment>(`/api/v1/admin/content/phrases/${editingPhrase.id}/alignment/approve`, {});
      setAlignmentRecord(response.data);
      setAlignmentStatus(response.data.status);
      setAlignmentWords(response.data.alignment_json.words || []);
      setAlignmentConfidence(response.data.confidence ?? DEFAULT_WORD_ALIGNMENT_CONFIDENCE);
      setWordTimingsEnabled((response.data.alignment_json.words || []).length > 0);
      fetchTimePhrases();
      toast.success("Alignment approved for mobile playback");
    } catch (err: any) {
      setAlignmentError(formatErrorMessage(err, "Failed to approve alignment"));
    } finally {
      setAlignmentSaving(false);
    }
  };

  const requeueAlignment = async () => {
    if (!editingPhrase) return;

    setAlignmentSaving(true);
    setAlignmentError("");
    try {
      await apiClient.post(`/api/v1/admin/content/phrases/${editingPhrase.id}/alignment/requeue`);
      setEditingPhrase((current) => current ? {
        ...current,
        alignment_job_status: "queued",
        alignment_job_provider: "openai",
        alignment_job_engine: "whisper-1",
        alignment_job_error: null,
        alignment_job_updated_at: new Date().toISOString(),
      } : current);
      fetchTimePhrases();
      toast.success("Auto-alignment requeued");
    } catch (err: any) {
      setAlignmentError(formatErrorMessage(err, "Failed to requeue alignment"));
    } finally {
      setAlignmentSaving(false);
    }
  };

  const renderAlignmentStatus = () => {
    const status = alignmentRecord?.status || alignmentStatus;
    const statusClasses = {
      draft: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
      reviewed: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
      approved: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
      stale: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
    };

    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/api/v1/admin/content/phrases/${id}`);
      toast.success("Time phrase deleted successfully");
      setDeleteConfirm(null);
      fetchTimePhrases();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to delete time phrase");
      toast.error("Failed to delete time phrase");
    }
  };

  const handleSelectAll = () => {
    if (selectedPhrases.length === timePhrases.length) {
      setSelectedPhrases([]);
    } else {
      setSelectedPhrases(timePhrases.map((p) => p.id));
    }
  };

  const handleSelectPhrase = (phraseId: string) => {
    setSelectedPhrases(prev => 
      prev.includes(phraseId) 
        ? prev.filter(id => id !== phraseId)
        : [...prev, phraseId]
    );
  };

  const handleBulkRegenerateAudio = async () => {
    if (selectedPhrases.length === 0) return;

    setIsBulkRegenerating(true);
    try {
      await apiClient.post("/api/v1/admin/content/phrases/bulk/regenerate-audio", {
        phrase_ids: selectedPhrases,
      });
      toast.success(`Queued audio regeneration for ${selectedPhrases.length} time phrase(s).`);
      setSelectedPhrases([]);
      await fetchTimePhrases();
      scheduleQueuedAudioRefresh(fetchTimePhrases);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const message = typeof detail === "string" ? detail : err?.message || "Failed to queue bulk regeneration";
      toast.error(message);
    } finally {
      setIsBulkRegenerating(false);
    }
  };

  const openRegenerateModal = (phrase: TimePhrase) => {
    const languageCode = languages?.find((l: any) => l.id === phrase.language_id)?.iso_639_3 || "yor";
    setRegeneratingPhrase(phrase);
    setShowRegenerateModal(true);
  };

  const queueTimePhraseAdminJob = async (
    jobType: "audio" | "alignment" | "readiness",
    dryRun: boolean,
  ) => {
    setTimePhraseJobLoading(true);
    try {
      const job = await createTimePhraseJob({
        job_type: jobType,
        dry_run: dryRun,
        limit,
      });
      setTimePhraseAdminJob(job);
      toast.success(dryRun ? `${jobType} preview queued` : `${jobType} job queued`);
    } catch (error: any) {
      toast.error(formatErrorMessage(error, `Failed to queue ${jobType} job`));
    } finally {
      setTimePhraseJobLoading(false);
      setTimePhraseApplyConfirm(null);
    }
  };

  return (
    <div className="space-y-6">
      <ContentPageHeader
        title="Time Phrases"
        subtitle="Manage time-telling phrases from yo_time spreadsheet"
        onAdd={openCreateModal}
        addLabel="Add Time Phrase"
      />

      <ContentStatsGrid cols={4}>
        <ContentStatsCard label="Total" value={stats.total} icon={FiBarChart2} />
        <ContentStatsCard label="Ready" value={stats.ready} icon={FiCheckCircle} iconBgClass="bg-green-100 dark:bg-green-900/20" iconTextClass="text-green-600 dark:text-green-400" />
        <ContentStatsCard label="Audio Generated" value={stats.withAudio} icon={FiVolume2} iconBgClass="bg-blue-100 dark:bg-blue-900/20" iconTextClass="text-blue-600 dark:text-blue-400" />
        <ContentStatsCard label="Aligned" value={stats.aligned} icon={FiGitMerge} iconBgClass="bg-purple-100 dark:bg-purple-900/20" iconTextClass="text-purple-600 dark:text-purple-400" />
      </ContentStatsGrid>

      {/* Bulk Import from Google Sheets */}
      {selectedLanguage && (
        <GoogleSheetsBulkImport
          contentType="phrases"
          onImportComplete={() => fetchTimePhrases()}
          defaultLanguageId={selectedLanguage}
          defaultWorksheetTitle="yo_time"
          expectedColumns={[
            { name: 'source_row_key', required: true, description: 'Stable spreadsheet row key', example: 'time_yor_0001' },
            { name: 'time_24h', required: false, description: '24-hour format (metadata)', example: '00:00' },
            { name: 'time_12h', required: false, description: '12-hour format (metadata)', example: '12:00 AM' },
            { name: 'phrase', required: true, description: 'Yoruba time phrase', example: 'Aago mejila òru' },
            { name: 'translation', required: true, description: 'English time', example: '12:00 AM' },
            { name: 'category', required: false, description: 'Category (should be "time")', example: 'time' },
            { name: 'difficulty_level', required: false, description: 'Difficulty 1-5', example: '2' },
            { name: 'is_published', required: false, description: 'Published status', example: 'false' },
            { name: 'review_status', required: false, description: 'Editorial review status', example: 'approved' },
          ]}
        />
      )}

      {selectedLanguage && (
        <ContentFiltersCard
          activeFilterCount={activeFilters.length}
          onClearAll={clearAllFilters}
          showAdvanced={showAdvancedFilters}
          onToggleAdvanced={() => setShowAdvancedFilters(!showAdvancedFilters)}
        >
          {/* Primary Filters Row */}
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300">
                <div className="flex items-center gap-1.5">
                  <FiGlobe className="h-3.5 w-3.5" />
                  Language
                </div>
              </label>
              <StyledSelect
                value={selectedLanguage}
                onChange={(e) => {
                  setSelectedLanguage(e.target.value);
                  setPage(1);
                }}
                options={[
                  { value: "", label: "Choose a language..." },
                  ...(languages?.map((lang: any) => ({
                    value: lang.id,
                    label: lang.name,
                  })) || []),
                ]}
                placeholder="Select language"
              />
            </div>

            <div className="flex-1 min-w-[240px]">
              <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300">
                Search
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search phrase or translation..."
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
              />
            </div>

            <div className="min-w-[140px]">
              <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300">
                Per Page
              </label>
              <StyledSelect
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                options={[
                  { value: 20, label: "20" },
                  { value: 50, label: "50" },
                  { value: 100, label: "100" },
                ]}
                fullWidth
              />
            </div>
          </div>

          {/* Advanced Filters Panel */}
          {showAdvancedFilters && (
            <div className="mt-5 border-t border-gray-100 pt-5 dark:border-white/[0.05]">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Difficulty
                  </label>
                  <select
                    value={difficultyFilter ?? ""}
                    onChange={(e) => { setDifficultyFilter(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="">All Levels</option>
                    {[1, 2, 3, 4, 5].map(level => (
                      <option key={level} value={level}>Level {level}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Published Status
                  </label>
                  <select
                    value={publishedFilter === undefined ? "" : publishedFilter.toString()}
                    onChange={(e) => { setPublishedFilter(e.target.value === "" ? undefined : e.target.value === "true"); setPage(1); }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="">All</option>
                    <option value="true">Published</option>
                    <option value="false">Draft</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Alignment Status
                  </label>
                  <select
                    value={alignmentFilter ?? ""}
                    onChange={(e) => { setAlignmentFilter(e.target.value || undefined); setPage(1); }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="">All</option>
                    <option value="draft">Draft</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="approved">Approved</option>
                    <option value="stale">Stale</option>
                    <option value="none">No Alignment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Has Audio
                  </label>
                  <select
                    value={hasAudio === undefined ? "" : hasAudio.toString()}
                    onChange={(e) => { setHasAudio(e.target.value === "" ? undefined : e.target.value === "true"); setPage(1); }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="">All</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Starts With
                  </label>
                  <input
                    type="text"
                    value={startsWithFilter}
                    onChange={(e) => { setStartsWithFilter(e.target.value); setPage(1); }}
                    placeholder="e.g., Àárọ̀"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Ends With
                  </label>
                  <input
                    type="text"
                    value={endsWithFilter}
                    onChange={(e) => { setEndsWithFilter(e.target.value); setPage(1); }}
                    placeholder="e.g., ọ̀sán"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Contains
                  </label>
                  <input
                    type="text"
                    value={containsFilter}
                    onChange={(e) => { setContainsFilter(e.target.value); setPage(1); }}
                    placeholder="Search within phrase..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Sort By
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="time">Time (12:00 AM →)</option>
                    <option value="phrase">Phrase</option>
                    <option value="translation">Translation</option>
                    <option value="created_at">Created Date</option>
                    <option value="updated_at">Updated Date</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Direction
                  </label>
                  <select
                    value={sortDir}
                    onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <ActiveFilterChips filters={activeFilters} />
        </ContentFiltersCard>
      )}

      {/* Time Phrase Jobs Accordion */}
      {selectedLanguage && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <button
            type="button"
            onClick={() => setShowJobsAccordion(!showJobsAccordion)}
            className="flex w-full items-center justify-between px-5 py-3 text-left"
          >
            <span className="text-sm font-semibold text-gray-900 dark:text-white">▶ Time Phrase Jobs</span>
            {showJobsAccordion ? <FiChevronUp className="h-4 w-4 text-gray-500" /> : <FiChevronDown className="h-4 w-4 text-gray-500" />}
          </button>
          {showJobsAccordion && (
            <div className="border-t border-gray-100 px-5 py-4 dark:border-white/[0.05]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-200">
                    Time Phrase Jobs
                  </h2>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    Preview readiness, queue missing audio, or queue alignment jobs through the admin job system.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {([
                    ["readiness", "Readiness"],
                    ["audio", "Audio"],
                    ["alignment", "Alignment"],
                  ] as Array<["readiness" | "audio" | "alignment", string]>).map(([jobType, label]) => (
                    <div key={jobType} className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void queueTimePhraseAdminJob(jobType, true)}
                        disabled={timePhraseJobLoading}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200"
                      >
                        {label} Preview
                      </button>
                      {jobType !== "readiness" ? (
                        <button
                          type="button"
                          onClick={() => setTimePhraseApplyConfirm(jobType)}
                          disabled={timePhraseJobLoading}
                          className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                        >
                          Apply
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              {currentTimePhraseAdminJob ? (
                <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-xs">{currentTimePhraseAdminJob.id.slice(0, 8)}</span>
                    <span className="font-medium">{currentTimePhraseAdminJob.status}</span>
                    <span>{currentTimePhraseAdminJob.payload.job_type as string}</span>
                    <span>{Math.round(currentTimePhraseAdminJob.progress.percent)}%</span>
                    {currentTimePhraseAdminJob.error ? <span className="text-red-600 dark:text-red-300">{currentTimePhraseAdminJob.error}</span> : null}
                  </div>
                  {currentTimePhraseAdminJob.result ? (
                    <div className="mt-2 grid gap-2 sm:grid-cols-4">
                      {([
                        ["Candidates", currentTimePhraseAdminJob.result.candidate_count ?? 0],
                        ["Queued", currentTimePhraseAdminJob.result.queued_count ?? 0],
                        ["Skipped", currentTimePhraseAdminJob.result.skipped ?? 0],
                        ["Failed", currentTimePhraseAdminJob.result.failed ?? 0],
                      ] as Array<[string, unknown]>).map(([label, value]) => (
                        <div key={label} className="rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-950">
                          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
                          <div className="mt-1 font-semibold text-gray-900 dark:text-white">{String(value)}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      <StickyBulkActionBar
        selectedCount={selectedPhrases.length}
        onClear={() => setSelectedPhrases([])}
        itemName="time phrase"
        actions={[
          {
            label: isBulkRegenerating ? "Queueing..." : "Regenerate Audio",
            onClick: handleBulkRegenerateAudio,
            disabled: isBulkRegenerating,
            loading: isBulkRegenerating,
            variant: 'primary',
            icon: <FiVolume2 className="h-4 w-4" />,
          },
        ]}
      />

      {/* Content */}
      {selectedLanguage && (
        <>
          {loading ? (
            <div className="flex items-center justify-center h-64 bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : timePhrases.length === 0 ? (
            <Alert
              variant="warning"
              title="No time phrases found"
              message="Get started by creating your first time phrase or importing from yo_time tab in Google Sheets."
            />
          ) : (
            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-900/50">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          <button onClick={handleSelectAll} className="text-gray-500 hover:text-gray-700">
                            {selectedPhrases.length === timePhrases.length ? 
                              <FiCheckSquare className="w-5 h-5" /> : 
                              <FiSquare className="w-5 h-5" />
                            }
                          </button>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Time Phrase
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Translation
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Audio
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Alignment
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {timePhrases.map((phrase) => (
                        <tr key={phrase.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-4 py-4">
                            <button 
                              onClick={() => handleSelectPhrase(phrase.id)}
                              className="text-gray-500 hover:text-gray-700"
                            >
                              {selectedPhrases.includes(phrase.id) ? 
                                <FiCheckSquare className="w-5 h-5" /> : 
                                <FiSquare className="w-5 h-5" />
                              }
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <FiClock className="mr-2 text-blue-500" />
                              <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {phrase.phrase}
                                </div>
                                {phrase.romanization && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {phrase.romanization}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-700 dark:text-gray-300">
                              {phrase.translation}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <InlineAudioPlayer src={phrase.audio_url} />
                              {phrase.audio_url ? (
                                <button
                                  onClick={() => openRegenerateModal(phrase)}
                                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                  title="Regenerate audio"
                                >
                                  <FiVolume2 className="w-4 h-4" />
                                  <span>Regenerate</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => openRegenerateModal(phrase)}
                                  className="flex items-center gap-1 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                                  title="Generate audio"
                                >
                                  <FiVolume2 className="w-4 h-4" />
                                  <span className="text-xs">Generate</span>
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  phrase.is_published
                                    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                    : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                                }`}
                              >
                                {phrase.is_published ? "Published" : "Draft"}
                              </span>
                              {renderRegenerationBadge(phrase.last_regeneration_status, phrase.last_regeneration_error)}
                              {phrase.difficulty_level && (
                                <span className="text-xs text-gray-500">Lvl {phrase.difficulty_level}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col items-start gap-1">
                              {renderAlignmentBadge(phrase)}
                              {renderAlignmentJobBadge(phrase)}
                              {!phrase.alignment_status && !phrase.alignment_job_status && (
                                <span className="text-sm text-gray-400 dark:text-gray-600">-</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => void openEditModal(phrase)}
                              className="text-blue-600 hover:text-blue-800 mr-3"
                              title="Edit and align"
                            >
                              <FiEdit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm({ id: phrase.id, phrase: phrase.phrase })}
                              className="text-red-600 hover:text-red-800"
                              title="Delete"
                            >
                              <FiTrash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}
          <div className="mt-4 flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Showing {total === 0 ? 0 : (page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} phrases
            </div>
            <div className="ml-auto">
              <Pagination currentPage={page} totalPages={Math.max(1, totalPages)} onPageChange={setPage} />
            </div>
          </div>
        </>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={closeModal}
          className="max-w-6xl"
        >
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            {editingPhrase ? "Edit Time Phrase" : "Add Time Phrase"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Difficulty Level *
                </label>
                <select
                  value={formData.difficulty_level}
                  onChange={(e) => setFormData({ ...formData, difficulty_level: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  {[1, 2, 3, 4, 5].map((level) => (
                    <option key={level} value={level}>
                      Level {level}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Yoruba Phrase *
              </label>
              <input
                type="text"
                value={formData.phrase}
                onChange={(e) => setFormData({ ...formData, phrase: e.target.value })}
                required
                placeholder="e.g., Àárọ̀ mẹ́ta"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Translation *
              </label>
              <input
                type="text"
                value={formData.translation}
                onChange={(e) => setFormData({ ...formData, translation: e.target.value })}
                required
                placeholder="e.g., 3 o'clock in the morning"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Romanization
              </label>
              <input
                type="text"
                value={formData.romanization}
                onChange={(e) => setFormData({ ...formData, romanization: e.target.value })}
                placeholder="e.g., aarọ meta"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Usage Context
              </label>
              <textarea
                value={formData.usage_context}
                onChange={(e) => setFormData({ ...formData, usage_context: e.target.value })}
                rows={2}
                placeholder="When and how this time phrase is typically used..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_published"
                checked={formData.is_published}
                onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_published" className="text-sm text-gray-700 dark:text-gray-300">
                Published
              </label>
            </div>

            {editingPhrase && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/30 p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Time Phrase Alignment</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Review the phrase timing first, then refine word timings for karaoke playback.
                    </p>
                  </div>
                  {renderAlignmentStatus()}
                </div>

                {(alignmentError || alignmentLoading) && (
                  alignmentLoading ? (
                    <div className="text-sm text-gray-600 dark:text-gray-400">Loading alignment...</div>
                  ) : (
                    <Alert variant="error" title="Error" message={alignmentError} />
                  )
                )}

                {editingPhrase.alignment_job_status && (
                  <div className="flex flex-wrap items-center gap-2">
                    {renderAlignmentJobBadge(editingPhrase)}
                    {editingPhrase.alignment_job_updated_at && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Updated {new Date(editingPhrase.alignment_job_updated_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}

                {editingPhrase.alignment_job_status === "failed" && editingPhrase.alignment_job_error && (
                  <Alert
                    variant="error"
                    title="Latest auto-alignment failed"
                    message={editingPhrase.alignment_job_error}
                  />
                )}

                {alignmentRecord && ((alignmentRecord.provider_used && alignmentRecord.provider_used.trim()) || (alignmentRecord.engine_used && alignmentRecord.engine_used.trim()) || alignmentRecord.confidence !== null) && (
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {[
                      [alignmentRecord.provider_used?.trim(), alignmentRecord.engine_used?.trim()].filter(Boolean).join(" / "),
                      alignmentRecord.confidence != null ? `confidence ${alignmentRecord.confidence.toFixed(2)}` : "",
                    ].filter(Boolean).join(" • ")}
                  </div>
                )}

                {alignmentRecord?.status === "stale" && alignmentRecord.stale_reason && (
                  <Alert
                    variant="warning"
                    title="Alignment is stale"
                    message={`This alignment needs review because ${alignmentRecord.stale_reason.replaceAll("_", " ")}.`}
                  />
                )}

                {formData.audio_url ? (
                  <AudioWaveform src={formData.audio_url} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3" />
                ) : (
                  <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 text-sm text-gray-600 dark:text-gray-400">
                    Regenerate audio first to preview the waveform and save timings.
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Segment Start (ms)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={alignmentSegment.start_ms}
                      onChange={(e) => setAlignmentSegment((current) => ({
                        ...current,
                        text: formData.phrase,
                        start_ms: Number(e.target.value || 0),
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Segment End (ms)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={alignmentSegment.end_ms}
                      onChange={(e) => setAlignmentSegment((current) => ({
                        ...current,
                        text: formData.phrase,
                        end_ms: Number(e.target.value || 0),
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                    Transcript
                  </div>
                  <div className="text-sm text-gray-900 dark:text-white">{formData.phrase || "Phrase text will appear here"}</div>
                </div>

                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">Optional Word Timings</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Use this second pass when you want karaoke-grade highlighting.
                      </div>
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={wordTimingsEnabled}
                        onChange={(e) => {
                          const enabled = e.target.checked;
                          setWordTimingsEnabled(enabled);
                          if (enabled && alignmentWords.length === 0 && formData.phrase.trim()) {
                            void syncWordsFromTranscript();
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                      Enable word timings
                    </label>
                  </div>

                  {(wordTimingsEnabled || alignmentRecord?.word_timing_reliable || alignmentWords.length > 0) && (
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {wordTimingsEnabled
                        ? alignmentConfidence >= DEFAULT_WORD_ALIGNMENT_CONFIDENCE
                          ? "Saving now will mark these word timings reliable."
                          : "Below 0.85, the timings stay editable but are not marked reliable yet."
                        : alignmentRecord?.word_timing_reliable
                          ? "Current word timings are marked reliable."
                          : "Word timings are stored but still optional for playback."}
                    </div>
                  )}

                  {wordTimingsEnabled && (
                    <>
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Word Timing Confidence
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.05}
                              value={alignmentConfidence}
                              onChange={(e) => setAlignmentConfidence(Number(e.target.value))}
                              className="w-full"
                            />
                            <span className="min-w-12 text-sm font-medium text-gray-900 dark:text-white">
                              {alignmentConfidence.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <div>
                          <StyledSelect
                            label="Snap Step"
                            value={wordSnapStepMs}
                            onChange={(e) => setWordSnapStepMs(Number(e.target.value))}
                            options={WORD_SNAP_STEP_OPTIONS.map((step) => ({ value: step, label: `${step} ms` }))}
                            fullWidth
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => void syncWordsFromTranscript()} className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
                          Split From Transcript
                        </button>
                        <button type="button" onClick={() => void addAlignmentWord()} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                          Add Word
                        </button>
                        <button type="button" onClick={() => void redistributeAlignmentWords()} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                          Redistribute Evenly
                        </button>
                      </div>

                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Use the waveform as the anchor, then nudge, expand, snap edges, or preview one word clip at a time.
                      </div>

                      <div className="space-y-3">
                        {alignmentWords.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-3 text-sm text-gray-600 dark:text-gray-400">
                            No word timings yet. Use “Split From Transcript” to seed them from the time phrase.
                          </div>
                        ) : alignmentWords.map((word, index) => (
                          <div key={`${index}-${word.word}`} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3 xl:grid-cols-[minmax(0,2fr)_120px_120px_minmax(0,320px)_auto] xl:items-end">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Word {index + 1}</label>
                              <input
                                type="text"
                                value={word.word}
                                onChange={(e) => updateAlignmentWord(index, "word", e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start (ms)</label>
                              <input
                                type="number"
                                min={0}
                                value={word.start_ms}
                                onChange={(e) => updateAlignmentWord(index, "start_ms", Number(e.target.value || 0))}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End (ms)</label>
                              <input
                                type="number"
                                min={0}
                                value={word.end_ms}
                                onChange={(e) => updateAlignmentWord(index, "end_ms", Number(e.target.value || 0))}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Snap Helpers</label>
                              <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => shiftAlignmentWord(index, -wordSnapStepMs)} className="px-2.5 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">-{wordSnapStepMs} ms</button>
                                <button type="button" onClick={() => shiftAlignmentWord(index, wordSnapStepMs)} className="px-2.5 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">Shift +</button>
                                <button type="button" onClick={() => expandAlignmentWord(index, wordSnapStepMs, "left")} className="px-2.5 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">Expand Left</button>
                                <button type="button" onClick={() => expandAlignmentWord(index, wordSnapStepMs, "right")} className="px-2.5 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">Expand Right</button>
                                <button type="button" onClick={() => snapAlignmentWordEdge(index, "start")} className="px-2.5 py-2 rounded-lg border border-indigo-300 text-xs text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/20">Snap Start</button>
                                <button type="button" onClick={() => snapAlignmentWordEdge(index, "end")} className="px-2.5 py-2 rounded-lg border border-indigo-300 text-xs text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/20">Snap End</button>
                                <button type="button" onClick={() => snapAlignmentWordToBounds(index)} className="px-2.5 py-2 rounded-lg border border-indigo-300 text-xs text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/20">Snap To Bounds</button>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2 xl:items-end">
                              <button type="button" onClick={() => void previewWordTiming(word, index)} className="px-3 py-2 rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/20">
                                {previewingWordIndex === index ? "Stop Clip" : "Play Clip"}
                              </button>
                              <button type="button" onClick={() => removeAlignmentWord(index)} className="px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20">
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={requeueAlignment}
                    disabled={alignmentSaving || !formData.audio_url.trim()}
                    className="px-3 py-2 rounded-lg border border-indigo-300 text-indigo-700 hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/20"
                  >
                    Requeue Auto-Align
                  </button>
                  <button type="button" onClick={() => void saveAlignment("draft")} disabled={alignmentSaving} className="px-3 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60">
                    Save Draft
                  </button>
                  <button type="button" onClick={() => void saveAlignment("reviewed")} disabled={alignmentSaving} className="px-3 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60">
                    Save Reviewed
                  </button>
                  <button type="button" onClick={approveAlignment} disabled={alignmentSaving || !alignmentRecord} className="px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60">
                    Approve
                  </button>
                  {alignmentRecord && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Version {alignmentRecord.version} · Updated {new Date(alignmentRecord.updated_at).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editingPhrase ? "Update" : "Create"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <ConfirmationModal
          isOpen={!!deleteConfirm}
          onClose={() => setDeleteConfirm(null)}
          onConfirm={() => handleDelete(deleteConfirm.id)}
          title="Delete Time Phrase"
          message={`Are you sure you want to delete the time phrase "${deleteConfirm.phrase}"? This action cannot be undone.`}
          confirmText="Delete"
          variant="danger"
        />
      )}

      <ConfirmationModal
        isOpen={Boolean(timePhraseApplyConfirm)}
        onClose={() => setTimePhraseApplyConfirm(null)}
        onConfirm={() => {
          if (timePhraseApplyConfirm) {
            void queueTimePhraseAdminJob(timePhraseApplyConfirm, false);
          }
        }}
        title="Apply Time Phrase Job"
        message="This will modify data. Proceed? Audio apply queues TTS jobs. Alignment apply queues alignment jobs."
        confirmText="Apply"
        variant="warning"
        isLoading={timePhraseJobLoading}
      />

      {/* Regenerate Audio Modal */}
      {showRegenerateModal && regeneratingPhrase && (
        <RegenerateAudioModal
          isOpen={showRegenerateModal}
          onClose={() => {
            setShowRegenerateModal(false);
            setRegeneratingPhrase(null);
          }}
          target={{
            id: regeneratingPhrase.id,
            contentType: "phrase",
            displayText: regeneratingPhrase.phrase,
            defaultText: regeneratingPhrase.phrase,
            languageCode: languages?.find((l: any) => l.id === regeneratingPhrase.language_id)?.iso_639_3 || "yor",
            submitEndpoint: `/api/v1/admin/content/phrases/${regeneratingPhrase.id}/regenerate-audio`,
          }}
          onSuccess={() => {
            toast.success("Audio regeneration queued successfully");
            scheduleQueuedAudioRefresh(fetchTimePhrases);
          }}
        />
      )}
    </div>
  );
}

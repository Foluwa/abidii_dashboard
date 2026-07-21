"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLanguages } from "@/hooks/useApi";
import { apiClient } from "@/lib/api";
import {
  ContentPageHeader,
  ContentStatsCard,
  ContentStatsGrid,
  ContentFiltersCard,
  ActiveFilterChips,
  StickyBulkActionBar,
} from '@/components/admin/layout';
import Toast from "@/components/ui/toast/Toast";
import Alert from "@/components/ui/alert/Alert";
import { StyledSelect } from "@/components/ui/form/StyledSelect";
import { Modal } from "@/components/ui/modal";
import { ConfirmationModal } from "@/components/ui/modal/ConfirmationModal";
import { AudioWaveform } from "@/components/ui/audio/AudioWaveform";
import InlineAudioPlayer from "@/components/ui/audio/InlineAudioPlayer";
import { RegenerateAudioModal } from "@/components/modals/RegenerateAudioModal";
import { scheduleQueuedAudioRefresh } from "@/lib/audioRegeneration";
import { GoogleSheetsBulkImport } from "@/components/admin/GoogleSheetsBulkImport";
import Pagination from "@/components/tables/Pagination";
import { FiGlobe, FiBarChart2, FiVolume2, FiCheckCircle, FiGitMerge } from "react-icons/fi";

interface Phrase {
  id: string;
  language_id: string;
  phrase: string;
  translation: string;
  literal_translation?: string;
  romanization?: string;
  difficulty_level?: number;
  category?: string;
  tags: string[];
  usage_context?: string;
  cultural_notes?: string;
  is_published: boolean;
  audio_url?: string;
  last_regeneration_status?: string | null;
  last_regeneration_error?: string | null;
  alignment_status?: AlignmentStatus | null;
  alignment_updated_at?: string | null;
  alignment_stale_reason?: string | null;
  alignment_job_status?: AlignmentJobStatus | null;
  alignment_job_provider?: string | null;
  alignment_job_engine?: string | null;
  alignment_job_error?: string | null;
  alignment_job_updated_at?: string | null;
  created_at: string;
  updated_at: string;
}

type AlignmentFilter = "all" | AlignmentStatus | "none";

type AlignmentStatus = "draft" | "reviewed" | "approved" | "stale";
type AlignmentJobStatus = "queued" | "processing" | "completed" | "failed" | "cancelled" | "superseded";

const DEFAULT_WORD_ALIGNMENT_CONFIDENCE = 0.85;
const DEFAULT_WORD_SNAP_STEP_MS = 25;

const ALIGNMENT_FILTER_OPTIONS: Array<{ value: AlignmentFilter; label: string }> = [
  { value: "all", label: "All Alignments" },
  { value: "draft", label: "Draft" },
  { value: "reviewed", label: "Reviewed" },
  { value: "approved", label: "Approved" },
  { value: "stale", label: "Stale" },
  { value: "none", label: "No Alignment" },
];

const WORD_SNAP_STEP_OPTIONS = [10, 25, 50, 100];

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

const tokenizePhraseWords = (text: string): string[] => (
  text.trim().split(/\s+/).filter(Boolean)
);

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

function renderPhraseAlignmentBadge(phrase: Phrase) {
  if (!phrase.alignment_status) {
    return null;
  }

  const statusClasses = {
    draft: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    reviewed: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
    approved: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
    stale: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  };

  const label = phrase.alignment_status.charAt(0).toUpperCase() + phrase.alignment_status.slice(1);
  const detail = phrase.alignment_status === "stale" && phrase.alignment_stale_reason
    ? `Alignment stale: ${phrase.alignment_stale_reason.replaceAll("_", " ")}`
    : `Alignment ${phrase.alignment_status}`;

  return (
    <span
      title={detail}
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClasses[phrase.alignment_status]}`}
    >
      {label} Alignment
    </span>
  );
}

function renderRegenerationBadge(status?: string | null, error?: string | null) {
  if (!status) {
    return null;
  }

  if (status === "queued") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
        Audio queued
      </span>
    );
  }

  if (status === "processing") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
        Audio processing
      </span>
    );
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

function renderAlignmentJobBadge(phrase: Phrase) {
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
  const providerDetail = [phrase.alignment_job_provider, phrase.alignment_job_engine].filter(Boolean).join(" / ");
  const detail = phrase.alignment_job_status === "failed" && phrase.alignment_job_error
    ? `Auto-alignment failed: ${phrase.alignment_job_error}`
    : providerDetail
      ? `Latest auto-alignment job ${phrase.alignment_job_status} via ${providerDetail}`
      : `Latest auto-alignment job ${phrase.alignment_job_status}`;

  return (
    <span
      title={detail}
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClasses[phrase.alignment_job_status]}`}
    >
      Align {label}
    </span>
  );
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

function formatErrorMessage(error: any, fallbackMessage: string): string {
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

export default function PhrasesPage() {
  const { languages } = useLanguages();
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingPhrase, setEditingPhrase] = useState<Phrase | null>(null);
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
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [alignmentFilter, setAlignmentFilter] = useState<AlignmentFilter>("all");
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; phrase: string } | null>(null);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [regeneratingTarget, setRegeneratingTarget] = useState<any | null>(null);
  const [selectedPhrases, setSelectedPhrases] = useState<string[]>([]);
  const [showBulkRegenerateConfirm, setShowBulkRegenerateConfirm] = useState(false);
  const [isBulkRegenerating, setIsBulkRegenerating] = useState(false);
  const [bulkRegenerateProvider, setBulkRegenerateProvider] = useState<string>("");
  const [bulkRegenerateVoiceId, setBulkRegenerateVoiceId] = useState<string>("");
  const [availableVoices, setAvailableVoices] = useState<any[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const wordPreviewAudioRef = useRef<HTMLAudioElement | null>(null);

  const [formData, setFormData] = useState({
    language_id: "",
    phrase: "",
    translation: "",
    literal_translation: "",
    romanization: "",
    difficulty_level: 1,
    category: "",
    tags: [] as string[],
    usage_context: "",
    cultural_notes: "",
    is_published: false,
    audio_url: "",
  });

  useEffect(() => {
    if (!selectedLanguage && languages.length > 0) {
      const defaultLanguageId = languages[0].id;
      setSelectedLanguage(defaultLanguageId);
      fetchPhrases(defaultLanguageId, 1, alignmentFilter);
    }
  }, [languages, selectedLanguage, alignmentFilter]);

  const fetchPhrases = async (
    languageId: string,
    currentPage: number = 1,
    currentAlignmentFilter: AlignmentFilter = alignmentFilter,
  ) => {
    if (!languageId) return;
    
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        language_id: languageId,
        page: String(currentPage),
        page_size: String(limit),
      });

      if (currentAlignmentFilter !== "all") {
        params.set("alignment_status", currentAlignmentFilter);
      }

      const response = await apiClient.get(`/api/v1/admin/content/phrases?${params.toString()}`);
      const data = response.data;
      const nextItems = data.items || [];
      setPhrases(nextItems);
      setSelectedPhrases((current) => current.filter((phraseId) => nextItems.some((phrase: Phrase) => phrase.id === phraseId)));
      setTotal(data.total || 0);
      setPage(currentPage);
    } catch (err: any) {
      setError(formatErrorMessage(err, "Failed to load phrases"));
      setPhrases([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = (languageId: string) => {
    setSelectedLanguage(languageId);
    setPage(1);
    setSelectedPhrases([]);
    fetchPhrases(languageId, 1, alignmentFilter);
  };

  const handleAlignmentFilterChange = (nextFilter: AlignmentFilter) => {
    setAlignmentFilter(nextFilter);
    setPage(1);
    setSelectedPhrases([]);
    if (selectedLanguage) {
      fetchPhrases(selectedLanguage, 1, nextFilter);
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
      literal_translation: "",
      romanization: "",
      difficulty_level: 1,
      category: "",
      tags: [],
      usage_context: "",
      cultural_notes: "",
      is_published: false,
      audio_url: "",
    });
    setShowModal(true);
  };

  const loadAlignment = async (phrase: Phrase) => {
    setAlignmentLoading(true);
    setAlignmentError("");
    try {
      const response = await apiClient.get<PhraseAlignment>(
        `/api/v1/admin/content/phrases/${phrase.id}/alignment`
      );
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

  const openEditModal = async (phrase: Phrase) => {
    setEditingPhrase(phrase);
    setFormData({
      language_id: phrase.language_id,
      phrase: phrase.phrase,
      translation: phrase.translation,
      literal_translation: phrase.literal_translation || "",
      romanization: phrase.romanization || "",
      difficulty_level: phrase.difficulty_level || 1,
      category: phrase.category || "",
      tags: phrase.tags || [],
      usage_context: phrase.usage_context || "",
      cultural_notes: phrase.cultural_notes || "",
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

    let previousWordEnd = -1;
    for (const word of alignmentWords) {
      if (!word.word.trim()) {
        return "Word timings cannot include blank words";
      }
      if (word.end_ms <= word.start_ms) {
        return "Word end time must be greater than start time";
      }
      if (word.start_ms < previousWordEnd) {
        return "Word timings must be sorted and non-overlapping";
      }
      if (word.start_ms < alignmentSegment.start_ms || word.end_ms > alignmentSegment.end_ms) {
        return "Word timings must stay within the segment window";
      }
      previousWordEnd = word.end_ms;
    }

    return null;
  };

  const resolveAudioDurationMs = React.useCallback(async () => {
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

  const stopWordPreview = React.useCallback(() => {
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
        console.error("Failed to preview phrase word timing:", playbackError);
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

  React.useEffect(() => {
    setResolvedAudioDurationMs(null);
  }, [formData.audio_url]);

  React.useEffect(() => {
    if (!showModal || !formData.audio_url.trim()) {
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
  }, [showModal, formData.audio_url, alignmentSegment.end_ms, alignmentSegment.start_ms, resolveAudioDurationMs]);

  React.useEffect(() => {
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

  const updateAlignmentWord = (
    index: number,
    field: keyof PhraseAlignmentWord,
    value: string | number,
  ) => {
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
    
    try {
      if (editingPhrase) {
        await apiClient.put(`/api/v1/admin/content/phrases/${editingPhrase.id}`, formData);
        setSuccessMessage("Phrase updated successfully");
      } else {
        await apiClient.post("/api/v1/admin/content/phrases", formData);
        setSuccessMessage("Phrase created successfully");
      }
      closeModal();
      fetchPhrases(selectedLanguage, page, alignmentFilter);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error: any) {
      setError(formatErrorMessage(error, "Failed to save phrase"));
    }
  };

  const saveAlignment = async (status: AlignmentStatus) => {
    if (!editingPhrase) return;
    if (!formData.audio_url.trim()) {
      setAlignmentError("Add an audio URL before saving alignment timings");
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
      if (selectedLanguage) {
        fetchPhrases(selectedLanguage, page, alignmentFilter);
      }
      setSuccessMessage(status === "reviewed" ? "Alignment saved for review" : "Alignment saved");
      setTimeout(() => setSuccessMessage(""), 3000);
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
      const response = await apiClient.post<PhraseAlignment>(
        `/api/v1/admin/content/phrases/${editingPhrase.id}/alignment/approve`,
        {}
      );
      setAlignmentRecord(response.data);
      setAlignmentStatus(response.data.status);
      setAlignmentWords(response.data.alignment_json.words || []);
      setAlignmentConfidence(response.data.confidence ?? DEFAULT_WORD_ALIGNMENT_CONFIDENCE);
      setWordTimingsEnabled((response.data.alignment_json.words || []).length > 0);
      if (selectedLanguage) {
        fetchPhrases(selectedLanguage, page, alignmentFilter);
      }
      setSuccessMessage("Alignment approved for mobile playback");
      setTimeout(() => setSuccessMessage(""), 3000);
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
        alignment_job_provider: "google",
        alignment_job_engine: "chirp_2",
        alignment_job_error: null,
        alignment_job_updated_at: new Date().toISOString(),
      } : current);
      if (selectedLanguage) {
        fetchPhrases(selectedLanguage, page, alignmentFilter);
      }
      setSuccessMessage("Auto-alignment requeued");
      setTimeout(() => setSuccessMessage(""), 3000);
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

  const handleDeleteClick = (phraseId: string, phraseText: string) => {
    setDeleteConfirm({ id: phraseId, phrase: phraseText });
  };

  const handleRegenerateAudio = (phrase: Phrase) => {
    if (isRegenerationPending(phrase.last_regeneration_status)) {
      return;
    }

    const languageCode = languages.find((lang: any) => lang.id === phrase.language_id)?.iso_639_3 || "yor";
    setRegeneratingTarget({
      id: phrase.id,
      contentType: "phrase",
      displayText: phrase.phrase,
      defaultText: phrase.phrase,
      languageCode,
      submitEndpoint: `/api/v1/admin/content/phrases/${phrase.id}/regenerate-audio`,
    });
    setShowRegenerateModal(true);
  };

  const togglePhraseSelection = (phraseId: string) => {
    const phrase = phrases.find((item) => item.id === phraseId);
    if (phrase && isRegenerationPending(phrase.last_regeneration_status)) {
      return;
    }

    setSelectedPhrases((current) => (
      current.includes(phraseId)
        ? current.filter((id) => id !== phraseId)
        : [...current, phraseId]
    ));
  };

  const toggleSelectAllVisiblePhrases = () => {
    const selectablePhraseIds = phrases
      .filter((phrase) => !isRegenerationPending(phrase.last_regeneration_status))
      .map((phrase) => phrase.id);
    if (selectablePhraseIds.length === 0) {
      return;
    }

    setSelectedPhrases((current) => {
      const allVisibleSelected = selectablePhraseIds.every((phraseId) => current.includes(phraseId));
      if (allVisibleSelected) {
        return current.filter((phraseId) => !selectablePhraseIds.includes(phraseId));
      }
      const next = new Set(current);
      selectablePhraseIds.forEach((phraseId) => next.add(phraseId));
      return Array.from(next);
    });
  };

  const handleBulkRegenerateAudio = async () => {
    if (selectedPhrases.length === 0) return;

    setIsLoadingVoices(true);
    try {
      const response = await apiClient.get("/api/v1/admin/audio/voices", {
        params: { is_active: true, limit: 100 }
      });
      const voices = response.data.voices || response.data.items || [];
      setAvailableVoices(voices);
      setBulkRegenerateProvider("");
      setBulkRegenerateVoiceId("");
    } catch (voiceError) {
      console.error("Failed to load voices:", voiceError);
      setAvailableVoices([]);
      setBulkRegenerateProvider("");
      setBulkRegenerateVoiceId("");
    } finally {
      setIsLoadingVoices(false);
    }

    setShowBulkRegenerateConfirm(true);
  };

  const confirmBulkRegenerateAudio = async () => {
    if (!bulkRegenerateProvider || !bulkRegenerateVoiceId) {
      setError("Select a provider and voice before bulk regeneration");
      setTimeout(() => setError(""), 4000);
      return;
    }

    const queueablePhraseIds = selectedPhrases.filter((phraseId) => {
      const phrase = phrases.find((item) => item.id === phraseId);
      return phrase && !isRegenerationPending(phrase.last_regeneration_status);
    });

    if (queueablePhraseIds.length === 0) {
      setError("No selectable phrases to regenerate. Items already queued/processing were skipped.");
      setTimeout(() => setError(""), 5000);
      return;
    }

    setIsBulkRegenerating(true);
    try {
      const payload: Record<string, any> = {
        phrase_ids: queueablePhraseIds,
        voice_id: bulkRegenerateVoiceId,
      };

      const response = await apiClient.post("/api/v1/admin/content/phrases/bulk/regenerate-audio", payload);
      const result = response.data || {};
      const queuedPhraseIds: string[] = Array.isArray(result.queued_phrase_ids)
        ? result.queued_phrase_ids
        : queueablePhraseIds;
      const failedCount = Number(result.failed_count || 0);
      const queuedCount = Number(result.queued_count || queuedPhraseIds.length);

      setPhrases((current) => current.map((phrase) => (
        queuedPhraseIds.includes(phrase.id)
          ? {
              ...phrase,
              last_regeneration_status: "queued",
              last_regeneration_error: null,
            }
          : phrase
      )));
      if (queuedCount > 0) {
        setSuccessMessage(
          failedCount > 0
            ? `Queued ${queuedCount} phrase(s); ${failedCount} could not be queued`
            : `Audio regeneration started for ${queuedCount} phrase(s)`
        );
      } else {
        const firstError = Array.isArray(result.errors) && result.errors.length > 0
          ? result.errors[0]?.detail
          : null;
        setError(firstError || "Bulk regeneration did not queue any phrases");
        setTimeout(() => setError(""), 5000);
      }
      setSelectedPhrases([]);
      setShowBulkRegenerateConfirm(false);
      setBulkRegenerateProvider("");
      setBulkRegenerateVoiceId("");
      fetchPhrases(selectedLanguage, page, alignmentFilter);
      scheduleQueuedAudioRefresh(() => {
        fetchPhrases(selectedLanguage, page, alignmentFilter);
      });
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (bulkError: any) {
      setError(formatErrorMessage(bulkError, "Failed to regenerate phrase audio"));
      setTimeout(() => setError(""), 5000);
    } finally {
      setIsBulkRegenerating(false);
    }
  };

  const selectableVisiblePhraseIds = phrases
    .filter((phrase) => !isRegenerationPending(phrase.last_regeneration_status))
    .map((phrase) => phrase.id);
  const allVisiblePhrasesSelected = selectableVisiblePhraseIds.length > 0
    && selectableVisiblePhraseIds.every((phraseId) => selectedPhrases.includes(phraseId));

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    
    try {
      await apiClient.delete(`/api/v1/admin/content/phrases/${deleteConfirm.id}`);
      setSuccessMessage("Phrase deleted successfully");
      setDeleteConfirm(null);
      fetchPhrases(selectedLanguage, page, alignmentFilter);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error: any) {
      setError(formatErrorMessage(error, "Failed to delete phrase"));
      setDeleteConfirm(null);
      setTimeout(() => setError(""), 5000);
    }
  };

  const stats = useMemo(() => {
    const aligned = phrases.filter((p) => p.alignment_status === "approved" || p.alignment_status === "reviewed").length;
    const needsAlignment = phrases.filter((p) => !p.alignment_status || p.alignment_status === "draft").length;
    const withAudio = phrases.filter((p) => !!p.audio_url).length;
    return { total, aligned, needsAlignment, withAudio };
  }, [phrases, total]);

  const activeFilters = [] as { label: string; onClear: () => void }[];
  if (selectedLanguage) {
    const lang = languages.find((l: any) => l.id === selectedLanguage);
    activeFilters.push({ label: `Language: ${lang?.name || selectedLanguage}`, onClear: () => { setSelectedLanguage(""); setPage(1); setSelectedPhrases([]); } });
  }
  if (search) activeFilters.push({ label: `Search: "${search}"`, onClear: () => { setSearch(""); setPage(1); } });
  if (alignmentFilter !== "all") {
    const option = ALIGNMENT_FILTER_OPTIONS.find((o) => o.value === alignmentFilter);
    activeFilters.push({ label: `Alignment: ${option?.label || alignmentFilter}`, onClear: () => handleAlignmentFilterChange("all") });
  }

  const clearAllFilters = () => {
    setSearch("");
    handleAlignmentFilterChange("all");
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      <ContentPageHeader
        title="Phrases Management"
        subtitle="Manage common phrases and expressions"
        onAdd={openCreateModal}
        addLabel="Add Phrase"
      />

      {successMessage && <Toast type="success" message={successMessage} onClose={() => setSuccessMessage("")} />}
      {error && <Toast type="error" message={error} onClose={() => setError("")} />}

      <ContentStatsGrid cols={4}>
        <ContentStatsCard label="Total" value={stats.total} icon={FiBarChart2} />
        <ContentStatsCard label="Aligned" value={stats.aligned} icon={FiCheckCircle} iconBgClass="bg-blue-100 dark:bg-blue-900/20" iconTextClass="text-blue-600 dark:text-blue-400" />
        <ContentStatsCard label="Needs Alignment" value={stats.needsAlignment} icon={FiGitMerge} iconBgClass="bg-amber-100 dark:bg-amber-900/20" iconTextClass="text-amber-600 dark:text-amber-400" />
        <ContentStatsCard label="With Audio" value={stats.withAudio} icon={FiVolume2} iconBgClass="bg-green-100 dark:bg-green-900/20" iconTextClass="text-green-600 dark:text-green-400" />
      </ContentStatsGrid>

      {/* Bulk Import from Google Sheets (has built-in accordion) */}
      {selectedLanguage && (
        <GoogleSheetsBulkImport
          contentType="phrases"
          onImportComplete={() => fetchPhrases(selectedLanguage, page, alignmentFilter)}
          defaultLanguageId={selectedLanguage}
          defaultWorksheetTitle="yo_phrases"
          expectedColumns={[
            { name: 'source_row_key', required: true, description: 'Stable spreadsheet row key', example: 'phrase_yor_0001' },
            { name: 'phrase', required: true, description: 'The phrase text', example: 'Báwo ni?' },
            { name: 'translation', required: true, description: 'Translation', example: 'How are you?' },
            { name: 'literal_translation', required: false, description: 'Word-by-word translation', example: 'How is it?' },
            { name: 'romanization', required: false, description: 'Romanized version', example: 'Ba-wo ni' },
            { name: 'difficulty_level', required: false, description: 'Difficulty 1-5', example: '2' },
            { name: 'category', required: false, description: 'Category tag', example: 'greeting' },
            { name: 'tags', required: false, description: 'Comma-separated tags', example: 'common,casual' },
            { name: 'usage_context', required: false, description: 'When to use this phrase' },
            { name: 'cultural_notes', required: false, description: 'Cultural context notes' },
            { name: 'is_published', required: false, description: 'Publish state', example: 'true' },
            { name: 'review_status', required: false, description: 'Editorial review status', example: 'approved' },
          ]}
        />
      )}

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
              onChange={(e) => handleLanguageChange(e.target.value)}
              options={[
                { value: "", label: "-- Select a Language --" },
                ...languages.map((lang: any) => ({
                  value: lang.id,
                  label: `${lang.name} (${lang.native_name})`
                }))
              ]}
              fullWidth
            />
          </div>

          <div className="flex-1 min-w-[240px]">
            <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Search
            </label>
            <input
              type="text"
              placeholder="Search phrases..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
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
                if (selectedLanguage) {
                  fetchPhrases(selectedLanguage, 1, alignmentFilter);
                }
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <StyledSelect
                label="Alignment Filter"
                value={alignmentFilter}
                onChange={(e) => handleAlignmentFilterChange(e.target.value as AlignmentFilter)}
                options={ALIGNMENT_FILTER_OPTIONS}
                fullWidth
              />
            </div>
          </div>
        )}

        <ActiveFilterChips filters={activeFilters} />
      </ContentFiltersCard>

      <StickyBulkActionBar
        selectedCount={selectedPhrases.length}
        onClear={() => setSelectedPhrases([])}
        itemName="phrase"
        actions={[
          {
            label: isLoadingVoices ? "Loading voices..." : isBulkRegenerating ? "Queueing..." : "Regenerate Audio",
            onClick: handleBulkRegenerateAudio,
            disabled: isBulkRegenerating || isLoadingVoices,
            loading: isBulkRegenerating || isLoadingVoices,
            variant: 'primary',
            icon: <FiVolume2 className="h-4 w-4" />,
          },
        ]}
      />

      {/* Phrases Table - Desktop Only */}
      {selectedLanguage && (
        <>
        <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : phrases.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">No phrases found for this language</p>
              <button
                onClick={openCreateModal}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add First Phrase
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={allVisiblePhrasesSelected}
                          onChange={toggleSelectAllVisiblePhrases}
                          className="h-4 w-4 rounded border-gray-300 text-brand-600"
                          aria-label="Select all visible phrases"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        Phrase
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        Translation
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        Difficulty
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        Alignment
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        Audio
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {phrases.map((phrase) => (
                      <tr key={phrase.id}>
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedPhrases.includes(phrase.id)}
                            disabled={isRegenerationPending(phrase.last_regeneration_status)}
                            onChange={() => togglePhraseSelection(phrase.id)}
                            className="h-4 w-4 rounded border-gray-300 text-brand-600 disabled:opacity-40"
                            aria-label={`Select phrase ${phrase.phrase}`}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {phrase.phrase}
                          </div>
                          {phrase.romanization && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {phrase.romanization}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                          {phrase.translation}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                          {phrase.category || "-"}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            Level {phrase.difficulty_level || 1}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              phrase.is_published
                                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {phrase.is_published ? "Published" : "Draft"}
                          </span>
                          {phrase.last_regeneration_status && (
                            <div className="mt-2">
                              {renderRegenerationBadge(phrase.last_regeneration_status, phrase.last_regeneration_error)}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col items-start gap-2">
                            {renderPhraseAlignmentBadge(phrase)}
                            {renderAlignmentJobBadge(phrase)}
                            {!phrase.alignment_status && !phrase.alignment_job_status && (
                              <span className="text-sm text-gray-400 dark:text-gray-600">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <InlineAudioPlayer src={phrase.audio_url} />
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => handleRegenerateAudio(phrase)}
                            disabled={isRegenerationPending(phrase.last_regeneration_status)}
                            className="text-brand-600 hover:text-brand-800 dark:text-brand-400 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {phrase.last_regeneration_status === "queued"
                              ? "Queued"
                              : phrase.last_regeneration_status === "processing"
                                ? "Processing..."
                                : "Regenerate Audio"}
                          </button>
                          <button
                            onClick={() => openEditModal(phrase)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClick(phrase.id, phrase.phrase)}
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

            </>
          )}
        </div>

        {/* Mobile Grid View */}
        <div className="lg:hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64 bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : phrases.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
              <p className="text-gray-500 dark:text-gray-400">No phrases found for this language</p>
              <button
                onClick={openCreateModal}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add First Phrase
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {phrases.map((phrase) => (
                <div key={phrase.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <input
                      type="checkbox"
                      checked={selectedPhrases.includes(phrase.id)}
                      disabled={isRegenerationPending(phrase.last_regeneration_status)}
                      onChange={() => togglePhraseSelection(phrase.id)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-600 disabled:opacity-40"
                      aria-label={`Select phrase ${phrase.phrase}`}
                    />
                  </div>
                  {/* Phrase */}
                  <div className="mb-3">
                    <div className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                      {phrase.phrase}
                    </div>
                    {phrase.romanization && (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {phrase.romanization}
                      </div>
                    )}
                  </div>
                  <div className="mb-3">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                      Translation
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      {phrase.translation}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    {phrase.category && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                        {phrase.category}
                      </span>
                    )}
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                      Level {phrase.difficulty_level || 1}
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        phrase.is_published
                          ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {phrase.is_published ? "Published" : "Draft"}
                    </span>
                    {renderPhraseAlignmentBadge(phrase)}
                  </div>
                  {(phrase.last_regeneration_status || phrase.audio_url) && (
                    <div className="mb-3 space-y-2">
                      {phrase.last_regeneration_status &&
                        renderRegenerationBadge(phrase.last_regeneration_status, phrase.last_regeneration_error)}
                      {phrase.alignment_job_status && renderAlignmentJobBadge(phrase)}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Audio:</span>
                        <InlineAudioPlayer src={phrase.audio_url} />
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 border-t border-gray-200 dark:border-gray-700 pt-3">
                    <button
                      onClick={() => handleRegenerateAudio(phrase)}
                      disabled={isRegenerationPending(phrase.last_regeneration_status)}
                      className="flex-1 px-4 py-2 text-sm font-medium text-brand-600 bg-brand-50 hover:bg-brand-100 dark:bg-brand-900/20 dark:text-brand-400 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {phrase.last_regeneration_status === "queued"
                        ? "Queued"
                        : phrase.last_regeneration_status === "processing"
                          ? "Processing..."
                          : "Regenerate"}
                    </button>
                    <button
                      onClick={() => openEditModal(phrase)}
                      className="flex-1 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 rounded-lg"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteClick(phrase.id, phrase.phrase)}
                      className="flex-1 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 rounded-lg"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="mt-4 px-6 py-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 flex items-center justify-between">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Showing {total === 0 ? 0 : (page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} phrases
          </div>
          <div className="ml-auto">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(nextPage) => fetchPhrases(selectedLanguage, nextPage, alignmentFilter)}
            />
          </div>
        </div>
        </>
      )}

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingPhrase ? "Edit Phrase" : "Add Phrase"}
        maxWidth="4xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="max-h-[calc(90vh-10rem)] overflow-y-auto pr-1 space-y-4">
              {error && <Alert variant="error" title="Error" message={error} />}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phrase *
                  </label>
                  <input
                    type="text"
                    value={formData.phrase}
                    onChange={(e) => setFormData({ ...formData, phrase: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Translation *
                  </label>
                  <input
                    type="text"
                    value={formData.translation}
                    onChange={(e) => setFormData({ ...formData, translation: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Literal Translation
                  </label>
                  <input
                    type="text"
                    value={formData.literal_translation}
                    onChange={(e) => setFormData({ ...formData, literal_translation: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Audio URL
                  </label>
                  <input
                    type="url"
                    value={formData.audio_url}
                    onChange={(e) => setFormData({ ...formData, audio_url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="https://cdn.example.com/audio/phrase.mp3"
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g., greeting, travel, food"
                  />
                </div>

                <div>
                  <StyledSelect
                    label="Difficulty Level"
                    value={formData.difficulty_level}
                    onChange={(e) => setFormData({ ...formData, difficulty_level: parseInt(e.target.value) })}
                    options={[1, 2, 3, 4, 5].map((level) => ({
                      value: level,
                      label: `Level ${level}`
                    }))}
                    fullWidth
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Usage Context
                  </label>
                  <textarea
                    value={formData.usage_context}
                    onChange={(e) => setFormData({ ...formData, usage_context: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    rows={2}
                    placeholder="When and how to use this phrase"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Cultural Notes
                  </label>
                  <textarea
                    value={formData.cultural_notes}
                    onChange={(e) => setFormData({ ...formData, cultural_notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    rows={2}
                    placeholder="Cultural context or significance"
                  />
                </div>

                <div className="col-span-2 flex items-center">
                  <input
                    type="checkbox"
                    id="is_published"
                    checked={formData.is_published}
                    onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300"
                  />
                  <label htmlFor="is_published" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Published (visible to users)
                  </label>
                </div>
              </div>

              {editingPhrase && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/30 p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Phrase Alignment</h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Review the full phrase timing first, then refine words for karaoke-level playback.
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

                  {editingPhrase?.alignment_job_status && (
                    <div className="flex flex-wrap items-center gap-2">
                      {renderAlignmentJobBadge(editingPhrase)}
                      {editingPhrase.alignment_job_updated_at && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Updated {new Date(editingPhrase.alignment_job_updated_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}

                  {editingPhrase?.alignment_job_status === "failed" && editingPhrase.alignment_job_error && (
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
                      Add an audio URL to preview the phrase waveform and save timings.
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
                          Add word-level timing only when you want a second pass after segment review.
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
                              syncWordsFromTranscript();
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
                            : "Saving now will keep these word timings editable but not marked reliable yet."
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
                            <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                              {alignmentConfidence >= DEFAULT_WORD_ALIGNMENT_CONFIDENCE
                                ? "Reliable threshold met for word-level playback helpers."
                                : "Below 0.85, word timings stay editable but are not marked reliable."}
                            </div>
                          </div>

                          <div>
                            <StyledSelect
                              label="Snap Step"
                              value={wordSnapStepMs}
                              onChange={(e) => setWordSnapStepMs(Number(e.target.value))}
                              options={WORD_SNAP_STEP_OPTIONS.map((step) => ({
                                value: step,
                                label: `${step} ms`,
                              }))}
                              fullWidth
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={syncWordsFromTranscript}
                            className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                          >
                            Split From Transcript
                          </button>
                          <button
                            type="button"
                            onClick={addAlignmentWord}
                            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            Add Word
                          </button>
                          <button
                            type="button"
                            onClick={redistributeAlignmentWords}
                            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            Redistribute Evenly
                          </button>
                        </div>

                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          Use the waveform as the visual anchor, then nudge, expand, snap edges, or preview one word clip at a time.
                        </div>

                        <div className="space-y-3">
                          {alignmentWords.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-3 text-sm text-gray-600 dark:text-gray-400">
                              No word timings yet. Use “Split From Transcript” to seed them from the phrase.
                            </div>
                          ) : alignmentWords.map((word, index) => (
                            <div key={`${index}-${word.word}`} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3 xl:grid-cols-[minmax(0,2fr)_120px_120px_minmax(0,320px)_auto] xl:items-end">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Word {index + 1}
                                </label>
                                <input
                                  type="text"
                                  value={word.word}
                                  onChange={(e) => updateAlignmentWord(index, "word", e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Start (ms)
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  value={word.start_ms}
                                  onChange={(e) => updateAlignmentWord(index, "start_ms", Number(e.target.value || 0))}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  End (ms)
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  value={word.end_ms}
                                  onChange={(e) => updateAlignmentWord(index, "end_ms", Number(e.target.value || 0))}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Snap Helpers
                                </label>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => shiftAlignmentWord(index, -wordSnapStepMs)}
                                    className="px-2.5 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                                  >
                                    -{wordSnapStepMs} ms
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => shiftAlignmentWord(index, wordSnapStepMs)}
                                    className="px-2.5 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                                  >
                                    Shift +
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => expandAlignmentWord(index, wordSnapStepMs, "left")}
                                    className="px-2.5 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                                  >
                                    Expand Left
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => expandAlignmentWord(index, wordSnapStepMs, "right")}
                                    className="px-2.5 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                                  >
                                    Expand Right
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => snapAlignmentWordEdge(index, "start")}
                                    className="px-2.5 py-2 rounded-lg border border-indigo-300 text-xs text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/20"
                                  >
                                    Snap Start
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => snapAlignmentWordEdge(index, "end")}
                                    className="px-2.5 py-2 rounded-lg border border-indigo-300 text-xs text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/20"
                                  >
                                    Snap End
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => snapAlignmentWordToBounds(index)}
                                    className="px-2.5 py-2 rounded-lg border border-indigo-300 text-xs text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/20"
                                  >
                                    Snap To Bounds
                                  </button>
                                </div>
                              </div>
                              <div className="flex flex-col gap-2 xl:items-end">
                                <button
                                  type="button"
                                  onClick={() => previewWordTiming(word, index)}
                                  className="px-3 py-2 rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/20"
                                >
                                  {previewingWordIndex === index ? "Stop Clip" : "Play Clip"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeAlignmentWord(index)}
                                  className="px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                                >
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
                      disabled={alignmentSaving || !editingPhrase || !formData.audio_url.trim()}
                      className="px-3 py-2 rounded-lg border border-indigo-300 text-indigo-700 hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/20"
                    >
                      Requeue Auto-Align
                    </button>
                    <button
                      type="button"
                      onClick={() => saveAlignment("draft")}
                      disabled={alignmentSaving}
                      className="px-3 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60"
                    >
                      Save Draft
                    </button>
                    <button
                      type="button"
                      onClick={() => saveAlignment("reviewed")}
                      disabled={alignmentSaving}
                      className="px-3 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60"
                    >
                      Save Reviewed
                    </button>
                    <button
                      type="button"
                      onClick={approveAlignment}
                      disabled={alignmentSaving || !alignmentRecord}
                      className="px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
                    >
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
                  {editingPhrase ? "Update" : "Create"}
                </button>
              </div>
        </form>
      </Modal>

      <Modal
        isOpen={showBulkRegenerateConfirm}
        onClose={() => {
          if (!isBulkRegenerating) {
            setShowBulkRegenerateConfirm(false);
            setBulkRegenerateProvider("");
            setBulkRegenerateVoiceId("");
          }
        }}
        title={`Regenerate Audio for ${selectedPhrases.length} Phrase${selectedPhrases.length === 1 ? "" : "s"}`}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Provider *
            </label>
            {isLoadingVoices ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">Loading providers...</div>
            ) : (
              <select
                value={bulkRegenerateProvider}
                onChange={(e) => {
                  setBulkRegenerateProvider(e.target.value);
                  setBulkRegenerateVoiceId("");
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              >
                <option value="">Select provider</option>
                {Array.from(new Set(
                  availableVoices
                    .filter((voice) => {
                      const selectedLanguageRecord = languages.find((lang: any) => lang.id === selectedLanguage);
                      const voicePrefix = mapIso6393ToVoicePrefix(selectedLanguageRecord?.iso_639_3);
                      return (
                        typeof voice.language_code === "string"
                        && (voice.language_code === voicePrefix || voice.language_code.startsWith(`${voicePrefix}-`))
                      );
                    })
                    .map((voice) => String(voice.provider || "").trim())
                    .filter(Boolean)
                ))
                  .sort((a, b) => voiceProviderPriority(a) - voiceProviderPriority(b) || a.localeCompare(b))
                  .map((provider) => (
                    <option key={provider} value={provider}>
                      {provider}
                    </option>
                  ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Voice *
            </label>
            {isLoadingVoices ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">Loading voices...</div>
            ) : (
              <select
                value={bulkRegenerateVoiceId}
                onChange={(e) => setBulkRegenerateVoiceId(e.target.value)}
                disabled={!bulkRegenerateProvider}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              >
                <option value="">{bulkRegenerateProvider ? "Select voice" : "Select provider first"}</option>
                {availableVoices
                  .filter((voice) => {
                    const selectedLanguageRecord = languages.find((lang: any) => lang.id === selectedLanguage);
                    const voicePrefix = mapIso6393ToVoicePrefix(selectedLanguageRecord?.iso_639_3);
                    return (
                      typeof voice.language_code === "string"
                      && voice.provider === bulkRegenerateProvider
                      && (voice.language_code === voicePrefix || voice.language_code.startsWith(`${voicePrefix}-`))
                    );
                  })
                  .map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.display_name || voice.voice_name} ({voice.provider})
                      {voice.gender ? ` - ${voice.gender}` : ""}
                    </option>
                  ))}
              </select>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Provider and voice are required for bulk regeneration.
            </p>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400">
            This will queue fresh TTS generation jobs for the selected phrases. Successful jobs will then trigger auto-alignment in the background.
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={confirmBulkRegenerateAudio}
              disabled={isBulkRegenerating || isLoadingVoices || !bulkRegenerateProvider || !bulkRegenerateVoiceId}
              className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBulkRegenerating ? "Regenerating..." : "Regenerate"}
            </button>
            <button
              type="button"
              onClick={() => setShowBulkRegenerateConfirm(false)}
              disabled={isBulkRegenerating}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Phrase"
        message={`Are you sure you want to delete "${deleteConfirm?.phrase?.substring(0, 50)}${deleteConfirm?.phrase && deleteConfirm.phrase.length > 50 ? '...' : ''}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      <RegenerateAudioModal
        isOpen={showRegenerateModal}
        onClose={() => {
          setShowRegenerateModal(false);
          setRegeneratingTarget(null);
        }}
        target={regeneratingTarget}
        onSuccess={() => {
          if (regeneratingTarget?.id) {
            setPhrases((current) =>
              current.map((phrase) =>
                phrase.id === regeneratingTarget.id
                  ? {
                      ...phrase,
                      last_regeneration_status: "queued",
                      last_regeneration_error: null,
                    }
                  : phrase
              )
            );
          }
          scheduleQueuedAudioRefresh(() => {
            fetchPhrases(selectedLanguage, page, alignmentFilter);
          });
        }}
      />
    </div>
  );
}

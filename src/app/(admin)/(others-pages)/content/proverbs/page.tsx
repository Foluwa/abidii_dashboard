"use client";

import React, { useState } from "react";
import { useProverbs, useLanguages } from "@/hooks/useApi";
import { apiClient } from "@/lib/api";
import type { Proverb } from "@/types/api";
import {
  ContentPageHeader,
  ContentStatsCard,
  ContentStatsGrid,
  ContentFiltersCard,
  ActiveFilterChips,
  StickyBulkActionBar,
} from '@/components/admin/layout';
import { FiVolume2, FiGlobe, FiBarChart2, FiCheckCircle, FiAlertTriangle } from "react-icons/fi";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Toast from "@/components/ui/toast/Toast";
import Alert from "@/components/ui/alert/Alert";
import { StyledSelect } from "@/components/ui/form/StyledSelect";
import { ConfirmationModal } from "@/components/ui/modal/ConfirmationModal";
import { Modal } from "@/components/ui/modal";
import { AudioWaveform } from "@/components/ui/audio/AudioWaveform";
import ProverbsDataTable from "@/components/tables/ProverbsDataTable";
import Pagination from "@/components/tables/Pagination";
import { GoogleSheetsBulkImport } from "@/components/admin/GoogleSheetsBulkImport";
import { RegenerateAudioModal } from "@/components/modals/RegenerateAudioModal";
import { scheduleQueuedAudioRefresh } from "@/lib/audioRegeneration";
import { createProverbCleanupJob, type AdminJob } from "@/lib/adminJobsApi";
import { useAdminJob } from "@/hooks/useAdminJob";

type AlignmentStatus = "draft" | "reviewed" | "approved" | "stale";

interface ProverbAlignmentSegment {
  segment_id: string;
  text: string;
  start_ms: number;
  end_ms: number;
}

interface ProverbAlignmentWord {
  word: string;
  start_ms: number;
  end_ms: number;
}

interface ProverbAlignment {
  id: string;
  content_type: string;
  content_id: string;
  audio_url: string;
  transcript_display: string;
  status: AlignmentStatus;
  confidence?: number | null;
  source?: string | null;
  version: number;
  word_timing_reliable: boolean;
  provider_used?: string | null;
  engine_used?: string | null;
  approved_at?: string | null;
  stale_at?: string | null;
  stale_reason?: string | null;
  updated_at: string;
  alignment_json: {
    segments: ProverbAlignmentSegment[];
    words: ProverbAlignmentWord[];
  };
}

const DEFAULT_WORD_ALIGNMENT_CONFIDENCE = 0.85;
const DEFAULT_WORD_SNAP_STEP_MS = 25;
const WORD_SNAP_STEP_OPTIONS = [10, 25, 50, 100];
const PRIMARY_SEGMENT_ID = "full";
const PROMPT_SEGMENT_ID = "prompt";
const ANSWER_SEGMENT_ID = "answer";

const createDefaultAlignmentWord = (): ProverbAlignmentWord => ({
  word: "",
  start_ms: 0,
  end_ms: 0,
});

const createDefaultAlignmentSegment = (text = ""): ProverbAlignmentSegment => ({
  segment_id: PRIMARY_SEGMENT_ID,
  text,
  start_ms: 0,
  end_ms: 0,
});

const tokenizeWords = (text: string): string[] => (
  text.trim().split(/\s+/).filter(Boolean)
);

const clampMs = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeSegmentId = (segmentId: string) => segmentId.trim().toLowerCase();

const findAlignmentSegment = (
  segments: ProverbAlignmentSegment[],
  segmentId: string,
) => segments.find((segment) => normalizeSegmentId(segment.segment_id) === segmentId);

const seedAlignmentWords = (
  text: string,
  segment: ProverbAlignmentSegment,
  existingWords: ProverbAlignmentWord[] = [],
): ProverbAlignmentWord[] => {
  const tokens = tokenizeWords(text);
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

const spreadWordsAcrossSegment = (
  words: ProverbAlignmentWord[],
  segment: ProverbAlignmentSegment,
): ProverbAlignmentWord[] => {
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

const buildPrimaryAlignmentSegment = (
  transcriptText: string,
  segments: ProverbAlignmentSegment[],
  words: ProverbAlignmentWord[],
): ProverbAlignmentSegment => {
  const explicitPrimary = segments.find((segment) => (
    ![PROMPT_SEGMENT_ID, ANSWER_SEGMENT_ID].includes(normalizeSegmentId(segment.segment_id))
  ));

  if (explicitPrimary) {
    return {
      ...explicitPrimary,
      segment_id: PRIMARY_SEGMENT_ID,
      text: explicitPrimary.text || transcriptText,
    };
  }

  const startCandidates = words.length > 0
    ? [words[0].start_ms]
    : segments.map((segment) => segment.start_ms);
  const endCandidates = words.length > 0
    ? [words[words.length - 1].end_ms]
    : segments.map((segment) => segment.end_ms);

  return {
    segment_id: PRIMARY_SEGMENT_ID,
    text: transcriptText,
    start_ms: startCandidates.length > 0 ? Math.min(...startCandidates) : 0,
    end_ms: endCandidates.length > 0 ? Math.max(...endCandidates) : 0,
  };
};

const inferGameSplitAnswerStartIndex = (
  segments: ProverbAlignmentSegment[],
  words: ProverbAlignmentWord[],
  existingPromptText?: string | null,
  existingAnswerText?: string | null,
): number | null => {
  if (words.length < 2) {
    return null;
  }

  const answerSegment = findAlignmentSegment(segments, ANSWER_SEGMENT_ID);
  if (answerSegment) {
    const firstAnswerWordIndex = words.findIndex((word) => word.start_ms >= answerSegment.start_ms);
    if (firstAnswerWordIndex > 0) {
      return firstAnswerWordIndex;
    }
  }

  const promptWordCount = tokenizeWords(existingPromptText || "").length;
  const answerWordCount = tokenizeWords(existingAnswerText || "").length;
  if (promptWordCount > 0 && answerWordCount > 0 && promptWordCount < words.length) {
    return promptWordCount;
  }

  return null;
};

const buildDerivedGameSplit = (
  primarySegment: ProverbAlignmentSegment,
  words: ProverbAlignmentWord[],
  answerStartIndex: number | null,
) => {
  if (answerStartIndex === null || answerStartIndex <= 0 || answerStartIndex >= words.length) {
    return null;
  }

  const promptWords = words.slice(0, answerStartIndex);
  const answerWords = words.slice(answerStartIndex);
  if (promptWords.length === 0 || answerWords.length === 0) {
    return null;
  }

  return {
    promptSegment: {
      segment_id: PROMPT_SEGMENT_ID,
      text: promptWords.map((word) => word.word.trim()).filter(Boolean).join(" "),
      start_ms: primarySegment.start_ms,
      end_ms: Math.max(promptWords[promptWords.length - 1].end_ms, primarySegment.start_ms + 1),
    },
    answerSegment: {
      segment_id: ANSWER_SEGMENT_ID,
      text: answerWords.map((word) => word.word.trim()).filter(Boolean).join(" "),
      start_ms: Math.max(answerWords[0].start_ms, primarySegment.start_ms),
      end_ms: Math.max(primarySegment.end_ms, answerWords[answerWords.length - 1].end_ms),
    },
  };
};

const renderAlignmentJobBadge = (proverb: Proverb) => {
  if (!proverb.alignment_job_status) {
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

  const providerDetail = [proverb.alignment_job_provider, proverb.alignment_job_engine].filter(Boolean).join(" / ");
  const detail = proverb.alignment_job_status === "failed" && proverb.alignment_job_error
    ? `Auto-alignment failed: ${proverb.alignment_job_error}`
    : providerDetail
      ? `Latest auto-alignment job ${proverb.alignment_job_status} via ${providerDetail}`
      : `Latest auto-alignment job ${proverb.alignment_job_status}`;

  const badgeLabel = proverb.alignment_job_status === "failed"
    ? "Align Failed"
    : `Align ${proverb.alignment_job_status.charAt(0).toUpperCase() + proverb.alignment_job_status.slice(1)}`;

  const errorSnippet =
    proverb.alignment_job_status === "failed" && proverb.alignment_job_error
      ? proverb.alignment_job_error.length > 80
        ? proverb.alignment_job_error.slice(0, 80) + "…"
        : proverb.alignment_job_error
      : null;

  return (
    <div className="flex flex-col items-start gap-1">
      <span
        title={detail}
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClasses[proverb.alignment_job_status]}`}
      >
        {badgeLabel}
      </span>
      {errorSnippet && (
        <p
          className="text-[11px] text-red-600 dark:text-red-400 leading-tight max-w-[200px] truncate"
          title={proverb.alignment_job_error ?? undefined}
        >
          {errorSnippet}
        </p>
      )}
    </div>
  );
};

export default function ProverbsPage() {
  const [selectedLanguage, setSelectedLanguage] = useState<string | undefined>(undefined);
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [showModal, setShowModal] = useState(false);
  const [editingProverb, setEditingProverb] = useState<Proverb | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; proverb: string } | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [regeneratingTarget, setRegeneratingTarget] = useState<any | null>(null);
  const [selectedProverbs, setSelectedProverbs] = useState<string[]>([]);
  const [showBulkRegenerateConfirm, setShowBulkRegenerateConfirm] = useState(false);
  const [isBulkRegenerating, setIsBulkRegenerating] = useState(false);
  const [bulkRegenerateLanguage, setBulkRegenerateLanguage] = useState<string>("yoruba");
  const [bulkRegenerateVoiceId, setBulkRegenerateVoiceId] = useState<string>("");
  const [availableVoices, setAvailableVoices] = useState<any[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [proverbCleanupJob, setProverbCleanupJob] = useState<AdminJob | null>(null);
  const [proverbCleanupLoading, setProverbCleanupLoading] = useState(false);
  const [showProverbCleanupApplyConfirm, setShowProverbCleanupApplyConfirm] = useState(false);
  const [alignmentRecord, setAlignmentRecord] = useState<ProverbAlignment | null>(null);
  const [alignmentStatus, setAlignmentStatus] = useState<AlignmentStatus>("draft");
  const [alignmentPrimarySegment, setAlignmentPrimarySegment] = useState<ProverbAlignmentSegment>(createDefaultAlignmentSegment());
  const [alignmentWords, setAlignmentWords] = useState<ProverbAlignmentWord[]>([]);
  const [resolvedAudioDurationMs, setResolvedAudioDurationMs] = useState<number | null>(null);
  const [gameSplitEnabled, setGameSplitEnabled] = useState(false);
  const [gameSplitAnswerStartIndex, setGameSplitAnswerStartIndex] = useState<number | null>(null);
  const [alignmentConfidence, setAlignmentConfidence] = useState(DEFAULT_WORD_ALIGNMENT_CONFIDENCE);
  const [wordSnapStepMs, setWordSnapStepMs] = useState(DEFAULT_WORD_SNAP_STEP_MS);
  const [wordTimingsEnabled, setWordTimingsEnabled] = useState(false);
  const [alignmentLoading, setAlignmentLoading] = useState(false);
  const [alignmentSaving, setAlignmentSaving] = useState(false);
  const [alignmentError, setAlignmentError] = useState("");
  const [previewingWordIndex, setPreviewingWordIndex] = useState<number | null>(null);
  const wordPreviewAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const [search, setSearch] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showCleanupAccordion, setShowCleanupAccordion] = useState(false);

  // Helper to format error messages (handles both string and object errors)
  const formatErrorMessage = (error: any, fallbackMessage: string): string => {
    const detail = error?.response?.data?.detail;
    
    // If detail is a string, return it
    if (typeof detail === 'string') {
      return detail;
    }
    
    // If detail is an array (Pydantic validation errors)
    if (Array.isArray(detail) && detail.length > 0) {
      // Extract first error message
      const firstError = detail[0];
      return firstError.msg || firstError.message || JSON.stringify(firstError);
    }
    
    // If detail is an object, try to extract a message
    if (typeof detail === 'object' && detail !== null) {
      return detail.msg || detail.message || JSON.stringify(detail);
    }
    
    // Fallback to error message or default
    return error?.message || fallbackMessage;
  };

  const { proverbs, total, isLoading, isError, refresh } = useProverbs({ 
    language_id: selectedLanguage, 
    category, 
    page, 
    limit 
  });
  const { languages } = useLanguages();
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Deduplicate proverbs to prevent duplicate key errors
  const uniqueProverbs = React.useMemo(() => {
    if (!proverbs) return [];
    const seen = new Set<string>();
    return proverbs.filter((proverb: Proverb) => {
      if (seen.has(proverb.id)) {
        return false;
      }
      seen.add(proverb.id);
      return true;
    });
  }, [proverbs]);

  const derivedGameSplit = React.useMemo(() => (
    gameSplitEnabled
      ? buildDerivedGameSplit(alignmentPrimarySegment, alignmentWords, gameSplitAnswerStartIndex)
      : null
  ), [alignmentPrimarySegment, alignmentWords, gameSplitAnswerStartIndex, gameSplitEnabled]);

  // Stats
  const stats = React.useMemo(() => {
    const withAudio = uniqueProverbs.filter((p: Proverb) => p.audio_url).length;
    const aligned = uniqueProverbs.filter((p: Proverb) => p.alignment_status === 'approved' || p.alignment_status === 'reviewed').length;
    const needsCleanup = uniqueProverbs.filter((p: Proverb) => p.alignment_job_status === 'failed').length;
    return { total, withAudio, aligned, needsCleanup };
  }, [uniqueProverbs, total]);

  // Active filters
  const activeFilters = [] as { label: string; onClear: () => void }[];
  if (selectedLanguage) {
    const lang = languages?.find((l: any) => l.id === selectedLanguage);
    activeFilters.push({ label: `Language: ${lang?.name || selectedLanguage}`, onClear: () => { setSelectedLanguage(undefined); setPage(1); } });
  }
  if (search) activeFilters.push({ label: `Search: "${search}"`, onClear: () => { setSearch(""); setPage(1); } });
  if (category) activeFilters.push({ label: `Category: ${category}`, onClear: () => { setCategory(""); setPage(1); } });

  const clearAllFilters = () => {
    setSelectedLanguage(undefined);
    setSearch("");
    setCategory("");
    setPage(1);
  };

  const resetAlignmentState = (transcriptText = "") => {
    setAlignmentRecord(null);
    setAlignmentStatus("draft");
    setAlignmentPrimarySegment(createDefaultAlignmentSegment(transcriptText));
    setAlignmentWords([]);
    setResolvedAudioDurationMs(null);
    setGameSplitEnabled(false);
    setGameSplitAnswerStartIndex(null);
    setAlignmentConfidence(DEFAULT_WORD_ALIGNMENT_CONFIDENCE);
    setWordSnapStepMs(DEFAULT_WORD_SNAP_STEP_MS);
    setWordTimingsEnabled(false);
    setPreviewingWordIndex(null);
    setAlignmentLoading(false);
    setAlignmentSaving(false);
    setAlignmentError("");
  };

  const updateAlignmentPrimarySegment = (updater: Partial<ProverbAlignmentSegment>) => {
    setAlignmentPrimarySegment((current) => ({
      ...current,
      ...updater,
      segment_id: PRIMARY_SEGMENT_ID,
    }));
  };

  const resolveAudioDurationMs = React.useCallback(async () => {
    if (resolvedAudioDurationMs && resolvedAudioDurationMs > 0) {
      return resolvedAudioDurationMs;
    }

    const durationFromApi = editingProverb?.audio_duration;
    if (typeof durationFromApi === "number" && durationFromApi > 0) {
      const durationMs = Math.round(durationFromApi * 1000);
      setResolvedAudioDurationMs(durationMs);
      return durationMs;
    }

    const audioUrl = editingProverb?.audio_url;
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
  }, [editingProverb?.audio_duration, editingProverb?.audio_url, resolvedAudioDurationMs]);

  const ensurePrimaryAlignmentWindow = async () => {
    if (alignmentPrimarySegment.end_ms > alignmentPrimarySegment.start_ms) {
      return alignmentPrimarySegment;
    }

    const durationMs = await resolveAudioDurationMs();
    if (!durationMs || durationMs <= 0) {
      setAlignmentError("Could not determine proverb audio duration automatically. Regenerate or upload audio, then try again.");
      return null;
    }

    const safeStartMs = alignmentPrimarySegment.start_ms >= 0 && alignmentPrimarySegment.start_ms < durationMs
      ? alignmentPrimarySegment.start_ms
      : 0;
    const nextSegment = {
      ...alignmentPrimarySegment,
      start_ms: safeStartMs,
      end_ms: durationMs,
    };
    setAlignmentPrimarySegment(nextSegment);
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

  const previewWordTiming = async (word: ProverbAlignmentWord, index: number) => {
    if (!editingProverb?.audio_url) {
      setAlignmentError("No proverb audio available for word preview");
      return;
    }

    if (previewingWordIndex === index) {
      stopWordPreview();
      return;
    }

    stopWordPreview();

    const audio = new Audio(editingProverb.audio_url);
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
      } catch (error) {
        console.error("Failed to preview proverb word timing:", error);
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
      setAlignmentError("Failed to load proverb audio for preview");
      finishPlayback();
    };

    audio.preload = "auto";
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.src = editingProverb.audio_url;
  };

  React.useEffect(() => {
    if (!editingProverb?.audio_url) {
      return;
    }
    if (alignmentPrimarySegment.end_ms > alignmentPrimarySegment.start_ms) {
      return;
    }

    let cancelled = false;

    void resolveAudioDurationMs().then((durationMs) => {
      if (cancelled || !durationMs || durationMs <= 0) {
        return;
      }

      setAlignmentPrimarySegment((current) => {
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
  }, [editingProverb?.audio_url, editingProverb?.audio_duration, alignmentPrimarySegment.end_ms, alignmentPrimarySegment.start_ms, resolveAudioDurationMs]);

  React.useEffect(() => {
    return () => {
      stopWordPreview();
    };
  }, [stopWordPreview]);

  const validateAlignment = () => {
    if (!alignmentPrimarySegment.text.trim()) {
      return "Full proverb text is required for alignment";
    }

    if (alignmentPrimarySegment.end_ms <= alignmentPrimarySegment.start_ms) {
      return "The proverb timing window must have an end time greater than its start time";
    }

    if (!wordTimingsEnabled) {
      if (gameSplitEnabled) {
        return "Enable and save word timings before defining a sentence-completion split";
      }
      return null;
    }

    let previousWordEnd = alignmentPrimarySegment.start_ms;
    for (const word of alignmentWords) {
      if (!word.word.trim()) {
        return "Word timings cannot include blank words";
      }
      if (word.end_ms <= word.start_ms) {
        return "Each word timing must have an end time greater than its start time";
      }
      if (word.start_ms < previousWordEnd) {
        return "Word timings must stay sorted and non-overlapping";
      }
      if (word.start_ms < alignmentPrimarySegment.start_ms || word.end_ms > alignmentPrimarySegment.end_ms) {
        return "Word timings must stay inside the proverb timing window";
      }
      previousWordEnd = word.end_ms;
    }

    if (gameSplitEnabled) {
      if (alignmentWords.length < 2) {
        return "Generate at least two word timings before defining a sentence-completion split";
      }
      if (
        gameSplitAnswerStartIndex === null
        || gameSplitAnswerStartIndex <= 0
        || gameSplitAnswerStartIndex >= alignmentWords.length
      ) {
        return "Choose the word where the completion should begin";
      }
    }

    return null;
  };

  const syncWordsFromTranscript = async () => {
    const segment = await ensurePrimaryAlignmentWindow();
    if (!segment) {
      return;
    }

    setAlignmentError("");
    setWordTimingsEnabled(true);
    setAlignmentWords((current) => seedAlignmentWords(segment.text, segment, current));
  };

  const addAlignmentWord = async () => {
    const segment = await ensurePrimaryAlignmentWindow();
    if (!segment) {
      return;
    }

    setWordTimingsEnabled(true);
    setAlignmentWords((current) => {
      const fallbackStart = current.length > 0
        ? Math.min(current[current.length - 1].end_ms, segment.end_ms - 1)
        : segment.start_ms;

      return [
        ...current,
        {
          ...createDefaultAlignmentWord(),
          start_ms: fallbackStart,
          end_ms: Math.min(segment.end_ms, fallbackStart + 100),
        },
      ];
    });
  };

  const redistributeAlignmentWords = async () => {
    const segment = await ensurePrimaryAlignmentWindow();
    if (!segment) {
      return;
    }

    setAlignmentError("");
    setWordTimingsEnabled(true);
    setAlignmentWords((current) => {
      const source = current.length > 0
        ? current
        : tokenizeWords(segment.text).map((word) => ({ ...createDefaultAlignmentWord(), word }));
      return spreadWordsAcrossSegment(source, segment);
    });
  };

  const updateAlignmentWord = (
    index: number,
    field: keyof ProverbAlignmentWord,
    value: string | number,
  ) => {
    setAlignmentWords((current) => current.map((word, currentIndex) => (
      currentIndex === index
        ? { ...word, [field]: value }
        : word
    )));
  };

  const shiftAlignmentWord = (index: number, deltaMs: number) => {
    setAlignmentWords((current) => current.map((word, currentIndex) => {
      if (currentIndex !== index) {
        return word;
      }

      const duration = Math.max(1, word.end_ms - word.start_ms);
      const minStart = currentIndex === 0 ? alignmentPrimarySegment.start_ms : current[currentIndex - 1].end_ms;
      const maxEnd = currentIndex === current.length - 1 ? alignmentPrimarySegment.end_ms : current[currentIndex + 1].start_ms;
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

      const minStart = currentIndex === 0 ? alignmentPrimarySegment.start_ms : current[currentIndex - 1].end_ms;
      const maxEnd = currentIndex === current.length - 1 ? alignmentPrimarySegment.end_ms : current[currentIndex + 1].start_ms;

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

      const minStart = currentIndex === 0 ? alignmentPrimarySegment.start_ms : current[currentIndex - 1].end_ms;
      const maxEnd = currentIndex === current.length - 1 ? alignmentPrimarySegment.end_ms : current[currentIndex + 1].start_ms;
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

      const minStart = currentIndex === 0 ? alignmentPrimarySegment.start_ms : current[currentIndex - 1].end_ms;
      const maxEnd = currentIndex === current.length - 1 ? alignmentPrimarySegment.end_ms : current[currentIndex + 1].start_ms;
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

  const removeAlignmentWord = (index: number) => {
    setAlignmentWords((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const loadAlignment = async (proverb: Proverb) => {
    setAlignmentLoading(true);
    setAlignmentError("");
    try {
      const response = await apiClient.get<ProverbAlignment>(
        `/api/v1/admin/content/proverbs/${proverb.id}/alignment`
      );
      const alignment = response.data;
      const loadedWords = alignment.alignment_json.words || [];
      const loadedPrimarySegment = buildPrimaryAlignmentSegment(
        alignment.transcript_display || proverb.proverb,
        alignment.alignment_json.segments || [],
        loadedWords,
      );
      const initialSplitIndex = inferGameSplitAnswerStartIndex(
        alignment.alignment_json.segments || [],
        loadedWords,
        proverb.yoruba_prompt,
        proverb.yoruba_answer,
      );

      setAlignmentRecord(alignment);
      setAlignmentStatus(alignment.status);
      setAlignmentPrimarySegment(loadedPrimarySegment);
      setAlignmentWords(loadedWords);
      setGameSplitEnabled(initialSplitIndex !== null);
      setGameSplitAnswerStartIndex(initialSplitIndex);
      setAlignmentConfidence(alignment.confidence ?? DEFAULT_WORD_ALIGNMENT_CONFIDENCE);
      setWordTimingsEnabled(loadedWords.length > 0);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setAlignmentRecord(null);
        setAlignmentStatus("draft");
        setAlignmentPrimarySegment(createDefaultAlignmentSegment(proverb.proverb));
        setAlignmentWords([]);
        setGameSplitEnabled(false);
        setGameSplitAnswerStartIndex(null);
        setAlignmentConfidence(DEFAULT_WORD_ALIGNMENT_CONFIDENCE);
        setWordTimingsEnabled(false);
      } else {
        setAlignmentError(err.response?.data?.detail || "Failed to load proverb alignment");
      }
    } finally {
      setAlignmentLoading(false);
    }
  };

  const saveAlignment = async (status: AlignmentStatus) => {
    if (!editingProverb) {
      return;
    }
    if (!editingProverb.audio_url) {
      setAlignmentError("Generate or upload proverb audio before saving alignment timings");
      return;
    }

    const validationError = validateAlignment();
    if (validationError) {
      setAlignmentError(validationError);
      return;
    }

    setAlignmentSaving(true);
    setAlignmentError("");
    try {
      const payloadSegments = derivedGameSplit
        ? [derivedGameSplit.promptSegment, derivedGameSplit.answerSegment]
        : [{ ...alignmentPrimarySegment, segment_id: PRIMARY_SEGMENT_ID, text: alignmentPrimarySegment.text.trim() }];

      const response = await apiClient.put<ProverbAlignment>(
        `/api/v1/admin/content/proverbs/${editingProverb.id}/alignment`,
        {
          audio_url: editingProverb.audio_url,
          status,
          confidence: wordTimingsEnabled ? alignmentConfidence : null,
          segments: payloadSegments,
          words: wordTimingsEnabled ? alignmentWords : [],
        }
      );

      const savedAlignment = response.data;
      const savedWords = savedAlignment.alignment_json.words || [];
      const savedPrimarySegment = buildPrimaryAlignmentSegment(
        savedAlignment.transcript_display || editingProverb.proverb,
        savedAlignment.alignment_json.segments || [],
        savedWords,
      );
      const savedSplitIndex = inferGameSplitAnswerStartIndex(
        savedAlignment.alignment_json.segments || [],
        savedWords,
        editingProverb.yoruba_prompt,
        editingProverb.yoruba_answer,
      );

      setAlignmentRecord(savedAlignment);
      setAlignmentStatus(savedAlignment.status);
      setAlignmentPrimarySegment(savedPrimarySegment);
      setAlignmentWords(savedWords);
      setGameSplitEnabled(savedSplitIndex !== null);
      setGameSplitAnswerStartIndex(savedSplitIndex);
      setAlignmentConfidence(savedAlignment.confidence ?? DEFAULT_WORD_ALIGNMENT_CONFIDENCE);
      setWordTimingsEnabled(savedWords.length > 0);
      refresh();
      setSuccessMessage(status === "reviewed" ? "Alignment saved for review" : "Alignment saved");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err: any) {
      setAlignmentError(err.response?.data?.detail || "Failed to save proverb alignment");
    } finally {
      setAlignmentSaving(false);
    }
  };

  const approveAlignment = async () => {
    if (!editingProverb) {
      return;
    }

    setAlignmentSaving(true);
    setAlignmentError("");
    try {
      const response = await apiClient.post<ProverbAlignment>(
        `/api/v1/admin/content/proverbs/${editingProverb.id}/alignment/approve`
      );
      const approvedAlignment = response.data;
      const approvedWords = approvedAlignment.alignment_json.words || [];
      const approvedPrimarySegment = buildPrimaryAlignmentSegment(
        approvedAlignment.transcript_display || editingProverb.proverb,
        approvedAlignment.alignment_json.segments || [],
        approvedWords,
      );
      const approvedSplitIndex = inferGameSplitAnswerStartIndex(
        approvedAlignment.alignment_json.segments || [],
        approvedWords,
        editingProverb.yoruba_prompt,
        editingProverb.yoruba_answer,
      );
      const approvedGameSplit = approvedSplitIndex !== null
        ? buildDerivedGameSplit(approvedPrimarySegment, approvedWords, approvedSplitIndex)
        : null;

      setAlignmentRecord(approvedAlignment);
      setAlignmentStatus(approvedAlignment.status);
      setAlignmentPrimarySegment(approvedPrimarySegment);
      setAlignmentWords(approvedWords);
      setGameSplitEnabled(approvedSplitIndex !== null);
      setGameSplitAnswerStartIndex(approvedSplitIndex);
      setAlignmentConfidence(approvedAlignment.confidence ?? DEFAULT_WORD_ALIGNMENT_CONFIDENCE);
      setWordTimingsEnabled(approvedWords.length > 0);
      setEditingProverb((current) => current ? {
        ...current,
        alignment_status: approvedAlignment.status,
        alignment_stale_reason: approvedAlignment.stale_reason || null,
        alignment_updated_at: approvedAlignment.updated_at,
        yoruba_prompt: approvedGameSplit?.promptSegment.text || null,
        yoruba_answer: approvedGameSplit?.answerSegment.text || null,
        is_game_ready: approvedGameSplit !== null,
      } : current);
      refresh();
      setSuccessMessage("Alignment approved");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err: any) {
      setAlignmentError(err.response?.data?.detail || "Failed to approve proverb alignment");
    } finally {
      setAlignmentSaving(false);
    }
  };

  const requeueAlignment = async () => {
    if (!editingProverb) {
      return;
    }

    setAlignmentSaving(true);
    setAlignmentError("");
    try {
      await apiClient.post(`/api/v1/admin/content/proverbs/${editingProverb.id}/alignment/requeue`);
      setEditingProverb((current) => current ? {
        ...current,
        alignment_job_status: "queued",
        alignment_job_provider: "google",
        alignment_job_engine: "chirp_2",
        alignment_job_error: null,
        alignment_job_updated_at: new Date().toISOString(),
      } : current);
      refresh();
      setSuccessMessage("Auto-alignment requeued");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err: any) {
      setAlignmentError(err.response?.data?.detail || "Failed to requeue proverb alignment");
    } finally {
      setAlignmentSaving(false);
    }
  };

  const renderModalAlignmentStatus = () => {
    const status = alignmentRecord?.status || alignmentStatus;
    const displayProverb = editingProverb || null;

    if (!status) {
      return null;
    }

    const statusClasses = {
      draft: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
      reviewed: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
      approved: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
      stale: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
    };

    const label = status.charAt(0).toUpperCase() + status.slice(1);
    const detail = status === "stale" && displayProverb?.alignment_stale_reason
      ? `Alignment stale: ${displayProverb.alignment_stale_reason.replaceAll("_", " ")}`
      : `Alignment ${status}`;

    return (
      <span
        title={detail}
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClasses[status]}`}
      >
        {label} Alignment
      </span>
    );
  };

  const [formData, setFormData] = useState({
    language_id: "",
    proverb: "",
    translation: "",
    meaning: "",
    category: "",
    is_published: false,
  });

  const openCreateModal = () => {
    setEditingProverb(null);
    resetAlignmentState();
    setFormData({
      language_id: selectedLanguage || (languages?.[0]?.id ?? 0),
      proverb: "",
      translation: "",
      meaning: "",
      category: "",
      is_published: false,
    });
    setAudioFile(null);
    setAudioPreview(null);
    setShowModal(true);
  };

  const openEditModal = async (proverb: Proverb) => {
    setEditingProverb(proverb);
    setFormData({
      language_id: proverb.language_id,
      proverb: proverb.proverb,
      translation: proverb.translation,
      meaning: proverb.meaning || "",
      category: proverb.category || "",
      is_published: proverb.is_published ?? false,
    });
    setAudioFile(null);
    setAudioPreview(proverb.audio_url || null);
    resetAlignmentState(proverb.proverb);
    setShowModal(true);

    try {
      const response = await apiClient.get<Proverb>(`/api/v1/admin/proverbs/${proverb.id}`);
      const proverbDetail = response.data;
      setEditingProverb(proverbDetail);
      setFormData({
        language_id: proverbDetail.language_id,
        proverb: proverbDetail.proverb,
        translation: proverbDetail.translation,
        meaning: proverbDetail.meaning || "",
        category: proverbDetail.category || "",
        is_published: proverbDetail.is_published ?? false,
      });
      setAudioPreview(proverbDetail.audio_url || null);
      resetAlignmentState(proverbDetail.proverb);
      await loadAlignment(proverbDetail);
    } catch (error: any) {
      setErrorMessage(formatErrorMessage(error, "Failed to load proverb details"));
    }
  };

  const closeModal = () => {
    stopWordPreview();
    setShowModal(false);
    setEditingProverb(null);
    setAudioFile(null);
    setAudioPreview(null);
    setErrorMessage("");
    resetAlignmentState();
  };

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('audio/')) {
        setErrorMessage('Please select a valid audio file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErrorMessage('Audio file must be less than 5MB');
        return;
      }
      setAudioFile(file);
      setAudioPreview(URL.createObjectURL(file));
      setErrorMessage("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    
    try {
      let proverbId: string;
      if (editingProverb) {
        await apiClient.put(`/api/v1/admin/proverbs/${editingProverb.id}`, formData);
        proverbId = editingProverb.id;
        setSuccessMessage("Proverb updated successfully");
      } else {
        const response = await apiClient.post("/api/v1/admin/proverbs", formData);
        proverbId = response.data.id;
        setSuccessMessage("Proverb created successfully");
      }

      // Upload audio if provided
      if (audioFile && proverbId) {
        setUploadingAudio(true);
        const audioFormData = new FormData();
        audioFormData.append('audio', audioFile);
        
        try {
          await apiClient.post(`/api/v1/admin/proverbs/${proverbId}/audio`, audioFormData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });
          setSuccessMessage(editingProverb ? "Proverb and audio updated successfully" : "Proverb and audio created successfully");
        } catch (audioError: any) {
          console.error('Audio upload error:', audioError);
          setErrorMessage('Proverb saved but audio upload failed: ' + formatErrorMessage(audioError, audioError.message || 'Unknown error'));
        } finally {
          setUploadingAudio(false);
        }
      }

      closeModal();
      refresh();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error: any) {
      setErrorMessage(formatErrorMessage(error, "Failed to save proverb"));
    }
  };

  const handleDeleteClick = (proverbId: string, proverbText: string) => {
    setDeleteConfirm({ id: proverbId, proverb: proverbText });
  };

  const handleSelectAllProverbs = () => {
    if (selectedProverbs.length === uniqueProverbs.length) {
      setSelectedProverbs([]);
      return;
    }

    setSelectedProverbs(uniqueProverbs.map((proverb: Proverb) => proverb.id));
  };

  const handleSelectProverb = (proverbId: string) => {
    setSelectedProverbs((prev) =>
      prev.includes(proverbId)
        ? prev.filter((id) => id !== proverbId)
        : [...prev, proverbId]
    );
  };

  const handleRegenerateAudio = (proverb: Proverb) => {
    const languageCode = languages?.find((lang: any) => lang.id === proverb.language_id)?.iso_639_3 || "yor";
    setRegeneratingTarget({
      id: proverb.id,
      contentType: "proverb",
      displayText: proverb.proverb,
      defaultText: proverb.proverb,
      languageCode,
      submitEndpoint: `/api/v1/admin/content/proverbs/${proverb.id}/regenerate-audio`,
    });
    setShowRegenerateModal(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    
    try {
      await apiClient.delete(`/api/v1/admin/proverbs/${deleteConfirm.id}`);
      setSuccessMessage("Proverb deleted successfully");
      setDeleteConfirm(null);
      refresh();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error: any) {
      setErrorMessage(formatErrorMessage(error, "Failed to delete proverb"));
      setDeleteConfirm(null);
      setTimeout(() => setErrorMessage(""), 5000);
    }
  };

  const handleAcceptAudio = async (proverbId: string, versionId: string) => {
    try {
      await apiClient.post(`/api/v1/admin/proverbs/${proverbId}/audio-versions/${versionId}/accept`);
      setSuccessMessage('Audio candidate accepted and set as current');
      refresh();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      setErrorMessage(formatErrorMessage(error, 'Failed to accept audio candidate'));
      setTimeout(() => setErrorMessage(''), 5000);
    }
  };

  const handleRejectAudio = async (proverbId: string, versionId: string) => {
    try {
      await apiClient.post(`/api/v1/admin/proverbs/${proverbId}/audio-versions/${versionId}/reject`);
      setSuccessMessage('Audio candidate rejected');
      refresh();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      setErrorMessage(formatErrorMessage(error, 'Failed to reject audio candidate'));
      setTimeout(() => setErrorMessage(''), 5000);
    }
  };

  const handleBulkRegenerateAudio = async () => {
    if (selectedProverbs.length === 0) return;
    
    // Fetch available voices when opening modal
    setIsLoadingVoices(true);
    try {
      const response = await apiClient.get("/api/v1/admin/audio/voices", {
        params: { is_active: true, limit: 100 }
      });
      const voices = response.data.voices || response.data.items || [];
      setAvailableVoices(voices);
      
      const languagePrefix = bulkRegenerateLanguage === "yoruba" ? "yo" : "en";
      const defaultVoice = voices.find((v: any) =>
        typeof v.language_code === "string" &&
        v.is_active &&
        (v.language_code === languagePrefix || v.language_code.startsWith(`${languagePrefix}-`))
      );
      setBulkRegenerateVoiceId(defaultVoice?.id || "");
    } catch (error) {
      console.error("Failed to load voices:", error);
      setAvailableVoices([]);
    } finally {
      setIsLoadingVoices(false);
    }
    
    setShowBulkRegenerateConfirm(true);
  };

  const trackedProverbCleanupJob = useAdminJob(proverbCleanupJob?.id);
  const currentProverbCleanupJob = trackedProverbCleanupJob.job ?? proverbCleanupJob;

  const queueProverbCleanupJob = async (dryRun: boolean) => {
    setProverbCleanupLoading(true);
    try {
      const job = await createProverbCleanupJob({ dry_run: dryRun });
      setProverbCleanupJob(job);
      setSuccessMessage(dryRun ? "Proverb cleanup preview queued." : "Proverb cleanup apply queued.");
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.detail ?? error?.message ?? "Failed to queue proverb cleanup job.");
    } finally {
      setProverbCleanupLoading(false);
      setShowProverbCleanupApplyConfirm(false);
    }
  };

  const confirmBulkRegenerateAudio = async () => {
    setIsBulkRegenerating(true);
    try {
      const payload: any = {
        proverb_ids: selectedProverbs,
        language: bulkRegenerateLanguage, // Send selected language
      };
      
      // Only include voice_id if one is selected
      if (bulkRegenerateVoiceId) {
        payload.voice_id = bulkRegenerateVoiceId;
      }
      
      await apiClient.post("/api/v1/admin/content/proverbs/bulk/regenerate-audio", payload);
      setSuccessMessage(`Audio regeneration started for ${selectedProverbs.length} ${bulkRegenerateLanguage} proverb(s)`);
      setSelectedProverbs([]);
      setShowBulkRegenerateConfirm(false);
      refresh();
      scheduleQueuedAudioRefresh(refresh);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error: any) {
      setErrorMessage(formatErrorMessage(error, "Failed to regenerate proverb audio"));
      setTimeout(() => setErrorMessage(""), 5000);
    } finally {
      setIsBulkRegenerating(false);
    }
  };

  if (isError) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="Proverbs" />
        <Alert variant="error" title="Error" message="Failed to load proverbs. Please check your API connection." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ContentPageHeader
        title="Proverbs"
        subtitle="Manage proverbs and cultural sayings"
        onAdd={openCreateModal}
        addLabel="Add Proverb"
      />

      {/* Messages */}
      {successMessage && <Toast type="success" message={successMessage} onClose={() => setSuccessMessage("")} />}
      {errorMessage && <Toast type="error" message={errorMessage} onClose={() => setErrorMessage("")} />}

      <ContentStatsGrid cols={4}>
        <ContentStatsCard label="Total" value={total} icon={FiBarChart2} />
        <ContentStatsCard label="With Audio" value={stats.withAudio} icon={FiVolume2} iconBgClass="bg-green-100 dark:bg-green-900/20" iconTextClass="text-green-600 dark:text-green-400" />
        <ContentStatsCard label="Aligned" value={stats.aligned} icon={FiCheckCircle} iconBgClass="bg-blue-100 dark:bg-blue-900/20" iconTextClass="text-blue-600 dark:text-blue-400" />
        <ContentStatsCard label="Needs Cleanup" value={stats.needsCleanup} icon={FiAlertTriangle} iconBgClass="bg-red-100 dark:bg-red-900/20" iconTextClass="text-red-600 dark:text-red-400" />
      </ContentStatsGrid>

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
              value={selectedLanguage || ""}
              onChange={(e) => {
                setSelectedLanguage(e.target.value || undefined);
                setPage(1);
              }}
              options={[
                { value: "", label: "All Languages" },
                ...(languages?.map((lang: any) => ({
                  value: lang.id,
                  label: lang.name
                })) || [])
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
              placeholder="Search proverbs..."
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
              }}
              options={[
                { value: 20, label: "20" },
                { value: 50, label: "50" },
                { value: 100, label: "100" }
              ]}
              fullWidth
            />
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="mt-5 border-t border-gray-100 pt-5 dark:border-white/[0.05]">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Category
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Filter by category..."
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
                />
              </div>
            </div>
          </div>
        )}

        <ActiveFilterChips filters={activeFilters} />
      </ContentFiltersCard>

      {/* Cleanup Accordion */}
      <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10">
        <button
          onClick={() => setShowCleanupAccordion(!showCleanupAccordion)}
          className="flex w-full items-center justify-between px-5 py-3 text-left"
        >
          <span className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            ▶ Old Audio Format Cleanup
          </span>
          <span className="text-xs text-amber-800 dark:text-amber-200">
            {showCleanupAccordion ? "Collapse" : "Expand"}
          </span>
        </button>
        {showCleanupAccordion && (
          <div className="border-t border-amber-200 px-5 py-4 dark:border-amber-500/20">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-amber-900/80 dark:text-amber-100/80">
                  Preview or remove old proverb audio database rows. Apply creates a backup table and does not delete R2 objects.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void queueProverbCleanupJob(true)}
                  disabled={proverbCleanupLoading}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900 disabled:opacity-60 dark:border-amber-500/30 dark:bg-gray-900 dark:text-amber-100"
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => setShowProverbCleanupApplyConfirm(true)}
                  disabled={proverbCleanupLoading}
                  className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  Apply
                </button>
              </div>
            </div>
            {currentProverbCleanupJob ? (
              <div className="mt-4 rounded-lg bg-white p-3 text-sm text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-xs">{currentProverbCleanupJob.id.slice(0, 8)}</span>
                  <span className="font-medium">{currentProverbCleanupJob.status}</span>
                  <span>{Math.round(currentProverbCleanupJob.progress.percent)}%</span>
                  {currentProverbCleanupJob.error ? <span className="text-red-600 dark:text-red-300">{currentProverbCleanupJob.error}</span> : null}
                </div>
                {currentProverbCleanupJob.result ? (
                  <div className="mt-2 grid gap-2 sm:grid-cols-4">
                    {([
                      ["Affected", currentProverbCleanupJob.result.candidate_count ?? 0],
                      ["Backed up", currentProverbCleanupJob.result.backup_count ?? "-"],
                      ["Deleted", currentProverbCleanupJob.result.deleted_count ?? "-"],
                      ["R2", currentProverbCleanupJob.result.r2_cleanup ?? "not_run"],
                    ] as Array<[string, unknown]>).map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-gray-200 p-2 dark:border-gray-800">
                        <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
                        <div className="mt-1 font-semibold text-gray-900 dark:text-white">{String(value)}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="mt-2 text-xs text-amber-700 dark:text-amber-200">
                  R2 object deletion is not handled by this dashboard action.
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Bulk Import from Google Sheets (has built-in accordion) */}
      {selectedLanguage && (
        <div className="mb-6">
          <GoogleSheetsBulkImport
            contentType="proverbs"
            onImportComplete={() => refresh()}
            defaultWorksheetTitle="yo_proverbs"
            expectedColumns={[
              { name: 'source_row_key', required: true, description: 'Stable spreadsheet row key', example: 'proverb_yor_0001' },
              { name: 'yoruba_text', required: true, description: 'Proverb in Yoruba', example: "Ìwà l'ẹ̀so ẹni" },
              { name: 'english_translation', required: true, description: 'Direct translation', example: "Character is one's beauty" },
              { name: 'english_meaning', required: false, description: 'Interpretation/meaning', example: 'Good character is more important than physical appearance' },
              { name: 'romanization', required: false, description: 'Romanized version', example: "iwa l'eso eni" },
              { name: 'difficulty_level', required: false, description: 'Difficulty 1-5', example: '3' },
              { name: 'category', required: false, description: 'Primary category', example: 'character' },
              { name: 'tags', required: false, description: 'Comma-separated tags', example: 'wisdom,values' },
              { name: 'cultural_context', required: false, description: 'Cultural context', example: 'Used to emphasize inner beauty' },
              { name: 'is_published', required: false, description: 'Published status', example: 'false' },
              { name: 'review_status', required: false, description: 'Editorial review status', example: 'approved' },
            ]}
          />
        </div>
      )}

      <StickyBulkActionBar
        selectedCount={selectedProverbs.length}
        onClear={() => setSelectedProverbs([])}
        itemName="proverb"
        actions={[
          {
            label: isLoadingVoices ? 'Loading voices...' : isBulkRegenerating ? 'Queueing...' : 'Regenerate Audio',
            onClick: handleBulkRegenerateAudio,
            disabled: isBulkRegenerating || isLoadingVoices,
            loading: isBulkRegenerating || isLoadingVoices,
            icon: <FiVolume2 className="h-4 w-4" />,
          },
        ]}
      />

      {/* Proverbs Table - Desktop and Mobile */}
      <ProverbsDataTable
        proverbs={uniqueProverbs}
        isLoading={isLoading}
        selectedProverbs={selectedProverbs}
        onSelectAll={handleSelectAllProverbs}
        onSelectProverb={handleSelectProverb}
        onEdit={openEditModal}
        onRegenerateAudio={handleRegenerateAudio}
        onAcceptAudio={handleAcceptAudio}
        onRejectAudio={handleRejectAudio}
        onDelete={(id) => {
          const proverb = uniqueProverbs.find((p: Proverb) => p.id === id);
          handleDeleteClick(id, proverb?.proverb || 'this proverb');
        }}
      />

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-lg">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} proverbs
          </p>
          <div className="ml-auto">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingProverb ? "Edit Proverb" : "Add New Proverb"}
        maxWidth="4xl"
      >
        <div className="max-h-[calc(90vh-10rem)] overflow-y-auto pr-1">
          <div className="space-y-4">
            {editingProverb && (
              <div className="flex items-start justify-end gap-3">
                {renderModalAlignmentStatus()}
              </div>
            )}

            {errorMessage && <Alert variant="error" title="Error" message={errorMessage} />}

            <form onSubmit={handleSubmit} className="space-y-4">
              <StyledSelect
                label="Language"
                value={formData.language_id}
                onChange={(e) => setFormData({ ...formData, language_id: e.target.value })}
                required
                fullWidth
                options={[
                  { value: "", label: "Select language", disabled: true },
                  ...(languages?.map((lang: any) => ({
                    value: lang.id,
                    label: lang.name
                  })) || [])
                ]}
                placeholder="Select language"
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Proverb *</label>
                <textarea
                  value={formData.proverb}
                  onChange={(e) => setFormData({ ...formData, proverb: e.target.value })}
                  required
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Translation *</label>
                <textarea
                  value={formData.translation}
                  onChange={(e) => setFormData({ ...formData, translation: e.target.value })}
                  required
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Meaning/Context</label>
                <textarea
                  value={formData.meaning}
                  onChange={(e) => setFormData({ ...formData, meaning: e.target.value })}
                  rows={3}
                  placeholder="Explain the cultural context or deeper meaning..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g., Wisdom, Life, Family, Nature"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={formData.is_published}
                  onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                <span>Publish this proverb</span>
              </label>

              {/* Audio Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Audio File (Optional)
                </label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioChange}
                  className="block w-full text-sm text-gray-900 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-white dark:bg-gray-700 focus:outline-none p-2"
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

              {editingProverb && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/30 p-4 space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Proverb Alignment</h3>
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                      Review the generated draft, set explicit prompt and answer timing, then optionally refine word timings for karaoke and sentence completion.
                    </p>
                  </div>

                  {(alignmentError || alignmentLoading) && (
                    alignmentLoading ? (
                      <div className="text-sm text-gray-600 dark:text-gray-400">Loading alignment...</div>
                    ) : (
                      <Alert variant="error" title="Alignment" message={alignmentError} />
                    )
                  )}

                  {alignmentRecord && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      {renderModalAlignmentStatus()}
                      {(alignmentRecord.provider_used || alignmentRecord.engine_used) && (
                        <span className="rounded-full border border-gray-300 px-2.5 py-1 dark:border-gray-700">
                          Source: {[alignmentRecord.provider_used, alignmentRecord.engine_used].filter(Boolean).join(" / ")}
                        </span>
                      )}
                      {alignmentRecord.confidence != null && (
                        <span className="rounded-full border border-gray-300 px-2.5 py-1 dark:border-gray-700">
                          Confidence: {alignmentRecord.confidence.toFixed(2)}
                        </span>
                      )}
                    </div>
                  )}

                  {editingProverb.alignment_job_status && (
                    <div className="flex flex-wrap items-center gap-2">
                      {renderAlignmentJobBadge(editingProverb)}
                      {editingProverb.alignment_job_updated_at && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Updated {new Date(editingProverb.alignment_job_updated_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}

                  {editingProverb.alignment_job_status === "failed" && editingProverb.alignment_job_error && (
                    <Alert
                      variant="error"
                      title="Latest auto-alignment failed"
                      message={editingProverb.alignment_job_error}
                    />
                  )}

                  {(alignmentRecord?.status === "stale" || editingProverb.alignment_status === "stale")
                    && (alignmentRecord?.stale_reason || editingProverb.alignment_stale_reason) && (
                    <Alert
                      variant="warning"
                      title="Alignment is stale"
                      message={`This alignment needs review because ${(alignmentRecord?.stale_reason || editingProverb.alignment_stale_reason || "").replaceAll("_", " ")}.`}
                    />
                  )}

                  {editingProverb.audio_url ? (
                    <AudioWaveform
                      src={editingProverb.audio_url}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3"
                    />
                  ) : (
                    <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 text-sm text-gray-600 dark:text-gray-400">
                      Generate or upload proverb audio before saving alignment timings.
                    </div>
                  )}

                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">Full Proverb Alignment</div>
                        <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                          Review the entire proverb transcript first. Karaoke highlighting uses these full-word timings directly.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={syncWordsFromTranscript}
                        className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700"
                      >
                        Generate Words
                      </button>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Proverb Text
                      </label>
                      <textarea
                        value={alignmentPrimarySegment.text}
                        onChange={(e) => updateAlignmentPrimarySegment({ text: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-700 dark:text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Start (ms)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={alignmentPrimarySegment.start_ms}
                          onChange={(e) => updateAlignmentPrimarySegment({ start_ms: Number(e.target.value || 0) })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                          End (ms)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={alignmentPrimarySegment.end_ms}
                          onChange={(e) => updateAlignmentPrimarySegment({ end_ms: Number(e.target.value || 0) })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-2 text-sm text-gray-700 dark:text-gray-200">
                      {alignmentPrimarySegment.text || "Full proverb transcript will appear here"}
                    </div>

                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={addAlignmentWord}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                          Add Word
                        </button>
                        <button
                          type="button"
                          onClick={redistributeAlignmentWords}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                          Redistribute Evenly
                        </button>
                      </div>

                      {alignmentWords.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-3 text-sm text-gray-600 dark:text-gray-400">
                          No word timings yet for this proverb.
                        </div>
                      ) : alignmentWords.map((word, index) => (
                        <div
                          key={`word-${index}-${word.word}`}
                          className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,2fr)_120px_120px_minmax(0,220px)_auto_auto] xl:items-end"
                        >
                          <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
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
                            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
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
                            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
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
                            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Timing Helpers
                            </label>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => shiftAlignmentWord(index, -wordSnapStepMs)}
                                className="rounded-lg border border-gray-300 px-2.5 py-2 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                              >
                                Shift -{wordSnapStepMs}
                              </button>
                              <button
                                type="button"
                                onClick={() => shiftAlignmentWord(index, wordSnapStepMs)}
                                className="rounded-lg border border-gray-300 px-2.5 py-2 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                              >
                                Shift +{wordSnapStepMs}
                              </button>
                              <button
                                type="button"
                                onClick={() => expandAlignmentWord(index, wordSnapStepMs, "left")}
                                className="rounded-lg border border-gray-300 px-2.5 py-2 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                              >
                                Expand Left
                              </button>
                              <button
                                type="button"
                                onClick={() => expandAlignmentWord(index, wordSnapStepMs, "right")}
                                className="rounded-lg border border-gray-300 px-2.5 py-2 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                              >
                                Expand Right
                              </button>
                              <button
                                type="button"
                                onClick={() => snapAlignmentWordEdge(index, "start")}
                                className="rounded-lg border border-indigo-300 px-2.5 py-2 text-xs text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/20"
                              >
                                Snap Start
                              </button>
                              <button
                                type="button"
                                onClick={() => snapAlignmentWordEdge(index, "end")}
                                className="rounded-lg border border-indigo-300 px-2.5 py-2 text-xs text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/20"
                              >
                                Snap End
                              </button>
                              <button
                                type="button"
                                onClick={() => snapAlignmentWordToBounds(index)}
                                className="rounded-lg border border-indigo-300 px-2.5 py-2 text-xs text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/20"
                              >
                                Snap To Bounds
                              </button>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void previewWordTiming(word, index)}
                            className={`rounded-lg px-3 py-2 text-sm ${
                              previewingWordIndex === index
                                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                                : "border border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/20"
                            }`}
                          >
                            {previewingWordIndex === index ? "Stop" : "Play Clip"}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeAlignmentWord(index)}
                            className="rounded-lg px-3 py-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">Optional Game Split</div>
                        <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                          Only use this when you want the proverb completion game. The split is derived from the word where the answer should begin.
                        </div>
                      </div>
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={gameSplitEnabled}
                          onChange={(e) => {
                            const enabled = e.target.checked;
                            setGameSplitEnabled(enabled);
                            if (!enabled) {
                              setGameSplitAnswerStartIndex(null);
                              return;
                            }
                            setWordTimingsEnabled(true);
                            if (alignmentWords.length === 0) {
                              setAlignmentWords(seedAlignmentWords(alignmentPrimarySegment.text, alignmentPrimarySegment, []));
                            }
                            const nextWords = alignmentWords.length > 0
                              ? alignmentWords
                              : seedAlignmentWords(alignmentPrimarySegment.text, alignmentPrimarySegment, []);
                            setGameSplitAnswerStartIndex(nextWords.length > 1 ? 1 : null);
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600"
                        />
                        Enable completion split
                      </label>
                    </div>

                    {!gameSplitEnabled ? (
                      <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-3 text-sm text-gray-600 dark:text-gray-400">
                        Leave this off if you only need karaoke-style word highlighting.
                      </div>
                    ) : alignmentWords.length < 2 ? (
                      <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-3 text-sm text-gray-600 dark:text-gray-400">
                        Generate at least two word timings before choosing where the completion should begin.
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Answer Starts At
                          </label>
                          <select
                            value={gameSplitAnswerStartIndex ?? ""}
                            onChange={(e) => setGameSplitAnswerStartIndex(Number(e.target.value))}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-700 dark:text-white"
                          >
                            {alignmentWords.slice(1).map((word, index) => {
                              const answerStartIndex = index + 1;
                              return (
                                <option key={`${word.word}-${answerStartIndex}`} value={answerStartIndex}>
                                  Word {answerStartIndex + 1}: {word.word}
                                </option>
                              );
                            })}
                          </select>
                          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                            Words before this point become the prompt. This word and everything after it become the completion answer.
                          </p>
                        </div>

                        {derivedGameSplit && (
                          <div className="grid gap-4 lg:grid-cols-2">
                            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4 space-y-2">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">Derived Prompt</div>
                              <div className="text-sm text-gray-700 dark:text-gray-200">{derivedGameSplit.promptSegment.text}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {derivedGameSplit.promptSegment.start_ms} ms to {derivedGameSplit.promptSegment.end_ms} ms
                              </div>
                            </div>
                            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4 space-y-2">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">Derived Answer</div>
                              <div className="text-sm text-gray-700 dark:text-gray-200">{derivedGameSplit.answerSegment.text}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {derivedGameSplit.answerSegment.start_ms} ms to {derivedGameSplit.answerSegment.end_ms} ms
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">Optional Word Timings</div>
                        <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                          Word timings are the primary review artifact for karaoke. Leave them enabled if you want reviewed word-by-word playback.
                        </div>
                      </div>
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={wordTimingsEnabled}
                          onChange={(e) => {
                            const enabled = e.target.checked;
                            setWordTimingsEnabled(enabled);
                            if (!enabled) {
                              setGameSplitEnabled(false);
                              setGameSplitAnswerStartIndex(null);
                            } else if (alignmentWords.length === 0) {
                              setAlignmentWords(seedAlignmentWords(alignmentPrimarySegment.text, alignmentPrimarySegment, []));
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
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
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
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={requeueAlignment}
                      disabled={alignmentSaving || !editingProverb || !editingProverb.audio_url}
                      className="rounded-lg border border-indigo-300 px-3 py-2 text-indigo-700 hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/20"
                    >
                      Requeue Auto-Align
                    </button>
                    <button
                      type="button"
                      onClick={() => saveAlignment("draft")}
                      disabled={alignmentSaving}
                      className="rounded-lg bg-amber-600 px-3 py-2 text-white hover:bg-amber-700 disabled:opacity-60"
                    >
                      Save Draft
                    </button>
                    <button
                      type="button"
                      onClick={() => saveAlignment("reviewed")}
                      disabled={alignmentSaving}
                      className="rounded-lg bg-sky-600 px-3 py-2 text-white hover:bg-sky-700 disabled:opacity-60"
                    >
                      Save Reviewed
                    </button>
                    <button
                      type="button"
                      onClick={approveAlignment}
                      disabled={alignmentSaving || !alignmentRecord}
                      className="rounded-lg bg-green-600 px-3 py-2 text-white hover:bg-green-700 disabled:opacity-60"
                    >
                      Approve
                    </button>
                    {alignmentRecord && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Version {alignmentRecord.version} · Updated {new Date(alignmentRecord.updated_at).toLocaleString()}
                        {alignmentRecord.source ? ` · Source ${alignmentRecord.source}` : ""}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  disabled={uploadingAudio}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadingAudio ? "Uploading..." : editingProverb ? "Update" : "Create"}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Proverb"
        message={`Are you sure you want to delete "${deleteConfirm?.proverb?.substring(0, 50)}${deleteConfirm?.proverb && deleteConfirm.proverb.length > 50 ? '...' : ''}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      <ConfirmationModal
        isOpen={showProverbCleanupApplyConfirm}
        onClose={() => setShowProverbCleanupApplyConfirm(false)}
        onConfirm={() => void queueProverbCleanupJob(false)}
        title="Apply Proverb Cleanup"
        message="This will modify data. Proceed? Old-format proverb audio rows will be backed up and deleted from the database. R2 objects will not be deleted."
        confirmText="Apply Cleanup"
        cancelText="Cancel"
        variant="danger"
        isLoading={proverbCleanupLoading}
      />

      {/* Bulk Regenerate Audio Modal */}
      <Modal
        isOpen={showBulkRegenerateConfirm}
        onClose={() => {
          setShowBulkRegenerateConfirm(false);
          setBulkRegenerateLanguage("yoruba");
          setBulkRegenerateVoiceId("");
        }}
        title={`Regenerate Audio for ${selectedProverbs.length} Proverb${selectedProverbs.length !== 1 ? "s" : ""}`}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Language
            </label>
            <select
              value={bulkRegenerateLanguage}
              onChange={(e) => {
                setBulkRegenerateLanguage(e.target.value);
                setBulkRegenerateVoiceId("");
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              <option value="yoruba">Yoruba</option>
              <option value="english">English</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Voice (Optional)
            </label>
            {isLoadingVoices ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">Loading voices...</div>
            ) : (
              <select
                value={bulkRegenerateVoiceId}
                onChange={(e) => setBulkRegenerateVoiceId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="">Use default voice for language</option>
                {availableVoices
                  .filter((voice) => {
                    const langCode = bulkRegenerateLanguage === "yoruba" ? "yo" : "en";
                    return voice.language_code === langCode || voice.language_code.startsWith(langCode);
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
              Leave empty to use the default active voice for the selected language.
            </p>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400">
            This will queue fresh audio generation jobs. Jobs are processed in the background.
          </p>

          <div className="flex gap-3 pt-2">
            <button
              onClick={confirmBulkRegenerateAudio}
              disabled={isBulkRegenerating || isLoadingVoices}
              className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isBulkRegenerating ? "Regenerating..." : "Regenerate"}
            </button>
            <button
              onClick={() => {
                setShowBulkRegenerateConfirm(false);
                setBulkRegenerateLanguage("yoruba");
                setBulkRegenerateVoiceId("");
              }}
              disabled={isBulkRegenerating}
              className="flex-1 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      <RegenerateAudioModal
        isOpen={showRegenerateModal}
        onClose={() => {
          setShowRegenerateModal(false);
          setRegeneratingTarget(null);
        }}
        target={regeneratingTarget}
        onSuccess={() => {
          scheduleQueuedAudioRefresh(refresh);
        }}
      />
    </div>
  );
}

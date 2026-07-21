"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useWords, useLanguages } from "@/hooks/useApi";
import { apiClient } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import type { Word } from "@/types/api";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Alert from "@/components/ui/alert/SimpleAlert";
import { StyledSelect } from "@/components/ui/form/StyledSelect";
import WordsDataTable from "@/components/tables/WordsDataTable";
import { Modal } from "@/components/ui/modal";
import { ConfirmationModal } from "@/components/ui/modal/ConfirmationModal";
import { RegenerateAudioModal } from "@/components/modals/RegenerateAudioModal";
import WordDetailModal from "@/components/admin/words/WordDetailModal";
import { DictionaryGoogleSheetsBulkImport } from "@/components/admin/DictionaryGoogleSheetsBulkImport";
import { scheduleQueuedAudioRefresh } from "@/lib/audioRegeneration";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Pagination from "@/components/tables/Pagination";
import {
  ContentPageHeader,
  ContentStatsCard,
  ContentStatsGrid,
  ContentFiltersCard,
  ActiveFilterChips,
  StickyBulkActionBar,
} from '@/components/admin/layout';
import { FiGlobe, FiBarChart2, FiCheckCircle, FiTrash2, FiVolume2, FiX } from "react-icons/fi";

// POS options for multi-select
const POS_OPTIONS = [
  { value: 'noun', label: 'Noun' },
  { value: 'verb', label: 'Verb' },
  { value: 'adjective', label: 'Adjective' },
  { value: 'adverb', label: 'Adverb' },
  { value: 'pronoun', label: 'Pronoun' },
  { value: 'preposition', label: 'Preposition' },
  { value: 'conjunction', label: 'Conjunction' },
  { value: 'interjection', label: 'Interjection' },
  { value: 'other', label: 'Other' },
];

export default function WordsPage() {
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Basic state
  // Dictionary content is English-anchored (see restructure.md) — every
  // lemma's source language is English, so there's no meaningful "source
  // language" to filter or create-by anymore. Only the translation
  // (target) language varies (Yoruba today, more later).
  const [selectedTargetLanguage, setSelectedTargetLanguage] = useState<string>("");
  const [search, setSearch] = useState("");
  const [primaryTranslationFilter, setPrimaryTranslationFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [showModal, setShowModal] = useState(false);
  const [editingWord, setEditingWord] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [regeneratingWord, setRegeneratingWord] = useState<any | null>(null);
  const [viewDetailWordId, setViewDetailWordId] = useState<string | null>(null);
  
  // Confirmation modal states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  // Advanced filter state
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [hasAudio, setHasAudio] = useState<boolean | undefined>(undefined);
  const [hasExamples, setHasExamples] = useState<boolean | undefined>(undefined);
  const [hasRelated, setHasRelated] = useState<boolean | undefined>(undefined);
  const [hasPronunciation, setHasPronunciation] = useState<boolean | undefined>(undefined);
  const [posFilter, setPosFilter] = useState<string[]>([]);
  const [startsWithFilter, setStartsWithFilter] = useState("");
  const [endsWithFilter, setEndsWithFilter] = useState("");
  const [containsFilter, setContainsFilter] = useState("");
  const [toneMarksPresent, setToneMarksPresent] = useState<boolean | undefined>(undefined);
  const [ipaPresent, setIpaPresent] = useState<boolean | undefined>(undefined);
  const [wordLengthMin, setWordLengthMin] = useState<number | undefined>(undefined);
  const [wordLengthMax, setWordLengthMax] = useState<number | undefined>(undefined);
  const [sortBy, setSortBy] = useState<'lemma' | 'primary_translation' | 'created_at' | 'updated_at' | 'difficulty' | 'pos'>('lemma');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Initialize filters from URL params
  useEffect(() => {
    const targetLangId = searchParams.get('target_language_id');
    const searchQ = searchParams.get('search');
    const primaryTranslationQ = searchParams.get('primary_translation');
    const pageP = searchParams.get('page');
    const limitP = searchParams.get('limit');
    const hasAudioP = searchParams.get('has_audio');
    const hasExamplesP = searchParams.get('has_examples');
    const hasRelatedP = searchParams.get('has_related');
    const hasPronunP = searchParams.get('has_pronunciation');
    const posP = searchParams.get('pos');
    const startsP = searchParams.get('starts_with');
    const endsP = searchParams.get('ends_with');
    const containsP = searchParams.get('contains');
    const toneP = searchParams.get('tone_marks_present');
    const ipaP = searchParams.get('ipa_present');
    const minLenP = searchParams.get('word_length_min');
    const maxLenP = searchParams.get('word_length_max');
    const sortByP = searchParams.get('sort_by');
    const sortDirP = searchParams.get('sort_dir');

    if (targetLangId) setSelectedTargetLanguage(targetLangId);
    if (searchQ) setSearch(searchQ);
    if (primaryTranslationQ) setPrimaryTranslationFilter(primaryTranslationQ);
    if (pageP) setPage(Number(pageP));
    if (limitP) setLimit(Number(limitP));
    if (hasAudioP) setHasAudio(hasAudioP === 'true');
    if (hasExamplesP) setHasExamples(hasExamplesP === 'true');
    if (hasRelatedP) setHasRelated(hasRelatedP === 'true');
    if (hasPronunP) setHasPronunciation(hasPronunP === 'true');
    if (posP) setPosFilter(posP.split(','));
    if (startsP) setStartsWithFilter(startsP);
    if (endsP) setEndsWithFilter(endsP);
    if (containsP) setContainsFilter(containsP);
    if (toneP) setToneMarksPresent(toneP === 'true');
    if (ipaP) setIpaPresent(ipaP === 'true');
    if (minLenP) setWordLengthMin(Number(minLenP));
    if (maxLenP) setWordLengthMax(Number(maxLenP));
    if (sortByP) setSortBy(sortByP as any);
    if (sortDirP) setSortDir(sortDirP as any);

    // Auto-expand if any advanced filters are active
    if (hasAudioP || hasExamplesP || hasRelatedP || hasPronunP || posP || startsP || endsP || containsP || toneP || ipaP || minLenP || maxLenP) {
      setShowAdvancedFilters(true);
    }
  }, [searchParams]);

  // Update URL when filters change
  const updateURL = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedTargetLanguage) params.set('target_language_id', selectedTargetLanguage);
    if (search) params.set('search', search);
    if (primaryTranslationFilter) params.set('primary_translation', primaryTranslationFilter);
    if (page > 1) params.set('page', page.toString());
    if (limit !== 50) params.set('limit', limit.toString());
    if (hasAudio !== undefined) params.set('has_audio', hasAudio.toString());
    if (hasExamples !== undefined) params.set('has_examples', hasExamples.toString());
    if (hasRelated !== undefined) params.set('has_related', hasRelated.toString());
    if (hasPronunciation !== undefined) params.set('has_pronunciation', hasPronunciation.toString());
    if (posFilter.length > 0) params.set('pos', posFilter.join(','));
    if (startsWithFilter) params.set('starts_with', startsWithFilter);
    if (endsWithFilter) params.set('ends_with', endsWithFilter);
    if (containsFilter) params.set('contains', containsFilter);
    if (toneMarksPresent !== undefined) params.set('tone_marks_present', toneMarksPresent.toString());
    if (ipaPresent !== undefined) params.set('ipa_present', ipaPresent.toString());
    if (wordLengthMin) params.set('word_length_min', wordLengthMin.toString());
    if (wordLengthMax) params.set('word_length_max', wordLengthMax.toString());
    if (sortBy !== 'lemma') params.set('sort_by', sortBy);
    if (sortDir !== 'asc') params.set('sort_dir', sortDir);

    const queryString = params.toString();
    router.replace(`${pathname}${queryString ? '?' + queryString : ''}`, { scroll: false });
  }, [selectedTargetLanguage, search, primaryTranslationFilter, page, limit, hasAudio, hasExamples, hasRelated, hasPronunciation, posFilter, startsWithFilter, endsWithFilter, containsFilter, toneMarksPresent, ipaPresent, wordLengthMin, wordLengthMax, sortBy, sortDir, router, pathname]);

  // Debounced URL update
  useEffect(() => {
    const timer = setTimeout(updateURL, 300);
    return () => clearTimeout(timer);
  }, [updateURL]);

  // Count active filters
  const activeFilterCount = [
    primaryTranslationFilter,
    hasAudio !== undefined,
    hasExamples !== undefined,
    hasRelated !== undefined,
    hasPronunciation !== undefined,
    posFilter.length > 0,
    startsWithFilter,
    endsWithFilter,
    containsFilter,
    toneMarksPresent !== undefined,
    ipaPresent !== undefined,
    wordLengthMin !== undefined,
    wordLengthMax !== undefined,
  ].filter(Boolean).length;

  // Active filter chips for shared component
  const activeFilterChips = [
    hasAudio !== undefined && { label: 'Has Audio', onClear: () => setHasAudio(undefined) },
    hasExamples !== undefined && { label: 'Has Examples', onClear: () => setHasExamples(undefined) },
    hasRelated !== undefined && { label: 'Has Related', onClear: () => setHasRelated(undefined) },
    hasPronunciation !== undefined && { label: 'Has IPA', onClear: () => setHasPronunciation(undefined) },
    toneMarksPresent !== undefined && { label: 'Tone Marks', onClear: () => setToneMarksPresent(undefined) },
    ipaPresent !== undefined && { label: 'IPA Transcription', onClear: () => setIpaPresent(undefined) },
    posFilter.length > 0 && { label: `POS: ${posFilter.join(', ')}`, onClear: () => setPosFilter([]) },
    startsWithFilter && { label: `Starts: "${startsWithFilter}"`, onClear: () => setStartsWithFilter('') },
    containsFilter && { label: `Contains: "${containsFilter}"`, onClear: () => setContainsFilter('') },
    endsWithFilter && { label: `Ends: "${endsWithFilter}"`, onClear: () => setEndsWithFilter('') },
    (wordLengthMin !== undefined || wordLengthMax !== undefined) && { label: `Length: ${wordLengthMin ?? '∞'}-${wordLengthMax ?? '∞'}`, onClear: () => { setWordLengthMin(undefined); setWordLengthMax(undefined); } },
  ].filter(Boolean) as { label: string; onClear: () => void }[];

  // Clear all filters
  const clearAllFilters = () => {
    setHasAudio(undefined);
    setHasExamples(undefined);
    setHasRelated(undefined);
    setHasPronunciation(undefined);
    setPosFilter([]);
    setStartsWithFilter("");
    setEndsWithFilter("");
    setContainsFilter("");
    setPrimaryTranslationFilter("");
    setToneMarksPresent(undefined);
    setIpaPresent(undefined);
    setWordLengthMin(undefined);
    setWordLengthMax(undefined);
    setSortBy('lemma');
    setSortDir('asc');
    setPage(1);
  };

  // Toggle POS filter
  const togglePosFilter = (pos: string) => {
    setPosFilter(prev => 
      prev.includes(pos) 
        ? prev.filter(p => p !== pos) 
        : [...prev, pos]
    );
    setPage(1);
  };

  const { words, total, isLoading, isError, refresh, filtersApplied } = useWords({
    target_language_id: selectedTargetLanguage || undefined,
    search, 
    primary_translation: primaryTranslationFilter || undefined,
    page, 
    limit,
    has_audio: hasAudio,
    has_examples: hasExamples,
    has_related: hasRelated,
    has_pronunciation: hasPronunciation,
    pos: posFilter.length > 0 ? posFilter.join(',') : undefined,
    starts_with: startsWithFilter || undefined,
    ends_with: endsWithFilter || undefined,
    contains: containsFilter || undefined,
    tone_marks_present: toneMarksPresent,
    ipa_present: ipaPresent,
    word_length_min: wordLengthMin,
    word_length_max: wordLengthMax,
    sort_by: sortBy,
    sort_dir: sortDir,
  });
  const { languages } = useLanguages();
  // The lemma pool is English-anchored — there is exactly one valid
  // source language for creating/editing an entry.
  const englishLanguage = languages?.find((lang: any) => lang.iso_639_3 === 'eng');

  // Deduplicate words to prevent duplicate key errors
  const uniqueWords = React.useMemo(() => {
    if (!words) return [];
    const seen = new Set<string>();
    return words.filter((word: any) => {
      const id = String(word.id);
      if (seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    });
  }, [words]);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const [formData, setFormData] = useState({
    language_id: "",
    word: "",
    pos: "noun",
    word_category: "",
    difficulty_level: 1,
    usage_notes: "",
    ipa_pronunciation: "",
    s3_bucket_key: "",
    audio_duration_sec: null as number | null,
  });

  const openCreateModal = () => {
    setEditingWord(null);
    setFormData({
      language_id: englishLanguage?.id ?? "",
      word: "",
      pos: "noun",
      word_category: "",
      difficulty_level: 1,
      usage_notes: "",
      ipa_pronunciation: "",
      s3_bucket_key: "",
      audio_duration_sec: null,
    });
    setAudioFile(null);
    setAudioPreview(null);
    setShowModal(true);
  };

  const openEditModal = (word: any) => {
    setEditingWord(word);
    setFormData({
      language_id: word.language_id,
      word: word.word,
      pos: word.pos || "noun",
      word_category: word.category || "",
      difficulty_level: word.difficulty_level || 1,
      usage_notes: word.usage_notes || "",
      ipa_pronunciation: word.ipa_pronunciation || "",
      s3_bucket_key: word.audio_key || "",
      audio_duration_sec: word.audio_duration_sec || null,
    });
    setAudioFile(null);
    setAudioPreview(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingWord(null);
    setErrorMessage("");
    setAudioFile(null);
    setAudioPreview(null);
  };

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('audio/')) {
      toast.error('Please select an audio file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Audio file size must be less than 10MB');
      return;
    }

    setAudioFile(file);
    setAudioPreview(URL.createObjectURL(file));
  };

  const handleSelectAll = () => {
    if (selectedWords.length === words.length) {
      setSelectedWords([]);
    } else {
      setSelectedWords(words.map((w: any) => String(w.id)));
    }
  };

  const handleSelectWord = (wordId: string) => {
    setSelectedWords(prev => 
      prev.includes(wordId) 
        ? prev.filter(id => id !== wordId)
        : [...prev, wordId]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedWords.length === 0) return;
    
    setShowDeleteConfirm(true);
  };

  const confirmBulkDelete = async () => {
    setIsDeleting(true);
    try {
      // Backend endpoint for bulk delete (to be implemented)
      await apiClient.post('/api/v1/admin/content/words/bulk-delete', {
        word_ids: selectedWords
      });
      toast.success(`Successfully deleted ${selectedWords.length} lexicon entr${selectedWords.length === 1 ? 'y' : 'ies'}`);
      setSelectedWords([]);
      setShowDeleteConfirm(false);
      refresh();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete words');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkRegenerateAudio = async () => {
    if (selectedWords.length === 0) return;
    
    setShowRegenerateConfirm(true);
  };

  const confirmBulkRegenerateAudio = async () => {
    setIsRegenerating(true);
    try {
      // Use the new bulk audio regeneration endpoint
      await apiClient.post('/api/v1/admin/content/words/bulk/regenerate-audio', {
        word_ids: selectedWords,
        preview_only: false
      });
      toast.success(`Audio regeneration started for ${selectedWords.length} word(s)`);
      setSelectedWords([]);
      setShowRegenerateConfirm(false);
      refresh();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to regenerate audio');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    
    try {
      if (editingWord) {
        await apiClient.put(`/api/v1/admin/content/words/${editingWord.id}`, formData);
        
        // Upload audio if file is selected
        if (audioFile) {
          setUploadingAudio(true);
          const audioFormData = new FormData();
          audioFormData.append('audio', audioFile);
          try {
            await apiClient.post(
              `/api/v1/admin/content/words/${editingWord.id}/audio`,
              audioFormData,
              { headers: { 'Content-Type': 'multipart/form-data' } }
            );
          } catch (audioErr: any) {
            console.error('Audio upload error:', audioErr);
            toast.error('Entry updated but audio upload failed');
          } finally {
            setUploadingAudio(false);
          }
        }
        
        toast.success("Entry updated successfully");
      } else {
        const response = await apiClient.post('/api/v1/admin/content/words', formData);
        
        // Upload audio if file is selected
        if (audioFile && response.data?.id) {
          setUploadingAudio(true);
          const audioFormData = new FormData();
          audioFormData.append('audio', audioFile);
          try {
            await apiClient.post(
              `/api/v1/admin/content/words/${response.data.id}/audio`,
              audioFormData,
              { headers: { 'Content-Type': 'multipart/form-data' } }
            );
          } catch (audioErr: any) {
            console.error('Audio upload error:', audioErr);
            toast.error('Entry created but audio upload failed');
          } finally {
            setUploadingAudio(false);
          }
        }
        
        toast.success("Entry created successfully");
      }
      closeModal();
      refresh();
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || "Failed to save word");
    }
  };

  const handleDelete = async (wordId: string) => {
    try {
      await apiClient.delete(`/api/v1/admin/words/${wordId}`);
      toast.success("Entry deleted successfully");
      refresh();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to delete word");
    }
  };

  const handleRegenerateAudio = async (wordId: string) => {
    // Find the word to get its details
    const word = words?.find((w: any) => w.id === wordId);
    if (!word) {
      toast.error("Entry not found");
      return;
    }
    
    const translationText = word.primary_translation || word.word;
    const targetLang = word.target_languages?.[0]?.language_code
      || word.glosses?.[0]?.language_code
      || 'yor';
    
    // Open modal with word details
    setRegeneratingWord({
      id: word.id,
      contentType: 'word',
      displayText: word.word,
      defaultText: translationText,
      languageCode: targetLang,
      submitEndpoint: `/api/v1/admin/content/words/single/${word.id}/regenerate-audio`,
      totalVariants: word.translation_count,
    });
    setShowRegenerateModal(true);
  };

  if (isError) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="Lexicon Entries" />
        <Alert variant="error">Failed to load words. Please check your API connection.</Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ContentPageHeader
        title="Lexicon Entries"
        subtitle="Search source headwords and imported translations from the same view"
        onAdd={openCreateModal}
        addLabel="Add New Entry"
      />

      <ContentStatsGrid cols={3}>
        <ContentStatsCard label="Total Entries" value={total || 0} icon={FiGlobe} />
        <ContentStatsCard label="Current Page" value={page} icon={FiBarChart2} iconBgClass="bg-blue-100 dark:bg-blue-900/20" iconTextClass="text-blue-600 dark:text-blue-400" />
        <ContentStatsCard label="Showing" value={`${Math.min((page - 1) * limit + 1, total)}-${Math.min(page * limit, total)}`} icon={FiCheckCircle} iconBgClass="bg-green-100 dark:bg-green-900/20" iconTextClass="text-green-600 dark:text-green-400" />
      </ContentStatsGrid>

      <DictionaryGoogleSheetsBulkImport onImportComplete={() => refresh()} />

      <ContentFiltersCard
        activeFilterCount={activeFilterCount}
        onClearAll={clearAllFilters}
        showAdvanced={showAdvancedFilters}
        onToggleAdvanced={() => setShowAdvancedFilters(!showAdvancedFilters)}
      >
        {/* Basic Filters Row */}
        <div className="flex flex-wrap gap-4">
          {/* Translation Language Filter — the lemma pool is
              English-anchored (see restructure.md), so there's no
              meaningful "source language" to filter by anymore; this is
              the one language axis that actually varies. */}
          <div className="flex-1 min-w-[200px]">
            <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300">
              <div className="flex items-center gap-1.5">
                <FiGlobe className="h-3.5 w-3.5" />
                Translation Language
              </div>
            </label>
            <StyledSelect
              value={selectedTargetLanguage}
              onChange={(e) => {
                setSelectedTargetLanguage(e.target.value);
                setPage(1);
              }}
              options={[
                { value: "", label: "All Translation Languages" },
                ...(languages?.map((lang: any) => ({
                  value: lang.id,
                  label: lang.name
                })) || [])
              ]}
              fullWidth
            />
          </div>

          {/* Sort By */}
          <div className="min-w-[150px]">
            <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Sort by
            </label>
            <StyledSelect
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as any);
                setPage(1);
              }}
              options={[
                { value: "lemma", label: "Alphabetical" },
                { value: "primary_translation", label: "Primary Translation" },
                { value: "created_at", label: "Created Date" },
                { value: "updated_at", label: "Updated Date" },
                { value: "difficulty", label: "Difficulty" },
                { value: "pos", label: "Part of Speech" }
              ]}
              fullWidth
            />
          </div>

          <div className="flex-1 min-w-[240px]">
            <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Primary Translation
            </label>
            <input
              type="text"
              value={primaryTranslationFilter}
              onChange={(e) => {
                setPrimaryTranslationFilter(e.target.value);
                setPage(1);
              }}
              placeholder="Filter by primary translation..."
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
            />
          </div>

          {/* Sort Direction */}
          <div className="min-w-[120px]">
            <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Order
            </label>
            <StyledSelect
              value={sortDir}
              onChange={(e) => {
                setSortDir(e.target.value as any);
                setPage(1);
              }}
              options={[
                { value: "asc", label: "Ascending" },
                { value: "desc", label: "Descending" }
              ]}
              fullWidth
            />
          </div>

          {/* Items Per Page */}
          <div>
            <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Items per page
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
            />
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="mt-5 border-t border-gray-100 pt-5 dark:border-white/[0.05]">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Boolean Filters Column */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Content Flags</h4>
                
                {/* Has Audio */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={hasAudio === true}
                      onChange={(e) => setHasAudio(e.target.checked ? true : undefined)}
                      className="peer sr-only"
                    />
                    <div className="h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-brand-600 transition-colors dark:bg-gray-700" />
                    <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4 shadow-sm" />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                    Has Audio
                  </span>
                  {hasAudio !== undefined && (
                    <button onClick={() => setHasAudio(undefined)} className="text-gray-400 hover:text-gray-600">
                      <FiX className="h-3.5 w-3.5" />
                    </button>
                  )}
                </label>

                {/* Has Examples */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={hasExamples === true}
                      onChange={(e) => setHasExamples(e.target.checked ? true : undefined)}
                      className="peer sr-only"
                    />
                    <div className="h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-brand-600 transition-colors dark:bg-gray-700" />
                    <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4 shadow-sm" />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                    Has Examples
                  </span>
                  {hasExamples !== undefined && (
                    <button onClick={() => setHasExamples(undefined)} className="text-gray-400 hover:text-gray-600">
                      <FiX className="h-3.5 w-3.5" />
                    </button>
                  )}
                </label>

                {/* Has Related Terms */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={hasRelated === true}
                      onChange={(e) => setHasRelated(e.target.checked ? true : undefined)}
                      className="peer sr-only"
                    />
                    <div className="h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-brand-600 transition-colors dark:bg-gray-700" />
                    <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4 shadow-sm" />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                    Has Related Terms
                  </span>
                  {hasRelated !== undefined && (
                    <button onClick={() => setHasRelated(undefined)} className="text-gray-400 hover:text-gray-600">
                      <FiX className="h-3.5 w-3.5" />
                    </button>
                  )}
                </label>

                {/* Has Pronunciation */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={hasPronunciation === true}
                      onChange={(e) => setHasPronunciation(e.target.checked ? true : undefined)}
                      className="peer sr-only"
                    />
                    <div className="h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-brand-600 transition-colors dark:bg-gray-700" />
                    <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4 shadow-sm" />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                    Has IPA Pronunciation
                  </span>
                  {hasPronunciation !== undefined && (
                    <button onClick={() => setHasPronunciation(undefined)} className="text-gray-400 hover:text-gray-600">
                      <FiX className="h-3.5 w-3.5" />
                    </button>
                  )}
                </label>

                {/* Tone Marks Present */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={toneMarksPresent === true}
                      onChange={(e) => setToneMarksPresent(e.target.checked ? true : undefined)}
                      className="peer sr-only"
                    />
                    <div className="h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-brand-600 transition-colors dark:bg-gray-700" />
                    <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4 shadow-sm" />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                    Has Tone Marks (ẹ́, ọ̀, etc.)
                  </span>
                  {toneMarksPresent !== undefined && (
                    <button onClick={() => setToneMarksPresent(undefined)} className="text-gray-400 hover:text-gray-600">
                      <FiX className="h-3.5 w-3.5" />
                    </button>
                  )}
                </label>

                {/* IPA Present */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={ipaPresent === true}
                      onChange={(e) => setIpaPresent(e.target.checked ? true : undefined)}
                      className="peer sr-only"
                    />
                    <div className="h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-brand-600 transition-colors dark:bg-gray-700" />
                    <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4 shadow-sm" />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                    Has IPA Transcription
                  </span>
                  {ipaPresent !== undefined && (
                    <button onClick={() => setIpaPresent(undefined)} className="text-gray-400 hover:text-gray-600">
                      <FiX className="h-3.5 w-3.5" />
                    </button>
                  )}
                </label>
              </div>

              {/* Text Pattern Filters Column */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Text Patterns</h4>
                
                {/* Starts With */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
                    Starts with
                  </label>
                  <input
                    type="text"
                    value={startsWithFilter}
                    onChange={(e) => {
                      setStartsWithFilter(e.target.value);
                      setPage(1);
                    }}
                    placeholder="e.g., a, ba"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-brand-500"
                  />
                </div>

                {/* Contains */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
                    Contains
                  </label>
                  <input
                    type="text"
                    value={containsFilter}
                    onChange={(e) => {
                      setContainsFilter(e.target.value);
                      setPage(1);
                    }}
                    placeholder="e.g., ọ, sun"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-brand-500"
                  />
                </div>

                {/* Ends With */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
                    Ends with
                  </label>
                  <input
                    type="text"
                    value={endsWithFilter}
                    onChange={(e) => {
                      setEndsWithFilter(e.target.value);
                      setPage(1);
                    }}
                    placeholder="e.g., mi, ọ"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-brand-500"
                  />
                </div>

                {/* Word Length Range */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
                    Word Length
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={wordLengthMin ?? ""}
                      onChange={(e) => {
                        setWordLengthMin(e.target.value ? Number(e.target.value) : undefined);
                        setPage(1);
                      }}
                      placeholder="Min"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-brand-500"
                    />
                    <span className="text-gray-400">-</span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={wordLengthMax ?? ""}
                      onChange={(e) => {
                        setWordLengthMax(e.target.value ? Number(e.target.value) : undefined);
                        setPage(1);
                      }}
                      placeholder="Max"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-brand-500"
                    />
                  </div>
                </div>
              </div>

              {/* Part of Speech Multi-Select Column */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Part of Speech</h4>
                <div className="flex flex-wrap gap-2">
                  {POS_OPTIONS.map((pos) => (
                    <button
                      key={pos.value}
                      onClick={() => togglePosFilter(pos.value)}
                      className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        posFilter.includes(pos.value)
                          ? 'bg-brand-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                      }`}
                    >
                      {pos.label}
                      {posFilter.includes(pos.value) && (
                        <FiX className="ml-1.5 h-3 w-3" />
                      )}
                    </button>
                  ))}
                </div>
                {posFilter.length > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Selected: {posFilter.join(', ')}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <ActiveFilterChips filters={activeFilterChips} />
      </ContentFiltersCard>

      <StickyBulkActionBar
        selectedCount={selectedWords.length}
        onClear={() => setSelectedWords([])}
        itemName="word"
        actions={[
          {
            label: isDeleting ? 'Deleting...' : 'Delete Selected',
            onClick: handleBulkDelete,
            disabled: isDeleting,
            loading: isDeleting,
            variant: 'danger',
            icon: <FiTrash2 className="h-4 w-4" />,
          },
          {
            label: isRegenerating ? 'Regenerating...' : 'Regenerate Audio',
            onClick: handleBulkRegenerateAudio,
            disabled: isRegenerating,
            loading: isRegenerating,
            icon: <FiVolume2 className="h-4 w-4" />,
          },
        ]}
      />

      {/* Data Table */}
      <WordsDataTable
        words={uniqueWords}
        isLoading={isLoading}
        onDelete={handleDelete}
        onRegenerateAudio={handleRegenerateAudio}
        onViewDetails={(wordId) => setViewDetailWordId(wordId)}
        onSearch={(query) => {
          setSearch(query);
          setPage(1);
        }}
        searchQuery={search}
        selectedWords={selectedWords}
        onSelectWord={handleSelectWord}
        onSelectAll={handleSelectAll}
      />

      {/* Pagination */}
      {total > limit && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} words
            </p>
            <div className="ml-auto">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={(nextPage) => setPage(nextPage)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      <Modal isOpen={showModal} onClose={closeModal} className="max-w-2xl">
        <div className="max-h-[85vh] overflow-y-auto">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-5 dark:border-gray-700">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {editingWord ? "Edit Entry" : "Create New Entry"}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {editingWord ? "Update lexicon entry details below" : "Fill in the details to add a new lexicon entry"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6">
            {errorMessage && (
              <Alert variant="error" className="mb-4">
                {errorMessage}
              </Alert>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              {/* Language */}
              <div className="sm:col-span-2">
                <StyledSelect
                  label="Language"
                  required
                  disabled
                  value={formData.language_id}
                  onChange={(e) => setFormData({ ...formData, language_id: e.target.value })}
                  options={[
                    {
                      value: englishLanguage?.id ?? "",
                      label: englishLanguage ? `${englishLanguage.name} (fixed — the lemma pool is English-anchored)` : "English",
                    },
                  ]}
                  fullWidth
                />
              </div>

              {/* Word */}
              <div className="sm:col-span-2">
                <label className="mb-2.5 block text-sm font-medium text-gray-900 dark:text-white">
                  Word <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.word}
                  onChange={(e) => setFormData({ ...formData, word: e.target.value })}
                  required
                  placeholder="Enter word"
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-brand-500 disabled:cursor-default disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-brand-500"
                />
              </div>

              {/* Part of Speech */}
              <div>
                <StyledSelect
                  label="Part of Speech"
                  required
                  value={formData.pos}
                  onChange={(e) => setFormData({ ...formData, pos: e.target.value })}
                  options={[
                    { value: "noun", label: "Noun" },
                    { value: "verb", label: "Verb" },
                    { value: "adjective", label: "Adjective" },
                    { value: "adverb", label: "Adverb" },
                    { value: "pronoun", label: "Pronoun" },
                    { value: "other", label: "Other" }
                  ]}
                  fullWidth
                />
              </div>

              {/* Difficulty Level */}
              <div>
                <StyledSelect
                  label="Difficulty Level"
                  required
                  value={formData.difficulty_level}
                  onChange={(e) => setFormData({ ...formData, difficulty_level: Number(e.target.value) })}
                  options={[
                    { value: 1, label: "Level 1 (Beginner)" },
                    { value: 2, label: "Level 2 (Elementary)" },
                    { value: 3, label: "Level 3 (Intermediate)" },
                    { value: 4, label: "Level 4 (Advanced)" },
                    { value: 5, label: "Level 5 (Expert)" }
                  ]}
                  fullWidth
                />
              </div>

              {/* Category */}
              <div className="sm:col-span-2">
                <label className="mb-2.5 block text-sm font-medium text-gray-900 dark:text-white">
                  Category
                </label>
                <input
                  type="text"
                  value={formData.word_category}
                  onChange={(e) => setFormData({ ...formData, word_category: e.target.value })}
                  placeholder="e.g., Animals, Food, Colors"
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-brand-500 disabled:cursor-default disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-brand-500"
                />
              </div>

              {/* IPA Pronunciation */}
              <div className="sm:col-span-2">
                <label className="mb-2.5 block text-sm font-medium text-gray-900 dark:text-white">
                  IPA Pronunciation
                </label>
                <input
                  type="text"
                  value={formData.ipa_pronunciation}
                  onChange={(e) => setFormData({ ...formData, ipa_pronunciation: e.target.value })}
                  placeholder="Enter IPA pronunciation"
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-brand-500 disabled:cursor-default disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-brand-500"
                />
              </div>

              {/* Usage Notes */}
              <div className="sm:col-span-2">
                <label className="mb-2.5 block text-sm font-medium text-gray-900 dark:text-white">
                  Usage Notes
                </label>
                <textarea
                  value={formData.usage_notes}
                  onChange={(e) => setFormData({ ...formData, usage_notes: e.target.value })}
                  rows={3}
                  placeholder="Enter usage notes or examples"
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-brand-500 disabled:cursor-default disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-brand-500"
                />
              </div>

              {/* Audio Upload */}
              <div className="col-span-2">
                <label className="mb-2.5 block text-sm font-medium text-gray-900 dark:text-white">
                  Audio File
                </label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioChange}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
                {audioPreview && (
                  <div className="mt-3">
                    <audio controls src={audioPreview} className="w-full" />
                  </div>
                )}
                {uploadingAudio && (
                  <p className="mt-2 text-sm text-gray-500">Uploading audio...</p>
                )}
              </div>

              {/* Audio S3 Key */}
              <div>
                <label className="mb-2.5 block text-sm font-medium text-gray-900 dark:text-white">
                  Audio S3 Bucket Key
                </label>
                <input
                  type="text"
                  value={formData.s3_bucket_key}
                  onChange={(e) => setFormData({ ...formData, s3_bucket_key: e.target.value })}
                  placeholder="audio/words/word.mp3"
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-brand-500 disabled:cursor-default disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-brand-500"
                />
              </div>

              {/* Audio Duration */}
              <div>
                <label className="mb-2.5 block text-sm font-medium text-gray-900 dark:text-white">
                  Audio Duration (seconds)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.audio_duration_sec ?? ""}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    audio_duration_sec: e.target.value ? Number(e.target.value) : null 
                  })}
                  placeholder="2.5"
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-brand-500 disabled:cursor-default disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-brand-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex justify-end gap-3 border-t border-gray-200 pt-5 dark:border-gray-700">
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-center text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-300 dark:bg-brand-600 dark:hover:bg-brand-700 dark:focus:ring-brand-800"
              >
                {editingWord ? "Update Entry" : "Create Entry"}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Regenerate Audio Modal */}
      <RegenerateAudioModal
        isOpen={showRegenerateModal}
        onClose={() => {
          setShowRegenerateModal(false);
          setRegeneratingWord(null);
        }}
        target={regeneratingWord}
        onSuccess={() => {
          scheduleQueuedAudioRefresh(refresh);
        }}
      />

      {/* Word Detail Modal */}
      {viewDetailWordId && (
        <WordDetailModal
          wordId={viewDetailWordId}
          onClose={() => setViewDetailWordId(null)}
          onUpdate={() => refresh()}
        />
      )}

      {/* Bulk Delete Confirmation */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmBulkDelete}
        title="Delete Lexicon Entries"
        message={`Are you sure you want to delete ${selectedWords.length} entr${selectedWords.length === 1 ? 'y' : 'ies'}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* Bulk Regenerate Audio Confirmation */}
      <ConfirmationModal
        isOpen={showRegenerateConfirm}
        onClose={() => setShowRegenerateConfirm(false)}
        onConfirm={confirmBulkRegenerateAudio}
        title="Regenerate Audio"
        message={`Regenerate audio for ${selectedWords.length} word(s)? This will replace existing audio files.`}
        confirmText="Regenerate"
        cancelText="Cancel"
        variant="warning"
        isLoading={isRegenerating}
      />
    </div>
  );
}

/**
 * Word Management Hooks
 * Custom hooks for word CRUD, example generation, audio regeneration
 */

import { useState } from 'react';
import useSWR from 'swr';
import { apiClient } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

// Types
export interface WordListItem {
  id: string;
  lemma: string;
  lemma_normalized: string;
  pos: string;
  language_id: string;
  category: string | null;
  difficulty_level: number | null;
  has_audio: boolean;
  has_examples: boolean;
  has_pronunciation: boolean;
  audio_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface WordDetail {
  word: {
    id: string;
    lemma: string;
    pos: string;
    language_id: string;
    language_name: string;
    language_code?: string;
    word_category: string | null;
    difficulty_level: number | null;
    usage_notes: string | null;
    is_published: boolean;
  };
  senses: Array<{
    id: string;
    sense_index: number;
    domain_tags: string[] | null;
    usage_notes: string | null;
    glosses: Array<{
      id: string;
      definition: string;
      gloss_index: number;
      language_id: string;
      language_name: string;
    }>;
  }>;
  examples: Array<{
    id: string;
    sense_id: string;
    example_yoruba: string;
    example_english: string;
    translation_language_id: string;
    translation_language_name: string;
    audio_url?: string | null;
    created_at: string;
  }>;
  audio_files: Array<{
    id: string;
    s3_bucket_key: string;
    audio_url: string | null;
    duration_sec: number | null;
    quality_score: number | null;
    provider: string;
    voice_name: string | null;
    human_recorded: boolean;
    reviewed_at: string | null;
    created_at: string;
    updated_at: string;
  }>;
  pronunciations: Array<{
    id: string;
    ipa: string;
    dialect: string | null;
  }>;
  forms: Array<{
    id: string;
    form: string;
    form_type: string | null;
    tags: string[];
    ipa: string | null;
  }>;
  related_terms: Array<{
    id: string;
    relationship_type: string;
    related_word: string;
    created_at: string;
  }>;
}

export interface WordFilters {
  search?: string;
  pos?: string;
  language_id?: string;
  has_audio?: boolean;
  has_examples?: boolean;
  difficulty_level?: number;
  page?: number;
  per_page?: number;
}

export interface PaginatedWords {
  items: WordListItem[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

// Fetcher function
const fetcher = (url: string) => apiClient.get(url).then((res) => res.data);

/**
 * Hook to fetch word list with filters
 */
export function useWordList(filters: WordFilters = {}) {
  const params = new URLSearchParams();
  if (filters.search) params.append('search', filters.search);
  if (filters.pos) params.append('pos', filters.pos);
  if (filters.language_id) params.append('language_id', filters.language_id);
  if (filters.has_audio !== undefined) params.append('has_audio', String(filters.has_audio));
  if (filters.has_examples !== undefined) params.append('has_examples', String(filters.has_examples));
  if (filters.difficulty_level) params.append('difficulty_level', String(filters.difficulty_level));
  params.append('page', String(filters.page || 1));
  params.append('per_page', String(filters.per_page || 20));

  const { data, error, mutate, isLoading } = useSWR<PaginatedWords>(
    `/api/v1/admin/content/words?${params.toString()}`,
    fetcher
  );

  return {
    words: data?.items || [],
    total: data?.total || 0,
    page: data?.page || 1,
    pages: data?.pages || 1,
    isLoading,
    isError: !!error,
    mutate,
  };
}

/**
 * Hook to fetch word detail
 */
export function useWordDetail(wordId: string | null) {
  const { data, error, mutate, isLoading } = useSWR<WordDetail>(
    wordId ? `/api/v1/admin/content/words/${wordId}/detail` : null,
    fetcher
  );

  return {
    wordDetail: data,
    isLoading,
    isError: !!error,
    mutate,
  };
}

/**
 * Hook for bulk audio regeneration
 */
export function useBulkAudioRegeneration() {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const toast = useToast();

  const regenerateAudio = async (wordIds: string[], voiceId?: string, previewOnly = false) => {
    setIsRegenerating(true);
    try {
      const response = await apiClient.post('/api/v1/admin/content/words/bulk/regenerate-audio', {
        lemma_ids: wordIds,
        voice_id: voiceId,
        preview_only: previewOnly,
      });

      const data = response.data;
      
      if (previewOnly) {
        toast.success(`Would create ${data.jobs_created} audio generation jobs`);
      } else {
        toast.success(`Successfully created ${data.jobs_created} audio generation jobs`);
      }

      if (data.failed_words && data.failed_words.length > 0) {
        toast.info(`${data.failed_words.length} words failed to queue`);
      }

      return data;
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to regenerate audio');
      throw error;
    } finally {
      setIsRegenerating(false);
    }
  };

  return { regenerateAudio, isRegenerating };
}

/**
 * Hook for example generation
 */
export function useExampleGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const toast = useToast();

  const generateExamples = async (wordId: string, count: number = 2) => {
    setIsGenerating(true);
    try {
      const includePrompt = process.env.NEXT_PUBLIC_AI_PROMPT_DEBUG === '1';
      const response = await apiClient.post(
        `/api/v1/admin/content/words/${wordId}/generate-examples`,
        { count, include_prompt: includePrompt }
      );

      const data = response.data;
      
      if (data.success) {
        toast.success(`Generated ${data.count} examples`);
      }

      if (includePrompt && (data.prompt || data.messages)) {
        // eslint-disable-next-line no-console
        console.groupCollapsed('[AI] generate-examples prompt');
        // eslint-disable-next-line no-console
        if (data.prompt) 
        // eslint-disable-next-line no-console
        if (data.messages) 
        // eslint-disable-next-line no-console
        console.groupEnd();
      }

      return data.examples;
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.response?.data?.detail || 'Failed to generate examples';
      toast.error(errorMsg);
      throw error;
    } finally {
      setIsGenerating(false);
    }
  };

  return { generateExamples, isGenerating };
}

/**
 * Hook for example CRUD operations
 */
export function useExampleManagement() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

  const createExample = async (data: {
    sense_id: string;
    text: string;
    translation_text: string;
    translation_language_id: string;
  }) => {
    setIsSubmitting(true);
    try {
      const response = await apiClient.post('/api/v1/admin/content/examples', data);
      toast.success('Example created successfully');
      return response.data;
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to create example');
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateExample = async (exampleId: string, data: {
    text?: string;
    translation_text?: string;
  }) => {
    setIsSubmitting(true);
    try {
      const response = await apiClient.put(
        `/api/v1/admin/content/examples/${exampleId}`,
        data
      );
      toast.success('Example updated successfully');
      return response.data;
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update example');
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteExample = async (exampleId: string) => {
    setIsSubmitting(true);
    try {
      await apiClient.delete(`/api/v1/admin/content/examples/${exampleId}`);
      toast.success('Example deleted successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete example');
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  return { createExample, updateExample, deleteExample, isSubmitting };
}

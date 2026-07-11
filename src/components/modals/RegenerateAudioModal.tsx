"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { Modal } from "@/components/ui/modal";
import { StyledSelect } from "@/components/ui/form/StyledSelect";
import { FiVolume2 } from "react-icons/fi";

interface Voice {
  id: string;
  display_name?: string;
  name?: string;
  voice_code?: string;
  provider: string;
  language_code: string;
}

export interface RegenerateAudioTarget {
  id: string;
  contentType: "word" | "phrase" | "proverb" | "number";
  displayText: string;
  defaultText: string;
  languageCode: string;
  submitEndpoint: string;
}

interface RegenerateAudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: RegenerateAudioTarget | null;
  onSuccess?: () => void;
}

const LANGUAGE_CODE_MAP: Record<string, string> = {
  yor: "yo",
  eng: "en",
  hau: "ha",
  ibo: "ig",
  swa: "sw",
};

const getVoiceLabel = (voice: Voice) => (
  voice.display_name || voice.name || voice.voice_code || "Unknown Voice"
);

const providerPriority = (provider: string) => {
  if (provider === "google") return 0;
  if (provider === "elevenlabs") return 1;
  if (provider === "spitch") return 2;
  return 3;
};

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

export function RegenerateAudioModal({ isOpen, onClose, target, onSuccess }: RegenerateAudioModalProps) {
  const toast = useToast();
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
  const [selectedProvider, setSelectedProvider] = useState<string>("all");
  const [textOverride, setTextOverride] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);

  const providerOptions = useMemo(() => {
    const uniqueProviders = Array.from(new Set(voices.map((voice) => voice.provider))).sort();
    return ["all", ...uniqueProviders];
  }, [voices]);

  const filteredVoices = useMemo(() => {
    if (selectedProvider === "all") {
      return voices;
    }
    return voices.filter((voice) => voice.provider === selectedProvider);
  }, [voices, selectedProvider]);

  useEffect(() => {
    if (filteredVoices.length === 0) {
      setSelectedVoiceId("");
      return;
    }

    const selectedStillVisible = filteredVoices.some((voice) => voice.id === selectedVoiceId);
    if (!selectedStillVisible) {
      setSelectedVoiceId(filteredVoices[0].id);
    }
  }, [filteredVoices, selectedVoiceId]);

  const fetchVoices = useCallback(async () => {
    if (!target) return;
    
    setIsLoadingVoices(true);
    try {
      const ttsLanguageCode = LANGUAGE_CODE_MAP[target.languageCode] || target.languageCode;
      
      const response = await apiClient.get('/api/v1/admin/audio/voices', {
        params: {
          language_code: ttsLanguageCode,
          is_active: true,
          dedupe_aliases: true,
          page_size: 100,
        }
      });
      
      const voicesList: Voice[] = response.data.items || [];
      setVoices(voicesList);

      if (voicesList.length > 0) {
        const providers: string[] = Array.from(new Set(voicesList.map((voice: Voice) => voice.provider)));
        providers.sort((a, b) => providerPriority(a) - providerPriority(b) || a.localeCompare(b));
        setSelectedProvider(providers[0] || "all");
      } else {
        setSelectedProvider("all");
      }
    } catch (error: any) {
      console.error("Error fetching voices:", error);
      toast.error(formatErrorMessage(error, "Failed to load voices"));
    } finally {
      setIsLoadingVoices(false);
    }
  }, [target, toast]);

  useEffect(() => {
    if (isOpen && target) {
      setTextOverride(target.defaultText);
      setSelectedProvider("all");
      fetchVoices();
    }
  }, [fetchVoices, isOpen, target]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!target || !selectedVoiceId) {
      toast.error("Please select a voice");
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.post(target.submitEndpoint, {
        voice_id: selectedVoiceId,
        text_override: textOverride !== target.defaultText ? textOverride : null
      });
      
      toast.success("Audio regeneration queued successfully");
      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast.error(formatErrorMessage(error, "Failed to regenerate audio"));
    } finally {
      setIsLoading(false);
    }
  };

  if (!target) return null;

  const selectedVoice = filteredVoices.find((voice) => voice.id === selectedVoiceId)
    || voices.find((voice) => voice.id === selectedVoiceId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Regenerate Audio: ${target.displayText}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <StyledSelect
            label="Provider"
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            options={providerOptions.map((provider) => ({
              value: provider,
              label: provider === "all" ? "All Providers" : provider,
            }))}
            fullWidth
          />
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
            Filter voices by TTS provider. Generated audio will prefer WAV when the provider supports it, otherwise it will fall back automatically.
          </p>
        </div>

        {/* Voice Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Voice *
          </label>
          
          {isLoadingVoices ? (
            <div className="text-sm text-gray-500">Loading voices...</div>
          ) : filteredVoices.length === 0 ? (
            <div className="text-sm text-red-600">
              No compatible voices available for {target.languageCode}{selectedProvider !== "all" ? ` using ${selectedProvider}` : ""}
            </div>
          ) : (
            <StyledSelect
              value={selectedVoiceId}
              onChange={(e) => setSelectedVoiceId(e.target.value)}
              required
              options={filteredVoices.map((voice) => ({
                value: voice.id,
                label: `${getVoiceLabel(voice)} (${voice.provider})`,
              }))}
              fullWidth
            />
          )}
          
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
            Choose the TTS provider and voice for audio generation
          </p>
        </div>

        {/* Text Override */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Text to Speak
          </label>
          <input
            type="text"
            value={textOverride}
            onChange={(e) => setTextOverride(e.target.value)}
            placeholder={target.defaultText}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-brand-400"
          />
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
            Override the text sent to TTS. Leave as default to use the saved content text for this item.
          </p>
        </div>

        {/* Voice Preview Info */}
        {selectedVoiceId && (
          <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
            <div className="flex items-start gap-3">
              <FiVolume2 className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-300">
                <p className="font-medium">
                  {selectedVoice ? getVoiceLabel(selectedVoice) : "Selected voice"}
                </p>
                <p className="text-xs mt-1 text-blue-700 dark:text-blue-400">
                  Provider: {selectedVoice?.provider} • 
                  Language: {target.languageCode} • Preferred output: WAV when supported
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading || !selectedVoiceId || filteredVoices.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-gray-900"
          >
            <FiVolume2 className="h-4 w-4" />
            {isLoading ? "Regenerating..." : "Regenerate Audio"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

"use client";

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import {
  TTSProvider,
  TTSProviderVoice,
  TTSPreviewRequest,
  TTSPreviewResponse,
  Lemma
} from '@/types/tts';

/**
 * Admin TTS Generation Page
 * 
 * Allows admins to:
 * - Select a word/lemma
 * - Choose TTS provider (Spitch, Google, etc.)
 * - Select voice
 * - Generate preview
 * - Save approved audio
 * - Delete audio
 */

export default function TTSGenerationPage() {
  // State
  const [providers, setProviders] = useState<TTSProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [voices, setVoices] = useState<TTSProviderVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<TTSProviderVoice | null>(null);
  
  const [lemmas, setLemmas] = useState<Lemma[]>([]);
  const [selectedLemma, setSelectedLemma] = useState<Lemma | null>(null);
  const [customText, setCustomText] = useState<string>('');
  
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<TTSPreviewResponse | null>(null);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProviders, setIsLoadingProviders] = useState(true);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [isLoadingLemmas, setIsLoadingLemmas] = useState(false);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [voicesError, setVoicesError] = useState<string | null>(null);
  const [lemmasError, setLemmasError] = useState<string | null>(null);

  // Fetch providers on mount
  useEffect(() => {
    fetchProviders();
    fetchLemmas();
  }, []);

  // Fetch voices when provider changes
  useEffect(() => {
    if (selectedProvider) {
      fetchVoices(selectedProvider);
    } else {
      setVoices([]);
      setSelectedVoice(null);
    }
  }, [selectedProvider]);

  const fetchProviders = async () => {
    setIsLoadingProviders(true);
    try {
      const response = await apiClient.get('/api/v1/admin/audio/providers');
      setProviders(response.data.providers || []);
      setProvidersError(null);
      
      // Auto-select first available provider
      const firstAvailable = response.data.providers.find((p: TTSProvider) => p.is_available);
      if (firstAvailable) {
        setSelectedProvider(firstAvailable.name);
      }
    } catch (error: any) {
      console.error('Error fetching providers:', error);
      setProvidersError('Failed to load TTS providers. Check your connection.');
      toast.error(error.response?.data?.detail || 'Failed to load TTS providers');
    } finally {
      setIsLoadingProviders(false);
    }
  };

  const fetchVoices = async (provider: string) => {
    setIsLoadingVoices(true);
    try {
      const response = await apiClient.get(`/api/v1/admin/audio/providers/${provider}/voices`, {
        params: { is_active: true, dedupe_aliases: true }
      });
      setVoices(response.data.voices || []);
      
      // Auto-select first voice
      if (response.data.voices && response.data.voices.length > 0) {
        setSelectedVoice(response.data.voices[0]);
      }
    } catch (error: any) {
      console.error('Error fetching voices:', error);
      toast.error(error.response?.data?.detail || 'Failed to load voices');
      setVoices([]);
    } finally {
      setIsLoadingVoices(false);
    }
  };

  const fetchLemmas = async () => {
    setIsLoadingLemmas(true);
    try {
      // Fetch Yoruba words/lemmas
      const response = await apiClient.get('/api/v1/admin/content/words', {
        params: { limit: 100, language_code: 'yo' }
      });
      
      // Transform to Lemma format
      const lemmasData = response.data.words?.map((w: any) => ({
        id: w.lemma_id,
        word: w.word,
        language_id: w.language_id,
        language_code: 'yo',
        word_class: w.word_class,
        definition: w.definition,
        audio_url: w.audio_url
      })) || [];
      
      setLemmas(lemmasData);
      
      // Auto-select first lemma
      if (lemmasData.length > 0) {
        setSelectedLemma(lemmasData[0]);
        setCustomText(lemmasData[0].word);
      }
    } catch (error: any) {
      console.error('Error fetching lemmas:', error);
      toast.error('Failed to load words');
    } finally {
      setIsLoadingLemmas(false);
    }
  };

  const generatePreview = async () => {
    if (!selectedLemma || !selectedProvider || !selectedVoice) {
      toast.error('Please select a word, provider, and voice');
      return;
    }

    setIsGenerating(true);
    setPreviewUrl(null);
    setPreviewData(null);

    try {
      const requestData: TTSPreviewRequest = {
        lemma_id: selectedLemma.id,
        language_id: selectedLemma.language_id,
        provider: selectedProvider,
        voice_code: selectedVoice.voice_code,
        custom_text: customText || undefined,
      };

      const response = await apiClient.post<TTSPreviewResponse>(
        '/api/v1/admin/audio/preview',
        requestData
      );

      setPreviewUrl(response.data.preview_url);
      setPreviewData(response.data);
      toast.success('Audio preview generated!');
    } catch (error: any) {
      console.error('Error generating preview:', error);
      toast.error(error.response?.data?.detail || 'Failed to generate audio preview');
    } finally {
      setIsGenerating(false);
    }
  };

  const saveAudio = async () => {
    if (!previewUrl || !previewData || !selectedLemma || !selectedVoice) {
      toast.error('Please generate a preview first');
      return;
    }

    setIsSaving(true);

    try {
      // Download audio from preview URL
      const audioResponse = await fetch(previewUrl);
      const blob = await audioResponse.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      
      // Convert to base64
      const audio_data = btoa(String.fromCharCode(...bytes));

      // Save to database
      const saveResponse = await apiClient.post('/api/v1/admin/audio/save', {
        lemma_id: selectedLemma.id,
        language_id: selectedLemma.language_id,
        provider: selectedProvider,
        voice_id: selectedVoice.id,
        audio_data: audio_data,
        duration_sec: previewData.duration_sec,
        format: previewData.format,
        sample_rate: previewData.sample_rate,
        custom_text: customText || undefined
      });

      toast.success('Audio saved successfully!');
      
      // Clear preview
      setPreviewUrl(null);
      setPreviewData(null);
      
      // Refresh lemmas to show updated audio
      fetchLemmas();
    } catch (error: any) {
      console.error('Error saving audio:', error);
      toast.error(error.response?.data?.detail || 'Failed to save audio');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          🎙️ TTS Audio Generation
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Generate text-to-speech audio for words using multiple providers (Spitch, Google, ElevenLabs)
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Word Selection */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              1. Select Word
            </h2>
            
            {isLoadingLemmas ? (
              <div className="text-center py-4">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-primary border-r-transparent"></div>
                <p className="mt-2 text-sm text-gray-500">Loading words...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <StyledSelect
                    label="Word/Lemma"
                    value={selectedLemma?.id || ''}
                    onChange={(e) => {
                      const lemma = lemmas.find(l => l.id === e.target.value);
                      setSelectedLemma(lemma || null);
                      if (lemma) setCustomText(lemma.word);
                    }}
                    options={[
                      { value: '', label: 'Select a word...' },
                      ...lemmas.map((lemma) => ({
                        value: lemma.id,
                        label: `${lemma.word}${lemma.word_class ? ` (${lemma.word_class})` : ''}`,
                      })),
                    ]}
                    fullWidth
                  />
                  {lemmasError && <p className="mt-1 text-xs text-red-500">{lemmasError}</p>}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Text to Speak (optional override)
                  </label>
                  <input
                    type="text"
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder="e.g., Ẹ kú àárọ̀"
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 focus:border-primary focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Leave empty to use the word itself
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Provider & Voice Selection */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              2. Select Provider & Voice
            </h2>

            {isLoadingProviders ? (
              <div className="text-center py-4">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-primary border-r-transparent"></div>
                <p className="mt-2 text-sm text-gray-500">Loading providers...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Provider Selection */}
                <div>
                  <StyledSelect
                    label="TTS Provider"
                    value={selectedProvider}
                    onChange={(e) => setSelectedProvider(e.target.value)}
                    options={[
                      { value: '', label: 'Select provider...' },
                      ...providers
                        .filter(p => p.is_available)
                        .map((provider) => ({
                          value: provider.name,
                          label: `${provider.display_name}${!provider.is_configured ? ' (Not Configured)' : ''}`,
                        })),
                    ]}
                    fullWidth
                  />
                </div>

                {/* Voice Selection */}
                {selectedProvider && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Voice
                    </label>
                    {isLoadingVoices ? (
                      <div className="text-center py-4">
                        <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-primary border-r-transparent"></div>
                      </div>
                    ) : voices.length > 0 ? (
                      <StyledSelect
                        value={selectedVoice?.id || ''}
                        onChange={(e) => {
                          const voice = voices.find(v => v.id === e.target.value);
                          setSelectedVoice(voice || null);
                        }}
                        options={voices.map((voice) => ({
                          value: voice.id,
                          label: `${voice.display_name}${voice.gender ? ` (${voice.gender})` : ''}${voice.is_premium ? ' 👑' : ''}`,
                        }))}
                        fullWidth
                      />
                    ) : (
                      <p className="text-sm text-gray-500">No voices available for this provider</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Generate Button */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              3. Generate Preview
            </h2>

            <button
              onClick={generatePreview}
              disabled={!selectedLemma || !selectedProvider || !selectedVoice || isGenerating}
              className="w-full rounded-lg bg-primary px-6 py-3 text-white font-medium hover:bg-primary/90 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {isGenerating ? (
                <span className="flex items-center justify-center">
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent"></div>
                  Generating...
                </span>
              ) : (
                '🎵 Generate Audio Preview'
              )}
            </button>

            {selectedLemma && selectedProvider && selectedVoice && (
              <div className="mt-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-700/50">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  <strong>Preview Configuration:</strong>
                  <br />
                  Word: <span className="font-mono">{customText || selectedLemma.word}</span>
                  <br />
                  Provider: {providers.find(p => p.name === selectedProvider)?.display_name}
                  <br />
                  Voice: {selectedVoice.display_name}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Preview & Save */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-6">
            {/* Audio Preview */}
            {previewUrl && previewData && (
              <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                  🎧 Preview
                </h2>

                <div className="space-y-4">
                  {/* Audio Player */}
                  <div>
                    <audio
                      src={previewUrl}
                      controls
                      className="w-full"
                      style={{ height: '54px' }}
                    />
                  </div>

                  {/* Metadata */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Duration:</span>
                      <span className="font-medium">{previewData.duration_sec.toFixed(2)}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Format:</span>
                      <span className="font-medium uppercase">{previewData.format}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Sample Rate:</span>
                      <span className="font-medium">{previewData.sample_rate} Hz</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Provider:</span>
                      <span className="font-medium capitalize">{previewData.provider}</span>
                    </div>
                  </div>

                  {/* Expiration Warning */}
                  <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      ⏰ Preview expires in 1 hour. Save to make permanent.
                    </p>
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={saveAudio}
                    disabled={isSaving}
                    className="w-full rounded-lg bg-green-600 px-4 py-3 text-white font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSaving ? (
                      <span className="flex items-center justify-center">
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent"></div>
                        Saving...
                      </span>
                    ) : (
                      '💾 Save Audio'
                    )}
                  </button>

                  {/* Regenerate Button */}
                  <button
                    onClick={() => {
                      setPreviewUrl(null);
                      setPreviewData(null);
                    }}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 font-medium hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    🔄 Generate New Preview
                  </button>
                </div>
              </div>
            )}

            {/* Instructions */}
            {!previewUrl && (
              <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                  📋 Instructions
                </h2>
                <ol className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex items-start">
                    <span className="mr-2 font-bold">1.</span>
                    <span>Select a word/lemma to generate audio for</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2 font-bold">2.</span>
                    <span>Choose a TTS provider (Spitch, Google, etc.)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2 font-bold">3.</span>
                    <span>Select a voice from the available options</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2 font-bold">4.</span>
                    <span>Generate preview and listen to the audio</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2 font-bold">5.</span>
                    <span>If satisfied, save the audio permanently</span>
                  </li>
                </ol>

                <div className="mt-4 rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
                  <p className="text-xs text-blue-800 dark:text-blue-200">
                    💡 <strong>Tip:</strong> You can override the text to speak if needed. Previews expire after 1 hour.
                  </p>
                </div>
              </div>
            )}

            {/* Provider Info */}
            {!isLoadingProviders && providers.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                  Available Providers
                </h2>
                <div className="space-y-2">
                  {providers.map((provider) => (
                    <div
                      key={provider.name}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-700 dark:text-gray-300">
                        {provider.display_name}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          provider.is_available
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        {provider.is_available ? '✓ Available' : '✗ Unavailable'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

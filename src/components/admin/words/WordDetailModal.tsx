/**
 * Word Detail Modal
 * Comprehensive view of word data with:
 * - All senses and glosses
 * - Examples with audio
 * - Pronunciations and forms
 * - Related terms
 * - Audio playback
 * - Example generation
 */

'use client';

import React, { useState } from 'react';
import { useWordDetail, useExampleGeneration, useExampleManagement } from '@/hooks/useWordManagement';
import { FiX, FiVolume2, FiPlus, FiEdit2, FiTrash2, FiLoader, FiSave, FiRefreshCw, FiEye, FiEyeOff } from 'react-icons/fi';
import { apiClient } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { StyledSelect } from '@/components/ui/form/StyledSelect';

interface WordDetailModalProps {
  wordId: string;
  onClose: () => void;
  onUpdate: () => void;
}

export default function WordDetailModal({ wordId, onClose, onUpdate }: WordDetailModalProps) {
  const { wordDetail, isLoading, mutate } = useWordDetail(wordId);
  const { generateExamples, isGenerating } = useExampleGeneration();
  const { deleteExample, isSubmitting } = useExampleManagement();
  const toast = useToast();
  
  const [activeTab, setActiveTab] = useState<'overview' | 'examples' | 'audio'>('overview');
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  
  // Edit states
  const [isEditingLemma, setIsEditingLemma] = useState(false);
  const [editedLemma, setEditedLemma] = useState('');
  const [editingGlossId, setEditingGlossId] = useState<string | null>(null);
  const [editedGloss, setEditedGloss] = useState('');
  const [editingExampleId, setEditingExampleId] = useState<string | null>(null);
  const [editedExampleYoruba, setEditedExampleYoruba] = useState('');
  const [editedExampleEnglish, setEditedExampleEnglish] = useState('');
  const [isRegeneratingAudio, setIsRegeneratingAudio] = useState(false);
  const [exampleCount, setExampleCount] = useState(3);
  const [isPreviewingPrompt, setIsPreviewingPrompt] = useState(false);
  const [promptPreview, setPromptPreview] = useState<string | null>(null);
  const [promptMessagesPreview, setPromptMessagesPreview] = useState<any[] | null>(null);
  const [customTTSText, setCustomTTSText] = useState('');
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [editedForm, setEditedForm] = useState('');
  const [editedFormType, setEditedFormType] = useState('');
  const [generatingGlossId, setGeneratingGlossId] = useState<string | null>(null);
  const [glossAudioUrls, setGlossAudioUrls] = useState<Record<string, string>>({});

  const handleUpdateLemma = async () => {
    if (!editedLemma.trim()) return;
    
    try {
      await apiClient.patch(`/api/v1/admin/content/words/${wordId}`, { lemma: editedLemma });
      toast.success('Lemma updated successfully');
      setIsEditingLemma(false);
      mutate();
      onUpdate();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update lemma');
    }
  };

  const handleGlossAudio = async (glossId: string) => {
    setGeneratingGlossId(glossId);
    try {
      const res = await apiClient.post(`/api/v1/admin/content/glosses/${glossId}/regenerate-audio`);
      toast.success('Gloss audio generated');
      const url = res.data.audio_url;
      setGlossAudioUrls(prev => ({ ...prev, [glossId]: url }));
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to generate gloss audio');
    } finally {
      setGeneratingGlossId(null);
    }
  };

  const handleUpdateGloss = async (glossId: string) => {
    if (!editedGloss.trim()) return;
    
    try {
      await apiClient.patch(`/api/v1/admin/content/glosses/${glossId}`, { definition: editedGloss });
      toast.success('Definition updated successfully');
      setEditingGlossId(null);
      mutate();
      onUpdate();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update definition');
    }
  };

  const handleUpdateExample = async (exampleId: string) => {
    try {
      await apiClient.patch(`/api/v1/admin/content/examples/${exampleId}`, {
        example_yoruba: editedExampleYoruba,
        example_english: editedExampleEnglish
      });
      toast.success('Example updated successfully');
      setEditingExampleId(null);
      mutate();
      onUpdate();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update example');
    }
  };

  const handleRegenerateAudio = async () => {
    if (!confirm('Regenerate audio for this word? This will create a new audio generation job.')) return;
    
    setIsRegeneratingAudio(true);
    try {
      await apiClient.post(`/api/v1/admin/content/words/single/${wordId}/regenerate-audio`, {});
      toast.success('Audio regeneration queued successfully');
      setTimeout(() => mutate(), 2000); // Refresh after 2s
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to regenerate audio');
    } finally {
      setIsRegeneratingAudio(false);
    }
  };

  const startEditLemma = () => {
    setEditedLemma(word.lemma);
    setIsEditingLemma(true);
  };

  const startEditGloss = (glossId: string, currentDefinition: string) => {
    setEditedGloss(currentDefinition);
    setEditingGlossId(glossId);
  };

  const startEditExample = (example: any) => {
    setEditedExampleYoruba(example.example_yoruba);
    setEditedExampleEnglish(example.example_english || '');
    setEditingExampleId(example.id);
  };

  const handleGenerateExamples = async () => {
    if (exampleCount < 1 || exampleCount > 10) {
      toast.error('Please enter a number between 1 and 10');
      return;
    }

    await generateExamples(wordId, exampleCount);
    setPromptPreview(null);
    setPromptMessagesPreview(null);
    mutate();
    onUpdate();
  };

  const handlePreviewExamplesPrompt = async () => {
    if (exampleCount < 1 || exampleCount > 10) {
      toast.error('Please enter a number between 1 and 10');
      return;
    }

    setIsPreviewingPrompt(true);
    try {
      const response = await apiClient.post(
        `/api/v1/admin/content/words/${wordId}/generate-examples`,
        { count: exampleCount, preview_only: true }
      );

      const data = response.data;
      setPromptPreview(data.prompt || null);
      setPromptMessagesPreview(data.messages || null);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || error.response?.data?.error || 'Failed to preview prompt');
    } finally {
      setIsPreviewingPrompt(false);
    }
  };

  const handleDeleteExample = async (exampleId: string) => {
    if (!confirm('Delete this example?')) return;
    await deleteExample(exampleId);
    mutate();
    onUpdate();
  };

  const handleGenerateCustomAudio = async () => {
    if (!customTTSText.trim()) {
      toast.error('Please enter text for audio generation');
      return;
    }

    setIsGeneratingAudio(true);
    try {
      const languageCode = wordDetail?.word?.language_code || 'yor';
      const response = await apiClient.post('/api/v1/admin/audio/generate', {
        text: customTTSText,
        provider: 'spitch',
        voice_code: 'funmi',
        language_code: languageCode,
        save_to_s3: true,
        audio_format: 'wav'
      });
      
      setGeneratedAudioUrl(response.data.audio_url);
      toast.success('Audio generated successfully. Listen and accept or reject.');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to generate audio');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const startEditForm = (form: any) => {
    setEditedForm(form.form);
    setEditedFormType(form.form_type || 'variant');
    setEditingFormId(form.id);
  };

  const handleUpdateForm = async (formId: string) => {
    try {
      await apiClient.patch(`/api/v1/admin/content/forms/${formId}`, {
        form: editedForm,
        form_type: editedFormType
      });
      toast.success('Form updated successfully');
      setEditingFormId(null);
      mutate();
      onUpdate();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update form');
    }
  };

  const handleAcceptCustomAudio = async () => {
    if (!generatedAudioUrl) return;

    try {
      await apiClient.patch(`/api/v1/admin/content/words/${wordId}`, {
        audio_url: generatedAudioUrl
      });
      toast.success('Audio updated successfully');
      setGeneratedAudioUrl(null);
      setCustomTTSText('');
      mutate();
      onUpdate();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update audio');
    }
  };

  const handleRejectCustomAudio = () => {
    setGeneratedAudioUrl(null);
    toast.info('Audio rejected');
  };

  const handleTogglePublish = async () => {
    if (!wordDetail?.word) return;
    
    const endpoint = wordDetail.word.is_published ? 'unpublish' : 'publish';
    const action = wordDetail.word.is_published ? 'unpublish' : 'publish';
    
    if (!confirm(`Are you sure you want to ${action} this word?`)) return;

    try {
      await apiClient.post(`/api/v1/admin/content/words/${wordId}/${endpoint}`);
      toast.success(`Word ${action}ed successfully`);
      mutate();
      onUpdate();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || `Failed to ${action} word`);
    }
  };

  const playAudio = (audioUrl: string, id: string) => {
    if (playingAudio === id) {
      setPlayingAudio(null);
      return;
    }

    const audio = new Audio(audioUrl);
    audio.play();
    setPlayingAudio(id);
    audio.onended = () => setPlayingAudio(null);
  };

  if (isLoading || !wordDetail) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-900 rounded-lg p-8">
          <FiLoader className="animate-spin text-brand-600 w-8 h-8" />
        </div>
      </div>
    );
  }

  const { word } = wordDetail;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex-1">
            {isEditingLemma ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editedLemma}
                  onChange={(e) => setEditedLemma(e.target.value)}
                  className="text-2xl font-bold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-1 text-gray-900 dark:text-white"
                  autoFocus
                />
                <button
                  onClick={handleUpdateLemma}
                  className="p-2 bg-green-600 hover:bg-green-700 text-white rounded"
                >
                  <FiSave size={18} />
                </button>
                <button
                  onClick={() => setIsEditingLemma(false)}
                  className="p-2 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-white rounded"
                >
                  <FiX size={18} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {word.lemma}
                </h2>
                <button
                  onClick={startEditLemma}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <FiEdit2 size={18} />
                </button>
              </div>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {word.pos} · {word.language_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 px-6">
          <div className="flex gap-4">
            {['overview', 'examples', 'audio'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`py-3 px-4 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'overview' && (
            <>
              {/* Senses and Glosses */}
              {wordDetail.senses.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Definitions
                  </h3>
                  <div className="space-y-4">
                    {wordDetail.senses.map((sense, idx) => (
                      <div
                        key={sense.id}
                        className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-brand-600 text-white rounded-full flex items-center justify-center text-xs font-medium">
                            {idx + 1}
                          </span>
                          <div className="flex-1 space-y-2">
                            {sense.glosses.map((gloss) => (
                              <div key={gloss.id}>
                                {editingGlossId === gloss.id ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={editedGloss}
                                      onChange={(e) => setEditedGloss(e.target.value)}
                                      className="flex-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => handleUpdateGloss(gloss.id)}
                                      className="p-2 bg-green-600 hover:bg-green-700 text-white rounded"
                                    >
                                      <FiSave size={16} />
                                    </button>
                                    <button
                                      onClick={() => setEditingGlossId(null)}
                                      className="p-2 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-white rounded"
                                    >
                                      <FiX size={16} />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="flex-1 text-gray-900 dark:text-white">
                                      {gloss.definition}
                                    </p>
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => handleGlossAudio(gloss.id)}
                                        disabled={generatingGlossId === gloss.id}
                                        className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-50"
                                        title="Generate audio for this translation"
                                      >
                                        {generatingGlossId === gloss.id ? (
                                          <FiLoader className="animate-spin" size={14} />
                                        ) : (
                                          <FiVolume2 size={14} />
                                        )}
                                      </button>
                                      <button
                                        onClick={() => startEditGloss(gloss.id, gloss.definition)}
                                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                      >
                                        <FiEdit2 size={14} />
                                      </button>
                                    </div>
                                  </div>
                                )}
                                {gloss.gloss_index > 0 && (
                                  <span className="inline-block mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    Variant {gloss.gloss_index}
                                  </span>
                                )}
                              </div>
                            ))}
                            {sense.domain_tags && sense.domain_tags.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {sense.domain_tags.map((tag, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pronunciations */}
              {wordDetail.pronunciations.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Pronunciations
                  </h3>
                  <div className="space-y-2">
                    {wordDetail.pronunciations.map((pron) => (
                      <div
                        key={pron.id}
                        className="flex items-center gap-3 text-gray-700 dark:text-gray-300"
                      >
                        <span className="font-mono text-sm bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded">
                          {pron.ipa}
                        </span>
                        {pron.dialect && (
                          <span className="text-xs text-gray-500">
                            ({pron.dialect})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Forms */}
              {wordDetail.forms.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Forms
                  </h3>
                  <div className="space-y-3">
                    {wordDetail.forms.map((form) => (
                      <div key={form.id}>
                        {editingFormId === form.id ? (
                          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
                            <div>
                              <StyledSelect
                                label="Form Type"
                                value={editedFormType}
                                onChange={(e) => setEditedFormType(e.target.value)}
                                options={[
                                  { value: 'variant', label: 'Variant' },
                                  { value: 'canonical', label: 'Canonical' },
                                  { value: 'plural', label: 'Plural' },
                                  { value: 'singular', label: 'Singular' },
                                ]}
                                fullWidth
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Form Text
                              </label>
                              <input
                                type="text"
                                value={editedForm}
                                onChange={(e) => setEditedForm(e.target.value)}
                                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleUpdateForm(form.id)}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2"
                              >
                                <FiSave />
                                Save
                              </button>
                              <button
                                onClick={() => setEditingFormId(null)}
                                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-white rounded-lg"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 flex items-center justify-between">
                            <div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {form.form_type}
                              </div>
                              <div className="font-medium text-gray-900 dark:text-white">
                                {form.form}
                              </div>
                            </div>
                            <button
                              onClick={() => startEditForm(form)}
                              className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                            >
                              <FiEdit2 />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Related Terms */}
              {wordDetail.related_terms.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Related Terms
                  </h3>
                  <div className="space-y-2">
                    {wordDetail.related_terms.map((rel) => (
                      <div
                        key={rel.id}
                        className="flex items-center gap-3 text-gray-700 dark:text-gray-300"
                      >
                        <span className="text-xs text-gray-500 dark:text-gray-400 uppercase">
                          {rel.relationship_type}:
                        </span>
                        <span className="font-medium">{rel.related_word}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'examples' && (
            <>
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Usage Examples ({wordDetail.examples.length})
                </h3>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={exampleCount}
                    onChange={(e) => setExampleCount(parseInt(e.target.value) || 1)}
                    className="w-16 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-center text-sm"
                    placeholder="Count"
                  />
                  <button
                    onClick={promptPreview ? () => {
                      setPromptPreview(null);
                      setPromptMessagesPreview(null);
                    } : handlePreviewExamplesPrompt}
                    disabled={isPreviewingPrompt}
                    className="px-3 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-60 text-gray-800 dark:text-gray-200 rounded-lg flex items-center gap-2 text-sm"
                    title="Preview the exact prompt sent to OpenAI"
                  >
                    {promptPreview ? (
                      <>
                        <FiEyeOff />
                        Hide Prompt
                      </>
                    ) : isPreviewingPrompt ? (
                      <>
                        <FiLoader className="animate-spin" />
                        Previewing...
                      </>
                    ) : (
                      <>
                        <FiEye />
                        Preview Prompt
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleGenerateExamples}
                    disabled={isGenerating}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-400 text-white rounded-lg flex items-center gap-2 text-sm"
                  >
                    {isGenerating ? (
                      <>
                        <FiLoader className="animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <FiPlus />
                        Generate Examples
                      </>
                    )}
                  </button>
                </div>
              </div>

              {promptPreview && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      Prompt Preview
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Includes meaning/gloss + constraints
                    </div>
                  </div>
                  <pre className="text-xs whitespace-pre-wrap text-gray-800 dark:text-gray-200 max-h-56 overflow-auto">
                    {promptPreview}
                  </pre>
                  {promptMessagesPreview && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs text-gray-600 dark:text-gray-300">
                        Show messages JSON
                      </summary>
                      <pre className="mt-2 text-xs whitespace-pre-wrap text-gray-700 dark:text-gray-200 max-h-56 overflow-auto">
                        {JSON.stringify(promptMessagesPreview, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {wordDetail.examples.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  No examples yet. Click &quot;Generate Examples&quot; to create some.
                </div>
              ) : (
                <div className="space-y-4">
                  {wordDetail.examples.map((example) => (
                    <div
                      key={example.id}
                      className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4"
                    >
                      {editingExampleId === example.id ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              {wordDetail?.word?.language_name || 'Text'}
                            </label>
                            <input
                              type="text"
                              value={editedExampleYoruba}
                              onChange={(e) => setEditedExampleYoruba(e.target.value)}
                              className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              English
                            </label>
                            <input
                              type="text"
                              value={editedExampleEnglish}
                              onChange={(e) => setEditedExampleEnglish(e.target.value)}
                              className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateExample(example.id)}
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2"
                            >
                              <FiSave />
                              Save
                            </button>
                            <button
                              onClick={() => setEditingExampleId(null)}
                              className="px-4 py-2 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-white rounded-lg"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div>
                              <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">
                                {wordDetail?.word?.language_name || 'Text'}
                              </div>
                              <p className="text-gray-900 dark:text-white font-medium">
                                {example.example_yoruba}
                              </p>
                            </div>
                            {example.example_english && (
                              <div>
                                <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">
                                  English
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 text-sm">
                                  {example.example_english}
                                </p>
                              </div>
                            )}
                            {example.audio_url && (
                              <button
                                onClick={() => playAudio(example.audio_url!, `example-${example.id}`)}
                                className="text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center gap-2 text-sm"
                              >
                                <FiVolume2 />
                                {playingAudio === `example-${example.id}` ? 'Playing...' : 'Play Audio'}
                              </button>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEditExample(example)}
                              className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                            >
                              <FiEdit2 />
                            </button>
                            <button
                              onClick={() => handleDeleteExample(example.id)}
                              disabled={isSubmitting}
                              className="text-red-600 hover:text-red-700 dark:text-red-400"
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'audio' && (
            <>
              <div className="space-y-4">
                {/* Custom Audio Generation Section */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Generate Custom Audio
                  </h4>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customTTSText}
                        onChange={(e) => setCustomTTSText(e.target.value)}
                        placeholder="Enter text for audio generation"
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                      />
                      <button
                        onClick={handleGenerateCustomAudio}
                        disabled={isGeneratingAudio || !customTTSText.trim()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg flex items-center gap-2 text-sm whitespace-nowrap"
                      >
                        {isGeneratingAudio ? (
                          <>
                            <FiLoader className="animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <FiVolume2 />
                            Generate
                          </>
                        )}
                      </button>
                    </div>

                    {generatedAudioUrl && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1">
                            <button
                              onClick={() => playAudio(generatedAudioUrl, 'generated-audio')}
                              className="text-brand-600 hover:text-brand-700 dark:text-brand-400"
                            >
                              <FiVolume2 size={20} />
                            </button>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              Preview generated audio
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={handleAcceptCustomAudio}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                            >
                              Accept
                            </button>
                            <button
                              onClick={handleRejectCustomAudio}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Existing Audio Files */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Audio Files ({wordDetail.audio_files?.length ?? 0})
                    </h3>
                    <button
                      onClick={handleRegenerateAudio}
                      disabled={isRegeneratingAudio}
                      className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-400 text-white rounded-lg flex items-center gap-2 text-sm"
                    >
                      {isRegeneratingAudio ? (
                        <>
                          <FiLoader className="animate-spin" />
                          Regenerating...
                        </>
                      ) : (
                        <>
                          <FiRefreshCw />
                          Regenerate Audio
                        </>
                      )}
                    </button>
                  </div>

                  {(wordDetail.audio_files?.length ?? 0) === 0 ? (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                      No audio files available. Click &quot;Regenerate Audio&quot; to create audio for this word.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {wordDetail.audio_files?.map((audio) => (
                        <div
                          key={audio.id}
                          className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 flex items-center justify-between"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-gray-900 dark:text-white">
                                {audio.provider}
                              </span>
                              {audio.voice_name && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {audio.voice_name}
                            </span>
                          )}
                        </div>
                      </div>
                      {audio.audio_url ? (
                        <button
                          onClick={() => playAudio(audio.audio_url!, `audio-${audio.id}`)}
                          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg flex items-center gap-2 text-sm"
                        >
                          <FiVolume2 />
                          {playingAudio === `audio-${audio.id}` ? 'Playing...' : 'Play'}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          No audio URL
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
          <button
            onClick={handleTogglePublish}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              wordDetail.word.is_published
                ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {wordDetail.word.is_published ? (
              <>
                <FiEdit2 />
                Unpublish (Draft)
              </>
            ) : (
              <>
                <FiSave />
                Publish
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

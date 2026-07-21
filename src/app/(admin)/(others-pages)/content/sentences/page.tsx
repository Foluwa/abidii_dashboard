/**
 * Sentences Management Page
 * CRUD interface for sentence content
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import DataTable from '@/components/admin/DataTable';
import FormModal from '@/components/admin/FormModal';
import StatusBadge from '@/components/admin/StatusBadge';
import Toast from '@/components/ui/toast/Toast';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import { GoogleSheetsBulkImport } from '@/components/admin/GoogleSheetsBulkImport';
import Pagination from "@/components/tables/Pagination";
import { Sentence, SentenceCreate, SentenceUpdate, PaginatedResponse } from '@/types/content';
import { Language } from '@/types/common';
import { TableColumn } from '@/types/common';
import { apiClient } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import {
  ContentPageHeader,
  ContentStatsCard,
  ContentStatsGrid,
  ContentFiltersCard,
  ActiveFilterChips,
  StickyBulkActionBar,
} from '@/components/admin/layout';
import { FiGlobe, FiBarChart2, FiCheckCircle, FiTrash2, FiVolume2 } from 'react-icons/fi';
import InlineAudioPlayer from '@/components/ui/audio/InlineAudioPlayer';

export default function SentencesPage() {
  const router = useRouter();
  const toast = useToast();
  
  // State
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSentence, setEditingSentence] = useState<Sentence | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const pageSize = 50;
  
  // Filters
  const [filters, setFilters] = useState({
    language_id: '',
    difficulty: '',
    is_published: '',
    search: '',
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const pageStart = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = totalItems === 0 ? 0 : Math.min(currentPage * pageSize, totalItems);

  // Stats
  const stats = useMemo(() => {
    const published = sentences.filter((s) => s.is_published).length;
    const draft = sentences.filter((s) => !s.is_published).length;
    const withAudio = sentences.filter((s) => (s as any).audio_key || (s as any).audio_url).length;
    return { published, draft, withAudio };
  }, [sentences]);

  // Form state
  const [formData, setFormData] = useState<SentenceCreate | SentenceUpdate>({
    language_id: '',
    text: '',
    translation: '',
    romanization: '',
    difficulty_level: 1,
    category: '',
    tags: [],
    usage_context: '',
    cultural_notes: '',
    is_published: false,
  });

  // Fetch languages
  useEffect(() => {
    fetchLanguages();
  }, []);

  // Fetch sentences
  useEffect(() => {
    fetchSentences();
  }, [currentPage, filters]);

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      toast.error('Please select an audio file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Audio file size must be less than 10MB');
      return;
    }

    setAudioFile(file);
    setAudioPreview(URL.createObjectURL(file));
  };

  const fetchLanguages = async () => {
    try {
      const response = await apiClient.get<{ languages: Language[] }>('/api/v1/languages');
      setLanguages(response.data.languages);
    } catch (error) {
      console.error('Failed to fetch languages:', error);
    }
  };

  const fetchSentences = async () => {
    try {
      setLoading(true);
      setSelectedIds([]);
      const params = new URLSearchParams();
      params.append('page', String(currentPage));
      params.append('page_size', String(pageSize));
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, String(value));
      });

      const response = await apiClient.get<PaginatedResponse<Sentence>>(
        `/api/v1/admin/content/sentences?${params.toString()}`
      );

      setSentences(response.data.items);
      setTotalPages(response.data.total_pages);
      setTotalItems(response.data.total ?? 0);
    } catch (error) {
      console.error('Failed to fetch sentences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingSentence(null);
    setFormData({
      language_id: '',
      text: '',
      translation: '',
      romanization: '',
      difficulty_level: 1,
      category: '',
      tags: [],
      usage_context: '',
      cultural_notes: '',
      is_published: false,
    });
    setIsModalOpen(true);
  };

  const handleEdit = (sentence: Sentence) => {
    setEditingSentence(sentence);
    setFormData({
      text: sentence.text,
      translation: sentence.translation,
      romanization: sentence.romanization || '',
      difficulty_level: sentence.difficulty_level || 1,
      category: sentence.category || '',
      tags: sentence.tags,
      usage_context: sentence.usage_context || '',
      cultural_notes: sentence.cultural_notes || '',
      is_published: sentence.is_published,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingSentence) {
        await apiClient.put(`/api/v1/admin/content/sentences/${editingSentence.id}`, formData);
        
        if (audioFile) {
          setUploadingAudio(true);
          const audioFormData = new FormData();
          audioFormData.append('audio', audioFile);
          try {
            await apiClient.post(
              `/api/v1/admin/content/sentences/${editingSentence.id}/audio`,
              audioFormData,
              { headers: { 'Content-Type': 'multipart/form-data' } }
            );
            toast.success('Sentence and audio updated successfully!');
          } catch (audioErr) {
            console.error('Audio upload error:', audioErr);
            toast.error('Sentence updated but audio upload failed');
          } finally {
            setUploadingAudio(false);
          }
        } else {
          toast.success('Sentence updated successfully!');
        }
      } else {
        const response = await apiClient.post('/api/v1/admin/content/sentences', formData);
        
        if (audioFile && response.data?.id) {
          setUploadingAudio(true);
          const audioFormData = new FormData();
          audioFormData.append('audio', audioFile);
          try {
            await apiClient.post(
              `/api/v1/admin/content/sentences/${response.data.id}/audio`,
              audioFormData,
              { headers: { 'Content-Type': 'multipart/form-data' } }
            );
            toast.success('Sentence and audio created successfully!');
          } catch (audioErr) {
            console.error('Audio upload error:', audioErr);
            toast.error('Sentence created but audio upload failed');
          } finally {
            setUploadingAudio(false);
          }
        } else {
          toast.success('Sentence created successfully!');
        }
      }

      setIsModalOpen(false);
      setAudioFile(null);
      setAudioPreview(null);
      fetchSentences();
    } catch (error) {
      console.error('Failed to save sentence:', error);
      toast.error('Failed to save sentence');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this sentence?')) return;

    try {
      await apiClient.delete(`/api/v1/admin/content/sentences/${id}`);
      fetchSentences();
    } catch (error) {
      console.error('Failed to delete sentence:', error);
      alert('Failed to delete sentence');
    }
  };

  const handleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === sentences.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sentences.map((s) => s.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} sentence(s)?`)) return;

    setIsDeleting(true);
    try {
      await apiClient.post('/api/v1/admin/content/sentences/bulk-delete', {
        sentence_ids: selectedIds,
      });
      toast.success(`Deleted ${selectedIds.length} sentence(s)`);
      setSelectedIds([]);
      fetchSentences();
    } catch (error) {
      console.error('Failed to bulk delete sentences:', error);
      toast.error('Failed to delete sentences');
    } finally {
      setIsDeleting(false);
    }
  };

  // Active filter chips
  const activeFilters = [] as { label: string; onClear: () => void }[];
  if (filters.language_id) {
    const lang = languages.find((l) => l.id === filters.language_id);
    activeFilters.push({ label: `Language: ${lang?.name || filters.language_id}`, onClear: () => setFilters((f) => ({ ...f, language_id: '' })) });
  }
  if (filters.difficulty) activeFilters.push({ label: `Difficulty: ${filters.difficulty}`, onClear: () => setFilters((f) => ({ ...f, difficulty: '' })) });
  if (filters.is_published) activeFilters.push({ label: filters.is_published === 'true' ? 'Status: Published' : 'Status: Draft', onClear: () => setFilters((f) => ({ ...f, is_published: '' })) });
  if (filters.search) activeFilters.push({ label: `Search: "${filters.search}"`, onClear: () => setFilters((f) => ({ ...f, search: '' })) });

  const clearAllFilters = () => {
    setFilters({ language_id: '', difficulty: '', is_published: '', search: '' });
    setCurrentPage(1);
  };

  // Table columns
  const columns: TableColumn<Sentence>[] = [
    {
      key: 'text',
      label: 'Text',
      sortable: true,
      render: (value) => (
        <span className="font-medium">{String(value)}</span>
      ),
    },
    {
      key: 'translation',
      label: 'Translation',
      render: (value) => (
        <span className="text-gray-600 dark:text-gray-400">{String(value)}</span>
      ),
    },
    {
      key: 'difficulty_level',
      label: 'Difficulty',
      align: 'center',
      render: (value) => (
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 dark:bg-gray-800">
          Level {String(value)}
        </span>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (value) => String(value || '-'),
    },
    {
      key: 'audio_url',
      label: 'Audio',
      align: 'center',
      render: (value, row) => (
        <InlineAudioPlayer src={(value as string) || (row as any).audio_url || null} />
      ),
    },
    {
      key: 'tags',
      label: 'Tags',
      render: (value) => {
        const tags = Array.isArray(value) ? value : [];
        return tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag: string, i: number) => (
              <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">{tag}</span>
            ))}
            {tags.length > 3 && <span className="text-xs text-gray-400">+{tags.length - 3}</span>}
          </div>
        ) : <span className="text-gray-400">-</span>;
      },
    },
    {
      key: 'is_published',
      label: 'Status',
      align: 'center',
      render: (value) => (
        <StatusBadge status={value ? 'published' : 'draft'} />
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (value) => new Date(String(value)).toLocaleDateString(),
    },
  ];

  return (
    <div className="space-y-6">
      <ContentPageHeader
        title="Sentences"
        subtitle="Manage sentence content for language learning"
        onAdd={handleCreate}
        addLabel="Add Sentence"
      >
        <button
          onClick={() => { setCurrentPage(1); fetchSentences(); }}
          className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
          title="Refresh data"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Refresh
        </button>
      </ContentPageHeader>

      <ContentStatsGrid cols={4}>
        <ContentStatsCard label="Total" value={totalItems} icon={FiBarChart2} />
        <ContentStatsCard label="Published" value={stats.published} icon={FiCheckCircle} iconBgClass="bg-green-100 dark:bg-green-900/20" iconTextClass="text-green-600 dark:text-green-400" />
        <ContentStatsCard label="Draft" value={stats.draft} icon={FiGlobe} iconBgClass="bg-amber-100 dark:bg-amber-900/20" iconTextClass="text-amber-600 dark:text-amber-400" />
        <ContentStatsCard label="With Audio" value={stats.withAudio} icon={FiBarChart2} iconBgClass="bg-purple-100 dark:bg-purple-900/20" iconTextClass="text-purple-600 dark:text-purple-400" />
      </ContentStatsGrid>

      {/* Bulk Import from Google Sheets (has built-in accordion) */}
      {filters.language_id && (
        <GoogleSheetsBulkImport
          contentType="sentences"
          onImportComplete={() => fetchSentences()}
          defaultLanguageId={filters.language_id}
          defaultWorksheetTitle="yo_sentences"
          expectedColumns={[
            { name: 'source_row_key', required: true, description: 'Stable spreadsheet row key', example: 'sentence_yor_0001' },
            { name: 'text', required: true, description: 'Sentence text', example: 'Mo fẹ́ràn oúnjẹ Yorùbá' },
            { name: 'translation', required: true, description: 'Translation', example: 'I love Yoruba food' },
            { name: 'romanization', required: false, description: 'Romanized version', example: 'mo feran ounje Yoruba' },
            { name: 'difficulty_level', required: false, description: 'Difficulty 1-5', example: '2' },
            { name: 'category', required: false, description: 'Category/topic', example: 'food' },
            { name: 'tags', required: false, description: 'Comma-separated tags', example: 'food,preferences' },
            { name: 'usage_context', required: false, description: 'Usage context', example: 'Casual conversation' },
            { name: 'cultural_notes', required: false, description: 'Cultural context', example: '' },
            { name: 'is_published', required: false, description: 'Published status', example: 'false' },
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
              value={filters.language_id}
              onChange={(e) => {
                setCurrentPage(1);
                setFilters({ ...filters, language_id: e.target.value });
              }}
              options={[
                { value: "", label: "All Languages" },
                ...languages.map((lang) => ({ value: lang.id, label: lang.name })),
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
              value={filters.search}
              onChange={(e) => {
                setCurrentPage(1);
                setFilters({ ...filters, search: e.target.value });
              }}
              placeholder="Search text or translation..."
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
            />
          </div>

          <div className="min-w-[140px]">
            <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Per Page
            </label>
            <StyledSelect
              value={pageSize}
              onChange={() => {}}
              options={[
                { value: 20, label: "20" },
                { value: 50, label: "50" },
                { value: 100, label: "100" },
              ]}
              fullWidth
              disabled
            />
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="mt-5 border-t border-gray-100 pt-5 dark:border-white/[0.05]">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <StyledSelect
                  label="Difficulty"
                  value={filters.difficulty}
                  onChange={(e) => {
                    setCurrentPage(1);
                    setFilters({ ...filters, difficulty: e.target.value });
                  }}
                  options={[
                    { value: "", label: "All Levels" },
                    ...[1, 2, 3, 4, 5].map((level) => ({ value: level.toString(), label: `Level ${level}` })),
                  ]}
                  fullWidth
                />
              </div>
              <div>
                <StyledSelect
                  label="Status"
                  value={filters.is_published}
                  onChange={(e) => {
                    setCurrentPage(1);
                    setFilters({ ...filters, is_published: e.target.value });
                  }}
                  options={[
                    { value: "", label: "All" },
                    { value: "true", label: "Published" },
                    { value: "false", label: "Draft" },
                  ]}
                  fullWidth
                />
              </div>
            </div>
          </div>
        )}

        <ActiveFilterChips filters={activeFilters} />
      </ContentFiltersCard>

      <StickyBulkActionBar
        selectedCount={selectedIds.length}
        onClear={() => setSelectedIds([])}
        itemName="sentence"
        actions={[
          {
            label: isDeleting ? 'Deleting...' : 'Delete Selected',
            onClick: handleBulkDelete,
            disabled: isDeleting,
            loading: isDeleting,
            variant: 'danger',
            icon: <FiTrash2 className="h-4 w-4" />,
          },
        ]}
      />

      {/* Table */}
      <DataTable
        columns={columns as any}
        data={sentences as any}
        keyExtractor={(item: any) => item.id}
        loading={loading}
        emptyMessage="No sentences found"
        selectedIds={selectedIds}
        onSelect={handleSelect}
        onSelectAll={handleSelectAll}
        actions={(item: any) => (
          <>
            <button
              onClick={() => handleEdit(item)}
              className="text-brand-600 hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300"
            >
              Edit
            </button>
            <button
              onClick={() => handleDelete(item.id)}
              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
            >
              Delete
            </button>
          </>
        )}
      />

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Showing {pageStart} to {pageEnd} of {totalItems} sentences
        </span>
        <div className="ml-auto">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(nextPage) => setCurrentPage(nextPage)}
          />
        </div>
      </div>

      {/* Create/Edit Modal */}
      <FormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        title={editingSentence ? 'Edit Sentence' : 'Create Sentence'}
        size="lg"
        isSubmitting={isSubmitting}
      >
        <div className="space-y-4">
          {!editingSentence && (
            <div>
              <StyledSelect
                label="Language *"
                value={(formData as SentenceCreate).language_id}
                onChange={(e) => setFormData({ ...formData, language_id: e.target.value })}
                options={[
                  { value: "", label: "Select Language" },
                  ...languages.map((lang) => ({ value: lang.id, label: lang.name })),
                ]}
                fullWidth
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Text *
            </label>
            <input
              type="text"
              value={(formData as any).text}
              onChange={(e) => setFormData({ ...formData, text: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:border-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Translation *
            </label>
            <input
              type="text"
              value={(formData as any).translation}
              onChange={(e) => setFormData({ ...formData, translation: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:border-gray-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <StyledSelect
                label="Difficulty Level"
                value={(formData as any).difficulty_level?.toString()}
                onChange={(e) => setFormData({ ...formData, difficulty_level: Number(e.target.value) })}
                options={[1, 2, 3, 4, 5].map((level) => ({
                  value: level.toString(),
                  label: `Level ${level}`,
                }))}
                fullWidth
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category
              </label>
              <input
                type="text"
                value={(formData as any).category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:border-gray-600"
              />
            </div>
          </div>

          {/* Audio Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Audio File
            </label>
            <input
              type="file"
              accept="audio/*"
              onChange={handleAudioChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:border-gray-600"
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

          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={(formData as any).is_published}
                onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                className="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Published
              </span>
            </label>
          </div>
        </div>
      </FormModal>
    </div>
  );
}

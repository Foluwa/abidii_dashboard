/**
 * Content Patterns Management Page
 * CRUD interface for managing content patterns (number formation rules, etc.)
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import { ContentPattern, ContentPatternCreate, ContentPatternUpdate } from '@/types/content';
import { Language } from '@/types/common';
import { apiClient } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { 
  FiPlus, 
  FiEdit2, 
  FiTrash2,
  FiChevronDown,
  FiChevronUp,
  FiInfo,
  FiLayers,
} from 'react-icons/fi';

const CATEGORIES = [
  { value: 'number_formation', label: 'Number Formation' },
  { value: 'grammar', label: 'Grammar' },
  { value: 'pronunciation', label: 'Pronunciation' },
  { value: 'vocabulary', label: 'Vocabulary' },
  { value: 'cultural', label: 'Cultural' },
];

const DIFFICULTIES = [
  { value: 1, label: '1 - Very Easy' },
  { value: 2, label: '2 - Easy' },
  { value: 3, label: '3 - Medium' },
  { value: 4, label: '4 - Hard' },
  { value: 5, label: '5 - Very Hard' },
];

export default function PatternsPage() {
  const toast = useToast();

  // State
  const [patterns, setPatterns] = useState<ContentPattern[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPattern, setEditingPattern] = useState<ContentPattern | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');

  // Form state
  const [formData, setFormData] = useState<ContentPatternCreate | ContentPatternUpdate>({
    language_id: '',
    pattern_key: '',
    title: '',
    subtitle: '',
    description: '',
    difficulty: 1,
    category: 'number_formation',
    sort_order: 0,
    config: {},
  });

  // Fetch languages
  useEffect(() => {
    fetchLanguages();
  }, []);

  // Fetch patterns when language changes
  useEffect(() => {
    if (selectedLanguage) {
      fetchPatterns();
    }
  }, [selectedLanguage, filterCategory]);

  const fetchLanguages = async () => {
    try {
      const response = await apiClient.get<{ languages: Language[] }>('/api/v1/languages');
      const fetchedLanguages = response.data.languages;
      setLanguages(fetchedLanguages);
      if (fetchedLanguages.length > 0) {
        // Default to Yoruba if available
        const yoruba = fetchedLanguages.find(l => l.iso_639_3 === 'yor');
        setSelectedLanguage(yoruba?.id || fetchedLanguages[0].id);
      }
    } catch (error) {
      toast.error('Failed to fetch languages');
    }
  };

  const fetchPatterns = async () => {
    if (!selectedLanguage) return;
    setLoading(true);
    try {
      const lang = languages.find(l => l.id === selectedLanguage);
      if (!lang) return;

      let url = `/api/v1/languages/${lang.iso_639_3}/patterns`;
      if (filterCategory) {
        url += `?category=${filterCategory}`;
      }

      const response = await apiClient.get<ContentPattern[]>(url);
      setPatterns(response.data);
    } catch (error) {
      toast.error('Failed to fetch patterns');
      setPatterns([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingPattern(null);
    setFormData({
      language_id: selectedLanguage,
      pattern_key: '',
      title: '',
      subtitle: '',
      description: '',
      difficulty: 1,
      category: 'number_formation',
      sort_order: patterns.length,
      config: {},
    });
    setIsModalOpen(true);
  };

  const handleEdit = (pattern: ContentPattern) => {
    setEditingPattern(pattern);
    setFormData({
      pattern_key: pattern.pattern_key,
      title: pattern.title,
      subtitle: pattern.subtitle || '',
      description: pattern.description || '',
      difficulty: pattern.difficulty,
      category: pattern.category || 'number_formation',
      sort_order: pattern.sort_order,
      config: pattern.config || {},
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this pattern?')) return;

    try {
      await apiClient.delete(`/api/v1/admin/patterns/${id}`);
      toast.success('Pattern deleted');
      fetchPatterns();
    } catch (error) {
      toast.error('Failed to delete pattern');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingPattern) {
        await apiClient.put(`/api/v1/admin/patterns/${editingPattern.id}`, formData);
        toast.success('Pattern updated');
      } else {
        await apiClient.post('/api/v1/admin/patterns', {
          ...formData,
          language_id: selectedLanguage,
        });
        toast.success('Pattern created');
      }
      setIsModalOpen(false);
      fetchPatterns();
    } catch (error) {
      toast.error(editingPattern ? 'Failed to update pattern' : 'Failed to create pattern');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value, 10) : value,
    }));
  };

  const toggleExpanded = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getDifficultyColor = (difficulty: number) => {
    switch (difficulty) {
      case 1: return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 2: return 'bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-200';
      case 3: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 4: return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 5: return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  return (
    <div className="p-4 mx-auto max-w-screen-2xl md:p-6">
      <PageBreadCrumb pageTitle="Content Patterns" />

      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800 dark:text-white">
              Content Patterns
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Manage learning patterns (number formation rules, grammar patterns, etc.)
            </p>
          </div>
          <button
            onClick={handleCreate}
            disabled={!selectedLanguage}
            className="flex items-center justify-center gap-2 px-4 py-2 text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiPlus />
            Add Pattern
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 p-4 mb-6 bg-white rounded-lg shadow-sm dark:bg-gray-800 sm:flex-row">
        <div className="flex-1">
          <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            Language
          </label>
          <StyledSelect
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            options={languages.map(l => ({ value: l.id, label: l.name }))}
            placeholder="Select language"
          />
        </div>
        <div className="flex-1">
          <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            Category
          </label>
          <StyledSelect
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            options={[{ value: '', label: 'All Categories' }, ...CATEGORIES]}
          />
        </div>
      </div>

      {/* Patterns List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : patterns.length === 0 ? (
          <div className="py-12 text-center text-gray-500 dark:text-gray-400">
            <FiLayers className="mx-auto mb-3 text-4xl" />
            <p>No patterns found</p>
            <p className="text-sm">Create your first pattern to get started</p>
          </div>
        ) : (
          patterns.map((pattern) => (
            <div
              key={pattern.id}
              className="bg-white rounded-lg shadow-sm dark:bg-gray-800 overflow-hidden"
            >
              {/* Pattern Header */}
              <div
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                onClick={() => toggleExpanded(pattern.id)}
              >
                <div className="flex-shrink-0">
                  <span className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-lg font-bold ${getDifficultyColor(pattern.difficulty)}`}>
                    {pattern.difficulty}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 dark:text-white truncate">
                    {pattern.title}
                  </h3>
                  {pattern.subtitle && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {pattern.subtitle}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded dark:bg-gray-700 dark:text-gray-300">
                    {pattern.pattern_key}
                  </span>
                  <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-600 rounded dark:bg-blue-900 dark:text-blue-300">
                    {pattern.category || 'uncategorized'}
                  </span>
                  {expandedId === pattern.id ? <FiChevronUp /> : <FiChevronDown />}
                </div>
              </div>

              {/* Expanded Content */}
              {expandedId === pattern.id && (
                <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="mt-4">
                    {pattern.description && (
                      <p className="mb-4 text-gray-600 dark:text-gray-300">
                        {pattern.description}
                      </p>
                    )}
                    
                    {pattern.config && Object.keys(pattern.config).length > 0 && (
                      <div className="mb-4">
                        <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                          Configuration
                        </h4>
                        <pre className="p-3 text-xs bg-gray-50 rounded-lg dark:bg-gray-900 overflow-x-auto">
                          {JSON.stringify(pattern.config, null, 2)}
                        </pre>
                      </div>
                    )}

                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(pattern);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 bg-blue-50 rounded hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                      >
                        <FiEdit2 className="text-xs" />
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(pattern.id);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 bg-red-50 rounded hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                      >
                        <FiTrash2 className="text-xs" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl dark:bg-gray-800">
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-white border-b dark:bg-gray-800 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                {editingPattern ? 'Edit Pattern' : 'Create Pattern'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Pattern Key *
                  </label>
                  <input
                    type="text"
                    name="pattern_key"
                    value={(formData as ContentPatternCreate).pattern_key || ''}
                    onChange={handleInputChange}
                    placeholder="e.g., SUBTRACTIVE_15_19"
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Category
                  </label>
                  <select
                    name="category"
                    value={formData.category || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title || ''}
                  onChange={handleInputChange}
                  placeholder="e.g., Subtraction Pattern: 15-19"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Subtitle
                </label>
                <input
                  type="text"
                  name="subtitle"
                  value={formData.subtitle || ''}
                  onChange={handleInputChange}
                  placeholder="Short description shown in lists"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description || ''}
                  onChange={handleInputChange}
                  rows={4}
                  placeholder="Full explanation of the pattern..."
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Difficulty
                  </label>
                  <select
                    name="difficulty"
                    value={formData.difficulty || 1}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    {DIFFICULTIES.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    name="sort_order"
                    value={formData.sort_order || 0}
                    onChange={handleInputChange}
                    min={0}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingPattern ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

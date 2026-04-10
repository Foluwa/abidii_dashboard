/**
 * Learning Items Management Page
 * CRUD interface for managing games and lessons per language
 */

'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import DataTable from '@/components/admin/DataTable';
import FormModal from '@/components/admin/FormModal';
import StatusBadge from '@/components/admin/StatusBadge';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import Pagination from '@/components/tables/Pagination';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import { LearningItem, LearningItemCreate, LearningItemUpdate } from '@/types/content';
import { Language } from '@/types/common';
import { TableColumn } from '@/types/common';
import { apiClient } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { 
  FiPlay, 
  FiBook, 
  FiToggleLeft, 
  FiToggleRight,
  FiArrowUp,
  FiArrowDown,
  FiAward,
  FiEdit2,
  FiTrash2,
  FiImage,
  FiUploadCloud,
  FiX,
} from 'react-icons/fi';

const ITEM_TYPES = [
  { value: 'game', label: 'Game' },
  { value: 'lesson', label: 'Lesson' },
];

const LEVELS = [
  { value: 'Beginner', label: 'Beginner' },
  { value: 'Intermediate', label: 'Intermediate' },
  { value: 'Advanced', label: 'Advanced' },
];

const DIFFICULTIES = [
  { value: 'Easy', label: 'Easy' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Hard', label: 'Hard' },
];

const ICON_OPTIONS = [
  { value: 'abc_rounded', label: '🔤 Alphabet' },
  { value: 'looks_one_rounded', label: '1️⃣ Numbers' },
  { value: 'auto_stories_rounded', label: '📖 Stories' },
  { value: 'graphic_eq_rounded', label: '🎵 Audio/Tone' },
  { value: 'spellcheck_rounded', label: '✍️ Spelling' },
  { value: 'translate_rounded', label: '🌐 Translation' },
  { value: 'psychology_rounded', label: '🧠 Memory' },
  { value: 'quiz_rounded', label: '❓ Quiz' },
  { value: 'star_rounded', label: '⭐ Star' },
];

const IMAGE_FIT_OPTIONS = [
  { value: 'cover', label: 'Cover (crop to fill)' },
  { value: 'contain', label: 'Contain (show full image)' },
];

const normalizeLaunchRoute = (
  itemType: 'game' | 'lesson' | undefined,
  launchRoute: string | undefined,
): string => {
  if (itemType === 'lesson') {
    return 'structuredLesson';
  }
  return (launchRoute || 'game').trim() || 'game';
};

const getIconEmoji = (iconName: string | undefined): string => {
  const matchedOption = ICON_OPTIONS.find((option) => option.value === iconName);
  if (!matchedOption) {
    return '🎮';
  }

  return matchedOption.label.split(' ')[0] || '🎮';
};

export default function LearningItemsPage() {
  const toast = useToast();
  const pathname = usePathname();
  const isGamesRoute = pathname === '/games' || pathname === '/content/library/games';
  const pageTitle = isGamesRoute ? 'Games Management' : 'Learning Items';
  const entityLabel = isGamesRoute ? 'Game' : 'Item';
  const statsLabel = isGamesRoute ? 'Games' : 'Items';
  const formControlClassName = 'w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500';
  const formLabelClassName = 'mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300';
  const checkboxLabelClassName = 'text-sm font-medium text-gray-700 dark:text-gray-300';
  
  // State
  const [items, setItems] = useState<LearningItem[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LearningItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  
  // Filters
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [filterType, setFilterType] = useState<string>(isGamesRoute ? 'game' : '');
  const [filterActive, setFilterActive] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Form state
  const [formData, setFormData] = useState<LearningItemCreate | LearningItemUpdate>({
    language_id: '',
    item_key: '',
    title: '',
    about: '',
    icon_name: 'gamepad_rounded',
    image_url: '',
    image_fit: 'cover',
    level: 'Beginner',
    difficulty: 'Easy',
    duration_minutes: 5,
    xp_reward: 10,
    item_type: 'game',
    launch_route: 'game',
    is_active: true,
    is_premium: false,
    display_order: 0,
  });

  // Fetch languages
  const fetchLanguages = useCallback(async () => {
    try {
      const response = await apiClient.get<{ languages: Language[] }>('/api/v1/languages');
      setLanguages(response.data.languages);
      if (response.data.languages.length > 0) {
        setSelectedLanguage(response.data.languages[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch languages:', error);
      toast.error('Failed to load languages');
    }
  }, [toast]);

  useEffect(() => {
    fetchLanguages();
  }, [fetchLanguages]);

  // Fetch items when language changes
  const fetchItems = useCallback(async () => {
    if (!selectedLanguage) return;
    
    setLoading(true);
    try {
      const language = languages.find(l => l.id === selectedLanguage);
      if (!language) return;

      const params = new URLSearchParams();
      if (filterType) params.append('item_type', filterType);
      params.append('only_active', filterActive == 'true' ? 'true' : 'false');

      const response = await apiClient.get<LearningItem[]>(
        `/api/v1/languages/${language.iso_639_3}/learning-items?${params}`
      );
      
      const visibleItems = response.data
        .filter((item) => filterActive !== 'false' || !item.is_active)
        .sort((a, b) => a.display_order - b.display_order);
      
      // Sort by display_order
      const sortedItems = visibleItems;
      setItems(sortedItems);
    } catch (error: any) {
      console.error('Failed to fetch items:', error);
      toast.error(error.response?.data?.detail || 'Failed to load learning items');
    } finally {
      setLoading(false);
    }
  }, [filterActive, filterType, languages, selectedLanguage, toast]);

  useEffect(() => {
    if (selectedLanguage) {
      fetchItems();
    }
  }, [fetchItems, selectedLanguage]);

  useEffect(() => {
    if (isGamesRoute) {
      setFilterType('game');
    }
  }, [isGamesRoute]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedLanguage, filterType, filterActive, searchQuery]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;

    return items.filter((item) => {
      const haystack = `${item.title} ${item.item_key} ${item.about ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [items, searchQuery]);

  const totalFilteredItems = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredItems / itemsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage]);

  const pageStart = totalFilteredItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const pageEnd = totalFilteredItems === 0 ? 0 : Math.min(currentPage * itemsPerPage, totalFilteredItems);

  const handleCreate = () => {
    setEditingItem(null);
    setImageUploadProgress(0);
    setFormData({
      language_id: selectedLanguage,
      item_key: '',
      title: '',
      about: '',
      icon_name: 'gamepad_rounded',
      image_url: '',
      image_fit: 'cover',
      level: 'Beginner',
      difficulty: 'Easy',
      duration_minutes: 5,
      xp_reward: 10,
      item_type: 'game',
      launch_route: 'game',
      is_active: true,
      is_premium: false,
      display_order: items.length + 1,
    });
    setIsModalOpen(true);
  };

  const handleEdit = (item: LearningItem) => {
    setEditingItem(item);
    setImageUploadProgress(0);
    setFormData({
      language_id: item.language_id,
      item_key: item.item_key,
      title: item.title,
      about: item.about,
      icon_name: item.icon_name,
      image_url: item.image_url || '',
      image_fit: item.image_fit || 'cover',
      level: item.level,
      difficulty: item.difficulty,
      duration_minutes: item.duration_minutes,
      xp_reward: item.xp_reward,
      item_type: item.item_type,
      launch_route: normalizeLaunchRoute(item.item_type, item.launch_route),
      is_active: item.is_active,
      is_premium: item.is_premium,
      display_order: item.display_order,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      await apiClient.delete(`/api/v1/learning-items/${id}`);
      toast.success('Learning item deleted successfully');
      fetchItems();
    } catch (error: any) {
      console.error('Failed to delete item:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete learning item');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const normalizedFormData = {
        ...formData,
        image_url: formData.image_url?.trim() || undefined,
        image_fit: formData.image_url?.trim() ? (formData.image_fit || 'cover') : undefined,
        launch_route: normalizeLaunchRoute(formData.item_type, formData.launch_route),
      };
      if (editingItem) {
        // Update existing item
        await apiClient.patch(`/api/v1/learning-items/${editingItem.id}`, normalizedFormData);
        toast.success('Learning item updated successfully');
      } else {
        // Create new item
        await apiClient.post('/api/v1/learning-items', normalizedFormData);
        toast.success('Learning item created successfully');
      }
      setIsModalOpen(false);
      setImageUploadProgress(0);
      fetchItems();
    } catch (error: any) {
      console.error('Failed to save item:', error);
      toast.error(error.response?.data?.detail || 'Failed to save learning item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageUpload = useCallback(async (file: File) => {
    const languageId =
      ('language_id' in formData ? formData.language_id : '') ||
      editingItem?.language_id ||
      selectedLanguage;
    const itemKey =
      ('item_key' in formData ? formData.item_key : '') ||
      editingItem?.item_key ||
      '';

    if (!languageId) {
      toast.error('Select a language before uploading an image');
      return;
    }
    if (!itemKey.trim()) {
      toast.error('Enter an item key before uploading an image');
      return;
    }

    const payload = new FormData();
    payload.append('language_id', languageId);
    payload.append('item_key', itemKey.trim());
    if (formData.image_url) {
      payload.append('current_image_url', formData.image_url);
    }
    payload.append('file', file);

    try {
      setIsUploadingImage(true);
      setImageUploadProgress(0);
      const response = await apiClient.post<{ image_url: string }>(
        '/api/v1/learning-items/image-upload',
        payload,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (event) => {
            if (!event.total) return;
            setImageUploadProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
          },
        }
      );

      setFormData((prev) => ({
        ...prev,
        image_url: response.data.image_url,
      }));
      setImageUploadProgress(100);
      toast.success('Image uploaded successfully');
    } catch (error: any) {
      console.error('Failed to upload learning item image:', error);
      toast.error(error.response?.data?.detail || 'Failed to upload image');
      setImageUploadProgress(0);
    } finally {
      setIsUploadingImage(false);
    }
  }, [editingItem, formData, selectedLanguage, toast]);

  const clearUploadedImage = () => {
    setFormData((prev) => ({
      ...prev,
      image_url: '',
    }));
    setImageUploadProgress(0);
  };

  const resetFilters = () => {
    setSearchQuery('');
    if (isGamesRoute) {
      setFilterActive('');
      return;
    }

    setFilterType('');
    setFilterActive('');
  };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: (acceptedFiles) => {
      const nextFile = acceptedFiles[0];
      if (nextFile) {
        void handleImageUpload(nextFile);
      }
    },
    multiple: false,
    noClick: true,
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/webp': [],
      'image/svg+xml': [],
    },
    disabled: isUploadingImage,
  });

  const toggleActive = async (item: LearningItem) => {
    try {
      await apiClient.patch(`/api/v1/learning-items/${item.id}`, {
        is_active: !item.is_active,
      });
      toast.success(`${item.title} ${!item.is_active ? 'activated' : 'deactivated'}`);
      fetchItems();
    } catch (error: any) {
      console.error('Failed to toggle active status:', error);
      toast.error('Failed to update status');
    }
  };

  const togglePremium = async (item: LearningItem) => {
    try {
      await apiClient.patch(`/api/v1/learning-items/${item.id}`, {
        is_premium: !item.is_premium,
      });
      toast.success(`${item.title} premium status updated`);
      fetchItems();
    } catch (error: any) {
      console.error('Failed to toggle premium status:', error);
      toast.error('Failed to update premium status');
    }
  };

  const moveItem = async (item: LearningItem, direction: 'up' | 'down') => {
    const currentIndex = items.findIndex(i => i.id === item.id);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    if (targetIndex < 0 || targetIndex >= items.length) return;

    try {
      // Swap display orders
      await apiClient.patch(`/api/v1/learning-items/${item.id}`, {
        display_order: items[targetIndex].display_order,
      });
      await apiClient.patch(`/api/v1/learning-items/${items[targetIndex].id}`, {
        display_order: item.display_order,
      });
      toast.success('Order updated');
      fetchItems();
    } catch (error: any) {
      console.error('Failed to reorder items:', error);
      toast.error('Failed to update order');
    }
  };

  const columns: TableColumn<LearningItem>[] = [
    {
      key: 'display_order',
      label: '#',
      render: (_, item: LearningItem) => (
        <div className="flex items-center gap-1">
          <span className="font-mono text-sm">{item.display_order}</span>
          <div className="flex flex-col">
            <button
              onClick={() => moveItem(item, 'up')}
              disabled={items.findIndex(i => i.id === item.id) === 0}
              className="text-gray-400 hover:text-blue-600 disabled:opacity-30"
            >
              <FiArrowUp size={12} />
            </button>
            <button
              onClick={() => moveItem(item, 'down')}
              disabled={items.findIndex(i => i.id === item.id) === items.length - 1}
              className="text-gray-400 hover:text-blue-600 disabled:opacity-30"
            >
              <FiArrowDown size={12} />
            </button>
          </div>
        </div>
      ),
    },
    {
      key: 'item_key',
      label: 'Key',
      render: (_, item: LearningItem) => (
        <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
          {item.item_key}
        </span>
      ),
    },
    {
      key: 'title',
      label: 'Title',
      render: (_, item: LearningItem) => (
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800">
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={`${item.title} artwork`}
                className={`h-full w-full ${item.image_fit === 'contain' ? 'object-contain p-1.5' : 'object-cover'}`}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl">
                {getIconEmoji(item.icon_name)}
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-gray-950 text-[10px] shadow-sm dark:border-gray-900">
              <span aria-hidden="true">{getIconEmoji(item.icon_name)}</span>
            </div>
          </div>

          <div className="min-w-0 max-w-[260px]">
            <div className="font-medium text-gray-900 dark:text-white">{item.title}</div>
            <div className="truncate text-xs text-gray-500 dark:text-gray-400">
              {item.about}
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
              {item.icon_name.replace(/_rounded$/, '').replace(/_/g, ' ')}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'item_type',
      label: 'Type',
      render: (_, item: LearningItem) => (
        <div className="flex items-center gap-1">
          {item.item_type === 'game' ? (
            <FiPlay className="text-purple-500" />
          ) : (
            <FiBook className="text-blue-500" />
          )}
          <span className="capitalize">{item.item_type}</span>
        </div>
      ),
    },
    {
      key: 'level',
      label: 'Level',
      render: (_, item: LearningItem) => (
        <div className="text-sm">
          <div>{item.level}</div>
          <div className="text-xs text-gray-500">{item.difficulty}</div>
        </div>
      ),
    },
    {
      key: 'duration_xp',
      label: 'Duration / XP',
      render: (_, item: LearningItem) => (
        <div className="text-sm">
          <div>⏱️ {item.duration_minutes}m</div>
          <div>⭐ {item.xp_reward} XP</div>
        </div>
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (_, item: LearningItem) => (
        <div className="flex flex-col gap-1">
          <button
            onClick={() => toggleActive(item)}
            className="flex items-center gap-1 text-sm hover:opacity-70"
          >
            {item.is_active ? (
              <>
                <FiToggleRight className="text-green-500" size={20} />
                <span className="text-green-600">Active</span>
              </>
            ) : (
              <>
                <FiToggleLeft className="text-gray-400" size={20} />
                <span className="text-gray-500">Inactive</span>
              </>
            )}
          </button>
          {item.is_premium && (
            <div className="flex items-center gap-1 text-xs text-yellow-600">
              <FiAward size={12} />
              Premium
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, item: LearningItem) => (
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleEdit(item)}
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <FiEdit2 size={14} />
            Edit
          </button>
          <button
            onClick={() => handleDelete(item.id)}
            className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
          >
            <FiTrash2 size={14} />
            Delete
          </button>
        </div>
      ),
    },
  ];

  const formFields = [
    {
      name: 'item_key',
      label: 'Item Key',
      type: 'text',
      required: true,
      disabled: !!editingItem,
      placeholder: 'e.g., alphabet-tracing',
      helperText: 'Unique identifier (cannot be changed after creation)',
    },
    {
      name: 'title',
      label: 'Title',
      type: 'text',
      required: true,
      placeholder: 'e.g., Alphabet Tracing',
    },
    {
      name: 'about',
      label: 'Description',
      type: 'textarea',
      required: false,
      placeholder: 'Brief description of the learning item',
    },
    {
      name: 'item_type',
      label: 'Type',
      type: 'select',
      required: true,
      options: ITEM_TYPES,
    },
    {
      name: 'icon_name',
      label: 'Icon',
      type: 'select',
      required: true,
      options: ICON_OPTIONS,
    },
    {
      name: 'level',
      label: 'Level',
      type: 'select',
      required: true,
      options: LEVELS,
    },
    {
      name: 'difficulty',
      label: 'Difficulty',
      type: 'select',
      required: true,
      options: DIFFICULTIES,
    },
    {
      name: 'duration_minutes',
      label: 'Duration (minutes)',
      type: 'number',
      required: true,
      min: 1,
      max: 120,
    },
    {
      name: 'xp_reward',
      label: 'XP Reward',
      type: 'number',
      required: true,
      min: 1,
      max: 1000,
    },
    {
      name: 'launch_route',
      label: 'Launch Route',
      type: 'text',
      required: true,
      placeholder: 'e.g., game',
      helperText: 'Navigation route name',
    },
    {
      name: 'display_order',
      label: 'Display Order',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'is_active',
      label: 'Active',
      type: 'checkbox',
      helperText: 'Whether this item is visible to users',
    },
    {
      name: 'is_premium',
      label: 'Premium Only',
      type: 'checkbox',
      helperText: 'Require premium subscription to access',
    },
  ];

  const selectedLanguageData = languages.find(l => l.id === selectedLanguage);

  return (
    <div className="mx-auto max-w-7xl">
      <PageBreadCrumb
        pageTitle={pageTitle}
      />

      {/* Filters */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <StyledSelect
              label="Language"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              disabled={loading}
              options={[
                { value: '', label: 'Select language...' },
                ...languages.map((lang) => ({
                  value: lang.id,
                  label: `${lang.name} (${lang.native_name})`,
                })),
              ]}
              fullWidth
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Search
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${isGamesRoute ? 'games' : 'learning items'}...`}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-brand-500"
            />
          </div>

          {!isGamesRoute && (
            <div>
              <StyledSelect
                label="Type"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                options={[
                  { value: '', label: 'All Types' },
                  { value: 'game', label: 'Games' },
                  { value: 'lesson', label: 'Lessons' },
                ]}
                fullWidth
              />
            </div>
          )}

          <div>
            <StyledSelect
              label="Status"
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              options={[
                { value: '', label: 'All Status' },
                { value: 'true', label: 'Active Only' },
                { value: 'false', label: 'Inactive Only' },
              ]}
              fullWidth
            />
          </div>

          <div className="flex items-end gap-3">
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Reset Filters
            </button>
            <button
              onClick={handleCreate}
              disabled={!selectedLanguage}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              + Add {entityLabel}
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      {selectedLanguageData && items.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
            <div className="text-2xl font-bold">{items.length}</div>
            <div className="text-sm text-gray-500">Total {statsLabel}</div>
          </div>
          <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
            <div className="text-2xl font-bold text-green-600">
              {items.filter(i => i.is_active).length}
            </div>
            <div className="text-sm text-gray-500">Active</div>
          </div>
          <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
            <div className="text-2xl font-bold text-purple-600">
              {items.filter(i => i.item_type === 'game').length}
            </div>
            <div className="text-sm text-gray-500">Games</div>
          </div>
          <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
            <div className="text-2xl font-bold text-blue-600">
              {items.filter(i => i.item_type === 'lesson').length}
            </div>
            <div className="text-sm text-gray-500">Lessons</div>
          </div>
        </div>
      )}

      {/* Table */}
      {selectedLanguage ? (
        <>
          <DataTable
            columns={columns as unknown as TableColumn<Record<string, unknown>>[]}
            data={paginatedItems as unknown as Record<string, unknown>[]}
            keyExtractor={(item) => (item as unknown as LearningItem).id}
            loading={loading}
            emptyMessage={searchQuery
              ? `No ${isGamesRoute ? 'games' : 'learning items'} match "${searchQuery}".`
              : `No ${isGamesRoute ? 'games' : 'learning items'} found. Click 'Add ${entityLabel}' to create one.`}
          />
          {!loading && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Showing {pageStart} to {pageEnd} of {totalFilteredItems} {isGamesRoute ? 'games' : 'learning items'}
              </p>
              <div className="ml-auto">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-lg bg-white p-8 text-center shadow dark:bg-gray-800">
          <p className="text-gray-500">Please select a language to view learning items</p>
        </div>
      )}

      {/* Modal */}
      <FormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        title={editingItem ? `Edit ${entityLabel}` : `Create ${entityLabel}`}
        isSubmitting={isSubmitting}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={formLabelClassName}>Item Key *</label>
            <input
              type="text"
              value={('item_key' in formData ? formData.item_key : '') || ''}
              onChange={(e) => setFormData({ ...formData, item_key: e.target.value } as any)}
              disabled={!!editingItem}
              className={`${formControlClassName} disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:bg-gray-900 dark:disabled:text-gray-400`}
              placeholder="e.g., spelling_bee"
            />
          </div>
          
          <div className="col-span-2">
            <label className={formLabelClassName}>Title *</label>
            <input
              type="text"
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className={formControlClassName}
            />
          </div>
          
          <div className="col-span-2">
            <label className={formLabelClassName}>Description</label>
            <textarea
              value={formData.about || ''}
              onChange={(e) => setFormData({ ...formData, about: e.target.value })}
              className={formControlClassName}
              rows={3}
            />
          </div>

          <div className="col-span-2">
            <label className={formLabelClassName}>Artwork</label>
            <div className="space-y-3">
              <div
                {...getRootProps()}
                className={`rounded-xl border border-dashed p-5 transition ${
                  isDragActive
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/10'
                    : 'border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900'
                } ${isUploadingImage ? 'cursor-progress opacity-80' : 'cursor-pointer'}`}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center justify-center gap-3 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    <FiUploadCloud size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {isDragActive ? 'Drop image here' : 'Drag and drop artwork here'}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      PNG, JPG, WebP, or SVG up to 5MB.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={open}
                    disabled={isUploadingImage}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    Browse file
                  </button>
                </div>
              </div>

              {(isUploadingImage || imageUploadProgress > 0) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{isUploadingImage ? 'Uploading image...' : 'Upload complete'}</span>
                    <span>{imageUploadProgress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                    <div
                      className="h-full rounded-full bg-brand-600 transition-all"
                      style={{ width: `${imageUploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {formData.image_url ? (
                <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-950">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start">
                    <div className="flex h-28 w-full items-center justify-center overflow-hidden rounded-lg bg-gray-100 md:w-40 dark:bg-gray-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={formData.image_url}
                        alt={`${formData.title || entityLabel} artwork preview`}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                        <FiImage size={16} />
                        Uploaded image
                      </div>
                      <p className="mt-1 break-all text-xs text-gray-500 dark:text-gray-400">
                        {formData.image_url}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={clearUploadedImage}
                      className="inline-flex items-center gap-1 self-start rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      <FiX size={14} />
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Uploading artwork will automatically set the game image. No manual URL paste needed.
                </p>
              )}
            </div>
          </div>

          <div>
            <label className={formLabelClassName}>Image Fit</label>
            <select
              value={formData.image_fit || 'cover'}
              onChange={(e) => setFormData({ ...formData, image_fit: e.target.value as 'cover' | 'contain' })}
              className={formControlClassName}
            >
              {IMAGE_FIT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-gray-500">
              Choose whether the app crops the image to fill the card or shows the full image.
            </p>
          </div>
          
          <div>
            <label className={formLabelClassName}>Type *</label>
            <select
              value={formData.item_type || 'game'}
              onChange={(e) => {
                const nextType = e.target.value as 'game' | 'lesson';
                setFormData({
                  ...formData,
                  item_type: nextType,
                  launch_route: normalizeLaunchRoute(nextType, formData.launch_route),
                });
              }}
              className={formControlClassName}
            >
              <option value="game">Game</option>
              <option value="lesson">Lesson</option>
            </select>
          </div>
          
          <div>
            <label className={formLabelClassName}>Level</label>
            <input
              type="text"
              value={formData.level || ''}
              onChange={(e) => setFormData({ ...formData, level: e.target.value })}
              className={formControlClassName}
              placeholder="e.g., Beginner"
            />
          </div>
          
          <div>
            <label className={formLabelClassName}>Difficulty</label>
            <input
              type="text"
              value={formData.difficulty || ''}
              onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
              className={formControlClassName}
              placeholder="e.g., Easy"
            />
          </div>
          
          <div>
            <label className={formLabelClassName}>Duration (minutes) *</label>
            <input
              type="number"
              value={formData.duration_minutes || ''}
              onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
              className={formControlClassName}
              min="1"
            />
          </div>
          
          <div>
            <label className={formLabelClassName}>XP Reward *</label>
            <input
              type="number"
              value={formData.xp_reward || ''}
              onChange={(e) => setFormData({ ...formData, xp_reward: parseInt(e.target.value) })}
              className={formControlClassName}
              min="0"
            />
          </div>
          
          <div>
            <label className={formLabelClassName}>Display Order</label>
            <input
              type="number"
              value={formData.display_order || ''}
              onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
              className={formControlClassName}
              min="0"
            />
          </div>
          
          <div className="col-span-2">
            <label className={formLabelClassName}>Launch Route *</label>
            <input
              type="text"
              value={normalizeLaunchRoute(formData.item_type, formData.launch_route)}
              onChange={(e) => setFormData({ ...formData, launch_route: e.target.value })}
              className={`${formControlClassName} disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:bg-gray-900 dark:disabled:text-gray-400`}
              placeholder={formData.item_type === 'lesson' ? 'structuredLesson' : 'e.g., game'}
              disabled={formData.item_type === 'lesson'}
            />
            <p className="mt-2 text-xs text-gray-500">
              {formData.item_type === 'lesson'
                ? 'Lesson items always launch the backend-driven structured lesson runtime.'
                : 'Game items use a game route key such as game, numbers-hub, or /games/spelling-bee.'}
            </p>
          </div>
          
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_active ?? true}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded"
              />
              <span className={checkboxLabelClassName}>Active</span>
            </label>
          </div>
          
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_premium ?? false}
                onChange={(e) => setFormData({ ...formData, is_premium: e.target.checked })}
                className="rounded"
              />
              <span className={checkboxLabelClassName}>Premium</span>
            </label>
          </div>
        </div>
      </FormModal>
    </div>
  );
}

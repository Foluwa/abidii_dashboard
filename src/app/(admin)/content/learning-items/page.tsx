/**
 * Learning Items Management Page
 * CRUD interface for managing games and lessons per language
 */

'use client';

import React, { useState, useEffect } from 'react';
import DataTable from '@/components/admin/DataTable';
import FormModal from '@/components/admin/FormModal';
import StatusBadge from '@/components/admin/StatusBadge';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
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

const normalizeLaunchRoute = (
  itemType: 'game' | 'lesson' | undefined,
  launchRoute: string | undefined,
): string => {
  if (itemType === 'lesson') {
    return 'structuredLesson';
  }
  return (launchRoute || 'game').trim() || 'game';
};

export default function LearningItemsPage() {
  const toast = useToast();
  
  // State
  const [items, setItems] = useState<LearningItem[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LearningItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Filters
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterActive, setFilterActive] = useState<string>('');

  // Form state
  const [formData, setFormData] = useState<LearningItemCreate | LearningItemUpdate>({
    language_id: '',
    item_key: '',
    title: '',
    about: '',
    icon_name: 'gamepad_rounded',
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
  useEffect(() => {
    fetchLanguages();
  }, []);

  // Fetch items when language changes
  useEffect(() => {
    if (selectedLanguage) {
      fetchItems();
    }
  }, [selectedLanguage, filterType, filterActive]);

  const fetchLanguages = async () => {
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
  };

  const fetchItems = async () => {
    if (!selectedLanguage) return;
    
    setLoading(true);
    try {
      const language = languages.find(l => l.id === selectedLanguage);
      if (!language) return;

      const params = new URLSearchParams();
      if (filterType) params.append('item_type', filterType);
      if (filterActive) params.append('only_active', filterActive);

      const response = await apiClient.get<LearningItem[]>(
        `/api/v1/languages/${language.iso_639_3}/learning-items?${params}`
      );
      
      // Sort by display_order
      const sortedItems = response.data.sort((a, b) => a.display_order - b.display_order);
      setItems(sortedItems);
    } catch (error: any) {
      console.error('Failed to fetch items:', error);
      toast.error(error.response?.data?.detail || 'Failed to load learning items');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingItem(null);
    setFormData({
      language_id: selectedLanguage,
      item_key: '',
      title: '',
      about: '',
      icon_name: 'gamepad_rounded',
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
    setFormData({
      title: item.title,
      about: item.about,
      icon_name: item.icon_name,
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
      fetchItems();
    } catch (error: any) {
      console.error('Failed to save item:', error);
      toast.error(error.response?.data?.detail || 'Failed to save learning item');
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <div>
          <div className="font-medium">{item.title}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
            {item.about}
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
        pageTitle="Learning Items"
      />

      {/* Language Selector and Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-lg bg-white p-4 shadow dark:bg-gray-800">
        <div className="flex-1 min-w-[200px]">
          <label className="mb-2 block text-sm font-medium">Language</label>
          <StyledSelect
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            disabled={loading}
            options={[
              { value: '', label: 'Select language...' },
              ...languages.map(lang => ({
                value: lang.id,
                label: `${lang.name} (${lang.native_name})`
              }))
            ]}
          />
        </div>

        <div className="flex-1 min-w-[150px]">
          <label className="mb-2 block text-sm font-medium">Type</label>
          <StyledSelect
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            options={[
              { value: '', label: 'All Types' },
              { value: 'game', label: 'Games' },
              { value: 'lesson', label: 'Lessons' }
            ]}
          />
        </div>

        <div className="flex-1 min-w-[150px]">
          <label className="mb-2 block text-sm font-medium">Status</label>
          <StyledSelect
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
            options={[
              { value: '', label: 'All Status' },
              { value: 'true', label: 'Active Only' },
              { value: 'false', label: 'Inactive Only' }
            ]}
          />
        </div>

        <div className="flex items-end">
          <button
            onClick={handleCreate}
            disabled={!selectedLanguage}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            + Add Item
          </button>
        </div>
      </div>

      {/* Stats */}
      {selectedLanguageData && items.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
            <div className="text-2xl font-bold">{items.length}</div>
            <div className="text-sm text-gray-500">Total Items</div>
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
        <DataTable
          columns={columns as unknown as TableColumn<Record<string, unknown>>[]}
          data={items as unknown as Record<string, unknown>[]}
          keyExtractor={(item) => (item as unknown as LearningItem).id}
          loading={loading}
          emptyMessage="No learning items found. Click 'Add Item' to create one."
        />
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
        title={editingItem ? 'Edit Learning Item' : 'Create Learning Item'}
        isSubmitting={isSubmitting}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="mb-2 block text-sm font-medium">Item Key *</label>
            <input
              type="text"
              value={('item_key' in formData ? formData.item_key : '') || ''}
              onChange={(e) => setFormData({ ...formData, item_key: e.target.value } as any)}
              disabled={!!editingItem}
              className="w-full rounded-lg border px-4 py-2"
              placeholder="e.g., spelling_bee"
            />
          </div>
          
          <div className="col-span-2">
            <label className="mb-2 block text-sm font-medium">Title *</label>
            <input
              type="text"
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full rounded-lg border px-4 py-2"
            />
          </div>
          
          <div className="col-span-2">
            <label className="mb-2 block text-sm font-medium">Description</label>
            <textarea
              value={formData.about || ''}
              onChange={(e) => setFormData({ ...formData, about: e.target.value })}
              className="w-full rounded-lg border px-4 py-2"
              rows={3}
            />
          </div>
          
          <div>
            <label className="mb-2 block text-sm font-medium">Type *</label>
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
              className="w-full rounded-lg border px-4 py-2"
            >
              <option value="game">Game</option>
              <option value="lesson">Lesson</option>
            </select>
          </div>
          
          <div>
            <label className="mb-2 block text-sm font-medium">Level</label>
            <input
              type="text"
              value={formData.level || ''}
              onChange={(e) => setFormData({ ...formData, level: e.target.value })}
              className="w-full rounded-lg border px-4 py-2"
              placeholder="e.g., Beginner"
            />
          </div>
          
          <div>
            <label className="mb-2 block text-sm font-medium">Difficulty</label>
            <input
              type="text"
              value={formData.difficulty || ''}
              onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
              className="w-full rounded-lg border px-4 py-2"
              placeholder="e.g., Easy"
            />
          </div>
          
          <div>
            <label className="mb-2 block text-sm font-medium">Duration (minutes) *</label>
            <input
              type="number"
              value={formData.duration_minutes || ''}
              onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
              className="w-full rounded-lg border px-4 py-2"
              min="1"
            />
          </div>
          
          <div>
            <label className="mb-2 block text-sm font-medium">XP Reward *</label>
            <input
              type="number"
              value={formData.xp_reward || ''}
              onChange={(e) => setFormData({ ...formData, xp_reward: parseInt(e.target.value) })}
              className="w-full rounded-lg border px-4 py-2"
              min="0"
            />
          </div>
          
          <div>
            <label className="mb-2 block text-sm font-medium">Display Order</label>
            <input
              type="number"
              value={formData.display_order || ''}
              onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
              className="w-full rounded-lg border px-4 py-2"
              min="0"
            />
          </div>
          
          <div className="col-span-2">
            <label className="mb-2 block text-sm font-medium">Launch Route *</label>
            <input
              type="text"
              value={normalizeLaunchRoute(formData.item_type, formData.launch_route)}
              onChange={(e) => setFormData({ ...formData, launch_route: e.target.value })}
              className="w-full rounded-lg border px-4 py-2 disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:bg-gray-800"
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
              <span className="text-sm font-medium">Active</span>
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
              <span className="text-sm font-medium">Premium</span>
            </label>
          </div>
        </div>
      </FormModal>
    </div>
  );
}

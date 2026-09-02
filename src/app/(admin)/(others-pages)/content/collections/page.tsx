"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { apiClient } from "@/lib/api";
import FormModal from "@/components/admin/FormModal";
import InlineAudioPlayer from "@/components/ui/audio/InlineAudioPlayer";
import { RegenerateAudioModal, RegenerateAudioTarget } from "@/components/modals/RegenerateAudioModal";

type Language = { id: string; iso_639_3: string; name: string; native_name?: string };
type Collection = {
  collection_key: string;
  title: string;
  description?: string;
  status: string;
  is_active: boolean;
  item_count: number;
};
type Item = {
  id: string;
  concept_key: string;
  sort_order: number;
  category_key?: string;
  learning_term?: string;
  learning_status?: string;
  translation?: string;
  translation_status?: string;
  image_url?: string;
  audio_url?: string;
  translation_audio_url?: string;
  aliases?: string[];
  alias_audio?: Record<string, string>;
};
type Coverage = { iso_639_3: string; name: string; translated_items: number; total_items: number };

export default function CollectionsPage() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [learningLanguage, setLearningLanguage] = useState("yor");
  const [translationLanguage, setTranslationLanguage] = useState("eng");
  const [items, setItems] = useState<Item[]>([]);
  const [coverage, setCoverage] = useState<Coverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);

  const [editingCollection, setEditingCollection] = useState(false);
  const [editCollectionTitle, setEditCollectionTitle] = useState("");
  const [editCollectionDescription, setEditCollectionDescription] = useState("");
  const [isSavingCollection, setIsSavingCollection] = useState(false);

  const [editing, setEditing] = useState<Item | null>(null);
  const [editLearningTerm, setEditLearningTerm] = useState("");
  const [editTranslation, setEditTranslation] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  // Comma-separated in the input, matching how the mobile app already
  // stores/splits alternate names - split into an array only on save.
  const [editAliases, setEditAliases] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [showAddItem, setShowAddItem] = useState(false);
  const [newConceptKey, setNewConceptKey] = useState("");
  const [newLearningTerm, setNewLearningTerm] = useState("");
  const [newTranslation, setNewTranslation] = useState("");
  const [newCategoryKey, setNewCategoryKey] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [isAddingItem, setIsAddingItem] = useState(false);

  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [regeneratingTarget, setRegeneratingTarget] = useState<RegenerateAudioTarget | null>(null);

  const loadCollections = useCallback(async () => {
    const [languageResponse, collectionResponse] = await Promise.all([
      apiClient.get<{ languages: Language[] }>("/api/v1/languages"),
      apiClient.get<{ collections: Collection[] }>("/api/v1/admin/content-collections"),
    ]);
    setLanguages(languageResponse.data.languages ?? []);
    const next = collectionResponse.data.collections ?? [];
    setCollections(next);
    setSelected((current) => current || next[0]?.collection_key || "");
  }, []);

  const loadItems = useCallback(async () => {
    if (!selected) return;
    const [itemsResponse, coverageResponse] = await Promise.all([
      apiClient.get<{ items: Item[] }>(`/api/v1/admin/content-collections/${selected}/items`, {
        params: { learning_language: learningLanguage, translation_language: translationLanguage },
      }),
      apiClient.get<{ coverage: Coverage[] }>(`/api/v1/admin/content-collections/${selected}/coverage`, {
        params: { learning_language: learningLanguage },
      }),
    ]);
    setItems(itemsResponse.data.items ?? []);
    setCoverage(coverageResponse.data.coverage ?? []);
  }, [selected, learningLanguage, translationLanguage]);

  useEffect(() => {
    loadCollections().catch((reason) => setError(reason?.response?.data?.detail || "Could not load collections"))
      .finally(() => setLoading(false));
  }, [loadCollections]);

  useEffect(() => {
    // The callback performs network synchronization and only updates state
    // after its awaited requests resolve.
    loadItems().catch((reason) => setError(reason?.response?.data?.detail || "Could not load collection items"));
  }, [loadItems]);

  const selectedCollection = useMemo(
    () => collections.find((collection) => collection.collection_key === selected),
    [collections, selected],
  );

  async function createCollection(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setIsCreatingCollection(true);
    try {
      await apiClient.post("/api/v1/admin/content-collections", {
        collection_key: newKey,
        title: newTitle,
        localization_language: "eng",
        default_translation_language: "eng",
      });
      setNewKey("");
      setNewTitle("");
      setShowCreateCollection(false);
      await loadCollections();
    } catch (reason: any) {
      setError(reason?.response?.data?.detail || "Could not create collection");
    } finally {
      setIsCreatingCollection(false);
    }
  }

  function startEditingCollection() {
    if (!selectedCollection) return;
    setEditCollectionTitle(selectedCollection.title);
    setEditCollectionDescription(selectedCollection.description || "");
    setEditingCollection(true);
  }

  async function saveCollection(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedCollection) return;
    setError("");
    setIsSavingCollection(true);
    try {
      await apiClient.put(`/api/v1/admin/content-collections/${selected}/localizations`, {
        language: "eng",
        title: editCollectionTitle,
        description: editCollectionDescription || null,
        status: selectedCollection.status,
      });
      setEditingCollection(false);
      await loadCollections();
    } catch (reason: any) {
      setError(reason?.response?.data?.detail || "Could not update collection");
    } finally {
      setIsSavingCollection(false);
    }
  }

  function startEditing(item: Item) {
    setEditing(item);
    setEditLearningTerm(item.learning_term || "");
    setEditTranslation(item.translation || "");
    setEditImageUrl(item.image_url || "");
    setEditAliases((item.aliases || []).join(", "));
  }

  async function saveItem(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setIsSaving(true);
    setError("");
    const aliases = editAliases
      .split(",")
      .map((alias) => alias.trim())
      .filter((alias) => alias.length > 0);
    try {
      await Promise.all([
        apiClient.put(`/api/v1/admin/content-collections/${selected}/items/${editing.concept_key}/terms`, {
          language: learningLanguage,
          term: editLearningTerm,
          aliases,
          audio_url: editing.audio_url || null,
          status: "published",
        }),
        apiClient.put(`/api/v1/admin/content-collections/${selected}/items/${editing.concept_key}/terms`, {
          language: translationLanguage,
          term: editTranslation,
          audio_url: editing.translation_audio_url || null,
          status: "published",
        }),
        editImageUrl ? apiClient.put(`/api/v1/admin/content-collections/${selected}/items/${editing.concept_key}/image`, {
          language: learningLanguage, asset_url: editImageUrl, alt_text: editTranslation,
        }) : Promise.resolve(),
      ]);
      setEditing(null);
      await loadItems();
    } catch (reason: any) {
      setError(reason?.response?.data?.detail || "Could not update item");
    } finally {
      setIsSaving(false);
    }
  }

  async function addItem(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setError("");
    setIsAddingItem(true);
    try {
      await apiClient.post(`/api/v1/admin/content-collections/${selected}/items`, {
        concept_key: newConceptKey,
        category_key: newCategoryKey || null,
      });
      await Promise.all([
        apiClient.put(`/api/v1/admin/content-collections/${selected}/items/${newConceptKey}/terms`, {
          language: learningLanguage,
          term: newLearningTerm,
          status: "published",
        }),
        apiClient.put(`/api/v1/admin/content-collections/${selected}/items/${newConceptKey}/terms`, {
          language: translationLanguage,
          term: newTranslation,
          status: "published",
        }),
        newImageUrl
          ? apiClient.put(`/api/v1/admin/content-collections/${selected}/items/${newConceptKey}/image`, {
              language: learningLanguage,
              asset_url: newImageUrl,
              alt_text: newTranslation,
            })
          : Promise.resolve(),
      ]);
      setNewConceptKey("");
      setNewLearningTerm("");
      setNewTranslation("");
      setNewCategoryKey("");
      setNewImageUrl("");
      setShowAddItem(false);
      await Promise.all([loadItems(), loadCollections()]);
    } catch (reason: any) {
      setError(reason?.response?.data?.detail || "Could not add item");
    } finally {
      setIsAddingItem(false);
    }
  }

  function handleRegenerateAudio(item: Item) {
    if (!selected) return;
    // Editing the term text and regenerating are independent actions - if the
    // edit modal happens to be open for this same item, prefer the in-progress
    // edited text so a not-yet-saved term correction is reflected in the
    // regenerated audio; otherwise (row-level trigger) fall back to the item's
    // saved term.
    const displayText =
      editing?.id === item.id
        ? editLearningTerm || item.learning_term || item.concept_key
        : item.learning_term || item.concept_key;
    setRegeneratingTarget({
      id: item.id,
      contentType: "term",
      displayText,
      defaultText: displayText,
      languageCode: learningLanguage,
      submitEndpoint: `/api/v1/admin/content-collections/${selected}/items/${item.concept_key}/terms/${learningLanguage}/regenerate-audio`,
    });
    setShowRegenerateModal(true);
  }

  async function toggleCollectionPublished() {
    if (!selectedCollection) return;
    setError("");
    const nextStatus = selectedCollection.status === "published" ? "draft" : "published";
    await Promise.all([
      apiClient.patch(`/api/v1/admin/content-collections/${selected}`, {
        status: nextStatus,
        is_active: true,
      }),
      apiClient.put(`/api/v1/admin/content-collections/${selected}/localizations`, {
        language: "eng",
        title: selectedCollection.title,
        description: selectedCollection.description || null,
        status: nextStatus,
      }),
    ]);
    await loadCollections();
  }

  if (loading) return <div className="py-12 text-sm text-gray-500">Loading collections…</div>;

  return (
    <div className="space-y-5">
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</div>}

      <div className="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 md:grid-cols-3">
        <label className="text-sm text-gray-600 dark:text-gray-300">Collection
          <select value={selected} onChange={(event) => setSelected(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2 text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white">
            {collections.map((collection) => <option key={collection.collection_key} value={collection.collection_key}>{collection.title} ({collection.item_count})</option>)}
          </select>
        </label>
        <label className="text-sm text-gray-600 dark:text-gray-300">Learning language
          <select value={learningLanguage} onChange={(event) => setLearningLanguage(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2 text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white">
            {languages.map((language) => <option key={language.id} value={language.iso_639_3}>{language.name}</option>)}
          </select>
        </label>
        <label className="text-sm text-gray-600 dark:text-gray-300">Translation language
          <select value={translationLanguage} onChange={(event) => setTranslationLanguage(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2 text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white">
            {languages.map((language) => <option key={language.id} value={language.iso_639_3}>{language.name}</option>)}
          </select>
        </label>
      </div>

      {selectedCollection && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700 dark:bg-gray-800 dark:text-white">{selectedCollection.status}</span>
          {coverage.map((entry) => (
            <span key={entry.iso_639_3} className="rounded-full bg-brand-50 px-3 py-1 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">
              {entry.name}: {entry.translated_items}/{entry.total_items}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {selectedCollection && <button onClick={startEditingCollection} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-white">Edit collection</button>}
        {selectedCollection && <button onClick={() => toggleCollectionPublished().catch((reason) => setError(reason?.response?.data?.detail || "Could not update collection"))} className="rounded-lg border border-brand-500 px-4 py-2 text-sm font-medium text-brand-600 dark:text-brand-300">{selectedCollection.status === "published" ? "Return to draft" : "Publish collection"}</button>}
        {selected && <button onClick={() => setShowAddItem(true)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-white">New item</button>}
        <button onClick={() => setShowCreateCollection(true)} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white">New collection</button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:text-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-900"><tr>
              {['Order', 'Image', 'Audio', 'Concept', 'Learning term', 'Translation', 'Category', 'Status'].map((heading) => <th key={heading} className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-300">{heading}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-950">
              {items.map((item) => <tr key={item.id} onClick={() => startEditing(item)} className="cursor-pointer text-gray-800 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-900">
                <td className="px-4 py-3">{item.sort_order + 1}</td>
                <td className="px-4 py-3">{item.image_url ? <Image src={item.image_url} alt="" width={48} height={48} unoptimized className="h-12 w-12 rounded-lg object-contain" /> : <span className="text-gray-400">Missing</span>}</td>
                <td className="px-4 py-3">
                  <div onClick={(event) => event.stopPropagation()} className="flex items-center gap-2">
                    <InlineAudioPlayer src={item.audio_url} size="md" />
                    <button
                      type="button"
                      onClick={() => handleRegenerateAudio(item)}
                      className="text-xs font-medium text-brand-600 hover:text-brand-800 dark:text-brand-400"
                    >
                      Regenerate Audio
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">{item.concept_key}</td>
                <td className="px-4 py-3 font-medium">{item.learning_term || 'Missing'}</td>
                <td className="px-4 py-3">{item.translation || 'Missing'}</td>
                <td className="px-4 py-3">{item.category_key || '—'}</td>
                <td className="px-4 py-3">{item.learning_status || 'missing'} / {item.translation_status || 'missing'}</td>
              </tr>)}
              {!items.length && <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-500">No items for this language pair.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <FormModal
        isOpen={showCreateCollection}
        onClose={() => !isCreatingCollection && setShowCreateCollection(false)}
        onSubmit={createCollection}
        title="New collection"
        submitLabel="Create draft"
        isSubmitting={isCreatingCollection}
      >
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Collection key
          <input required pattern="[a-z0-9][a-z0-9_-]+" value={newKey} onChange={(event) => setNewKey(event.target.value)} placeholder="e.g. foods" className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
        </label>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">English title
          <input required value={newTitle} onChange={(event) => setNewTitle(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
        </label>
      </FormModal>

      <FormModal
        isOpen={editingCollection}
        onClose={() => !isSavingCollection && setEditingCollection(false)}
        onSubmit={saveCollection}
        title={`Edit ${selectedCollection?.title || "collection"}`}
        submitLabel="Save"
        isSubmitting={isSavingCollection}
      >
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title
          <input required value={editCollectionTitle} onChange={(event) => setEditCollectionTitle(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
        </label>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description
          <textarea value={editCollectionDescription} onChange={(event) => setEditCollectionDescription(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
        </label>
      </FormModal>

      <FormModal
        isOpen={showAddItem}
        onClose={() => !isAddingItem && setShowAddItem(false)}
        onSubmit={addItem}
        title={`Add item to ${selected}`}
        submitLabel="Add and publish terms"
        size="lg"
        isSubmitting={isAddingItem}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Stable concept key
            <input required pattern="[a-z0-9][a-z0-9_.-]+" value={newConceptKey} onChange={(event) => setNewConceptKey(event.target.value)} placeholder="animal.lion" className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
          </label>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Category key
            <input value={newCategoryKey} onChange={(event) => setNewCategoryKey(event.target.value)} placeholder="mammal" className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
          </label>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{learningLanguage} term
            <input required value={newLearningTerm} onChange={(event) => setNewLearningTerm(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
          </label>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{translationLanguage} translation
            <input required value={newTranslation} onChange={(event) => setNewTranslation(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
          </label>
        </div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Primary image URL
          <input value={newImageUrl} onChange={(event) => setNewImageUrl(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
        </label>
      </FormModal>

      <FormModal
        isOpen={Boolean(editing)}
        onClose={() => !isSaving && setEditing(null)}
        onSubmit={saveItem}
        title={`Edit ${editing?.translation || editing?.learning_term || "collection item"}`}
        submitLabel="Save and publish"
        size="lg"
        isSubmitting={isSaving}
      >
        {editing && (
          <>
            <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-950">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white dark:bg-gray-900">
                {editImageUrl ? <Image src={editImageUrl} alt={editTranslation || editLearningTerm} width={80} height={80} unoptimized className="h-full w-full object-contain" /> : <span className="text-xs text-gray-400">No image</span>}
              </div>
              <div className="min-w-0 space-y-2">
                <p className="truncate font-mono text-xs text-gray-500 dark:text-gray-400">{editing.concept_key}</p>
                <div className="flex items-center gap-3">
                  <InlineAudioPlayer src={editing.audio_url} size="md" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">Play {learningLanguage} pronunciation</span>
                  <button
                    type="button"
                    onClick={() => editing && handleRegenerateAudio(editing)}
                    className="rounded-lg border border-brand-500 px-2.5 py-1 text-xs font-medium text-brand-600 dark:text-brand-300"
                  >
                    Regenerate Audio
                  </button>
                </div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{learningLanguage} term<input required value={editLearningTerm} onChange={(event) => setEditLearningTerm(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white" /></label>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{translationLanguage} translation<input required value={editTranslation} onChange={(event) => setEditTranslation(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white" /></label>
            </div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Primary image URL<input value={editImageUrl} onChange={(event) => setEditImageUrl(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white" /></label>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Alternate names ({learningLanguage}), comma-separated
              <input
                value={editAliases}
                onChange={(event) => setEditAliases(event.target.value)}
                placeholder="e.g. Egbin, Olúbe, Èsúró"
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
              />
            </label>
            {(editing.aliases || []).length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Audio: {(editing.aliases || []).map((alias) => (
                  <span key={alias} className="mr-2">
                    {alias} {editing.alias_audio?.[alias] ? "✓" : "(none yet)"}
                  </span>
                ))}
                {" "}— renamed or new names need the audio backfill script re-run.
              </p>
            )}
          </>
        )}
      </FormModal>

      <RegenerateAudioModal
        isOpen={showRegenerateModal}
        onClose={() => {
          setShowRegenerateModal(false);
          setRegeneratingTarget(null);
        }}
        target={regeneratingTarget}
        onSuccess={() => {
          setEditing(null);
          loadItems().catch((reason) => setError(reason?.response?.data?.detail || "Could not refresh collection items"));
        }}
      />
    </div>
  );
}

"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { apiClient } from "@/lib/api";

type Language = { id: string; iso_639_3: string; name: string; native_name?: string };
type Collection = { collection_key: string; title: string; status: string; is_active: boolean; item_count: number };
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
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [editing, setEditing] = useState<Item | null>(null);
  const [editLearningTerm, setEditLearningTerm] = useState("");
  const [editTranslation, setEditTranslation] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [showAddItem, setShowAddItem] = useState(false);
  const [newConceptKey, setNewConceptKey] = useState("");
  const [newLearningTerm, setNewLearningTerm] = useState("");
  const [newTranslation, setNewTranslation] = useState("");
  const [newCategoryKey, setNewCategoryKey] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCollections().catch((reason) => setError(reason?.response?.data?.detail || "Could not load collections"))
      .finally(() => setLoading(false));
  }, [loadCollections]);

  useEffect(() => {
    // The callback performs network synchronization and only updates state
    // after its awaited requests resolve.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadItems().catch((reason) => setError(reason?.response?.data?.detail || "Could not load collection items"));
  }, [loadItems]);

  const selectedCollection = useMemo(
    () => collections.find((collection) => collection.collection_key === selected),
    [collections, selected],
  );

  async function createCollection(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    await apiClient.post("/api/v1/admin/content-collections", {
      collection_key: newKey,
      title: newTitle,
      localization_language: "eng",
      default_translation_language: "eng",
    });
    setNewKey("");
    setNewTitle("");
    setShowCreate(false);
    await loadCollections();
  }

  function startEditing(item: Item) {
    setEditing(item);
    setEditLearningTerm(item.learning_term || "");
    setEditTranslation(item.translation || "");
    setEditImageUrl(item.image_url || "");
  }

  async function saveItem(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    await Promise.all([
      apiClient.put(`/api/v1/admin/content-collections/${selected}/items/${editing.concept_key}/terms`, {
        language: learningLanguage, term: editLearningTerm, status: "published",
      }),
      apiClient.put(`/api/v1/admin/content-collections/${selected}/items/${editing.concept_key}/terms`, {
        language: translationLanguage, term: editTranslation, status: "published",
      }),
      editImageUrl ? apiClient.put(`/api/v1/admin/content-collections/${selected}/items/${editing.concept_key}/image`, {
        language: learningLanguage, asset_url: editImageUrl, alt_text: editTranslation,
      }) : Promise.resolve(),
    ]);
    setEditing(null);
    await loadItems();
  }

  async function addItem(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setError("");
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
        status: nextStatus,
      }),
    ]);
    await loadCollections();
  }

  if (loading) return <div className="py-12 text-sm text-gray-500">Loading collections…</div>;

  return (
    <div className="space-y-5">
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</div>}
      <div className="flex flex-wrap justify-end gap-2">
        {selectedCollection && <button onClick={() => toggleCollectionPublished().catch((reason) => setError(reason?.response?.data?.detail || "Could not update collection"))} className="rounded-lg border border-brand-500 px-4 py-2 text-sm font-medium text-brand-600 dark:text-brand-300">{selectedCollection.status === "published" ? "Return to draft" : "Publish collection"}</button>}
        {selected && <button onClick={() => setShowAddItem((value) => !value)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium dark:border-gray-700">{showAddItem ? "Cancel item" : "New item"}</button>}
        <button onClick={() => setShowCreate((value) => !value)} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white">{showCreate ? "Cancel" : "New collection"}</button>
      </div>
      {showCreate && <form onSubmit={createCollection} className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 md:grid-cols-[1fr_2fr_auto]">
        <input required pattern="[a-z0-9][a-z0-9_-]+" value={newKey} onChange={(event) => setNewKey(event.target.value)} placeholder="Collection key, e.g. foods" className="rounded-lg border p-2 dark:border-gray-700 dark:bg-gray-950" />
        <input required value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="English title" className="rounded-lg border p-2 dark:border-gray-700 dark:bg-gray-950" />
        <button className="rounded-lg bg-brand-500 px-4 py-2 text-white">Create draft</button>
      </form>}
      {showAddItem && <form onSubmit={(event) => addItem(event).catch((reason) => setError(reason?.response?.data?.detail || "Could not add item"))} className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="font-semibold">Add item to {selected}</h3>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm">Stable concept key<input required pattern="[a-z0-9][a-z0-9_.-]+" value={newConceptKey} onChange={(event) => setNewConceptKey(event.target.value)} placeholder="animal.lion" className="mt-1 w-full rounded-lg border p-2 dark:border-gray-700 dark:bg-gray-950" /></label>
          <label className="text-sm">{learningLanguage} term<input required value={newLearningTerm} onChange={(event) => setNewLearningTerm(event.target.value)} className="mt-1 w-full rounded-lg border p-2 dark:border-gray-700 dark:bg-gray-950" /></label>
          <label className="text-sm">{translationLanguage} translation<input required value={newTranslation} onChange={(event) => setNewTranslation(event.target.value)} className="mt-1 w-full rounded-lg border p-2 dark:border-gray-700 dark:bg-gray-950" /></label>
          <label className="text-sm">Category key<input value={newCategoryKey} onChange={(event) => setNewCategoryKey(event.target.value)} placeholder="mammal" className="mt-1 w-full rounded-lg border p-2 dark:border-gray-700 dark:bg-gray-950" /></label>
          <label className="text-sm">Primary image URL<input value={newImageUrl} onChange={(event) => setNewImageUrl(event.target.value)} className="mt-1 w-full rounded-lg border p-2 dark:border-gray-700 dark:bg-gray-950" /></label>
        </div>
        <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white">Add and publish terms</button>
      </form>}
      <div className="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 md:grid-cols-3">
        <label className="text-sm text-gray-600 dark:text-gray-300">Collection
          <select value={selected} onChange={(event) => setSelected(event.target.value)} className="mt-1 w-full rounded-lg border p-2 dark:border-gray-700 dark:bg-gray-950">
            {collections.map((collection) => <option key={collection.collection_key} value={collection.collection_key}>{collection.title} ({collection.item_count})</option>)}
          </select>
        </label>
        <label className="text-sm text-gray-600 dark:text-gray-300">Learning language
          <select value={learningLanguage} onChange={(event) => setLearningLanguage(event.target.value)} className="mt-1 w-full rounded-lg border p-2 dark:border-gray-700 dark:bg-gray-950">
            {languages.map((language) => <option key={language.id} value={language.iso_639_3}>{language.name}</option>)}
          </select>
        </label>
        <label className="text-sm text-gray-600 dark:text-gray-300">Translation language
          <select value={translationLanguage} onChange={(event) => setTranslationLanguage(event.target.value)} className="mt-1 w-full rounded-lg border p-2 dark:border-gray-700 dark:bg-gray-950">
            {languages.map((language) => <option key={language.id} value={language.iso_639_3}>{language.name}</option>)}
          </select>
        </label>
      </div>

      {selectedCollection && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full bg-gray-100 px-3 py-1 dark:bg-gray-800">{selectedCollection.status}</span>
          {coverage.map((entry) => (
            <span key={entry.iso_639_3} className="rounded-full bg-brand-50 px-3 py-1 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">
              {entry.name}: {entry.translated_items}/{entry.total_items}
            </span>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-900"><tr>
              {['Order', 'Image', 'Concept', 'Learning term', 'Translation', 'Category', 'Status'].map((heading) => <th key={heading} className="px-4 py-3 text-left font-medium text-gray-500">{heading}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-950">
              {items.map((item) => <tr key={item.id} onClick={() => startEditing(item)} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900">
                <td className="px-4 py-3">{item.sort_order + 1}</td>
                <td className="px-4 py-3">{item.image_url ? <Image src={item.image_url} alt="" width={48} height={48} unoptimized className="h-12 w-12 rounded-lg object-contain" /> : <span className="text-gray-400">Missing</span>}</td>
                <td className="px-4 py-3 font-mono text-xs">{item.concept_key}</td>
                <td className="px-4 py-3 font-medium">{item.learning_term || 'Missing'}</td>
                <td className="px-4 py-3">{item.translation || 'Missing'}</td>
                <td className="px-4 py-3">{item.category_key || '—'}</td>
                <td className="px-4 py-3">{item.learning_status || 'missing'} / {item.translation_status || 'missing'}</td>
              </tr>)}
              {!items.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">No items for this language pair.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {editing && <form onSubmit={saveItem} className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/30 p-4 dark:border-brand-900 dark:bg-brand-950/10">
        <div className="flex items-center justify-between"><h3 className="font-semibold">Edit {editing.concept_key}</h3><button type="button" onClick={() => setEditing(null)} className="text-sm text-gray-500">Close</button></div>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm">{learningLanguage} term<input required value={editLearningTerm} onChange={(event) => setEditLearningTerm(event.target.value)} className="mt-1 w-full rounded-lg border p-2 dark:border-gray-700 dark:bg-gray-950" /></label>
          <label className="text-sm">{translationLanguage} translation<input required value={editTranslation} onChange={(event) => setEditTranslation(event.target.value)} className="mt-1 w-full rounded-lg border p-2 dark:border-gray-700 dark:bg-gray-950" /></label>
          <label className="text-sm">Primary image URL<input value={editImageUrl} onChange={(event) => setEditImageUrl(event.target.value)} className="mt-1 w-full rounded-lg border p-2 dark:border-gray-700 dark:bg-gray-950" /></label>
        </div>
        <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white">Save and publish terms</button>
      </form>}
    </div>
  );
}

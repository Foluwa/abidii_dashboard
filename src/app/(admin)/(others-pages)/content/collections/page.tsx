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

const slugifyKey = (value: string) => value
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");

const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(field.trim()); field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; field = "";
    } else field += character;
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
};

const googleSheetCsvUrl = (reference: string, worksheet: string) => {
  const match = reference.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const spreadsheetId = match?.[1] || reference.trim();
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(worksheet)}`;
};

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
  const [newEntityKey, setNewEntityKey] = useState("");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [showBulkImport, setShowBulkImport] = useState(false);
  const [sheetReference, setSheetReference] = useState("");
  const [worksheetTitle, setWorksheetTitle] = useState("collections");
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState("");

  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [regeneratingTarget, setRegeneratingTarget] = useState<RegenerateAudioTarget | null>(null);

  const loadCollections = useCallback(async () => {
    const [languageResponse, collectionResponse] = await Promise.all([
      apiClient.get<{ languages: Language[] }>("/api/v1/languages"),
      apiClient.get<{ collections: Collection[] }>("/api/v1/admin/content-collections"),
    ]);
    setLanguages([...(languageResponse.data.languages ?? [])].sort((a, b) => a.name.localeCompare(b.name)));
    const next = [...(collectionResponse.data.collections ?? [])].sort((a, b) => a.title.localeCompare(b.title));
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

  const categories = useMemo(
    () => [...new Set(items.map((item) => item.category_key).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b)),
    [items],
  );
  const entityKeys = useMemo(
    () => [...new Set(items.map((item) => item.concept_key.split(".")[0]).filter(Boolean).concat(selected ? [selected.replace(/s$/, "")] : []))].sort((a, b) => a.localeCompare(b)),
    [items, selected],
  );
  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return items.filter((item) => {
      if (categoryFilter !== "all" && item.category_key !== categoryFilter) return false;
      if (statusFilter !== "all" && item.learning_status !== statusFilter && item.translation_status !== statusFilter) return false;
      if (!query) return true;
      return [item.concept_key, item.learning_term, item.translation, item.category_key]
        .some((value) => value?.toLocaleLowerCase().includes(query));
    });
  }, [items, search, categoryFilter, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const visibleItems = filteredItems.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [search, categoryFilter, statusFilter, selected, pageSize]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  useEffect(() => { if (!newEntityKey && entityKeys.length) setNewEntityKey(entityKeys[0]); }, [entityKeys, newEntityKey]);

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

  async function importFromGoogleSheet(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !sheetReference.trim() || !worksheetTitle.trim()) return;
    setError("");
    setImportSummary("");
    setIsImporting(true);
    try {
      const response = await fetch(googleSheetCsvUrl(sheetReference, worksheetTitle));
      if (!response.ok) throw new Error(`Google Sheets returned HTTP ${response.status}. Make sure the sheet is shared for viewing.`);
      const parsed = parseCsv(await response.text());
      const headers = (parsed.shift() || []).map((header) => header.trim().toLowerCase());
      const required = ["concept_key", "learning_term", "translation"];
      const missing = required.filter((column) => !headers.includes(column));
      if (missing.length) throw new Error(`Missing required columns: ${missing.join(", ")}`);
      let imported = 0;
      let failed = 0;
      for (const cells of parsed) {
        const record = Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() || ""]));
        if (!record.concept_key || !record.learning_term || !record.translation) { failed += 1; continue; }
        try {
          await apiClient.post(`/api/v1/admin/content-collections/${selected}/items`, {
            concept_key: record.concept_key,
            category_key: record.category_key || null,
          }).catch((reason) => {
            if (reason?.response?.status !== 409) throw reason;
          });
          await Promise.all([
            apiClient.put(`/api/v1/admin/content-collections/${selected}/items/${record.concept_key}/terms`, { language: learningLanguage, term: record.learning_term, status: "published" }),
            apiClient.put(`/api/v1/admin/content-collections/${selected}/items/${record.concept_key}/terms`, { language: translationLanguage, term: record.translation, status: "published" }),
            record.image_url ? apiClient.put(`/api/v1/admin/content-collections/${selected}/items/${record.concept_key}/image`, { language: learningLanguage, asset_url: record.image_url, alt_text: record.translation }) : Promise.resolve(),
          ]);
          imported += 1;
        } catch { failed += 1; }
      }
      setImportSummary(`${imported} row${imported === 1 ? "" : "s"} imported${failed ? `; ${failed} failed` : ""}.`);
      await Promise.all([loadItems(), loadCollections()]);
    } catch (reason: any) {
      setError(reason?.message || reason?.response?.data?.detail || "Could not import Google Sheet");
    } finally {
      setIsImporting(false);
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
      const conceptKey = newConceptKey.includes(".") ? newConceptKey : `${newEntityKey}.${slugifyKey(newConceptKey)}`;
      await apiClient.post(`/api/v1/admin/content-collections/${selected}/items`, {
        concept_key: conceptKey,
        category_key: newCategoryKey || null,
      });
      await Promise.all([
        apiClient.put(`/api/v1/admin/content-collections/${selected}/items/${conceptKey}/terms`, {
          language: learningLanguage,
          term: newLearningTerm,
          status: "published",
        }),
        apiClient.put(`/api/v1/admin/content-collections/${selected}/items/${conceptKey}/terms`, {
          language: translationLanguage,
          term: newTranslation,
          status: "published",
        }),
        newImageUrl
          ? apiClient.put(`/api/v1/admin/content-collections/${selected}/items/${conceptKey}/image`, {
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
        {selected && <button onClick={() => setShowBulkImport((current) => !current)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-white">Bulk Import from Google Sheets</button>}
        {selectedCollection && <button onClick={startEditingCollection} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-white">Edit collection</button>}
        {selectedCollection && <button onClick={() => toggleCollectionPublished().catch((reason) => setError(reason?.response?.data?.detail || "Could not update collection"))} className="rounded-lg border border-brand-500 px-4 py-2 text-sm font-medium text-brand-600 dark:text-brand-300">{selectedCollection.status === "published" ? "Return to draft" : "Publish collection"}</button>}
        {selected && <button onClick={() => setShowAddItem(true)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-white">New item</button>}
        <button onClick={() => setShowCreateCollection(true)} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white">New collection</button>
      </div>

      {showBulkImport && (
        <form onSubmit={importFromGoogleSheet} className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div><h3 className="font-semibold text-gray-900 dark:text-white">Bulk Import from Google Sheets</h3><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Required columns: concept_key, learning_term, translation. Optional: category_key, image_url. Existing concept keys are updated safely.</p></div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-gray-700 dark:text-gray-300">Google Sheet URL or ID<input required value={sheetReference} onChange={(event) => setSheetReference(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white" /></label>
            <label className="text-sm text-gray-700 dark:text-gray-300">Worksheet name<input required value={worksheetTitle} onChange={(event) => setWorksheetTitle(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white" /></label>
          </div>
          <div className="flex items-center gap-3"><button disabled={isImporting} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{isImporting ? "Importing…" : "Import sheet"}</button>{importSummary && <span className="text-sm text-emerald-600 dark:text-emerald-400">{importSummary}</span>}</div>
        </form>
      )}

      <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 md:grid-cols-4">
        <label className="text-sm text-gray-600 dark:text-gray-300">Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Concept, term or translation" className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2 text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white" /></label>
        <label className="text-sm text-gray-600 dark:text-gray-300">Category<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2 text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"><option value="all">All categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
        <label className="text-sm text-gray-600 dark:text-gray-300">Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2 text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"><option value="all">All statuses</option>{["draft", "published", "review", "stale"].map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
        <label className="text-sm text-gray-600 dark:text-gray-300">Rows per page<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2 text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white">{[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:text-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-900"><tr>
              {['Order', 'Image', 'Audio', 'Concept', 'Learning term', 'Translation', 'Category', 'Status'].map((heading) => <th key={heading} className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-300">{heading}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-950">
              {visibleItems.map((item) => <tr key={item.id} onClick={() => startEditing(item)} className="cursor-pointer text-gray-800 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-900">
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
              {!visibleItems.length && <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-500">No items match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500 dark:text-gray-400"><span>{filteredItems.length ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filteredItems.length)} of ${filteredItems.length}` : "0 items"}</span><div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-gray-300 px-3 py-2 disabled:opacity-40 dark:border-gray-700">Previous</button><span>Page {page} of {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-gray-300 px-3 py-2 disabled:opacity-40 dark:border-gray-700">Next</button></div></div>

      <FormModal
        isOpen={showCreateCollection}
        onClose={() => !isCreatingCollection && setShowCreateCollection(false)}
        onSubmit={createCollection}
        title="New collection"
        submitLabel="Create draft"
        isSubmitting={isCreatingCollection}
      >
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">English title
          <input required value={newTitle} onChange={(event) => { setNewTitle(event.target.value); setNewKey(slugifyKey(event.target.value)); }} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
        </label>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Generated collection key<input readOnly value={newKey} className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 font-mono text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300" /></label>
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
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Entity
            <select required value={newEntityKey} onChange={(event) => setNewEntityKey(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white">{entityKeys.map((entity) => <option key={entity} value={entity}>{entity}</option>)}</select>
          </label>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Category key
            <select value={newCategoryKey} onChange={(event) => setNewCategoryKey(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"><option value="">Uncategorised</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select>
          </label>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Item key<input required pattern="[a-z0-9][a-z0-9_.-]+" value={newConceptKey} onChange={(event) => setNewConceptKey(slugifyKey(event.target.value))} placeholder="lion" className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-white" /></label>
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

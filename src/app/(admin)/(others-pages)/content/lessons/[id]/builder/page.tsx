"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import type { Lesson, Word, Sentence, Phrase, Proverb } from "@/types/api";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Alert from "@/components/ui/alert/SimpleAlert";
import { useToast } from "@/contexts/ToastContext";

type ContentType = "letter" | "word" | "sentence" | "phrase" | "proverb";

interface Letter {
  id: string;
  language_id: string;
  glyph: string;
  display_name: string;
  is_digraph: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
  audio_url?: string;
}

interface LessonContent {
  content_type: ContentType;
  content_id: string;
  order: number;
  item?: any; // The actual content item
}

export default function LessonBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const lessonId = params?.id as string;

  const toast = useToast();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [lessonContent, setLessonContent] = useState<LessonContent[]>([]);
  const [availableContent, setAvailableContent] = useState<{
    letters: Letter[];
    words: Word[];
    sentences: Sentence[];
    phrases: Phrase[];
    proverbs: Proverb[];
  }>({
    letters: [],
    words: [],
    sentences: [],
    phrases: [],
    proverbs: [],
  });

  const [contentDetailsByKey, setContentDetailsByKey] = useState<Record<string, any>>({});
  const [failedContentKeys, setFailedContentKeys] = useState<Record<string, true>>({});
  
  const [selectedContentType, setSelectedContentType] = useState<ContentType>("word");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const getBuilderContentType = (apiContentType: any): ContentType => {
    switch (apiContentType) {
      case "letters":
        return "letter";
      case "words":
        return "word";
      case "sentences":
        return "sentence";
      case "phrases":
        return "phrase";
      case "proverbs":
        return "proverb";
      default:
        return "word";
    }
  };

  const getApiContentType = (builderType: ContentType): string | null => {
    switch (builderType) {
      case "letter":
        return "letters";
      case "word":
        return "words";
      case "sentence":
        return "sentences";
      case "phrase":
        return "phrases";
      case "proverb":
        return "proverbs";
      default:
        return null;
    }
  };

  useEffect(() => {
    if (lessonId) {
      loadLessonData();
    }
  }, [lessonId]);

  useEffect(() => {
    if (lesson?.language_id) {
      loadAvailableContent();
    }
  }, [lesson?.language_id, selectedContentType]);

  useEffect(() => {
    if (!lesson || lessonContent.length === 0) return;
    void loadMissingContentDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson, lessonContent, availableContent]);

  const getContentKey = (contentType: ContentType, contentId: string) => `${contentType}:${contentId}`;

  const getPrimaryText = (contentType: ContentType, item: any): string | null => {
    if (!item) return null;
    switch (contentType) {
      case "letter":
        return item.glyph ?? item.display_name ?? null;
      case "word":
        // Public /api/v1/words/{word_id} returns YorubaWordResponse (yoruba_word, english_translation)
        return item.word ?? item.lemma ?? item.yoruba_word ?? item.text ?? null;
      case "sentence":
      case "phrase":
        return item.text ?? item.yoruba_text ?? null;
      case "proverb":
        return item.proverb ?? item.text ?? item.yoruba_text ?? null;
      default:
        return null;
    }
  };

  const getSecondaryText = (item: any): string | null => {
    if (!item) return null;
    return item.translation ?? item.meaning ?? item.english_translation ?? null;
  };

  const findAvailableItem = (contentType: ContentType, contentId: string): any | null => {
    const listKey = `${contentType}s` as keyof typeof availableContent;
    const items = (availableContent[listKey] as any[]) || [];
    return (
      items.find((i) => {
        const candidates = [i?.id, i?.word_id, i?.lemma_id, i?.content_id].filter(Boolean);
        return candidates.some((c) => String(c) === String(contentId));
      }) ?? null
    );
  };

  const getLatestContentSnapshot = (versions: any[]): any | null => {
    if (!Array.isArray(versions) || versions.length === 0) return null;
    const latest = versions.reduce((best, curr) => {
      const bestNum = typeof best?.version_number === "number" ? best.version_number : -1;
      const currNum = typeof curr?.version_number === "number" ? curr.version_number : -1;
      return currNum > bestNum ? curr : best;
    }, versions[0]);
    return latest?.content_snapshot ?? null;
  };

  const fetchContentViaVersions = async (contentType: ContentType, contentId: string): Promise<any | null> => {
    // Backend stores content_versions.content_type as the singular enum values:
    // letter, word, sentence, phrase, proverb, lesson, game
    const response = await apiClient.get(`/api/v1/admin/content/versions/${contentType}/${contentId}`);
    return getLatestContentSnapshot(response.data);
  };

  const loadMissingContentDetails = async () => {
    const missing = lessonContent
      .map((c) => ({ ...c, key: getContentKey(c.content_type, c.content_id) }))
      .filter((c) => {
        if (contentDetailsByKey[c.key]) return false;
        if (failedContentKeys[c.key]) return false;
        if (findAvailableItem(c.content_type, c.content_id)) return false;
        return true;
      });

    if (missing.length === 0) return;

    const directEndpoints: Partial<Record<ContentType, (id: string) => string>> = {
      sentence: (id) => `/api/v1/admin/content/sentences/${id}`,
      phrase: (id) => `/api/v1/admin/content/phrases/${id}`,
    };

    const results = await Promise.allSettled(
      missing.map(async (c) => {
        const urlBuilder = directEndpoints[c.content_type];
        if (urlBuilder) {
          const response = await apiClient.get(urlBuilder(c.content_id));
          return { key: c.key, item: response.data };
        }
        // Fallback for words/letters/proverbs (and any other types without a GET-by-id endpoint):
        // Use content versions to retrieve the latest content snapshot.
        const snapshot = await fetchContentViaVersions(c.content_type, c.content_id);
        return snapshot ? { key: c.key, item: snapshot } : null;
      })
    );

    const updates: Record<string, any> = {};
    const failed: Record<string, true> = {};
    results.forEach((r, idx) => {
      const key = missing[idx]?.key;
      if (!key) return;

      if (r.status === "fulfilled" && r.value?.key) {
        updates[r.value.key] = r.value.item;
      } else {
        failed[key] = true;
      }
    });
    if (Object.keys(updates).length > 0) {
      setContentDetailsByKey((prev) => ({ ...prev, ...updates }));
    }
    if (Object.keys(failed).length > 0) {
      setFailedContentKeys((prev) => ({ ...prev, ...failed }));
    }
  };

  const loadLessonData = async () => {
    try {
      // Backend defines GET /api/v1/lessons/{lesson_id} (UUID).
      // There is no GET /api/v1/admin/lessons/{lesson_id}.
      const response = await apiClient.get(`/api/v1/lessons/${lessonId}`);

      const apiLesson = response.data;
      setLesson(apiLesson);

      // Derive lesson content from the lesson payload.
      // Backend stores a single content_type + ordered content_ids array.
      const derivedType = getBuilderContentType(apiLesson?.content_type);
      setSelectedContentType(derivedType);
      const derivedContent: LessonContent[] = (apiLesson?.content_ids || []).map((id: string, index: number) => ({
        content_type: derivedType,
        content_id: id,
        order: index + 1,
      }));
      setLessonContent(derivedContent);
      
      setIsLoading(false);
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || "Failed to load lesson");
      setIsLoading(false);
    }
  };

  const loadAvailableContent = async () => {
    if (!lesson?.language_id) return;

    try {
      const endpoints: Record<ContentType, string> = {
        letter: `/api/v1/admin/content/letters?language_id=${lesson.language_id}&page=1&limit=200`,
        word: `/api/v1/admin/content/words?language_id=${lesson.language_id}&page=1&limit=100`,
        sentence: `/api/v1/admin/content/sentences?language_id=${lesson.language_id}&page=1&limit=100`,
        phrase: `/api/v1/admin/content/phrases?language_id=${lesson.language_id}&page=1&limit=100`,
        proverb: `/api/v1/admin/content/proverbs?language_id=${lesson.language_id}&page=1&limit=100`,
      };

      const response = await apiClient.get(endpoints[selectedContentType]);

      const items =
        response.data?.items ||
        response.data?.letters ||
        response.data?.words ||
        response.data?.sentences ||
        response.data?.phrases ||
        response.data?.proverbs ||
        response.data ||
        [];
      setAvailableContent(prev => ({
        ...prev,
        [`${selectedContentType}s`]: Array.isArray(items) ? items : [],
      }));
    } catch (error) {
      console.error("Failed to load content:", error);
    }
  };

  const addContentToLesson = (contentId: string, contentType: ContentType) => {
    const apiContentType = getApiContentType(contentType);
    if (!apiContentType) {
      setErrorMessage("This content type is not supported by the lesson API yet");
      setTimeout(() => setErrorMessage(""), 3000);
      return;
    }

    const lessonApiContentType = getApiContentType(getBuilderContentType((lesson as any)?.content_type));
    if (lessonApiContentType && apiContentType !== lessonApiContentType) {
      setErrorMessage("This lesson only supports its configured content type");
      setTimeout(() => setErrorMessage(""), 3000);
      return;
    }

    // Check if already added
    const exists = lessonContent.some(
      (item) => item.content_id === contentId && item.content_type === contentType
    );
    
    if (exists) {
      toast.info("This content is already in the lesson");
      return;
    }

    const newContent: LessonContent = {
      content_type: contentType,
      content_id: contentId,
      order: lessonContent.length + 1,
    };

    setLessonContent([...lessonContent, newContent]);
  };

  const removeContent = (index: number) => {
    const updated = lessonContent.filter((_, i) => i !== index);
    // Re-order
    updated.forEach((item, i) => {
      item.order = i + 1;
    });
    setLessonContent(updated);
  };

  const moveContent = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= lessonContent.length) return;

    const updated = [...lessonContent];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    
    // Re-order
    updated.forEach((item, i) => {
      item.order = i + 1;
    });
    
    setLessonContent(updated);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage("");

    try {
      const apiContentType = getApiContentType(selectedContentType);
      if (!apiContentType) {
        throw new Error("Unsupported content type");
      }

      await apiClient.put(`/api/v1/admin/lessons/${lessonId}`,
        {
          content_type: apiContentType,
          content_ids: lessonContent
            .filter((item) => item.content_type === selectedContentType)
            .sort((a, b) => a.order - b.order)
            .map((item) => item.content_id),
        }
      );
      
      setSuccessMessage("Lesson content saved successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || "Failed to save lesson content");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!lesson) return;

    try {
      await apiClient.put(`/api/v1/admin/lessons/${lessonId}`, { status: "published" });
      setSuccessMessage("Lesson published successfully");
      router.push("/curriculum/lessons");
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || "Failed to publish lesson");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="Lesson Builder" />
        <div className="flex justify-center items-center h-64">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="Lesson Builder" />
        <Alert variant="error">Lesson not found</Alert>
      </div>
    );
  }

  const filteredContent = availableContent[`${selectedContentType}s` as keyof typeof availableContent].filter(
    (item: any) => {
      if (selectedContentType === "letter") {
        const text = `${item.glyph || ""} ${item.display_name || ""}`.trim();
        return text.toLowerCase().includes(searchQuery.toLowerCase());
      }
      const text = selectedContentType === "word" 
        ? item.word || item.lemma || item.yoruba_word || ""
        : selectedContentType === "proverb"
          ? item.proverb || item.text || item.yoruba_text || ""
          : item.text || item.yoruba_text || "";
      return text.toLowerCase().includes(searchQuery.toLowerCase());
    }
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <PageBreadCrumb pageTitle={`Build: ${lesson.title}`} />
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Add and organize content for this lesson
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push("/curriculum/lessons")}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Progress"}
          </button>
          {lesson.status === "draft" && (
            <button
              onClick={handlePublish}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Publish Lesson
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {successMessage && <Alert variant="success">{successMessage}</Alert>}
      {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Available Content */}
        <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Available Content
            </h3>
          </div>
          
          <div className="p-4 space-y-4">
            {/* Content Type Selector */}
            <div className="flex gap-2">
              {((() => {
                const lessonType = getBuilderContentType((lesson as any)?.content_type);
                // Only show tabs that match the lesson's configured type.
                if (lessonType === "letter") return ["letter"] as ContentType[];
                if (lessonType === "phrase") return ["phrase"] as ContentType[];
                return ["word"] as ContentType[];
              })()).map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedContentType(type)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    selectedContentType === type
                      ? "bg-brand-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}{type === "letter" ? "s" : "s"}
                </button>
              ))}
            </div>

            {/* Search */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${selectedContentType}s...`}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700"
            />

            {/* Content List */}
            <div className="max-h-[500px] overflow-y-auto space-y-2">
              {filteredContent.length > 0 ? (
                filteredContent.map((item: any, idx: number) => (
                  <div
                    key={`${item.id}-${idx}`}
                    className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 cursor-pointer"
                    onClick={() => addContentToLesson(item.id, selectedContentType)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {selectedContentType === "letter"
                            ? item.glyph || item.display_name
                            : selectedContentType === "word"
                              ? item.word || item.lemma || item.yoruba_word
                              : selectedContentType === "proverb"
                                ? item.proverb || item.text || item.yoruba_text
                                : item.text || item.yoruba_text}
                        </p>
                        {(item.translation || item.english_translation) && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {item.translation || item.english_translation}
                          </p>
                        )}
                      </div>
                      <button className="text-brand-600 text-sm hover:text-brand-700">
                        + Add
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 py-8">
                  No {selectedContentType}s found
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Lesson Content */}
        <div className="bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Lesson Content ({lessonContent.length} items)
            </h3>
          </div>
          
          <div className="p-4">
            {lessonContent.length > 0 ? (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {lessonContent.map((item, index) => (
                  <div
                    key={`${item.content_type}-${item.content_id}-${index}`}
                    className="p-3 border border-gray-200 rounded-lg dark:border-gray-700"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-500">
                            #{item.order}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            {item.content_type}
                          </span>
                        </div>
                        {(() => {
                          const key = getContentKey(item.content_type, item.content_id);
                          const canFetchDetails =
                            item.content_type === "sentence" ||
                            item.content_type === "phrase" ||
                            item.content_type === "proverb";
                          const isLoadingDetails = Boolean(
                            canFetchDetails &&
                              !findAvailableItem(item.content_type, item.content_id) &&
                              !contentDetailsByKey[key] &&
                              !failedContentKeys[key]
                          );
                          const resolvedItem =
                            findAvailableItem(item.content_type, item.content_id) ?? contentDetailsByKey[key] ?? null;
                          const primary = getPrimaryText(item.content_type, resolvedItem);
                          const secondary = getSecondaryText(resolvedItem);
                          return (
                            <div className="mt-1">
                              <p className="text-sm text-gray-900 dark:text-white">
                                {primary ?? (isLoadingDetails ? "Loading…" : item.content_id)}
                              </p>
                              {secondary && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {secondary}
                                </p>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => moveContent(index, "up")}
                          disabled={index === 0}
                          className="p-1 text-gray-600 hover:text-gray-900 disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveContent(index, "down")}
                          disabled={index === lessonContent.length - 1}
                          className="p-1 text-gray-600 hover:text-gray-900 disabled:opacity-30"
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => removeContent(index)}
                          className="p-1 text-red-600 hover:text-red-900"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">
                  No content added yet. Start by selecting content from the left panel.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

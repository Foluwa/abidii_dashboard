'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

import Alert from '@/components/ui/alert/SimpleAlert';
import MediaLinkPreview from '@/components/admin/curriculum/MediaLinkPreview';
import { LessonRuntimePreview } from '@/components/admin/curriculum/LessonRuntimePreview';
import ValidationResultViewer from '@/components/admin/curriculum/ValidationResultViewer';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/contexts/ToastContext';
import { apiClient } from '@/lib/api';
import {
  useAdminCourseCurriculumByKey,
  useAdminBlueprintAssetLibrary,
  useAdminBlueprintCapabilities,
  useAdminCoursesList,
  useCurriculumVocabLibrary,
  usePhonicsContrasts,
} from '@/hooks/useApi';
import {
  cloneAdminBlueprint,
  createAdminBlueprint,
  deleteBlueprintAsset,
  previewAdminBlueprintDraft,
  uploadBlueprintAsset,
  updateAdminBlueprint,
} from '@/lib/adminCurriculumApi';
import type {
  CourseAdminListItem,
  CurriculumSection,
  LessonBlueprintAdminResponse,
  LessonBlueprintAssetLibraryItem,
  LessonBlueprintMediaBinding,
  LessonKindCapability,
  LessonBlueprintValidationResponse,
  LessonBlueprintDraftUpsertRequest,
} from '@/types/curriculum';

type Mode = 'create' | 'edit';

type SectionOption = {
  value: string;
  label: string;
  section: CurriculumSection;
  unitKey: string;
};

type PhraseLibraryItem = {
  id: string;
  language_id: string;
  phrase: string;
  translation: string;
  audio_url?: string | null;
  category?: string | null;
  is_published?: boolean;
};

type PhrasePickerTarget =
  | {
      mode: 'readingTarget';
      targetIndex: number;
    }
  | {
      mode: 'readingSupportingContext';
    }
  | {
      mode: 'recognitionTask';
      stepIndex: number;
    }
  | {
      mode: 'recognitionOption';
      stepIndex: number;
      optionIndex: number;
    }
  | {
      mode: 'matchingPairs';
      stepIndex: number;
    }
  | {
      mode: 'matchingPairItem';
      stepIndex: number;
      pairIndex: number;
    };

const lessonLaunchRouteOptions = [
  { value: 'structuredLesson', label: 'Structured lesson' },
  { value: 'alphabetLesson', label: 'Alphabet lesson' },
  { value: 'phonicsLesson', label: 'Phonics lesson' },
  { value: 'numbersLesson', label: 'Numbers lesson' },
];

function extractErrorMessage(error: any): string {
  if (error?.code === 'ECONNABORTED') {
    return 'Request timed out while talking to the backend.';
  }
  return (
    error?.response?.data?.detail ||
    error?.response?.data?.message ||
    error?.message ||
    'Request failed'
  );
}

function formatJson(input: string): string {
  try {
    return JSON.stringify(JSON.parse(input), null, 2);
  } catch {
    return input;
  }
}

function safeParsePayload(input: string): Record<string, unknown> | null {
  try {
    const next = JSON.parse(input);
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      return null;
    }
    return next as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function getBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function getNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is number => typeof item === 'number');
}

function getObjectArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null && !Array.isArray(item)
  );
}

function getObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseTokenList(input: string): string[] {
  return input
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueTokens(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function toTextList(values: string[]): string {
  return values.join('\n');
}

function getVocabDisplayLabel(externalId: string, lemma?: string | null): string {
  const normalizedLemma = lemma?.trim();
  if (normalizedLemma) {
    return normalizedLemma;
  }
  return externalId.replace(/^vocab_/i, '').replace(/[_-]+/g, ' ').trim() || externalId;
}

function buildSourceRef(contentType: string, contentId: string, role = 'source') {
  return {
    contentType,
    contentId,
    role,
  };
}

function getContentRef(value: unknown): Record<string, unknown> | null {
  return getObject(value);
}

function getReadingMediaRefFieldPath(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  const mediaRef = getObject(value);
  return getString(mediaRef?.fieldPath);
}

function getMediaBindings(payload: Record<string, unknown>): Record<string, LessonBlueprintMediaBinding> {
  const raw = payload.mediaBindings;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  return Object.entries(raw).reduce<Record<string, LessonBlueprintMediaBinding>>((acc, [fieldPath, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      acc[fieldPath] = value as LessonBlueprintMediaBinding;
    }
    return acc;
  }, {});
}

function inferAssetKindFromFieldPath(fieldPath: string): 'image' | 'audio' | 'video' {
  const normalized = fieldPath.toLowerCase();
  if (normalized.includes('audio')) return 'audio';
  if (normalized.includes('video')) return 'video';
  return 'image';
}

function normalizeAssetKind(kind?: string | null, fieldPath?: string): 'image' | 'audio' | 'video' {
  if (kind === 'audio' || kind === 'video' || kind === 'image') {
    return kind;
  }
  return inferAssetKindFromFieldPath(fieldPath || '');
}

function getStepRuntimeType(step: Record<string, unknown>): string {
  return getString(step.type) || getString(step.runtimeType);
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function getStepValidationCounts(validation: import('@/types/curriculum').ValidationResultPayload | null | undefined) {
  const errorsByStep = new Map<number, { errors: number; warnings: number }>();
  const allIssues = [...(validation?.errors ?? []), ...(validation?.warnings ?? [])];
  allIssues.forEach((issue) => {
    const match = (issue.path || '').match(/^steps\[(\d+)\]/);
    if (match) {
      const stepIndex = Number(match[1]);
      const existing = errorsByStep.get(stepIndex) || { errors: 0, warnings: 0 };
      if (issue.severity === 'ERROR') {
        existing.errors += 1;
      } else {
        existing.warnings += 1;
      }
      errorsByStep.set(stepIndex, existing);
    }
  });
  return errorsByStep;
}

function isMediaBindingCompatible(binding: LessonBlueprintMediaBinding, targetFieldPath: string): boolean {
  const targetKind = inferAssetKindFromFieldPath(targetFieldPath);
  return (binding.asset_kind || inferAssetKindFromFieldPath(binding.field_path || targetFieldPath)) === targetKind;
}

function setPayloadFieldValue(payload: Record<string, unknown>, fieldPath: string, value: unknown) {
  const next = JSON.parse(JSON.stringify(payload || {})) as Record<string, unknown>;
  const nestedMatch = fieldPath.match(
    /^steps\[(\d+)\]\.(options|pairs)\[(\d+)\]\.([A-Za-z_][A-Za-z0-9_]*)$/
  );
  if (nestedMatch) {
    const [, rawStepIndex, collectionName, rawItemIndex, fieldName] = nestedMatch;
    const steps = getObjectArray(next.steps);
    const stepIndex = Number(rawStepIndex);
    const itemIndex = Number(rawItemIndex);
    const step = { ...(steps[stepIndex] ?? {}) };
    const items = getObjectArray(step[collectionName]);
    items[itemIndex] = {
      ...(items[itemIndex] ?? {}),
      [fieldName]: value,
    };
    step[collectionName] = items;
    steps[stepIndex] = step;
    next.steps = steps;
    return next;
  }

  const stepMatch = fieldPath.match(/^steps\[(\d+)\]\.([A-Za-z_][A-Za-z0-9_]*)$/);
  if (stepMatch) {
    const [, rawIndex, fieldName] = stepMatch;
    const steps = getObjectArray(next.steps);
    const index = Number(rawIndex);
    if (!steps[index]) {
      steps[index] = {};
    }
    steps[index] = {
      ...steps[index],
      [fieldName]: value,
    };
    next.steps = steps;
    return next;
  }

  next[fieldPath] = value;
  return next;
}

function removePayloadFieldValue(payload: Record<string, unknown>, fieldPath: string) {
  const next = JSON.parse(JSON.stringify(payload || {})) as Record<string, unknown>;
  const nestedMatch = fieldPath.match(
    /^steps\[(\d+)\]\.(options|pairs)\[(\d+)\]\.([A-Za-z_][A-Za-z0-9_]*)$/
  );
  if (nestedMatch) {
    const [, rawStepIndex, collectionName, rawItemIndex, fieldName] = nestedMatch;
    const steps = getObjectArray(next.steps);
    const stepIndex = Number(rawStepIndex);
    const itemIndex = Number(rawItemIndex);
    const step = { ...(steps[stepIndex] ?? {}) };
    const items = getObjectArray(step[collectionName]);
    const item = { ...(items[itemIndex] ?? {}) };
    delete item[fieldName];
    items[itemIndex] = item;
    step[collectionName] = items;
    steps[stepIndex] = step;
    next.steps = steps;
  } else {
    const stepMatch = fieldPath.match(/^steps\[(\d+)\]\.([A-Za-z_][A-Za-z0-9_]*)$/);
    if (stepMatch) {
      const [, rawStepIndex, fieldName] = stepMatch;
      const steps = getObjectArray(next.steps);
      const stepIndex = Number(rawStepIndex);
      const step = { ...(steps[stepIndex] ?? {}) };
      delete step[fieldName];
      steps[stepIndex] = step;
      next.steps = steps;
    } else {
      delete next[fieldPath];
    }
  }

  const mediaBindings = getMediaBindings(next);
  if (mediaBindings[fieldPath]) {
    const nextBindings = { ...mediaBindings };
    delete nextBindings[fieldPath];
    next.mediaBindings = nextBindings;
  }
  return next;
}

function getStarterSteps(lessonKind: string): Record<string, unknown>[] | null {
  switch (lessonKind) {
    case 'reading_practice':
      return [
        { type: 'guessMeaning', title: 'Meaning check', prompt: 'Pick the best meaning' },
        { type: 'matchingPairs', title: 'Match vocab', prompt: 'Match the words and meanings' },
        { type: 'wordBuilder', title: 'Build the word', prompt: 'Assemble the target word' },
        { type: 'dialogueContext', title: 'Read in context', prompt: 'Read the short dialogue' },
        { type: 'listeningTiles', title: 'Tap what you hear', prompt: 'Listen and tap the phrase' },
        { type: 'recognitionTask', title: 'Recognition check', prompt: 'Select the correct answer' },
      ];
    case 'greetings_core':
      return [
        { type: 'lessonStart', title: 'Greeting intro', prompt: 'Introduce the core greeting' },
        { type: 'matchingPairs', title: 'Match greeting pairs', prompt: 'Match greeting to meaning' },
        { type: 'listeningTiles', title: 'Hear the greeting', prompt: 'Tap the greeting you hear' },
        { type: 'recognitionTask', title: 'Use the greeting', prompt: 'Choose the right greeting for the context' },
      ];
    case 'tone_marks_drill':
      return [
        { type: 'lessonStart', title: 'Contrast intro', prompt: 'Introduce the tone contrast' },
        { type: 'listeningTiles', title: 'Tone listening', prompt: 'Tap the tone you hear' },
        { type: 'conceptCheck', title: 'Contrast check', prompt: 'Identify the correct tone mark' },
      ];
    case 'numbers_1_10':
      return [
        { type: 'lessonStart', title: 'Count intro', prompt: 'Introduce the target number range' },
        { type: 'recognitionTask', title: 'Recognize the number', prompt: 'Select the number you hear' },
        { type: 'conceptCheck', title: 'Count check', prompt: 'Confirm the quantity' },
        { type: 'matchingPairs', title: 'Match quantity and form', prompt: 'Match the numeral to the phrase' },
      ];
    case 'alphabet_drill':
      return [
        { type: 'lessonStart', title: 'Letter intro', prompt: 'Introduce the letter focus' },
        { type: 'listeningTiles', title: 'Hear the letter', prompt: 'Tap the letter sound you hear' },
        { type: 'recognitionTask', title: 'Recognize the letter', prompt: 'Pick the correct letter' },
      ];
    default:
      return null;
  }
}

function getStepTypeOptions(lessonKind: string): Array<{ value: string; label: string }> {
  const common = [
    { value: 'lessonStart', label: 'Lesson Start' },
    { value: 'recognitionTask', label: 'Recognition Task' },
    { value: 'listeningTiles', label: 'Listening Tiles' },
    { value: 'matchingPairs', label: 'Matching Pairs' },
    { value: 'conceptCheck', label: 'Concept Check' },
    { value: 'cultureTip', label: 'Culture Tip' },
  ];

  switch (lessonKind) {
    case 'reading_practice':
      return [
        { value: 'guessMeaning', label: 'Guess Meaning' },
        { value: 'matchingPairs', label: 'Matching Pairs' },
        { value: 'wordBuilder', label: 'Word Builder' },
        { value: 'dialogueContext', label: 'Dialogue Context' },
        { value: 'listeningTiles', label: 'Listening Tiles' },
        { value: 'recognitionTask', label: 'Recognition Task' },
      ];
    case 'tone_marks_drill':
      return [
        { value: 'lessonStart', label: 'Lesson Start' },
        { value: 'listeningTiles', label: 'Listening Tiles' },
        { value: 'conceptCheck', label: 'Concept Check' },
        { value: 'matchingPairs', label: 'Matching Pairs' },
        { value: 'cultureTip', label: 'Culture Tip' },
      ];
    case 'numbers_1_10':
      return [
        { value: 'lessonStart', label: 'Lesson Start' },
        { value: 'recognitionTask', label: 'Recognition Task' },
        { value: 'listeningTiles', label: 'Listening Tiles' },
        { value: 'conceptCheck', label: 'Concept Check' },
        { value: 'matchingPairs', label: 'Matching Pairs' },
        { value: 'cultureTip', label: 'Culture Tip' },
      ];
    case 'alphabet_drill':
      return [
        { value: 'lessonStart', label: 'Lesson Start' },
        { value: 'listeningTiles', label: 'Listening Tiles' },
        { value: 'recognitionTask', label: 'Recognition Task' },
        { value: 'matchingPairs', label: 'Matching Pairs' },
      ];
    case 'greetings_core':
      return [
        { value: 'lessonStart', label: 'Lesson Start' },
        { value: 'matchingPairs', label: 'Matching Pairs' },
        { value: 'listeningTiles', label: 'Listening Tiles' },
        { value: 'recognitionTask', label: 'Recognition Task' },
      ];
    default:
      return common;
  }
}

function normalizeValidationPath(path: string | null | undefined): string {
  return (path || '').trim().replace(/^\$\./, '');
}

function buildValidationSelector(path: string): string {
  return `[data-field-path="${path.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
}

function getFieldPathAttributes(path: string): Record<string, string> {
  return {
    'data-field-path': normalizeValidationPath(path),
  };
}

function getValidationPathCandidates(path: string): string[] {
  const candidates: string[] = [];
  let current = normalizeValidationPath(path);

  while (current) {
    candidates.push(current);
    const next = current.replace(/(\[[0-9]+\]|\.[^.\[]+)$/, '');
    if (next === current) break;
    current = next;
  }

  return candidates;
}

function fieldIdForValidationPath(path: string | null | undefined): string | null {
  const normalized = normalizeValidationPath(path);
  if (!normalized) return null;

  const directMap: Record<string, string> = {
    id: 'payload-lesson-id',
    title: 'payload-title',
    subtitle: 'payload-subtitle',
    description: 'payload-description',
    learningObjectives: 'payload-learning-objectives',
    thumbnailUrl: 'payload-thumbnail-url',
    mode: 'payload-mode',
    flowMode: 'payload-flow-mode',
    contrast_id: 'payload-contrast-id',
    unitLabel: 'payload-unit-label',
    heroImageUrl: 'payload-hero-image-url',
    coverImageUrl: 'payload-cover-image-url',
    imageUrl: 'payload-image-url',
    audioUrl: 'payload-audio-url',
    range: 'payload-range-start',
  };

  return directMap[normalized] || null;
}

function slugifyIdentifierPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'item';
}

function buildManagedBlueprintKey(args: {
  courseKey?: string | null;
  unitKey?: string | null;
  sectionKey?: string | null;
}): string {
  const parts = [
    slugifyIdentifierPart(args.courseKey || 'course'),
    slugifyIdentifierPart(args.unitKey || 'unit'),
    slugifyIdentifierPart(args.sectionKey || 'section'),
  ];
  const key = `lesson_${parts.join('_')}`;
  return key.slice(0, 120).replace(/_+$/g, '') || 'lesson_item';
}

function buildCompactReadingPayload(sourcePayload: Record<string, unknown>, fallbackLessonKey: string) {
  const next = { ...sourcePayload };
  const presentation = { ...(getObject(sourcePayload.presentation) ?? {}) };

  const topLevelPresentationMap: Array<[string, unknown]> = [
    ['title', getString(sourcePayload.title)],
    ['subtitle', getString(sourcePayload.subtitle)],
    ['unitLabel', getString(sourcePayload.unitLabel)],
    ['levelTag', getString(sourcePayload.levelTag)],
    ['estimatedMinutes', typeof sourcePayload.estimatedMinutes === 'number' ? sourcePayload.estimatedMinutes : null],
    [
      'exerciseOrderVersion',
      typeof sourcePayload.exerciseOrderVersion === 'number' ? sourcePayload.exerciseOrderVersion : null,
    ],
    ['learningObjectives', getStringArray(sourcePayload.learningObjectives)],
  ];

  for (const [field, value] of topLevelPresentationMap) {
    if (
      value === null ||
      value === undefined ||
      (typeof value === 'string' && !value.trim()) ||
      (Array.isArray(value) && value.length === 0)
    ) {
      continue;
    }
    presentation[field] = value;
  }

  next.kind = 'reading_practice';
  next.version = 1;
  next.lessonKey = getString(next.lessonKey) || getString(next.id) || fallbackLessonKey;
  next.presentation = presentation;
  next.targets = getObjectArray(sourcePayload.targets);

  const supportingContext = getObject(sourcePayload.supportingContext);
  if (supportingContext) {
    next.supportingContext = supportingContext;
  } else {
    delete next.supportingContext;
  }

  const mediaRefs = getObject(sourcePayload.mediaRefs);
  if (mediaRefs) {
    next.mediaRefs = mediaRefs;
  } else {
    delete next.mediaRefs;
  }

  delete next.targetVocabIds;
  delete next.steps;
  delete next.dialogueContext;
  delete next.flowMode;
  delete next.exerciseOrderVersion;
  delete next.heroImageUrl;
  delete next.coverImageUrl;
  delete next.thumbnailUrl;
  delete next.imageUrl;
  delete next.characterImageUrl;

  return next;
}

export function LessonBlueprintEditor({
  mode,
  blueprint,
  onSaved,
  onPreviewResultChange,
  initialCourseKey,
  initialSectionId,
  initialBlueprintKey,
  focusFieldPath,
  showPreviewResult = true,
  validation,
}: {
  mode: Mode;
  blueprint?: LessonBlueprintAdminResponse | null;
  onSaved?: (result: LessonBlueprintValidationResponse) => void;
  onPreviewResultChange?: (result: LessonBlueprintValidationResponse | null) => void;
  initialCourseKey?: string | null;
  initialSectionId?: string | null;
  initialBlueprintKey?: string | null;
  focusFieldPath?: string | null;
  showPreviewResult?: boolean;
  validation?: import('@/types/curriculum').ValidationResultPayload | null;
}) {
  const toast = useToast();

  const { data: coursesData } = useAdminCoursesList({ limit: 200 });
  const courses = useMemo(() => coursesData?.items ?? [], [coursesData]);
  const { data: capabilitiesData, isError: capabilitiesError } = useAdminBlueprintCapabilities();

  const [selectedCourseKey, setSelectedCourseKey] = useState('');
  const [form, setForm] = useState<LessonBlueprintDraftUpsertRequest>({
    blueprint_key: '',
    course_id: '',
    section_id: '',
    lesson_kind: 'structured_micro_lesson',
    schema_version: 1,
    payload: {},
  });
  const [payloadText, setPayloadText] = useState('{}');
  const [lastValidPayload, setLastValidPayload] = useState<Record<string, unknown>>({});
  const [previewResult, setPreviewResult] = useState<LessonBlueprintValidationResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [uploadingFieldPath, setUploadingFieldPath] = useState<string | null>(null);
  const [uploadProgressByField, setUploadProgressByField] = useState<Record<string, number>>({});
  const [generatingAudioFieldPath, setGeneratingAudioFieldPath] = useState<string | null>(null);
  const [assetLibraryTargetFieldPath, setAssetLibraryTargetFieldPath] = useState<string | null>(null);
  const [isAssetLibraryModalOpen, setIsAssetLibraryModalOpen] = useState(false);
  const [isAssetDropActive, setIsAssetDropActive] = useState(false);
  const [globalAssetSearch, setGlobalAssetSearch] = useState('');
  const [assetLibraryScope, setAssetLibraryScope] = useState<'same_course' | 'all_courses'>('same_course');
  const [assetLibrarySort, setAssetLibrarySort] = useState<'recent' | 'name' | 'source'>('recent');
  const [assetLibraryKindFilter, setAssetLibraryKindFilter] = useState<'all' | 'image' | 'audio' | 'video'>('all');
  const [assetLibraryCompatibilityFilter, setAssetLibraryCompatibilityFilter] = useState<'all' | 'compatible'>('all');
  const [assetLibraryTab, setAssetLibraryTab] = useState<'local' | 'global'>('local');
  const [vocabSearch, setVocabSearch] = useState('');
  const [toneContrastSearch, setToneContrastSearch] = useState('');
  const [phrasePickerTarget, setPhrasePickerTarget] = useState<PhrasePickerTarget | null>(null);
  const [phraseSearch, setPhraseSearch] = useState('');
  const [phraseItems, setPhraseItems] = useState<PhraseLibraryItem[]>([]);
  const [isPhraseLoading, setIsPhraseLoading] = useState(false);
  const [phraseError, setPhraseError] = useState('');
  const hasAppliedInitialSectionRef = useRef(false);
  const hasAppliedInitialBlueprintKeyRef = useRef(false);
  const activeUploadTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (mode === 'edit' && blueprint) {
      setSelectedCourseKey(blueprint.course_key || '');
      setForm({
        blueprint_key: blueprint.blueprint_key,
        course_id: blueprint.course_id,
        section_id: blueprint.section_id,
        lesson_kind: blueprint.lesson_kind,
        schema_version: blueprint.schema_version,
        payload: blueprint.payload,
      });
      setPayloadText(JSON.stringify(blueprint.payload, null, 2));
      setLastValidPayload(blueprint.payload);
      setPreviewResult(null);
      return;
    }

    if (mode === 'create' && !selectedCourseKey && initialCourseKey) {
      setSelectedCourseKey(initialCourseKey);
      return;
    }

    if (mode === 'create' && !selectedCourseKey && courses.length > 0) {
      const firstCourse = courses[0];
      setSelectedCourseKey(firstCourse.course_key);
      setForm((prev) => ({
        ...prev,
        course_id: firstCourse.id,
      }));
      setLastValidPayload({});
    }
  }, [blueprint, courses, initialCourseKey, mode, selectedCourseKey]);

  useEffect(() => {
    if (mode !== 'create') return;
    if (!capabilitiesData?.lesson_kinds?.length) return;

    const knownKind = capabilitiesData.lesson_kinds.some((item) => item.key === form.lesson_kind);
    if (!knownKind) {
      setForm((prev) => ({
        ...prev,
        lesson_kind: capabilitiesData.lesson_kinds[0].key,
      }));
    }
  }, [capabilitiesData, form.lesson_kind, mode]);

  const selectedCourse = useMemo<CourseAdminListItem | null>(() => {
    return courses.find((course) => course.course_key === selectedCourseKey) ?? null;
  }, [courses, selectedCourseKey]);

  useEffect(() => {
    if (!phrasePickerTarget || !selectedCourse?.target_language_id) {
      setPhraseItems([]);
      setPhraseError('');
      setIsPhraseLoading(false);
      return;
    }

    let cancelled = false;
    const fetchPhrases = async () => {
      setIsPhraseLoading(true);
      setPhraseError('');
      try {
        const response = await apiClient.get('/api/v1/admin/content/phrases', {
          params: {
            language_id: selectedCourse.target_language_id,
            search: phraseSearch.trim() || undefined,
            page: 1,
            page_size: 25,
          },
        });
        if (cancelled) return;
        setPhraseItems((response.data?.items ?? []) as PhraseLibraryItem[]);
      } catch (error: any) {
        if (cancelled) return;
        setPhraseError(extractErrorMessage(error));
        setPhraseItems([]);
      } finally {
        if (!cancelled) {
          setIsPhraseLoading(false);
        }
      }
    };

    void fetchPhrases();
    return () => {
      cancelled = true;
    };
  }, [phrasePickerTarget, phraseSearch, selectedCourse?.target_language_id]);

  const lessonKindOptions = useMemo(
    () =>
      (capabilitiesData?.lesson_kinds ?? []).map((lessonKind) => ({
        value: lessonKind.key,
        label: lessonKind.label,
      })),
    [capabilitiesData]
  );

  const selectedLessonCapability = useMemo<LessonKindCapability | null>(() => {
    return capabilitiesData?.lesson_kinds.find((lessonKind) => lessonKind.key === form.lesson_kind) ?? null;
  }, [capabilitiesData, form.lesson_kind]);

  const {
    curriculum,
    isLoading: isCurriculumLoading,
  } = useAdminCourseCurriculumByKey(selectedCourseKey || null);
  const {
    items: globalAssetLibraryItems,
    isLoading: isGlobalAssetLibraryLoading,
  } = useAdminBlueprintAssetLibrary({
    page: 1,
    limit: 12,
    course_id: assetLibraryScope === 'same_course' ? selectedCourse?.id ?? undefined : undefined,
    asset_kind: assetLibraryTargetFieldPath ? inferAssetKindFromFieldPath(assetLibraryTargetFieldPath) : undefined,
    search: globalAssetSearch.trim() || undefined,
  });
  const {
    items: vocabLibraryItems,
    isLoading: isVocabLibraryLoading,
  } = useCurriculumVocabLibrary({
    language_id: selectedCourse?.target_language_id ?? undefined,
    page: 1,
    limit: 10,
    search: vocabSearch.trim() || undefined,
  });
  const selectedVocabIds = getStringArray(form.payload?.targetVocabIds);
  const { items: selectedVocabItems } = useCurriculumVocabLibrary({
    language_id: selectedCourse?.target_language_id ?? undefined,
    external_ids: selectedVocabIds,
    page: 1,
    limit: Math.max(selectedVocabIds.length, 10),
  });
  const selectedVocabLabels = useMemo(() => {
    return selectedVocabItems.reduce<Record<string, string>>((acc, item) => {
      acc[item.external_id] = getVocabDisplayLabel(item.external_id, item.lemma);
      return acc;
    }, {});
  }, [selectedVocabItems]);
  const {
    contrasts: toneContrastItems,
    isLoading: isToneContrastsLoading,
  } = usePhonicsContrasts(selectedCourse?.target_language_code ?? null);

  const sectionOptions = useMemo<SectionOption[]>(() => {
    if (!curriculum) return [];
    return curriculum.units.flatMap((unit) =>
      unit.sections.map((section) => ({
        value: section.id,
        label: `${unit.title} / ${section.title} (${section.section_key})`,
        section,
        unitKey: unit.unit_key,
      }))
    );
  }, [curriculum]);

  const selectedSectionOption = useMemo<SectionOption | null>(() => {
    return sectionOptions.find((option) => option.value === form.section_id) ?? null;
  }, [form.section_id, sectionOptions]);

  const managedBlueprintKey = useMemo(() => {
    if (mode === 'edit' && blueprint?.blueprint_key) {
      return blueprint.blueprint_key;
    }

    return buildManagedBlueprintKey({
      courseKey: selectedCourse?.course_key || selectedCourseKey,
      unitKey: selectedSectionOption?.unitKey,
      sectionKey: selectedSectionOption?.section.section_key,
    });
  }, [
    blueprint?.blueprint_key,
    mode,
    selectedCourse?.course_key,
    selectedCourseKey,
    selectedSectionOption?.section.section_key,
    selectedSectionOption?.unitKey,
  ]);

  useEffect(() => {
    if (!selectedCourse) return;

    setForm((prev) => {
      const next = { ...prev, course_id: selectedCourse.id };
      const initialSectionStillValid =
        !!initialSectionId && sectionOptions.some((option) => option.value === initialSectionId);
      const currentSectionStillValid = sectionOptions.some((option) => option.value === prev.section_id);

      if (initialSectionStillValid && !hasAppliedInitialSectionRef.current) {
        next.section_id = initialSectionId!;
        hasAppliedInitialSectionRef.current = true;
      } else if (currentSectionStillValid) {
        next.section_id = prev.section_id;
      } else if (sectionOptions.length > 0) {
        next.section_id = sectionOptions[0].value;
      }
      return next;
    });
  }, [initialSectionId, sectionOptions, selectedCourse]);

  useEffect(() => {
    if (mode !== 'create') return;
    if (!initialBlueprintKey) return;
    if (hasAppliedInitialBlueprintKeyRef.current) return;

    setForm((prev) => {
      if (prev.blueprint_key?.trim()) return prev;
      hasAppliedInitialBlueprintKeyRef.current = true;
      return {
        ...prev,
        blueprint_key: initialBlueprintKey,
      };
    });
  }, [initialBlueprintKey, mode]);

  useEffect(() => {
    if (mode !== 'create') return;
    if (!managedBlueprintKey) return;

    setForm((prev) => {
      if (prev.blueprint_key === managedBlueprintKey) return prev;
      return {
        ...prev,
        blueprint_key: managedBlueprintKey,
      };
    });
  }, [managedBlueprintKey, mode]);

  useEffect(() => {
    if (mode !== 'create') return;
    if (!selectedLessonCapability) return;

    const trimmedPayload = payloadText.trim();
    if (trimmedPayload !== '' && trimmedPayload !== '{}') return;

    setPayloadText(JSON.stringify(selectedLessonCapability.default_payload ?? {}, null, 2));
    setLastValidPayload(selectedLessonCapability.default_payload ?? {});
    setForm((prev) => ({
      ...prev,
      payload: selectedLessonCapability.default_payload ?? {},
    }));
  }, [mode, payloadText, selectedLessonCapability]);

  useEffect(() => {
    const normalizedPath = normalizeValidationPath(focusFieldPath);
    if (!normalizedPath) return;

    const targetId = fieldIdForValidationPath(normalizedPath);
    const element =
      getValidationPathCandidates(normalizedPath)
        .map((candidate) => document.querySelector(buildValidationSelector(candidate)) as HTMLElement | null)
        .find(Boolean) ||
      (targetId ? (document.getElementById(targetId) as HTMLElement | null) : null);
    if (!element) return;

    let parent = element.parentElement;
    while (parent) {
      if (parent.tagName === 'DETAILS') {
        (parent as HTMLDetailsElement).open = true;
      }
      parent = parent.parentElement;
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (typeof element.focus === 'function') {
      element.focus({ preventScroll: true });
    }

    element.classList.add('ring-2', 'ring-brand-500', 'ring-offset-2', 'dark:ring-offset-gray-900');
    const timeout = window.setTimeout(() => {
      element.classList.remove('ring-2', 'ring-brand-500', 'ring-offset-2', 'dark:ring-offset-gray-900');
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [focusFieldPath, form.lesson_kind, payloadText]);

  const parsePayload = (): Record<string, unknown> | null => {
    try {
      const next = JSON.parse(payloadText);
      if (!next || typeof next !== 'object' || Array.isArray(next)) {
        setErrorMessage('Payload must be a JSON object.');
        return null;
      }
      setErrorMessage('');
      return next as Record<string, unknown>;
    } catch (error: any) {
      setErrorMessage(`Payload JSON is invalid: ${error.message}`);
      return null;
    }
  };

  const editablePayload = useMemo(
    () => safeParsePayload(payloadText) ?? lastValidPayload,
    [lastValidPayload, payloadText]
  );
  const rawPayloadInvalid = safeParsePayload(payloadText) === null;
  const editableSteps = useMemo(() => getObjectArray(editablePayload.steps), [editablePayload]);
  const stepValidationCounts = useMemo(() => getStepValidationCounts(validation), [validation]);
  const mediaBindings = useMemo(() => getMediaBindings(editablePayload), [editablePayload]);
  const mediaFieldOptions = useMemo(() => {
    const topLevel = [
      { value: 'thumbnailUrl', label: 'Thumbnail image' },
      { value: 'heroImageUrl', label: 'Hero image' },
      { value: 'coverImageUrl', label: 'Cover image' },
      { value: 'characterImageUrl', label: 'Character image' },
      { value: 'imageUrl', label: 'Image' },
      { value: 'audioUrl', label: 'Audio' },
    ];
    const stepLevel = editableSteps.flatMap((step, index) => {
      const stepType = getStepRuntimeType(step);
      const optionFields =
        stepType === 'recognitionTask'
          ? getObjectArray(step.options).map((option, optionIndex) => ({
              value: `steps[${index}].options[${optionIndex}].imageUrl`,
              label: `Step ${index + 1} option ${optionIndex + 1} image`,
            }))
          : [];
      const pairFields =
        stepType === 'matchingPairs'
          ? getObjectArray(step.pairs).flatMap((pair, pairIndex) => [
              {
                value: `steps[${index}].pairs[${pairIndex}].imageUrl`,
                label: `Step ${index + 1} pair ${pairIndex + 1} image`,
              },
              {
                value: `steps[${index}].pairs[${pairIndex}].audioUrl`,
                label: `Step ${index + 1} pair ${pairIndex + 1} audio`,
              },
            ])
          : [];
      return [
        { value: `steps[${index}].imageUrl`, label: `Step ${index + 1} image` },
        { value: `steps[${index}].audioUrl`, label: `Step ${index + 1} audio` },
        ...optionFields,
        ...pairFields,
      ];
    });
    return [...topLevel, ...stepLevel];
  }, [editableSteps]);
  const compatibleLibraryAssets = useMemo(() => {
    if (!assetLibraryTargetFieldPath) return [];
    return Object.entries(mediaBindings).filter(([, binding]) =>
      isMediaBindingCompatible(binding, assetLibraryTargetFieldPath)
    );
  }, [assetLibraryTargetFieldPath, mediaBindings]);
  const selectedAssetLibraryField = useMemo(() => {
    return mediaFieldOptions.find((option) => option.value === assetLibraryTargetFieldPath) ?? null;
  }, [assetLibraryTargetFieldPath, mediaFieldOptions]);
  const assetMatchesFilters = useMemo(
    () =>
      (assetKind: string | null | undefined, fieldPath: string, isCompatible: boolean) => {
        const resolvedKind = normalizeAssetKind(assetKind, fieldPath);
        if (assetLibraryKindFilter !== 'all' && resolvedKind !== assetLibraryKindFilter) {
          return false;
        }
        if (assetLibraryCompatibilityFilter === 'compatible' && !isCompatible) {
          return false;
        }
        return true;
      },
    [assetLibraryCompatibilityFilter, assetLibraryKindFilter]
  );
  const filteredBlueprintLibraryAssets = useMemo(() => {
    const query = globalAssetSearch.trim().toLowerCase();
    const items = Object.entries(mediaBindings).filter(([fieldPath, binding]) => {
      const isCompatible = assetLibraryTargetFieldPath
        ? isMediaBindingCompatible(binding, assetLibraryTargetFieldPath)
        : false;
      if (!assetMatchesFilters(binding.asset_kind, fieldPath, isCompatible)) {
        return false;
      }
      if (!query) return true;
      const haystack = [fieldPath, binding.file_name, binding.asset_kind, binding.storage_key]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });

    return items.sort(([leftFieldPath, leftBinding], [rightFieldPath, rightBinding]) => {
      if (assetLibrarySort === 'name') {
        return (leftBinding.file_name || leftFieldPath).localeCompare(rightBinding.file_name || rightFieldPath);
      }
      if (assetLibrarySort === 'source') {
        return leftFieldPath.localeCompare(rightFieldPath);
      }
      return (rightBinding.uploaded_at || '').localeCompare(leftBinding.uploaded_at || '');
    });
  }, [assetLibrarySort, assetLibraryTargetFieldPath, assetMatchesFilters, globalAssetSearch, mediaBindings]);
  const sortedGlobalAssetLibraryItems = useMemo(() => {
    return [...globalAssetLibraryItems]
      .filter((item) => {
        const isCompatible = assetLibraryTargetFieldPath
          ? isMediaBindingCompatible(item.binding, assetLibraryTargetFieldPath)
          : false;
        return assetMatchesFilters(item.binding.asset_kind, item.field_path, isCompatible);
      })
      .sort((left, right) => {
      if (assetLibrarySort === 'name') {
        return (left.binding.file_name || left.field_path).localeCompare(right.binding.file_name || right.field_path);
      }
      if (assetLibrarySort === 'source') {
        return `${left.blueprint_key}:${left.field_path}`.localeCompare(`${right.blueprint_key}:${right.field_path}`);
      }
      return (right.binding.uploaded_at || '').localeCompare(left.binding.uploaded_at || '');
      });
  }, [assetLibrarySort, assetLibraryTargetFieldPath, assetMatchesFilters, globalAssetLibraryItems]);
  const filteredToneContrasts = useMemo(() => {
    const query = toneContrastSearch.trim().toLowerCase();
    const items = Array.isArray(toneContrastItems) ? toneContrastItems : [];
    if (!query) return items.slice(0, 10);
    return items
      .filter((item) => {
        const title = getString((item as Record<string, unknown>).title).toLowerCase();
        const left = getString((item as Record<string, unknown>).letter_a_glyph).toLowerCase();
        const right = getString((item as Record<string, unknown>).letter_b_glyph).toLowerCase();
        const id = getString((item as Record<string, unknown>).id).toLowerCase();
        return title.includes(query) || left.includes(query) || right.includes(query) || id.includes(query);
      })
      .slice(0, 10);
  }, [toneContrastItems, toneContrastSearch]);
  const starterSteps = useMemo(() => getStarterSteps(form.lesson_kind), [form.lesson_kind]);
  const hasCompactReadingPayload = useMemo(() => {
    if (form.lesson_kind !== 'reading_practice') return false;
    return (
      getString(editablePayload.kind) === 'reading_practice' ||
      Array.isArray(editablePayload.targets) ||
      Boolean(getObject(editablePayload.presentation)) ||
      Boolean(getObject(editablePayload.supportingContext)) ||
      Boolean(getObject(editablePayload.mediaRefs))
    );
  }, [editablePayload, form.lesson_kind]);
  const hasLegacyReadingPayload = useMemo(() => {
    if (form.lesson_kind !== 'reading_practice') return false;
    return (
      getStringArray(editablePayload.targetVocabIds).length > 0 ||
      getObjectArray(editablePayload.steps).length > 0 ||
      Boolean(getObject(editablePayload.dialogueContext)) ||
      Boolean(getString(editablePayload.flowMode)) ||
      Boolean(getString(editablePayload.heroImageUrl)) ||
      Boolean(getString(editablePayload.coverImageUrl)) ||
      Boolean(getString(editablePayload.thumbnailUrl)) ||
      Boolean(getString(editablePayload.imageUrl)) ||
      Boolean(getString(editablePayload.characterImageUrl))
    );
  }, [editablePayload, form.lesson_kind]);
  const readingPresentation = useMemo(() => getObject(editablePayload.presentation) ?? {}, [editablePayload]);
  const readingTargets = useMemo(() => getObjectArray(editablePayload.targets), [editablePayload]);
  const readingSupportingContext = useMemo(
    () => getObject(editablePayload.supportingContext) ?? {},
    [editablePayload]
  );
  const readingMediaRefs = useMemo(() => getObject(editablePayload.mediaRefs) ?? {}, [editablePayload]);
  const stepTypeOptions = useMemo(() => getStepTypeOptions(form.lesson_kind), [form.lesson_kind]);
  const canUploadAssets = mode === 'edit' && Boolean(blueprint?.id);

  useEffect(() => {
    if (mediaFieldOptions.length === 0) return;
    if (
      assetLibraryTargetFieldPath &&
      mediaFieldOptions.some((option) => option.value === assetLibraryTargetFieldPath)
    ) {
      return;
    }
    setAssetLibraryTargetFieldPath(mediaFieldOptions[0].value);
  }, [assetLibraryTargetFieldPath, mediaFieldOptions]);

  useEffect(() => {
    if (mode !== 'create') return;
    if (!form.blueprint_key?.trim()) return;
    if (getString(editablePayload.id) === form.blueprint_key?.trim()) return;

    const nextPayload = {
      ...editablePayload,
      id: form.blueprint_key?.trim(),
    };
    setLastValidPayload(nextPayload);
    setPayloadText(JSON.stringify(nextPayload, null, 2));
    setForm((prev) => ({
      ...prev,
      payload: nextPayload,
    }));
    setErrorMessage('');
  }, [editablePayload, form.blueprint_key, mode]);

  useEffect(() => {
    if (form.lesson_kind !== 'reading_practice') return;
    if (rawPayloadInvalid) return;
    if (hasCompactReadingPayload && !hasLegacyReadingPayload) return;

    const fallbackLessonKey =
      form.blueprint_key?.trim() || managedBlueprintKey || getString(editablePayload.id) || 'lesson_reading_practice_01';
    const normalizedPayload = buildCompactReadingPayload(editablePayload, fallbackLessonKey);
    replacePayload(normalizedPayload);
  }, [
    editablePayload,
    form.blueprint_key,
    form.lesson_kind,
    hasCompactReadingPayload,
    hasLegacyReadingPayload,
    managedBlueprintKey,
    rawPayloadInvalid,
  ]);

  const replacePayload = (nextPayload: Record<string, unknown>) => {
    setLastValidPayload(nextPayload);
    setPayloadText(JSON.stringify(nextPayload, null, 2));
    setForm((prev) => ({
      ...prev,
      payload: nextPayload,
    }));
    setErrorMessage('');
  };

  const updatePayload = (updater: (payload: Record<string, unknown>) => Record<string, unknown>) => {
    replacePayload(updater(editablePayload));
  };

  const handlePayloadTextChange = (nextText: string) => {
    setPayloadText(nextText);
    const parsed = safeParsePayload(nextText);
    if (parsed) {
      setLastValidPayload(parsed);
      setForm((prev) => ({
        ...prev,
        payload: parsed,
      }));
      setErrorMessage('');
    }
  };

  const updateTopLevelField = (field: string, value: unknown) => {
    updatePayload((prev) => {
      const next = { ...prev };
      if (
        value === null ||
        value === undefined ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0)
      ) {
        delete next[field];
      } else {
        next[field] = value;
      }
      return next;
    });
  };

  const addVocabBinding = (externalId: string) => {
    const next = uniqueTokens([...getStringArray(editablePayload.targetVocabIds), externalId]);
    updateTopLevelField('targetVocabIds', next);
  };

  const removeVocabBinding = (externalId: string) => {
    const next = getStringArray(editablePayload.targetVocabIds).filter((item) => item !== externalId);
    updateTopLevelField('targetVocabIds', next);
  };

  const updateCompactReadingPayload = (
    updater: (payload: Record<string, unknown>) => Record<string, unknown>
  ) => {
    updatePayload((prev) => {
      const fallbackLessonKey =
        form.blueprint_key || managedBlueprintKey || getString(prev.id) || 'lesson_reading_practice_01';
      return updater(buildCompactReadingPayload(prev, fallbackLessonKey));
    });
  };

  const updateReadingPresentationField = (field: string, value: unknown) => {
    updateCompactReadingPayload((prev) => {
      const next = { ...prev };
      const presentation = { ...(getObject(prev.presentation) ?? {}) };
      if (
        value === null ||
        value === undefined ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0)
      ) {
        delete presentation[field];
      } else {
        presentation[field] = value;
      }
      if (Object.keys(presentation).length > 0) {
        next.presentation = presentation;
      } else {
        delete next.presentation;
      }
      return next;
    });
  };

  const updateReadingTarget = (targetIndex: number, phrase: PhraseLibraryItem) => {
    updateCompactReadingPayload((prev) => {
      const next = { ...prev };
      const targets = [...getObjectArray(prev.targets)];
      targets[targetIndex] = {
        contentRef: buildSourceRef('phrase', phrase.id, 'target'),
      };
      next.targets = targets;
      return next;
    });
  };

  const removeReadingTarget = (targetIndex: number) => {
    updateCompactReadingPayload((prev) => {
      const next = { ...prev };
      const targets = [...getObjectArray(prev.targets)];
      if (targetIndex < targets.length) {
        targets.splice(targetIndex, 1);
      }
      if (targets.length > 0) {
        next.targets = targets;
      } else {
        next.targets = [];
      }
      return next;
    });
  };

  const updateReadingSupportingContextField = (field: string, value: unknown) => {
    updateCompactReadingPayload((prev) => {
      const next = { ...prev };
      const supportingContext = { ...(getObject(prev.supportingContext) ?? {}) };
      if (
        value === null ||
        value === undefined ||
        (typeof value === 'string' && value.trim() === '')
      ) {
        delete supportingContext[field];
      } else {
        supportingContext[field] = value;
      }
      if (Object.keys(supportingContext).length > 0) {
        next.supportingContext = supportingContext;
      } else {
        delete next.supportingContext;
      }
      return next;
    });
  };

  const updateReadingSupportingContextRef = (contentType: string, contentId: string) => {
    updateCompactReadingPayload((prev) => {
      const next = { ...prev };
      const supportingContext = { ...(getObject(prev.supportingContext) ?? {}) };
      supportingContext.contextRef = buildSourceRef(contentType, contentId, 'context');
      next.supportingContext = supportingContext;
      return next;
    });
  };

  const clearReadingSupportingContext = () => {
    updateCompactReadingPayload((prev) => {
      const next = { ...prev };
      delete next.supportingContext;
      return next;
    });
  };

  const updateReadingMediaRef = (mediaKey: string, fieldPath: string) => {
    updateCompactReadingPayload((prev) => {
      const next = { ...prev };
      const mediaRefs = { ...(getObject(prev.mediaRefs) ?? {}) };
      if (fieldPath.trim()) {
        mediaRefs[mediaKey] = { fieldPath: fieldPath.trim() };
      } else {
        delete mediaRefs[mediaKey];
      }
      if (Object.keys(mediaRefs).length > 0) {
        next.mediaRefs = mediaRefs;
      } else {
        delete next.mediaRefs;
      }
      return next;
    });
  };

  const updateStepField = (index: number, field: string, value: unknown) => {
    updatePayload((prev) => {
      const steps = getObjectArray(prev.steps);
      const nextSteps = [...steps];
      const existing = { ...(nextSteps[index] ?? {}) };
      if (
        value === null ||
        value === undefined ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0)
      ) {
        delete existing[field];
      } else {
        existing[field] = value;
      }
      nextSteps[index] = existing;
      return {
        ...prev,
        steps: nextSteps,
      };
    });
  };

  const updateStepCollectionItemField = (
    stepIndex: number,
    collectionName: 'options' | 'pairs',
    itemIndex: number,
    field: string,
    value: unknown
  ) => {
    updatePayload((prev) => {
      const steps = getObjectArray(prev.steps);
      const nextSteps = [...steps];
      const existingStep = { ...(nextSteps[stepIndex] ?? {}) };
      const items = [...getObjectArray(existingStep[collectionName])];
      const existingItem = { ...(items[itemIndex] ?? {}) };
      if (
        value === null ||
        value === undefined ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0)
      ) {
        delete existingItem[field];
      } else {
        existingItem[field] = value;
      }
      items[itemIndex] = existingItem;
      existingStep[collectionName] = items;
      nextSteps[stepIndex] = existingStep;
      return {
        ...prev,
        steps: nextSteps,
      };
    });
  };

  const addStepCollectionItem = (
    stepIndex: number,
    collectionName: 'options' | 'pairs',
    template: Record<string, unknown>
  ) => {
    updatePayload((prev) => {
      const steps = getObjectArray(prev.steps);
      const nextSteps = [...steps];
      const existingStep = { ...(nextSteps[stepIndex] ?? {}) };
      const existingItems = getObjectArray(existingStep[collectionName]);
      const itemPrefix = collectionName === 'options' ? 'opt' : 'pair';
      const newItem = {
        id: generateId(itemPrefix),
        ...template,
      };
      existingStep[collectionName] = [...existingItems, newItem];
      nextSteps[stepIndex] = existingStep;
      return {
        ...prev,
        steps: nextSteps,
      };
    });
  };

  const removeStepCollectionItem = (
    stepIndex: number,
    collectionName: 'options' | 'pairs',
    itemIndex: number
  ) => {
    updatePayload((prev) => {
      const steps = getObjectArray(prev.steps);
      const nextSteps = [...steps];
      const existingStep = { ...(nextSteps[stepIndex] ?? {}) };
      existingStep[collectionName] = getObjectArray(existingStep[collectionName]).filter(
        (_, index) => index !== itemIndex
      );
      nextSteps[stepIndex] = existingStep;
      return {
        ...prev,
        steps: nextSteps,
      };
    });
  };

  const openPhrasePicker = (target: PhrasePickerTarget) => {
    setPhraseSearch('');
    setPhraseError('');
    setPhrasePickerTarget(target);
  };

  const applyPhraseSelection = (phrase: PhraseLibraryItem) => {
    if (!phrasePickerTarget) return;

    if (phrasePickerTarget.mode === 'readingTarget') {
      updateReadingTarget(phrasePickerTarget.targetIndex, phrase);
      setPhrasePickerTarget(null);
      setPhraseSearch('');
      return;
    }

    if (phrasePickerTarget.mode === 'readingSupportingContext') {
      updateReadingSupportingContextRef('phrase', phrase.id);
      setPhrasePickerTarget(null);
      setPhraseSearch('');
      return;
    }

    updatePayload((prev) => {
      const steps = getObjectArray(prev.steps);
      const nextSteps = [...steps];
      const step = { ...(nextSteps[phrasePickerTarget.stepIndex] ?? {}) };
      const lessonId = getString(prev.id) || getString(step.lessonId) || form.blueprint_key || managedBlueprintKey;
      const phraseTarget = selectedCourse
        ? {
            itemType: 'phrase',
            itemId: phrase.id,
            languageId: selectedCourse.target_language_id || '',
            courseId: selectedCourse.id,
            lessonId,
          }
        : null;

      if (phrasePickerTarget.mode === 'recognitionTask') {
        step.yorubaText = phrase.phrase;
        step.sourceContentType = 'phrase';
        step.sourcePhraseId = phrase.id;
        step.sourceRef = buildSourceRef('phrase', phrase.id);
        if (!getString(step.audioUrl) && phrase.audio_url) {
          step.audioUrl = phrase.audio_url;
        }
        const options = [...getObjectArray(step.options)];
        const optionId = getString(step.correctOptionId) || `opt_${phrasePickerTarget.stepIndex + 1}_correct`;
        const existingIndex = options.findIndex((item) => getString(item.id) === optionId);
        const nextOption = {
          ...(existingIndex >= 0 ? options[existingIndex] : {}),
          id: optionId,
          englishText: phrase.translation,
        };
        if (existingIndex >= 0) {
          options[existingIndex] = nextOption;
        } else {
          options.push(nextOption);
        }
        step.options = options;
        step.correctOptionId = optionId;
        if (phraseTarget) {
          step.learningTargets = [phraseTarget];
        }
      }

      if (phrasePickerTarget.mode === 'recognitionOption') {
        const options = [...getObjectArray(step.options)];
        options[phrasePickerTarget.optionIndex] = {
          ...(options[phrasePickerTarget.optionIndex] ?? {}),
          englishText: phrase.translation,
          yorubaText: phrase.phrase,
          sourceContentType: 'phrase',
          sourcePhraseId: phrase.id,
          sourceRef: buildSourceRef('phrase', phrase.id),
        };
        if (!getString(step.audioUrl) && phrase.audio_url) {
          step.audioUrl = phrase.audio_url;
        }
        step.options = options;
      }

      if (phrasePickerTarget.mode === 'matchingPairs') {
        const pairs = [...getObjectArray(step.pairs)];
        pairs.push({
          id: `pair_${phrasePickerTarget.stepIndex + 1}_${pairs.length + 1}`,
          englishText: phrase.translation,
          yorubaText: phrase.phrase,
          audioUrl: phrase.audio_url || '',
          sourceContentType: 'phrase',
          sourcePhraseId: phrase.id,
          sourceRef: buildSourceRef('phrase', phrase.id, 'pair_source'),
        });
        step.pairs = pairs;
        if (phraseTarget) {
          const existingTargets = getObjectArray(step.learningTargets);
          step.learningTargets = [...existingTargets, phraseTarget];
        }
      }

      if (phrasePickerTarget.mode === 'matchingPairItem') {
        const pairs = [...getObjectArray(step.pairs)];
        pairs[phrasePickerTarget.pairIndex] = {
          ...(pairs[phrasePickerTarget.pairIndex] ?? {}),
          englishText: phrase.translation,
          yorubaText: phrase.phrase,
          audioUrl: phrase.audio_url || getString(pairs[phrasePickerTarget.pairIndex]?.audioUrl),
          sourceContentType: 'phrase',
          sourcePhraseId: phrase.id,
          sourceRef: buildSourceRef('phrase', phrase.id, 'pair_source'),
        };
        step.pairs = pairs;
        if (phraseTarget) {
          const existingTargets = getObjectArray(step.learningTargets).filter(
            (target) => getString(getObject(target)?.itemId) !== phrase.id
          );
          step.learningTargets = [...existingTargets, phraseTarget];
        }
      }

      nextSteps[phrasePickerTarget.stepIndex] = step;
      return {
        ...prev,
        steps: nextSteps,
      };
    });

    setPhrasePickerTarget(null);
    setPhraseSearch('');
  };

  const addStep = () => {
    const existingSteps = getObjectArray(editablePayload.steps);
    const stepNumber = existingSteps.length + 1;
    updatePayload((prev) => ({
      ...prev,
      steps: [...getObjectArray(prev.steps), { 
        type: 'lessonStart', 
        title: `Step ${stepNumber}`,
        stepId: generateId('step'),
      }],
    }));
  };

  const removeStep = (index: number) => {
    updatePayload((prev) => ({
      ...prev,
      steps: getObjectArray(prev.steps).filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    updatePayload((prev) => {
      const steps = getObjectArray(prev.steps);
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= steps.length) return prev;
      const nextSteps = [...steps];
      const [moved] = nextSteps.splice(index, 1);
      nextSteps.splice(newIndex, 0, moved);
      return { ...prev, steps: nextSteps };
    });
  };

  const handleGenerateAudio = async (fieldPath: string, textToSpeak: string) => {
    if (!textToSpeak.trim()) {
      toast.error('No text available to generate audio from. Add content text first.');
      return;
    }
    setGeneratingAudioFieldPath(fieldPath);
    try {
      const languageCode = selectedCourse?.target_language_code || 'yor';
      const response = await apiClient.post('/api/v1/admin/audio/generate', {
        text: textToSpeak.trim(),
        provider: 'spitch',
        voice_code: 'funmi',
        language_code: languageCode,
        save_to_s3: true,
        audio_format: 'wav',
      });
      const audioUrl = response.data?.audio_url;
      if (audioUrl) {
        updatePayload((prev) => setPayloadFieldValue(prev, fieldPath, audioUrl));
        setPayloadText((prev) => {
          const parsed = safeParsePayload(prev);
          if (!parsed) return prev;
          const next = setPayloadFieldValue(parsed, fieldPath, audioUrl);
          return JSON.stringify(next, null, 2);
        });
        toast.success('Audio generated and saved.');
      } else {
        toast.error('Audio generation succeeded but no URL was returned.');
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to generate audio');
    } finally {
      setGeneratingAudioFieldPath(null);
    }
  };

  const buildRequest = (): LessonBlueprintDraftUpsertRequest | null => {
    const payload = parsePayload();
    if (!payload) return null;

    const effectiveBlueprintKey = form.blueprint_key?.trim() || managedBlueprintKey?.trim();

    if (!effectiveBlueprintKey) {
      setErrorMessage('Blueprint key is required.');
      return null;
    }
    if (!form.course_id || !form.section_id) {
      setErrorMessage('Course and section are required.');
      return null;
    }

    return {
      ...form,
      blueprint_key: effectiveBlueprintKey,
      payload: {
        ...payload,
        id:
          mode === 'edit'
            ? getString(blueprint?.payload?.id) || effectiveBlueprintKey
            : effectiveBlueprintKey,
      },
    };
  };

  const handlePreview = async () => {
    const request = buildRequest();
    if (!request) return;

    setIsPreviewing(true);
    try {
      const result = await previewAdminBlueprintDraft(request);
      setPreviewResult(result);
      onPreviewResultChange?.(result);
      toast.success('Preview validation complete.');
    } catch (error) {
      const message = extractErrorMessage(error);
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSave = async () => {
    const request = buildRequest();
    if (!request) return;

    setIsSaving(true);
    try {
      const result =
        mode === 'create'
          ? await createAdminBlueprint(request)
          : await updateAdminBlueprint(blueprint!.id, request);
      setPreviewResult(result);
      onPreviewResultChange?.(result);
      setForm(request);
      setPayloadText(JSON.stringify(request.payload, null, 2));
      toast.success(mode === 'create' ? 'Blueprint draft created.' : 'Blueprint draft saved.');
      onSaved?.(result);
    } catch (error) {
      const message = extractErrorMessage(error);
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClone = async () => {
    if (!blueprint) return;

    setIsCloning(true);
    try {
      const result = await cloneAdminBlueprint(blueprint.id, {
        course_id: form.course_id,
        section_id: form.section_id,
      });
      toast.success('Blueprint cloned to a new draft with a system-managed key.');
      onSaved?.(result);
    } catch (error) {
      const message = extractErrorMessage(error);
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsCloning(false);
    }
  };

  const handleAssetFileSelected = async (fieldPath: string, file: File, acceptLabel: string) => {
    if (!blueprint?.id) {
      toast.error('Create the draft first, then upload assets to the saved blueprint.');
      return;
    }
    if (!file.type) {
      toast.error(`The selected ${acceptLabel} file is missing a MIME type.`);
      return;
    }
    const targetKind = inferAssetKindFromFieldPath(fieldPath);
    if (!file.type.startsWith(`${targetKind}/`)) {
      toast.error(`This field expects a ${targetKind} file. Selected file type was ${file.type}.`);
      return;
    }

    const uploadToken = `${fieldPath}:${file.name}:${file.size}:${file.lastModified}`;
    if (activeUploadTokenRef.current === uploadToken || uploadingFieldPath === fieldPath) {
      toast.info('Upload already in progress for this field.');
      return;
    }

    activeUploadTokenRef.current = uploadToken;
    setUploadingFieldPath(fieldPath);
    setUploadProgressByField((prev) => ({ ...prev, [fieldPath]: 0 }));
    try {
      const result = await uploadBlueprintAsset(
        blueprint.id,
        {
          field_path: fieldPath,
          file,
        },
        (percent) => {
        setUploadProgressByField((prev) => ({ ...prev, [fieldPath]: percent }));
        }
      );
      replacePayload(result.blueprint.payload);
      setPreviewResult(result);
      toast.success(`${acceptLabel} uploaded and linked to the blueprint.`);
      onSaved?.(result);
    } catch (error) {
      const message = extractErrorMessage(error);
      setErrorMessage(message);
      toast.error(message);
    } finally {
      activeUploadTokenRef.current = null;
      setUploadingFieldPath(null);
      setUploadProgressByField((prev) => {
        const next = { ...prev };
        delete next[fieldPath];
        return next;
      });
    }
  };

  const handleRemoveAsset = async (fieldPath: string) => {
    if (uploadingFieldPath === fieldPath) {
      toast.info('Wait for the current upload to finish first.');
      return;
    }

    const hasManagedBinding = Boolean(mediaBindings[fieldPath]);
    if (!hasManagedBinding || !blueprint?.id) {
      replacePayload(removePayloadFieldValue(editablePayload, fieldPath));
      toast.success('Image removed from the draft.');
      return;
    }

    setUploadingFieldPath(fieldPath);
    try {
      const result = await deleteBlueprintAsset(blueprint.id, fieldPath);
      replacePayload(result.blueprint.payload);
      setPreviewResult(result);
      onPreviewResultChange?.(result);
      onSaved?.(result);
      toast.success('Image removed from the blueprint.');
    } catch (error) {
      const message = extractErrorMessage(error);
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setUploadingFieldPath(null);
    }
  };

  const openAssetLibrary = (fieldPath: string) => {
    setAssetLibraryTargetFieldPath(fieldPath);
    setAssetLibraryTab('local');
    setIsAssetLibraryModalOpen(true);
  };

  const closeAssetLibrary = () => {
    setIsAssetLibraryModalOpen(false);
    setIsAssetDropActive(false);
  };

  const reuseAssetFromLibrary = (sourceFieldPath: string, targetFieldPath: string) => {
    const binding = mediaBindings[sourceFieldPath];
    if (!binding) {
      toast.error('Selected media binding no longer exists.');
      return;
    }
    updatePayload((prev) => {
      let next = setPayloadFieldValue(prev, targetFieldPath, binding.asset_url);
      const nextBindings = getMediaBindings(next);
      nextBindings[targetFieldPath] = {
        ...binding,
        field_path: targetFieldPath,
      };
      next = {
        ...next,
        mediaBindings: nextBindings,
      };
      return next;
    });
    setIsAssetLibraryModalOpen(false);
    toast.success(`Reused ${binding.file_name || binding.asset_kind || 'asset'} for ${targetFieldPath}.`);
  };

  const reuseGlobalLibraryAsset = (item: LessonBlueprintAssetLibraryItem, targetFieldPath: string) => {
    updatePayload((prev) => {
      let next = setPayloadFieldValue(prev, targetFieldPath, item.binding.asset_url);
      const nextBindings = getMediaBindings(next);
      nextBindings[targetFieldPath] = {
        ...item.binding,
        field_path: targetFieldPath,
      };
      next = {
        ...next,
        mediaBindings: nextBindings,
      };
      return next;
    });
    setIsAssetLibraryModalOpen(false);
    toast.success(`Reused ${item.binding.file_name || item.blueprint_key} from ${item.blueprint_key}.`);
  };

  const handleAssetDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsAssetDropActive(false);
    if (!assetLibraryTargetFieldPath) {
      toast.error('Choose a target field before dropping an asset.');
      return;
    }
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    const label = inferAssetKindFromFieldPath(assetLibraryTargetFieldPath) === 'audio' ? 'Audio' : 'Image';
    await handleAssetFileSelected(assetLibraryTargetFieldPath, file, label);
  };

  const openAssetPicker = (fieldPath: string, accept: string, acceptLabel: string) => {
    if (!canUploadAssets) {
      toast.error('Save the blueprint draft before uploading assets.');
      return;
    }
    if (uploadingFieldPath === fieldPath) {
      toast.info('Upload already in progress for this field.');
      return;
    }
    setAssetLibraryTargetFieldPath(fieldPath);

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      void handleAssetFileSelected(fieldPath, file, acceptLabel);
    };
    input.click();
  };

  return (
    <div id="blueprint-editor-root" className="space-y-6">
      {errorMessage && <Alert variant="error">{errorMessage}</Alert>}
      {capabilitiesError && (
        <Alert variant="warning">
          Backend editor capabilities failed to load. Lesson kind options may be incomplete.
        </Alert>
      )}
      {selectedCourse && (selectedCourse.target_language_name || selectedCourse.target_language_code) && (
        <Alert variant="info">
          Authoring for{' '}
          {[selectedCourse.target_language_name, selectedCourse.target_language_code?.toUpperCase()]
            .filter(Boolean)
            .join(' • ')}
          .
        </Alert>
      )}
      {selectedLessonCapability && !selectedLessonCapability.publish_supported && (
        <Alert variant="warning">
          {selectedLessonCapability.label} still relies on legacy mobile runtime behavior. Drafts can be saved, but
          publish validation is expected to block until universal runtime support is finished.
        </Alert>
      )}
      {!canUploadAssets && (
        <Alert variant="info">
          Asset uploads are enabled after the draft exists. Save or create the blueprint first, then upload images,
          audio, or video directly to Cloudflare R2 from this editor.
        </Alert>
      )}
      {rawPayloadInvalid && (
        <Alert variant="warning">
          Raw JSON is currently invalid. Structured authoring is showing the last valid payload snapshot until the JSON
          is fixed.
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr,0.85fr]">
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Blueprint Draft</h2>

          <div className="mt-4 grid grid-cols-1 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Blueprint key</label>
              <input
                value={managedBlueprintKey}
                readOnly
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-800/60 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Managed by the system from the selected course and section.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Course</label>
              <StyledSelect
                value={selectedCourseKey}
                onChange={(event) => setSelectedCourseKey(event.target.value)}
                options={courses.map((course) => ({
                  value: course.course_key,
                  label: `${course.title} (${course.course_key})`,
                }))}
                placeholder={courses.length === 0 ? 'No courses available' : ''}
                fullWidth
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Section</label>
              <StyledSelect
                value={form.section_id}
                onChange={(event) => setForm((prev) => ({ ...prev, section_id: event.target.value }))}
                options={sectionOptions.map((section) => ({
                  value: section.value,
                  label: section.label,
                }))}
                placeholder={isCurriculumLoading ? 'Loading sections…' : ''}
                fullWidth
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Lesson kind</label>
              <StyledSelect
                value={form.lesson_kind}
                onChange={(event) => setForm((prev) => ({ ...prev, lesson_kind: event.target.value }))}
                options={lessonKindOptions}
                placeholder=""
                fullWidth
              />
              {selectedLessonCapability?.description && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{selectedLessonCapability.description}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Schema version</label>
              <input
                type="number"
                min={1}
                value={form.schema_version}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    schema_version: Math.max(1, Number(event.target.value || 1)),
                  }))
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(460px,0.9fr)]">
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Learner Content</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Edit the lesson content, bindings, and generated flow inputs without hand-writing the whole payload.
                </p>
              </div>
              {selectedLessonCapability && (
                <button
                  type="button"
                  onClick={() => replacePayload(selectedLessonCapability.default_payload ?? {})}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-white/[0.03]"
                >
                  Use Backend Template
                </button>
              )}
            </div>

            {form.lesson_kind === 'reading_practice' && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">Reading Authoring</h3>
                  <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                    Compact reading authoring is phrase-first. Pick two target phrases, optional supporting context, and managed media refs while the backend generates the learner runtime.
                  </p>
                </div>

                <div className="space-y-4">
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
                      Compact mode. Mobile runtime still uses targetVocabIds until phrase-target runtime is wired end-to-end.
                    </div>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Title</label>
                        <input
                          {...getFieldPathAttributes('presentation.title')}
                          value={getString(readingPresentation.title)}
                          onChange={(event) => updateReadingPresentationField('title', event.target.value)}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Subtitle</label>
                        <input
                          {...getFieldPathAttributes('presentation.subtitle')}
                          value={getString(readingPresentation.subtitle)}
                          onChange={(event) => updateReadingPresentationField('subtitle', event.target.value)}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Unit label</label>
                        <input
                          {...getFieldPathAttributes('presentation.unitLabel')}
                          value={getString(readingPresentation.unitLabel)}
                          onChange={(event) => updateReadingPresentationField('unitLabel', event.target.value)}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Estimated minutes</label>
                        <input
                          {...getFieldPathAttributes('presentation.estimatedMinutes')}
                          type="number"
                          min={1}
                          value={(readingPresentation.estimatedMinutes as number | undefined) ?? ''}
                          onChange={(event) =>
                            updateReadingPresentationField('estimatedMinutes', Number(event.target.value || 0) || null)
                          }
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Exercise order version</label>
                        <input
                          {...getFieldPathAttributes('presentation.exerciseOrderVersion')}
                          type="number"
                          min={1}
                          value={(readingPresentation.exerciseOrderVersion as number | undefined) ?? ''}
                          onChange={(event) =>
                            updateReadingPresentationField('exerciseOrderVersion', Number(event.target.value || 1))
                          }
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Level tag</label>
                        <input
                          {...getFieldPathAttributes('presentation.levelTag')}
                          value={getString(readingPresentation.levelTag)}
                          onChange={(event) => updateReadingPresentationField('levelTag', event.target.value)}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                      </div>
                      <div className="lg:col-span-2">
                        <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Learning objectives</label>
                        <textarea
                          {...getFieldPathAttributes('presentation.learningObjectives')}
                          rows={3}
                          value={toTextList(getStringArray(readingPresentation.learningObjectives))}
                          onChange={(event) =>
                            updateReadingPresentationField('learningObjectives', parseTokenList(event.target.value))
                          }
                          placeholder="One objective per line"
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border border-emerald-300 bg-white p-3 dark:border-emerald-900 dark:bg-gray-900">
                      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Target phrases</div>
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        {[0, 1].map((targetIndex) => {
                          const target = readingTargets[targetIndex];
                          const contentRef = getContentRef(target?.contentRef);
                          const phraseId = getString(contentRef?.contentId);
                          return (
                            <div key={targetIndex} className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                              <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Target {targetIndex + 1}</div>
                              <div className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                                {phraseId || 'No phrase selected'}
                              </div>
                              {phraseId ? (
                                <div className="mt-1 text-xs font-mono text-gray-500 dark:text-gray-400">{phraseId}</div>
                              ) : null}
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => openPhrasePicker({ mode: 'readingTarget', targetIndex })}
                                  disabled={!selectedCourse?.target_language_id}
                                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                >
                                  {phraseId ? 'Replace phrase' : 'Choose phrase'}
                                </button>
                                {phraseId ? (
                                  <button
                                    type="button"
                                    onClick={() => removeReadingTarget(targetIndex)}
                                    className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-300"
                                  >
                                    Clear
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-lg border border-emerald-300 bg-white p-3 dark:border-emerald-900 dark:bg-gray-900">
                      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Supporting context</div>
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Context type</label>
                          <select
                            {...getFieldPathAttributes('supportingContext.contextRef.contentType')}
                            value={getString(getContentRef(readingSupportingContext.contextRef)?.contentType) || 'phrase'}
                            onChange={(event) =>
                              updateReadingSupportingContextRef(
                                event.target.value,
                                getString(getContentRef(readingSupportingContext.contextRef)?.contentId)
                              )
                            }
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                          >
                            <option value="phrase">Phrase</option>
                            <option value="phrase_set">Phrase set (transitional)</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Context id</label>
                          <input
                            {...getFieldPathAttributes('supportingContext.contextRef.contentId')}
                            value={getString(getContentRef(readingSupportingContext.contextRef)?.contentId)}
                            onChange={(event) =>
                              updateReadingSupportingContextRef(
                                getString(getContentRef(readingSupportingContext.contextRef)?.contentType) || 'phrase',
                                event.target.value
                              )
                            }
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Prompt text</label>
                          <input
                            {...getFieldPathAttributes('supportingContext.promptText')}
                            value={getString(readingSupportingContext.promptText)}
                            onChange={(event) => updateReadingSupportingContextField('promptText', event.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Translation hint</label>
                          <input
                            {...getFieldPathAttributes('supportingContext.translationHint')}
                            value={getString(readingSupportingContext.translationHint)}
                            onChange={(event) => updateReadingSupportingContextField('translationHint', event.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                          />
                        </div>
                        <div className="lg:col-span-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openPhrasePicker({ mode: 'readingSupportingContext' })}
                            disabled={
                              !selectedCourse?.target_language_id ||
                              (getString(getContentRef(readingSupportingContext.contextRef)?.contentType) || 'phrase') !== 'phrase'
                            }
                            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                          >
                            Choose phrase context
                          </button>
                          {getString(getContentRef(readingSupportingContext.contextRef)?.contentId) ? (
                            <button
                              type="button"
                              onClick={clearReadingSupportingContext}
                              className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-300"
                            >
                              Clear context
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-emerald-300 bg-white p-3 dark:border-emerald-900 dark:bg-gray-900">
                      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Managed media refs</div>
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        {[
                          { key: 'thumbnail', label: 'Thumbnail', suggestedFieldPath: 'thumbnailUrl' },
                          { key: 'hero', label: 'Hero image', suggestedFieldPath: 'heroImageUrl' },
                          { key: 'cover', label: 'Cover image', suggestedFieldPath: 'coverImageUrl' },
                          { key: 'character', label: 'Character image', suggestedFieldPath: 'characterImageUrl' },
                        ].map((item) => {
                          const currentFieldPath = getReadingMediaRefFieldPath(readingMediaRefs[item.key]);
                          return (
                            <div key={item.key} className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">{item.label}</label>
                              <select
                                {...getFieldPathAttributes(`mediaRefs.${item.key}.fieldPath`)}
                                value={currentFieldPath}
                                onChange={(event) => updateReadingMediaRef(item.key, event.target.value)}
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                              >
                                <option value="">No managed asset</option>
                                <option value={item.suggestedFieldPath}>{item.suggestedFieldPath}</option>
                              </select>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => openAssetLibrary(currentFieldPath || item.suggestedFieldPath)}
                                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                >
                                  Open asset bindings
                                </button>
                                {currentFieldPath ? (
                                  <button
                                    type="button"
                                    onClick={() => updateReadingMediaRef(item.key, '')}
                                    className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-300"
                                  >
                                    Clear ref
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
              </div>
            )}

            {form.lesson_kind === 'greetings_core' && (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200">Greetings Authoring</h3>
                  <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">
                    Greetings lessons are vocab-first. Use these fields to define the greeting set, supporting text, and visual presentation the structured runtime receives.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Subtitle</label>
                    <input
                      id="payload-subtitle"
                      value={getString(editablePayload.subtitle)}
                      onChange={(event) => updateTopLevelField('subtitle', event.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Unit label</label>
                    <input
                      id="payload-unit-label"
                      value={getString(editablePayload.unitLabel)}
                      onChange={(event) => updateTopLevelField('unitLabel', event.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Level tag</label>
                    <input
                      value={getString(editablePayload.levelTag)}
                      onChange={(event) => updateTopLevelField('levelTag', event.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Exercise order version</label>
                    <input
                      type="number"
                      min={1}
                      value={(editablePayload.exerciseOrderVersion as number | undefined) ?? ''}
                      onChange={(event) => updateTopLevelField('exerciseOrderVersion', Number(event.target.value || 1))}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Vocabulary bindings</label>
                    <div className="rounded-lg border border-gray-300 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                      <input
                        value={vocabSearch}
                        onChange={(event) => setVocabSearch(event.target.value)}
                        placeholder="Search vocab external IDs"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        {getStringArray(editablePayload.targetVocabIds).map((externalId) => (
                          <button
                            key={externalId}
                            type="button"
                            onClick={() => removeVocabBinding(externalId)}
                            className="rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300"
                            title={externalId}
                          >
                            {selectedVocabLabels[externalId] || getVocabDisplayLabel(externalId)} ×
                          </button>
                        ))}
                      </div>
                      <div className="mt-3 max-h-56 space-y-2 overflow-auto">
                        {isVocabLibraryLoading ? (
                          <div className="text-xs text-gray-500 dark:text-gray-400">Loading vocab…</div>
                        ) : vocabLibraryItems.length === 0 ? (
                          <div className="text-xs text-gray-500 dark:text-gray-400">No vocab matches the current search.</div>
                        ) : (
                          vocabLibraryItems.map((item) => (
                            <button
                              key={item.external_id}
                              type="button"
                              onClick={() => addVocabBinding(item.external_id)}
                              disabled={getStringArray(editablePayload.targetVocabIds).includes(item.external_id)}
                              className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-left text-xs hover:bg-gray-50 disabled:opacity-50 dark:border-gray-800 dark:hover:bg-gray-900"
                            >
                              <span className="font-medium text-gray-900 dark:text-white">
                                {getVocabDisplayLabel(item.external_id, item.lemma)}
                              </span>
                              <span className="text-gray-500 dark:text-gray-400">{item.external_id}</span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="lg:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Learning objectives</label>
                    <textarea
                      id="payload-learning-objectives"
                      rows={3}
                      value={toTextList(getStringArray(editablePayload.learningObjectives))}
                      onChange={(event) => updateTopLevelField('learningObjectives', parseTokenList(event.target.value))}
                      placeholder="One objective per line"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Thumbnail URL</label>
                    <input
                      id="payload-thumbnail-url"
                      {...getFieldPathAttributes('thumbnailUrl')}
                      value={getString(editablePayload.thumbnailUrl)}
                      onChange={(event) => updateTopLevelField('thumbnailUrl', event.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Character image URL</label>
                    <input
                      {...getFieldPathAttributes('characterImageUrl')}
                      value={getString(editablePayload.characterImageUrl)}
                      onChange={(event) => updateTopLevelField('characterImageUrl', event.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {form.lesson_kind === 'numbers_1_10' && (
              <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50 p-4 dark:border-violet-900/50 dark:bg-violet-950/20">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-violet-900 dark:text-violet-200">Numbers Authoring</h3>
                  <p className="mt-1 text-xs text-violet-700 dark:text-violet-400">
                    This family is generated from the backend number inventory. The current runtime only supports the exact range 1-10, so these fields define generation rather than freeform lesson copy.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Range start</label>
                    <input
                      id="payload-range-start"
                      {...getFieldPathAttributes('range[0]')}
                      type="number"
                      value={getNumberArray(editablePayload.range)[0] ?? 1}
                      onChange={(event) => {
                        const current = getNumberArray(editablePayload.range);
                        updateTopLevelField('range', [Number(event.target.value || 1), current[1] ?? 10]);
                      }}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Range end</label>
                    <input
                      {...getFieldPathAttributes('range[1]')}
                      type="number"
                      value={getNumberArray(editablePayload.range)[1] ?? 10}
                      onChange={(event) => {
                        const current = getNumberArray(editablePayload.range);
                        updateTopLevelField('range', [current[0] ?? 1, Number(event.target.value || 10)]);
                      }}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Unit label</label>
                    <input
                      id="payload-unit-label"
                      {...getFieldPathAttributes('unitLabel')}
                      value={getString(editablePayload.unitLabel)}
                      onChange={(event) => updateTopLevelField('unitLabel', event.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Exercise order version</label>
                    <input
                      type="number"
                      min={1}
                      value={(editablePayload.exerciseOrderVersion as number | undefined) ?? ''}
                      onChange={(event) => updateTopLevelField('exerciseOrderVersion', Number(event.target.value || 1))}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {form.lesson_kind === 'tone_marks_drill' && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Tone Marks Authoring</h3>
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                    Tone marks are primarily generated from a live phonics contrast. Use fallback copy only when you need to override the generated intro/context around that contrast.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Contrast id</label>
                    <input
                      id="payload-contrast-id"
                      {...getFieldPathAttributes('contrast_id')}
                      value={getString(editablePayload.contrast_id)}
                      readOnly
                      className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-800/60 dark:text-white"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Choose the contrast from the picker below.</p>
                  </div>
                  <div className="lg:col-span-2 rounded-lg border border-amber-300 bg-white p-3 dark:border-amber-900 dark:bg-gray-900">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tone contrast picker</div>
                      <input
                        value={toneContrastSearch}
                        onChange={(event) => setToneContrastSearch(event.target.value)}
                        placeholder="Search title, glyph, or UUID"
                        className="w-full max-w-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    </div>
                    <div className="mt-3 space-y-2">
                      {isToneContrastsLoading ? (
                        <div className="text-xs text-gray-500 dark:text-gray-400">Loading contrasts…</div>
                      ) : filteredToneContrasts.length === 0 ? (
                        <div className="text-xs text-gray-500 dark:text-gray-400">No phonics contrasts match the current search.</div>
                      ) : (
                        filteredToneContrasts.map((item: any) => (
                          <button
                            key={String(item.id)}
                            type="button"
                            onClick={() => updateTopLevelField('contrast_id', String(item.id))}
                            className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-left text-xs hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
                          >
                            <span className="font-medium text-gray-900 dark:text-white">
                              {item.title || `${item.letter_a_glyph} vs ${item.letter_b_glyph}`}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400">
                              {item.letter_a_glyph} / {item.letter_b_glyph}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Unit label</label>
                    <input
                      id="payload-unit-label"
                      {...getFieldPathAttributes('unitLabel')}
                      value={getString(editablePayload.unitLabel)}
                      onChange={(event) => updateTopLevelField('unitLabel', event.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Subtitle</label>
                    <input
                      id="payload-subtitle"
                      {...getFieldPathAttributes('subtitle')}
                      value={getString(editablePayload.subtitle)}
                      onChange={(event) => updateTopLevelField('subtitle', event.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Exercise order version</label>
                    <input
                      type="number"
                      min={1}
                      value={(editablePayload.exerciseOrderVersion as number | undefined) ?? ''}
                      onChange={(event) => updateTopLevelField('exerciseOrderVersion', Number(event.target.value || 1))}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Fallback learning objectives</label>
                    <textarea
                      id="payload-learning-objectives"
                      {...getFieldPathAttributes('learningObjectives')}
                      rows={3}
                      value={toTextList(getStringArray(editablePayload.learningObjectives))}
                      onChange={(event) => updateTopLevelField('learningObjectives', parseTokenList(event.target.value))}
                      placeholder="Used only when generated tone content needs supporting copy"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <label htmlFor="payload-lesson-id" className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Lesson id</label>
                <input
                  id="payload-lesson-id"
                  {...getFieldPathAttributes('id')}
                  value={mode === 'create' ? (form.blueprint_key ?? '') : (getString(editablePayload.id) || form.blueprint_key || '')}
                  readOnly
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-800/60 dark:text-white"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Managed by the system to match the lesson blueprint identity.
                </p>
              </div>
              <div>
                <label htmlFor="payload-title" className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Title</label>
                <input
                  id="payload-title"
                  {...getFieldPathAttributes('title')}
                  value={getString(editablePayload.title)}
                  onChange={(event) => updateTopLevelField('title', event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Mode</label>
                <input
                  id="payload-mode"
                  {...getFieldPathAttributes('mode')}
                  value={getString(editablePayload.mode)}
                  onChange={(event) => updateTopLevelField('mode', event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Flow mode</label>
                <input
                  id="payload-flow-mode"
                  {...getFieldPathAttributes('flowMode')}
                  value={getString(editablePayload.flowMode)}
                  onChange={(event) => updateTopLevelField('flowMode', event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Launch route</label>
                <StyledSelect
                  value={
                    getString(editablePayload.launchRoute) ||
                    getString(editablePayload.launch_route) ||
                    'structuredLesson'
                  }
                  onChange={(value) => updateTopLevelField('launchRoute', value)}
                  options={lessonLaunchRouteOptions}
                />
              </div>
              <div className="lg:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Description</label>
                <textarea
                  id="payload-description"
                  {...getFieldPathAttributes('description')}
                  value={getString(editablePayload.description)}
                  onChange={(event) => updateTopLevelField('description', event.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
              {form.lesson_kind !== 'reading_practice' && form.lesson_kind !== 'greetings_core' && (
                <div className="lg:col-span-2">
                  <label htmlFor="payload-target-vocab" className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                    Vocabulary bindings
                  </label>
                  <div className="rounded-lg border border-gray-300 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                    <input
                      value={vocabSearch}
                      onChange={(event) => setVocabSearch(event.target.value)}
                      placeholder="Search vocab external IDs"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {getStringArray(editablePayload.targetVocabIds).map((externalId) => (
                        <button
                          key={externalId}
                          type="button"
                          onClick={() => removeVocabBinding(externalId)}
                          className="rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                          title={externalId}
                        >
                          {selectedVocabLabels[externalId] || getVocabDisplayLabel(externalId)} ×
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 max-h-48 space-y-2 overflow-auto">
                      {isVocabLibraryLoading ? (
                        <div className="text-xs text-gray-500 dark:text-gray-400">Loading vocab…</div>
                      ) : vocabLibraryItems.length === 0 ? (
                        <div className="text-xs text-gray-500 dark:text-gray-400">No vocab matches the current search.</div>
                      ) : (
                        vocabLibraryItems.map((item) => (
                          <button
                            key={item.external_id}
                            type="button"
                            onClick={() => addVocabBinding(item.external_id)}
                            disabled={getStringArray(editablePayload.targetVocabIds).includes(item.external_id)}
                            className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-left text-xs hover:bg-gray-50 disabled:opacity-50 dark:border-gray-800 dark:hover:bg-gray-900"
                          >
                            <span className="font-medium text-gray-900 dark:text-white">
                              {getVocabDisplayLabel(item.external_id, item.lemma)}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400">{item.external_id}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Hero image URL</label>
                <div className="flex gap-2">
                  <input
                    id="payload-hero-image-url"
                    {...getFieldPathAttributes('heroImageUrl')}
                    value={getString(editablePayload.heroImageUrl)}
                    readOnly
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-800/60 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => openAssetPicker('heroImageUrl', 'image/*', 'Image')}
                    disabled={uploadingFieldPath === 'heroImageUrl'}
                    className="rounded-lg border border-brand-300 bg-white px-3 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:border-brand-800 dark:bg-gray-900 dark:text-brand-300 dark:hover:bg-brand-950/30"
                  >
                    {uploadingFieldPath === 'heroImageUrl'
                      ? `Uploading ${uploadProgressByField.heroImageUrl ?? 0}%`
                      : 'Upload'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openAssetLibrary('heroImageUrl')}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                      assetLibraryTargetFieldPath === 'heroImageUrl'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-300'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200'
                    }`}
                  >
                    Library
                  </button>
                </div>
                {getString(editablePayload.heroImageUrl) ? (
                  <div className="mt-3">
                    <MediaLinkPreview
                      url={getString(editablePayload.heroImageUrl)}
                      label="Hero image"
                      kind="image"
                      compact
                      onRemove={() => void handleRemoveAsset('heroImageUrl')}
                    />
                  </div>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Cover image URL</label>
                <div className="flex gap-2">
                  <input
                    id="payload-cover-image-url"
                    {...getFieldPathAttributes('coverImageUrl')}
                    value={getString(editablePayload.coverImageUrl)}
                    readOnly
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-800/60 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => openAssetPicker('coverImageUrl', 'image/*', 'Image')}
                    disabled={uploadingFieldPath === 'coverImageUrl'}
                    className="rounded-lg border border-brand-300 bg-white px-3 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:border-brand-800 dark:bg-gray-900 dark:text-brand-300 dark:hover:bg-brand-950/30"
                  >
                    {uploadingFieldPath === 'coverImageUrl'
                      ? `Uploading ${uploadProgressByField.coverImageUrl ?? 0}%`
                      : 'Upload'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openAssetLibrary('coverImageUrl')}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                      assetLibraryTargetFieldPath === 'coverImageUrl'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-300'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200'
                    }`}
                  >
                    Library
                  </button>
                </div>
                {getString(editablePayload.coverImageUrl) ? (
                  <div className="mt-3">
                    <MediaLinkPreview
                      url={getString(editablePayload.coverImageUrl)}
                      label="Cover image"
                      kind="image"
                      compact
                      onRemove={() => void handleRemoveAsset('coverImageUrl')}
                    />
                  </div>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Image URL</label>
                <div className="flex gap-2">
                  <input
                    id="payload-image-url"
                    {...getFieldPathAttributes('imageUrl')}
                    value={getString(editablePayload.imageUrl)}
                    readOnly
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-800/60 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => openAssetPicker('imageUrl', 'image/*', 'Image')}
                    disabled={uploadingFieldPath === 'imageUrl'}
                    className="rounded-lg border border-brand-300 bg-white px-3 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:border-brand-800 dark:bg-gray-900 dark:text-brand-300 dark:hover:bg-brand-950/30"
                  >
                    {uploadingFieldPath === 'imageUrl'
                      ? `Uploading ${uploadProgressByField.imageUrl ?? 0}%`
                      : 'Upload'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openAssetLibrary('imageUrl')}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                      assetLibraryTargetFieldPath === 'imageUrl'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-300'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200'
                    }`}
                  >
                    Library
                  </button>
                </div>
                {getString(editablePayload.imageUrl) ? (
                  <div className="mt-3">
                    <MediaLinkPreview
                      url={getString(editablePayload.imageUrl)}
                      label="Image"
                      kind="image"
                      compact
                      onRemove={() => void handleRemoveAsset('imageUrl')}
                    />
                  </div>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Audio URL</label>
                <div className="flex gap-2">
                  <input
                    id="payload-audio-url"
                    {...getFieldPathAttributes('audioUrl')}
                    value={getString(editablePayload.audioUrl)}
                    readOnly
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-800/60 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => openAssetPicker('audioUrl', 'audio/*', 'Audio')}
                    disabled={uploadingFieldPath === 'audioUrl'}
                    className="rounded-lg border border-brand-300 bg-white px-3 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:border-brand-800 dark:bg-gray-900 dark:text-brand-300 dark:hover:bg-brand-950/30"
                  >
                    {uploadingFieldPath === 'audioUrl'
                      ? `Uploading ${uploadProgressByField.audioUrl ?? 0}%`
                      : 'Upload'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openAssetLibrary('audioUrl')}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                      assetLibraryTargetFieldPath === 'audioUrl'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-300'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200'
                    }`}
                  >
                    Library
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenerateAudio('audioUrl', getString(editablePayload.title) || getString(editablePayload.prompt) || 'audio content')}
                    disabled={generatingAudioFieldPath === 'audioUrl'}
                    className="rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-300"
                  >
                    {generatingAudioFieldPath === 'audioUrl' ? 'Generating…' : 'Generate'}
                  </button>
                </div>
                {getString(editablePayload.audioUrl) ? (
                  <div className="mt-3">
                    <MediaLinkPreview url={getString(editablePayload.audioUrl)} label="Audio" kind="audio" compact />
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-3 lg:col-span-2">
                <input
                  id="include-culture-tip"
                  type="checkbox"
                  checked={getBoolean(editablePayload.includeCultureTip)}
                  onChange={(event) => updateTopLevelField('includeCultureTip', event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="include-culture-tip" className="text-sm text-gray-700 dark:text-gray-200">
                  Include culture tip
                </label>
              </div>
              {form.lesson_kind === 'numbers_1_10' && (
                <div className="grid grid-cols-2 gap-3 lg:col-span-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Range start</label>
                    <input
                      type="number"
                      value={getNumberArray(editablePayload.range)[0] ?? ''}
                      onChange={(event) => {
                        const current = getNumberArray(editablePayload.range);
                        const end = current[1] ?? 10;
                        updateTopLevelField('range', [Number(event.target.value || 1), end]);
                      }}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Range end</label>
                    <input
                      type="number"
                      value={getNumberArray(editablePayload.range)[1] ?? ''}
                      onChange={(event) => {
                        const current = getNumberArray(editablePayload.range);
                        const start = current[0] ?? 1;
                        updateTopLevelField('range', [start, Number(event.target.value || 10)]);
                      }}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>
              )}
              {form.lesson_kind === 'tone_marks_drill' && (
                <div className="lg:col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Tone marks authoring</p>
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                    Use <span className="font-semibold">contrast_id</span> plus optional audio/image assets to drive the phonics contrast flow.
                  </p>
                </div>
              )}
              {form.lesson_kind === 'numbers_1_10' && (
                <div className="lg:col-span-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/50 dark:bg-blue-950/20">
                  <p className="text-xs font-medium text-blue-800 dark:text-blue-300">Numbers authoring</p>
                  <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">
                    Range controls drive generated number batches. Add explicit steps only for custom intros, checks, or media-backed overrides.
                  </p>
                </div>
              )}
              {form.lesson_kind === 'reading_practice' && (
                <div className="lg:col-span-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                  <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Reading authoring</p>
                  <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                    Vocabulary bindings and flow mode generate the learner path. Use steps for explicit prompts, dialogue text, or media-backed checkpoints.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Media Library</h3>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Use the Library button beside any media field to open a searchable picker for that exact slot.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAssetLibraryModalOpen(true)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                >
                  Open library
                </button>
              </div>
              {selectedAssetLibraryField ? (
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
                    Target: {selectedAssetLibraryField.label}
                  </span>
                  <span>
                    {compatibleLibraryAssets.length} compatible local asset{compatibleLibraryAssets.length === 1 ? '' : 's'}
                  </span>
                </div>
              ) : null}
            </div>

            <Modal
              isOpen={isAssetLibraryModalOpen}
              onClose={closeAssetLibrary}
              title="Media Library"
              maxWidth="full"
              className="max-h-[92vh] overflow-hidden"
            >
              <div aria-label="Media library modal content" className="max-h-[calc(92vh-8rem)] space-y-5 overflow-y-auto pr-1">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
                  <div className="lg:col-span-2">
                    <div className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">Target field</div>
                    <StyledSelect
                      value={assetLibraryTargetFieldPath || ''}
                      onChange={(event) => setAssetLibraryTargetFieldPath(event.target.value)}
                      aria-label="Media library target field"
                      options={mediaFieldOptions.map((option) => ({
                        value: option.value,
                        label: option.label,
                      }))}
                      placeholder=""
                      fullWidth
                    />
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">Scope</div>
                    <StyledSelect
                      value={assetLibraryScope}
                      onChange={(event) => setAssetLibraryScope(event.target.value as 'same_course' | 'all_courses')}
                      aria-label="Media library scope"
                      options={[
                        { value: 'same_course', label: 'Same course' },
                        { value: 'all_courses', label: 'All courses' },
                      ]}
                      placeholder=""
                      fullWidth
                    />
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">Sort</div>
                    <StyledSelect
                      value={assetLibrarySort}
                      onChange={(event) => setAssetLibrarySort(event.target.value as 'recent' | 'name' | 'source')}
                      aria-label="Media library sort"
                      options={[
                        { value: 'recent', label: 'Newest first' },
                        { value: 'name', label: 'File name' },
                        { value: 'source', label: 'Field/source' },
                      ]}
                      placeholder=""
                      fullWidth
                    />
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">Asset type</div>
                    <StyledSelect
                      value={assetLibraryKindFilter}
                      onChange={(event) => setAssetLibraryKindFilter(event.target.value as 'all' | 'image' | 'audio' | 'video')}
                      aria-label="Media library asset type"
                      options={[
                        { value: 'all', label: 'All types' },
                        { value: 'image', label: 'Images' },
                        { value: 'audio', label: 'Audio' },
                        { value: 'video', label: 'Video' },
                      ]}
                      placeholder=""
                      fullWidth
                    />
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">Show</div>
                    <StyledSelect
                      value={assetLibraryCompatibilityFilter}
                      onChange={(event) => setAssetLibraryCompatibilityFilter(event.target.value as 'all' | 'compatible')}
                      aria-label="Media library compatibility"
                      options={[
                        { value: 'all', label: 'All results' },
                        { value: 'compatible', label: 'Compatible only' },
                      ]}
                      placeholder=""
                      fullWidth
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">Search</div>
                  <input
                    value={globalAssetSearch}
                    onChange={(event) => setGlobalAssetSearch(event.target.value)}
                    aria-label="Search media library"
                    placeholder="Search file name, blueprint, or field path"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>

                <div
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsAssetDropActive(true);
                  }}
                  onDragLeave={() => setIsAssetDropActive(false)}
                  onDrop={(event) => void handleAssetDrop(event)}
                  className={`rounded-lg border-2 border-dashed px-4 py-5 text-sm transition ${
                    isAssetDropActive
                      ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-950/20 dark:text-brand-300'
                      : 'border-gray-300 bg-gray-50 text-gray-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400'
                  }`}
                >
                  {assetLibraryTargetFieldPath
                    ? `Drop an ${inferAssetKindFromFieldPath(assetLibraryTargetFieldPath)} file here to upload directly to ${assetLibraryTargetFieldPath}.`
                    : 'Choose the target field first, then drop a file to upload.'}
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAssetLibraryTab('local')}
                      aria-pressed={assetLibraryTab === 'local'}
                      className={`rounded-full px-3 py-2 text-xs font-medium transition ${
                        assetLibraryTab === 'local'
                          ? 'bg-brand-600 text-white'
                          : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800'
                      }`}
                    >
                      Local assets ({filteredBlueprintLibraryAssets.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssetLibraryTab('global')}
                      aria-pressed={assetLibraryTab === 'global'}
                      className={`rounded-full px-3 py-2 text-xs font-medium transition ${
                        assetLibraryTab === 'global'
                          ? 'bg-brand-600 text-white'
                          : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800'
                      }`}
                    >
                      Global assets ({sortedGlobalAssetLibraryItems.length})
                    </button>
                  </div>

                  {assetLibraryTab === 'local' ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">This blueprint</h4>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Existing uploads already attached to this draft.
                        </p>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{filteredBlueprintLibraryAssets.length} items</span>
                    </div>

                    {filteredBlueprintLibraryAssets.length === 0 ? (
                      <div className="mt-4 rounded-lg border border-dashed border-gray-300 px-3 py-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                        No local assets match the current search.
                      </div>
                    ) : (
                      <div
                        aria-label="Local media asset grid"
                        className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5"
                      >
                        {filteredBlueprintLibraryAssets.map(([fieldPath, binding]) => {
                          const isCompatible = assetLibraryTargetFieldPath
                            ? isMediaBindingCompatible(binding, assetLibraryTargetFieldPath)
                            : false;
                          return (
                            <div
                              key={fieldPath}
                              className="flex h-full flex-col rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
                            >
                              <div className="flex h-full flex-col gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium text-gray-900 dark:text-white">{binding.file_name || fieldPath}</div>
                                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    {fieldPath} • {(binding.asset_kind || inferAssetKindFromFieldPath(fieldPath)).toUpperCase()}
                                  </div>
                                  <div className="mt-3">
                                    <MediaLinkPreview
                                      url={binding.asset_url}
                                      label={binding.file_name || fieldPath}
                                      kind={binding.asset_kind || inferAssetKindFromFieldPath(fieldPath)}
                                      compact
                                    />
                                  </div>
                                </div>
                                {assetLibraryTargetFieldPath ? (
                                  <button
                                    type="button"
                                    onClick={() => reuseAssetFromLibrary(fieldPath, assetLibraryTargetFieldPath)}
                                    disabled={!isCompatible}
                                    className="mt-auto rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300"
                                  >
                                    Select
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  ) : (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Reusable library</h4>
                        <Link
                          href="/audio/voices"
                          className="mt-1 inline-flex text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-200"
                        >
                          Browse audio assets
                        </Link>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{sortedGlobalAssetLibraryItems.length} items</span>
                    </div>

                    {isGlobalAssetLibraryLoading ? (
                      <div className="mt-4 rounded-lg border border-dashed border-gray-300 px-3 py-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                        Loading reusable assets…
                      </div>
                    ) : sortedGlobalAssetLibraryItems.length === 0 ? (
                      <div className="mt-4 rounded-lg border border-dashed border-gray-300 px-3 py-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                        No reusable assets found for the current filters.
                      </div>
                    ) : (
                      <div
                        aria-label="Global media asset grid"
                        className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5"
                      >
                        {sortedGlobalAssetLibraryItems.map((item) => {
                          const isCompatible = assetLibraryTargetFieldPath
                            ? isMediaBindingCompatible(item.binding, assetLibraryTargetFieldPath)
                            : false;
                          return (
                            <div
                              key={`${item.blueprint_id}:${item.field_path}:${item.binding.storage_key}`}
                              className="flex h-full flex-col rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
                            >
                              <div className="flex h-full flex-col gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                                    {item.binding.file_name || item.field_path}
                                  </div>
                                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    {item.blueprint_key} • {item.field_path} • {(item.binding.asset_kind || inferAssetKindFromFieldPath(item.field_path)).toUpperCase()}
                                  </div>
                                  <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                                    {item.course_key || 'Unknown course'}
                                    {assetLibraryScope === 'all_courses' && selectedCourse?.course_key && item.course_key !== selectedCourse.course_key
                                      ? ' • cross-course'
                                      : ''}
                                  </div>
                                  <div className="mt-3">
                                    <MediaLinkPreview
                                      url={item.binding.asset_url}
                                      label={item.binding.file_name || item.field_path}
                                      kind={item.binding.asset_kind || inferAssetKindFromFieldPath(item.field_path)}
                                      compact
                                    />
                                  </div>
                                </div>
                                {assetLibraryTargetFieldPath ? (
                                  <button
                                    type="button"
                                    onClick={() => reuseGlobalLibraryAsset(item, assetLibraryTargetFieldPath)}
                                    disabled={!isCompatible}
                                    className="mt-auto rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300"
                                  >
                                    Select
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  )}
                </div>
              </div>
            </Modal>

            <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Step Authoring</h3>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Use this for lesson families that define explicit learner steps. Generated families will still show
                    their runtime flow preview below.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addStep}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:bg-white/[0.03]"
                >
                  Add Step
                </button>
                {starterSteps && (
                  <button
                    type="button"
                    onClick={() => updateTopLevelField('steps', starterSteps)}
                    className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300"
                  >
                    Load {form.lesson_kind.replaceAll('_', ' ')} starter steps
                  </button>
                )}
              </div>

              <div className="mt-4 space-y-4">
                {editableSteps.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 px-3 py-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    No explicit steps are defined in this payload yet.
                  </div>
                ) : (
                  editableSteps.map((step, index) => {
                    const stepType = getStepRuntimeType(step);
                    const recognitionOptions = getObjectArray(step.options);
                    const matchPairs = getObjectArray(step.pairs);

                    const stepCounts = stepValidationCounts.get(index);
                    const hasStepErrors = stepCounts && stepCounts.errors > 0;
                    const hasStepWarnings = stepCounts && stepCounts.warnings > 0;

                    return (
                    <div
                      key={`${getString(step.stepId) || stepType || 'step'}-${index}`}
                      className={`rounded-lg border bg-white p-4 dark:bg-gray-900 ${
                        hasStepErrors
                          ? 'border-red-300 dark:border-red-800'
                          : hasStepWarnings
                          ? 'border-amber-300 dark:border-amber-800'
                          : 'border-gray-200 dark:border-gray-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">Step {index + 1}</div>
                          {hasStepErrors && (
                            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
                              {stepCounts.errors} error{stepCounts.errors === 1 ? '' : 's'}
                            </span>
                          )}
                          {!hasStepErrors && hasStepWarnings && (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                              {stepCounts.warnings} warning{stepCounts.warnings === 1 ? '' : 's'}
                            </span>
                          )}
                          {!hasStepErrors && !hasStepWarnings && stepCounts && (
                            <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                              Valid
                            </span>
                          )}
                        </div>
                         <div className="flex items-center gap-2">
                           <button
                             type="button"
                             onClick={() => moveStep(index, -1)}
                             disabled={index === 0}
                             className="rounded-lg border border-gray-300 px-2 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                             title="Move up"
                           >
                             ↑
                           </button>
                           <button
                             type="button"
                             onClick={() => moveStep(index, 1)}
                             disabled={index === editableSteps.length - 1}
                             className="rounded-lg border border-gray-300 px-2 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                             title="Move down"
                           >
                             ↓
                           </button>
                           <button
                             type="button"
                             onClick={() => removeStep(index)}
                             className="rounded-lg border border-red-300 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
                           >
                             Remove
                           </button>
                         </div>
                       </div>
                      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Type</label>
                          <StyledSelect
                            value={stepType}
                            onChange={(event) => updateStepField(index, 'type', event.target.value)}
                            options={stepTypeOptions}
                            placeholder=""
                            fullWidth
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Step id <span className="text-gray-400">(auto-generated)</span></label>
                          <input
                            value={getString(step.stepId)}
                            readOnly
                            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400"
                          />
                        </div>
                        <div className="lg:col-span-2">
                          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Title</label>
                          <input
                            value={getString(step.title)}
                            onChange={(event) => updateStepField(index, 'title', event.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                          />
                        </div>
                        <div className="lg:col-span-2">
                          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Prompt / body</label>
                          <textarea
                            rows={3}
                            value={
                              getString(step.prompt) ||
                              getString(step.body) ||
                              getString(step.text) ||
                              getString(step.instruction)
                            }
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              updatePayload((prev) => {
                                const steps = getObjectArray(prev.steps);
                                const nextSteps = [...steps];
                                const existing = { ...(nextSteps[index] ?? {}) };
                                delete existing.prompt;
                                delete existing.body;
                                delete existing.text;
                                delete existing.instruction;
                                if (nextValue.trim()) {
                                  existing.prompt = nextValue;
                                }
                                nextSteps[index] = existing;
                                return { ...prev, steps: nextSteps };
                              });
                            }}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                          />
                        </div>
                        {form.lesson_kind === 'reading_practice' && (
                          <>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Vocab id</label>
                              <input
                                value={getString(step.vocabId)}
                                onChange={(event) => updateStepField(index, 'vocabId', event.target.value)}
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Expected answer</label>
                              <input
                                value={getString(step.expectedAnswer)}
                                onChange={(event) => updateStepField(index, 'expectedAnswer', event.target.value)}
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                              />
                            </div>
                            <div className="lg:col-span-2">
                              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Choices</label>
                              <textarea
                                rows={2}
                                value={toTextList(getStringArray(step.choices))}
                                onChange={(event) => updateStepField(index, 'choices', parseTokenList(event.target.value))}
                                placeholder="One choice per line"
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                              />
                            </div>
                          </>
                        )}
                        {form.lesson_kind === 'greetings_core' && (
                          <>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Vocab id</label>
                              <input
                                value={getString(step.vocabId)}
                                onChange={(event) => updateStepField(index, 'vocabId', event.target.value)}
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Context tag</label>
                              <input
                                value={getString(step.contextTag)}
                                onChange={(event) => updateStepField(index, 'contextTag', event.target.value)}
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                              />
                            </div>
                          </>
                        )}
                        {form.lesson_kind === 'numbers_1_10' && (
                          <>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Number value</label>
                              <input
                                type="number"
                                value={(step.numberValue as number | undefined) ?? ''}
                                onChange={(event) => updateStepField(index, 'numberValue', Number(event.target.value || 0) || null)}
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Display numeral</label>
                              <input
                                value={getString(step.displayNumeral)}
                                onChange={(event) => updateStepField(index, 'displayNumeral', event.target.value)}
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                              />
                            </div>
                          </>
                        )}
                        {form.lesson_kind === 'tone_marks_drill' && (
                          <>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Contrast side</label>
                              <StyledSelect
                                value={getString(step.contrastSide)}
                                onChange={(event) => updateStepField(index, 'contrastSide', event.target.value)}
                                options={[
                                  { value: '', label: 'Unspecified' },
                                  { value: 'a', label: 'Side A' },
                                  { value: 'b', label: 'Side B' },
                                ]}
                                placeholder=""
                                fullWidth
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Token external id</label>
                              <input
                                value={getString(step.tokenExternalId)}
                                onChange={(event) => updateStepField(index, 'tokenExternalId', event.target.value)}
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                              />
                            </div>
                          </>
                        )}
                        {stepType === 'recognitionTask' && (
                          <>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Yoruba text</label>
                              <input
                                value={getString(step.yorubaText)}
                                onChange={(event) => updateStepField(index, 'yorubaText', event.target.value)}
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Correct option</label>
                              <StyledSelect
                                value={getString(step.correctOptionId)}
                                onChange={(event) => updateStepField(index, 'correctOptionId', event.target.value)}
                                options={[
                                  { value: '', label: 'Select option' },
                                  ...recognitionOptions.map((option, optionIndex) => ({
                                    value: getString(option.id),
                                    label: getString(option.englishText) || getString(option.id) || `Option ${optionIndex + 1}`,
                                  })),
                                ]}
                                placeholder=""
                                fullWidth
                              />
                            </div>
                            <div className="flex items-end">
                              <button
                                type="button"
                                onClick={() => openPhrasePicker({ mode: 'recognitionTask', stepIndex: index })}
                                disabled={!selectedCourse?.target_language_id}
                                className="rounded-lg border border-brand-300 bg-white px-3 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:border-brand-800 dark:bg-gray-900 dark:text-brand-300 dark:hover:bg-brand-950/30"
                              >
                                Use phrase
                              </button>
                            </div>
                            <div className="lg:col-span-2 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-gray-900 dark:text-white">Recognition options</div>
                                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    These cards already render `imageUrl` on mobile when present.
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    addStepCollectionItem(index, 'options', {
                                      id: `opt_${index + 1}_${recognitionOptions.length + 1}`,
                                      englishText: '',
                                      yorubaText: '',
                                    })
                                  }
                                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:bg-white/[0.03]"
                                >
                                  Add Option
                                </button>
                              </div>
                              <div className="space-y-4">
                                {recognitionOptions.length === 0 ? (
                                  <div className="rounded-lg border border-dashed border-gray-300 px-3 py-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                                    No recognition options yet.
                                  </div>
                                ) : (
                                  recognitionOptions.map((option, optionIndex) => {
                                    const imageFieldPath = `steps[${index}].options[${optionIndex}].imageUrl`;
                                    return (
                                      <div
                                        key={`${getString(option.id) || 'option'}-${optionIndex}`}
                                        className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
                                      >
                                        <div className="mb-3 flex items-center justify-between gap-3">
                                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                                            Option {optionIndex + 1}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                openPhrasePicker({
                                                  mode: 'recognitionOption',
                                                  stepIndex: index,
                                                  optionIndex,
                                                })
                                              }
                                              disabled={!selectedCourse?.target_language_id}
                                              className="rounded-lg border border-brand-300 px-3 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-950/30"
                                            >
                                              Use phrase
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => removeStepCollectionItem(index, 'options', optionIndex)}
                                              className="rounded-lg border border-red-300 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
                                            >
                                              Remove
                                            </button>
                                          </div>
                                        </div>
                                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                           <div>
                                             <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Option id <span className="text-gray-400">(auto-generated)</span></label>
                                             <input
                                               value={getString(option.id)}
                                               readOnly
                                               className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400"
                                             />
                                           </div>
                                          <div>
                                            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">English text</label>
                                            <input
                                              value={getString(option.englishText)}
                                              onChange={(event) =>
                                                updateStepCollectionItemField(index, 'options', optionIndex, 'englishText', event.target.value)
                                              }
                                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                            />
                                          </div>
                                          <div className="lg:col-span-2">
                                            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Yoruba text</label>
                                            <input
                                              value={getString(option.yorubaText)}
                                              onChange={(event) =>
                                                updateStepCollectionItemField(index, 'options', optionIndex, 'yorubaText', event.target.value)
                                              }
                                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                            />
                                          </div>
                                          <div className="lg:col-span-2">
                                            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Image URL</label>
                                            <div className="flex gap-2">
                                              <input
                                                {...getFieldPathAttributes(imageFieldPath)}
                                                value={getString(option.imageUrl)}
                                                readOnly
                                                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-800/60 dark:text-white"
                                              />
                                              <button
                                                type="button"
                                                onClick={() => openAssetPicker(imageFieldPath, 'image/*', 'Image')}
                                                disabled={uploadingFieldPath === imageFieldPath}
                                                className="rounded-lg border border-brand-300 bg-white px-3 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:border-brand-800 dark:bg-gray-900 dark:text-brand-300 dark:hover:bg-brand-950/30"
                                              >
                                                {uploadingFieldPath === imageFieldPath
                                                  ? `Uploading ${uploadProgressByField[imageFieldPath] ?? 0}%`
                                                  : 'Upload'}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => openAssetLibrary(imageFieldPath)}
                                                className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                                                  assetLibraryTargetFieldPath === imageFieldPath
                                                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-300'
                                                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200'
                                                }`}
                                              >
                                                Library
                                              </button>
                                            </div>
                                            {getString(option.imageUrl) ? (
                                              <div className="mt-3">
                                                <MediaLinkPreview
                                                  url={getString(option.imageUrl)}
                                                  label={`Option ${optionIndex + 1} image`}
                                                  kind="image"
                                                  compact
                                                  onRemove={() => void handleRemoveAsset(imageFieldPath)}
                                                />
                                              </div>
                                            ) : null}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          </>
                        )}
                        {stepType === 'matchingPairs' && (
                          <div className="lg:col-span-2 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-gray-900 dark:text-white">Matching pairs</div>
                                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                  Pair audio is already used by the runtime. Pair images are stored for lesson cards and future matching visuals.
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    addStepCollectionItem(index, 'pairs', {
                                      id: `pair_${index + 1}_${matchPairs.length + 1}`,
                                      yorubaText: '',
                                      englishText: '',
                                      audioUrl: '',
                                    })
                                  }
                                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:bg-white/[0.03]"
                                >
                                  Add Pair
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openPhrasePicker({ mode: 'matchingPairs', stepIndex: index })}
                                  disabled={!selectedCourse?.target_language_id}
                                  className="rounded-lg border border-brand-300 bg-white px-3 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:border-brand-800 dark:bg-gray-900 dark:text-brand-300 dark:hover:bg-brand-950/30"
                                >
                                  Add from phrases
                                </button>
                              </div>
                            </div>
                            <div className="space-y-4">
                              {matchPairs.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-gray-300 px-3 py-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                                  No matching pairs yet.
                                </div>
                              ) : (
                                matchPairs.map((pair, pairIndex) => {
                                  const pairAudioFieldPath = `steps[${index}].pairs[${pairIndex}].audioUrl`;
                                  const pairImageFieldPath = `steps[${index}].pairs[${pairIndex}].imageUrl`;
                                  const sourceRef = getObject(pair.sourceRef);
                                  const sourcePhraseId =
                                    getString(pair.sourcePhraseId) ||
                                    (getString(sourceRef?.contentType) === 'phrase'
                                      ? getString(sourceRef?.contentId)
                                      : '');
                                  const sourceContentType =
                                    getString(pair.sourceContentType) ||
                                    getString(sourceRef?.contentType);
                                  return (
                                    <div
                                      key={`${getString(pair.id) || 'pair'}-${pairIndex}`}
                                      className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
                                    >
                                      <div className="mb-3 flex items-center justify-between gap-3">
                                        <div>
                                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                                            Pair {pairIndex + 1}
                                          </div>
                                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                                            {sourceContentType ? (
                                              <span className="rounded-full bg-brand-50 px-2 py-1 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">
                                                {sourceContentType}
                                              </span>
                                            ) : null}
                                            {sourcePhraseId ? (
                                              <span className="rounded-full bg-gray-100 px-2 py-1 dark:bg-gray-800">
                                                phrase linked
                                              </span>
                                            ) : (
                                              <span className="rounded-full bg-gray-100 px-2 py-1 dark:bg-gray-800">
                                                manual
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              openPhrasePicker({
                                                mode: 'matchingPairItem',
                                                stepIndex: index,
                                                pairIndex,
                                              })
                                            }
                                            disabled={!selectedCourse?.target_language_id}
                                            className="rounded-lg border border-brand-300 px-3 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-950/30"
                                          >
                                            {sourcePhraseId ? 'Replace phrase' : 'Use phrase'}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => removeStepCollectionItem(index, 'pairs', pairIndex)}
                                            className="rounded-lg border border-red-300 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
                                          >
                                            Remove
                                          </button>
                                        </div>
                                      </div>
                                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900/60">
                                        <div className="text-lg font-semibold text-gray-900 dark:text-white">
                                          {getString(pair.yorubaText) || 'No Yoruba text'}
                                        </div>
                                        <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                                          {getString(pair.englishText) || 'No English text'}
                                        </div>
                                      </div>
                                      <details className="mt-4 rounded-lg border border-dashed border-gray-300 px-3 py-3 dark:border-gray-700">
                                        <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-200">
                                          Advanced fields
                                        </summary>
                                        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                                           <div>
                                             <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Pair id <span className="text-gray-400">(auto-generated)</span></label>
                                             <input
                                               value={getString(pair.id)}
                                               readOnly
                                               className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400"
                                             />
                                           </div>
                                          <div>
                                            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">English text</label>
                                            <input
                                              value={getString(pair.englishText)}
                                              onChange={(event) =>
                                                updateStepCollectionItemField(index, 'pairs', pairIndex, 'englishText', event.target.value)
                                              }
                                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                            />
                                          </div>
                                          <div className="lg:col-span-2">
                                            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Yoruba text</label>
                                            <input
                                              value={getString(pair.yorubaText)}
                                              onChange={(event) =>
                                                updateStepCollectionItemField(index, 'pairs', pairIndex, 'yorubaText', event.target.value)
                                              }
                                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                            />
                                          </div>
                                        <div className="lg:col-span-2">
                                          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Pair audio URL</label>
                                          <div className="flex gap-2">
                                            <input
                                              {...getFieldPathAttributes(pairAudioFieldPath)}
                                              value={getString(pair.audioUrl)}
                                              readOnly
                                              className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-800/60 dark:text-white"
                                            />
                                            <button
                                              type="button"
                                              onClick={() => openAssetPicker(pairAudioFieldPath, 'audio/*', 'Audio')}
                                              disabled={uploadingFieldPath === pairAudioFieldPath}
                                              className="rounded-lg border border-brand-300 bg-white px-3 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:border-brand-800 dark:bg-gray-900 dark:text-brand-300 dark:hover:bg-brand-950/30"
                                            >
                                              {uploadingFieldPath === pairAudioFieldPath
                                                ? `Uploading ${uploadProgressByField[pairAudioFieldPath] ?? 0}%`
                                                : 'Upload'}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => openAssetLibrary(pairAudioFieldPath)}
                                              className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                                                assetLibraryTargetFieldPath === pairAudioFieldPath
                                                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-300'
                                                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200'
                                              }`}
                                            >
                                              Library
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleGenerateAudio(pairAudioFieldPath, getString(pair.yorubaText) || getString(pair.englishText) || `pair ${pairIndex + 1}`)}
                                              disabled={generatingAudioFieldPath === pairAudioFieldPath}
                                              className="rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-300"
                                            >
                                              {generatingAudioFieldPath === pairAudioFieldPath ? 'Generating…' : 'Generate'}
                                            </button>
                                          </div>
                                          {getString(pair.audioUrl) ? (
                                            <div className="mt-3">
                                              <MediaLinkPreview url={getString(pair.audioUrl)} label={`Pair ${pairIndex + 1} audio`} kind="audio" compact />
                                            </div>
                                          ) : null}
                                        </div>
                                        <div className="lg:col-span-2">
                                          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Pair image URL</label>
                                          <div className="flex gap-2">
                                            <input
                                              {...getFieldPathAttributes(pairImageFieldPath)}
                                              value={getString(pair.imageUrl)}
                                              readOnly
                                              className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-800/60 dark:text-white"
                                            />
                                            <button
                                              type="button"
                                              onClick={() => openAssetPicker(pairImageFieldPath, 'image/*', 'Image')}
                                              disabled={uploadingFieldPath === pairImageFieldPath}
                                              className="rounded-lg border border-brand-300 bg-white px-3 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:border-brand-800 dark:bg-gray-900 dark:text-brand-300 dark:hover:bg-brand-950/30"
                                            >
                                              {uploadingFieldPath === pairImageFieldPath
                                                ? `Uploading ${uploadProgressByField[pairImageFieldPath] ?? 0}%`
                                                : 'Upload'}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => openAssetLibrary(pairImageFieldPath)}
                                              className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                                                assetLibraryTargetFieldPath === pairImageFieldPath
                                                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-300'
                                                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200'
                                              }`}
                                            >
                                              Library
                                            </button>
                                          </div>
                                          {getString(pair.imageUrl) ? (
                                            <div className="mt-3">
                                              <MediaLinkPreview
                                                url={getString(pair.imageUrl)}
                                                label={`Pair ${pairIndex + 1} image`}
                                                kind="image"
                                                compact
                                                onRemove={() => void handleRemoveAsset(pairImageFieldPath)}
                                              />
                                            </div>
                                          ) : null}
                                        </div>
                                        </div>
                                      </details>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        )}
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Image URL</label>
                          <div className="flex gap-2">
                            <input
                              {...getFieldPathAttributes(`steps[${index}].imageUrl`)}
                              value={getString(step.imageUrl)}
                              readOnly
                              className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-800/60 dark:text-white"
                            />
                            <button
                              type="button"
                              onClick={() => openAssetPicker(`steps[${index}].imageUrl`, 'image/*', 'Image')}
                              disabled={uploadingFieldPath === `steps[${index}].imageUrl`}
                              className="rounded-lg border border-brand-300 bg-white px-3 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:border-brand-800 dark:bg-gray-900 dark:text-brand-300 dark:hover:bg-brand-950/30"
                            >
                              {uploadingFieldPath === `steps[${index}].imageUrl`
                                ? `Uploading ${uploadProgressByField[`steps[${index}].imageUrl`] ?? 0}%`
                                : 'Upload'}
                            </button>
                            <button
                              type="button"
                              onClick={() => openAssetLibrary(`steps[${index}].imageUrl`)}
                              className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                                assetLibraryTargetFieldPath === `steps[${index}].imageUrl`
                                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-300'
                                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200'
                              }`}
                            >
                              Library
                            </button>
                          </div>
                          {getString(step.imageUrl) ? (
                            <div className="mt-3">
                              <MediaLinkPreview
                                url={getString(step.imageUrl)}
                                label={`Step ${index + 1} image`}
                                kind="image"
                                compact
                                onRemove={() => void handleRemoveAsset(`steps[${index}].imageUrl`)}
                              />
                            </div>
                          ) : null}
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Audio URL</label>
                          <div className="flex gap-2">
                            <input
                              {...getFieldPathAttributes(`steps[${index}].audioUrl`)}
                              value={getString(step.audioUrl)}
                              readOnly
                              className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-800/60 dark:text-white"
                            />
                            <button
                              type="button"
                              onClick={() => openAssetPicker(`steps[${index}].audioUrl`, 'audio/*', 'Audio')}
                              disabled={uploadingFieldPath === `steps[${index}].audioUrl`}
                              className="rounded-lg border border-brand-300 bg-white px-3 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:border-brand-800 dark:bg-gray-900 dark:text-brand-300 dark:hover:bg-brand-950/30"
                            >
                              {uploadingFieldPath === `steps[${index}].audioUrl`
                                ? `Uploading ${uploadProgressByField[`steps[${index}].audioUrl`] ?? 0}%`
                                : 'Upload'}
                            </button>
                            <button
                              type="button"
                              onClick={() => openAssetLibrary(`steps[${index}].audioUrl`)}
                              className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                                assetLibraryTargetFieldPath === `steps[${index}].audioUrl`
                                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-300'
                                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200'
                              }`}
                            >
                              Library
                            </button>
                            <button
                              type="button"
                              onClick={() => handleGenerateAudio(`steps[${index}].audioUrl`, getString(step.yorubaText) || getString(step.phrase) || getString(step.title) || getString(step.prompt) || `step ${index + 1}`)}
                              disabled={generatingAudioFieldPath === `steps[${index}].audioUrl`}
                              className="rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-300"
                            >
                              {generatingAudioFieldPath === `steps[${index}].audioUrl` ? 'Generating…' : 'Generate'}
                            </button>
                          </div>
                          {getString(step.audioUrl) ? (
                            <div className="mt-3">
                              <MediaLinkPreview url={getString(step.audioUrl)} label={`Step ${index + 1} audio`} kind="audio" compact />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 xl:sticky xl:top-6 xl:self-start">
            <LessonRuntimePreview
              heading="Learner Preview"
              blueprint={{
                blueprint_key: form.blueprint_key || getString(editablePayload.id) || 'draft_blueprint',
                lesson_kind: form.lesson_kind,
                payload: editablePayload,
                status: mode,
              }}
              targetLanguageId={blueprint?.target_language_id || selectedCourse?.target_language_id || null}
            />
          </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="raw-payload-json" className="text-base font-semibold text-gray-900 dark:text-white">Raw Payload JSON</label>
              <button
                type="button"
                onClick={() => {
                  const formatted = formatJson(payloadText);
                  setPayloadText(formatted);
                  const parsed = safeParsePayload(formatted);
                  if (parsed) {
                    setLastValidPayload(parsed);
                    setForm((prev) => ({ ...prev, payload: parsed }));
                  }
                }}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-white/[0.03]"
              >
                Format JSON
              </button>
            </div>

            <textarea
              id="raw-payload-json"
              value={payloadText}
              onChange={(event) => handlePayloadTextChange(event.target.value)}
              spellCheck={false}
              className="mt-4 h-[360px] w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-3 font-mono text-xs text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handlePreview}
          disabled={isPreviewing || isSaving}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-white/[0.03]"
        >
          {isPreviewing ? 'Previewing…' : 'Preview Validate'}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || isPreviewing}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : mode === 'create' ? 'Create Draft' : 'Save Draft'}
        </button>
        {mode === 'edit' && blueprint && (
          <button
            type="button"
            onClick={handleClone}
            disabled={isCloning || isSaving || isPreviewing}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-white/[0.03]"
          >
            {isCloning ? 'Cloning…' : 'Clone Draft'}
          </button>
        )}
      </div>

      <Modal
        isOpen={!!phrasePickerTarget}
        onClose={() => setPhrasePickerTarget(null)}
        title="Import From Phrases"
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
              Search phrases
            </label>
            <input
              value={phraseSearch}
              onChange={(event) => setPhraseSearch(event.target.value)}
              placeholder="Search phrase or translation"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </div>

          {!selectedCourse?.target_language_id ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
              Select a course with a target language before importing phrases.
            </div>
          ) : null}

          {phraseError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">
              {phraseError}
            </div>
          ) : null}

          <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
            {isPhraseLoading ? (
              <div className="rounded-lg border border-dashed border-gray-300 px-3 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                Loading phrases…
              </div>
            ) : phraseItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 px-3 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                No phrases found for this language.
              </div>
            ) : (
              phraseItems.map((phrase) => (
                <button
                  key={phrase.id}
                  type="button"
                  onClick={() => applyPhraseSelection(phrase)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-left hover:border-brand-300 hover:bg-brand-50/40 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-800 dark:hover:bg-brand-950/20"
                >
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{phrase.phrase}</div>
                  <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">{phrase.translation}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                    {phrase.category ? <span>{phrase.category}</span> : null}
                    {phrase.audio_url ? <span>Has audio</span> : <span>No audio</span>}
                    {phrase.is_published ? <span>Published</span> : <span>Draft</span>}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </Modal>

      {showPreviewResult && previewResult && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Preview Result</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Validation is computed against the current draft payload before publish.
            </p>
          </div>
          <ValidationResultViewer validation={previewResult.validation} />
        </div>
      )}
    </div>
  );
}

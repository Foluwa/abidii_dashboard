'use client';

import React, { useMemo } from 'react';

import StatusBadge from '@/components/admin/StatusBadge';
import MediaLinkPreview from '@/components/admin/curriculum/MediaLinkPreview';
import { useCurriculumVocabLibrary } from '@/hooks/useApi';
import type { AvailabilityStatus } from '@/types/curriculum';

type PreviewBlueprintShape = {
  blueprint_key: string;
  lesson_kind: string;
  payload: Record<string, unknown>;
  availability?: AvailabilityStatus | null;
  status?: string | null;
};

const STEP_TYPE_LABELS: Record<string, string> = {
  guessMeaning: 'Guess meaning',
  matchingPairs: 'Match pairs',
  wordBuilder: 'Build the word',
  dialogueContext: 'Read dialogue',
  listeningTiles: 'Listen and choose',
  recognitionTask: 'Recognition check',
  immediateResult: 'Checkpoint result',
  recognition: 'Recognition check',
  listening: 'Listen and choose',
  intro: 'Lesson intro',
  introCard: 'Lesson intro',
  infoCard: 'Info card',
  summary: 'Lesson summary',
  summaryCard: 'Lesson summary',
};

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item));
}

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'number' ? item : null))
    .filter((item): item is number => item !== null);
}

function asObjectList(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null && !Array.isArray(item)
  );
}

function humanizeIdentifier(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getVocabDisplayLabel(externalId: string, lemma?: string | null): string {
  const normalizedLemma = lemma?.trim();
  if (normalizedLemma) {
    return normalizedLemma;
  }
  return humanizeIdentifier(externalId.replace(/^vocab_/i, ''));
}

function getStepType(step: Record<string, unknown>): string | null {
  return (
    asString(step.type) ||
    asString(step.runtimeType) ||
    asString(step.stepType) ||
    asString(step.stepId)
  );
}

function getStepContext(step: Record<string, unknown>): string | null {
  const raw =
    asString(step.title) ||
    asString(step.prompt) ||
    asString(step.promptText) ||
    asString(step.instruction) ||
    asString(step.question) ||
    asString(step.text) ||
    asString(step.body) ||
    asString(step.contextDescription) ||
    asString(step.headline) ||
    asString(step.targetWord) ||
    asString(step.correctAnswer) ||
    asString(step.yorubaText);

  if (!raw) return null;
  const compact = raw.replace(/\s+/g, ' ').trim();
  if (!compact) return null;
  return compact.length > 48 ? `${compact.slice(0, 45).trimEnd()}...` : compact;
}

function getStepItems(step: Record<string, unknown>): string[] {
  const pairItems = asObjectList(step.pairs)
    .map((item) => asString(item.yorubaText) || asString(item.primaryText) || asString(item.englishText))
    .filter((item): item is string => Boolean(item));
  if (pairItems.length > 0) {
    return pairItems;
  }

  const optionItems = asObjectList(step.options)
    .map((item) => asString(item.primaryText) || asString(item.yorubaText) || asString(item.englishText))
    .filter((item): item is string => Boolean(item));
  if (optionItems.length > 0) {
    return optionItems;
  }

  const directItems = [
    asString(step.correctAnswer),
    asString(step.yorubaText),
    asString(step.highlightedWord),
  ].filter((item): item is string => Boolean(item));

  return directItems;
}

function summarizeStepItems(step: Record<string, unknown>): string | null {
  const uniqueItems = [...new Set(getStepItems(step).map((item) => item.trim()).filter(Boolean))];
  if (uniqueItems.length === 0) return null;

  const previewItems = uniqueItems.slice(0, 4);
  const joined = previewItems.join(', ');
  const suffix = uniqueItems.length > 4 ? ' +' : '';
  const compact = `${joined}${suffix}`;
  return compact.length > 42 ? `${compact.slice(0, 39).trimEnd()}...` : compact;
}

function getStepLabel(step: Record<string, unknown>, index: number) {
  const explicitTitle = asString(step.title);
  if (explicitTitle) {
    return explicitTitle;
  }

  const stepType = getStepType(step);
  const stepContext = getStepContext(step);
  const stepItems = summarizeStepItems(step);

  if (stepType) {
    const friendlyType = STEP_TYPE_LABELS[stepType] || humanizeIdentifier(stepType);
    if (stepItems) {
      return `${friendlyType}: ${stepItems}`;
    }
    if (stepContext && stepContext.toLowerCase() !== friendlyType.toLowerCase()) {
      return `${friendlyType}: ${stepContext}`;
    }
    return friendlyType;
  }

  if (stepContext) {
    return stepContext;
  }

  return `Step ${index + 1}`;
}

function summarizeFlow(lessonKind: string, payload: Record<string, unknown>) {
  const steps = asObjectList(payload.steps);
  if (steps.length > 0) {
    return {
      owner:
        lessonKind === 'alphabet_drill'
          ? 'Alphabet lesson'
          : lessonKind === 'tone_marks_drill'
          ? 'Phonics lesson'
          : lessonKind === 'numbers_1_10'
          ? 'Numbers lesson'
          : 'Structured lesson',
      generated: false,
      flow: steps.map((step, index) => getStepLabel(step, index)),
    };
  }

  if (lessonKind === 'alphabet_drill') {
    return {
      owner: 'Alphabet lesson',
      generated: true,
      flow: ['Alphabet intro', 'Letter practice', 'Listening', 'Recognition', 'Summary'],
    };
  }

  if (lessonKind === 'tone_marks_drill') {
    return {
      owner: 'Phonics lesson',
      generated: true,
      flow: ['Contrast intro', 'Tone listening', 'Recognition', 'Concept checks', 'Summary'],
    };
  }

  if (lessonKind === 'numbers_1_10') {
    return {
      owner: 'Numbers lesson',
      generated: true,
      flow: ['Overview', 'Recognition', 'Listening', 'Concept checks', 'Matching', 'Summary'],
    };
  }

  if (lessonKind === 'reading_practice') {
    return {
      owner: 'Structured lesson',
      generated: true,
      flow: ['Guess meaning', 'Matching', 'Word builder', 'Dialogue', 'Listening', 'Recognition'],
    };
  }

  if (lessonKind === 'greetings_core') {
    return {
      owner: 'Structured lesson',
      generated: true,
      flow: ['Overview', 'Vocabulary intro', 'Guided practice', 'Listening', 'Recognition', 'Summary'],
    };
  }

  return {
    owner: 'Structured lesson',
    generated: false,
    flow: [],
  };
}

function collectTopLevelMedia(payload: Record<string, unknown>) {
  const candidates = [
    ['Hero image', payload.heroImageUrl],
    ['Cover image', payload.coverImageUrl],
    ['Image', payload.imageUrl],
    ['Audio', payload.audioUrl],
    ['Video', payload.videoUrl],
  ] as const;

  return candidates
    .map(([label, value]) => ({ label, value: asString(value) }))
    .filter((item): item is { label: string; value: string } => Boolean(item.value));
}

export function LessonRuntimePreview({
  blueprint,
  heading,
  compact = false,
  targetLanguageId,
}: {
  blueprint: PreviewBlueprintShape;
  heading?: string;
  compact?: boolean;
  targetLanguageId?: string | null;
}) {
  const payload = useMemo(() => blueprint.payload || {}, [blueprint.payload]);
  const flowSummary = useMemo(
    () => summarizeFlow(blueprint.lesson_kind, payload),
    [blueprint.lesson_kind, payload]
  );
  const targetVocabIds = asStringArray(payload.targetVocabIds);
  const { items: vocabLibraryItems } = useCurriculumVocabLibrary({
    language_id: targetLanguageId || undefined,
    external_ids: targetVocabIds,
    limit: Math.max(targetVocabIds.length, 20),
  });
  const vocabLabels = useMemo(() => {
    return vocabLibraryItems.reduce<Record<string, string>>((acc, item) => {
      const label = getVocabDisplayLabel(item.external_id, item.lemma);
      acc[item.external_id] = label;
      return acc;
    }, {});
  }, [vocabLibraryItems]);
  const range = asNumberArray(payload.range);
  const steps = asObjectList(payload.steps);
  const media = collectTopLevelMedia(payload);
  const title =
    asString(payload.title) || asString(payload.id) || blueprint.blueprint_key || 'Untitled lesson';
  const subtitle = asString(payload.description) || asString(payload.subtitle) || null;
  const mode = asString(payload.mode);
  const flowMode = asString(payload.flowMode);
  const contrastId = asString(payload.contrast_id);
  const unitLabel = asString(payload.unitLabel);
  const includeCultureTip = asBoolean(payload.includeCultureTip);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {heading && <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{heading}</h3>}
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status="info" label={flowSummary.owner} />
          <StatusBadge status="draft" label={blueprint.lesson_kind} />
          {blueprint.status ? <StatusBadge status="info" label={blueprint.status} /> : null}
          {blueprint.availability ? (
            <StatusBadge
              status={
                blueprint.availability === 'available'
                  ? 'success'
                  : blueprint.availability === 'coming_soon'
                  ? 'pending'
                  : 'inactive'
              }
              label={blueprint.availability}
            />
          ) : null}
        </div>
        <div>
          <div className="text-base font-semibold text-gray-900 dark:text-white">{title}</div>
          {subtitle ? (
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</div>
          ) : null}
          <div className="mt-1 text-xs font-mono text-gray-500 dark:text-gray-400">
            {blueprint.blueprint_key}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
            Lesson Config
          </div>
          <div className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-200">
            {mode ? <div><span className="font-medium">Mode:</span> {mode}</div> : null}
            {flowMode ? <div><span className="font-medium">Flow mode:</span> {flowMode}</div> : null}
            {unitLabel ? <div><span className="font-medium">Unit label:</span> {unitLabel}</div> : null}
            {contrastId ? <div><span className="font-medium">Contrast:</span> {contrastId}</div> : null}
            {range.length === 2 ? (
              <div>
                <span className="font-medium">Range:</span> {range[0]} to {range[1]}
              </div>
            ) : null}
            {includeCultureTip !== null ? (
              <div>
                <span className="font-medium">Culture tip:</span>{' '}
                {includeCultureTip ? 'Included' : 'Not included'}
              </div>
            ) : null}
            {targetVocabIds.length > 0 ? (
              <div>
                <div className="font-medium">Vocabulary bindings</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {targetVocabIds.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900"
                      title={item}
                    >
                      {vocabLabels[item] || getVocabDisplayLabel(item)}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
            Runtime Flow
          </div>
          {flowSummary.generated ? (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              This lesson family is generated from backend inventory at runtime. The preview below shows the learner
              flow shape and authoring inputs, not a pixel-perfect mobile render.
            </p>
          ) : null}
          {flowSummary.flow.length > 0 ? (
            <div className="mt-3 space-y-2">
              {flowSummary.flow.map((item, index) => (
                <div
                  key={`${item}-${index}`}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200"
                >
                  <span className="mr-2 text-xs font-mono text-gray-400">{index + 1}.</span>
                  {item}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              No explicit learner steps are defined yet.
            </p>
          )}
        </div>
      </div>

      {media.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
            Top-level Media
          </div>
          <div className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-200">
            {media.map((item) => (
              <MediaLinkPreview key={item.label} label={item.label} url={item.value} compact={compact} />
            ))}
          </div>
        </div>
      )}

      {steps.length > 0 && !compact && (
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
            Step Content
          </div>
          <div className="mt-3 space-y-3">
            {steps.map((step, index) => {
              const stepMedia = collectTopLevelMedia(step);
              const prompt =
                asString(step.prompt) ||
                asString(step.body) ||
                asString(step.text) ||
                asString(step.instruction);
              const stepType = asString(step.type) || asString(step.stepId) || `step_${index + 1}`;
              return (
                <div
                  key={`${stepType}-${index}`}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-gray-300 bg-white px-2 py-1 text-xs font-medium dark:border-gray-700 dark:bg-gray-900">
                      {stepType}
                    </span>
                    <span className="text-xs font-mono text-gray-400">#{index + 1}</span>
                  </div>
                  <div className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                    {getStepLabel(step, index)}
                  </div>
                  {prompt ? (
                    <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">{prompt}</div>
                  ) : null}
                  {stepMedia.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {stepMedia.map((item) => (
                        <MediaLinkPreview
                          key={item.label}
                          label={item.label}
                          url={item.value}
                          compact
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

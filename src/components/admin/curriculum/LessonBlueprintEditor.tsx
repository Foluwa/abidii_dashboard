'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

import Alert from '@/components/ui/alert/SimpleAlert';
import ValidationResultViewer from '@/components/admin/curriculum/ValidationResultViewer';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import { useToast } from '@/contexts/ToastContext';
import {
  useAdminBlueprintCapabilities,
  useAdminCoursesList,
  useCourseCurriculumByKey,
} from '@/hooks/useApi';
import {
  cloneAdminBlueprint,
  createAdminBlueprint,
  previewAdminBlueprintDraft,
  updateAdminBlueprint,
} from '@/lib/adminCurriculumApi';
import type {
  CourseAdminListItem,
  CurriculumSection,
  LessonBlueprintAdminResponse,
  LessonKindCapability,
  LessonBlueprintValidationResponse,
  LessonBlueprintDraftUpsertRequest,
} from '@/types/curriculum';

type Mode = 'create' | 'edit';

type SectionOption = {
  value: string;
  label: string;
  section: CurriculumSection;
};

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
export function LessonBlueprintEditor({
  mode,
  blueprint,
  onSaved,
  initialCourseKey,
  initialSectionId,
  initialBlueprintKey,
}: {
  mode: Mode;
  blueprint?: LessonBlueprintAdminResponse | null;
  onSaved?: (result: LessonBlueprintValidationResponse) => void;
  initialCourseKey?: string | null;
  initialSectionId?: string | null;
  initialBlueprintKey?: string | null;
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
  const [previewResult, setPreviewResult] = useState<LessonBlueprintValidationResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const hasAppliedInitialSectionRef = useRef(false);
  const hasAppliedInitialBlueprintKeyRef = useRef(false);

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
  } = useCourseCurriculumByKey(selectedCourseKey || null);

  const sectionOptions = useMemo<SectionOption[]>(() => {
    if (!curriculum) return [];
    return curriculum.units.flatMap((unit) =>
      unit.sections.map((section) => ({
        value: section.id,
        label: `${unit.title} / ${section.title} (${section.section_key})`,
        section,
      }))
    );
  }, [curriculum]);

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
      if (prev.blueprint_key.trim()) return prev;
      hasAppliedInitialBlueprintKeyRef.current = true;
      return {
        ...prev,
        blueprint_key: initialBlueprintKey,
      };
    });
  }, [initialBlueprintKey, mode]);

  useEffect(() => {
    if (mode !== 'create') return;
    if (!selectedLessonCapability) return;

    const trimmedPayload = payloadText.trim();
    if (trimmedPayload !== '' && trimmedPayload !== '{}') return;

    setPayloadText(JSON.stringify(selectedLessonCapability.default_payload ?? {}, null, 2));
    setForm((prev) => ({
      ...prev,
      payload: selectedLessonCapability.default_payload ?? {},
    }));
  }, [mode, payloadText, selectedLessonCapability]);

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

  const buildRequest = (): LessonBlueprintDraftUpsertRequest | null => {
    const payload = parsePayload();
    if (!payload) return null;

    if (!form.blueprint_key.trim()) {
      setErrorMessage('Blueprint key is required.');
      return null;
    }
    if (!form.course_id || !form.section_id) {
      setErrorMessage('Course and section are required.');
      return null;
    }

    return {
      ...form,
      blueprint_key: form.blueprint_key.trim(),
      payload,
    };
  };

  const handlePreview = async () => {
    const request = buildRequest();
    if (!request) return;

    setIsPreviewing(true);
    try {
      const result = await previewAdminBlueprintDraft(request);
      setPreviewResult(result);
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
    const suggested = `${form.blueprint_key}_copy`;
    const nextKey = window.prompt('New blueprint key for the cloned draft', suggested)?.trim();
    if (!nextKey) return;

    setIsCloning(true);
    try {
      const result = await cloneAdminBlueprint(blueprint.id, {
        blueprint_key: nextKey,
        course_id: form.course_id,
        section_id: form.section_id,
      });
      toast.success('Blueprint cloned to a new draft.');
      onSaved?.(result);
    } catch (error) {
      const message = extractErrorMessage(error);
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Blueprint Draft</h2>

          <div className="mt-4 grid grid-cols-1 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Blueprint key</label>
              <input
                value={form.blueprint_key}
                onChange={(event) => setForm((prev) => ({ ...prev, blueprint_key: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
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

        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Payload JSON</h2>
            <div className="flex items-center gap-2">
              {selectedLessonCapability && (
                <button
                  type="button"
                  onClick={() => {
                    setPayloadText(JSON.stringify(selectedLessonCapability.default_payload ?? {}, null, 2));
                    setForm((prev) => ({
                      ...prev,
                      payload: selectedLessonCapability.default_payload ?? {},
                    }));
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-white/[0.03]"
                >
                  Use Backend Template
                </button>
              )}
              <button
                type="button"
                onClick={() => setPayloadText((prev) => formatJson(prev))}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-white/[0.03]"
              >
                Format JSON
              </button>
            </div>
          </div>

          <textarea
            value={payloadText}
            onChange={(event) => setPayloadText(event.target.value)}
            spellCheck={false}
            className="mt-4 h-[420px] w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-3 font-mono text-xs text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />
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

      {previewResult && (
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

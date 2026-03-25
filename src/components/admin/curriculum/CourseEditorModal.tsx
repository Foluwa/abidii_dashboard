'use client';

import React, { useMemo, useState } from 'react';

import Alert from '@/components/ui/alert/SimpleAlert';
import { Modal } from '@/components/ui/modal';
import { StyledSelect } from '@/components/ui/form/StyledSelect';
import { useLanguages } from '@/hooks/useApi';
import type { CourseAdminResponse, CourseDraftUpsertRequest } from '@/types/curriculum';
import type { Language } from '@/types/api';

type CourseEditorMode = 'create' | 'edit';

type DraftState = {
  course_key: string;
  title: string;
  description: string;
  target_language_id: string;
};

function buildDraft(course?: CourseAdminResponse | null): DraftState {
  return {
    course_key: course?.course_key ?? '',
    title: course?.title ?? '',
    description: course?.description ?? '',
    target_language_id: course?.target_language_id ?? '',
  };
}

export function CourseEditorModal({
  isOpen,
  mode,
  course,
  isSaving,
  errorMessage,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  mode: CourseEditorMode;
  course?: CourseAdminResponse | null;
  isSaving?: boolean;
  errorMessage?: string;
  onClose: () => void;
  onSubmit: (payload: CourseDraftUpsertRequest) => Promise<void> | void;
}) {
  const { languages, isLoading: isLoadingLanguages } = useLanguages();
  const [draft, setDraft] = useState<DraftState>(() => buildDraft(course));

  const languageOptions = useMemo(
    () =>
      (languages as Language[]).map((language) => ({
        value: language.id,
        label: `${language.name} (${language.iso_639_3})`,
      })),
    [languages]
  );
  const effectiveTargetLanguageId = draft.target_language_id || languageOptions[0]?.value || '';

  const submitDisabled =
    isSaving ||
    !draft.course_key.trim() ||
    !draft.title.trim() ||
    !effectiveTargetLanguageId;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitDisabled) return;
    await onSubmit({
      course_key: draft.course_key.trim(),
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      target_language_id: effectiveTargetLanguageId,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSaving ? () => undefined : onClose}
      title={mode === 'create' ? 'Create Course' : 'Edit Course'}
      maxWidth="2xl"
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

        <div>
          <label htmlFor="course-editor-key" className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            Course key
          </label>
          <input
            id="course-editor-key"
            value={draft.course_key}
            onChange={(event) =>
              setDraft((current) => ({ ...current, course_key: event.target.value }))
            }
            placeholder="abidii_yoruba_v2"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            This becomes the public curriculum key used by dashboard and mobile routes.
          </p>
        </div>

        <div>
          <label htmlFor="course-editor-title" className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            Title
          </label>
          <input
            id="course-editor-title"
            value={draft.title}
            onChange={(event) =>
              setDraft((current) => ({ ...current, title: event.target.value }))
            }
            placeholder="Abidii Yoruba v2"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>

        <div>
          <label htmlFor="course-editor-language" className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            Target language
          </label>
          <StyledSelect
            id="course-editor-language"
            value={effectiveTargetLanguageId}
            onChange={(event) =>
              setDraft((current) => ({ ...current, target_language_id: event.target.value }))
            }
            options={languageOptions}
            placeholder={isLoadingLanguages ? 'Loading languages…' : 'Select language'}
            fullWidth
          />
        </div>

        <div>
          <label htmlFor="course-editor-description" className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            Description
          </label>
          <textarea
            id="course-editor-description"
            rows={4}
            value={draft.description}
            onChange={(event) =>
              setDraft((current) => ({ ...current, description: event.target.value }))
            }
            placeholder="Short course description for dashboard context."
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            disabled={!!isSaving}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-white/[0.03]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitDisabled}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : mode === 'create' ? 'Create Course' : 'Save Course'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

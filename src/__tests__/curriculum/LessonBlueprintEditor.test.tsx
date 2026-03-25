import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LessonBlueprintEditor } from '@/components/admin/curriculum/LessonBlueprintEditor';
import { renderWithProviders as render } from '@/test-utils';

const mockUseAdminCoursesList = jest.fn();
const mockUseAdminBlueprintCapabilities = jest.fn();
const mockUseCourseCurriculumByKey = jest.fn();
const mockUseAdminBlueprintAssetLibrary = jest.fn();
const mockUseCurriculumVocabLibrary = jest.fn();
const mockUsePhonicsContrasts = jest.fn();

jest.mock('@/hooks/useApi', () => ({
  useAdminCoursesList: (params: any) => mockUseAdminCoursesList(params),
  useAdminBlueprintCapabilities: () => mockUseAdminBlueprintCapabilities(),
  useCourseCurriculumByKey: (courseKey: string | null) => mockUseCourseCurriculumByKey(courseKey),
  useAdminBlueprintAssetLibrary: (filters: any) => mockUseAdminBlueprintAssetLibrary(filters),
  useCurriculumVocabLibrary: (filters: any) => mockUseCurriculumVocabLibrary(filters),
  usePhonicsContrasts: (languageCode: string | null) => mockUsePhonicsContrasts(languageCode),
}));

jest.mock('@/lib/adminCurriculumApi', () => ({
  createAdminBlueprint: jest.fn(),
  updateAdminBlueprint: jest.fn(),
  cloneAdminBlueprint: jest.fn(),
  previewAdminBlueprintDraft: jest.fn(),
}));

describe('LessonBlueprintEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAdminCoursesList.mockReturnValue({
      data: {
        items: [
          {
            id: 'course-1',
            course_key: 'abidii_yoruba_v1',
            title: 'Abidii Yoruba',
            target_language_name: 'Yoruba',
            target_language_code: 'yor',
          },
        ],
      },
    });

    mockUseAdminBlueprintCapabilities.mockReturnValue({
      data: {
        lesson_kinds: [
          {
            key: 'reading_practice',
            label: 'Reading practice',
            runtime_family: 'structured',
            validation_supported: true,
            publish_supported: true,
            mobile_fallback_required: false,
            default_payload: {
              id: 'lesson_reading_practice_01',
              mode: 'reading_practice',
              flowMode: 'reading_batched',
              targetVocabIds: ['vocab_kaabo', 'vocab_odabo'],
            },
          },
        ],
      },
      isError: false,
    });

    mockUseCourseCurriculumByKey.mockReturnValue({
      curriculum: {
        units: [
          {
            unit_key: 'U1',
            title: 'Unit 1',
            sections: [
              {
                id: 'section-1',
                section_key: 'S1',
                title: 'Reading Practice',
              },
            ],
          },
        ],
      },
      isLoading: false,
    });
    mockUseAdminBlueprintAssetLibrary.mockReturnValue({
      items: [],
      isLoading: false,
    });
    mockUseCurriculumVocabLibrary.mockReturnValue({
      items: [
        { external_id: 'vocab_kaabo', lemma: 'kaabo' },
        { external_id: 'vocab_odabo', lemma: 'odabo' },
      ],
      isLoading: false,
    });
    mockUsePhonicsContrasts.mockReturnValue({
      contrasts: [
        { id: 'contrast-1', title: 'e vs e-dot', letter_a_glyph: 'e', letter_b_glyph: 'ẹ' },
      ],
      isLoading: false,
    });
  });

  it('updates the payload JSON from structured learner-content fields', async () => {
    render(
      <LessonBlueprintEditor
        mode="create"
        initialCourseKey="abidii_yoruba_v1"
        initialSectionId="section-1"
      />
    );

    const titleInput = await screen.findByLabelText('Title');
    const rawPayload = screen.getByLabelText('Raw Payload JSON');

    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Reading Practice Draft');
    await userEvent.click(screen.getAllByRole('button', { name: /vocab_kaabo/i })[0]);
    await userEvent.click(screen.getAllByRole('button', { name: /vocab_odabo/i })[0]);

    expect(screen.getByDisplayValue('Reading Practice Draft')).toBeInTheDocument();
    expect((rawPayload as HTMLTextAreaElement).value).toContain('"title": "Reading Practice Draft"');
    expect(screen.getAllByText(/vocab_kaabo/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/vocab_odabo/i).length).toBeGreaterThan(0);
  });

  it('adds vocab from the constrained picker', async () => {
    render(
      <LessonBlueprintEditor
        mode="create"
        initialCourseKey="abidii_yoruba_v1"
        initialSectionId="section-1"
      />
    );

    await userEvent.click((await screen.findAllByRole('button', { name: /vocab_kaabo/i }))[0]);

    expect(screen.getAllByText(/vocab_kaabo/i).length).toBeGreaterThan(0);
  });
});

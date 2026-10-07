import React from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LessonBlueprintEditor } from '@/components/admin/curriculum/LessonBlueprintEditor';
import { renderWithProviders as render, chooseOption } from '@/test-utils';

const mockUseAdminCoursesList = jest.fn();
const mockUseAdminBlueprintCapabilities = jest.fn();
const mockUseAdminCourseCurriculumByKey = jest.fn();
const mockUseAdminBlueprintAssetLibrary = jest.fn();
const mockUseCurriculumVocabLibrary = jest.fn();
const mockUsePhonicsContrasts = jest.fn();

jest.mock('@/hooks/useApi', () => ({
  useAdminCoursesList: (params: any) => mockUseAdminCoursesList(params),
  useAdminBlueprintCapabilities: () => mockUseAdminBlueprintCapabilities(),
  useAdminCourseCurriculumByKey: (courseKey: string | null) => mockUseAdminCourseCurriculumByKey(courseKey),
  useAdminBlueprintAssetLibrary: (filters: any) => mockUseAdminBlueprintAssetLibrary(filters),
  useCurriculumVocabLibrary: (filters: any) => mockUseCurriculumVocabLibrary(filters),
  usePhonicsContrasts: (languageCode: string | null) => mockUsePhonicsContrasts(languageCode),
}));

jest.mock('@/lib/adminCurriculumApi', () => ({
  createAdminBlueprint: jest.fn(),
  updateAdminBlueprint: jest.fn(),
  cloneAdminBlueprint: jest.fn(),
  previewAdminBlueprintDraft: jest.fn(),
  uploadBlueprintAsset: jest.fn(),
  deleteBlueprintAsset: jest.fn(),
}));

const baseBlueprint = {
  id: 'blueprint-1',
  blueprint_key: 'lesson_reading_practice_01',
  course_id: 'course-1',
  section_id: 'section-1',
  course_key: 'abidii_yoruba_v1',
  lesson_kind: 'reading_practice',
  schema_version: 1,
  status: 'draft',
  enabled: true,
  payload: {
    id: 'lesson_reading_practice_01',
    title: 'Reading Practice',
    mode: 'reading_practice',
    flowMode: 'reading_batched',
    heroImageUrl: 'https://cdn.example.com/media/hero-image.png',
    audioUrl: 'https://cdn.example.com/media/lesson-audio.mp3',
    mediaBindings: {
      heroImageUrl: {
        field_path: 'heroImageUrl',
        asset_kind: 'image',
        storage_key: 'hero-key',
        asset_url: 'https://cdn.example.com/media/hero-image.png',
        file_name: 'hero-image.png',
        uploaded_at: '2026-03-26T10:00:00Z',
      },
      audioUrl: {
        field_path: 'audioUrl',
        asset_kind: 'audio',
        storage_key: 'audio-key',
        asset_url: 'https://cdn.example.com/media/lesson-audio.mp3',
        file_name: 'lesson-audio.mp3',
        uploaded_at: '2026-03-26T11:00:00Z',
      },
    },
    steps: [
      {
        type: 'matchingPairs',
        pairs: [
          {
            id: 'pair_1',
            yorubaText: 'Kaabo',
            englishText: 'Welcome',
            audioUrl: 'https://cdn.example.com/media/pair-audio.mp3',
            imageUrl: 'https://cdn.example.com/media/pair-image.png',
          },
        ],
      },
    ],
  },
  validation_status: 'valid',
  validation_errors: {},
  validated_at: null,
  created_at: '2026-03-26T09:00:00Z',
  updated_at: '2026-03-26T09:00:00Z',
};

function renderEditor(props: Partial<React.ComponentProps<typeof LessonBlueprintEditor>> = {}) {
  return render(
    <LessonBlueprintEditor
      mode="create"
      initialCourseKey="abidii_yoruba_v1"
      initialSectionId="section-1"
      {...props}
    />
  );
}

// The editor is a very large component; under full-suite load its heavier
// interaction tests can exceed Jest's 5s default without anything being wrong.
jest.setTimeout(15000);

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
              kind: 'reading_practice',
              version: 1,
              lessonKey: 'lesson_reading_practice_01',
              presentation: {
                title: 'Reading Practice',
                subtitle: 'Backend-authored reading transfer set',
                unitLabel: 'Unit 1',
                estimatedMinutes: 4,
                exerciseOrderVersion: 1,
              },
              targets: [],
              mediaRefs: {
                thumbnail: { fieldPath: 'thumbnailUrl' },
                character: { fieldPath: 'characterImageUrl' },
              },
            },
          },
        ],
      },
      isError: false,
    });

    mockUseAdminCourseCurriculumByKey.mockReturnValue({
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
      items: [
        {
          blueprint_id: 'blueprint-2',
          blueprint_key: 'lesson_other_01',
          course_id: 'course-1',
          course_key: 'abidii_yoruba_v1',
          section_id: 'section-2',
          lesson_kind: 'reading_practice',
          field_path: 'audioUrl',
          binding: {
            field_path: 'audioUrl',
            asset_kind: 'audio',
            storage_key: 'global-audio-key',
            asset_url: 'https://cdn.example.com/media/global-audio.mp3',
            file_name: 'global-audio.mp3',
            uploaded_at: '2026-03-26T12:00:00Z',
          },
        },
        {
          blueprint_id: 'blueprint-3',
          blueprint_key: 'lesson_other_02',
          course_id: 'course-1',
          course_key: 'abidii_yoruba_v1',
          section_id: 'section-3',
          lesson_kind: 'reading_practice',
          field_path: 'heroImageUrl',
          binding: {
            field_path: 'heroImageUrl',
            asset_kind: 'image',
            storage_key: 'global-image-key',
            asset_url: 'https://cdn.example.com/media/global-image.png',
            file_name: 'global-image.png',
            uploaded_at: '2026-03-26T08:00:00Z',
          },
        },
      ],
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

  it('updates the payload JSON from compact reading authoring fields', async () => {
    renderEditor();

    const titleInput = await screen.findByLabelText('Title');
    const rawPayload = screen.getByLabelText('Raw Payload JSON');

    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Reading Practice Draft');

    expect(screen.getByDisplayValue('Reading Practice Draft')).toBeInTheDocument();
    expect((rawPayload as HTMLTextAreaElement).value).toContain('"presentation"');
    expect((rawPayload as HTMLTextAreaElement).value).toContain('"title": "Reading Practice Draft"');
  });

  it('shows the compact runtime banner for reading authoring', async () => {
    renderEditor();

    expect(
      await screen.findByText('Compact mode. Mobile runtime still uses targetVocabIds until phrase-target runtime is wired end-to-end.')
    ).toBeInTheDocument();
  });

  it('opens the asset-library modal and shows assets in the 5-column grid layout', async () => {
    renderEditor({ mode: 'edit', blueprint: baseBlueprint as any });

    await userEvent.click(screen.getByRole('button', { name: 'Open library' }));

    const modal = screen.getByLabelText('Media library modal content');
    const localGrid = within(modal).getByLabelText('Local media asset grid');

    expect(localGrid.className).toContain('xl:grid-cols-5');
    expect(within(localGrid).getAllByText('hero-image.png').length).toBeGreaterThan(0);

    await chooseOption(userEvent, screen.getByLabelText('Media library target field'), 'audioUrl');
    await chooseOption(userEvent, screen.getByLabelText('Media library compatibility'), 'compatible');
    await chooseOption(userEvent, screen.getByLabelText('Media library asset type'), 'audio');

    await waitFor(() => {
      expect(within(modal).getAllByText('lesson-audio.mp3').length).toBeGreaterThan(0);
    });

    await userEvent.click(within(modal).getByRole('button', { name: /global assets/i }));
    const globalGrid = within(modal).getByLabelText('Global media asset grid');

    expect(globalGrid.className).toContain('xl:grid-cols-5');

    await waitFor(() => {
      expect(within(globalGrid).getAllByText('global-audio.mp3').length).toBeGreaterThan(0);
    });

    expect(within(globalGrid).queryByText('global-image.png')).not.toBeInTheDocument();
  });

  it('jumps to the exact nested media field for validation focus', async () => {
    const scrollIntoViewMock = jest.fn();
    const focusMock = jest.fn();

    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewMock,
    });
    Object.defineProperty(HTMLElement.prototype, 'focus', {
      configurable: true,
      value: focusMock,
    });

    renderEditor({
      mode: 'edit',
      blueprint: { ...baseBlueprint, lesson_kind: 'structured_micro_lesson' } as any,
      focusFieldPath: 'steps[0].pairs[0].imageUrl',
    });

    // Pair media is now set through Upload/Library buttons rather than a URL
    // text input; the field path lives on the pair's Upload Image control.
    const nestedField = await waitFor(() => {
      const el = document.querySelector<HTMLElement>(
        '[data-field-path="steps[0].pairs[0].imageUrl"]',
      );
      if (!el) throw new Error('pair image field not rendered');
      return el;
    });
    await waitFor(() => {
      expect(nestedField).toHaveClass('ring-2');
    });

    expect(scrollIntoViewMock).toHaveBeenCalled();
    expect(focusMock).toHaveBeenCalled();
  });

  it('auto-normalizes legacy reading payloads into compact authoring', async () => {
    renderEditor({
      mode: 'edit',
      blueprint: {
        ...baseBlueprint,
        payload: {
          id: 'lesson_reading_practice_01',
          title: 'Reading Practice',
          subtitle: 'Legacy reading',
          unitLabel: 'Unit 1',
          targetVocabIds: ['vocab_kaabo', 'vocab_odabo'],
        },
      } as any,
    });

    expect(await screen.findByText('Target phrases')).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('Reading Practice').length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue('Legacy reading').length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue('Unit 1').length).toBeGreaterThan(0);
    expect(screen.queryByText('Primary vocab target')).not.toBeInTheDocument();
    expect((screen.getByLabelText('Raw Payload JSON') as HTMLTextAreaElement).value).not.toContain('targetVocabIds');
  });
});

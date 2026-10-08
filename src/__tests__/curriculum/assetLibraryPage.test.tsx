import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CurriculumAssetLibraryPage from '@/app/(admin)/(others-pages)/curriculum/assets/page';
import { chooseOption, renderWithProviders as render } from '@/test-utils';

const mockUseAdminMediaLibrary = jest.fn();
const mockUseAdminMediaDuplicates = jest.fn();
const mockUseAdminBlueprintAssetLibrary = jest.fn();
const mockGetMediaUsage = jest.fn();

jest.mock('@/hooks/useApi', () => ({
  useAdminCoursesList: () => ({
    data: {
      items: [
        {
          id: 'course-1',
          title: 'Abidii Yoruba v1',
        },
      ],
    },
    isLoading: false,
    isError: false,
  }),
  useAdminBlueprintAssetLibrary: (filters: unknown) => mockUseAdminBlueprintAssetLibrary(filters),
  useAdminMediaLibrary: (filters: unknown) => mockUseAdminMediaLibrary(filters),
  useAdminMediaDuplicates: () => mockUseAdminMediaDuplicates(),
}));

jest.mock('@/lib/mediaLibraryApi', () => {
  const actual = jest.requireActual('@/lib/mediaLibraryApi');
  return { ...actual, getMediaUsage: (key: string) => mockGetMediaUsage(key) };
});

const sharedAudio = {
  id: 'asset-1',
  registered: true,
  kind: 'audio',
  sha256: 'a'.repeat(64),
  storage_key: `media/audio/${'a'.repeat(64)}.mp3`,
  url: `https://cdn.example.com/media/audio/${'a'.repeat(64)}.mp3`,
  mime: 'audio/mpeg',
  bytes: 2048,
  text: 'Ẹ káàárọ̀',
  language: 'yo',
  voice: null,
  human_recorded: true,
  original_name: 'greeting.mp3',
  usage_count: 2,
  usage_sources: ['lesson_blueprints.payload', 'phrases.audio_url'],
};
const legacyImage = {
  registered: false,
  kind: 'image',
  storage_key: 'images/animals/lion.png',
  url: 'https://cdn.example.com/images/animals/lion.png',
  human_recorded: false,
  usage_count: 0,
  usage_sources: [],
};

describe('CurriculumAssetLibraryPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAdminMediaLibrary.mockReturnValue({ items: [sharedAudio, legacyImage], total: 2, isLoading: false, isError: false });
    mockUseAdminMediaDuplicates.mockReturnValue({
      data: {
        content_groups: [
          {
            sha256: 'b'.repeat(64),
            reclaimable_bytes: 4096,
            keys: [
              { storage_key: 'images/lion.png', registered: false, usage_count: 1 },
              { storage_key: 'images/animals/lion_copy.png', registered: true, usage_count: 3 },
            ],
          },
        ],
        content_group_count: 1,
        text_groups: [
          {
            text: 'O dàbọ̀',
            text_key: 'o dàbọ̀',
            voice: null,
            keys: [
              { storage_key: 'audio/yo/conversations/yo_1.mp3', registered: false, usage_count: 1 },
              { storage_key: 'audio/yo/lesson_drafts/yo_2.mp3', registered: false, usage_count: 1, human_recorded: true },
            ],
          },
        ],
        text_group_count: 1,
        reclaimable_bytes: 4096,
        hashed_object_count: 12,
        warnings: [],
      },
      isLoading: false,
      isError: false,
    });
    mockUseAdminBlueprintAssetLibrary.mockReturnValue({
      items: [
        {
          blueprint_id: 'bp-1',
          blueprint_key: 'lesson_reading_practice_01',
          course_id: 'course-1',
          course_key: 'abidii_yoruba_v1',
          section_id: 'section-1',
          unit_key: 'U1',
          section_key: 'U1_S3',
          lesson_kind: 'reading_practice',
          field_path: 'steps[0].imageUrl',
          binding: {
            field_path: 'steps[0].imageUrl',
            asset_kind: 'image',
            storage_key: 'curriculum/example.png',
            asset_url: 'https://cdn.example.com/example.png',
            file_name: 'example.png',
            uploaded_at: '2026-03-25T00:00:00Z',
          },
        },
      ],
      total: 1,
      isLoading: false,
      isError: false,
    });
    mockGetMediaUsage.mockResolvedValue({
      storage_key: sharedAudio.storage_key,
      asset: sharedAudio,
      usage_count: 2,
      history_count: 1,
      references: [
        {
          storage_key: sharedAudio.storage_key,
          source: 'lesson_blueprints.payload',
          table: 'lesson_blueprints',
          column: 'payload',
          row_id: 'bp-9',
          label: 'lesson_greetings_01',
          path: 'steps[2].scenario.turns[0].audioUrl',
          text: 'Ẹ káàárọ̀',
          history: false,
        },
        {
          storage_key: sharedAudio.storage_key,
          source: 'phrases.audio_url',
          table: 'phrases',
          column: 'audio_url',
          row_id: 'phrase-1',
          label: 'Ẹ káàárọ̀',
          history: false,
        },
        {
          storage_key: sharedAudio.storage_key,
          source: 'lesson_blueprint_versions.snapshot',
          table: 'lesson_blueprint_versions',
          column: 'snapshot',
          row_id: 'v-1',
          history: true,
        },
      ],
      sources_scanned: [],
      warnings: [],
    });
  });

  it('opens on all media (shared library) with usage counts', () => {
    render(<CurriculumAssetLibraryPage />);

    expect(screen.getByText('Curriculum Asset Library')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'All media', selected: true })).toBeInTheDocument();
    const grid = screen.getByLabelText('Shared media grid');
    expect(within(grid).getAllByText('greeting.mp3').length).toBeGreaterThan(0);
    expect(within(grid).getByText('“Ẹ káàárọ̀”')).toBeInTheDocument();
    expect(within(grid).getByRole('button', { name: 'Used in 2 places' })).toBeInTheDocument();
    expect(within(grid).getByText('legacy key')).toBeInTheDocument();
    expect(within(grid).getByRole('button', { name: 'Unused' })).toBeInTheDocument();
    // Lesson-binding data isn't fetched until that view is opened.
    expect(mockUseAdminBlueprintAssetLibrary).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
  });

  it('searches all media and filters to unused files', async () => {
    render(<CurriculumAssetLibraryPage />);

    await userEvent.type(screen.getByLabelText('Search all media'), 'káàárọ̀');
    await waitFor(() =>
      expect(mockUseAdminMediaLibrary).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'káàárọ̀', page: 1 }))
    );
    await chooseOption(userEvent, screen.getByLabelText('Shared media usage'), 'unused');
    await waitFor(() =>
      expect(mockUseAdminMediaLibrary).toHaveBeenLastCalledWith(expect.objectContaining({ unused: true }))
    );
  });

  it('lists where a file is used on demand', async () => {
    render(<CurriculumAssetLibraryPage />);

    await userEvent.click(screen.getByRole('button', { name: 'Used in 2 places' }));

    expect(mockGetMediaUsage).toHaveBeenCalledWith(sharedAudio.storage_key);
    const refs = await screen.findByLabelText('Media references');
    expect(within(refs).getByRole('link', { name: 'lesson_greetings_01' })).toHaveAttribute(
      'href',
      '/curriculum/lesson-blueprints/bp-9'
    );
    expect(within(refs).getByText('steps[2].scenario.turns[0].audioUrl')).toBeInTheDocument();
    expect(within(refs).getByText('Phrase audio')).toBeInTheDocument();
    expect(screen.getByText(/1 lesson version snapshot also point here/)).toBeInTheDocument();
  });

  it('shows the duplicate report', async () => {
    render(<CurriculumAssetLibraryPage />);

    await userEvent.click(screen.getByRole('tab', { name: 'Duplicates' }));

    const panel = screen.getByLabelText('Media duplicates');
    expect(within(panel).getByText('images/animals/lion_copy.png')).toBeInTheDocument();
    expect(within(panel).getByText(/2 copies · 4.0 KB reclaimable/)).toBeInTheDocument();
    expect(within(panel).getByText('“O dàbọ̀”')).toBeInTheDocument();
    expect(within(panel).getByText(/2 recordings/)).toBeInTheDocument();
  });

  it('keeps the lesson-upload bindings view', async () => {
    render(<CurriculumAssetLibraryPage />);

    await userEvent.click(screen.getByRole('tab', { name: 'Lesson uploads' }));

    expect(screen.getByText('lesson_reading_practice_01')).toBeInTheDocument();
    expect(screen.getByText('steps[0].imageUrl')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Blueprint' })).toHaveAttribute(
      'href',
      '/curriculum/lesson-blueprints/bp-1'
    );
    expect(screen.getByRole('button', { name: 'Clean Stale Bindings' })).toBeInTheDocument();
  });
});

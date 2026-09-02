import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';

import { LessonRuntimePreview } from '@/components/admin/curriculum/LessonRuntimePreview';
import { apiClient } from '@/lib/api';
import { renderWithProviders as render } from '@/test-utils';

const mockUseCurriculumVocabLibrary = jest.fn();

jest.mock('@/hooks/useApi', () => ({
  useCurriculumVocabLibrary: (filters: unknown) => mockUseCurriculumVocabLibrary(filters),
}));

jest.mock('@/lib/api', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

describe('LessonRuntimePreview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCurriculumVocabLibrary.mockReturnValue({
      items: [],
    });
  });

  it('renders media previews with hoverable external links instead of raw URLs', () => {
    const heroImageUrl = 'https://cdn.example.com/media/hero-image.png';
    const topLevelAudioUrl = 'https://cdn.example.com/media/lesson-audio.mp3';
    const stepImageUrl = 'https://cdn.example.com/media/step-image.png';
    const stepAudioUrl = 'https://cdn.example.com/media/step-audio.mp3';

    render(
      <LessonRuntimePreview
        blueprint={{
          blueprint_key: 'lesson_reading_practice_01',
          lesson_kind: 'reading_practice',
          payload: {
            title: 'Reading Practice',
            heroImageUrl,
            audioUrl: topLevelAudioUrl,
            steps: [
              {
                runtimeType: 'recognitionTask',
                promptText: 'Select the correct meaning',
                imageUrl: stepImageUrl,
                audioUrl: stepAudioUrl,
              },
            ],
          },
        }}
      />
    );

    const heroLink = screen.getAllByTitle(heroImageUrl)[0];
    expect(heroLink).toHaveAttribute('href', heroImageUrl);
    expect(heroLink).toHaveAttribute('target', '_blank');

    const topLevelAudioLink = screen.getAllByTitle(topLevelAudioUrl)[0];
    expect(topLevelAudioLink).toHaveAttribute('href', topLevelAudioUrl);
    expect(topLevelAudioLink).toHaveAttribute('target', '_blank');

    const stepImageLink = screen.getAllByTitle(stepImageUrl)[0];
    expect(stepImageLink).toHaveAttribute('href', stepImageUrl);
    expect(stepImageLink).toHaveAttribute('target', '_blank');

    const stepAudioLink = screen.getAllByTitle(stepAudioUrl)[0];
    expect(stepAudioLink).toHaveAttribute('href', stepAudioUrl);
    expect(stepAudioLink).toHaveAttribute('target', '_blank');

    expect(screen.queryByText(heroImageUrl)).not.toBeInTheDocument();
    expect(screen.queryByText(topLevelAudioUrl)).not.toBeInTheDocument();
    expect(screen.queryByText(stepImageUrl)).not.toBeInTheDocument();
    expect(screen.queryByText(stepAudioUrl)).not.toBeInTheDocument();
  });

  it('shows Step Content as a one-at-a-time carousel, not a stacked list', () => {
    render(
      <LessonRuntimePreview
        blueprint={{
          blueprint_key: 'lesson_reading_practice_02',
          lesson_kind: 'reading_practice',
          payload: {
            title: 'Reading Practice',
            steps: [
              { runtimeType: 'listen', prompt: 'First step prompt' },
              { runtimeType: 'listen', prompt: 'Second step prompt' },
              { runtimeType: 'listen', prompt: 'Third step prompt' },
            ],
          },
        }}
      />
    );

    // Only the first step's content is rendered initially - proves this is
    // a carousel, not the old stacked-list-of-all-steps layout.
    expect(screen.getByText('First step prompt')).toBeInTheDocument();
    expect(screen.queryByText('Second step prompt')).not.toBeInTheDocument();
    expect(screen.queryByText('Third step prompt')).not.toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByTitle('Previous step')).toBeDisabled();
    expect(screen.getByTitle('Next step')).not.toBeDisabled();

    fireEvent.click(screen.getByTitle('Next step'));

    expect(screen.queryByText('First step prompt')).not.toBeInTheDocument();
    expect(screen.getByText('Second step prompt')).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    expect(screen.getByTitle('Previous step')).not.toBeDisabled();

    fireEvent.click(screen.getByTitle('Next step'));

    expect(screen.getByText('Third step prompt')).toBeInTheDocument();
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
    expect(screen.getByTitle('Next step')).toBeDisabled();
  });

  it('resolves phrase target IDs to their phrase text instead of showing raw UUIDs', async () => {
    const bawoId = '483fa13a-2cab-412d-82d5-7718728b1971';
    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url === `/api/v1/admin/content/phrases/${bawoId}`) {
        return Promise.resolve({ data: { phrase: 'Báwo ni', translation: 'How are you?' } });
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });

    await act(async () => {
      render(
        <LessonRuntimePreview
          blueprint={{
            blueprint_key: 'lesson_reading_practice_03',
            lesson_kind: 'reading_practice',
            payload: {
              title: 'Reading Practice',
              targetContentRefs: [{ contentType: 'phrase', contentId: bawoId }],
            },
          }}
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByText('phrase: Báwo ni')).toBeInTheDocument();
    });
    expect(screen.queryByText(`phrase: ${bawoId}`)).not.toBeInTheDocument();
  });
});

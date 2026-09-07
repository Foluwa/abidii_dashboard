/**
 * RegenerateAudioModal — preview-step side-by-side comparison tests.
 *
 * Reported: admins felt like the "new" take sounded identical to the old
 * one because the preview step only ever played the new audio - there was
 * no way to actually compare against the current live audio. Fixed by
 * showing both, each with its own play button.
 */
import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders as render } from '@/test-utils';
import { RegenerateAudioModal, type RegenerateAudioTarget } from '@/components/modals/RegenerateAudioModal';

const mockApiGet = jest.fn();
const mockApiPost = jest.fn();

jest.mock('@/lib/api', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
  },
}));

const mockUseAudioJob = jest.fn();
jest.mock('@/hooks/useAudioJob', () => ({
  useAudioJob: (jobId: string | null) => mockUseAudioJob(jobId),
  acceptAudioJob: jest.fn(),
}));

const target: RegenerateAudioTarget = {
  id: 'number-uuid-1',
  contentType: 'number',
  displayText: 'mọ́kànlá',
  defaultText: 'mọ́kànlá',
  languageCode: 'yor',
  submitEndpoint: '/api/v1/admin/numbers/number-uuid-1/regenerate-audio',
  currentAudioUrl: 'https://audio.abidii.app/current-take.wav',
};

describe('RegenerateAudioModal preview step', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGet.mockResolvedValue({
      data: {
        items: [
          { id: 'voice-1', display_name: 'Voice One', provider: 'google', language_code: 'yo' },
        ],
      },
    });
  });

  it('shows both Current (live) and New take audio players once a job completes', async () => {
    mockApiPost.mockResolvedValueOnce({ data: { job_id: 'job-1' } });
    mockUseAudioJob.mockReturnValue({
      job: { text_to_speak: 'mọ́kànlá' },
      status: 'completed',
      audioUrl: 'https://audio.abidii.app/new-take.wav',
      error: null,
    });

    render(
      <RegenerateAudioModal isOpen={true} onClose={jest.fn()} target={target} onSuccess={jest.fn()} />
    );

    // Wait for voices to actually finish loading (and one to auto-select)
    // before submitting, otherwise the form's own validation silently
    // blocks the submit with no voice selected yet.
    await waitFor(() => expect(screen.queryByText('Loading voices...')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Voice One (google)')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Regenerate Audio', { selector: 'button' }));

    await waitFor(() => {
      expect(screen.getByText('Current (live)')).toBeInTheDocument();
      expect(screen.getByText('New take')).toBeInTheDocument();
    });

    // Two distinct <audio> elements, one per source.
    const audioEls = document.querySelectorAll('audio');
    expect(audioEls.length).toBe(2);
    const srcs = Array.from(audioEls).map((el) => el.getAttribute('src'));
    expect(srcs).toContain('https://audio.abidii.app/current-take.wav');
    expect(srcs).toContain('https://audio.abidii.app/new-take.wav');
  });

  it('renders a placeholder for Current (live) when there was no existing audio', async () => {
    mockApiPost.mockResolvedValueOnce({ data: { job_id: 'job-1' } });
    mockUseAudioJob.mockReturnValue({
      job: { text_to_speak: 'mọ́kànlá' },
      status: 'completed',
      audioUrl: 'https://audio.abidii.app/new-take.wav',
      error: null,
    });

    const noCurrentTarget = { ...target, currentAudioUrl: null };

    render(
      <RegenerateAudioModal isOpen={true} onClose={jest.fn()} target={noCurrentTarget} onSuccess={jest.fn()} />
    );

    await waitFor(() => expect(screen.queryByText('Loading voices...')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Voice One (google)')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Regenerate Audio', { selector: 'button' }));

    await waitFor(() => {
      expect(screen.getByText('Current (live)')).toBeInTheDocument();
    });

    // InlineAudioPlayer renders a bare dash instead of a player when src is falsy.
    expect(document.querySelectorAll('audio').length).toBe(1);
  });
});

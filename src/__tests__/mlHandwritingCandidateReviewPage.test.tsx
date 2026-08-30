import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  MLHandwritingCandidateManifestsPage,
  MLHandwritingCandidateManifestDetailPage,
} from '@/components/admin/ml-training/MLHandwritingCandidateReviewViews';
import { renderWithProviders as render } from '@/test-utils';
import type {
  HandwritingCandidate,
  HandwritingCandidateManifest,
  HandwritingPromotionResult,
} from '@/lib/adminMlApi';

const mockManifest: HandwritingCandidateManifest = {
  id: 'manifest-1',
  language_code: 'yor',
  dataset_kind: 'alphabet_handwriting',
  source: 'drawings',
  source_prefix: 'drawings/yor/',
  status: 'ready',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  status_counts: { approved: 3, rejected: 1, pending: 2 },
};

const mockCandidate: HandwritingCandidate = {
  id: 'candidate-1',
  manifest_id: 'manifest-1',
  language_code: 'yor',
  source_type: 'drawings',
  source_key: 'drawings/yor/a/candidate-1.png',
  raw_label: 'a',
  final_label: 'a',
  final_case_group: 'LOWER_CASE',
  review_status: 'pending',
  vision_status: 'not_requested',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockPromotionResult: HandwritingPromotionResult = {
  manifest_id: 'manifest-1',
  mode: 'dry_run',
  status: 'succeeded',
  valid: true,
  apply_allowed: true,
  target_prefix: 'datasets/training/yor/alphabets/',
  approved_count: 3,
  files_to_copy: [],
  copied_count: 0,
  skipped_count: 0,
  failed_count: 0,
  validation_errors: [],
  per_class_impact: [
    { language_code: 'yor', case_group: 'LOWER_CASE', label: 'a', class_id: 'yor_lower_a', before: 5, would_add: 3, added: 0, after: 8 },
  ],
  promotion_run_id: 'promo-1',
};

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'manifest-1' }),
}));

const mockListHandwritingCandidateManifests = jest.fn();
const mockCreateHandwritingCandidateManifest = jest.fn();
const mockGetHandwritingCandidateManifest = jest.fn();
const mockListHandwritingCandidates = jest.fn();
const mockUpdateHandwritingCandidate = jest.fn();
const mockBulkUpdateHandwritingCandidates = jest.fn();
const mockDryRunHandwritingPromotion = jest.fn();
const mockApplyHandwritingPromotion = jest.fn();
const mockGetHandwritingCandidatePreviewUrl = jest.fn();
const mockSuggestHandwritingCandidateLabel = jest.fn();
const mockApplyHandwritingCandidateSuggestion = jest.fn();

jest.mock('@/lib/adminMlApi', () => ({
  ...jest.requireActual('@/lib/adminMlApi'),
  listHandwritingCandidateManifests: (...args: unknown[]) => mockListHandwritingCandidateManifests(...args),
  createHandwritingCandidateManifest: (...args: unknown[]) => mockCreateHandwritingCandidateManifest(...args),
  getHandwritingCandidateManifest: (...args: unknown[]) => mockGetHandwritingCandidateManifest(...args),
  listHandwritingCandidates: (...args: unknown[]) => mockListHandwritingCandidates(...args),
  updateHandwritingCandidate: (...args: unknown[]) => mockUpdateHandwritingCandidate(...args),
  bulkUpdateHandwritingCandidates: (...args: unknown[]) => mockBulkUpdateHandwritingCandidates(...args),
  dryRunHandwritingPromotion: (...args: unknown[]) => mockDryRunHandwritingPromotion(...args),
  applyHandwritingPromotion: (...args: unknown[]) => mockApplyHandwritingPromotion(...args),
  getHandwritingCandidatePreviewUrl: (...args: unknown[]) => mockGetHandwritingCandidatePreviewUrl(...args),
  suggestHandwritingCandidateLabel: (...args: unknown[]) => mockSuggestHandwritingCandidateLabel(...args),
  applyHandwritingCandidateSuggestion: (...args: unknown[]) => mockApplyHandwritingCandidateSuggestion(...args),
}));

describe('MLHandwritingCandidateManifestsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the manifests table once loaded', async () => {
    mockListHandwritingCandidateManifests.mockResolvedValue({ items: [mockManifest], total: 1, limit: 50, offset: 0 });

    render(<MLHandwritingCandidateManifestsPage />);

    await waitFor(() => expect(mockListHandwritingCandidateManifests).toHaveBeenCalled());
    expect(await screen.findByText('manifest-1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review' })).toHaveAttribute(
      'href',
      '/operations/ml-training/candidate-manifests/manifest-1'
    );
  });

  it('shows an inline error message when the manifests request fails', async () => {
    mockListHandwritingCandidateManifests.mockRejectedValue({ message: 'Network Error' });

    render(<MLHandwritingCandidateManifestsPage />);

    expect(await screen.findByText(/Network Error/i)).toBeInTheDocument();
  });

  it('shows an empty state when there are no manifests', async () => {
    mockListHandwritingCandidateManifests.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });

    render(<MLHandwritingCandidateManifestsPage />);

    expect(await screen.findByText('No candidate manifests found.')).toBeInTheDocument();
  });

  it('creates a new manifest and refreshes the list', async () => {
    mockListHandwritingCandidateManifests.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });
    mockCreateHandwritingCandidateManifest.mockResolvedValue({ manifest: { id: 'manifest-2' } });

    render(<MLHandwritingCandidateManifestsPage />);
    await waitFor(() => expect(mockListHandwritingCandidateManifests).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole('button', { name: 'Create Manifest' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Yes, Create Manifest' }));

    await waitFor(() => expect(mockCreateHandwritingCandidateManifest).toHaveBeenCalled());
    await waitFor(() => expect(mockListHandwritingCandidateManifests).toHaveBeenCalledTimes(2));
  });
});

describe('MLHandwritingCandidateManifestDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetHandwritingCandidateManifest.mockResolvedValue(mockManifest);
    mockListHandwritingCandidates.mockResolvedValue({ items: [mockCandidate], total: 1, limit: 25, offset: 0 });
  });

  it('renders manifest summary and candidate rows once loaded', async () => {
    render(<MLHandwritingCandidateManifestDetailPage />);

    await waitFor(() => expect(mockGetHandwritingCandidateManifest).toHaveBeenCalledWith('manifest-1'));
    expect(await screen.findByText('drawings/yor/a/candidate-1.png')).toBeInTheDocument();
    expect(screen.getByText(/yor \/ LOWER_CASE \/ a/)).toBeInTheDocument();
  });

  it('approves a single candidate and refreshes', async () => {
    mockUpdateHandwritingCandidate.mockResolvedValue(mockCandidate);

    render(<MLHandwritingCandidateManifestDetailPage />);
    await screen.findByText('drawings/yor/a/candidate-1.png');

    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

    await waitFor(() =>
      expect(mockUpdateHandwritingCandidate).toHaveBeenCalledWith('candidate-1', { review_status: 'approved' })
    );
    await waitFor(() => expect(mockListHandwritingCandidates).toHaveBeenCalledTimes(2));
  });

  it('runs a promotion dry-run and shows per-class impact', async () => {
    mockDryRunHandwritingPromotion.mockResolvedValue(mockPromotionResult);

    render(<MLHandwritingCandidateManifestDetailPage />);
    await screen.findByText('drawings/yor/a/candidate-1.png');

    await userEvent.click(screen.getByRole('button', { name: 'Dry-run Promotion' }));

    await waitFor(() => expect(mockDryRunHandwritingPromotion).toHaveBeenCalledWith('manifest-1'));
    expect(await screen.findByText('yor_lower_a')).toBeInTheDocument();
  });

  it('requests a vision suggestion for a candidate and allows accepting it', async () => {
    mockSuggestHandwritingCandidateLabel.mockResolvedValue({
      suggestion: { case_group: 'LOWER_CASE', predicted_label: 'a', confidence: 0.92 },
    });
    mockApplyHandwritingCandidateSuggestion.mockResolvedValue({ ok: true });

    render(<MLHandwritingCandidateManifestDetailPage />);
    await screen.findByText('drawings/yor/a/candidate-1.png');

    await userEvent.click(screen.getByRole('button', { name: 'Get Vision Suggestion' }));

    await waitFor(() => expect(mockSuggestHandwritingCandidateLabel).toHaveBeenCalledWith('candidate-1'));
    expect(await screen.findByText(/suggests: LOWER_CASE \/ a \(92%\)/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Accept' }));

    await waitFor(() => expect(mockApplyHandwritingCandidateSuggestion).toHaveBeenCalledWith('candidate-1', true));
  });

  it('shows an inline error message when the manifest request fails', async () => {
    mockGetHandwritingCandidateManifest.mockRejectedValue({ message: 'Unable to load manifest.' });
    mockListHandwritingCandidates.mockRejectedValue({ message: 'Unable to load manifest.' });

    render(<MLHandwritingCandidateManifestDetailPage />);

    expect(await screen.findByText(/Unable to load manifest/i)).toBeInTheDocument();
  });
});

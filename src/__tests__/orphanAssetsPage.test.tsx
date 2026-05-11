import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import OrphanAssetsPage from '@/app/(admin)/(others-pages)/content/audit-log/orphan-assets/page';
import { renderWithProviders as render } from '@/test-utils';

const mockUseAdminOrphanAssetSummary = jest.fn();
const mockUseAdminOrphanAssetScans = jest.fn();
const mockUseAdminOrphanAssetCandidates = jest.fn();
const mockRunOrphanAssetScan = jest.fn();
const mockApplyOrphanAssetBulkAction = jest.fn();

jest.mock('@/hooks/useApi', () => ({
  useAdminOrphanAssetSummary: () => mockUseAdminOrphanAssetSummary(),
  useAdminOrphanAssetScans: () => mockUseAdminOrphanAssetScans(),
  useAdminOrphanAssetCandidates: (filters: unknown) => mockUseAdminOrphanAssetCandidates(filters),
}));

jest.mock('@/lib/orphanAssetsApi', () => ({
  runOrphanAssetScan: (payload: unknown) => mockRunOrphanAssetScan(payload),
  applyOrphanAssetBulkAction: (payload: unknown) => mockApplyOrphanAssetBulkAction(payload),
}));

describe('OrphanAssetsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window, 'confirm', {
      value: jest.fn().mockReturnValue(true),
      writable: true,
      configurable: true,
    });

    mockUseAdminOrphanAssetSummary.mockReturnValue({
      data: {
        total_candidates: 2,
        open_candidates: 2,
        total_candidate_bytes: 2048,
        counts_by_status: { candidate: 2 },
        counts_by_asset_type: { audio: 1, lesson_media: 1 },
        last_completed_scan: null,
        settings: {
          managed_prefixes: ['media/', 'audio/', 'abidii/media/', 'abidii/audio/', 'abidii_app/lessons/'],
          grace_period_days: 14,
          scan_frequency_days: 1,
          scan_mode: 'dry_run',
          scan_enabled: true,
          scheduled_delete_enabled: true,
          scheduled_delete_batch_size: 100,
        },
      },
      isLoading: false,
      isError: false,
      refresh: jest.fn().mockResolvedValue(undefined),
    });

    mockUseAdminOrphanAssetScans.mockReturnValue({
      data: {
        items: [],
        total: 0,
        page: 1,
        limit: 10,
        pages: 1,
      },
      isLoading: false,
      isError: false,
      refresh: jest.fn().mockResolvedValue(undefined),
    });

    mockUseAdminOrphanAssetCandidates.mockReturnValue({
      data: {
        items: [
          {
            candidate_id: 'candidate-1',
            storage_key: 'audio/generated/provider/file.mp3',
            asset_type: 'generated_audio',
            bucket: 'abidii',
            prefix: 'audio/',
            object_size: 1024,
            last_modified: '2026-03-01T00:00:00Z',
            flagged_reason: 'unreferenced_older_than_grace_period',
            reference_check_result: { is_referenced: false },
            status: 'candidate',
            first_flagged_at: '2026-03-20T00:00:00Z',
            last_flagged_at: '2026-03-20T00:00:00Z',
            created_at: '2026-03-20T00:00:00Z',
            updated_at: '2026-03-20T00:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        limit: 25,
        pages: 1,
        filters_applied: {},
      },
      isLoading: false,
      isError: false,
      refresh: jest.fn().mockResolvedValue(undefined),
    });

    mockRunOrphanAssetScan.mockResolvedValue({
      scan_id: 'scan-1',
      completed_at: null,
      objects_scanned: 10,
      candidates_found: 1,
    });
    mockApplyOrphanAssetBulkAction.mockResolvedValue({
      action: 'protect',
      requested_count: 1,
      success_count: 1,
      failure_count: 0,
      outcomes: [],
    });
  });

  it('renders summary cards and candidates table', () => {
    render(<OrphanAssetsPage />);

    expect(screen.getByText('Orphan Assets')).toBeInTheDocument();
    expect(screen.getByText('Open Candidates')).toBeInTheDocument();
    expect(screen.getByText('audio/generated/provider/file.mp3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run Dry Scan' })).toBeInTheDocument();
  });

  it('runs a dry scan from the toolbar', async () => {
    render(<OrphanAssetsPage />);

    await userEvent.click(screen.getByRole('button', { name: 'Run Dry Scan' }));
    expect(mockRunOrphanAssetScan).toHaveBeenCalledWith({ scan_mode: 'dry_run' });
  });

  it('disables scan buttons while a scan is already running', () => {
    mockUseAdminOrphanAssetScans.mockReturnValue({
      data: {
        items: [
          {
            scan_id: 'scan-running',
            started_at: '2026-03-26T13:00:00Z',
            completed_at: null,
            objects_scanned: 0,
            candidates_found: 0,
            error_count: 0,
            errors: [],
            scan_mode: 'dry_run',
            grace_period_days: 14,
            managed_prefixes: ['audio/'],
            triggered_by_type: 'admin',
            triggered_by: 'user-1',
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      },
      isLoading: false,
      isError: false,
      refresh: jest.fn().mockResolvedValue(undefined),
    });

    render(<OrphanAssetsPage />);

    const runningButtons = screen.getAllByRole('button', { name: 'Scan Running…' });
    expect(runningButtons).toHaveLength(2);
    runningButtons.forEach((button) => expect(button).toBeDisabled());
    expect(screen.getByText('Scan in progress.')).toBeInTheDocument();
  });

  it('applies a bulk protect action to selected candidates', async () => {
    render(<OrphanAssetsPage />);

    await userEvent.click(screen.getByLabelText('Select candidate audio/generated/provider/file.mp3'));
    await userEvent.click(screen.getAllByRole('button', { name: 'Protect' })[0]);

    expect(mockApplyOrphanAssetBulkAction).toHaveBeenCalledWith({
      action: 'protect',
      candidate_ids: ['candidate-1'],
    });
  });
});

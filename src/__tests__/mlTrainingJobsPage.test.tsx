import React from 'react';
import { screen, waitFor } from '@testing-library/react';

import {
  MLTrainingJobsPage,
  MLTrainingJobDetailPage,
} from '@/components/admin/ml-training/MLTrainingViews';
import { renderWithProviders as render } from '@/test-utils';
import type { MlTrainingJob } from '@/lib/adminMlApi';

const mockJob: MlTrainingJob = {
  id: 'job-1',
  job_type: 'handwriting_tinyvgg_train',
  language_code: 'yor',
  dataset_path: 's3://bucket/dataset',
  dataset_version: 'v1',
  model_status_target: 'candidate',
  executor_type: 'lambda',
  external_job_id: 'lambda-123',
  status: 'running',
  progress_percentage: 42,
  current_stage: 'training',
  attempt_count: 1,
  max_attempts: 3,
  heartbeat_at: new Date().toISOString(),
  parameters: {},
  queued_at: new Date().toISOString(),
  started_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'job-1' }),
}));

const mockListMlTrainingJobs = jest.fn();
const mockGetMlTrainingJob = jest.fn();
const mockGetMlTrainingJobLogs = jest.fn();

jest.mock('@/lib/adminMlApi', () => ({
  ...jest.requireActual('@/lib/adminMlApi'),
  listMlTrainingJobs: (...args: unknown[]) => mockListMlTrainingJobs(...args),
  getMlTrainingJob: (...args: unknown[]) => mockGetMlTrainingJob(...args),
  getMlTrainingJobLogs: (...args: unknown[]) => mockGetMlTrainingJobLogs(...args),
}));

describe('MLTrainingJobsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the jobs table once loaded', async () => {
    mockListMlTrainingJobs.mockResolvedValue({ items: [mockJob], total: 1, limit: 20, offset: 0 });

    render(<MLTrainingJobsPage />);

    await waitFor(() => expect(mockListMlTrainingJobs).toHaveBeenCalled());
    expect(await screen.findByText('lambda-123')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute(
      'href',
      '/operations/ml-training/jobs/job-1'
    );
  });

  it('shows an inline error message when the jobs request fails', async () => {
    mockListMlTrainingJobs.mockRejectedValue({ message: 'Network Error' });

    render(<MLTrainingJobsPage />);

    expect(await screen.findByText(/Network Error/i)).toBeInTheDocument();
  });

  it('shows an empty state when there are no jobs', async () => {
    mockListMlTrainingJobs.mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });

    render(<MLTrainingJobsPage />);

    expect(await screen.findByText('No jobs found.')).toBeInTheDocument();
  });
});

describe('MLTrainingJobDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders job summary fields once loaded', async () => {
    mockGetMlTrainingJob.mockResolvedValue(mockJob);
    mockGetMlTrainingJobLogs.mockResolvedValue({ job_id: 'job-1', events: [], message: 'ok' });

    render(<MLTrainingJobDetailPage />);

    await waitFor(() => expect(mockGetMlTrainingJob).toHaveBeenCalledWith('job-1'));
    expect(await screen.findByText('running')).toBeInTheDocument();
    expect(screen.getByText('yor')).toBeInTheDocument();
  });

  it('shows an inline error message when the job request fails', async () => {
    mockGetMlTrainingJob.mockRejectedValue({ message: 'Unable to load training job.' });
    mockGetMlTrainingJobLogs.mockRejectedValue({ message: 'Unable to load training job.' });

    render(<MLTrainingJobDetailPage />);

    expect(await screen.findByText(/Unable to load training job/i)).toBeInTheDocument();
  });
});

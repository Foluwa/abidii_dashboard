import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  MLHandwritingVisionJobsPage,
  MLHandwritingVisionJobDetailPage,
} from '@/components/admin/ml-training/MLHandwritingVisionJobViews';
import { renderWithProviders as render } from '@/test-utils';
import type { HandwritingVisionCostEstimate, HandwritingVisionJob, HandwritingVisionProvider } from '@/lib/adminMlApi';

const mockProvider: HandwritingVisionProvider = {
  name: 'openai',
  enabled: true,
  supports_image_input: true,
  supports_batch: true,
  default_model: 'gpt-4o-mini',
};

const mockJob: HandwritingVisionJob = {
  id: 'job-1',
  provider: 'openai',
  model: 'gpt-4o-mini',
  mode: 'batch',
  status: 'running',
  manifest_id: 'manifest-1',
  request_count: 10,
  completed_count: 4,
  failed_count: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  items: [
    {
      id: 'item-1',
      job_id: 'job-1',
      candidate_id: 'candidate-1',
      status: 'completed',
      parsed_suggestion: { case_group: 'LOWER_CASE', predicted_label: 'a' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
};

const mockEstimate: HandwritingVisionCostEstimate = {
  candidate_count: 10,
  estimated_cost: { currency: 'USD', low: 0.5, high: 1.2 },
  provider: 'openai',
  model: 'gpt-4o-mini',
  mode: 'batch',
  requires_confirmation: true,
  confirmation_text: 'START VISION JOB',
  blocked: false,
};

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'job-1' }),
}));

const mockListHandwritingVisionJobs = jest.fn();
const mockListHandwritingVisionProviders = jest.fn();
const mockEstimateHandwritingVisionJob = jest.fn();
const mockCreateHandwritingVisionJob = jest.fn();
const mockGetHandwritingVisionJob = jest.fn();
const mockCancelHandwritingVisionJob = jest.fn();
const mockPollHandwritingVisionJob = jest.fn();

jest.mock('@/lib/adminMlApi', () => ({
  ...jest.requireActual('@/lib/adminMlApi'),
  listHandwritingVisionJobs: (...args: unknown[]) => mockListHandwritingVisionJobs(...args),
  listHandwritingVisionProviders: (...args: unknown[]) => mockListHandwritingVisionProviders(...args),
  estimateHandwritingVisionJob: (...args: unknown[]) => mockEstimateHandwritingVisionJob(...args),
  createHandwritingVisionJob: (...args: unknown[]) => mockCreateHandwritingVisionJob(...args),
  getHandwritingVisionJob: (...args: unknown[]) => mockGetHandwritingVisionJob(...args),
  cancelHandwritingVisionJob: (...args: unknown[]) => mockCancelHandwritingVisionJob(...args),
  pollHandwritingVisionJob: (...args: unknown[]) => mockPollHandwritingVisionJob(...args),
}));

describe('MLHandwritingVisionJobsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListHandwritingVisionProviders.mockResolvedValue({ providers: [mockProvider] });
  });

  it('renders the jobs table once loaded', async () => {
    mockListHandwritingVisionJobs.mockResolvedValue({ items: [mockJob], total: 1, limit: 50, offset: 0 });

    render(<MLHandwritingVisionJobsPage />);

    await waitFor(() => expect(mockListHandwritingVisionJobs).toHaveBeenCalled());
    expect(await screen.findByText('job-1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Detail' })).toHaveAttribute(
      'href',
      '/operations/ml-training/vision-jobs/job-1'
    );
  });

  it('shows an inline error message when the jobs request fails', async () => {
    mockListHandwritingVisionJobs.mockRejectedValue({ message: 'Network Error' });

    render(<MLHandwritingVisionJobsPage />);

    expect(await screen.findByText(/Network Error/i)).toBeInTheDocument();
  });

  it('shows an empty state when there are no jobs', async () => {
    mockListHandwritingVisionJobs.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });

    render(<MLHandwritingVisionJobsPage />);

    expect(await screen.findByText('No vision jobs yet.')).toBeInTheDocument();
  });

  it('estimates cost before requiring confirmation to start a job', async () => {
    mockListHandwritingVisionJobs.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });
    mockEstimateHandwritingVisionJob.mockResolvedValue(mockEstimate);

    render(<MLHandwritingVisionJobsPage />);
    await waitFor(() => expect(mockListHandwritingVisionProviders).toHaveBeenCalled());

    await userEvent.click(screen.getByRole('button', { name: 'Estimate Cost' }));

    await waitFor(() => expect(mockEstimateHandwritingVisionJob).toHaveBeenCalled());
    expect(await screen.findByText('$0.50-$1.20')).toBeInTheDocument();
    expect(screen.getByText('Confirmation Required')).toBeInTheDocument();
  });

  it('does not start a job when the confirmation prompt is cancelled', async () => {
    mockListHandwritingVisionJobs.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });
    mockEstimateHandwritingVisionJob.mockResolvedValue(mockEstimate);
    window.prompt = jest.fn(() => null);

    render(<MLHandwritingVisionJobsPage />);
    await waitFor(() => expect(mockListHandwritingVisionProviders).toHaveBeenCalled());

    await userEvent.click(screen.getByRole('button', { name: 'Estimate Cost' }));
    await screen.findByText('$0.50-$1.20');

    await userEvent.click(screen.getByRole('button', { name: 'Start Vision Job' }));

    await waitFor(() => expect(window.prompt).toHaveBeenCalled());
    expect(mockCreateHandwritingVisionJob).not.toHaveBeenCalled();
  });
});

describe('MLHandwritingVisionJobDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders job summary and item rows once loaded', async () => {
    mockGetHandwritingVisionJob.mockResolvedValue(mockJob);

    render(<MLHandwritingVisionJobDetailPage />);

    await waitFor(() => expect(mockGetHandwritingVisionJob).toHaveBeenCalledWith('job-1'));
    expect(await screen.findByText('running')).toBeInTheDocument();
    expect(screen.getByText('candidate-1')).toBeInTheDocument();
    expect(screen.getByText('LOWER_CASE a')).toBeInTheDocument();
  });

  it('polls the job when Poll Now is clicked', async () => {
    mockGetHandwritingVisionJob.mockResolvedValue(mockJob);
    mockPollHandwritingVisionJob.mockResolvedValue({ ok: true });

    render(<MLHandwritingVisionJobDetailPage />);
    await screen.findByText('candidate-1');

    await userEvent.click(screen.getByRole('button', { name: 'Poll Now' }));

    await waitFor(() => expect(mockPollHandwritingVisionJob).toHaveBeenCalledWith('job-1'));
    expect(await screen.findByText('Polled provider for updates.')).toBeInTheDocument();
  });

  it('cancels the job after confirmation', async () => {
    mockGetHandwritingVisionJob.mockResolvedValue(mockJob);
    mockCancelHandwritingVisionJob.mockResolvedValue({ ok: true });
    window.confirm = jest.fn(() => true);

    render(<MLHandwritingVisionJobDetailPage />);
    await screen.findByText('candidate-1');

    await userEvent.click(screen.getByRole('button', { name: 'Cancel Job' }));

    await waitFor(() => expect(mockCancelHandwritingVisionJob).toHaveBeenCalledWith('job-1'));
  });

  it('shows an inline error message when the job request fails', async () => {
    mockGetHandwritingVisionJob.mockRejectedValue({ message: 'Unable to load vision job.' });

    render(<MLHandwritingVisionJobDetailPage />);

    expect(await screen.findByText(/Unable to load vision job/i)).toBeInTheDocument();
  });
});

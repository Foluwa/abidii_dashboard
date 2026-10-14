import React from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ReviewsTab } from '@/components/content/onboarding/ReviewsTab';
import { AcquisitionOptionsTab } from '@/components/content/onboarding/AcquisitionOptionsTab';
import AcquisitionAnalyticsPage from '@/app/(admin)/(others-pages)/analytics/acquisition/page';
import { renderWithProviders as render } from '@/test-utils';

const mockReviews = jest.fn();
const mockOptions = jest.fn();
const mockAnalytics = jest.fn();

jest.mock('@/hooks/useApi', () => ({
  useOnboardingReviews: () => mockReviews(),
  useAcquisitionOptions: () => mockOptions(),
  useAcquisitionAnalytics: (from: string, to: string) => mockAnalytics(from, to),
}));

jest.mock('@/lib/onboardingApi', () => ({
  ...jest.requireActual('@/lib/onboardingApi'),
  createOnboardingReview: jest.fn(),
  updateOnboardingReview: jest.fn(),
  deleteOnboardingReview: jest.fn(),
  createAcquisitionOption: jest.fn(),
  updateAcquisitionOption: jest.fn(),
  deleteAcquisitionOption: jest.fn(),
}));

const review = {
  id: 'r1',
  name: 'Adé O.',
  country: 'NG',
  rating: 5,
  text: 'Ó dára gan-an',
  language: 'yo',
  translated: false,
  enabled: false,
  sort_order: 10,
  source: 'google_play',
  permission_confirmed: false,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
};

const labels = (en: string) => ({ en, fr: en, es: en, pt: en, yo: '' });

describe('Onboarding admin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReviews.mockReturnValue({ reviews: [review], isLoading: false, isError: undefined, refresh: jest.fn() });
    mockOptions.mockReturnValue({
      options: [
        { key: 'friend', labels: labels('A friend'), icon: 'people', image_url: null, enabled: true, sort_order: 10 },
        { key: 'other', labels: labels('Other'), icon: 'more', image_url: null, enabled: true, sort_order: 99 },
      ],
      isLoading: false,
      isError: undefined,
      refresh: jest.fn(),
    });
  });

  it('shows the policy note and blocks enabling a review without permission', async () => {
    render(<ReviewsTab />);
    expect(screen.getAllByText(/Only real reviews, quoted with permission/).length).toBeGreaterThan(0);
    expect(screen.getByRole('switch', { name: /Show review by Adé O./ })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: /Edit review by Adé O./ }));
    const dialog = screen.getByRole('dialog');
    const enabled = within(dialog).getByRole('checkbox', { name: /Enabled/ });
    expect(enabled).toBeDisabled();
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /I have permission to quote this review/ }));
    expect(enabled).toBeEnabled();
  });

  it('hides delete for the "other" option', () => {
    render(<AcquisitionOptionsTab />);
    expect(screen.getByRole('button', { name: 'Delete A friend' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Other' })).not.toBeInTheDocument();
  });

  it('shows a friendly state when the backend is not deployed', () => {
    mockReviews.mockReturnValue({
      reviews: undefined,
      isLoading: false,
      isError: { response: { status: 404 } },
      refresh: jest.fn(),
    });
    render(<ReviewsTab />);
    expect(screen.getByText('Reviews are not available yet')).toBeInTheDocument();
  });

  it('renders acquisition KPIs, country table and masked free text', () => {
    mockAnalytics.mockReturnValue({
      analytics: {
        total_answered: 30,
        total_signups: 40,
        by_source: [{ source: 'friend', count: 20 }, { source: 'other', count: 10 }],
        by_country: [{ country: 'NG', source: 'friend', count: 20 }],
        over_time: [],
        other_texts: [{ text: 'my teacher x@y.com', count: 2 }],
      },
      isLoading: false,
      isError: undefined,
      refresh: jest.fn(),
    });
    render(<AcquisitionAnalyticsPage />);
    expect(mockAnalytics).toHaveBeenCalled();
    const [from, to] = mockAnalytics.mock.calls[0];
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText(/Nigeria/)).toBeInTheDocument();
    expect(screen.getByText('my teacher x••••@y.com')).toBeInTheDocument();
  });
});

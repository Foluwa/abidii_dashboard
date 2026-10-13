import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import EmailSignInAnalyticsPage from '@/app/(admin)/(others-pages)/analytics/email-signin/page';
import { renderWithProviders as render, chooseOption } from '@/test-utils';

const mockUseEmailSignInAnalytics = jest.fn();

jest.mock('@/hooks/useApi', () => ({
  useEmailSignInAnalytics: (days: number) => mockUseEmailSignInAnalytics(days),
}));

jest.mock('@/components/charts/RoomsTimeSeriesChart', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <div>{title}</div>,
}));

const analytics = {
  days: 30,
  since: '2026-09-14T00:00:00Z',
  funnel: {
    addresses: 40,
    codes_sent: 52,
    resends: 12,
    verified: 30,
    not_verified: 10,
    expired_unverified: 6,
    verify_rate: 0.75,
    median_seconds_to_verify: 95,
    new_accounts: 18,
  },
  by_platform: [
    { key: 'ios', addresses: 25, codes_sent: 30, verified: 22, verify_rate: 0.88, median_seconds_to_verify: 80 },
    { key: 'android', addresses: 15, codes_sent: 22, verified: 8, verify_rate: 0.5333, median_seconds_to_verify: 140 },
  ],
  by_language: [
    { key: 'yo', addresses: 10, codes_sent: 12, verified: 3, verify_rate: 0.3, median_seconds_to_verify: 200 },
  ],
  daily: [{ date: '2026-10-13', codes_sent: 5, verified: 4, expired: 1, wrong: 2, limited: 1 }],
  abuse: {
    wrong_codes: 9,
    limits_hit: 3,
    limited_by_reason: [{ reason: 'ip_hourly', count: 3 }],
    locks: 1,
    locked_addresses: [{ address: 'abcdef123456', locks: 1, last_locked_at: '2026-10-12T09:00:00Z' }],
    busiest_networks: [{ network: '0123456789ab', codes_sent: 14, addresses: 11, limited: 3 }],
  },
};

describe('EmailSignInAnalyticsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseEmailSignInAnalytics.mockReturnValue({
      analytics,
      isLoading: false,
      isError: false,
      refresh: jest.fn(),
    });
  });

  it('shows the funnel, breakdowns and abuse view', () => {
    render(<EmailSignInAnalyticsPage />);
    expect(mockUseEmailSignInAnalytics).toHaveBeenCalledWith(30);
    expect(screen.getByText('Addresses sent a code')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('1m 35s')).toBeInTheDocument();
    expect(screen.getByText('12 resends')).toBeInTheDocument();
    expect(screen.getByText('iPhone')).toBeInTheDocument();
    expect(screen.getByText('Yorùbá')).toBeInTheDocument();
    expect(screen.getByText('30%')).toHaveClass('text-red-600');
    expect(screen.getByText('10 codes per network per hour')).toBeInTheDocument();
    expect(screen.getByText('abcdef123456…')).toBeInTheDocument();
    expect(screen.getByText('Codes Sent vs Verified')).toBeInTheDocument();
  });

  it('changes the period', async () => {
    render(<EmailSignInAnalyticsPage />);
    await chooseOption(userEvent, screen.getByLabelText('Time Period'), '7');
    expect(mockUseEmailSignInAnalytics).toHaveBeenLastCalledWith(7);
  });
});

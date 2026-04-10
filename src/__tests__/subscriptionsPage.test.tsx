import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SubscriptionsPage from '@/app/(admin)/(others-pages)/subscriptions/page';
import { renderWithProviders as render } from '@/test-utils';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  usePathname: () => '/community/billing',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/lib/api', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
  },
}));

jest.mock('@/hooks/useApi', () => ({
  useSubscriptions: () => ({
    subscriptions: [],
    total: 0,
    isLoading: false,
    isError: false,
    refresh: jest.fn(),
  }),
  useSubscriptionAttempts: () => ({
    attempts: [],
    total: 0,
    isLoading: false,
    isError: false,
    refresh: jest.fn(),
  }),
  useSubscriptionEvents: () => ({
    events: [],
    total: 0,
    isLoading: false,
    isError: false,
    refresh: jest.fn(),
  }),
  useSubscriptionStats: () => ({
    stats: {
      total: 5,
      active: 3,
      trial: 1,
      expired: 1,
      canceled: 0,
    },
    isLoading: false,
    refresh: jest.fn(),
  }),
}));

describe('SubscriptionsPage', () => {
  it('renders tabbed subscription views with event and attempt filters', async () => {
    render(<SubscriptionsPage />);

    expect(screen.getByText('Subscription Management')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subscriptions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subscription Events' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verification Attempts' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Subscription Events' }));
    expect(screen.getByText('Recent Subscription Events')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('User id, email, username')).toBeInTheDocument();
    expect(screen.getByDisplayValue('All event types')).toBeInTheDocument();
    expect(screen.getByDisplayValue('All platforms')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Verification Attempts' }));
    expect(screen.getByText('Recent Verification Attempts')).toBeInTheDocument();
    expect(screen.getByText('No attempts found')).toBeInTheDocument();
  });
});

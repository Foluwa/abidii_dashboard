import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SubscriptionsPage from '@/app/(admin)/(others-pages)/subscriptions/page';
import { renderWithProviders as render } from '@/test-utils';

const mockPush = jest.fn();
let mockSubscriptions: any[] = [];

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  usePathname: () => '/subscriptions',
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
  useBillingPlans: () => ({ plans: [], isLoading: false, isError: false, refresh: jest.fn() }),
  useSubscriptions: () => ({
    subscriptions: mockSubscriptions,
    total: mockSubscriptions.length,
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
  afterEach(() => {
    mockSubscriptions = [];
  });

  it('renders avatar/username, plan pill and icon actions for a subscription row', async () => {
    mockSubscriptions = [
      {
        id: 's-1',
        user_id: 'u-1',
        user_email: 'ade@example.com',
        user_display_name: 'Ade',
        user_username: 'ade_learns',
        user_avatar_svg: null,
        user_picture_url: null,
        plan_id: 'premium_monthly',
        status: 'active',
        provider: 'apple',
        platform: 'ios',
        current_period_start: '2026-10-01T00:00:00Z',
        current_period_end: '2026-11-01T00:00:00Z',
      },
    ];
    render(<SubscriptionsPage />);

    expect(screen.getByText('Ade')).toBeInTheDocument();
    expect(screen.getByText('@ade_learns')).toBeInTheDocument();
    expect(screen.queryByText('ade@example.com')).not.toBeInTheDocument();
    expect(screen.getByText('Monthly')).toHaveAttribute('data-tone', 'indigo');
    expect(screen.getByText('active')).toHaveAttribute('data-tone', 'green');

    const edit = screen.getByRole('button', { name: 'Edit subscription' });
    expect(edit).toHaveAttribute('title', 'Edit');
    expect(screen.getByRole('button', { name: 'View user' })).toHaveAttribute('title', 'View user');

    await userEvent.click(edit);
    expect(screen.getByRole('heading', { name: 'Edit Subscription' })).toBeInTheDocument();
  });

  it('manual subscription form uses a required plan select and defaults Start to now', async () => {
    render(<SubscriptionsPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Add Manual Subscription' }));

    expect(screen.getByText('Select a plan')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('premium_monthly')).not.toBeInTheDocument();
    expect((screen.getByLabelText('Start') as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

    await userEvent.click(screen.getByRole('button', { name: '+1 year' }));
    const start = new Date((screen.getByLabelText('Start') as HTMLInputElement).value);
    const end = new Date((screen.getByLabelText('Expires') as HTMLInputElement).value);
    expect(end.getFullYear() - start.getFullYear()).toBe(1);
  });

  it('renders tabbed subscription views with event and attempt filters', async () => {
    render(<SubscriptionsPage />);

    expect(screen.getByText('Subscription Management')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subscriptions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subscription Events' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verification Attempts' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Subscription Events' }));
    expect(screen.getByRole('heading', { name: 'Recent Subscription Events' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('User id, email, username')).toBeInTheDocument();
    // Filters are custom dropdowns now: check the visible selected value.
    expect(screen.getByText('All event types')).toBeInTheDocument();
    expect(screen.getByText('All platforms')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Verification Attempts' }));
    expect(screen.getByRole('heading', { name: 'Recent Verification Attempts' })).toBeInTheDocument();
    expect(screen.getByText('No attempts found')).toBeInTheDocument();
  });
});

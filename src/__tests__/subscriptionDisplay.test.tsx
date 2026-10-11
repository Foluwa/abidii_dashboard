import React from 'react';
import { render, screen } from '@testing-library/react';

import {
  AttemptResultPill,
  EventTypePill,
  PlanPill,
  SubscriptionStatusPill,
  SubscriptionUserCell,
  getAttemptResultTone,
  getEventTypeDisplay,
  getPlanDisplay,
  getPlanOptions,
  getPlanPeriod,
  getSubscriptionStatusTone,
} from '@/components/subscriptions/subscriptionDisplay';

describe('plan pill mapping', () => {
  it.each([
    ['premium_monthly', 'monthly'],
    ['premium_annual', 'annual'],
    ['abidii.premium.monthly', 'monthly'],
    ['abidii.premium.annual', 'annual'],
    ['premium_yearly', 'annual'],
    ['premium-month', 'monthly'],
    ['P1M', 'monthly'],
    ['p1y', 'annual'],
    ['premium_lifetime', 'lifetime'],
    ['premium', null],
    ['', null],
    [null, null],
  ])('%s -> %s', (planId, period) => {
    expect(getPlanPeriod(planId as string | null)).toBe(period);
  });

  it('labels and colours monthly/annual/lifetime distinctly, unknown raw + neutral', () => {
    expect(getPlanDisplay('premium_monthly')).toEqual({ label: 'Monthly', tone: 'indigo' });
    expect(getPlanDisplay('premium_annual')).toEqual({ label: 'Annual', tone: 'purple' });
    expect(getPlanDisplay('premium_lifetime')).toEqual({ label: 'Lifetime', tone: 'amber' });
    expect(getPlanDisplay('family_plan')).toEqual({ label: 'family_plan', tone: 'neutral' });
    expect(getPlanDisplay(null)).toBeNull();
  });

  it('renders the pill with the raw id as tooltip', () => {
    render(<PlanPill planId="premium_annual" />);
    const pill = screen.getByText('Annual');
    expect(pill).toHaveAttribute('title', 'premium_annual');
    expect(pill).toHaveAttribute('data-tone', 'purple');
    expect(pill.className).toContain('rounded-full');
  });

  it('builds select options whose value is the exact plan id', () => {
    expect(getPlanOptions(['premium_monthly', 'premium_annual'])).toEqual([
      { value: 'premium_monthly', label: 'Monthly (premium_monthly)' },
      { value: 'premium_annual', label: 'Annual (premium_annual)' },
    ]);
    // An existing non-catalogue value is kept so editing never drops it.
    expect(getPlanOptions(['premium_monthly'], 'legacy_plan').map((o) => o.value)).toEqual([
      'premium_monthly',
      'legacy_plan',
    ]);
  });
});

describe('status / event / attempt pills', () => {
  it('maps subscription statuses', () => {
    expect(getSubscriptionStatusTone('active')).toBe('green');
    expect(getSubscriptionStatusTone('trialing')).toBe('blue');
    expect(getSubscriptionStatusTone('past_due')).toBe('yellow');
    expect(getSubscriptionStatusTone('canceled')).toBe('yellow');
    expect(getSubscriptionStatusTone('expired')).toBe('red');
    expect(getSubscriptionStatusTone('refunded')).toBe('red');
    expect(getSubscriptionStatusTone('weird')).toBe('neutral');
    render(<SubscriptionStatusPill status="weird" />);
    expect(screen.getByText('weird')).toHaveAttribute('data-tone', 'neutral');
  });

  it('maps event types with friendly labels, unknown shown raw', () => {
    expect(getEventTypeDisplay('subscription_renewed')).toEqual({ label: 'Renewed', tone: 'teal' });
    expect(getEventTypeDisplay('subscription_canceled')).toEqual({ label: 'Canceled', tone: 'yellow' });
    expect(getEventTypeDisplay('payment_failed')).toEqual({ label: 'Payment failed', tone: 'red' });
    render(<EventTypePill eventType="something_new" />);
    expect(screen.getByText('something_new')).toHaveAttribute('data-tone', 'neutral');
  });

  it('maps attempt results', () => {
    expect(getAttemptResultTone(true, null)).toBe('green');
    expect(getAttemptResultTone(false, 'invalid')).toBe('red');
    expect(getAttemptResultTone(false, 'expired')).toBe('yellow');
    render(<AttemptResultPill success={false} status="invalid" />);
    expect(screen.getByText('failed (invalid)')).toHaveAttribute('data-tone', 'red');
  });
});

describe('SubscriptionUserCell', () => {
  it('shows display name + @username with email only as tooltip', () => {
    const { container } = render(
      <SubscriptionUserCell
        row={{
          user_id: 'u-1',
          user_email: 'ade@example.com',
          user_display_name: 'Ade',
          user_username: 'ade_learns',
          user_avatar_svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
        }}
      />,
    );
    expect(screen.getByText('Ade')).toBeInTheDocument();
    expect(screen.getByText('@ade_learns')).toBeInTheDocument();
    expect(screen.queryByText('ade@example.com')).not.toBeInTheDocument();
    expect(container.firstChild).toHaveAttribute('title', 'ade@example.com · u-1');
    expect(screen.getByAltText('Ade avatar')).toBeInTheDocument();
  });

  it('falls back to initials and email when no name/avatar', () => {
    render(<SubscriptionUserCell row={{ user_id: 'u-2', user_email: 'x@example.com' }} />);
    expect(screen.getByText('x@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('X')).toBeInTheDocument();
  });
});

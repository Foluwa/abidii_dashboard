import React from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders as render } from '@/test-utils';

import { DailyMissionsContent } from '@/components/content/DailyMissionsContent';
import { missionsSummaryFixture } from '@/test-fixtures/dailyMissionsFixtures';

const mockSummary = jest.fn();
const mockClaims = jest.fn();

jest.mock('@/hooks/useApi', () => ({
  useAdminMissionsSummary: (...args: unknown[]) => mockSummary(...args),
  useAdminMissionClaims: (...args: unknown[]) => mockClaims(...args),
}));

const CLAIM = {
  id: 'cl1',
  user_id: 'user-1',
  user_email: 'ada@example.com',
  user_display_name: 'Ada',
  mission_day: '2026-10-11',
  mission_id: 'game_finish_1',
  progress: 1,
  target: 1,
  bonus: 2,
  claimed_at: '2026-10-11T10:00:00Z',
};

describe('DailyMissionsContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSummary.mockReturnValue({ data: missionsSummaryFixture(), isLoading: false, isError: undefined });
    mockClaims.mockReturnValue({ data: { items: [CLAIM], total: 1, page: 1, limit: 25, pages: 1 }, isLoading: false });
  });

  it('shows period KPIs instead of a wide per-mission table', () => {
    render(<DailyMissionsContent />);
    expect(screen.getByText('Missions claimed')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('5 today')).toBeInTheDocument();
    expect(screen.getByText('47%')).toBeInTheDocument(); // 7 / 15
    expect(screen.getByText('20%')).toBeInTheDocument(); // 1 of 5 learner-days
    expect(screen.getByText('1 of 5 learner-days')).toBeInTheDocument();
    // No mission-id column headers any more.
    expect(screen.queryByRole('columnheader', { name: 'lesson_complete_1' })).not.toBeInTheDocument();
  });

  it('explains missions are daily, not per unit, and links to Learning Path', () => {
    render(<DailyMissionsContent />);
    expect(screen.getByText(/Missions are daily, not per course unit/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Learning Path/ })).toHaveAttribute('href', '/analytics/learning-path');
  });

  it('lists missions with readable names, type pills and claim rates', () => {
    render(<DailyMissionsContent />);
    const table = screen.getByText('Complete a lesson').closest('table')!;
    const row = screen.getByText('Complete a lesson').closest('tr')!;
    expect(within(row).getByText('Lesson')).toBeInTheDocument();
    expect(within(row).getByText('80%')).toBeInTheDocument();
    expect(within(table).getByText('Retired')).toBeInTheDocument();
  });

  it('filters recent claims by mission from the row icon button', async () => {
    render(<DailyMissionsContent />);
    await userEvent.click(screen.getByRole('button', { name: 'Show claims for Finish a game' }));
    expect(mockClaims).toHaveBeenLastCalledWith(expect.objectContaining({ missionId: 'game_finish_1', page: 1 }));
  });

  it('filters recent claims by day from the day-by-day table', async () => {
    render(<DailyMissionsContent />);
    await userEvent.click(screen.getByRole('button', { name: 'Show claims on 2026-10-10' }));
    expect(mockClaims).toHaveBeenLastCalledWith(expect.objectContaining({ day: '2026-10-10' }));
  });

  it('renders claims with the learner and mission name', () => {
    render(<DailyMissionsContent />);
    const claimsCard = document.getElementById('mission-claims')!;
    expect(within(claimsCard).getByText('Ada')).toBeInTheDocument();
    expect(within(claimsCard).getAllByText('Finish a game').length).toBeGreaterThan(0);
  });

  it('shows an empty chart state and error message', () => {
    mockSummary.mockReturnValue({ data: undefined, isLoading: false, isError: new Error('x') });
    render(<DailyMissionsContent />);
    expect(screen.getByText('Failed to load the missions summary.')).toBeInTheDocument();
    expect(screen.getByText('No missions claimed in this period')).toBeInTheDocument();
  });
});

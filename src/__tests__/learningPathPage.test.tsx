import React from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders as render, chooseOption } from '@/test-utils';

import { LearningPathContent } from '@/components/analytics/learning-path/LearningPathContent';
import { isTabActive } from '@/components/analytics/AnalyticsTabs';
import { learningPathFixture } from '@/test-fixtures/learningPathFixtures';

const mockUseLearningPath = jest.fn();

jest.mock('@/hooks/useApi', () => ({
  useLearningPath: (...args: unknown[]) => mockUseLearningPath(...args),
}));

describe('LearningPathContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLearningPath.mockReturnValue({ data: learningPathFixture(), isLoading: false, isError: undefined, refresh: jest.fn() });
  });

  it('shows the headline KPIs with a free / premium split', () => {
    render(<LearningPathContent />);
    const card = screen.getByText('New learners').closest('[title]') as HTMLElement;
    expect(within(card).getByText('20')).toBeInTheDocument();
    expect(screen.getByText('15 free · 5 premium')).toBeInTheDocument();
    expect(screen.getByText('10%')).toBeInTheDocument();
    expect(screen.getByText('2m 30s')).toBeInTheDocument();
    expect(screen.getByText(/45s answering · 40 sessions/)).toBeInTheDocument();
  });

  it('calls out the biggest drop-off in the funnel', () => {
    render(<LearningPathContent />);
    expect(screen.getByText(/1\.2 Goodbye · 50% stop before it/)).toBeInTheDocument();
  });

  it('expands a unit to show its lessons with drop-off and time', async () => {
    render(<LearningPathContent />);
    expect(screen.queryByText('Goodbye', { selector: 'td div' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show lessons in Greetings' }));
    const row = screen.getByText('Goodbye', { selector: 'td div' }).closest('tr')!;
    expect(within(row).getByText('80%')).toBeInTheDocument();
    expect(within(row).getByText('50%')).toBeInTheDocument();
    expect(within(row).getByText('3m 0s')).toBeInTheDocument();
    const unitRow = screen.getByRole('button', { name: 'Hide lessons in Greetings' }).closest('tr')!;
    expect(within(unitRow).getByText('5m 0s')).toBeInTheDocument();
  });

  it('marks hidden lessons', async () => {
    render(<LearningPathContent />);
    await userEvent.click(screen.getByRole('button', { name: 'Show lessons in Numbers' }));
    const row = screen.getByText('Draft lesson').closest('tr')!;
    expect(within(row).getByText('Hidden')).toBeInTheDocument();
  });

  it('passes the learner tier and range to the hook', async () => {
    render(<LearningPathContent />);
    expect(mockUseLearningPath).toHaveBeenLastCalledWith({ courseId: undefined, range: '30d', tier: 'all' });
    await chooseOption(userEvent, screen.getByLabelText('Learners'), 'premium');
    expect(mockUseLearningPath).toHaveBeenLastCalledWith(expect.objectContaining({ tier: 'premium' }));
    await chooseOption(userEvent, screen.getByLabelText('Date range'), '6m');
    expect(mockUseLearningPath).toHaveBeenLastCalledWith(expect.objectContaining({ range: '6m', tier: 'premium' }));
    await chooseOption(userEvent, screen.getByLabelText('Course'), 'c2');
    expect(mockUseLearningPath).toHaveBeenLastCalledWith(expect.objectContaining({ courseId: 'c2' }));
  });

  it('shows an error panel with retry', async () => {
    const refresh = jest.fn();
    mockUseLearningPath.mockReturnValue({ data: undefined, isLoading: false, isError: new Error('boom'), refresh });
    render(<LearningPathContent />);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refresh).toHaveBeenCalled();
  });

  it('shows empty chart states when nothing happened', () => {
    const fx = learningPathFixture();
    fx.series = fx.series.map((p) => ({ ...p, lesson_completions: 0, active_learners: 0, new_learners: 0, completions_by_unit: {} }));
    fx.units = fx.units.map((u) => ({
      ...u,
      sections: u.sections.map((s) => ({ ...s, learners_started: 0, median_wall_clock_ms: null })),
    }));
    mockUseLearningPath.mockReturnValue({ data: fx, isLoading: false, isError: undefined, refresh: jest.fn() });
    render(<LearningPathContent />);
    expect(screen.getByText('No learners started this course in the period')).toBeInTheDocument();
    expect(screen.getByText('No learning activity in this period')).toBeInTheDocument();
    expect(screen.getByText('No lessons completed in this period')).toBeInTheDocument();
    expect(screen.getByText('No completed lesson sessions in the period')).toBeInTheDocument();
  });
});

describe('isTabActive', () => {
  it('does not light up Learning on the Learning Path tab', () => {
    expect(isTabActive('/analytics/learning-path', '/analytics/learning')).toBe(false);
    expect(isTabActive('/analytics/learning-path', '/analytics/learning-path')).toBe(true);
    expect(isTabActive('/analytics/learning/lessons/x', '/analytics/learning')).toBe(true);
    expect(isTabActive('/analytics/players', '/analytics')).toBe(false);
  });
});

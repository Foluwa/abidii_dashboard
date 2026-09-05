import React from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CurriculumOpsPage from '@/app/(admin)/(others-pages)/analytics/curriculum-ops/page';
import { renderWithProviders as render } from '@/test-utils';

const mockRefresh = jest.fn().mockResolvedValue(undefined);
const mockUseAdminCurriculumOpsMetrics = jest.fn();
const mockUseAdminAuditLogList = jest.fn();

jest.mock('@/hooks/useApi', () => ({
  useAdminCurriculumOpsMetrics: (days: number) => mockUseAdminCurriculumOpsMetrics(days),
  useAdminAuditLogList: (filters: unknown) => mockUseAdminAuditLogList(filters),
}));

describe('CurriculumOpsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAdminCurriculumOpsMetrics.mockReturnValue({
      metrics: {
        window_days: 7,
        rows: [
          { day: '2026-02-26', action: 'course.publish', result: 'success', count: 3 },
          { day: '2026-02-26', action: 'course.publish', result: 'blocked', count: 1 },
        ],
      },
      isLoading: false,
      isError: false,
      refresh: mockRefresh,
    });

    mockUseAdminAuditLogList.mockImplementation((filters: any) => {
      const base = {
        isLoading: false,
        isError: false,
        refresh: jest.fn(),
      };

      if (filters?.action_prefix === 'course.') {
        return {
          ...base,
          data: {
            items: [
              {
                id: 'a1',
                created_at: '2026-02-26T10:00:00Z',
                admin_user_id: 'u1',
                actor_email: 'admin@example.com',
                actor_display_name: 'Admin',
                action: 'course.publish',
                target_type: 'course',
                target_id: 'c1',
                details: { result: 'blocked', validation_status: 'invalid' },
              },
            ],
            total: 1,
            page: 1,
            limit: 200,
            pages: 1,
            filters_applied: {},
          },
        };
      }

      if (filters?.action_prefix === 'lesson_blueprint.') {
        return {
          ...base,
          data: {
            items: [
              {
                id: 'a2',
                created_at: '2026-02-26T11:00:00Z',
                admin_user_id: 'u1',
                actor_email: 'admin@example.com',
                actor_display_name: 'Admin',
                action: 'lesson_blueprint.publish',
                target_type: 'lesson_blueprint',
                target_id: 'b1',
                details: { result: 'failed', validation_status: 'error' },
              },
            ],
            total: 1,
            page: 1,
            limit: 200,
            pages: 1,
            filters_applied: {},
          },
        };
      }

      return {
        ...base,
        data: { items: [], total: 0, page: 1, limit: 200, pages: 1, filters_applied: {} },
      };
    });
  });

  it('renders table rows and totals', () => {
    render(<CurriculumOpsPage />);

    expect(screen.getByRole('heading', { name: 'Curriculum Ops' })).toBeInTheDocument();
    expect(screen.getByText(/Total:/i)).toBeInTheDocument();

    const tables = screen.getAllByRole('table');
    const table = tables.find((t) => within(t).queryByText('Day')) as HTMLElement;
    expect(table).toBeTruthy();
    const t = within(table);

    expect(t.getByText('Day')).toBeInTheDocument();
    expect(t.getByText('Action')).toBeInTheDocument();
    expect(t.getByText('Result')).toBeInTheDocument();
    expect(t.getByText('Count')).toBeInTheDocument();

    const rows = within(table).getAllByRole('row');
    expect(rows.length).toBeGreaterThanOrEqual(3);

    const firstDataRow = rows[1];
    expect(within(firstDataRow).getByText('2026-02-26')).toBeInTheDocument();
    expect(within(firstDataRow).getByText('course.publish')).toBeInTheDocument();
    expect(within(firstDataRow).getByText('Success')).toBeInTheDocument();
    expect(within(firstDataRow).getByText('3')).toBeInTheDocument();
  });

  it('passes updated days to hook when filter changes', async () => {
    render(<CurriculumOpsPage />);

    expect(mockUseAdminCurriculumOpsMetrics).toHaveBeenCalledWith(7);

    await userEvent.selectOptions(screen.getByLabelText('Time Range'), '30');

    expect(mockUseAdminCurriculumOpsMetrics).toHaveBeenCalledWith(30);
  });
});

import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AdminAuditLogPage from '@/app/(admin)/(others-pages)/content/audit-log/page';
import { renderWithProviders as render } from '@/test-utils';

const mockUseAdminAuditLogList = jest.fn();

jest.mock('@/hooks/useApi', () => ({
  useAdminAuditLogList: (filters: unknown) => mockUseAdminAuditLogList(filters),
}));

// Stub clipboard API before each test
beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: jest.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
});

describe('AdminAuditLogPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAdminAuditLogList.mockReturnValue({
      data: {
        items: [
          {
            id: 'a1',
            created_at: '2026-02-07T10:00:00Z',
            admin_user_id: 'u1',
            actor_email: 'admin@example.com',
            actor_display_name: 'Admin',
            action: 'course.publish',
            target_type: 'course',
            target_id: 'c1',
            entity_type: 'course',
            entity_id: 'c1',
            entity_key: 'yoruba_101',
            details: { result: 'success' },
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
        pages: 1,
        filters_applied: {},
      },
      isLoading: false,
      isError: false,
    });
  });

  it('renders audit log table and opens details modal', async () => {
    render(<AdminAuditLogPage />);

    expect(screen.getByText('Audit Log')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('course.publish')).toBeInTheDocument();

    // Link-out for course target
    const targetLink = screen.getByRole('link', { name: 'c1' });
    expect(targetLink).toHaveAttribute('href', '/curriculum/courses/c1');

    await userEvent.click(screen.getByText('View'));
    expect(screen.getByText('Audit Log Details')).toBeInTheDocument();
    expect(screen.getAllByText('course.publish').length).toBeGreaterThanOrEqual(2);

    // Details JSON pretty-print
    expect(screen.getByText(/"result": "success"/)).toBeInTheDocument();
  });

  it('passes q search + time preset to hook filters', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-02-08T00:00:00Z'));

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(<AdminAuditLogPage />);

    await user.type(screen.getByLabelText('Search'), 'publish');
    const lastCall1 = mockUseAdminAuditLogList.mock.calls.at(-1)?.[0] as any;
    expect(lastCall1.q).toBe('publish');

    await user.selectOptions(screen.getByLabelText('Time window'), '24h');

    const lastCall2 = mockUseAdminAuditLogList.mock.calls.at(-1)?.[0] as any;
    expect(lastCall2.from_ts).toBe(new Date('2026-02-07T00:00:00.000Z').toISOString());
    expect(lastCall2.to_ts).toBeUndefined();

    jest.useRealTimers();
  });

  it('Ops Mode toggle switches to compact table with entity_key column', async () => {
    render(<AdminAuditLogPage />);

    // Initially standard table headers are visible
    expect(screen.getByText('Actor')).toBeInTheDocument();
    expect(screen.queryByText('Entity key')).not.toBeInTheDocument();

    // Toggle ON
    const opsBtn = screen.getByRole('button', { name: /Ops Mode/i });
    await userEvent.click(opsBtn);

    // Compact headers appear
    expect(screen.getByText('Entity key')).toBeInTheDocument();
    expect(screen.getByText('Entity type')).toBeInTheDocument();
    // Standard "Actor" header gone
    expect(screen.queryByText('Actor')).not.toBeInTheDocument();

    // entity_key value from mock data is rendered
    expect(screen.getByText('yoruba_101')).toBeInTheDocument();
  });

  it('Ops Mode preset buttons filter by action', async () => {
    render(<AdminAuditLogPage />);

    // Enable Ops Mode
    await userEvent.click(screen.getByRole('button', { name: /Ops Mode/i }));

    // Click "publish" preset
    await userEvent.click(screen.getByRole('button', { name: 'publish' }));

    const lastCall = mockUseAdminAuditLogList.mock.calls.at(-1)?.[0] as any;
    expect(lastCall.action).toBe('publish');
  });

  it('shows Copy JSON and Copy request_id buttons in details modal', async () => {
    render(<AdminAuditLogPage />);

    // Open modal
    await userEvent.click(screen.getByText('View'));

    // Modal is open — copy buttons must be visible
    expect(screen.getByRole('button', { name: /copy json/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy request_id/i })).toBeInTheDocument();
  });

  it('Copy JSON writes details JSON to clipboard', async () => {
    render(<AdminAuditLogPage />);
    await userEvent.click(screen.getByText('View'));

    const copyJsonBtn = screen.getByRole('button', { name: /copy json/i });
    await userEvent.click(copyJsonBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      JSON.stringify({ result: 'success' }, null, 2)
    );
  });
});

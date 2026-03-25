import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders as render } from '@/test-utils';
import ValidationResultViewer from '@/components/admin/curriculum/ValidationResultViewer';

describe('ValidationResultViewer', () => {
  it('renders errors and warnings with counts and filter tabs', async () => {
    const user = userEvent.setup();

    render(
      <ValidationResultViewer
        validation={{
          status: 'invalid',
          errors: [
            {
              code: 'E001',
              path: '$.steps[0].prompt',
              message: 'Missing prompt',
              severity: 'ERROR',
            },
          ],
          warnings: [
            {
              code: 'W001',
              path: '$.metadata',
              message: 'Non-blocking warning',
              severity: 'WARNING',
            },
          ],
          validated_at: '2026-02-25T00:00:00Z',
          can_publish: false,
          blocking_error_count: 1,
          warning_count: 1,
        }}
      />
    );

    expect(screen.getByText('Validation')).toBeInTheDocument();

    // All tab shows both
    expect(screen.getByText('Missing prompt')).toBeInTheDocument();
    expect(screen.getByText('Non-blocking warning')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Errors (1)' }));
    expect(screen.getByText('Missing prompt')).toBeInTheDocument();
    expect(screen.queryByText('Non-blocking warning')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Warnings (1)' }));
    expect(screen.getByText('Non-blocking warning')).toBeInTheDocument();
    expect(screen.queryByText('Missing prompt')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'All (2)' }));
    expect(screen.getByText('Missing prompt')).toBeInTheDocument();
    expect(screen.getByText('Non-blocking warning')).toBeInTheDocument();
  });

  it('shows edit actions when a jump handler is provided', async () => {
    const user = userEvent.setup();
    const onJumpToPath = jest.fn();

    render(
      <ValidationResultViewer
        validation={{
          status: 'invalid',
          errors: [],
          warnings: [
            {
              code: 'empty_subtitle',
              path: 'subtitle',
              message: 'subtitle is empty',
              severity: 'WARNING',
            },
          ],
          validated_at: '2026-02-25T00:00:00Z',
          can_publish: false,
          blocking_error_count: 0,
          warning_count: 1,
        }}
        onJumpToPath={onJumpToPath}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Edit field' }));
    expect(onJumpToPath).toHaveBeenCalledWith('subtitle');
  });
});

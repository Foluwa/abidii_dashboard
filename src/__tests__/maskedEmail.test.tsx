import React from 'react';
import { fireEvent, screen } from '@testing-library/react';

import MaskedEmail from '@/components/common/MaskedEmail';
import { maskEmail } from '@/lib/maskEmail';
import { renderWithProviders as render } from '@/test-utils';

describe('maskEmail', () => {
  it('keeps two letters and the domain', () => {
    expect(maskEmail('folu@abidii.app')).toBe('fo••••@abidii.app');
    expect(maskEmail('ab@gmail.com')).toBe('a••••@gmail.com');
    expect(maskEmail('x7k2q9@privaterelay.appleid.com')).toBe('x7••••@privaterelay.appleid.com');
  });

  it('handles empty and odd values', () => {
    expect(maskEmail(null)).toBe('');
    expect(maskEmail('')).toBe('');
    expect(maskEmail('not-an-email')).toBe('••••••');
  });
});

describe('MaskedEmail', () => {
  it('is masked until the eye is clicked, and toggles back', () => {
    const onRowClick = jest.fn();
    render(
      <div onClick={onRowClick}>
        <MaskedEmail email="ada.lovelace@gmail.com" />
      </div>,
    );
    expect(screen.getByTestId('masked-email')).toHaveTextContent('ad••••@gmail.com');
    expect(screen.queryByText('ada.lovelace@gmail.com')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show email' }));
    expect(screen.getByTestId('masked-email')).toHaveTextContent('ada.lovelace@gmail.com');
    expect(onRowClick).not.toHaveBeenCalled(); // revealing doesn't open the row

    fireEvent.click(screen.getByRole('button', { name: 'Hide email' }));
    expect(screen.getByTestId('masked-email')).toHaveTextContent('ad••••@gmail.com');
  });

  it('shows the empty label without an eye', () => {
    render(<MaskedEmail email={null} />);
    expect(screen.getByText('No email')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

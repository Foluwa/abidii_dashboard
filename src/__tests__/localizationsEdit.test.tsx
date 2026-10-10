import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ContentLocalizationsPage from '@/app/(admin)/(others-pages)/content/localizations/page';
import { renderWithProviders as render } from '@/test-utils';

const mockUpdate = jest.fn();
const mockList = jest.fn();

jest.mock('@/hooks/useAdminJob', () => ({ useAdminJob: () => ({ job: null }) }));

jest.mock('@/lib/adminJobsApi', () => ({
  createContentLocalizationJob: jest.fn(),
  publishContentLocalizations: jest.fn(),
  listContentLocalizations: (...args: unknown[]) => mockList(...args),
  updateContentLocalization: (...args: unknown[]) => mockUpdate(...args),
}));

const draft = {
  id: 'r1',
  entity_type: 'phrase',
  entity_id: 'p1',
  field_name: 'translation',
  locale: 'fr',
  value: 'Bon après-midi',
  status: 'machine_draft',
  english_value: 'Good afternoon',
  is_stale: false,
};

beforeEach(() => {
  mockUpdate.mockReset();
  mockList.mockReset().mockResolvedValue({ items: [draft], total: 1 });
});

it('edits a translation in place and keeps the row visible as reviewed', async () => {
  mockUpdate.mockResolvedValue({ id: 'r1', value: 'Bonjour', status: 'reviewed' });
  render(<ContentLocalizationsPage />);

  expect(await screen.findByText('Good afternoon')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Edit translation' }));
  const box = screen.getByRole('textbox', { name: 'Edit translation' });
  await userEvent.clear(box);
  await userEvent.type(box, 'Bonjour');
  await userEvent.click(screen.getByRole('button', { name: 'Save translation' }));

  await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith('r1', 'Bonjour'));
  expect(await screen.findByText('Bonjour')).toBeInTheDocument();
  expect(screen.getByText('reviewed')).toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: 'Edit translation' })).not.toBeInTheDocument();
});

it('cancel leaves the translation unchanged', async () => {
  render(<ContentLocalizationsPage />);
  await userEvent.click(await screen.findByRole('button', { name: 'Edit translation' }));
  await userEvent.type(screen.getByRole('textbox', { name: 'Edit translation' }), ' xyz');
  await userEvent.click(screen.getByRole('button', { name: 'Cancel editing' }));

  expect(mockUpdate).not.toHaveBeenCalled();
  expect(screen.getByText('Bon après-midi')).toBeInTheDocument();
});

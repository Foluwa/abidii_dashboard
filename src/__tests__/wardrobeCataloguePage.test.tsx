import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import WardrobeCataloguePage from '@/app/(admin)/(others-pages)/content/wardrobe/page';
import { renderWithProviders as render } from '@/test-utils';
import type { WardrobeCatalogItem } from '@/types/wardrobe';

const mockUseAdminWardrobeCatalog = jest.fn();
const mockRetire = jest.fn();
const mockUnretire = jest.fn();
const mockSetWindow = jest.fn();
const mockRefresh = jest.fn();

jest.mock('@/hooks/useApi', () => ({
  useAdminWardrobeCatalog: () => mockUseAdminWardrobeCatalog(),
}));

jest.mock('@/lib/wardrobeApi', () => ({
  retireWardrobeItem: (id: string) => mockRetire(id),
  unretireWardrobeItem: (id: string) => mockUnretire(id),
  setWardrobeItemAvailability: (id: string, window: unknown) => mockSetWindow(id, window),
}));

function item(overrides: Partial<WardrobeCatalogItem>): WardrobeCatalogItem {
  return {
    id: 'hat_red',
    slot: 'head',
    price: 120,
    catalog_version: 3,
    active: true,
    retired_at: null,
    available_from: null,
    available_until: null,
    created_at: '2026-09-01T00:00:00Z',
    purchasable: true,
    state: 'on_sale',
    owners_count: 4,
    equipped_count: 1,
    ...overrides,
  };
}

const changed = (it: WardrobeCatalogItem) => ({ changed: true, catalog_version: 6, item: it });

describe('WardrobeCataloguePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRefresh.mockResolvedValue(undefined);
    mockUseAdminWardrobeCatalog.mockReturnValue({
      data: {
        catalog_version: 5,
        total: 2,
        items: [
          item({}),
          item({
            id: 'cape_old',
            slot: 'back',
            price: 50,
            catalog_version: 5,
            retired_at: '2026-10-01T10:00:00Z',
            purchasable: false,
            state: 'retired',
            owners_count: 2,
            equipped_count: 0,
          }),
        ],
      },
      isLoading: false,
      isError: false,
      refresh: mockRefresh,
    });
  });

  it('renders the catalogue with state, owners and version', () => {
    render(<WardrobeCataloguePage />);

    expect(screen.getByText('Wardrobe Catalogue', { selector: 'h2, h1, span, li, a' })).toBeInTheDocument();
    expect(screen.getByTestId('catalog-version')).toHaveTextContent('Catalogue version 5 · 2 items');

    const hat = screen.getByTestId('wardrobe-row-hat_red');
    expect(within(hat).getByText('On sale')).toBeInTheDocument();
    expect(within(hat).getByText('120')).toBeInTheDocument();
    expect(within(hat).getByText('Always')).toBeInTheDocument();
    expect(within(hat).getByText(/1 equipped/)).toBeInTheDocument();
    expect(within(hat).getByRole('button', { name: 'Retire hat_red' })).toBeInTheDocument();

    const cape = screen.getByTestId('wardrobe-row-cape_old');
    expect(within(cape).getByText('Retired')).toBeInTheDocument();
    expect(within(cape).getByRole('button', { name: 'Unretire cape_old' })).toBeInTheDocument();
  });

  it('shows loading and error states', () => {
    mockUseAdminWardrobeCatalog.mockReturnValue({ data: undefined, isLoading: true, isError: false, refresh: mockRefresh });
    const { unmount } = render(<WardrobeCataloguePage />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    unmount();

    mockUseAdminWardrobeCatalog.mockReturnValue({ data: undefined, isLoading: false, isError: new Error('x'), refresh: mockRefresh });
    render(<WardrobeCataloguePage />);
    expect(screen.getByText('Failed to load the wardrobe catalogue.')).toBeInTheDocument();
  });

  it('retires only after confirmation, then refreshes', async () => {
    const user = userEvent.setup();
    mockRetire.mockResolvedValue(changed(item({ state: 'retired' })));
    render(<WardrobeCataloguePage />);

    await user.click(screen.getByRole('button', { name: 'Retire hat_red' }));
    expect(mockRetire).not.toHaveBeenCalled();
    expect(screen.getByText(/keep it and can still equip it/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retire' }));

    await waitFor(() => expect(mockRetire).toHaveBeenCalledWith('hat_red'));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it('cancelling the confirmation does not call the API', async () => {
    const user = userEvent.setup();
    render(<WardrobeCataloguePage />);

    await user.click(screen.getByRole('button', { name: 'Retire hat_red' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockRetire).not.toHaveBeenCalled();
  });

  it('unretires after confirmation', async () => {
    const user = userEvent.setup();
    mockUnretire.mockResolvedValue(changed(item({ id: 'cape_old' })));
    render(<WardrobeCataloguePage />);

    await user.click(screen.getByRole('button', { name: 'Unretire cape_old' }));
    expect(mockUnretire).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Unretire' }));

    await waitFor(() => expect(mockUnretire).toHaveBeenCalledWith('cape_old'));
  });

  it('sets a sale window after review and confirmation', async () => {
    const user = userEvent.setup();
    mockSetWindow.mockResolvedValue(changed(item({ state: 'scheduled' })));
    render(<WardrobeCataloguePage />);

    await user.click(screen.getByRole('button', { name: 'Set window for hat_red' }));
    await user.type(screen.getByLabelText('Available from'), '2026-12-01T09:00');
    await user.type(screen.getByLabelText('Available until'), '2026-12-31T09:00');
    await user.click(screen.getByRole('button', { name: 'Review change' }));
    expect(mockSetWindow).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Save window' }));

    await waitFor(() =>
      expect(mockSetWindow).toHaveBeenCalledWith('hat_red', {
        available_from: new Date('2026-12-01T09:00').toISOString(),
        available_until: new Date('2026-12-31T09:00').toISOString(),
      }),
    );
  });

  it('rejects a window whose start is not before its end', async () => {
    const user = userEvent.setup();
    render(<WardrobeCataloguePage />);

    await user.click(screen.getByRole('button', { name: 'Set window for hat_red' }));
    await user.type(screen.getByLabelText('Available from'), '2026-12-31T09:00');
    await user.type(screen.getByLabelText('Available until'), '2026-12-01T09:00');
    await user.click(screen.getByRole('button', { name: 'Review change' }));

    expect(screen.getByRole('alert')).toHaveTextContent('must be before');
    expect(screen.queryByRole('button', { name: 'Save window' })).not.toBeInTheDocument();
    expect(mockSetWindow).not.toHaveBeenCalled();
  });
});

/** Admin wardrobe catalogue (backend: app/routers/admin_wardrobe.py). */

export type WardrobeItemState = 'retired' | 'inactive' | 'scheduled' | 'expired' | 'on_sale';

export interface WardrobeCatalogItem {
  id: string;
  slot: string;
  price: number;
  catalog_version: number;
  active: boolean;
  retired_at: string | null;
  available_from: string | null;
  available_until: string | null;
  created_at: string | null;
  purchasable: boolean;
  state: WardrobeItemState;
  owners_count: number;
  equipped_count: number;
}

export interface WardrobeCatalogResponse {
  catalog_version: number;
  items: WardrobeCatalogItem[];
  total: number;
}

export interface WardrobeItemChangeResponse {
  changed: boolean;
  catalog_version: number;
  item: WardrobeCatalogItem;
}

export interface WardrobeAvailabilityWindow {
  available_from: string | null;
  available_until: string | null;
}

import { apiClient } from '@/lib/api';
import type { WardrobeAvailabilityWindow, WardrobeItemChangeResponse } from '@/types/wardrobe';

const BASE = '/api/v1/admin/wardrobe/items';

export async function retireWardrobeItem(itemId: string) {
  const res = await apiClient.post<WardrobeItemChangeResponse>(`${BASE}/${encodeURIComponent(itemId)}/retire`, {});
  return res.data;
}

export async function unretireWardrobeItem(itemId: string) {
  const res = await apiClient.post<WardrobeItemChangeResponse>(`${BASE}/${encodeURIComponent(itemId)}/unretire`, {});
  return res.data;
}

export async function setWardrobeItemAvailability(itemId: string, window: WardrobeAvailabilityWindow) {
  const res = await apiClient.put<WardrobeItemChangeResponse>(
    `${BASE}/${encodeURIComponent(itemId)}/availability`,
    window,
  );
  return res.data;
}

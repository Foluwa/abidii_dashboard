import { apiClient } from '@/lib/api';

const BASE = '/api/v1/admin/content-safety';

/** Backend SENSITIVE_CATEGORIES (app/services/content_safety_service.py). */
export const SENSITIVE_CATEGORIES = [
  { value: 'sexual', label: 'Sexual' },
  { value: 'profanity', label: 'Profanity' },
  { value: 'violence', label: 'Violence' },
  { value: 'crime', label: 'Crime' },
  { value: 'drugs', label: 'Drugs' },
  { value: 'self_harm', label: 'Self-harm' },
  { value: 'hate', label: 'Hate' },
] as const;

export type SensitiveCategory = (typeof SENSITIVE_CATEGORIES)[number]['value'];

export function categoryLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return SENSITIVE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export interface SensitivityChange {
  id: string;
  is_sensitive: boolean;
  category: string | null;
  reason: string | null;
  source: 'admin';
}

/**
 * Hide (is_sensitive) or unhide a dictionary word (lemma) for learners.
 * Admin only on the backend; the decision is never changed by the AI check.
 */
export async function setWordSensitivity(
  lemmaId: string,
  body: { is_sensitive: true; category: SensitiveCategory; reason?: string | null } | { is_sensitive: false },
): Promise<SensitivityChange> {
  const res = await apiClient.patch<SensitivityChange>(
    `${BASE}/lemmas/${encodeURIComponent(lemmaId)}`,
    body,
  );
  return res.data;
}

/** Starts a background AI check run (admin). 409 while one is running. */
export async function startClassification(options: { limit?: number; recheckClassifierSafe?: boolean } = {}) {
  const res = await apiClient.post(`${BASE}/classify`, {
    limit: options.limit ?? 200000,
    recheck_classifier_safe: options.recheckClassifierSafe ?? false,
  });
  return res.data as { started: boolean; limit: number; recheck_classifier_safe: boolean };
}

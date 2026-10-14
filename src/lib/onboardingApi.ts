import { apiClient } from '@/lib/api';
import type {
  AcquisitionOption,
  OnboardingReview,
  OnboardingReviewInput,
} from '@/types/onboarding';

export const ONBOARDING_REVIEWS_URL = '/api/v1/admin/onboarding/reviews';
export const ACQUISITION_OPTIONS_URL = '/api/v1/admin/onboarding/acquisition-options';
export const ACQUISITION_ANALYTICS_URL = '/api/v1/admin/analytics/acquisition';

/** Config keys (System → Configuration) that switch the onboarding steps. */
export const ONBOARDING_CONFIG_KEYS = [
  'onboarding.reviews_enabled',
  'onboarding.acquisition_enabled',
  'onboarding.welcome_audio_url',
] as const;

/** Configuration screen (Feature Flags tab), filtered to the onboarding.* keys. */
export const ONBOARDING_CONFIG_HREF = '/system/configuration?tab=platform&key=onboarding.';

/** List endpoints may return a bare array or `{ items: [...] }`. */
export function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)) {
    return (data as { items: T[] }).items;
  }
  return [];
}

export async function createOnboardingReview(payload: OnboardingReviewInput) {
  const res = await apiClient.post<OnboardingReview>(ONBOARDING_REVIEWS_URL, payload);
  return res.data;
}

export async function updateOnboardingReview(id: string, payload: Partial<OnboardingReviewInput>) {
  const res = await apiClient.put<OnboardingReview>(`${ONBOARDING_REVIEWS_URL}/${encodeURIComponent(id)}`, payload);
  return res.data;
}

export async function deleteOnboardingReview(id: string) {
  await apiClient.delete(`${ONBOARDING_REVIEWS_URL}/${encodeURIComponent(id)}`);
}

export async function createAcquisitionOption(payload: AcquisitionOption) {
  const res = await apiClient.post<AcquisitionOption>(ACQUISITION_OPTIONS_URL, payload);
  return res.data;
}

export async function updateAcquisitionOption(key: string, payload: Partial<AcquisitionOption>) {
  const res = await apiClient.put<AcquisitionOption>(
    `${ACQUISITION_OPTIONS_URL}/${encodeURIComponent(key)}`,
    payload,
  );
  return res.data;
}

export async function deleteAcquisitionOption(key: string) {
  await apiClient.delete(`${ACQUISITION_OPTIONS_URL}/${encodeURIComponent(key)}`);
}

/** A readable message for a failed admin call; 404 means the backend for
 * this feature isn't deployed on this server yet. */
export function describeApiError(error: unknown, fallback: string): { message: string; notDeployed: boolean } {
  const err = error as { response?: { status?: number; data?: { detail?: unknown } }; message?: string } | null;
  const status = err?.response?.status;
  if (status === 404) {
    return { message: 'This feature is not available on this server yet.', notDeployed: true };
  }
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string' && detail) return { message: detail, notDeployed: false };
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0] as { msg?: string } | undefined;
    if (first?.msg) return { message: first.msg, notDeployed: false };
  }
  return { message: err?.message || fallback, notDeployed: false };
}

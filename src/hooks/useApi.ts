/**
 * Custom hooks for API data fetching using SWR
 * 
 * Provides reusable hooks for:
 * - Data fetching with automatic caching
 * - Auto-refresh on interval
 * - Error handling
 * - Loading states
 */

import useSWR from 'swr';
import { apiClient } from '@/lib/api';
import type { UserRole } from '@/types/auth';
import type {
  CourseAdminListResponse,
  CurriculumReadinessMatrixResponse,
  CurriculumVocabLibraryResponse,
  CourseCurriculumResponse,
  CourseValidationResponse,
  LessonBlueprintAuthoringCapabilitiesResponse,
  LessonBlueprintAdminListResponse,
  LessonBlueprintAssetLibraryResponse,
  LessonBlueprintValidationResponse,
  PublicLessonBlueprintResponse,
} from '@/types/curriculum';
import type { AdminAuditLogListResponse } from '@/types/audit-log';
import type { CurriculumOpsMetricsResponse } from '@/types/admin-analytics';
import type {
  OrphanAssetCandidateListResponse,
  OrphanAssetScanListResponse,
  OrphanAssetSummaryResponse,
} from '@/types/orphan-assets';
import {
  SystemStatus,
  ServicesStatusResponse,
  SystemStats,
  UserListItem,
  UserDetail,
  Language,
  BillingPlan,
  Lesson,
  Word,
  AlertLevel,
  AlertCategory,
  Proverb,
  AlertHistoryResponse,
  ConfigEntry,
  AppSetting,
  PaginatedResponse,
  UserFilters,
  ContentFilters,
  AlertFilters,
  Game,
  GameType,
} from '@/types/api';
import { useAuth } from '@/context/AuthContext';

/**
 * Generic fetcher function for SWR

 */
const fetcher = (url: string) => apiClient.get(url).then((res) => res.data);

function useAdminApiEnabled() {
  const { isAuthenticated, isLoading } = useAuth();
  return !isLoading && isAuthenticated;
}

function useAdminApiReady() {
  const { isAuthenticated, isLoading } = useAuth();
  return {
    enabled: !isLoading && isAuthenticated,
    isAuthLoading: isLoading,
  };
}

/**
 * Billing Plans Hook
 */
export function useBillingPlans(countryCode?: string) {
  const params = new URLSearchParams();
  if (countryCode) params.set('country_code', countryCode);
  const suffix = params.toString() ? `?${params.toString()}` : '';

  const { data, error, mutate } = useSWR<BillingPlan[]>(
    `/api/v1/billing/plans${suffix}`,
    fetcher,
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  );

  return {
    plans: data || [],
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}

/**
 * System Status Hook
 * Auto-refreshes every 60 seconds
 */
export function useSystemStatus() {
  const { data, error, mutate } = useSWR<SystemStatus>(
    '/api/v1/admin/status',
    fetcher,
    {
      refreshInterval: 0, // Disabled auto-refresh - only refresh on user action
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      // Avoid infinite retry loops on persistent 401/403 from admin status
      shouldRetryOnError: false,
    }
  );

  return {
    status: data,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}

/**
 * Infrastructure Services Status Hook (database, Redis, object storage,
 * MLflow, Lambda GPU cloud). Auto-refreshes every 60 seconds so a service
 * coming back online is reflected without a manual refresh.
 */
export function useServicesStatus() {
  const { data, error, mutate } = useSWR<ServicesStatusResponse>(
    '/api/v1/admin/services-status',
    fetcher,
    {
      refreshInterval: 60000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  );

  return {
    services: data?.services || [],
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}

/**
 * System Stats Hook
 */
export function useSystemStats() {
  const { data, error, mutate } = useSWR<SystemStats>(
    '/api/v1/admin/stats',
    fetcher,
    {
      refreshInterval: 0, // Disabled auto-refresh - only refresh on user action
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      // Avoid infinite retry loops on persistent 401/403 from admin stats
      shouldRetryOnError: false,
    }
  );

  return {
    stats: data,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}

/**
 * System Metrics Hook
 * For monitoring CPU, memory, disk usage
 */
export function useSystemMetrics() {
  const { data, error, mutate } = useSWR(
    '/api/v1/admin/metrics/system',
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );

  return {
    metrics: data,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}

/**
 * Users List Hook with filters
 */
export function useUsers(filters?: {
  search?: string;
  role?: UserRole;
  page?: number;
  limit?: number;
  is_active?: boolean;
  provider?: string;
  min_xp?: number;
  max_xp?: number;
  last_login_after?: string;
  last_login_before?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.role) params.append('role', filters.role);
  if (filters?.search) params.append('search', filters.search);
  if (filters?.is_active !== undefined) params.append('is_active', filters.is_active.toString());
  if (filters?.provider) params.append('provider', filters.provider);
  if (filters?.min_xp !== undefined) params.append('min_xp', filters.min_xp.toString());
  if (filters?.max_xp !== undefined) params.append('max_xp', filters.max_xp.toString());
  if (filters?.last_login_after) params.append('last_login_after', filters.last_login_after);
  if (filters?.last_login_before) params.append('last_login_before', filters.last_login_before);

  const url = `/api/v1/admin/users?${params.toString()}`;

  const { data, error, mutate } = useSWR(url, fetcher);

  return {
    users: data,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}

/**
 * User Detail Hook
 */
export function useUserDetail(userId: string | null) {
  const { data, error, mutate } = useSWR(
    userId ? `/api/v1/admin/users/${userId}` : null,
    fetcher
  );

  return {
    user: data,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}

/**
 * Admin Users Hook
 */
export function useAdminUsers() {
  const { data, error, mutate } = useSWR<UserListItem[]>(
    '/api/v1/admin/admins',
    fetcher
  );

  return {
    admins: data || [],
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}

/**
 * Configuration Hook - Feature Flags Management
 */
export function useConfig() {
  const { data, error, mutate } = useSWR<ConfigEntry[]>(
    '/api/v1/admin/configs',
    fetcher
  );

  return {
    config: data || [],
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}

/**
 * App Settings Hook - JSONB-based Settings Management
 */
export function useAppSettings(category?: string) {
  const url = category
    ? `/api/v1/admin/configs/app-settings?category=${category}`
    : '/api/v1/admin/configs/app-settings';
  
  const { data, error, mutate } = useSWR<AppSetting[]>(url, fetcher);

  return {
    settings: data || [],
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}

/**
 * Alert History Hook
 */
export function useAlertHistory(filters?: AlertFilters) {
  const params = new URLSearchParams();
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.level) params.append('level', filters.level);
  if (filters?.category) params.append('category', filters.category);
  if (filters?.hours) params.append('hours', filters.hours.toString());

  const url = `/api/v1/admin/history?${params.toString()}`;

  const { data, error, mutate } = useSWR<AlertHistoryResponse>(url, fetcher, {
    refreshInterval: 60000, // 60 seconds
  });

  return {
    alerts: data,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}

/**
 * Languages Hook
 */
export function useLanguages() {
  const { data, error, mutate } = useSWR('/api/v1/languages', fetcher);

  return {
    languages: data?.languages || [],
    total: data?.total || 0,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}

/**
 * Curriculum / Blueprint (Admin) Hooks
 */
export function useAdminBlueprint(blueprintId: string | null) {
  const { data, error, mutate } = useSWR<LessonBlueprintValidationResponse>(
    blueprintId ? `/api/v1/admin/lesson-blueprints/${blueprintId}` : null,
    fetcher,
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  );

  return {
    data,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
    mutate,
  };
}

export function useAdminBlueprintCapabilities() {
  const { data, error, mutate } = useSWR<LessonBlueprintAuthoringCapabilitiesResponse>(
    '/api/v1/admin/lesson-blueprints/capabilities',
    fetcher,
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  );

  return {
    data,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
    mutate,
  };
}

export function useAdminBlueprintAssetLibrary(filters?: {
  page?: number;
  limit?: number;
  course_id?: string;
  asset_kind?: string;
  search?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.course_id) params.set('course_id', filters.course_id);
  if (filters?.asset_kind) params.set('asset_kind', filters.asset_kind);
  if (filters?.search) params.set('search', filters.search);

  const suffix = params.toString() ? `?${params.toString()}` : '';
  const { data, error, mutate } = useSWR<LessonBlueprintAssetLibraryResponse>(
    `/api/v1/admin/lesson-blueprints/assets/library${suffix}`,
    fetcher,
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  );

  return {
    data,
    items: data?.items ?? [],
    total: data?.total ?? 0,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
    mutate,
  };
}

export function useCurriculumVocabLibrary(filters?: {
  language_id?: string;
  page?: number;
  limit?: number;
  search?: string;
  external_ids?: string[];
}) {
  const params = new URLSearchParams();
  if (filters?.language_id) params.set('language_id', filters.language_id);
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.search) params.set('search', filters.search);
  for (const externalId of filters?.external_ids ?? []) {
    if (externalId) params.append('external_ids', externalId);
  }

  const suffix = params.toString() ? `?${params.toString()}` : '';
  const { data, error, mutate } = useSWR<CurriculumVocabLibraryResponse>(
    filters?.language_id ? `/api/v1/admin/lesson-blueprints/vocab/library${suffix}` : null,
    fetcher,
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  );

  return {
    items: data?.items ?? [],
    total: data?.total ?? 0,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}

export function useAdminCourse(courseId: string | null) {
  const { data, error, mutate } = useSWR<CourseValidationResponse>(
    courseId ? `/api/v1/admin/courses/${courseId}` : null,
    fetcher,
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  );

  return {
    data,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
    mutate,
  };
}

export function useAdminCourseValidationSummary(courseId: string | null) {
  const { data, error, mutate } = useSWR<CourseValidationResponse>(
    courseId ? `/api/v1/admin/courses/${courseId}/validation-summary` : null,
    fetcher,
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  );

  return {
    data,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
    mutate,
  };
}

export interface AdminCoursesListFilters {
  page?: number;
  limit?: number;
  status?: string;
  enabled?: boolean;
  search?: string;
}

export function useAdminCoursesList(filters?: AdminCoursesListFilters) {
  const params = new URLSearchParams();
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.status) params.set('status', filters.status);
  if (typeof filters?.enabled === 'boolean') params.set('enabled', String(filters.enabled));
  if (filters?.search) params.set('search', filters.search);

  const suffix = params.toString() ? `?${params.toString()}` : '';
  const url = `/api/v1/admin/courses${suffix}`;

  const { data, error, mutate } = useSWR<CourseAdminListResponse>(url, fetcher, {
    refreshInterval: 0,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  });

  return {
    data,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
    mutate,
  };
}

export function useCurriculumReadinessMatrix() {
  const { data, error, mutate } = useSWR<CurriculumReadinessMatrixResponse>(
    '/api/v1/admin/curriculum/readiness-matrix',
    fetcher,
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  );

  return {
    data,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
    mutate,
  };
}

export interface AdminLessonBlueprintsListFilters {
  page?: number;
  limit?: number;
  course_id?: string;
  status?: string;
  enabled?: boolean;
  search?: string;
}

export function useAdminLessonBlueprintsList(filters?: AdminLessonBlueprintsListFilters) {
  const params = new URLSearchParams();
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.course_id) params.set('course_id', filters.course_id);
  if (filters?.status) params.set('status', filters.status);
  if (typeof filters?.enabled === 'boolean') params.set('enabled', String(filters.enabled));
  if (filters?.search) params.set('search', filters.search);

  const suffix = params.toString() ? `?${params.toString()}` : '';
  const url = `/api/v1/admin/lesson-blueprints${suffix}`;

  const { data, error, mutate } = useSWR<LessonBlueprintAdminListResponse>(url, fetcher, {
    refreshInterval: 0,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  });

  return {
    data,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
    mutate,
  };
}

export interface AdminAuditLogListFilters {
  page?: number;
  limit?: number;
  action?: string;
  action_prefix?: string;
  target_type?: string;
  target_id?: string;
  admin_user_id?: string;
  result?: string;
  from_ts?: string;
  to_ts?: string;

  // Phase 11 (additive) aliases / enhancements
  offset?: number;
  q?: string;
  entity_type?: string;
  entity_id?: string;
  entity_key?: string;
  date_from?: string;
  date_to?: string;
}

export function useAdminAuditLogList(filters?: AdminAuditLogListFilters) {
  const params = new URLSearchParams();
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.action) params.set('action', filters.action);
  if (filters?.action_prefix) params.set('action_prefix', filters.action_prefix);
  if (filters?.target_type) params.set('target_type', filters.target_type);
  if (filters?.target_id) params.set('target_id', filters.target_id);
  if (filters?.admin_user_id) params.set('admin_user_id', filters.admin_user_id);
  if (filters?.result) params.set('result', filters.result);
  if (filters?.from_ts) params.set('from_ts', filters.from_ts);
  if (filters?.to_ts) params.set('to_ts', filters.to_ts);

  if (typeof filters?.offset === 'number') params.set('offset', String(filters.offset));
  if (filters?.q) params.set('q', filters.q);
  if (filters?.entity_type) params.set('entity_type', filters.entity_type);
  if (filters?.entity_id) params.set('entity_id', filters.entity_id);
  if (filters?.entity_key) params.set('entity_key', filters.entity_key);
  if (filters?.date_from) params.set('date_from', filters.date_from);
  if (filters?.date_to) params.set('date_to', filters.date_to);

  const suffix = params.toString() ? `?${params.toString()}` : '';
  const url = `/api/v1/admin/audit-log${suffix}`;

  const { data, error, mutate } = useSWR<AdminAuditLogListResponse>(url, fetcher, {
    refreshInterval: 0,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  });

  return {
    data,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
    mutate,
  };
}


export interface AdminOrphanAssetCandidateFilters {
  page?: number;
  limit?: number;
  asset_type?: string;
  prefix?: string;
  status?: string;
  min_age_days?: number;
  max_age_days?: number;
  min_size_bytes?: number;
  max_size_bytes?: number;
  q?: string;
}

export function useAdminOrphanAssetSummary() {
  const { data, error, mutate } = useSWR<OrphanAssetSummaryResponse>(
    '/api/v1/admin/orphan-assets/summary',
    fetcher,
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  );

  return {
    data,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
    mutate,
  };
}

export function useAdminOrphanAssetScans(filters?: { page?: number; limit?: number }) {
  const params = new URLSearchParams();
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.limit) params.set('limit', String(filters.limit));
  const suffix = params.toString() ? `?${params.toString()}` : '';

  const { data, error, mutate } = useSWR<OrphanAssetScanListResponse>(
    `/api/v1/admin/orphan-assets/scans${suffix}`,
    fetcher,
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  );

  return {
    data,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
    mutate,
  };
}

export function useAdminOrphanAssetCandidates(filters?: AdminOrphanAssetCandidateFilters) {
  const params = new URLSearchParams();
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.asset_type) params.set('asset_type', filters.asset_type);
  if (filters?.prefix) params.set('prefix', filters.prefix);
  if (filters?.status) params.set('status', filters.status);
  if (typeof filters?.min_age_days === 'number') params.set('min_age_days', String(filters.min_age_days));
  if (typeof filters?.max_age_days === 'number') params.set('max_age_days', String(filters.max_age_days));
  if (typeof filters?.min_size_bytes === 'number') params.set('min_size_bytes', String(filters.min_size_bytes));
  if (typeof filters?.max_size_bytes === 'number') params.set('max_size_bytes', String(filters.max_size_bytes));
  if (filters?.q) params.set('q', filters.q);
  const suffix = params.toString() ? `?${params.toString()}` : '';

  const { data, error, mutate } = useSWR<OrphanAssetCandidateListResponse>(
    `/api/v1/admin/orphan-assets/candidates${suffix}`,
    fetcher,
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  );

  return {
    data,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
    mutate,
  };
}

/**
 * Curriculum / Blueprint (Public Read) Hooks
 *
 * Used to augment admin views with fields that are intentionally not exposed
 * on admin responses (e.g. availability + course curriculum tree).
 */
export function usePublicBlueprint(blueprintId: string | null) {
  const { data, error, mutate } = useSWR<PublicLessonBlueprintResponse>(
    blueprintId ? `/api/v1/lesson-blueprints/${blueprintId}` : null,
    fetcher,
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  );

  return {
    blueprint: data,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}

export function useCourseCurriculum(courseId: string | null) {
  const { data, error, mutate } = useSWR<CourseCurriculumResponse>(
    courseId ? `/api/v1/courses/${courseId}/curriculum` : null,
    fetcher,
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  );

  return {
    curriculum: data,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}

export function useCourseCurriculumByKey(courseKey: string | null) {
  const { data, error, mutate } = useSWR<CourseCurriculumResponse>(
    courseKey ? `/api/v1/courses/by-key/${courseKey}/curriculum` : null,
    fetcher,
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  );

  return {
    curriculum: data,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}

export function useAdminCourseCurriculumByKey(courseKey: string | null) {
  const { data, error, mutate } = useSWR<CourseCurriculumResponse>(
    courseKey ? `/api/v1/admin/curriculum/courses/${encodeURIComponent(courseKey)}/tree` : null,
    fetcher,
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  );

  return {
    curriculum: data,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}

export function usePhonicsContrasts(languageCode: string | null) {
  const { data, error, mutate } = useSWR(
    languageCode ? `/api/v1/languages/${encodeURIComponent(languageCode)}/phonics/contrasts` : null,
    fetcher,
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  );

  return {
    contrasts: data?.contrasts || [],
    total: data?.total || 0,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}

/**
 * Words filter options type
 */
export interface WordsFilters {
  language_id?: string;
  source_language_id?: string;
  target_language_id?: string;
  search?: string;
  primary_translation?: string;
  page?: number;
  limit?: number;
  category?: string;
  difficulty?: number;
  has_audio?: boolean;
  has_examples?: boolean;
  has_related?: boolean;
  has_pronunciation?: boolean;
  starts_with?: string;
  ends_with?: string;
  contains?: string;
  pos?: string; // comma-separated for multiple: "noun,verb"
  tone_marks_present?: boolean;
  ipa_present?: boolean;
  word_length_min?: number;
  word_length_max?: number;
  sort_by?: 'lemma' | 'primary_translation' | 'created_at' | 'updated_at' | 'difficulty' | 'pos';
  sort_dir?: 'asc' | 'desc';
}

/**
 * Words Hook with comprehensive filters
 */
export function useWords(filters?: WordsFilters) {
  const params = new URLSearchParams();
  
  // Basic filters
  if (filters?.source_language_id) {
    params.append('source_language_id', filters.source_language_id);
  } else if (filters?.language_id) {
    params.append('language_id', filters.language_id);
  }
  if (filters?.target_language_id) params.append('target_language_id', filters.target_language_id);
  if (filters?.search) params.append('search', filters.search);
  if (filters?.primary_translation) params.append('primary_translation', filters.primary_translation);
  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.category) params.append('category', filters.category);
  if (filters?.difficulty) params.append('difficulty', filters.difficulty.toString());
  
  // Boolean filters
  if (filters?.has_audio !== undefined) params.append('has_audio', filters.has_audio.toString());
  if (filters?.has_examples !== undefined) params.append('has_examples', filters.has_examples.toString());
  if (filters?.has_related !== undefined) params.append('has_related', filters.has_related.toString());
  if (filters?.has_pronunciation !== undefined) params.append('has_pronunciation', filters.has_pronunciation.toString());
  if (filters?.tone_marks_present !== undefined) params.append('tone_marks_present', filters.tone_marks_present.toString());
  if (filters?.ipa_present !== undefined) params.append('ipa_present', filters.ipa_present.toString());
  
  // Text filters
  if (filters?.starts_with) params.append('starts_with', filters.starts_with);
  if (filters?.ends_with) params.append('ends_with', filters.ends_with);
  if (filters?.contains) params.append('contains', filters.contains);
  if (filters?.pos) params.append('pos', filters.pos);
  
  // Numeric filters
  if (filters?.word_length_min) params.append('word_length_min', filters.word_length_min.toString());
  if (filters?.word_length_max) params.append('word_length_max', filters.word_length_max.toString());
  
  // Sorting
  if (filters?.sort_by) params.append('sort_by', filters.sort_by);
  if (filters?.sort_dir) params.append('sort_dir', filters.sort_dir);

  const url = `/api/v1/admin/content/words?${params.toString()}`;
  const { data, error, mutate } = useSWR(url, fetcher);

  return {
    words: data?.items || [],
    total: data?.total || 0,
    pages: data?.pages || 0,
    filtersApplied: data?.filters_applied || {},
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}

/**
 * Proverbs Hook
 */
export function useProverbs(filters?: { language_id?: string; category?: string; page?: number; limit?: number }) {
  const params = new URLSearchParams();
  if (filters?.language_id) params.append('language_id', filters.language_id.toString());
  if (filters?.category) params.append('category', filters.category);
  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.limit) params.append('limit', filters.limit.toString());

  const url = `/api/v1/admin/content/proverbs?${params.toString()}`;
  const { data, error, mutate } = useSWR(url, fetcher);

  return {
    proverbs: data?.items || [],
    total: data?.total || 0,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}
/**
 * Games Hook
 */
export function useGames(filters?: { language_id?: number; game_type?: string; page?: number; limit?: number }) {
  const params = new URLSearchParams();
  if (filters?.language_id) params.append('language_id', filters.language_id.toString());
  if (filters?.game_type) params.append('game_type', filters.game_type);
  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.limit) params.append('limit', filters.limit.toString());

  const url = `/api/v1/admin/games?${params.toString()}`;
  const { data, error, mutate } = useSWR(url, fetcher);

  return {
    games: data?.games || [],
    total: data?.total || 0,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}

// =============================================================================
// ANALYTICS HOOKS
// =============================================================================

/**
 * Platform Distribution Hook
 * Returns users grouped by actual device platform (iOS/Android/unknown)
 */
export function usePlatformDistribution() {
  const { data, error, mutate } = useSWR(
    '/api/v1/devices/admin/platform-distribution',
    fetcher,
    { revalidateOnFocus: false }
  );
  const distribution = Array.isArray(data?.users_by_latest_platform)
    ? data.users_by_latest_platform
    : Array.isArray(data?.distribution)
      ? data.distribution
      : [];
  const totalUsers = Number.isFinite(data?.total_users_with_devices)
    ? data.total_users_with_devices
    : Number.isFinite(data?.total)
      ? data.total
      : distribution.reduce((sum: number, item: any) => sum + (Number(item?.count) || 0), 0);

  return {
    distribution,
    total: totalUsers,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}

/**
 * Monthly User Growth Hook
 * Returns new user registrations per month
 */
export function useMonthlyUserGrowth(months: number = 12) {
  const { data, error, mutate } = useSWR(
    `/api/v1/admin/analytics/monthly-user-growth?months=${months}`,
    fetcher,
    { revalidateOnFocus: false }
  );
  const series = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data)
      ? data
      : [];
  const totalCount = Number.isFinite(data?.total)
    ? data.total
    : series.reduce((sum: number, item: any) => sum + (Number(item?.count) || 0), 0);

  return {
    data: series,
    total: totalCount,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}

/**
 * Daily Active Users Hook
 * Returns distinct users with at least one session per day
 */
export function useDailyActiveUsers(days: number = 30) {
  const { data, error, mutate } = useSWR(
    `/api/v1/admin/analytics/daily-active-users?days=${days}`,
    fetcher,
    { revalidateOnFocus: false }
  );
  const series = Array.isArray(data?.data) ? data.data : [];
  const average = Number.isFinite(data?.average)
    ? data.average
    : series.length
      ? series.reduce((sum: number, item: any) => sum + (Number(item?.count) || 0), 0) / series.length
      : 0;

  return {
    data: series,
    average,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}

/**
 * Monthly Subscriber Growth Hook
 * Returns new subscribers per month (first-time only)
 */
export function useMonthlySubscriberGrowth(months: number = 12) {
  const { data, error, mutate } = useSWR(
    `/api/v1/admin/analytics/monthly-subscriber-growth?months=${months}`,
    fetcher,
    { revalidateOnFocus: false }
  );
  const series = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data)
      ? data
      : [];
  const totalCount = Number.isFinite(data?.total)
    ? data.total
    : series.reduce((sum: number, item: any) => sum + (Number(item?.count) || 0), 0);

  return {
    data: series,
    total: totalCount,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}

/**
 * Geographic Distribution (Last-known)
 * Returns all users grouped by users.country_code
 */
export function useGeoDistributionLastKnown(includeUnknown: boolean = true) {
  const { data, error, mutate } = useSWR(
    `/api/v1/admin/analytics/geo/last-known?include_unknown=${includeUnknown}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    data: data?.data || [],
    total: data?.total || 0,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}

/**
 * Geographic Distribution (Active users)
 * Returns active users in last N days grouped by most recent derived country.
 */
export function useGeoDistributionActiveUsers(
  windowDays: number = 30,
  includeUnknown: boolean = true
) {
  const { data, error, mutate } = useSWR(
    `/api/v1/admin/analytics/geo/active?window_days=${windowDays}&include_unknown=${includeUnknown}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    data: data?.data || [],
    total: data?.total || 0,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}

/**
 * Recent Activity (Phase 1)
 * Unified feed from admin_audit_log + subscription_events.
 */
export function useRecentActivity(limit: number = 10, days: number = 30) {
  const { data, error, mutate } = useSWR(
    `/api/v1/admin/analytics/recent-activity?limit=${limit}&days=${days}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    data: data?.data || [],
    total: data?.total || 0,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}

// =============================================================================
// SUBSCRIPTIONS HOOKS
// =============================================================================

/**
 * Subscriptions List Hook
 */
export function useSubscriptions(filters?: {
  status?: string;
  plan_id?: string;
  provider?: string;
  platform?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.plan_id) params.append('plan_id', filters.plan_id);
  if (filters?.provider) params.append('provider', filters.provider);
  if (filters?.platform) params.append('platform', filters.platform);
  if (filters?.search) params.append('search', filters.search);
  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.limit) params.append('limit', filters.limit.toString());

  const url = `/api/v1/admin/subscriptions?${params.toString()}`;
  const { data, error, mutate } = useSWR(url, fetcher);

  return {
    subscriptions: data?.items || [],
    total: data?.total || 0,
    page: data?.page || 1,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}

/**
 * Subscription Stats Hook
 */
export function useSubscriptionStats(filters?: { user_q?: string }) {
  const params = new URLSearchParams();
  if (filters?.user_q) params.append('user_q', filters.user_q);

  const query = params.toString();
  const url = query
    ? `/api/v1/admin/subscriptions/stats/summary?${query}`
    : '/api/v1/admin/subscriptions/stats/summary';
  const { data, error, mutate } = useSWR(url, fetcher, { revalidateOnFocus: false });

  return {
    stats: data,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}

/**
 * Subscription Events Hook
 */
export function useSubscriptionEvents(filters?: {
  event_type?: string;
  user_id?: string;
  user_q?: string;
  provider?: string;
  platform?: string;
  days?: number;
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.event_type) params.append('event_type', filters.event_type);
  if (filters?.user_id) params.append('user_id', filters.user_id);
  if (filters?.user_q) params.append('user_q', filters.user_q);
  if (filters?.provider) params.append('provider', filters.provider);
  if (filters?.platform) params.append('platform', filters.platform);
  if (filters?.days) params.append('days', filters.days.toString());
  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.limit) params.append('limit', filters.limit.toString());

  const url = `/api/v1/admin/subscriptions/events?${params.toString()}`;
  const { data, error, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
  });

  return {
    events: data?.items || [],
    total: data?.total || 0,
    page: data?.page || 1,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}

/**
 * Subscription Verification Attempts Hook
 */
export function useSubscriptionAttempts(filters?: {
  user_id?: string;
  user_q?: string;
  provider?: string;
  success?: boolean;
  days?: number;
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.user_id) params.append('user_id', filters.user_id);
  if (filters?.user_q) params.append('user_q', filters.user_q);
  if (filters?.provider) params.append('provider', filters.provider);
  if (filters?.success !== undefined) params.append('success', String(filters.success));
  if (filters?.days) params.append('days', filters.days.toString());
  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.limit) params.append('limit', filters.limit.toString());

  const url = `/api/v1/admin/subscriptions/attempts?${params.toString()}`;
  const { data, error, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
  });

  return {
    attempts: data?.items || [],
    total: data?.total || 0,
    page: data?.page || 1,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}

/**
 * Game Analytics Hook
 */
export function useGameAnalytics(days: number = 30, gameKey?: string, languageId?: string) {
  const params = new URLSearchParams();
  params.append('days', days.toString());
  if (gameKey) params.append('game_key', gameKey);
  if (languageId) params.append('language_id', languageId);

  const { enabled, isAuthLoading } = useAdminApiReady();
  const url = enabled ? `/api/v1/admin/analytics/game-stats?${params.toString()}` : null;
  const { data, error, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 0,
  });

  return {
    analytics: data,
    isLoading: isAuthLoading || (enabled && !error && !data),
    isError: error,
    refresh: mutate,
  };
}

/**
 * Player Leaderboard Hook
 */
export interface PlayerLeaderboardFilters {
  days?: number;
  period?: 'week' | 'month' | 'all';
  languageId?: string;
  gameKey?: string;
  minSessions?: number;
  sortBy?: 'score' | 'sessions' | 'accuracy' | 'time' | 'xp';
  search?: string;
  page?: number;
  perPage?: number;
}

export function usePlayerLeaderboard(filters?: PlayerLeaderboardFilters) {
  const params = new URLSearchParams();
  if (filters?.days) params.append('days', filters.days.toString());
  if (filters?.period) params.append('period', filters.period);
  if (filters?.languageId) params.append('language_id', filters.languageId);
  if (filters?.gameKey) params.append('game_key', filters.gameKey);
  if (filters?.minSessions) params.append('min_sessions', filters.minSessions.toString());
  if (filters?.sortBy) params.append('sort_by', filters.sortBy);
  if (filters?.search) params.append('search', filters.search);
  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.perPage) params.append('per_page', filters.perPage.toString());

  const { enabled, isAuthLoading } = useAdminApiReady();
  const url = enabled ? `/api/v1/admin/analytics/player-leaderboard?${params.toString()}` : null;
  const { data, error, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 0,
  });

  return {
    leaderboard: data,
    isLoading: isAuthLoading || (enabled && !error && !data),
    isError: error,
    refresh: mutate,
  };
}

/**
 * Player Detail Hook
 */
export interface PlayerDetailFilters {
  days?: number;
  languageId?: string;
  gameKey?: string;
}

export function usePlayerDetail(userId: string | null, filters?: PlayerDetailFilters) {
  const params = new URLSearchParams();
  if (filters?.days) params.append('days', filters.days.toString());
  if (filters?.languageId) params.append('language_id', filters.languageId);
  if (filters?.gameKey) params.append('game_key', filters.gameKey);

  const { enabled, isAuthLoading } = useAdminApiReady();
  const url = userId && enabled ? `/api/v1/admin/analytics/player-detail/${userId}?${params.toString()}` : null;
  const { data, error, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 0,
  });

  return {
    player: data,
    isLoading: userId ? (isAuthLoading || (enabled && !error && !data)) : false,
    isError: error,
    refresh: mutate,
  };
}

/**
 * Available Games Hook (for filter dropdowns)
 */
export function useAvailableGames() {
  const { enabled, isAuthLoading } = useAdminApiReady();
  const { data, error, mutate } = useSWR(
    enabled ? '/api/v1/admin/analytics/available-games' : null,
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 0,
    }
  );

  return {
    games: data?.games || [],
    isLoading: isAuthLoading || (enabled && !error && !data),
    isError: error,
    refresh: mutate,
  };
}

/**
 * Curriculum Ops Metrics Hook (Phase 11)
 */
export function useAdminCurriculumOpsMetrics(days: number = 7) {
  const params = new URLSearchParams();
  params.append('days', days.toString());

  const { enabled, isAuthLoading } = useAdminApiReady();
  const url = enabled ? `/api/v1/admin/analytics/curriculum-ops?${params.toString()}` : null;
  const { data, error, mutate } = useSWR<CurriculumOpsMetricsResponse>(url, fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 0,
    shouldRetryOnError: false,
  });

  return {
    metrics: data,
    isLoading: isAuthLoading || (enabled && !error && !data),
    isError: error,
    refresh: mutate,
  };
}

/**
 * User Learning State Hook (Phase 14 / Phase 18 updated)
 * Admin-side: read learning state for a specific user by ID.
 * Uses the proper admin endpoint: GET /api/v1/admin/learning-state/users/{id}
 */
export function useAdminUserLearningState(userId: string | null) {
  const url = userId ? `/api/v1/admin/learning-state/users/${encodeURIComponent(userId)}` : null;
  const { data, error, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 0,
    shouldRetryOnError: false,
  });

  return {
    state: data as { user_id: string; courses: Array<{
      course_id: string;
      course_key: string | null;
      course_title: string | null;
      enrolled_at: string;
      last_active_at: string | null;
      current_unit_id: string | null;
      current_section_id: string | null;
      progress_percent: number;
      is_completed: boolean;
      completed_at: string | null;
    }> } | undefined,
    isLoading: !error && !data && !!userId,
    isError: error,
    refresh: mutate,
  };
}

/**
 * Admin: reset a user's course progress.
 * POST /api/v1/admin/learning-state/users/{userId}/courses/{courseId}/reset
 */
export async function adminResetCourseProgress(
  userId: string,
  courseId: string,
): Promise<{ ok: boolean; deleted_progress_rows: number }> {
  const res = await fetch(
    `/api/v1/admin/learning-state/users/${encodeURIComponent(userId)}/courses/${encodeURIComponent(courseId)}/reset`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' } },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Reset failed (${res.status}): ${text}`);
  }
  return res.json();
}

/**
 * Admin: set a user's current unit/section pointer.
 * POST /api/v1/admin/learning-state/users/{userId}/courses/{courseId}/set-pointer
 */
export async function adminSetLearningPointer(
  userId: string,
  courseId: string,
  payload: { current_unit_id?: string; current_section_id?: string },
): Promise<{ ok: boolean }> {
  const res = await fetch(
    `/api/v1/admin/learning-state/users/${encodeURIComponent(userId)}/courses/${encodeURIComponent(courseId)}/set-pointer`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Set pointer failed (${res.status}): ${text}`);
  }
  return res.json();
}

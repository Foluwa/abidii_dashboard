import { renderHook } from '@testing-library/react';

// This project's jest config (babel-jest + jsdom) does not resolve the real
// 'swr' package's named exports correctly (only `default` comes through),
// so - consistent with this codebase's existing convention of mocking data
// dependencies rather than exercising them live (see auditLogPage.test.tsx,
// which mocks the whole @/hooks/useApi module) - useSWR itself is mocked
// here. This still exercises the actual useLearning*/useLessonAnalytics*/
// useLearnerJourney hook bodies in useApi.ts: URL/key construction (date
// filter serialization, id-gating to a null key), and the data/error/
// isLoading mapping each hook applies to whatever useSWR returns.
const mockUseSWR = jest.fn();

jest.mock('swr', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockUseSWR(...args),
}));

jest.mock('@/lib/api', () => ({
  apiClient: { get: jest.fn() },
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

import {
  useLearningAnalyticsOverview,
  useLessonAnalyticsSummary,
  useLessonAnalyticsVersions,
  useLearnerJourney,
} from '@/hooks/useApi';

beforeEach(() => {
  jest.clearAllMocks();
  mockUseSWR.mockReturnValue({ data: undefined, error: undefined, mutate: jest.fn() });
});

describe('useLearningAnalyticsOverview', () => {
  it('requests the unfiltered overview URL when no filters are given', () => {
    renderHook(() => useLearningAnalyticsOverview());
    expect(mockUseSWR.mock.calls[0][0]).toBe('/api/v1/admin/learning-analytics/overview');
  });

  it('serializes date/course/language filters into the query string', () => {
    renderHook(() =>
      useLearningAnalyticsOverview({
        dateFrom: '2026-01-01T00:00:00.000Z',
        dateTo: '2026-02-01T00:00:00.000Z',
        courseId: 'course-1',
        languageId: 'lang-1',
      }),
    );
    const url = mockUseSWR.mock.calls[0][0] as string;
    expect(url).toContain('date_from=2026-01-01T00%3A00%3A00.000Z');
    expect(url).toContain('date_to=2026-02-01T00%3A00%3A00.000Z');
    expect(url).toContain('course_id=course-1');
    expect(url).toContain('language_id=lang-1');
  });

  it('maps a successful response onto `overview` and reports not loading', () => {
    const payload = {
      summary: { unique_learners: 5, sessions_started: 10 },
      sections: [],
    };
    mockUseSWR.mockReturnValue({ data: payload, error: undefined, mutate: jest.fn() });

    const { result } = renderHook(() => useLearningAnalyticsOverview());
    expect(result.current.overview).toEqual(payload);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBeFalsy();
  });

  it('surfaces a fetch error via isError without throwing, and overview stays undefined', () => {
    const err = { response: { status: 500, data: { detail: 'boom' } } };
    mockUseSWR.mockReturnValue({ data: undefined, error: err, mutate: jest.fn() });

    const { result } = renderHook(() => useLearningAnalyticsOverview());
    expect(result.current.isError).toBe(err);
    expect(result.current.overview).toBeUndefined();
  });

  it('reports loading while enabled with neither data nor error yet', () => {
    mockUseSWR.mockReturnValue({ data: undefined, error: undefined, mutate: jest.fn() });
    const { result } = renderHook(() => useLearningAnalyticsOverview());
    expect(result.current.isLoading).toBe(true);
  });
});

describe('useLessonAnalyticsSummary', () => {
  it('passes a null key (does not fetch) when sectionId is undefined', () => {
    renderHook(() => useLessonAnalyticsSummary(undefined));
    expect(mockUseSWR.mock.calls[0][0]).toBeNull();
  });

  it('requests the per-lesson summary URL once a sectionId is provided', () => {
    renderHook(() => useLessonAnalyticsSummary('sec-1'));
    expect(mockUseSWR.mock.calls[0][0]).toBe('/api/v1/admin/learning-analytics/lessons/sec-1/summary');
  });

  it('maps a successful response onto `summary`', () => {
    const payload = { section_id: 'sec-1', funnel: { session_completion_rate: 0.5 } };
    mockUseSWR.mockReturnValue({ data: payload, error: undefined, mutate: jest.fn() });
    const { result } = renderHook(() => useLessonAnalyticsSummary('sec-1'));
    expect(result.current.summary).toEqual(payload);
  });
});

describe('useLessonAnalyticsVersions', () => {
  it('passes a null key (does not fetch) when sectionId is undefined', () => {
    renderHook(() => useLessonAnalyticsVersions(undefined));
    expect(mockUseSWR.mock.calls[0][0]).toBeNull();
  });

  it('maps an empty array response onto `versions` as-is', () => {
    mockUseSWR.mockReturnValue({ data: [], error: undefined, mutate: jest.fn() });
    const { result } = renderHook(() => useLessonAnalyticsVersions('sec-1'));
    expect(result.current.versions).toEqual([]);
  });

  it('preserves a null blueprint_content_hash row (legacy version) rather than dropping it', () => {
    const payload = [
      { blueprint_content_hash: null, sessions_started: 3, sessions_completed: 1, session_completion_rate: 0.333 },
      { blueprint_content_hash: 'sha256:abc123', sessions_started: 7, sessions_completed: 6, session_completion_rate: 0.857 },
    ];
    mockUseSWR.mockReturnValue({ data: payload, error: undefined, mutate: jest.fn() });
    const { result } = renderHook(() => useLessonAnalyticsVersions('sec-1'));
    expect(result.current.versions?.length).toBe(2);
    expect(result.current.versions?.[0].blueprint_content_hash).toBeNull();
  });
});

describe('useLearnerJourney', () => {
  it('passes a null key (does not fetch) when userId is undefined', () => {
    renderHook(() => useLearnerJourney(undefined));
    expect(mockUseSWR.mock.calls[0][0]).toBeNull();
  });

  it('requests the journey URL, URL-encoding the userId path segment', () => {
    renderHook(() => useLearnerJourney('user with space'));
    expect(mockUseSWR.mock.calls[0][0]).toBe('/api/v1/admin/learning-analytics/users/user%20with%20space/journey');
  });

  it('maps a successful response onto `journey`, preserving array order', () => {
    const sessions = [
      { session_id: 'a', started_at: '2026-01-01T00:00:00Z' },
      { session_id: 'b', started_at: '2026-01-02T00:00:00Z' },
    ];
    mockUseSWR.mockReturnValue({ data: sessions, error: undefined, mutate: jest.fn() });
    const { result } = renderHook(() => useLearnerJourney('user-1'));
    expect(result.current.journey).toEqual(sessions);
  });
});

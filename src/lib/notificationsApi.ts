import { apiClient } from './api';
import type {
  NotificationSendRequest,
  NotificationBroadcastRequest,
  NotificationResponse,
  NotificationLogItem,
  DailyContentFeedItem,
  AudienceSnapshotItem,
  TeaserQuizFeedItem,
  TeaserQuizStats,
  DailyWordOverrideRequest,
  DailyWordOverrideResponse,
  NotificationSchedule,
  NotificationScheduleUpdate,
  DictionarySearchResult,
} from '@/types/notifications';

export async function sendNotification(payload: NotificationSendRequest) {
  const res = await apiClient.post<NotificationResponse>(
    '/api/v1/notifications/send',
    payload
  );
  return res.data;
}

export async function broadcastNotification(payload: NotificationBroadcastRequest) {
  const res = await apiClient.post<NotificationResponse>(
    '/api/v1/notifications/broadcast',
    payload
  );
  return res.data;
}

export async function sendFilteredNotification(payload: {
  title: string;
  body: string;
  data?: Record<string, string>;
  language_code?: string;
  platform?: 'android' | 'ios' | 'all';
  user_ids?: string[];
}) {
  const res = await apiClient.post<NotificationResponse>(
    '/api/v1/notifications/send-filtered',
    payload
  );
  return res.data;
}

export async function listNotificationHistory(params?: {
  limit?: number;
  offset?: number;
}) {
  const usp = new URLSearchParams();
  if (params?.limit) usp.set('limit', String(params.limit));
  if (params?.offset) usp.set('offset', String(params.offset));
  const suffix = usp.toString() ? `?${usp.toString()}` : '';
  const res = await apiClient.get<NotificationLogItem[]>(
    `/api/v1/notifications/history${suffix}`
  );
  return res.data;
}

export async function listDailyContentFeed(params?: {
  limit?: number;
  offset?: number;
}) {
  const usp = new URLSearchParams();
  if (params?.limit) usp.set('limit', String(params.limit));
  if (params?.offset) usp.set('offset', String(params.offset));
  const suffix = usp.toString() ? `?${usp.toString()}` : '';
  const res = await apiClient.get<DailyContentFeedItem[]>(
    `/api/v1/notifications/daily-content/feed${suffix}`
  );
  return res.data;
}

export async function getAudienceTrend(params?: { days?: number }) {
  const usp = new URLSearchParams();
  if (params?.days) usp.set('days', String(params.days));
  const suffix = usp.toString() ? `?${usp.toString()}` : '';
  const res = await apiClient.get<AudienceSnapshotItem[]>(
    `/api/v1/notifications/audience-trend${suffix}`
  );
  return res.data;
}

export async function listTeaserQuizFeed(params?: { limit?: number; offset?: number }) {
  const usp = new URLSearchParams();
  if (params?.limit) usp.set('limit', String(params.limit));
  if (params?.offset) usp.set('offset', String(params.offset));
  const suffix = usp.toString() ? `?${usp.toString()}` : '';
  const res = await apiClient.get<TeaserQuizFeedItem[]>(
    `/api/v1/notifications/teaser-quiz/feed${suffix}`
  );
  return res.data;
}

export async function getTeaserQuizStats(params?: { days?: number }) {
  const usp = new URLSearchParams();
  if (params?.days) usp.set('days', String(params.days));
  const suffix = usp.toString() ? `?${usp.toString()}` : '';
  const res = await apiClient.get<TeaserQuizStats>(
    `/api/v1/notifications/teaser-quiz/stats${suffix}`
  );
  return res.data;
}

export async function overrideDailyWord(payload: DailyWordOverrideRequest) {
  const res = await apiClient.post<DailyWordOverrideResponse>(
    '/api/v1/notifications/daily-content/override',
    payload
  );
  return res.data;
}

export async function getNotificationSchedule() {
  const res = await apiClient.get<NotificationSchedule>('/api/v1/notifications/schedule');
  return res.data;
}

export async function updateNotificationSchedule(payload: NotificationScheduleUpdate) {
  const res = await apiClient.put<NotificationSchedule>('/api/v1/notifications/schedule', payload);
  return res.data;
}

export async function searchDictionary(query: string, languageCode = 'yor') {
  if (!query.trim()) return [];
  const usp = new URLSearchParams({ q: query, language_code: languageCode, limit: '10' });
  const res = await apiClient.get<DictionarySearchResult[]>(
    `/api/v1/dictionary/search?${usp.toString()}`
  );
  return res.data;
}

import { apiClient } from './api';
import type {
  NotificationSendRequest,
  NotificationBroadcastRequest,
  NotificationResponse,
  NotificationLogItem,
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
  user_ids?: number[];
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

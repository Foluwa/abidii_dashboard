import { apiClient } from '@/lib/api';
import type { SceneChangeResponse, SceneKind } from '@/types/scene-library';

const BASE = '/api/v1/admin/scene-library';
const path = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

export async function saveScene(id: string, kind: SceneKind, payload: Record<string, unknown>) {
  const res = await apiClient.put<SceneChangeResponse>(path(id), { kind, payload });
  return res.data;
}

export async function setSceneReviewed(id: string, reviewed: boolean) {
  const res = await apiClient.post<SceneChangeResponse>(`${path(id)}/review`, { reviewed });
  return res.data;
}

export async function rollbackScene(id: string, version: number) {
  const res = await apiClient.post<SceneChangeResponse>(`${path(id)}/rollback`, { version });
  return res.data;
}

export async function attachSceneToLesson(id: string, blueprintKey: string) {
  const res = await apiClient.post<SceneChangeResponse>(`${path(id)}/lessons`, { blueprint_key: blueprintKey });
  return res.data;
}

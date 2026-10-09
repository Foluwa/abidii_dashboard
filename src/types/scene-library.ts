export type SceneKind = 'conversation' | 'picture_scene';

export interface SceneSummary {
  id: string;
  kind: SceneKind;
  version: number;
  reviewed: boolean;
  reviewed_version: number | null;
  title: string | null;
  updated_at: string | null;
  lessons: string[];
  problems: string[];
}

export interface SceneListResponse {
  items: SceneSummary[];
  total: number;
}

export interface SceneVersion {
  version: number;
  reviewed: boolean;
  created_at: string | null;
  created_by: string | null;
}

export interface SceneDetail {
  id: string;
  kind: SceneKind;
  version: number;
  reviewed: boolean;
  updated_at: string | null;
  payload: Record<string, unknown>;
  problems: string[];
  lessons: string[];
  versions: SceneVersion[];
}

export interface SceneChangeResponse {
  changed: boolean;
  version: number | null;
  lessons: string[];
}

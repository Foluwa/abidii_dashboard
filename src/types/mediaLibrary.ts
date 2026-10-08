/** Shared media library (TODO #37): every audio clip / image stored once. */

export type MediaKind = 'audio' | 'image' | 'video' | 'other';

export interface MediaLibraryAsset {
  id?: string | null;
  /** false: referenced object not registered in media_assets yet (legacy key). */
  registered: boolean;
  kind: MediaKind | string;
  sha256?: string | null;
  storage_key: string;
  url?: string | null;
  mime?: string | null;
  bytes?: number | null;
  duration_ms?: number | null;
  width?: number | null;
  height?: number | null;
  text?: string | null;
  language?: string | null;
  voice?: string | null;
  human_recorded: boolean;
  source?: string | null;
  original_name?: string | null;
  created_at?: string | null;
  usage_count: number;
  usage_sources: string[];
}

export interface MediaLibraryListResponse {
  items: MediaLibraryAsset[];
  total: number;
  page: number;
  limit: number;
}

export interface MediaReference {
  storage_key: string;
  source: string;
  table: string;
  column: string;
  row_id?: string | null;
  label?: string | null;
  path?: string | null;
  value?: string | null;
  text?: string | null;
  history: boolean;
}

export interface MediaUsageResponse {
  storage_key: string;
  asset: MediaLibraryAsset;
  references: MediaReference[];
  usage_count: number;
  history_count: number;
  sources_scanned: string[];
  warnings: string[];
}

export interface MediaDuplicateKey {
  storage_key: string;
  url?: string | null;
  bytes?: number | null;
  registered: boolean;
  human_recorded?: boolean | null;
  usage_count: number;
}

export interface MediaContentDuplicateGroup {
  sha256: string;
  keys: MediaDuplicateKey[];
  reclaimable_bytes: number;
}

export interface MediaTextDuplicateGroup {
  text: string;
  text_key: string;
  voice?: string | null;
  keys: MediaDuplicateKey[];
}

export interface MediaDuplicateReportResponse {
  content_groups: MediaContentDuplicateGroup[];
  content_group_count: number;
  text_groups: MediaTextDuplicateGroup[];
  text_group_count: number;
  reclaimable_bytes: number;
  hashed_object_count: number;
  warnings: string[];
}

export interface MediaLookupResponse {
  sha256: string;
  found: boolean;
  asset?: MediaLibraryAsset | null;
}

export interface LessonBlueprintAssetLinkRequest {
  field_path: string;
  media_asset_id?: string;
  storage_key?: string;
  file_name?: string;
}

import { apiClient } from '@/lib/api';
import type { LessonBlueprintValidationResponse } from '@/types/curriculum';
import type {
  LessonBlueprintAssetLinkRequest,
  MediaLibraryAsset,
  MediaLookupResponse,
  MediaUsageResponse,
} from '@/types/mediaLibrary';

const BASE = '/api/v1/admin/media-library';

/** Hex SHA-256 of a file (Web Crypto), or null where it isn't available. */
export async function sha256OfFile(file: Blob): Promise<string | null> {
  const subtle = typeof globalThis !== 'undefined' ? globalThis.crypto?.subtle : undefined;
  if (!subtle) return null;
  try {
    const buffer = typeof file.arrayBuffer === 'function'
      ? await file.arrayBuffer()
      : await new Response(file).arrayBuffer();
    const digest = await subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
}

export async function lookupMediaBySha256(sha256: string) {
  const res = await apiClient.get<MediaLookupResponse>(`${BASE}/lookup`, { params: { sha256 } });
  return res.data;
}

/**
 * The library asset with exactly this file's content, if any. Never throws:
 * any failure (no Web Crypto, network, older backend) means "upload as usual".
 */
export async function findExistingMediaForFile(file: Blob): Promise<MediaLibraryAsset | null> {
  const sha256 = await sha256OfFile(file);
  if (!sha256) return null;
  try {
    const result = await lookupMediaBySha256(sha256);
    return result.found && result.asset ? result.asset : null;
  } catch {
    return null;
  }
}

export async function getMediaUsage(storageKey: string) {
  const res = await apiClient.get<MediaUsageResponse>(`${BASE}/usage`, {
    params: { storage_key: storageKey },
  });
  return res.data;
}

export async function linkBlueprintAsset(blueprintId: string, payload: LessonBlueprintAssetLinkRequest) {
  const res = await apiClient.post<LessonBlueprintValidationResponse>(
    `/api/v1/admin/lesson-blueprints/${blueprintId}/assets/link`,
    payload
  );
  return res.data;
}

/** Link payload for a library asset: by id when registered, else by key. */
export function linkTargetFor(asset: MediaLibraryAsset): Pick<LessonBlueprintAssetLinkRequest, 'media_asset_id' | 'storage_key'> {
  return asset.id ? { media_asset_id: asset.id } : { storage_key: asset.storage_key };
}

export function formatBytes(bytes?: number | null): string {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function mediaDisplayName(asset: Pick<MediaLibraryAsset, 'original_name' | 'storage_key'>): string {
  return asset.original_name || asset.storage_key.split('/').pop() || asset.storage_key;
}

export function describeReference(source: string): string {
  const labels: Record<string, string> = {
    'lesson_blueprints.payload': 'Lesson',
    'lesson_blueprint_drafts.payload': 'Lesson draft',
    'lesson_blueprint_versions.snapshot': 'Lesson history',
    'audio_words.s3_bucket_key': 'Dictionary word audio',
    'number_audio.s3_bucket_key': 'Number audio',
    'phrases.audio_url': 'Phrase audio',
    'proverbs.prompt_audio_s3_key': 'Proverb audio',
    'proverb_answer_choices.audio_s3_key': 'Proverb answer audio',
    'audio_variants.s3_key': 'Audio variant',
    'audio_versions.storage_key': 'Audio version',
    'learning_items.image_url': 'Learning item image',
  };
  return labels[source] || source;
}

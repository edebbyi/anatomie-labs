import type { LikedImage } from '../types/images';
import type { PodSummary } from '../types/pods';
import { normalizeGalleryImage } from './gallery';

const toDate = (value?: string | Date | null) => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

export const normalizePodSummary = (raw: any): PodSummary => ({
  id: raw?.id,
  name: raw?.name ?? 'Untitled Pod',
  description: raw?.description ?? null,
  imageCount: typeof raw?.imageCount === 'number'
    ? raw.imageCount
    : typeof raw?.image_count === 'number'
      ? raw.image_count
      : 0,
  coverImageUrl: raw?.coverImageUrl ?? raw?.cover_image_url ?? null,
  createdAt: toDate(raw?.createdAt ?? raw?.created_at),
  updatedAt: toDate(raw?.updatedAt ?? raw?.updated_at),
});

export const normalizeLikedImage = (raw: any): LikedImage | null => {
  const normalized = normalizeGalleryImage(raw);
  if (!normalized) return null;

  return {
    id: normalized.id,
    url: normalized.url,
    prompt: normalized.prompt || '',
    liked: true,
    tags: normalized.tags,
    likedAt: toDate(raw?.likedAt ?? raw?.liked_at ?? normalized.lastInteractedAt ?? normalized.timestamp),
    createdAt: toDate(raw?.createdAt ?? raw?.created_at ?? normalized.timestamp),
    podIds: Array.isArray(raw?.podIds ?? raw?.pod_ids)
      ? (raw.podIds ?? raw.pod_ids).filter(Boolean)
      : [],
    metadata: normalized.metadata,
    groupId: normalized.groupId,
    groupIndex: normalized.groupIndex,
    groupSize: normalized.groupSize,
  };
};

export const normalizePodImage = (raw: any): LikedImage | null => {
  if (!raw?.id || !raw?.url) return null;

  return {
    id: raw.id,
    url: raw.url,
    prompt: raw.prompt_text ?? raw.prompt ?? '',
    liked: true,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    likedAt: toDate(raw?.liked_at ?? raw?.likedAt),
    createdAt: toDate(raw?.created_at ?? raw?.uploaded_at ?? raw?.createdAt),
    podIds: Array.isArray(raw?.pod_ids ?? raw?.podIds)
      ? (raw.pod_ids ?? raw.podIds).filter(Boolean)
      : [],
    metadata: raw?.metadata ?? raw?.json_spec ?? undefined,
    groupId: raw?.group_id ?? raw?.groupId ?? null,
    groupIndex:
      typeof raw?.group_index === 'number'
        ? raw.group_index
        : typeof raw?.groupIndex === 'number'
          ? raw.groupIndex
          : null,
    groupSize:
      typeof raw?.group_size === 'number'
        ? raw.group_size
        : typeof raw?.groupSize === 'number'
          ? raw.groupSize
          : null,
  };
};

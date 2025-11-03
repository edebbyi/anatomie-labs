import type { LikedImage } from '../types/images';
import type { PodSummary } from '../types/pods';

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
  if (!raw?.id || !raw?.url) return null;

  return {
    id: raw.id,
    url: raw.url,
    prompt: raw.promptText || raw.prompt || '',
    liked: true,
    likedAt: toDate(raw.likedAt ?? raw.liked_at),
    createdAt: toDate(raw.createdAt ?? raw.created_at),
    podIds: Array.isArray(raw.podIds ?? raw.pod_ids)
      ? (raw.podIds ?? raw.pod_ids).filter(Boolean)
      : [],
    metadata: raw.metadata || {},
  };
};

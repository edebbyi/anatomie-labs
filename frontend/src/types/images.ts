import type { BasicImage } from '../components/ImageCard';

export interface GalleryImage extends BasicImage {
  timestamp: Date;
  origin?: 'user' | 'system' | 'imported';
  lastInteractedAt?: Date;
  archived?: boolean;
  archivedAt?: Date;
  groupId?: string | null;
  groupIndex?: number | null;
  groupSize?: number | null;
}

export interface LikedImage extends BasicImage {
  likedAt?: Date;
  createdAt?: Date;
  podIds?: string[];
  groupId?: string | null;
  groupIndex?: number | null;
  groupSize?: number | null;
}

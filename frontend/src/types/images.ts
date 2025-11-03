import type { BasicImage } from '../components/ImageCard';

export interface GalleryImage extends BasicImage {
  timestamp: Date;
  origin?: 'user' | 'system' | 'imported';
  lastInteractedAt?: Date;
  archived?: boolean;
  archivedAt?: Date;
  metadata?: {
    garmentType?: string;
    silhouette?: string;
    colors?: string[];
    texture?: string;
    fabric?: string;
    styleTags?: string[];
    details?: string;
    shot?: string;
    lighting?: string;
    generatedAt?: string;
    model?: string;
    confidence?: number;
    promptId?: string;
    generationId?: string;
    generationMethod?: 'generate_endpoint' | 'voice_command';
    spec?: unknown;
  };
}

export interface LikedImage extends BasicImage {
  likedAt?: Date;
  createdAt?: Date;
  podIds?: string[];
  metadata?: {
    garmentType?: string;
    silhouette?: string;
    colors?: string[];
    texture?: string;
    fabric?: string;
    styleTags?: string[];
    details?: string;
    shot?: string;
    promptId?: string;
    generationId?: string;
    spec?: unknown;
  };
}

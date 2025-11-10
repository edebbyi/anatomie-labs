import { useCallback, useEffect, useState } from 'react';
import authAPI from '../services/authAPI';
import { API_URL } from '../config/env';
import type { GalleryImage } from '../types/images';
import { normalizeGalleryImage, serializeGalleryImage } from '../utils/gallery';
import { mockImages } from '../lib/mockData';

type UpdateFn = (previous: GalleryImage[]) => GalleryImage[];

type GalleryHookResult = {
  images: GalleryImage[];
  loading: boolean;
  refresh: () => Promise<void>;
  updateImages: (updater: UpdateFn) => void;
  submitFeedback: (imageId: string, liked: boolean) => Promise<void>;
  appendGeneratedImages: (rawAssets: any[], prompt: string, generationMethod?: 'generate_endpoint' | 'voice_command' | 'batch_generation') => void;
  recordInteraction: (imageId: string) => void;
};

export const useGalleryData = (): GalleryHookResult => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const buildMockGallery = useCallback((): GalleryImage[] => {
    const now = Date.now();

    return mockImages.map((item, index) => ({
      id: `mock-${item.id}`,
      url: item.url,
      prompt: item.prompt,
      tags: item.tags,
      liked: item.liked,
      origin: index < 4 ? 'user' : 'system',
      timestamp: new Date(now - index * 60 * 1000),
      lastInteractedAt: item.liked ? new Date(now - index * 45 * 1000) : undefined,
      metadata: {
        garmentType: item.metadata.garment,
        silhouette: item.metadata.silhouette,
        colors: item.metadata.colors,
        texture: item.metadata.fabric,
        lighting: item.metadata.shot,
        // Mark first 4 as generated via endpoint for demo purposes
        generationMethod: index < 4 ? 'generate_endpoint' : undefined,
      },
    }));
  }, []);

  const getStorageKey = useCallback(() => {
    const currentUser = authAPI.getCurrentUser();
    return currentUser?.id ? `generatedImages_${currentUser.id}` : 'generatedImages';
  }, []);

  const readFromStorage = useCallback((): GalleryImage[] => {
    const stored = localStorage.getItem(getStorageKey());
    if (!stored) return [];
    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed)
        ? parsed
            .map(normalizeGalleryImage)
            .filter((img): img is GalleryImage => Boolean(img))
        : [];
    } catch (error) {
      console.error('Failed to parse stored gallery data', error);
      return [];
    }
  }, [getStorageKey]);

  const persistImages = useCallback(
    (data: GalleryImage[]) => {
      localStorage.setItem(
        getStorageKey(),
        JSON.stringify(data.map(serializeGalleryImage))
      );
    },
    [getStorageKey]
  );

  const updateImages = useCallback(
    (updater: UpdateFn) => {
      setImages((previous) => {
        const next = updater(previous);
        persistImages(next);
        return next;
      });
    },
    [persistImages]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    const cached = readFromStorage();
    const token = authAPI.getToken();
    const currentUser = authAPI.getCurrentUser();

    if (!token || !currentUser) {
      if (cached.length > 0) {
        setImages(cached);
      } else {
        const fallback = buildMockGallery();
        setImages(fallback);
        persistImages(fallback);
      }
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/podna/gallery`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.warn('Gallery request failed, using cached data');
        if (cached.length > 0) {
          setImages(cached);
        } else {
          const fallback = buildMockGallery();
          setImages(fallback);
          persistImages(fallback);
        }
        return;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        console.warn('Gallery response was not JSON, using cached data');
        if (cached.length > 0) {
          setImages(cached);
        } else {
          const fallback = buildMockGallery();
          setImages(fallback);
          persistImages(fallback);
        }
        return;
      }

      const result = await response.json();
      const apiImages: GalleryImage[] = Array.isArray(result?.data?.generations)
        ? result.data.generations
            .map((item: any) =>
              normalizeGalleryImage({
                ...item,
                prompt: item.promptText || item.prompt,
                timestamp: item.createdAt,
              })
            )
            .filter((img): img is GalleryImage => Boolean(img))
        : [];

      const imageMap = new Map<string, GalleryImage>();

      // Start with cached images so we can preserve local-only state like likes
      cached.forEach((img) => imageMap.set(img.id, img));

      apiImages.forEach((apiImg) => {
        const cachedImage = imageMap.get(apiImg.id);

        if (cachedImage) {
          const mergedTags = Array.from(
            new Set([...(apiImg.tags || []), ...(cachedImage.tags || [])])
          );

          const mergedImage: GalleryImage = {
            ...apiImg,
            liked:
              typeof cachedImage.liked === 'boolean'
                ? cachedImage.liked
                : apiImg.liked,
            lastInteractedAt:
              cachedImage.lastInteractedAt ?? apiImg.lastInteractedAt,
            origin: cachedImage.origin ?? apiImg.origin,
            metadata: {
              ...(apiImg.metadata || {}),
              ...(cachedImage.metadata || {}),
              // Preserve generationMethod from cache if it exists
              generationMethod: cachedImage.metadata?.generationMethod ?? apiImg.metadata?.generationMethod,
            },
            tags: mergedTags,
          };

          imageMap.set(apiImg.id, mergedImage);
        } else {
          imageMap.set(apiImg.id, apiImg);
        }
      });

      const merged = Array.from(imageMap.values()).sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );

      if (merged.length === 0) {
        const fallback = buildMockGallery();
        setImages(fallback);
        persistImages(fallback);
        return;
      }

      setImages(merged);
      persistImages(merged);
    } catch (error) {
      console.warn('Failed to refresh gallery, using cached data', error);
      if (cached.length > 0) {
        setImages(cached);
      } else {
        const fallback = buildMockGallery();
        setImages(fallback);
        persistImages(fallback);
      }
    } finally {
      setLoading(false);
    }
  }, [readFromStorage, persistImages, buildMockGallery]);

  const submitFeedback = useCallback(
    async (imageId: string, liked: boolean) => {
      updateImages((previous) =>
        previous.map((img) => (img.id === imageId ? { ...img, liked } : img))
      );

      const token = authAPI.getToken();
      const currentUser = authAPI.getCurrentUser();

      if (!token || !currentUser) return;

      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      } as const;

      const safePost = async (url: string, body: unknown) => {
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(
              errorText || `Request to ${url} failed with ${response.status}`
            );
          }
        } catch (error) {
          console.warn('Feedback request failed', { url, error });
        }
      };

      await Promise.all([
        safePost(`${API_URL}/podna/feedback`, {
          generationId: imageId,
          type: liked ? 'like' : 'dislike',
        }),
        safePost(`${API_URL}/agents/feedback`, [
          {
            image_id: imageId,
            designer_id: currentUser.id,
            selected: liked,
            rejected: !liked,
          },
        ]),
      ]);
    },
    [updateImages]
  );

  const appendGeneratedImages = useCallback(
    (
      assets: any[],
      prompt: string,
      generationMethod: 'generate_endpoint' | 'voice_command' | 'batch_generation' = 'generate_endpoint'
    ) => {
      const normalized = assets
        .map((asset: any, index) => {
          const promptText =
            asset.prompt ||
            asset.prompt_text ||
            asset.promptText ||
            prompt;

          const baseMetadata =
            (asset && typeof asset.metadata === 'object' && asset.metadata) ||
            (asset && typeof asset.promptMetadata === 'object' && asset.promptMetadata) ||
            (asset && typeof asset.prompt_metadata === 'object' && asset.prompt_metadata) ||
            (asset && typeof asset.promptSpec === 'object' && asset.promptSpec) ||
            {};

          const metadata: any = { ...baseMetadata };

          if (!metadata.generationMethod) {
            metadata.generationMethod = generationMethod;
          }

          const promptGroupSource =
            metadata.promptGroup ||
            (typeof metadata.prompt_group === 'object' && metadata.prompt_group) ||
            asset.promptGroup ||
            asset.prompt_group ||
            asset.group ||
            asset.promptGroupInfo;

          if (promptGroupSource) {
            metadata.promptGroup =
              typeof promptGroupSource === 'object'
                ? { ...promptGroupSource }
                : { prompt: String(promptGroupSource) };
          }

          const normalizedImage = normalizeGalleryImage({
            id: asset.id?.toString() || `gen-${Date.now()}-${index}`,
            url: asset.url || asset.cdnUrl || asset.cdn_url || asset.imageUrl || asset.image_url,
            prompt: promptText,
            timestamp: asset.createdAt ? new Date(asset.createdAt) : new Date(),
            metadata,
            tags: Array.isArray(asset.tags) ? asset.tags : undefined,
            origin: asset.origin || 'user',
            lastInteractedAt: new Date(),
            groupId:
              asset.groupId ??
              asset.promptGroupId ??
              asset.prompt_group_id ??
              metadata.promptGroup?.id ??
              metadata.promptGroup?.groupId ??
              metadata.promptGroup?.group_id,
            groupIndex:
              asset.groupIndex ??
              asset.promptGroupIndex ??
              asset.prompt_group_index ??
              metadata.promptGroup?.index ??
              metadata.promptGroup?.groupIndex ??
              metadata.promptGroup?.position,
            groupSize:
              asset.groupSize ??
              asset.promptGroupCount ??
              asset.prompt_group_count ??
              metadata.promptGroup?.count ??
              metadata.promptGroup?.size ??
              metadata.promptGroup?.total,
          });

          return normalizedImage;
        })
        .filter((img): img is GalleryImage => Boolean(img));

      if (normalized.length > 0) {
        updateImages((previous) => [...normalized, ...previous]);
      }
    },
    [updateImages]
  );

  const recordInteraction = useCallback(
    (imageId: string) => {
      const now = new Date();
      updateImages((previous) =>
        previous.map((img) =>
          img.id === imageId ? { ...img, lastInteractedAt: now } : img
        )
      );
    },
    [updateImages]
  );

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    images,
    loading,
    refresh,
    updateImages,
    submitFeedback,
    appendGeneratedImages,
    recordInteraction,
  };
};

export default useGalleryData;

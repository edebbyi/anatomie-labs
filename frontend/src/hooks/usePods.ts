import { useCallback, useEffect, useMemo, useState } from 'react';
import authAPI from '../services/authAPI';
import { API_URL } from '../config/env';
import type { PodSummary } from '../types/pods';
import type { LikedImage, GalleryImage } from '../types/images';
import { normalizeLikedImage, normalizePodSummary } from '../utils/pods';
import { normalizeGalleryImage } from '../utils/gallery';

type CreatePodInput = {
  name: string;
  description?: string;
};

type UsePodsResult = {
  pods: PodSummary[];
  likedImages: LikedImage[];
  loading: boolean;
  error: string | null;
  hasSeenPodsIntro: boolean;
  overlayVisible: boolean;
  refresh: () => Promise<void>;
  markIntroSeen: (options?: { dismissed?: boolean }) => Promise<void>;
  createPod: (input: CreatePodInput) => Promise<PodSummary | null>;
  addImagesToPod: (podId: string, imageIds: string[]) => Promise<void>;
  assignImageToPods: (imageId: string, podIds: string[]) => Promise<string[]>;
  removeImagesFromPod: (podId: string, imageIds: string[]) => Promise<void>;
  unlikeImages: (imageIds: string[]) => Promise<void>;
};

const ensureArray = <T,>(value: T[] | undefined | null): T[] => {
  if (!Array.isArray(value)) return [];
  return value;
};

const usePods = (): UsePodsResult => {
  const [pods, setPods] = useState<PodSummary[]>([]);
  const [likedImages, setLikedImages] = useState<LikedImage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hasSeenPodsIntro, setHasSeenPodsIntro] = useState<boolean>(false);
  const [overlayVisible, setOverlayVisible] = useState<boolean>(false);
  const [introSeenAt, setIntroSeenAt] = useState<string | null>(null);

  const getStorageKey = useCallback(() => {
    const currentUser = authAPI.getCurrentUser();
    return currentUser?.id ? `generatedImages_${currentUser.id}` : 'generatedImages';
  }, []);

  const readLocalLikedImages = useCallback((): LikedImage[] => {
    if (typeof window === 'undefined') return [];

    try {
      const stored = window.localStorage.getItem(getStorageKey());
      if (!stored) return [];

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .map(normalizeGalleryImage)
        .filter((img): img is GalleryImage => Boolean(img) && Boolean(img?.liked))
        .map((img) => ({
          id: img.id,
          url: img.url,
          prompt: img.prompt,
          liked: true,
          tags: img.tags,
          origin: img.origin,
          metadata: img.metadata,
          createdAt: img.timestamp,
          likedAt: img.lastInteractedAt || img.timestamp,
          podIds: [],
        }));
    } catch (err) {
      console.warn('Failed to read liked images from local storage', err);
      return [];
    }
  }, [getStorageKey]);

  const authHeaders = useCallback(() => {
    const token = authAPI.getToken();
    if (!token) return null;
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }, []);

  useEffect(() => {
    const localLiked = readLocalLikedImages();
    if (localLiked.length > 0) {
      setLikedImages(localLiked);
    }
  }, [readLocalLikedImages]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    const headers = authHeaders();
    if (!headers) {
      setPods([]);
      setLikedImages(readLocalLikedImages());
      setHasSeenPodsIntro(false);
      setOverlayVisible(false);
      setLoading(false);
      return;
    }

    try {
      const [podsResponse, likedResponse] = await Promise.all([
        fetch(`${API_URL}/pods`, {
          headers,
        }),
        fetch(`${API_URL}/images/liked`, {
          headers: {
            Authorization: headers.Authorization,
          },
        }),
      ]);

      const parseJson = async (response: Response) => {
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          throw new Error(
            `Unexpected response type: ${contentType || 'missing content-type'}`
          );
        }
        return response.json();
      };

      if (!podsResponse.ok) {
        const message = `Failed to load pods (${podsResponse.status})`;
        setError(message);
        setPods([]);
      } else {
        try {
          const podsJson = await parseJson(podsResponse);
          const rawPods = ensureArray(podsJson?.data?.pods);
          const normalizedPods = rawPods
            .map(normalizePodSummary)
            .filter((pod): pod is PodSummary => Boolean(pod?.id));
          setPods(normalizedPods);
          const preferences = podsJson?.data?.preferences || {};
          const seen = Boolean(preferences.hasSeenPodsIntro);
          setHasSeenPodsIntro(seen);
          setIntroSeenAt(
            preferences.introSeenAt ||
              preferences.pods_intro_seen_at ||
              null
          );
        } catch (err) {
          console.warn('Pods API response was not JSON', err);
          setPods([]);
        }
      }

      if (!likedResponse.ok) {
        const message = `Failed to load liked images (${likedResponse.status})`;
        setError((prev) => prev ?? message);
        setLikedImages(readLocalLikedImages());
      } else {
        try {
          const likedJson = await parseJson(likedResponse);
          const rawLiked = ensureArray(likedJson?.data?.images);
          const normalizedLiked = rawLiked
            .map(normalizeLikedImage)
            .filter((image): image is LikedImage => Boolean(image));

          if (normalizedLiked.length > 0) {
            setLikedImages(normalizedLiked);
          } else {
            setLikedImages(readLocalLikedImages());
          }
        } catch (err) {
          console.warn('Liked images API response was not JSON', err);
          setLikedImages(readLocalLikedImages());
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPods([]);
      setLikedImages(readLocalLikedImages());
    } finally {
      setLoading(false);
    }
  }, [authHeaders, readLocalLikedImages]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const shouldShowIntro =
      !hasSeenPodsIntro && pods.length === 0 && likedImages.length > 0;
    setOverlayVisible(shouldShowIntro);
  }, [hasSeenPodsIntro, pods.length, likedImages.length, introSeenAt]);

  const markIntroSeen = useCallback(
    async ({ dismissed = false } = {}) => {
      const headers = authHeaders();
      if (!headers) return;

      try {
        await fetch(`${API_URL}/pods/intro`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ dismissed }),
        });
      } catch (err) {
        // Silently ignore; local state will still suppress overlay
      } finally {
        setHasSeenPodsIntro(true);
        setOverlayVisible(false);
      }
    },
    [authHeaders]
  );

  const createPod = useCallback(
    async ({ name, description }: CreatePodInput) => {
      const headers = authHeaders();
      if (!headers) return null;

      try {
        const response = await fetch(`${API_URL}/pods`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ name, description }),
        });

        if (!response.ok) {
          const message = `Unable to create pod (${response.status})`;
          throw new Error(message);
        }

        const json = await response.json();
        const pod = normalizePodSummary(json?.data?.pod);
        if (pod?.id) {
          setPods((previous) => [...previous, pod]);
          setHasSeenPodsIntro(true);
          setOverlayVisible(false);
          return pod;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create pod');
      }

      return null;
    },
    [authHeaders]
  );

  const addImagesToPod = useCallback(
    async (podId: string, imageIds: string[]) => {
      if (!podId || !Array.isArray(imageIds) || imageIds.length === 0) {
        return;
      }

      const headers = authHeaders();
      if (!headers) return;

      try {
        const response = await fetch(`${API_URL}/pods/${podId}/images`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ imageIds }),
        });

        if (!response.ok) {
          throw new Error(`Failed to add images to pod (${response.status})`);
        }

        const json = await response.json();
        const updated = normalizePodSummary(json?.data?.pod);

        if (updated?.id) {
          setPods((previous) =>
            previous.map((pod) => (pod.id === updated.id ? updated : pod))
          );
        }

        if (imageIds.length > 0) {
          setLikedImages((previous) =>
            previous.map((image) =>
              imageIds.includes(image.id)
                ? {
                    ...image,
                    podIds: Array.from(
                      new Set([...(image.podIds || []), podId])
                    ),
                  }
                : image
            )
          );
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to update pod images'
        );
      }
    },
    [authHeaders]
  );

  const assignImageToPods = useCallback(
    async (imageId: string, podIds: string[]) => {
      const headers = authHeaders();
      if (!headers) return [];

      try {
        const response = await fetch(`${API_URL}/images/${imageId}/pods`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ podIds }),
        });

        if (!response.ok) {
          throw new Error(`Failed to update pods (${response.status})`);
        }

        const json = await response.json();
        const membership: string[] = ensureArray(json?.data?.podIds);
        const updatedPods = ensureArray(json?.data?.updatedPods).map(
          normalizePodSummary
        );
        const currentPods = ensureArray(json?.data?.pods).map(
          normalizePodSummary
        );

        setPods((previous) => {
          const map = new Map(previous.map((pod) => [pod.id, pod]));

          [...updatedPods, ...currentPods]
            .filter((pod) => pod?.id)
            .forEach((pod) => {
              map.set(pod.id, pod);
            });

          return Array.from(map.values());
        });

        setLikedImages((previous) =>
          previous.map((image) =>
            image.id === imageId
              ? {
                  ...image,
                  podIds: membership,
                }
              : image
          )
        );

        return membership;
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to update image pod assignments'
        );
        return [];
      }
    },
    [authHeaders]
  );

  const removeImagesFromPod = useCallback(
    async (podId: string, imageIds: string[]) => {
      if (!podId || !Array.isArray(imageIds) || imageIds.length === 0) {
        return;
      }

      const headers = authHeaders();
      if (!headers) return;

      try {
        const results: PodSummary[] = [];

        for (const imageId of imageIds) {
          const response = await fetch(
            `${API_URL}/pods/${podId}/images/${imageId}`,
            {
              method: 'DELETE',
              headers: {
                Authorization: headers.Authorization,
              },
            }
          );

          if (!response.ok) {
            throw new Error(`Failed to remove image (${response.status})`);
          }

          const json = await response.json();
          const updatedPod = normalizePodSummary(json?.data?.pod);
          if (updatedPod?.id) {
            results.push(updatedPod);
          }
        }

        if (results.length > 0) {
          setPods((previous) =>
            previous.map((pod) => {
              const replacement = results.find((item) => item.id === pod.id);
              return replacement ?? pod;
            })
          );
        }

        setLikedImages((previous) =>
          previous.map((image) =>
            imageIds.includes(image.id)
              ? {
                  ...image,
                  podIds: (image.podIds || []).filter((id) => id !== podId),
                }
              : image
          )
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to remove images from pod'
        );
      }
    },
    [authHeaders]
  );

  const unlikeImages = useCallback(
    async (imageIds: string[]) => {
      if (!Array.isArray(imageIds) || imageIds.length === 0) return;

      const headers = authHeaders();
      if (!headers) return;

      try {
        for (const imageId of imageIds) {
          await assignImageToPods(imageId, []);
          await fetch(`${API_URL}/podna/feedback`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              generationId: imageId,
              type: 'dislike',
            }),
          });
        }

        setLikedImages((previous) =>
          previous.filter((image) => !imageIds.includes(image.id))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete images');
      }
    },
    [assignImageToPods, authHeaders]
  );

  return useMemo(
    () => ({
      pods,
      likedImages,
      loading,
      error,
      hasSeenPodsIntro,
      overlayVisible,
      refresh,
      markIntroSeen,
      createPod,
      addImagesToPod,
      assignImageToPods,
      removeImagesFromPod,
      unlikeImages,
    }),
    [
      pods,
      likedImages,
      loading,
      error,
      hasSeenPodsIntro,
      overlayVisible,
      refresh,
      markIntroSeen,
      createPod,
      addImagesToPod,
      assignImageToPods,
      removeImagesFromPod,
      unlikeImages,
    ]
  );
};

export default usePods;

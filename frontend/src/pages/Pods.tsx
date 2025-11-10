import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Folder,
  FolderPlus,
  Plus,
  CheckSquare,
  Square,
  Eye,
  HeartOff,
  MoreHorizontal,
  X,
  XCircle,
  ChevronDown,
  Check,
  Layers,
  Trash2,
  PencilLine,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import Lightbox from '../components/Lightbox';
import SkeletonLoader from '../components/SkeletonLoader';
import usePods from '../hooks/usePods';
import type { LikedImage } from '../types/images';
import type { PodSummary } from '../types/pods';

const POD_NAME_SUGGESTIONS = [
  'Travel Capsule',
  'Work Wear',
  'Evening Edit',
  'Weekend Casual',
  'Minimalist Staples',
];

type ImageCardProps = {
  image: LikedImage;
  index: number;
  pods: PodSummary[];
  isSelected: boolean;
  isMultiSelectMode: boolean;
  activeQuickAction: string | null;
  onToggleSelect: (id: string) => void;
  onView: (index: number) => void;
  onUnlike: (id: string) => void;
  onQuickAssign: (image: LikedImage, podId: string) => void;
  onOpenCreate: () => void;
  setActiveQuickAction: (imageId: string | null) => void;
};

const ImageGridCard: React.FC<ImageCardProps> = ({
  image,
  index,
  pods,
  isSelected,
  isMultiSelectMode,
  activeQuickAction,
  onToggleSelect,
  onView,
  onUnlike,
  onQuickAssign,
  onOpenCreate,
  setActiveQuickAction,
}) => {
  const handleCardClick = () => {
    if (isMultiSelectMode) {
      onToggleSelect(image.id);
    } else {
      onView(index);
    }
  };

  const isQuickMenuOpen = activeQuickAction === image.id;
  const toggleQuickMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setActiveQuickAction(isQuickMenuOpen ? null : image.id);
  };

  const handleUnlike = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onUnlike(image.id);
  };

  const handleQuickAssign = (event: React.MouseEvent<HTMLButtonElement>, podId: string) => {
    event.stopPropagation();
    onQuickAssign(image, podId);
  };

  const handleCreatePod = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setActiveQuickAction(null);
    onOpenCreate();
  };

  const podIds = image.podIds || [];

  return (
    <div
      className="relative group rounded-2xl overflow-hidden bg-gray-100 shadow-sm transition-all duration-300 hover:shadow-lg"
      onClick={handleCardClick}
    >
      <img
        src={image.url}
        alt={image.prompt || 'Generated look'}
        className="w-full h-full object-cover aspect-[3/4]"
      />

      {isMultiSelectMode && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleSelect(image.id);
          }}
          className={`absolute top-4 left-4 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/80 text-gray-900 transition ${
            isSelected ? 'bg-purple-500 text-white border-purple-500' : ''
          }`}
        >
          {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
        </button>
      )}

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/70 via-transparent to-black/30 opacity-0 transition-opacity duration-300 group-hover:pointer-events-auto group-hover:opacity-100">
        <div className="flex items-start justify-between p-4 text-white">
          <div className="flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs backdrop-blur">
            <HeartOff className="h-3.5 w-3.5" />
            <span>Liked Look</span>
          </div>
          {!isMultiSelectMode && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setActiveQuickAction(null);
              }}
              className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="pointer-events-auto flex items-center justify-center gap-3 pb-4">
          <button
            type="button"
            onClick={handleUnlike}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-gray-900 transition hover:bg-white"
            aria-label="Unlike"
          >
            <HeartOff className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onView(index);
            }}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-gray-900 transition hover:bg-white"
            aria-label="Quick View"
          >
            <Eye className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={toggleQuickMenu}
            className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
              isQuickMenuOpen ? 'bg-purple-500 text-white' : 'bg-white/90 text-gray-900 hover:bg-white'
            }`}
            aria-label="Add to Pod"
          >
            <FolderPlus className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={(event) => event.stopPropagation()}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-gray-900 transition hover:bg-white"
            aria-label="More actions"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>
      </div>

      {podIds.length > 0 && (
        <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap gap-1">
          {podIds.slice(0, 3).map((podId) => {
            const pod = pods.find((p) => p.id === podId);
            if (!pod) return null;
            return (
              <Badge key={`${image.id}-${podId}`} className="bg-black/60 text-white backdrop-blur">
                {pod.name}
              </Badge>
            );
          })}
        </div>
      )}

      {isQuickMenuOpen && !isMultiSelectMode && (
        <div className="absolute bottom-20 left-4 right-4 z-30 rounded-2xl border border-purple-200 bg-white/95 p-3 shadow-xl">
          <p className="px-2 text-xs font-medium text-gray-500">Add to pod</p>
          <div className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1 text-sm">
            {pods.length === 0 && (
              <p className="rounded-xl bg-gray-50 px-3 py-2 text-gray-600">
                Create your first pod to start organizing.
              </p>
            )}
            {pods.map((pod) => {
              const isInPod = podIds.includes(pod.id);
              return (
                <button
                  key={pod.id}
                  type="button"
                  onClick={(event) => handleQuickAssign(event, pod.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition ${
                    isInPod ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-100'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Folder className="h-4 w-4" />
                    {pod.name}
                  </span>
                  {isInPod && <Check className="h-4 w-4" />}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={handleCreatePod}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-purple-300 px-3 py-2 text-sm text-purple-600 transition hover:bg-purple-50"
          >
            <Plus className="h-4 w-4" />
            Create New Pod
          </button>
        </div>
      )}

      {!isMultiSelectMode && isSelected && (
        <div className="absolute inset-0 rounded-2xl ring-4 ring-purple-400" />
      )}
    </div>
  );
};

type OverlayProps = {
  visible: boolean;
  onCreate: () => void;
  onDismiss: () => void;
};

const PodsIntroOverlay: React.FC<OverlayProps> = ({ visible, onCreate, onDismiss }) => {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-6">
      <div className="relative w-full max-w-lg rounded-3xl border border-purple-300/50 bg-gradient-to-br from-gray-900 to-gray-800 p-8 shadow-2xl">
        <div className="absolute inset-0 rounded-3xl border border-white/10" />
        <div className="relative space-y-6 text-white">
          <div className="inline-flex items-center gap-2 rounded-full bg-purple-500/20 px-3 py-1 text-sm text-purple-200">
            <FolderPlus className="h-4 w-4" />
            New Feature
          </div>
          <h2 className="text-3xl font-semibold">Organize Your Collection</h2>
          <p className="text-base leading-relaxed text-gray-200">
            <strong>Pods</strong> are your personal collections. Create pods to group looks by trip,
            occasion, or vibe.
          </p>
          <div className="flex flex-wrap gap-2">
            {POD_NAME_SUGGESTIONS.slice(0, 3).map((chip) => (
              <span key={chip} className="rounded-full bg-white/10 px-3 py-1 text-sm text-white">
                {chip}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={onCreate} className="flex-1 bg-purple-500 hover:bg-purple-400">
              Create Your First Pod
            </Button>
            <button
              type="button"
              onClick={onDismiss}
              className="text-sm font-medium text-gray-300 underline-offset-4 transition hover:text-white hover:underline"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

type CreateModalProps = {
  open: boolean;
  name: string;
  description: string;
  onChangeName: (value: string) => void;
  onChangeDescription: (value: string) => void;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  isSubmitting?: boolean;
};

const CreatePodModal: React.FC<CreateModalProps> = ({
  open,
  name,
  description,
  onChangeName,
  onChangeDescription,
  onClose,
  onSubmit,
  isSubmitting = false,
}) => {
  if (!open) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSubmit();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-10 sm:items-center sm:p-0">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 transition hover:text-gray-600"
        >
          <XCircle className="h-6 w-6" />
        </button>
        <form onSubmit={handleSubmit} className="space-y-6 p-8">
          <div>
            <h3 className="text-2xl font-semibold text-gray-900">Create New Pod</h3>
            <p className="mt-1 text-sm text-gray-600">
              Pods help you organize looks by trip, occasion, or vibe.
            </p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Pod name</label>
              <input
                value={name}
                onChange={(event) => onChangeName(event.target.value.slice(0, 50))}
                placeholder="e.g. Resort Capsule"
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
                maxLength={50}
                required
              />
              <p className="mt-1 text-xs text-gray-400">50 characters max</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={description}
                onChange={(event) => onChangeDescription(event.target.value.slice(0, 200))}
                placeholder="Optional notes about this pod"
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
                rows={3}
                maxLength={200}
              />
              <p className="mt-1 text-xs text-gray-400">200 characters max</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-500 tracking-wide">
              Suggested names
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {POD_NAME_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => onChangeName(suggestion)}
                  className="rounded-full border border-gray-200 px-3 py-1 text-sm text-gray-700 transition hover:border-purple-300 hover:text-purple-600"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-medium text-gray-500 transition hover:text-gray-700"
            >
              Cancel
            </button>
            <Button
              type="submit"
              disabled={isSubmitting || name.trim().length === 0}
              className="bg-purple-500 hover:bg-purple-400"
            >
              {isSubmitting ? 'Creating…' : 'Create & Add Images'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

type PodTabsProps = {
  pods: PodSummary[];
  currentPodId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  totalLiked: number;
};

const PodTabs: React.FC<PodTabsProps> = ({ pods, currentPodId, onSelect, onCreate, totalLiked }) => {
  return (
    <div className="flex items-center gap-4 overflow-x-auto pb-2">
      <button
        type="button"
        onClick={() => onSelect('all')}
        className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm transition ${
          currentPodId === 'all'
            ? 'bg-purple-500 text-white shadow'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        <Layers className="h-4 w-4" />
        All Liked
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{totalLiked}</span>
      </button>
      {pods.map((pod) => (
        <button
          key={pod.id}
          type="button"
          onClick={() => onSelect(pod.id)}
          className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm transition ${
            currentPodId === pod.id
              ? 'bg-purple-500 text-white shadow'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Folder className="h-4 w-4" />
          {pod.name}
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
            {pod.imageCount ?? 0}
          </span>
        </button>
      ))}
      <button
        type="button"
        onClick={onCreate}
        className="flex shrink-0 items-center gap-2 rounded-full border border-dashed border-purple-300 px-4 py-2 text-sm text-purple-600 transition hover:bg-purple-50"
      >
        <Plus className="h-4 w-4" />
        New Pod
      </button>
    </div>
  );
};

const PodsPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    pods,
    likedImages,
    podImages,
    loading,
    error,
    overlayVisible,
    hasSeenPodsIntro,
    markIntroSeen,
    createPod,
    addImagesToPod,
    assignImageToPods,
    removeImagesFromPod,
    unlikeImages,
    loadPodImages,
    updatePod,
  } = usePods();

  const [currentPodId, setCurrentPodId] = useState<string>('all');
  const [isMultiSelectMode, setIsMultiSelectMode] = useState<boolean>(false);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [createName, setCreateName] = useState<string>('');
  const [createDescription, setCreateDescription] = useState<string>('');
  const [lightboxState, setLightboxState] = useState<{
    images: {
      id: string;
      url: string;
      prompt: string;
      timestamp: string;
      metadata?: GalleryImage['metadata'];
      tags?: string[];
      groupId?: string | null;
      groupIndex?: number | null;
      groupSize?: number | null;
    }[];
    index: number;
  } | null>(null);
  const [activeQuickAction, setActiveQuickAction] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState<boolean>(false);
  const [isSubmittingPod, setIsSubmittingPod] = useState<boolean>(false);
  const [isEditingDescription, setIsEditingDescription] = useState<boolean>(false);
  const [descriptionDraft, setDescriptionDraft] = useState<string>('');
  const [isSavingDescription, setIsSavingDescription] = useState<boolean>(false);

  useEffect(() => {
    if (currentPodId !== 'all' && !pods.find((pod) => pod.id === currentPodId)) {
      setCurrentPodId('all');
    }
  }, [pods, currentPodId]);

  const visibleImages = useMemo(() => {
    if (currentPodId === 'all') return likedImages;
    if (podImages[currentPodId]) {
      return podImages[currentPodId];
    }
    return likedImages.filter((image) => image.podIds?.includes(currentPodId));
  }, [likedImages, currentPodId, podImages]);

  useEffect(() => {
    if (currentPodId !== 'all') {
      loadPodImages(currentPodId);
    }
  }, [currentPodId, loadPodImages]);

  useEffect(() => {
    setSelectedImageIds((previous) =>
      previous.filter((id) => visibleImages.some((image) => image.id === id))
    );
  }, [visibleImages]);

  useEffect(() => {
    if (!isMultiSelectMode) {
      setSelectedImageIds([]);
      setAddMenuOpen(false);
    }
  }, [isMultiSelectMode]);

  const handleToggleSelect = (imageId: string) => {
    setSelectedImageIds((previous) =>
      previous.includes(imageId)
        ? previous.filter((id) => id !== imageId)
        : [...previous, imageId]
    );
  };

  const resolveGroupId = (image: LikedImage): string | null => {
    if (image.groupId) return image.groupId;
    const group = image.metadata?.promptGroup;
    if (group && typeof group === 'object' && group !== null) {
      const id =
        (group as Record<string, unknown>).id ??
        (group as Record<string, unknown>).groupId ??
        (group as Record<string, unknown>).group_id;
      if (typeof id === 'string' && id.trim()) return id.trim();
    }
    return null;
  };

  const resolveGroupIndex = (image: LikedImage): number | undefined => {
    if (typeof image.groupIndex === 'number') return image.groupIndex;
    const group = image.metadata?.promptGroup;
    if (group && typeof group === 'object' && group !== null) {
      const index =
        (group as Record<string, unknown>).index ??
        (group as Record<string, unknown>).groupIndex ??
        (group as Record<string, unknown>).position;
      if (typeof index === 'number') return index;
      if (typeof index === 'string') {
        const parsed = Number(index);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    return undefined;
  };

  const resolveGroupPrompt = (image: LikedImage): string | undefined => {
    const group = image.metadata?.promptGroup;
    if (group && typeof group === 'object' && group !== null) {
      const prompt =
        (group as Record<string, unknown>).prompt ??
        (group as Record<string, unknown>).text ??
        (group as Record<string, unknown>).label;
      if (typeof prompt === 'string' && prompt.trim()) {
        return prompt.trim();
      }
    }
    return undefined;
  };

  const handleOpenLightbox = (index: number) => {
    const clickedImage = visibleImages[index];
    if (!clickedImage) return;

    const groupBuckets = new Map<string, LikedImage[]>();
    visibleImages.forEach((image) => {
      const groupId = resolveGroupId(image);
      if (!groupId) return;
      const bucket = groupBuckets.get(groupId) ?? [];
      bucket.push(image);
      groupBuckets.set(groupId, bucket);
    });

    const seenGroups = new Set<string>();
    const sequence: LikedImage[] = [];

    visibleImages.forEach((image) => {
      const groupId = resolveGroupId(image);
      if (groupId) {
        if (seenGroups.has(groupId)) return;
        const sortedGroup = [...(groupBuckets.get(groupId) ?? [])].sort((a, b) => {
          const indexA = resolveGroupIndex(a);
          const indexB = resolveGroupIndex(b);
          if (indexA !== undefined && indexB !== undefined) {
            return indexA - indexB;
          }
          if (indexA !== undefined) return -1;
          if (indexB !== undefined) return 1;
          return 0;
        });
        sequence.push(...sortedGroup);
        seenGroups.add(groupId);
      } else {
        sequence.push(image);
      }
    });

    const lightboxImages = sequence.map((image) => {
      const groupId = resolveGroupId(image);
      const bucket = groupId ? groupBuckets.get(groupId) : undefined;
      const groupSize = image.groupSize ?? (bucket ? bucket.length : undefined) ?? null;

      return {
        id: image.id,
        url: image.url,
        prompt: image.prompt || resolveGroupPrompt(image) || '',
        timestamp: image.createdAt?.toISOString() || new Date().toISOString(),
        metadata: image.metadata,
        tags: image.tags,
        groupId,
        groupIndex: resolveGroupIndex(image) ?? null,
        groupSize,
      };
    });

    const startIndex = lightboxImages.findIndex((item) => item.id === clickedImage.id);

    setLightboxState({
      images: lightboxImages,
      index: startIndex >= 0 ? startIndex : 0,
    });
  };

  const handleCloseLightbox = () => {
    setLightboxState(null);
  };

  const handleUnlikeSingle = async (imageId: string) => {
    await unlikeImages([imageId]);
  };

  const handleQuickAssign = async (image: LikedImage, podId: string) => {
    const podSet = new Set(image.podIds || []);
    if (podSet.has(podId)) {
      podSet.delete(podId);
    } else {
      podSet.add(podId);
    }
    await assignImageToPods(image.id, Array.from(podSet));
  };

  const resetSelection = () => {
    setSelectedImageIds([]);
    setIsMultiSelectMode(false);
    setAddMenuOpen(false);
  };

  const handleAddSelectedToPod = async (podId: string) => {
    const targetIds = selectedImageIds;
    if (targetIds.length === 0) return;
    await addImagesToPod(podId, targetIds);
    resetSelection();
  };

  const handleRemoveSelectedFromPod = async () => {
    if (currentPodId === 'all') return;
    if (selectedImageIds.length === 0) return;
    await removeImagesFromPod(currentPodId, selectedImageIds);
    resetSelection();
  };

  const handleDeleteSelected = async () => {
    if (selectedImageIds.length === 0) return;
    await unlikeImages(selectedImageIds);
    resetSelection();
  };

  const handleCreatePod = async () => {
    if (createName.trim().length === 0) return;
    setIsSubmittingPod(true);
    const created = await createPod({
      name: createName.trim(),
      description: createDescription.trim(),
    });
    setIsSubmittingPod(false);
    if (created) {
      setShowCreateModal(false);
      setCreateName('');
      setCreateDescription('');
      setCurrentPodId(created.id);
      setIsMultiSelectMode(true);
    }
  };

  const handleStartEditDescription = () => {
    if (currentPodId === 'all' || !currentPod) return;
    setIsEditingDescription(true);
  };

  const handleCancelDescriptionEdit = () => {
    setIsEditingDescription(false);
    setDescriptionDraft(currentPod?.description ?? '');
  };

  const handleSaveDescription = async () => {
    if (!currentPod || isSavingDescription) return;
    setIsSavingDescription(true);
    const trimmed = descriptionDraft.trim();
    const result = await updatePod(currentPod.id, {
      description: trimmed.length > 0 ? trimmed : null,
    });
    setIsSavingDescription(false);
    if (result) {
      setDescriptionDraft(result.description ?? '');
      setIsEditingDescription(false);
    }
  };

  const handleOverlayCreate = async () => {
    await markIntroSeen();
    setShowCreateModal(true);
  };

  const handleOverlayDismiss = async () => {
    await markIntroSeen({ dismissed: true });
  };

  const currentPod = pods.find((pod) => pod.id === currentPodId);

  useEffect(() => {
    if (currentPod && currentPodId !== 'all') {
      setDescriptionDraft(currentPod.description ?? '');
    } else {
      setDescriptionDraft('');
    }
    setIsEditingDescription(false);
    setIsSavingDescription(false);
  }, [currentPodId, currentPod?.description, currentPod?.id]);
  const selectionCount = selectedImageIds.length;
  const showEmptyLiked = !loading && likedImages.length === 0;
  const showEmptyPod = !loading && likedImages.length > 0 && visibleImages.length === 0;
  const shouldShowError = Boolean(error) && !showEmptyLiked;

  return (
    <div className="relative min-h-screen bg-white pb-24">
      <PodsIntroOverlay
        visible={overlayVisible && !hasSeenPodsIntro}
        onCreate={handleOverlayCreate}
        onDismiss={handleOverlayDismiss}
      />

      <CreatePodModal
        open={showCreateModal}
        name={createName}
        description={createDescription}
        onChangeName={setCreateName}
        onChangeDescription={setCreateDescription}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreatePod}
        isSubmitting={isSubmittingPod}
      />

      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Pods</h1>
            <p className="mt-2 text-sm text-gray-600">
              Curate your favorite looks into pods for quick access and easy sharing.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-purple-500 hover:bg-purple-400"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Pod
            </Button>
            <Button
              variant={isMultiSelectMode ? 'default' : 'outline'}
              onClick={() => setIsMultiSelectMode((prev) => !prev)}
              className={isMultiSelectMode ? 'bg-gray-900 text-white hover:bg-gray-800' : ''}
            >
              <CheckSquare className="mr-2 h-4 w-4" />
              {isMultiSelectMode ? 'Cancel Selection' : 'Multi-select'}
            </Button>
          </div>
        </header>

        <section className="mt-8 space-y-6">
          <PodTabs
            pods={pods}
            currentPodId={currentPodId}
            onSelect={(id) => {
              setCurrentPodId(id);
              setActiveQuickAction(null);
            }}
            onCreate={() => setShowCreateModal(true)}
            totalLiked={likedImages.length}
          />
          {currentPodId !== 'all' && currentPod && (
            <div className="rounded-3xl border border-purple-100 bg-white/90 p-5 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-purple-500">
                    Pod Description
                  </p>
                  {isEditingDescription ? (
                    <textarea
                      value={descriptionDraft}
                      onChange={(event) => setDescriptionDraft(event.target.value)}
                      rows={3}
                      className="mt-3 w-full rounded-2xl border border-purple-200 px-4 py-3 text-sm text-gray-800 shadow-inner focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
                      placeholder="Add notes about this pod to keep things organized."
                    />
                  ) : (
                    <p
                      className={`mt-2 text-sm ${
                        currentPod.description ? 'text-gray-700' : 'text-gray-400 italic'
                      }`}
                    >
                      {currentPod.description || 'Add notes about this pod to keep things organized.'}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isEditingDescription ? (
                    <>
                      <Button
                        type="button"
                        onClick={handleSaveDescription}
                        disabled={isSavingDescription}
                        className="bg-purple-500 hover:bg-purple-400"
                      >
                        {isSavingDescription ? 'Saving…' : 'Save'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isSavingDescription}
                        onClick={handleCancelDescriptionEdit}
                        className="border-gray-200 text-gray-700 hover:bg-gray-100"
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleStartEditDescription}
                      className="border-purple-200 text-purple-600 hover:bg-purple-50"
                    >
                      <PencilLine className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {shouldShowError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading && <SkeletonLoader />}

          {showEmptyLiked && (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-gray-200 bg-gray-50 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow">
                <HeartOff className="h-7 w-7 text-gray-500" />
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">No liked images</h3>
              <p className="mt-2 max-w-sm text-sm text-gray-600">
                Go to Home and like a few outfits first so they appear here.
              </p>
              <Button
                className="mt-6 bg-purple-500 hover:bg-purple-400"
                onClick={() => navigate('/home')}
              >
                Go to Home
              </Button>
            </div>
          )}

          {showEmptyPod && currentPod && (
            <div className="flex min-h-[240px] flex-col items-center justify-center rounded-3xl border border-dashed border-purple-200 bg-purple-50 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow">
                <Folder className="h-6 w-6 text-purple-500" />
              </div>
              <h3 className="mt-6 text-lg font-semibold text-purple-700">
                {currentPod.name} is empty
              </h3>
              <p className="mt-2 max-w-sm text-sm text-purple-600">
                Add images from your liked collection to start filling this pod.
              </p>
              <Button
                className="mt-6 bg-purple-500 hover:bg-purple-400"
                onClick={() => {
                  setCurrentPodId('all');
                  setIsMultiSelectMode(true);
                }}
              >
                Add Images
              </Button>
            </div>
          )}

          {!loading && !showEmptyLiked && visibleImages.length > 0 && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visibleImages.map((image, index) => (
                <ImageGridCard
                  key={image.id}
                  image={image}
                  index={index}
                  pods={pods}
                  isSelected={selectedImageIds.includes(image.id)}
                  isMultiSelectMode={isMultiSelectMode}
                  activeQuickAction={activeQuickAction}
                  onToggleSelect={handleToggleSelect}
                  onView={handleOpenLightbox}
                  onUnlike={handleUnlikeSingle}
                  onQuickAssign={handleQuickAssign}
                  onOpenCreate={() => setShowCreateModal(true)}
                  setActiveQuickAction={setActiveQuickAction}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {isMultiSelectMode && (
        <div className="sticky top-20 z-20 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3 text-sm text-gray-700">
              <CheckSquare className="h-4 w-4 text-purple-500" />
              <span>
                {selectionCount > 0 ? `${selectionCount} selected` : 'Select images'}
              </span>
            </div>
            <button
              type="button"
              onClick={resetSelection}
              className="text-sm font-medium text-gray-500 transition hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isMultiSelectMode && selectionCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,0.12)]">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-sm font-semibold text-purple-700">
                {selectionCount}
              </span>
              selected
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Button
                  variant="outline"
                  onClick={() => setAddMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2 border-purple-200 text-purple-600 hover:border-purple-300 hover:bg-purple-50"
                >
                  <FolderPlus className="h-4 w-4" />
                  Add to Pod
                  <ChevronDown className="h-4 w-4" />
                </Button>
                {addMenuOpen && (
                  <div className="absolute bottom-12 right-0 z-30 w-64 rounded-xl border border-purple-200 bg-white shadow-xl">
                    <div className="max-h-60 overflow-y-auto p-2">
                      {pods.map((pod) => (
                        <button
                          key={pod.id}
                          type="button"
                          onClick={() => {
                            handleAddSelectedToPod(pod.id);
                            setAddMenuOpen(false);
                          }}
                          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-gray-700 transition hover:bg-purple-50"
                        >
                          <span className="flex items-center gap-2">
                            <Folder className="h-4 w-4 text-purple-500" />
                            {pod.name}
                          </span>
                          <span className="text-xs text-gray-400">{pod.imageCount ?? 0}</span>
                        </button>
                      ))}
                      {pods.length === 0 && (
                        <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
                          Create a pod to add selections.
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAddMenuOpen(false);
                        setShowCreateModal(true);
                      }}
                      className="flex w-full items-center justify-center gap-2 border-t border-purple-100 px-3 py-2 text-sm text-purple-600 transition hover:bg-purple-50"
                    >
                      <Plus className="h-4 w-4" />
                      New Pod
                    </button>
                  </div>
                )}
              </div>
              {currentPodId !== 'all' && (
                <Button
                  variant="outline"
                  onClick={handleRemoveSelectedFromPod}
                  className="border-gray-200 text-gray-700 hover:bg-gray-100"
                >
                  <Folder className="mr-2 h-4 w-4" />
                  Remove from Pod
                </Button>
              )}
              <Button
                variant="destructive"
                onClick={handleDeleteSelected}
                className="bg-pink-500 hover:bg-pink-400"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        <Button
          onClick={() => setShowCreateModal(true)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-500 text-white shadow-xl transition hover:scale-105 hover:bg-purple-400"
        >
          <Plus className="h-6 w-6" />
        </Button>
        <Button
          variant="outline"
          onClick={() => setIsMultiSelectMode((prev) => !prev)}
          className={`flex h-12 w-12 items-center justify-center rounded-full border-2 ${
            isMultiSelectMode
              ? 'border-gray-900 bg-gray-900 text-white shadow-lg'
              : 'border-gray-200 bg-white text-gray-700 shadow'
          }`}
        >
          <CheckSquare className="h-5 w-5" />
        </Button>
      </div>

      {lightboxState && (
        <Lightbox
          images={lightboxState.images}
          initialIndex={lightboxState.index}
          onClose={handleCloseLightbox}
        />
      )}
    </div>
  );
};

export default PodsPage;

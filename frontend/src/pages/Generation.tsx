import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Zap, Package, Palette, Loader, Image, Eye, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import authAPI from '../services/authAPI';
import { API_URL } from '../config/env';
import { voiceAPI } from '../services/voiceAPI';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Slider } from '../components/ui/slider';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Switch } from '../components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import type { GalleryImage } from '../types/images';
import { normalizeGalleryImage, serializeGalleryImage } from '../utils/gallery';

type GeneratedImage = GalleryImage & {
  brandConsistencyScore?: number;
  brandDNAApplied?: boolean;
  isVoiceGenerated?: boolean;
  enhancedPrompt?: string;
};

type ValidationSummary = {
  clarityScore: number;
  brandAlignment: number;
  warnings: string[];
  estimatedQuality: 'High' | 'Medium' | 'Low';
};

type GenerationSource = 'quick' | 'builder';

type PendingGenerationState = {
  count: number;
  prompt: string;
  source: GenerationSource;
  quickBatchId?: (typeof quickBatches)[number]['id'];
};

type ActiveGenerationState = {
  source: GenerationSource;
  quickBatchId?: (typeof quickBatches)[number]['id'];
};

type RecentStatus = 'queued' | 'processing' | 'completed' | 'failed';

type RecentGenerationItem = {
  id: string;
  prompt: string;
  count: number;
  status: RecentStatus;
  queuedAt: Date;
  updatedAt?: Date;
  brandMatch?: number;
};

const quickBatches = [
  {
    id: 'quick',
    icon: Zap,
    title: 'QUICK TEST',
    description: 'Perfect for quick iterations',
    count: 5,
    time: '~1 min',
  },
  {
    id: 'standard',
    icon: Package,
    title: 'STANDARD BATCH',
    description: 'Balanced speed and variety',
    count: 25,
    time: '~3 min',
  },
  {
    id: 'explore',
    icon: Palette,
    title: 'CREATIVE EXPLORATION',
    description: 'Maximum variation for fresh ideas',
    count: 50,
    time: '~6 min',
  },
] satisfies ReadonlyArray<{
  id: string;
  icon: typeof Zap;
  title: string;
  description: string;
  count: number;
  time: string;
}>;

const providerOptions = [
  {
    id: 'imagen',
    label: 'Imagen-4 Ultra (Recommended)',
    cost: '$0.08',
    helper: 'Balanced fidelity with strong brand alignment',
  },
  {
    id: 'sdxl',
    label: 'Stable Diffusion XL',
    cost: '$0.02',
    helper: 'Fast iterations with lightweight cost',
  },
  {
    id: 'dalle',
    label: 'DALL·E 3',
    cost: '$0.04',
    helper: 'Great for conceptual storytelling compositions',
  },
] as const;

const MIN_BATCH_COUNT = 1;
const MAX_BATCH_COUNT = 100;

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

const parseMaybeDate = (value: unknown): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return undefined;
};

const normalizeStyleProfileForGeneration = (payload: any) => {
  if (!payload) return null;

  const profile = payload.profile || {};
  const brandDNA = payload.brandDNA || {};

  const extractColorName = (color: any): string | null => {
    if (typeof color === 'string') return color.trim();
    if (color && typeof color.name === 'string') return color.name.trim();
    return null;
  };

  let signatureColors: string[] = Array.isArray(brandDNA.signatureColors)
    ? brandDNA.signatureColors
        .map(extractColorName)
        .filter((value): value is string => Boolean(value))
    : [];

  if (!signatureColors.length) {
    const colorDistribution =
      profile.distributions?.colors ||
      profile.color_distribution ||
      {};

    signatureColors = Object.entries(colorDistribution)
      .sort(([, a], [, b]) => (Number(b) || 0) - (Number(a) || 0))
      .map(([key]) => key)
      .filter(Boolean)
      .slice(0, 3);
  }

  const resolveStyleName = (value: any): string | null => {
    if (!value) return null;
    if (typeof value === 'string') return value.trim();
    if (typeof value.name === 'string') return value.name.trim();
    return null;
  };

  const primaryStyle =
    resolveStyleName(brandDNA.primaryAesthetic) ||
    resolveStyleName(brandDNA.secondaryAesthetics?.[0]) ||
    resolveStyleName(profile.styleLabels?.[0]) ||
    resolveStyleName(profile.clusters?.[0]) ||
    null;

  return {
    profile,
    brandDNA,
    signature_elements: {
      colors: signatureColors,
    },
    aesthetic_profile: {
      primary_style: primaryStyle,
    },
  };
};

const formatBatchTimestamp = (value: Date): string => {
  const now = new Date();
  const sameDay = value.toDateString() === now.toDateString();

  return value.toLocaleString(undefined, {
    month: sameDay ? undefined : 'short',
    day: sameDay ? undefined : 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

type GenerateConfirmationDetails = {
  count: number;
  prompt: string;
  providerLabel: string;
  providerCost?: string;
  generationModeLabel: string;
  creativity: number;
  enforceBrandDNA: boolean;
  brandDNAStrength: number;
  estimatedTime: string;
  batchTitle?: string;
  source: 'quick' | 'builder';
  interpretPrompt: boolean;
};

type GenerateConfirmationDialogProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
  details: GenerateConfirmationDetails;
};

const GenerateConfirmationDialog: React.FC<GenerateConfirmationDialogProps> = ({
  open,
  onCancel,
  onConfirm,
  loading,
  details,
}) => {
  const {
    count,
    prompt,
    providerLabel,
    providerCost,
    generationModeLabel,
    creativity,
    enforceBrandDNA,
    brandDNAStrength,
    estimatedTime,
    batchTitle,
    source,
    interpretPrompt,
  } = details;

  const brandDNAPercent = Math.round(brandDNAStrength * 100);
  const creativityPercent = Math.round(creativity * 100);

  const batchDescriptor =
    batchTitle ??
    (source === 'builder' ? 'Prompt builder settings' : 'Custom quick batch settings');

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onCancel();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg bg-white p-0 overflow-hidden shadow-2xl">
        <div className="space-y-6 p-6">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-gray-900">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#6366f1]/10 text-[#4f46e5]">
                <Sparkles className="h-5 w-5" />
              </div>
              Confirm generation
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              Review the prompt and settings before starting this batch.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-900">
                Generate {count} images · {generationModeLabel}
              </p>
              <p className="text-xs text-gray-500">
                {batchDescriptor} · Est. time {estimatedTime}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Prompt</p>
              <div className="rounded-md border border-gray-200 bg-white p-3 text-sm text-gray-700 whitespace-pre-wrap">
                {prompt}
              </div>
            </div>

            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Provider</p>
                <p className="text-gray-900">
                  {providerLabel}
                  {providerCost ? (
                    <span className="text-xs text-gray-500"> · {providerCost}/image</span>
                  ) : null}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Creativity</p>
                <p className="text-gray-900">
                  {creativity.toFixed(1)} ({creativityPercent}% creative exploration)
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Brand DNA</p>
                <div className="space-y-1">
                  {enforceBrandDNA ? (
                    <>
                      <p className="text-gray-900">
                        Auto-balanced · {brandDNAPercent}% DNA emphasis
                      </p>
                      <p className="text-xs text-gray-500">
                        Complements {creativityPercent}% creativity for consistency.
                      </p>
                    </>
                  ) : (
                    <p className="text-gray-900">Disabled</p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Mode</p>
                <p className="text-gray-900">{generationModeLabel}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Prompt handling</p>
                <p className="text-gray-900">
                  {interpretPrompt ? 'Enhanced with brand DNA guidance' : 'Use prompt exactly as written'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 border-t border-gray-100 bg-gray-50 px-6 py-4">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className="bg-[#6366f1] text-white hover:bg-[#4f46e5]"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader className="h-4 w-4 animate-spin" />
                Generating...
              </span>
            ) : (
              'Generate'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Generation: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [recentItems, setRecentItems] = useState<RecentGenerationItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [enhancedPrompt, setEnhancedPrompt] = useState('');
  const [validationResults, setValidationResults] = useState<ValidationSummary | null>(null);
  const [styleProfile, setStyleProfile] = useState<any>(null);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [creativity, setCreativity] = useState(0.5);
  const [enforceBrandDNA, setEnforceBrandDNA] = useState(true);
  const [useLiteralPrompt, setUseLiteralPrompt] = useState(false);
  const lastBrandDNASetting = useRef(true);
  const brandDNAStrength = useMemo(() => Number((1 - creativity).toFixed(2)), [creativity]);
  const [batchSize, setBatchSize] = useState<number>(25);
  const [provider, setProvider] =
    useState<(typeof providerOptions)[number]['id']>(providerOptions[0].id);
  const [generationMode, setGenerationMode] = useState<'focused' | 'capsule'>('focused');
  const [voiceQuery, setVoiceQuery] = useState<{
    displayQuery: string;
    enhancedPrompt: string;
    negativePrompt?: string;
  } | null>(null);
  const [pendingGeneration, setPendingGeneration] =
    useState<PendingGenerationState | null>(null);
  const [activeQuickBatchId, setActiveQuickBatchId] = useState<(typeof quickBatches)[number]['id'] | null>(null);
  const [builderGenerationActive, setBuilderGenerationActive] = useState(false);

  const quickGenerationActive = activeQuickBatchId !== null;

  const currentUser = authAPI.getCurrentUser();
  const designerId = currentUser?.id || null;

  const composePromptForGeneration = useCallback(
    (basePrompt: string) => {
      const trimmed = basePrompt.trim();
      if (trimmed) {
        return trimmed;
      }

      const parts: string[] = ['Based on style profile'];

      const primaryStyle = styleProfile?.aesthetic_profile?.primary_style;
      if (typeof primaryStyle === 'string' && primaryStyle.trim()) {
        parts.push(primaryStyle.trim());
      }

      const signatureColors = Array.isArray(styleProfile?.signature_elements?.colors)
        ? styleProfile?.signature_elements?.colors
        : undefined;
      const firstColor =
        signatureColors && signatureColors.length > 0 ? signatureColors[0] : undefined;
      if (typeof firstColor === 'string' && firstColor.trim()) {
        parts.push(`${firstColor.trim()} palette`);
      }

      return parts.join(' · ');
    },
    [styleProfile]
  );

  const providerDetails = useMemo(
    () => providerOptions.find((option) => option.id === provider),
    [provider]
  );

  const generationModeDetails = useMemo(
    () =>
      generationMode === 'focused'
        ? {
            label: 'Focused Look',
            helper: 'Variations of aligned images',
          }
        : {
            label: 'Capsule',
            helper: 'Collection of coordinated looks',
          },
    [generationMode]
  );

  const generationModeLabel = generationModeDetails.label;

  useEffect(() => {
    const loadStyleProfile = async () => {
      if (!designerId) {
        setStyleProfile(null);
        return;
      }

      const token = authAPI.getToken();
      if (!token) {
        setStyleProfile(null);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/podna/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            setStyleProfile(null);
          } else {
            console.warn('Could not load style profile:', response.statusText);
          }
          return;
        }

        const result = await response.json();
        if (result.success && result.data) {
          const normalized = normalizeStyleProfileForGeneration(result.data);
          setStyleProfile(normalized);
        } else {
          setStyleProfile(null);
        }
      } catch (err) {
        console.warn('Could not load style profile:', err);
        setStyleProfile(null);
      }
    };

    loadStyleProfile();
  }, [designerId]);

  useEffect(() => {
    if (useLiteralPrompt) {
      setEnhancedPrompt('');
      setValidationResults(null);
      return;
    }

    if (!prompt.trim()) {
      setEnhancedPrompt('');
      setValidationResults(null);
      return;
    }

    const timer = setTimeout(() => {
      let enhanced = prompt;

      if (styleProfile) {
        if (styleProfile.signature_elements?.colors?.[0]) {
          enhanced += `, in ${styleProfile.signature_elements.colors[0]} tones`;
        }
        if (styleProfile.aesthetic_profile?.primary_style) {
          enhanced += `, ${styleProfile.aesthetic_profile.primary_style} aesthetic`;
        }
      }

      const clarityScore = Math.min(100, prompt.length * 2);
      const brandAlignment = styleProfile ? 85 : 55;
      const warnings =
        clarityScore < 70
          ? ['Add more fabric, silhouette, or styling details for higher fidelity']
          : [];

      setEnhancedPrompt(enhanced);
      setValidationResults({
        clarityScore,
        brandAlignment,
        warnings,
        estimatedQuality: clarityScore > 80 ? 'High' : clarityScore > 60 ? 'Medium' : 'Low',
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [prompt, styleProfile, useLiteralPrompt]);

  const persistGeneratedImages = useCallback(
    (newImages: GeneratedImage[], options?: { replace?: boolean }) => {
      const activeUser = authAPI.getCurrentUser();
      const storageKey = activeUser?.id ? `generatedImages_${activeUser.id}` : 'generatedImages';

      let existing: GalleryImage[] = [];
      if (!options?.replace) {
        try {
          const existingRaw = localStorage.getItem(storageKey);
          if (existingRaw) {
            const parsed = JSON.parse(existingRaw);
            if (Array.isArray(parsed)) {
              existing = parsed
                .map((item) => normalizeGalleryImage(item))
                .filter((img): img is GalleryImage => Boolean(img));
            }
          }
        } catch (storageError) {
          console.warn('Failed to read stored generated images', storageError);
        }
      }

      const merged: GalleryImage[] = options?.replace ? [...newImages] : [...newImages, ...existing];

      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify(merged.map((image) => serializeGalleryImage(image)))
        );
      } catch (storageError) {
        console.warn('Failed to persist generated images', storageError);
      }
    },
    []
  );

  // Seed local images from storage so "Recent generations" has data even before
  // a new generation in this session
  useEffect(() => {
    try {
      const activeUser = authAPI.getCurrentUser();
      const storageKey = activeUser?.id ? `generatedImages_${activeUser.id}` : 'generatedImages';
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const normalized = parsed
        .map((item: any) => normalizeGalleryImage(item))
        .filter((img: any): img is GalleryImage => Boolean(img))
        .map((img: GalleryImage) => ({ ...img })) as GeneratedImage[];
      if (normalized.length > 0) {
        setImages(normalized);
      }
    } catch (err) {
      console.warn('Failed to seed generated images from storage', err);
    }
  }, []);

  const buildGeneratedImages = useCallback(
    (
      assets: any[],
      options: {
        prompt: string;
        generationMethod: 'generate_endpoint' | 'voice_command' | 'batch_generation';
        enhancedPrompt?: string;
      }
    ): GeneratedImage[] => {
      const now = Date.now();

      return assets
        .map((asset: any, index: number) => {
          const promptText =
            asset?.prompt ||
            asset?.prompt_text ||
            asset?.promptText ||
            options.prompt;

          const baseMetadata =
            (asset && typeof asset.metadata === 'object' && asset.metadata) ||
            (asset && typeof asset.promptMetadata === 'object' && asset.promptMetadata) ||
            (asset && typeof asset.prompt_metadata === 'object' && asset.prompt_metadata) ||
            (asset && typeof asset.promptSpec === 'object' && asset.promptSpec) ||
            (asset && typeof asset.prompt_spec === 'object' && asset.prompt_spec) ||
            {};

          const metadata: any = { ...baseMetadata };

          if (!metadata.generationMethod) {
            metadata.generationMethod = options.generationMethod;
          }

          const promptGroupSource =
            metadata.promptGroup ||
            metadata.prompt_group ||
            asset?.promptGroup ||
            asset?.prompt_group ||
            asset?.group ||
            asset?.promptGroupInfo ||
            asset?.prompt_group_info;

          if (promptGroupSource) {
            metadata.promptGroup =
              typeof promptGroupSource === 'object'
                ? { ...(promptGroupSource as Record<string, unknown>) }
                : { prompt: String(promptGroupSource) };
            delete metadata.prompt_group;
          }

          const promptGroup =
            metadata.promptGroup && typeof metadata.promptGroup === 'object'
              ? metadata.promptGroup
              : undefined;

          const normalized = normalizeGalleryImage({
            ...asset,
            id: asset?.id?.toString?.() || `gen-${options.generationMethod}-${now}-${index}`,
            url: asset?.url || asset?.cdnUrl || asset?.cdn_url || asset?.imageUrl || asset?.image_url,
            prompt: promptText,
            timestamp: (() => {
              const createdAtSource = asset?.createdAt ?? asset?.created_at;
              return createdAtSource ? new Date(createdAtSource) : new Date();
            })(),
            lastInteractedAt: new Date(),
            origin: asset?.origin || 'user',
            metadata,
            tags: Array.isArray(asset?.tags) ? asset.tags : undefined,
            groupId:
              asset?.groupId ??
              asset?.promptGroupId ??
              asset?.prompt_group_id ??
              promptGroup?.id ??
              promptGroup?.groupId ??
              promptGroup?.group_id,
            groupIndex:
              asset?.groupIndex ??
              asset?.promptGroupIndex ??
              asset?.prompt_group_index ??
              promptGroup?.index ??
              promptGroup?.groupIndex ??
              promptGroup?.position,
            groupSize:
              asset?.groupSize ??
              asset?.promptGroupCount ??
              asset?.prompt_group_count ??
              promptGroup?.count ??
              promptGroup?.size ??
              promptGroup?.total,
          });

          if (!normalized) {
            return null;
          }

          const brandConsistency =
            asset.brand_consistency_score ??
            asset.brandConsistencyScore ??
            asset.consistency_score;
          const brandAppliedRaw =
            asset.brand_dna_applied ??
            asset.brandDNAApplied ??
            asset.brandDNA_applied ??
            asset.brand_dnaApplied;

          return {
            ...normalized,
            brandConsistencyScore:
              typeof brandConsistency === 'number' ? brandConsistency : undefined,
            brandDNAApplied:
              typeof brandAppliedRaw === 'boolean' ? brandAppliedRaw : undefined,
            isVoiceGenerated: options.generationMethod === 'voice_command',
            enhancedPrompt: options.enhancedPrompt,
          } as GeneratedImage;
        })
        .filter((img): img is GeneratedImage => Boolean(img));
    },
    []
  );

  const waitForGeneratedAssets = useCallback(
    async (promptText: string, expectedCount: number) => {
      const token = authAPI.getToken();
      if (!token) {
        return [];
      }

      const normalizedPrompt = promptText.trim().toLowerCase();
      const deadline = Date.now() + 15000; // wait up to 15s
      const limit = Math.max(expectedCount * 2, 10);

      while (Date.now() < deadline) {
        try {
          const response = await fetch(`${API_URL}/podna/gallery?limit=${limit}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (response.ok) {
            const body = await response.json();
            const galleryAssets: any[] = body?.data?.generations || body?.data?.images || [];
            const matchingAssets = galleryAssets.filter((asset) => {
              const assetPrompt =
                asset?.prompt ||
                asset?.promptText ||
                asset?.prompt_text ||
                asset?.metadata?.prompt ||
                '';
              return typeof assetPrompt === 'string' && assetPrompt.trim().toLowerCase() === normalizedPrompt;
            });

            if (matchingAssets.length > 0) {
              return buildGeneratedImages(matchingAssets, {
                prompt: promptText,
                generationMethod: 'generate_endpoint',
              });
            }
          }
        } catch (pollError) {
          console.warn('Gallery poll failed while waiting for generated assets', pollError);
        }

        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      return [];
    },
    [buildGeneratedImages]
  );

  const syncGeneratedImagesFromServer = useCallback(async () => {
    try {
      const token = authAPI.getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/podna/gallery?limit=60`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) return;
      const body = await response.json();
      const serverGenerations: any[] =
        (Array.isArray(body?.data?.generations) && body.data.generations) ||
        (Array.isArray(body?.data?.images) && body.data.images) ||
        [];

      if (serverGenerations.length === 0) return;

      const normalized = buildGeneratedImages(serverGenerations, {
        prompt: 'Server sync',
        generationMethod: 'generate_endpoint',
      });

      if (normalized.length === 0) return;

      let mergedList: GeneratedImage[] | null = null;
      setImages((previous) => {
        const map = new Map(previous.map((img) => [img.id, img]));
        normalized.forEach((img) => {
          map.set(img.id, img);
        });
        mergedList = Array.from(map.values()).sort(
          (a, b) => (b.timestamp?.getTime?.() || 0) - (a.timestamp?.getTime?.() || 0)
        );
        return mergedList;
      });

      if (mergedList && mergedList.length > 0) {
        persistGeneratedImages(mergedList, { replace: true });
      }
    } catch (err) {
      console.warn('Failed to sync generated designs from server', err);
    }
  }, [buildGeneratedImages, persistGeneratedImages]);

  const loadRecentFromServer = useCallback(async () => {
    try {
      const token = authAPI.getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/podna/gallery?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) return;
      const body = await response.json();
      const generations: any[] = body?.data?.generations || body?.data?.images || [];

      const summaryMap = new Map<string, { count: number; first: Date; last: Date; brand?: number }>();

      generations.forEach((g: any) => {
        const promptText = g?.prompt || g?.promptText || g?.prompt_text || 'Untitled prompt';
        const createdAt = new Date(g?.createdAt || g?.created_at || Date.now());
        const brand = typeof g?.brandConsistencyScore === 'number' ? g.brandConsistencyScore : undefined;
        const prev = summaryMap.get(promptText);
        if (!prev) {
          summaryMap.set(promptText, { count: 1, first: createdAt, last: createdAt, brand });
        } else {
          prev.count += 1;
          if (createdAt < prev.first) prev.first = createdAt;
          if (createdAt > prev.last) prev.last = createdAt;
          if (brand !== undefined) prev.brand = brand;
        }
      });

      const serverItems: RecentGenerationItem[] = Array.from(summaryMap.entries())
        .map(([prompt, info]) => ({
          id: `server-${prompt}-${info.last.getTime()}`,
          prompt,
          count: info.count,
          status: 'completed',
          queuedAt: info.first,
          updatedAt: info.last,
          brandMatch: info.brand,
        }))
        .sort((a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0))
        .slice(0, 8);

      setRecentItems((prev) => {
        const byPrompt = new Map<string, RecentGenerationItem>();
        [...prev, ...serverItems].forEach((item) => {
          const existing = byPrompt.get(item.prompt);
          if (!existing) {
            byPrompt.set(item.prompt, item);
          } else {
            const keep = existing.status !== 'completed' ? existing : item;
            const merged: RecentGenerationItem = {
              ...keep,
              count: Math.max(existing.count, item.count),
              queuedAt: existing.queuedAt < item.queuedAt ? existing.queuedAt : item.queuedAt,
              updatedAt:
                existing.updatedAt && item.updatedAt
                  ? existing.updatedAt > item.updatedAt
                    ? existing.updatedAt
                    : item.updatedAt
                  : existing.updatedAt || item.updatedAt,
              brandMatch: existing.brandMatch ?? item.brandMatch,
            };
            byPrompt.set(item.prompt, merged);
          }
        });
        return Array.from(byPrompt.values())
          .sort((a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0))
          .slice(0, 8);
      });
    } catch (err) {
      console.warn('Failed to load recent generations', err);
    }
  }, []);

  useEffect(() => {
    loadRecentFromServer();
    syncGeneratedImagesFromServer();
  }, [loadRecentFromServer, syncGeneratedImagesFromServer]);

  const handleGenerate = async (
    commandOrEvent?: string | React.FormEvent,
    options?: { countOverride?: number; source?: 'voice' | 'text' }
  ) => {
    if (commandOrEvent && typeof commandOrEvent === 'object' && 'preventDefault' in commandOrEvent) {
      commandOrEvent.preventDefault();
    }

    const promptText = typeof commandOrEvent === 'string' ? commandOrEvent : prompt;
    if (!promptText.trim()) {
      setError('Please describe your design before generating.');
      return false;
    }

    setLoading(true);
    setError(null);

    let generationSucceeded = false;

    try {
      if (options?.source === 'voice') {
        const voiceResult = await voiceAPI.processTextCommand(promptText);
        if (voiceResult.success && voiceResult.data) {
          setVoiceQuery({
            displayQuery: voiceResult.data.displayQuery || promptText,
            enhancedPrompt: voiceResult.data.enhancedPrompt || promptText,
            negativePrompt: voiceResult.data.negativePrompt,
          });

          // Support both shapes from API: generation.images (older) and generation.assets (current)
          const voiceAssets =
            (voiceResult.data.generation &&
              (voiceResult.data.generation.images || voiceResult.data.generation.assets)) ||
            null;

          if (voiceAssets) {
            const generatedImages = buildGeneratedImages(voiceAssets, {
              prompt: voiceResult.data.displayQuery || promptText,
              generationMethod: 'voice_command',
              enhancedPrompt: voiceResult.data.enhancedPrompt,
            });

            if (generatedImages.length > 0) {
              setImages((prev) => [...generatedImages, ...prev]);
              persistGeneratedImages(generatedImages);
            }
          }
        }

        if (typeof commandOrEvent !== 'string') {
          setPrompt('');
        }
        generationSucceeded = Boolean(voiceResult.success);
        return generationSucceeded;
      }

      const token = authAPI.getToken();
      if (!token) {
        throw new Error('Authentication is required to generate images.');
      }

      const response = await fetch(`${API_URL}/podna/generate-with-dna`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: promptText,
          enforceBrandDNA,
          brandDNAStrength,
          creativity,
          provider,
          generationMode,
          interpretPrompt: !useLiteralPrompt,
          count: options?.countOverride ?? batchSize,
        }),
      });

      if (!response.ok) {
        const errorResponse = await response.json();
        throw new Error(errorResponse.message || 'Generation failed');
      }

      const result = await response.json();

      if (result.success && result.data?.generations) {
        let generatedImages = buildGeneratedImages(result.data.generations, {
          prompt: promptText,
          generationMethod: 'generate_endpoint',
        });

        if (generatedImages.length === 0) {
          generatedImages = await waitForGeneratedAssets(
            promptText,
            options?.countOverride ?? batchSize
          );
        }

        if (generatedImages.length === 0) {
          throw new Error(
            'Generation finished but no assets were returned. Please try again in a moment.'
          );
        }

        if (generatedImages.length > 0) {
          setImages((prev) => [...generatedImages, ...prev]);
          persistGeneratedImages(generatedImages);
        }

        setVoiceQuery(null);
        generationSucceeded = true;

        if (typeof commandOrEvent !== 'string') {
          setPrompt('');
        }

        await Promise.all([
          syncGeneratedImagesFromServer(),
          loadRecentFromServer(),
        ]);
      }
    } catch (generationError: any) {
      console.error('Generation failed:', generationError);
      setError(generationError.message || 'Failed to generate images');
    } finally {
      setLoading(false);
    }

    return generationSucceeded;
  };

  const openGenerationConfirmation = useCallback(
    (count: number, source: GenerationSource, quickBatchId?: (typeof quickBatches)[number]['id']) => {
      if (builderGenerationActive || (quickGenerationActive && source === 'builder')) {
        return;
      }

      if (source === 'quick') {
        if (builderGenerationActive) {
          return;
        }
        if (quickGenerationActive && activeQuickBatchId && quickBatchId && activeQuickBatchId !== quickBatchId) {
          return;
        }
      }

      const effectivePrompt = composePromptForGeneration(prompt);
      setError(null);
      setPendingGeneration({
        count,
        prompt: effectivePrompt,
        source,
        quickBatchId,
      });
    },
    [activeQuickBatchId, builderGenerationActive, composePromptForGeneration, prompt, quickGenerationActive]
  );

  const closeGenerationConfirmation = useCallback(() => {
    setPendingGeneration(null);
  }, []);

  const handleConfirmGeneration = useCallback(async () => {
    if (!pendingGeneration) {
      return;
    }

    const { count, prompt: effectivePrompt, source, quickBatchId } = pendingGeneration;
    setPendingGeneration(null);
    if (source === 'quick') {
      setActiveQuickBatchId(quickBatchId ?? null);
      setBuilderGenerationActive(false);
    } else {
      setBuilderGenerationActive(true);
      setActiveQuickBatchId(null);
    }

    try {
      // Record a queued item immediately for feedback
      const queuedId = `queued-${Date.now()}`;
      setRecentItems((prev) => [
        {
          id: queuedId,
          prompt: effectivePrompt,
          count,
          status: 'queued',
          queuedAt: new Date(),
        },
        ...prev,
      ].slice(0, 8));

      const generationSucceeded = await handleGenerate(effectivePrompt, {
        countOverride: count,
      });

      if (generationSucceeded && source === 'builder') {
        setPrompt('');
      }
      // Mark as completed on success
      if (generationSucceeded) {
        setRecentItems((prev) => prev.map((item) =>
          item.id === queuedId
            ? { ...item, status: 'completed', updatedAt: new Date() }
            : item
        ));
      } else {
        setRecentItems((prev) => prev.map((item) =>
          item.id === queuedId
            ? { ...item, status: 'failed', updatedAt: new Date() }
            : item
        ));
      }
    } finally {
      setActiveQuickBatchId(null);
      setBuilderGenerationActive(false);
    }
  }, [handleGenerate, pendingGeneration]);

  const confirmationDetails = pendingGeneration
    ? (() => {
        const matchedBatch = pendingGeneration.quickBatchId
          ? quickBatches.find((batch) => batch.id === pendingGeneration.quickBatchId)
          : quickBatches.find((batch) => batch.count === pendingGeneration.count);
        const fallbackMinutes = Math.max(1, Math.ceil(pendingGeneration.count / 10));
        const estimatedTime = matchedBatch?.time ?? `~${fallbackMinutes} min`;

        return {
          count: pendingGeneration.count,
          prompt: pendingGeneration.prompt,
          providerLabel: providerDetails?.label ?? provider,
          providerCost: providerDetails?.cost,
          generationModeLabel,
          creativity,
          enforceBrandDNA,
          brandDNAStrength,
          estimatedTime,
          batchTitle: matchedBatch?.title,
          source: pendingGeneration.source,
          interpretPrompt: !useLiteralPrompt,
        };
      })()
    : null;

  // Derive display list from recentItems (fallback to images if empty)
  const recentGenerations = useMemo(() => {
    if (recentItems.length > 0) return recentItems;

    // Fallback: derive a completed-only summary from local images
    const summaries = new Map<string, RecentGenerationItem>();
    images.forEach((image, idx) => {
      const key = image.prompt || `Untitled-${idx}`;
      const ts = image.timestamp ? new Date(image.timestamp) : new Date();
      const existing = summaries.get(key);
      if (!existing) {
        summaries.set(key, {
          id: `local-${key}-${ts.getTime()}`,
          prompt: key,
          count: 1,
          status: 'completed',
          queuedAt: ts,
          updatedAt: ts,
          brandMatch: image.brandConsistencyScore,
        });
      } else {
        existing.count += 1;
        if (ts > (existing.updatedAt || existing.queuedAt)) existing.updatedAt = ts;
        if (image.brandConsistencyScore !== undefined) existing.brandMatch = image.brandConsistencyScore;
      }
    });
    return Array.from(summaries.values()).sort((a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0)).slice(0, 4);
  }, [images, recentItems]);

  return (
    <>
      <div className="min-h-screen bg-white pb-16">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
          <header className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-light text-gray-900">Generate New Looks</h1>
            <p className="max-w-3xl text-gray-600">
              Experiment with quick batches or craft precise prompts to explore new looks in minutes.
          </p>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {quickBatches.map((batch) => {
            const Icon = batch.icon;
            const isActiveBatch = activeQuickBatchId === batch.id;
            const isDisabled =
              builderGenerationActive ||
              (quickGenerationActive && !isActiveBatch) ||
              isActiveBatch;
            return (
              <Card
                key={batch.id}
                className="border border-gray-200 transition-shadow duration-200 hover:shadow-md"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (builderGenerationActive) {
                      return;
                    }
                    if (quickGenerationActive && !isActiveBatch) {
                      return;
                    }
                    openGenerationConfirmation(batch.count, 'quick', batch.id);
                  }}
                  disabled={isDisabled}
                  className={`flex h-full w-full flex-col gap-4 rounded-lg p-5 text-left ${
                    isDisabled
                      ? 'disabled:cursor-not-allowed disabled:opacity-60'
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#6366f1]/10 text-[#6366f1]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{batch.title}</p>
                      <p className="text-xs text-gray-500">{batch.description}</p>
                    </div>
                  </div>
                  <div className="mt-auto flex items-center justify-between text-sm text-gray-500">
                    <span>{batch.count} images</span>
                    <span>{batch.time}</span>
                  </div>
                  <Button
                    type="button"
                    disabled={isDisabled}
                    className="mt-2 w-full bg-[#6366f1] text-white hover:bg-[#4f46e5]"
                  >
                    {isActiveBatch ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader className="h-4 w-4 animate-spin" />
                        Generating...
                      </span>
                    ) : (
                      'Generate'
                    )}
                  </Button>
                </button>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#6366f1]/10 px-3 py-1 text-xs font-medium text-[#4f46e5]">
                <Sparkles className="h-4 w-4" />
                Prompt Builder
              </div>
              <CardTitle className="text-2xl font-semibold text-gray-900">
                Describe your next look
              </CardTitle>
              <CardDescription>
                We enhance your direction with brand DNA and style preferences automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Prompt</label>
                <Textarea
                  value={prompt}
                  onChange={(e) => {
                    if (error) {
                      setError(null);
                    }
                    setPrompt(e.target.value);
                  }}
                  placeholder="e.g., tailored navy blazer with architectural shoulders and silk lining..."
                  rows={4}
                  disabled={loading}
                />
                {error && (
                  <p className="text-sm text-red-500" role="alert">
                    {error}
                  </p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-700">Use prompt exactly</p>
                    <p className="text-xs text-gray-500">
                      Skip brand interpretation and send your words directly to the model.
                    </p>
                  </div>
                  <Switch
                    checked={useLiteralPrompt}
                    onCheckedChange={(checked) => {
                      setUseLiteralPrompt(checked);
                      if (checked) {
                        lastBrandDNASetting.current = enforceBrandDNA;
                        setEnforceBrandDNA(false);
                      } else {
                        setEnforceBrandDNA(lastBrandDNASetting.current);
                      }
                    }}
                    disabled={loading}
                  />
                </div>

                <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-700">Enforce Brand DNA</p>
                    <p className="text-xs text-gray-500">
                      Keep colors, silhouettes, and styling aligned with your profile.
                    </p>
                    {useLiteralPrompt && (
                      <p className="text-xs text-gray-400">
                        Disabled while using the exact prompt.
                      </p>
                    )}
                  </div>
                  <Switch
                    checked={enforceBrandDNA}
                    onCheckedChange={(checked) => {
                      setEnforceBrandDNA(checked);
                      if (!useLiteralPrompt) {
                        lastBrandDNASetting.current = checked;
                      }
                    }}
                    disabled={loading || useLiteralPrompt}
                  />
                </div>
              </div>

              {enhancedPrompt && (
                <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-gray-700">Enhanced interpretation</span>
                    {validationResults?.estimatedQuality && (
                      <Badge variant="outline" className="text-xs font-normal">
                        {validationResults.estimatedQuality} quality
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{enhancedPrompt}</p>
                  {validationResults && (
                    <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                      <span>Clarity: {validationResults.clarityScore}%</span>
                      <span>Brand alignment: {validationResults.brandAlignment}%</span>
                      {validationResults.warnings.map((warning) => (
                        <span key={warning} className="text-amber-600">
                          {warning}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between">
                    <span className="flex items-center gap-2">⚙️ Advanced controls</span>
                    <span className="text-xs uppercase tracking-wide text-gray-500">
                      {showAdvanced ? 'Hide' : 'Show'}
                    </span>
                  </Button>
                </CollapsibleTrigger>
              <CollapsibleContent className="space-y-6 pt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-gray-700">
                    <span>Creativity level</span>
                    <span>{creativity.toFixed(1)}</span>
                  </div>
                  <Slider
                    min={0.1}
                    max={0.9}
                    step={0.1}
                    value={[creativity]}
                    onValueChange={(val) => setCreativity(val[0] ?? creativity)}
                    disabled={useLiteralPrompt || loading}
                  />
                  {useLiteralPrompt ? (
                    <p className="text-xs text-gray-500">
                      Creativity is locked when using the exact prompt.
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-gray-500">
                        Lower = closer to Brand DNA · Higher = more exploration
                      </p>
                      {enforceBrandDNA && (
                        <p className="text-xs text-gray-400">
                          Brand DNA emphasis auto-balances to {Math.round(brandDNAStrength * 100)}% to complement
                          your {Math.round(creativity * 100)}% creativity.
                        </p>
                      )}
                    </>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Batch size</label>
                  <Slider
                    min={MIN_BATCH_COUNT}
                    max={MAX_BATCH_COUNT}
                    step={1}
                    value={[batchSize]}
                    onValueChange={(val) => {
                      if (!val.length) return;
                      setBatchSize(Math.round(val[0]));
                    }}
                  />
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min={MIN_BATCH_COUNT}
                      max={MAX_BATCH_COUNT}
                      value={batchSize}
                      onChange={(event) => {
                        const parsed = parseInt(event.target.value, 10);
                        if (Number.isNaN(parsed)) {
                          setBatchSize(MIN_BATCH_COUNT);
                          return;
                        }
                        const clamped = Math.max(
                          MIN_BATCH_COUNT,
                          Math.min(MAX_BATCH_COUNT, parsed)
                        );
                        setBatchSize(clamped);
                      }}
                      className="w-24"
                    />
                    <span className="text-xs text-gray-500">images</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">AI provider</label>
                    <Select
                      value={provider}
                      onValueChange={(value) =>
                        setProvider(value as (typeof providerOptions)[number]['id'])
                      }
                    >
                      <SelectTrigger className="h-auto items-start py-2 !justify-start">
                        <div className="flex flex-1 flex-col items-start text-left leading-tight">
                          <span className="text-sm font-medium">
                            {providerDetails?.label ?? 'Choose provider'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {providerDetails?.helper ?? 'Select an AI provider'}
                          </span>
                        </div>
                        <SelectValue
                          placeholder="Choose provider"
                          className="sr-only"
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {providerOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            <div className="flex w-full items-start justify-between gap-3 text-left">
                              <div className="flex flex-col text-left">
                                <span className="text-sm font-medium">{option.label}</span>
                                <span className="text-xs text-gray-500 leading-tight">
                                  {option.helper}
                                </span>
                              </div>
                              <span className="text-xs text-gray-400 whitespace-nowrap">
                                {option.cost}/image
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Generation mode</label>
                    <Select
                      value={generationMode}
                      onValueChange={(value) => setGenerationMode(value as 'focused' | 'capsule')}
                    >
                      <SelectTrigger className="h-auto items-start py-2 !justify-start">
                        <div className="flex flex-1 flex-col items-start text-left leading-tight">
                          <span className="text-sm font-medium">
                            {generationModeDetails.label}
                          </span>
                          <span className="text-xs text-gray-500">
                            {generationModeDetails.helper}
                          </span>
                        </div>
                        <SelectValue
                          placeholder="Generation mode"
                          className="sr-only"
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="focused">
                          <div className="flex w-full flex-col text-left">
                            <span className="text-sm font-medium">Focused Look</span>
                            <span className="text-xs text-gray-500 leading-tight">
                              Variations of aligned images
                            </span>
                          </div>
                        </SelectItem>
                        <SelectItem value="capsule">
                          <div className="flex w-full flex-col text-left">
                            <span className="text-sm font-medium">Capsule</span>
                            <span className="text-xs text-gray-500 leading-tight">
                              Collection of coordinated looks
                            </span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CollapsibleContent>
              </Collapsible>

              <Button
                type="button"
                onClick={() => {
                  if (quickGenerationActive || builderGenerationActive) {
                    return;
                  }
                  openGenerationConfirmation(batchSize, 'builder');
                }}
                disabled={builderGenerationActive || quickGenerationActive}
                aria-disabled={builderGenerationActive || quickGenerationActive}
                className="w-full bg-[#6366f1] text-white hover:bg-[#4f46e5] disabled:opacity-60"
              >
                {builderGenerationActive ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader className="h-4 w-4 animate-spin" />
                    Generating...
                  </span>
                ) : (
                  'Generate Looks →'
                )}
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-gray-900">
                  Recent generations
                </CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  Your latest AI batches at a glance.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentGenerations.length === 0 ? (
                  <div className="rounded-lg border border-gray-200 bg-white p-5 text-center text-sm text-gray-500">
                    Generate a collection to see a running history here.
                  </div>
                ) : (
                  recentGenerations.map((generation) => {
                    const when = formatBatchTimestamp(generation.updatedAt || generation.queuedAt);
                    const statusClass = generation.status === 'completed'
                      ? 'text-emerald-600 border-emerald-300'
                      : generation.status === 'failed'
                        ? 'text-red-600 border-red-300'
                        : 'text-amber-600 border-amber-300';
                    return (
                      <Link
                        key={`${generation.id}`}
                        to="/home"
                        state={{
                          focusCollection: 'User-Generated',
                          highlightPrompt: generation.prompt,
                        }}
                        className="flex items-start justify-between rounded-lg border border-gray-200 p-3 transition-colors duration-200 hover:border-gray-300 hover:bg-gray-50"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-900 line-clamp-2">
                            {generation.prompt}
                          </p>
                          <p className="text-xs text-gray-500">
                            {generation.status === 'queued' || generation.status === 'processing' ? 'Queued' : 'Updated'} {when} · {generation.count} images
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-xs font-normal ${statusClass}`}>
                            {generation.status}
                          </Badge>
                          {generation.brandMatch !== undefined && (
                            <Badge variant="outline" className="text-xs">
                              {Math.round(generation.brandMatch * 100)}% match
                            </Badge>
                          )}
                        </div>
                      </Link>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {voiceQuery && (
              <Card>
                <CardHeader>
                  <CardTitle>Voice command applied</CardTitle>
                  <CardDescription>Enhanced and routed through the voice pipeline.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-gray-600">
                  <div>
                    <p className="font-medium text-gray-900">Command</p>
                    <p>{voiceQuery.displayQuery}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Enhanced prompt</p>
                    <p className="rounded border border-gray-200 bg-gray-50 p-3 font-mono text-xs">
                      {voiceQuery.enhancedPrompt}
                    </p>
                  </div>
                  {voiceQuery.negativePrompt && (
                    <div>
                      <p className="font-medium text-gray-900">Negative prompt</p>
                      <p className="rounded border border-gray-200 bg-gray-50 p-3 font-mono text-xs">
                        {voiceQuery.negativePrompt}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        <section>
          <Card>
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle>Generated designs</CardTitle>
                <CardDescription>Your freshest AI creations.</CardDescription>
              </div>
              {images.length > 0 && (
                <Button variant="outline" size="sm" className="gap-2">
                  <Save className="h-4 w-4" />
                  Export all
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {images.length > 0 ? (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {images.map((image) => (
                    <div key={image.id} className="group">
                      <div className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-gray-100">
                        <img
                          src={image.url}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            const el = e.currentTarget as HTMLImageElement & { dataset?: Record<string, string> };
                            if (el.dataset && el.dataset.fallbackApplied === 'true') return;
                            if (el.dataset) el.dataset.fallbackApplied = 'true';
                            el.src =
                              'data:image/svg+xml;utf8,' +
                              encodeURIComponent(
                                `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200"><rect width="100%" height="100%" fill="#f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-family="system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial" font-size="24">Image unavailable</text></svg>`
                              );
                          }}
                        />
                        {image.brandDNAApplied && image.brandConsistencyScore !== undefined && (
                          <div className="absolute right-2 top-2">
                            <Badge className="backdrop-blur-sm">
                              {Math.round(image.brandConsistencyScore * 100)}% match
                            </Badge>
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/50 group-hover:opacity-100">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="rounded-full bg-white/90 text-gray-900 shadow-sm"
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="rounded-full bg-white/90 text-gray-900 shadow-sm"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-gray-600 line-clamp-2">{image.prompt}</p>
                        {image.isVoiceGenerated && image.enhancedPrompt && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs text-[#6366f1] hover:underline">
                              View enhanced prompt
                            </summary>
                            <p className="mt-2 rounded border border-gray-200 bg-gray-50 p-2 font-mono text-xs text-gray-500">
                              {image.enhancedPrompt}
                            </p>
                          </details>
                        )}
                        {image.brandConsistencyScore !== undefined && (
                          <p className="text-xs text-gray-400">
                            Brand consistency · {Math.round(image.brandConsistencyScore * 100)}%
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-gray-200 py-12 text-center">
                  <Image className="h-12 w-12 text-gray-400" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-900">No designs generated yet</p>
                    <p className="text-sm text-gray-500">
                      Use the prompt builder or quick batches to create your first collection.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
      </div>

      {confirmationDetails && (
        <GenerateConfirmationDialog
          open={Boolean(pendingGeneration)}
          onCancel={closeGenerationConfirmation}
          onConfirm={handleConfirmGeneration}
          loading={loading}
          details={confirmationDetails}
        />
      )}
    </>
  );
};

export default Generation;

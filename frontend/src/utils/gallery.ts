import type { GalleryImage } from '../types/images';

const STRING_KEYS = [
  'name',
  'label',
  'value',
  'title',
  'description',
  'text',
  'detail',
  'material',
  'styleContext',
  'style_context',
  'type',
];

const PLACEHOLDER_VALUES = new Set([
  'unknown',
  'n/a',
  'na',
  'none',
  'unspecified',
  'not specified',
  'not available',
  'pending',
  'tbd',
  'null',
  'undefined',
]);

const PROMPT_PLACEHOLDERS = new Set([
  'based on style profile',
  'prompt unavailable',
  'ai generated design',
  'ai-generated design',
  'generated image',
  'default prompt',
  'auto prompt',
  'style profile prompt',
]);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const PROMPT_WEIGHT_SUFFIX = /\s*[:：]\s*-?\d+(?:\.\d+)?$/;
const INSTRUCTION_PREFIX = /^(?:make|generate|create|show|give)\s+(?:me\s+)?/i;

export const cleanTagText = (value: unknown): string | undefined => {
  if (!isNonEmptyString(value)) return undefined;
  let cleaned = value.replace(PROMPT_WEIGHT_SUFFIX, '').trim();
  if (!cleaned) return undefined;

  cleaned = cleaned.replace(/^["'`]+|["'`]+$/g, '').trim();
  if (!cleaned) return undefined;

  if (INSTRUCTION_PREFIX.test(cleaned)) {
    cleaned = cleaned.replace(INSTRUCTION_PREFIX, '').trim();
  }

  if (
    /^\d+\s+/.test(cleaned) &&
    !/^\d+\/\d/.test(cleaned) &&
    !/\bdeg\b/i.test(cleaned) &&
    !/\bmm\b/i.test(cleaned)
  ) {
    cleaned = cleaned.replace(/^\d+\s+/, '');
  }

  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  if (!cleaned) return undefined;

  const normalized = cleaned.toLowerCase();
  if (PLACEHOLDER_VALUES.has(normalized)) {
    return undefined;
  }

  return cleaned.length > 0 ? cleaned : undefined;
};

const cleanPromptText = (value: unknown): string | undefined => {
  if (!isNonEmptyString(value)) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.toLowerCase();
  if (PROMPT_PLACEHOLDERS.has(normalized)) {
    return undefined;
  }
  return trimmed;
};

const GARMENT_KEYWORDS = [
  'dress',
  'gown',
  'jacket',
  'coat',
  'blazer',
  'suit',
  'skirt',
  'top',
  'pants',
  'trousers',
  'shorts',
  'jeans',
  'outerwear',
  'sweater',
  'cardigan',
  'shirt',
  'blouse',
  'vest',
  'cape',
  'ensemble',
  'jumpsuit',
  'bodysuit',
  'tunic',
  'poncho',
  'overcoat',
  'kimono',
  'hoodie',
  'sweatshirt',
  'trench',
  'parka',
  'coatdress'
];

const COLOR_KEYWORDS = [
  'black',
  'white',
  'gray',
  'grey',
  'cream',
  'beige',
  'ivory',
  'red',
  'scarlet',
  'maroon',
  'crimson',
  'burgundy',
  'wine',
  'pink',
  'blush',
  'magenta',
  'fuchsia',
  'salmon',
  'orange',
  'terracotta',
  'coral',
  'amber',
  'peach',
  'yellow',
  'gold',
  'mustard',
  'chartreuse',
  'green',
  'forest',
  'emerald',
  'jade',
  'olive',
  'sage',
  'mint',
  'teal',
  'aqua',
  'turquoise',
  'cyan',
  'blue',
  'navy',
  'cobalt',
  'cerulean',
  'indigo',
  'denim',
  'purple',
  'violet',
  'lavender',
  'lilac',
  'plum',
  'mauve',
  'brown',
  'tan',
  'taupe',
  'chocolate',
  'copper',
  'bronze',
  'rust',
  'ochre',
  'sand',
  'khaki',
  'silver',
  'pearl',
  'charcoal',
  'graphite',
  'gunmetal',
  'smoke',
  'midnight',
  'neon',
  'pastel',
  'neutral',
  'neutrals'
];

const STYLE_EXCLUDE_KEYWORDS = [
  'model',
  'camera',
  'shot',
  'lighting',
  'light',
  'shadow',
  'pose',
  'posed',
  'posing',
  'studio',
  'detail',
  'details',
  'collar',
  'lapel',
  'lapels',
  'neckline',
  'hem',
  'seam',
  'seams',
  'stitch',
  'stitching',
  'button',
  'buttons',
  'zip',
  'zipper',
  'pocket',
  'pockets',
  'silhouette',
  'fabric',
  'texture',
  'trim',
  'notch',
  'hardware',
  'render',
  'rendered',
  'close-up',
  'three-quarter',
  'profile',
  'back view',
  'front view',
  'waistline',
  'shoulder'
];

type PromptGroupMetadata = {
  id?: string;
  index?: number;
  count?: number;
  prompt?: string;
};

type NormalizedMetadata = {
  garmentType?: string;
  silhouette?: string;
  colors?: string[];
  texture?: string;
  fabric?: string;
  styleTags?: string[];
  lighting?: string;
  generatedAt?: string;
  model?: string;
  confidence?: number;
  details?: string;
  shot?: string;
  generationId?: string;
  promptId?: string;
  generationMethod?: string;
  spec?: unknown;
  promptGroup?: PromptGroupMetadata;
} & Record<string, unknown>;

const toOptionalString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
};

const parseNumeric = (value: unknown): number | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const extractPromptGroup = (
  source: unknown
): { id?: string; index?: number; count?: number; prompt?: string } | undefined => {
  if (!source) return undefined;
  if (typeof source === 'string') {
    const prompt = source.trim();
    return prompt ? { prompt } : undefined;
  }
  if (typeof source !== 'object') return undefined;

  const data = source as Record<string, unknown>;
  const id = toOptionalString(
    data.id ??
      data.groupId ??
      data.group_id ??
      data.promptGroupId ??
      data.prompt_group_id ??
      data.prompt_groupId
  );
  const index = parseNumeric(
    data.index ??
      data.position ??
      data.groupIndex ??
      data.promptGroupIndex ??
      data.prompt_group_index
  );
  const count = parseNumeric(
    data.count ??
      data.size ??
      data.total ??
      data.groupSize ??
      data.promptGroupCount ??
      data.prompt_group_count
  );
  const prompt =
    typeof data.prompt === 'string'
      ? data.prompt
      : typeof data.text === 'string'
        ? data.text
        : typeof data.label === 'string'
          ? data.label
          : typeof data.title === 'string'
            ? data.title
            : undefined;

  const result: { id?: string; index?: number; count?: number; prompt?: string } = {};
  if (id) result.id = id;
  if (index !== undefined) result.index = index;
  if (count !== undefined) result.count = count;
  if (prompt && prompt.trim()) result.prompt = prompt.trim();

  return Object.keys(result).length > 0 ? result : undefined;
};

export const looksLikeGarment = (value: string) => {
  const normalized = value.toLowerCase();
  return GARMENT_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

export const looksLikeColor = (value: string) => {
  const normalized = value.toLowerCase();
  return (
    COLOR_KEYWORDS.some((keyword) => normalized.includes(keyword)) ||
    /#[0-9a-f]{3,8}\b/i.test(normalized)
  );
};

const looksLikeStyle = (value: string) => {
  const normalized = value.toLowerCase();
  if (looksLikeGarment(normalized) || looksLikeColor(normalized)) return false;
  return !STYLE_EXCLUDE_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

const extractColorWord = (value: string): string | undefined => {
  const normalized = value.toLowerCase();
  for (const keyword of COLOR_KEYWORDS) {
    if (normalized.includes(keyword)) {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = value.match(new RegExp(`\\b${escaped}\\b`, 'i'));
      return cleanTagText(match ? match[0] : keyword);
    }
  }
  const hexMatch = value.match(/(#[0-9a-f]{3,8})/i);
  return cleanTagText(hexMatch ? hexMatch[1] : undefined);
};

const collectStringValues = (input: unknown, bucket: Set<string>) => {
  if (!input) return;
  if (Array.isArray(input)) {
    input.forEach((item) => collectStringValues(item, bucket));
    return;
  }
  if (typeof input === 'string') {
    const cleaned = cleanTagText(input);
    if (cleaned) bucket.add(cleaned);
    return;
  }
  if (typeof input === 'object') {
    const record = input as Record<string, unknown>;
    STRING_KEYS.forEach((key) => {
      if (record[key] !== undefined) {
        collectStringValues(record[key], bucket);
      }
    });
  }
};

const toUniqueStringArray = (input: unknown): string[] => {
  const bucket = new Set<string>();
  collectStringValues(input, bucket);
  return Array.from(bucket);
};

const extractTagsFromPrompt = (prompt?: string): string[] => {
  if (!prompt || typeof prompt !== 'string') return [];
  const tokens = prompt
    .replace(/[\[\]]/g, ' ')
    .replace(/\[[^\]]+?\]/g, (match) => {
      const inner = match.slice(1, -1);
      const colonIndex = inner.lastIndexOf(':');
      if (colonIndex > -1) {
        return inner.slice(0, colonIndex);
      }
      return inner;
    })
    .split(/[,/\n]/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const unique = new Set<string>();
  tokens.forEach((token) => {
    const cleaned = token
      .replace(/^[0-9.]+$/g, '')
      .replace(/^(in|with|and|the|for|from|into|over|under|onto|at|by|of)$/i, '')
      .trim();
    if (cleaned && cleaned.length > 2) {
      const normalized = cleanTagText(cleaned);
      if (normalized) {
        unique.add(normalized);
      }
    }
  });

  return Array.from(unique).slice(0, 12);
};

const pickFirstString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (!value) continue;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    } else if (Array.isArray(value)) {
      for (const entry of value) {
        const resolved = pickFirstString(entry);
        if (resolved) return resolved;
      }
    } else if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const resolved = pickFirstString(
        record.name,
        record.label,
        record.value,
        record.title,
        record.description,
        record.text,
        record.type
      );
      if (resolved) return resolved;
    }
  }
  return undefined;
};

const extractStyleTags = (source: any): string[] =>
  toUniqueStringArray([
    source?.styleTags,
    source?.style_tags,
    source?.signature_styles,
    source?.styleContext,
    source?.aesthetic,
    source?.aestheticThemes,
    source?.signatureAesthetic,
  ]);

export const normalizeGalleryImage = (raw: any): GalleryImage | null => {
  if (!raw || !raw.url) return null;

  const timestampSource = raw.timestamp || raw.created_at || raw.createdAt;
  const timestamp = timestampSource ? new Date(timestampSource) : new Date();
  const archivedRaw = raw.archived ?? raw.archived_state ?? raw.is_archived;
  let archived: boolean | undefined;

  if (archivedRaw !== undefined && archivedRaw !== null) {
    if (typeof archivedRaw === 'string') {
      const normalized = archivedRaw.toLowerCase();
      archived = normalized === 'true' || normalized === '1';
    } else {
      archived = Boolean(archivedRaw);
    }
  }

  const archivedAtSource = raw.archivedAt || raw.archived_at;
  const archivedAt =
    archivedAtSource !== undefined && archivedAtSource !== null
      ? new Date(archivedAtSource)
      : undefined;

  const metadataSource = raw.metadata || {};
  const colors = toUniqueStringArray([
    metadataSource.colors,
    metadataSource.colorPalette,
    metadataSource.color_palette,
    metadataSource.palette,
    metadataSource.signature_colors,
    metadataSource.signatureColors,
  ]);
  const styleTags = extractStyleTags(metadataSource);
  const fabric =
    (typeof metadataSource.fabric === 'string' && metadataSource.fabric) ||
    (metadataSource.fabric && metadataSource.fabric.material) ||
    metadataSource.material ||
    undefined;

  const metadata: NormalizedMetadata = {
    garmentType:
      metadataSource.garmentType ||
      metadataSource.garment_type ||
      metadataSource.garment ||
      metadataSource.primary_garment ||
      undefined,
    silhouette:
      metadataSource.silhouette ||
      metadataSource.silhouette_type ||
      metadataSource.garment?.silhouette,
    colors,
    texture: metadataSource.texture || fabric,
    lighting: metadataSource.lighting,
    generatedAt: metadataSource.generatedAt || metadataSource.generated_at,
    model: metadataSource.model,
    confidence: metadataSource.confidence,
    styleTags,
    fabric,
    details:
      metadataSource.details ||
      metadataSource.detailing ||
      metadataSource.signatureDetails ||
      metadataSource.designDetails,
    shot:
      metadataSource.shot ||
      metadataSource.shotStyle ||
      metadataSource.camera?.style ||
      metadataSource.camera?.angle ||
      metadataSource.photography?.style,
    generationId: metadataSource.generationId,
    promptId: metadataSource.promptId || metadataSource.prompt_id,
    generationMethod:
      metadataSource.generationMethod ||
      metadataSource.generation_method ||
      raw.generationMethod ||
      raw.generation_method ||
      (raw.source === 'voice_command' ? 'voice_command' : undefined),
    spec: metadataSource.spec || metadataSource.promptSpec || metadataSource.json_spec,
  };

  let spec = metadata.spec;
  if (typeof spec === 'string') {
    try {
      spec = JSON.parse(spec);
      metadata.spec = spec;
    } catch (error) {
      spec = undefined;
    }
  }

  if (spec && typeof spec === 'object') {
    const selection = spec.thompson_selection || spec.selection;
    if (selection) {
      metadata.garmentType =
        metadata.garmentType ||
        pickFirstString(selection.garment?.type, selection.garment?.name, selection.garment);
      metadata.silhouette =
        metadata.silhouette || pickFirstString(selection.garment?.silhouette);
      metadata.fabric =
        metadata.fabric || pickFirstString(selection.fabric?.material, selection.fabric?.name);
      if (!metadata.details) {
        metadata.details = pickFirstString(selection.construction) || metadata.details;
      }
      if ((!metadata.colors || metadata.colors.length === 0) && selection.colors) {
        metadata.colors = toUniqueStringArray(selection.colors);
      }
      if (
        (!metadata.styleTags || metadata.styleTags.length === 0) &&
        selection.styleContext
      ) {
        metadata.styleTags = [selection.styleContext];
      }
    }

    if ((!metadata.colors || metadata.colors.length === 0) && spec.palette) {
      metadata.colors = toUniqueStringArray(spec.palette);
    }
  }

  const selection =
    (metadata.spec && typeof metadata.spec === 'object'
      ? (metadata.spec as Record<string, unknown>).thompson_selection ||
        (metadata.spec as Record<string, unknown>).selection
      : undefined) || undefined;
  const selectionPrompt = selection
    ? pickFirstString(
        (selection as Record<string, unknown>).prompt,
        (selection as Record<string, unknown>).description,
        (selection as Record<string, unknown>).text
      )
    : undefined;

  const rawPromptCandidates: Array<unknown> = [
    raw.prompt,
    raw.prompt_text,
    raw.promptText,
    raw.text,
    raw.positive_prompt,
    raw.displayPrompt,
    raw.display_prompt,
    raw.summaryPrompt,
    raw.summary_prompt,
    raw.description,
    raw.renderedPrompt,
    raw.finalPrompt,
    raw.promptRendered,
    raw.promptFinal,
    raw.promptPositive,
    metadataSource.prompt,
    metadataSource.prompt_text,
    metadataSource.promptText,
    metadataSource.positive_prompt,
    metadataSource.renderedPrompt,
    metadataSource.finalPrompt,
    metadataSource.description,
    metadataSource.summary,
    metadataSource.promptSummary,
    spec && typeof spec === 'object' ? (spec as Record<string, unknown>).finalPrompt : undefined,
    spec && typeof spec === 'object' ? (spec as Record<string, unknown>).prompt : undefined,
    spec && typeof spec === 'object' ? (spec as Record<string, unknown>).positive_prompt : undefined,
    spec && typeof spec === 'object' ? (spec as Record<string, unknown>).positivePrompt : undefined,
    spec && typeof spec === 'object' ? (spec as Record<string, unknown>).rendered_prompt : undefined,
    spec && typeof spec === 'object' ? (spec as Record<string, unknown>).renderedPrompt : undefined,
    spec && typeof spec === 'object' ? (spec as Record<string, unknown>).displayPrompt : undefined,
    raw.promptMetadata?.prompt,
    raw.promptMetadata?.promptText,
    raw.promptMetadata?.positive_prompt,
    raw.promptMetadata?.renderedPrompt,
    raw.promptMetadata?.finalPrompt,
    raw.promptMetadata?.displayPrompt,
    raw.prompt_metadata?.prompt,
    raw.prompt_metadata?.promptText,
    raw.prompt_metadata?.positive_prompt,
    raw.prompt_metadata?.renderedPrompt,
    raw.prompt_metadata?.finalPrompt,
    raw.prompt_metadata?.displayPrompt,
    raw.promptSpec?.prompt,
    raw.promptSpec?.promptText,
    raw.promptSpec?.rendered_prompt,
    raw.promptSpec?.renderedPrompt,
    raw.promptSpec?.finalPrompt,
    raw.promptSpec?.positive_prompt,
    raw.prompt_spec?.prompt,
    raw.prompt_spec?.promptText,
    raw.prompt_spec?.rendered_prompt,
    raw.prompt_spec?.renderedPrompt,
    raw.prompt_spec?.finalPrompt,
    raw.prompt_spec?.positive_prompt,
    raw.json_spec?.prompt,
    raw.json_spec?.rendered_prompt,
    raw.json_spec?.renderedPrompt,
    raw.json_spec?.finalPrompt,
    raw.json_spec?.positive_prompt,
    raw.metadata?.prompt,
    raw.metadata?.renderedPrompt,
    raw.metadata?.finalPrompt,
    raw.metadata?.promptText,
    raw.metadata?.positive_prompt,
    metadata.promptGroup?.prompt,
    selectionPrompt,
  ];

  let resolvedPrompt: string | undefined;
  for (const candidate of rawPromptCandidates) {
    const cleanedCandidate = cleanPromptText(candidate);
    if (cleanedCandidate) {
      resolvedPrompt = cleanedCandidate;
      break;
    }
  }
  if (!resolvedPrompt) {
    resolvedPrompt = 'AI generated design';
  }

  const applyCleanedMetadata = (
    key: keyof NormalizedMetadata,
    cleaner: (value: unknown) => string | undefined
  ) => {
    const value = metadata[key];
    if (!value) return;
    const cleaned = cleaner(value);
    if (cleaned) {
      metadata[key] = cleaned;
    } else {
      delete metadata[key];
    }
  };

  applyCleanedMetadata('garmentType', cleanTagText);
  applyCleanedMetadata('silhouette', cleanTagText);
  applyCleanedMetadata('fabric', cleanTagText);
  applyCleanedMetadata('texture', cleanTagText);
  applyCleanedMetadata('details', cleanTagText);
  applyCleanedMetadata('shot', cleanTagText);
  applyCleanedMetadata('lighting', cleanTagText);

  const promptGroupAccumulator: {
    id?: string;
    index?: number;
    count?: number;
    prompt?: string;
  } = {};

  const applyGroup = (value: unknown) => {
    const extracted = extractPromptGroup(value);
    if (!extracted) return;
    if (extracted.id && !promptGroupAccumulator.id) {
      promptGroupAccumulator.id = extracted.id;
    }
    if (extracted.index !== undefined && promptGroupAccumulator.index === undefined) {
      promptGroupAccumulator.index = extracted.index;
    }
    if (extracted.count !== undefined && promptGroupAccumulator.count === undefined) {
      promptGroupAccumulator.count = extracted.count;
    }
    if (extracted.prompt && !promptGroupAccumulator.prompt) {
      promptGroupAccumulator.prompt = extracted.prompt;
    }
  };

  applyGroup(metadataSource.promptGroup);
  applyGroup(metadataSource.prompt_group);
  applyGroup(metadataSource.promptGroupInfo);
  applyGroup(metadataSource.prompt_group_info);
  applyGroup(raw.promptGroup);
  applyGroup(raw.prompt_group);
  applyGroup(raw.group);
  applyGroup(metadata.promptGroup);

  const directGroupId = toOptionalString(
    raw.groupId ??
      raw.group_id ??
      raw.promptGroupId ??
      raw.prompt_group_id ??
      raw.prompt_groupId
  );
  if (directGroupId && !promptGroupAccumulator.id) {
    promptGroupAccumulator.id = directGroupId;
  }

  const directGroupIndex = parseNumeric(
    raw.groupIndex ??
      raw.group_index ??
      raw.promptGroupIndex ??
      raw.prompt_group_index
  );
  if (directGroupIndex !== undefined && promptGroupAccumulator.index === undefined) {
    promptGroupAccumulator.index = directGroupIndex;
  }

  const directGroupCount = parseNumeric(
    raw.groupSize ??
      raw.group_size ??
      raw.promptGroupCount ??
      raw.prompt_group_count
  );
  if (directGroupCount !== undefined && promptGroupAccumulator.count === undefined) {
    promptGroupAccumulator.count = directGroupCount;
  }

  if (
    !promptGroupAccumulator.prompt &&
    typeof raw.groupPrompt === 'string' &&
    raw.groupPrompt.trim()
  ) {
    promptGroupAccumulator.prompt = raw.groupPrompt.trim();
  }

  if (
    promptGroupAccumulator.id ||
    promptGroupAccumulator.index !== undefined ||
    promptGroupAccumulator.count !== undefined ||
    promptGroupAccumulator.prompt
  ) {
    metadata.promptGroup = {
      ...(promptGroupAccumulator.id ? { id: promptGroupAccumulator.id } : {}),
      ...(promptGroupAccumulator.index !== undefined
        ? { index: promptGroupAccumulator.index }
        : {}),
      ...(promptGroupAccumulator.count !== undefined
        ? { count: promptGroupAccumulator.count }
        : {}),
      ...(promptGroupAccumulator.prompt ? { prompt: promptGroupAccumulator.prompt } : {}),
    };
  }

  const sanitizedStyleTags = (metadata.styleTags || [])
    .map((tag) => cleanTagText(tag))
    .filter(isNonEmptyString);
  metadata.styleTags = sanitizedStyleTags.length > 0 ? sanitizedStyleTags : undefined;

  const sanitizedColors = (metadata.colors || [])
    .map((color) => cleanTagText(color))
    .filter(isNonEmptyString);
  metadata.colors = sanitizedColors.length > 0 ? sanitizedColors : undefined;

  const rawTagStrings = (Array.isArray(raw.tags) ? raw.tags : [])
    .map((tag) => cleanTagText(tag))
    .filter(isNonEmptyString);

  const usedTags = new Set<string>();
  const orderedTags: string[] = [];
  const tryAddTag = (value?: string) => {
    const cleaned = cleanTagText(value);
    if (!cleaned) return;
    const key = cleaned.toLowerCase();
    if (usedTags.has(key)) return;
    usedTags.add(key);
    orderedTags.push(cleaned);
  };

  const styleCandidates = [
    ...(metadata.styleTags || []),
    ...rawTagStrings,
  ];
  const styleTag = styleCandidates.find((tag) => looksLikeStyle(tag));
  if (styleTag) {
    tryAddTag(styleTag);
  } else if (styleCandidates.length > 0) {
    tryAddTag(styleCandidates[0]);
  }

  const garmentCandidates = [
    ...(metadata.garmentType ? [metadata.garmentType] : []),
    ...rawTagStrings,
  ];
  const garmentTag = garmentCandidates.find(
    (tag) => !usedTags.has(tag.toLowerCase()) && looksLikeGarment(tag)
  );
  if (garmentTag) {
    tryAddTag(garmentTag);
  } else if (metadata.garmentType) {
    tryAddTag(metadata.garmentType);
  }

  const colorCandidates = [
    ...(metadata.colors || []),
    ...rawTagStrings,
  ];

  let colorTag = colorCandidates.find(
    (tag) => !usedTags.has(tag.toLowerCase()) && looksLikeColor(tag)
  );

  if (!colorTag) {
    colorTag = colorCandidates
      .map((tag) => (tag ? extractColorWord(tag) : undefined))
      .find((candidate) => candidate && !usedTags.has(candidate.toLowerCase()));
  }

  if (colorTag) {
    tryAddTag(colorTag);
  }

  let tags = orderedTags;

  if (tags.length === 0) {
    tags = extractTagsFromPrompt(
      raw.prompt || raw.prompt_text || raw.promptText || metadataSource.prompt
    );
  }

  const origin: GalleryImage['origin'] =
    raw.origin ||
    raw.source ||
    (metadata.generatedAt ? 'user' : undefined) ||
    (raw.generatedBy === 'user'
      ? 'user'
      : raw.generatedBy === 'system'
        ? 'system'
        : undefined);

  const lastInteractedSource =
    raw.lastInteractedAt ||
    raw.last_interacted_at ||
      raw.lastViewedAt ||
      raw.last_viewed_at;
  const lastInteractedAt = lastInteractedSource
    ? new Date(lastInteractedSource)
    : undefined;
  const normalized: GalleryImage = {
    id: raw.id || raw.image_id || `img-${Date.now()}-${Math.random()}`,
    url: raw.url,
    prompt: resolvedPrompt,
    timestamp,
    origin,
    lastInteractedAt,
    metadata,
    tags,
    liked: Boolean(raw.liked),
  };

  const normalizedGroupId = metadata.promptGroup?.id;
  const normalizedGroupIndex =
    metadata.promptGroup?.index !== undefined ? metadata.promptGroup.index : undefined;
  const normalizedGroupCount =
    metadata.promptGroup?.count !== undefined ? metadata.promptGroup.count : undefined;

  if (normalizedGroupId) {
    normalized.groupId = normalizedGroupId;
  }
  if (normalizedGroupIndex !== undefined) {
    normalized.groupIndex = normalizedGroupIndex;
  }
  if (normalizedGroupCount !== undefined) {
    normalized.groupSize = normalizedGroupCount;
  }

  if (archived !== undefined) {
    normalized.archived = archived;
  }

  if (archivedAt && !Number.isNaN(archivedAt.getTime())) {
    normalized.archivedAt = archivedAt;
  }

  return normalized;
};

export const serializeGalleryImage = (image: GalleryImage) => ({
  ...image,
  timestamp:
    image.timestamp instanceof Date ? image.timestamp.toISOString() : image.timestamp,
  lastInteractedAt:
    image.lastInteractedAt instanceof Date
      ? image.lastInteractedAt.toISOString()
      : image.lastInteractedAt,
  archivedAt:
    image.archivedAt instanceof Date
      ? image.archivedAt.toISOString()
      : image.archivedAt,
});

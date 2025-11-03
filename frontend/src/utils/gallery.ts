import type { GalleryImage } from '../types/images';

const STRING_KEYS = ['name', 'label', 'value', 'title', 'description', 'text', 'detail', 'material', 'styleContext', 'style_context', 'type'];

const collectStringValues = (input: unknown, bucket: Set<string>) => {
  if (!input) return;
  if (Array.isArray(input)) {
    input.forEach((item) => collectStringValues(item, bucket));
    return;
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed) bucket.add(trimmed);
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
      unique.add(cleaned);
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

  const metadata: GalleryImage['metadata'] = {
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

  const tagCandidates = [
    metadata.garmentType,
    metadata.silhouette,
    metadata.fabric,
    metadata.shot,
    metadata.details,
    ...(metadata.styleTags || []),
    ...(metadata.colors || []),
  ];

  let tags = Array.isArray(raw.tags) && raw.tags.length > 0
    ? raw.tags
    : Array.from(new Set(tagCandidates.filter(Boolean) as string[]));

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

  return {
    id: raw.id || raw.image_id || `img-${Date.now()}-${Math.random()}`,
    url: raw.url,
    prompt: raw.prompt || raw.promptText || raw.prompt_text || 'AI generated design',
    timestamp,
    origin,
    lastInteractedAt,
    metadata,
    tags,
    liked: Boolean(raw.liked),
  };
};

export const serializeGalleryImage = (image: GalleryImage) => ({
  ...image,
  timestamp: image.timestamp.toISOString(),
  lastInteractedAt: image.lastInteractedAt
    ? image.lastInteractedAt.toISOString()
    : undefined,
});

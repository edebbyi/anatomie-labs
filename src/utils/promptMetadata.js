const { deriveConsistentTags } = require('../services/taggingAgent');

const normalizeColorEntry = (entry) => {
  if (!entry) return null;
  if (typeof entry === 'string') return entry;
  return entry.name || entry.label || entry.value || null;
};

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

const collectStringValues = (input, bucket) => {
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
    const record = input;
    STRING_KEYS.forEach((key) => {
      if (record && record[key] !== undefined) {
        collectStringValues(record[key], bucket);
      }
    });
  }
};

const toUniqueStringArray = (input) => {
  const bucket = new Set();
  collectStringValues(input, bucket);
  return Array.from(bucket);
};

const pickFirstString = (...values) => {
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
      const record = value;
      const resolved = pickFirstString(
        record?.name,
        record?.label,
        record?.value,
        record?.title,
        record?.description,
        record?.text,
        record?.type
      );
      if (resolved) return resolved;
    }
  }
  return undefined;
};

const extractMetadataFromPromptSpec = (spec) => {
  if (!spec) return {};

  let jsonSpec = spec;
  if (typeof spec === 'string') {
    try {
      jsonSpec = JSON.parse(spec);
    } catch (error) {
      return {};
    }
  }

  const metadata = {};
  const selection = jsonSpec?.thompson_selection || jsonSpec?.selection;

  if (selection) {
    const { colors, garment, fabric, styleContext } = selection;

    if (Array.isArray(colors)) {
      metadata.colors = colors.map(normalizeColorEntry).filter(Boolean);
    }

    if (garment) {
      if (typeof garment === 'string') {
        metadata.garmentType = garment;
      } else {
        metadata.garmentType = garment.type || garment.name;
        if (garment.silhouette) {
          metadata.silhouette = garment.silhouette;
        }
      }
    }

    if (fabric) {
      if (typeof fabric === 'string') {
        metadata.fabric = fabric;
      } else {
        metadata.fabric = fabric.material || fabric.name;
        if (fabric.texture) {
          metadata.texture = fabric.texture;
        }
      }
    }

    if (styleContext) {
      metadata.styleTags = [styleContext];
    }
  }

  if (jsonSpec?.palette && Array.isArray(jsonSpec.palette)) {
    const paletteColors = jsonSpec.palette.map(normalizeColorEntry).filter(Boolean);
    metadata.colors = (metadata.colors || []).concat(paletteColors);
  }

  return metadata;
};

const normalizePromptMetadata = (input = {}) => {
  const metadata = {};

  let spec = input;
  if (input && typeof input === 'object') {
    spec = input.spec || input.promptSpec || input.json_spec || spec;
  }
  if (typeof spec === 'string') {
    try {
      spec = JSON.parse(spec);
    } catch (error) {
      spec = undefined;
    }
  }

  const baseMetadata = extractMetadataFromPromptSpec(spec);
  Object.assign(metadata, baseMetadata);

  const selection = spec && typeof spec === 'object' ? spec.thompson_selection || spec.selection : null;

  metadata.garmentType = metadata.garmentType || pickFirstString(
    input.garmentType,
    input.garment_type,
    input.garment?.type,
    input.garment?.name,
    selection?.garment?.type,
    selection?.garment?.name,
    selection?.garment
  );

  metadata.silhouette = metadata.silhouette || pickFirstString(
    input.silhouette,
    input.silhouette_type,
    input.garment?.silhouette,
    selection?.garment?.silhouette
  );

  metadata.fabric = metadata.fabric || pickFirstString(
    input.fabric,
    input.fabric?.material,
    input.material,
    selection?.fabric?.material,
    selection?.fabric
  );

  metadata.details = metadata.details || pickFirstString(
    input.details,
    input.detailing,
    input.signatureDetails,
    selection?.construction
  );

  metadata.shot = metadata.shot || pickFirstString(
    input.shot,
    input.shotStyle,
    input.camera?.style,
    input.camera?.angle,
    input.photography?.style,
    selection?.shot,
    selection?.camera?.style,
    selection?.camera?.angle
  );

  const colors = new Set(metadata.colors || []);
  toUniqueStringArray(input.colors).forEach((color) => colors.add(color));
  toUniqueStringArray(selection?.colors).forEach((color) => colors.add(color));
  toUniqueStringArray(spec?.palette).forEach((color) => colors.add(color));
  metadata.colors = Array.from(colors);

  const styleTags = new Set(metadata.styleTags || []);
  toUniqueStringArray(input.styleTags || input.style_tags).forEach((tag) => styleTags.add(tag));
  if (selection?.styleContext) {
    styleTags.add(selection.styleContext);
  }
  metadata.styleTags = Array.from(styleTags);

  metadata.spec = spec || input.spec || input.json_spec || input.promptSpec || null;
  metadata.texture = metadata.texture || pickFirstString(input.texture, input.fabric?.texture);
  metadata.generatedAt = metadata.generatedAt || input.generatedAt || input.generated_at;
  metadata.promptId = metadata.promptId || input.promptId || input.prompt_id;
  metadata.generationId = metadata.generationId || input.generationId;

  const tagSet = new Set();
  [metadata.garmentType, metadata.silhouette, metadata.fabric, metadata.shot, metadata.details]
    .filter((value) => typeof value === 'string' && value.trim())
    .forEach((value) => tagSet.add(value.trim()));

  (metadata.colors || []).forEach((color) => tagSet.add(color));
  (metadata.styleTags || []).forEach((tag) => tagSet.add(tag));
  toUniqueStringArray(selection?.construction).forEach((entry) => tagSet.add(entry));

  const candidateTags = Array.from(tagSet).filter(Boolean);
  const rawTags = Array.isArray(input.tags) ? input.tags : [];

  const taggingResult = deriveConsistentTags({
    metadata,
    rawTags: candidateTags.concat(rawTags),
    prompt:
      input.prompt ||
      input.prompt_text ||
      input.promptText ||
      (typeof spec === 'object' ? spec?.promptText || spec?.mainPrompt : undefined),
  });

  if (taggingResult.style && !metadata.styleTag) {
    metadata.styleTag = taggingResult.style;
  }
  if (taggingResult.garment && !metadata.garmentTag) {
    metadata.garmentTag = taggingResult.garment;
  }
  if (taggingResult.color && !metadata.primaryColor) {
    metadata.primaryColor = taggingResult.color;
  }

  const normalizedTags = taggingResult.tags.length > 0 ? taggingResult.tags : candidateTags;

  return {
    metadata,
    tags: normalizedTags,
  };
};

module.exports = {
  extractMetadataFromPromptSpec,
  normalizePromptMetadata,
};

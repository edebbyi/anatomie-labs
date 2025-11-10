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
  'hardware',
  'render',
  'rendered',
  'close-up',
  'three-quarter',
  'profile',
  'back view',
  'front view',
  'waistline',
  'shoulder',
  'notch',
  'camera-facing'
];

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
  'coatdress',
  'kaftan',
  'romper',
  'midi',
  'maxi',
  'mini dress',
  'blouson',
  'windbreaker',
  'peacoat'
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
  'neutrals',
  'multicolor'
];

const APPLY_TRIM_REGEX = /\s*:\s*-?\d+(?:\.\d+)?$/g;

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const cleanTagText = (value) => {
  if (!isNonEmptyString(value)) return undefined;
  const trimmed = value.trim();
  const withoutWeights = trimmed.replace(APPLY_TRIM_REGEX, '').trim();
  return withoutWeights || undefined;
};

const normalizeToArray = (value) => {
  if (!value && value !== 0) return [];

  const bucket = [];
  const addValue = (entry) => {
    const cleaned = cleanTagText(entry);
    if (cleaned) bucket.push(cleaned);
  };

  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (Array.isArray(item) || (item && typeof item === 'object')) {
        bucket.push(...normalizeToArray(item));
      } else {
        addValue(item);
      }
    });
    return bucket;
  }

  if (value && typeof value === 'object') {
    Object.values(value).forEach((entry) => {
      bucket.push(...normalizeToArray(entry));
    });
    return bucket;
  }

  addValue(value);
  return bucket;
};

const looksLikeGarment = (value) => {
  if (!isNonEmptyString(value)) return false;
  const normalized = value.toLowerCase();
  return GARMENT_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

const looksLikeColor = (value) => {
  if (!isNonEmptyString(value)) return false;
  const normalized = value.toLowerCase();
  return (
    COLOR_KEYWORDS.some((keyword) => normalized.includes(keyword)) ||
    /#[0-9a-f]{3,8}\b/i.test(normalized) ||
    normalized.endsWith(' palette')
  );
};

const looksLikeStyle = (value) => {
  if (!isNonEmptyString(value)) return false;
  const normalized = value.toLowerCase();
  if (looksLikeGarment(normalized) || looksLikeColor(normalized)) return false;
  return !STYLE_EXCLUDE_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const extractColorWord = (value) => {
  if (!isNonEmptyString(value)) return undefined;
  const normalized = value.toLowerCase();
  for (const keyword of COLOR_KEYWORDS) {
    if (normalized.includes(keyword)) {
      const match = value.match(new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i'));
      return cleanTagText(match ? match[0] : keyword);
    }
  }

  const hexMatch = value.match(/(#[0-9a-f]{3,8})/i);
  if (hexMatch) return cleanTagText(hexMatch[1]);

  return undefined;
};

const extractTagsFromPrompt = (prompt) => {
  if (!isNonEmptyString(prompt)) return [];
  const withoutBrackets = prompt
    .replace(/\[[^\]]+?\]/g, (match) => {
      const inner = match.slice(1, -1);
      const colonIndex = inner.lastIndexOf(':');
      return colonIndex > -1 ? inner.slice(0, colonIndex) : inner;
    })
    .replace(/[\[\]]/g, ' ');

  const tokens = withoutBrackets
    .split(/[,/\n]/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const unique = new Set();
  tokens.forEach((token) => {
    const cleaned = token
      .replace(/^[0-9.]+$/g, '')
      .replace(/^(in|with|and|the|for|from|into|over|under|onto|at|by|of)$/i, '')
      .trim();
    if (cleaned.length > 2) unique.add(cleaned);
  });

  return Array.from(unique);
};

const getValueAtPath = (source, path) => {
  if (!source) return undefined;
  const segments = Array.isArray(path) ? path : String(path).split('.');
  let current = source;
  for (const segment of segments) {
    if (!current || typeof current !== 'object') return undefined;
    current = current[segment];
  }
  return current;
};

const buildCandidateList = (source, paths) => {
  const ordered = [];
  const seen = new Set();

  paths.forEach((path) => {
    const value = getValueAtPath(source, path);
    normalizeToArray(value).forEach((entry) => {
      const key = entry.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        ordered.push(entry);
      }
    });
  });

  return ordered;
};

const STYLE_PATHS = [
  'styleTags',
  'style_tags',
  'styleContext',
  'style_context',
  'signature_styles',
  'signatureStyles',
  'signatureAesthetic',
  'aesthetic',
  'aestheticTheme',
  'aestheticThemes',
  'style.aesthetic',
  'style.overall',
  'style.vibe',
  'style.profile',
  'profile.style',
  'promptMetadata.styleTags',
  'promptMetadata.aesthetic',
  'metadata.styleTags'
];

const GARMENT_PATHS = [
  'garmentType',
  'garment_type',
  'primary_garment',
  'garment',
  'garment.name',
  'garment.type',
  'promptMetadata.garment.type',
  'promptMetadata.garment.name',
  'promptMetadata.garmentType',
  'styleProfile.topGarment',
  'styleProfile.topGarments'
];

const COLOR_PATHS = [
  'colors',
  'colorPalette',
  'color_palette',
  'palette',
  'signature_colors',
  'signatureColors',
  'promptMetadata.colors',
  'promptMetadata.palette',
  'promptMetadata.signature_colors'
];

const dedupePreserve = (input) => {
  const seen = new Set();
  const ordered = [];
  input.forEach((entry) => {
    const key = entry.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      ordered.push(entry);
    }
  });
  return ordered;
};

const deriveConsistentTags = ({ metadata = {}, rawTags = [], prompt }) => {
  const cleanedRawTags = normalizeToArray(rawTags);

  const styleCandidates = dedupePreserve([
    ...buildCandidateList(metadata, STYLE_PATHS),
    ...cleanedRawTags,
  ]);

  const garmentCandidates = dedupePreserve([
    ...buildCandidateList(metadata, GARMENT_PATHS),
    ...cleanedRawTags,
  ]);

  const colorCandidates = dedupePreserve([
    ...buildCandidateList(metadata, COLOR_PATHS),
    ...cleanedRawTags,
  ]);

  const used = new Set();
  const orderedTags = [];
  const pushTag = (value) => {
    const cleaned = cleanTagText(value);
    if (!cleaned) return undefined;
    const key = cleaned.toLowerCase();
    if (used.has(key)) return undefined;
    used.add(key);
    orderedTags.push(cleaned);
    return cleaned;
  };

  let styleTag = styleCandidates.find((candidate) => looksLikeStyle(candidate));
  if (!styleTag && styleCandidates.length > 0) {
    styleTag = styleCandidates[0];
  }
  styleTag = pushTag(styleTag);

  let garmentTag = garmentCandidates.find(
    (candidate) => !used.has(candidate.toLowerCase()) && looksLikeGarment(candidate)
  );
  if (!garmentTag && getValueAtPath(metadata, 'garmentType')) {
    garmentTag = getValueAtPath(metadata, 'garmentType');
  }
  garmentTag = pushTag(garmentTag);

  let colorTag = colorCandidates.find(
    (candidate) => !used.has(candidate.toLowerCase()) && looksLikeColor(candidate)
  );
  if (!colorTag) {
    colorTag = colorCandidates
      .map((candidate) => (!used.has(candidate.toLowerCase()) ? extractColorWord(candidate) : undefined))
      .find((candidate) => candidate && !used.has(candidate.toLowerCase()));
  }
  colorTag = pushTag(colorTag);

  if (orderedTags.length < 3) {
    const promptFallback = extractTagsFromPrompt(prompt).filter((candidate) => {
      const lowered = candidate.toLowerCase();
      if (used.has(lowered)) return false;
      return looksLikeStyle(candidate) || looksLikeGarment(candidate) || looksLikeColor(candidate);
    });

    promptFallback.some((candidate) => {
      if (orderedTags.length >= 3) return true;
      pushTag(candidate);
      return false;
    });
  }

  while (orderedTags.length < 3) {
    const next = cleanedRawTags.find((candidate) => !used.has(candidate.toLowerCase()));
    if (!next) break;
    pushTag(next);
  }

  return {
    tags: orderedTags.slice(0, 3),
    style: orderedTags[0],
    garment: orderedTags[1],
    color: orderedTags[2],
  };
};

module.exports = {
  deriveConsistentTags,
  cleanTagText,
};


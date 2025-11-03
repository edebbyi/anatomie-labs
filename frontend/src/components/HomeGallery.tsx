import { useMemo, useState } from 'react';
import Masonry from 'react-responsive-masonry';
import ImageCard from './ImageCard';
import { SwipeView } from './SwipeView';
import { FilterModal } from './FilterModal';
import { AutoGenerateCard } from './AutoGenerateCard';
import { Grid, LayoutGrid, Plus, Heart, Sparkles, Clock, Archive } from 'lucide-react';
import { Button } from './ui/button';
import type { GalleryImage } from '../types/images';

// Shared controlled vocabularies and heuristics (module scope so multiple functions can use them)
const garmentKeywords = [
  'dress', 'blazer', 'suit', 'top', 'gown', 'skirt', 'coat', 'jacket', 'pants', 'trouser', 'vest', 'ensemble', 'shorts', 'shirt', 'blouse', 'hoodie', 'sweater'
];

// Modifiers/silhouettes that often prefix garment names
const silhouetteKeywords = [
  'oversized', 'fitted', 'straight', 'slim', 'relaxed', 'cropped', 'longline', 'boxy', 'tapered', 'wide-leg', 'high-waist', 'low-rise', 'crew-neck', 'v-neck'
];

const fabricKeywords = [
  'silk', 'cotton', 'linen', 'wool', 'cashmere', 'denim', 'leather', 'suede', 'satin', 'chiffon', 'tweed', 'velvet', 'jersey', 'knit', 'polyester', 'nylon', 'rayon'
];

const lightingKeywords = [
  'studio', 'natural light', 'ambient', 'high key', 'low key', 'soft light', 'hard light', 'backlit', 'rim light', 'spotlight', 'hdr', '4k', '8k', 'dslr', 'shallow depth', 'bokeh',
  // Backgrounds and finishes
  'background', 'matte finish', 'polished finish', 'textured finish', 'sheen finish', 'neutral background', 'modern editorial', 'clean studio',
  // Camera angles and directions
  'angle', 'front angle', 'back angle', 'profile angle', 'straight-on', 'eye level', 'from top', '45deg', '45 deg', '45°', 'side', 'from side',
  // Lighting directions
  'from front', 'from side', 'from top'
];

// Known style descriptors; if a tag isn't identified as garment/color/fabric/lighting, treat as style
const styleDescriptors = [
  'minimalist', 'maximalist', 'sporty', 'sporty chic', 'elegant', 'classic', 'streetwear', 'bohemian', 'chic', 'avant-garde', 'casual', 'formal', 'luxury', 'vintage', 'futuristic', 'editorial'
];

interface HomeGalleryProps {
  images: GalleryImage[];
  onLike: (id: string) => void;
  onDiscard: (id: string) => void;
  onUnarchive?: (id: string) => void;
  onImageView: (id: string) => void;
}

export function HomeGallery({ images, onLike, onDiscard, onUnarchive, onImageView }: HomeGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const [activeCollection, setActiveCollection] = useState<string>('All');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'masonry' | 'grid'>('masonry');
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [autoBatchSize, setAutoBatchSize] = useState(50);

  const likedCount = useMemo(
    () => images.filter((img) => img.liked).length,
    [images]
  );

  const userGeneratedCount = useMemo(
    () => images.filter((img) => 
      img.metadata?.generationMethod === 'generate_endpoint' || 
      img.metadata?.generationMethod === 'voice_command'
    ).length,
    [images]
  );

  const recentImages = useMemo(
    () =>
      images
        .filter((img) => img.lastInteractedAt && !img.archived)
        .sort(
          (a, b) =>
            (b.lastInteractedAt?.getTime() ?? 0) -
            (a.lastInteractedAt?.getTime() ?? 0)
        ),
    [images]
  );

  const archivedCount = useMemo(
    () => images.filter((img) => img.archived).length,
    [images]
  );

  const filterGroups = useMemo(() => {
    const styleSet = new Set<string>();
    const garmentSet = new Set<string>();
    const colorSet = new Set<string>();
    const fabricSet = new Set<string>();
    const lightingSet = new Set<string>();
    const silhouetteSet = new Set<string>();

    images.forEach((img) => {
      const tags = img.tags || [];
      tags.forEach((tag) => {
        const normalized = tag.toLowerCase().trim();
        if (!normalized) return;

        // Extract garment + silhouette if present: e.g., "oversized bomber jacket" -> garment: "bomber jacket", silhouette: "oversized"
        const garmentMatch = normalized.match(/^(?<pre>\w[\w-]*?)\s+(?<core>(?:[a-z-]+\s)?(?:dress|blazer|suit|top|gown|skirt|coat|jacket|pants?|trouser|vest|ensemble|shorts|shirt|blouse|hoodie|sweater))s?\b/);
        if (garmentMatch && garmentMatch.groups) {
          const pre = garmentMatch.groups.pre; // potential silhouette
          const core = garmentMatch.groups.core; // garment core phrase
          if (silhouetteKeywords.includes(pre)) {
            silhouetteSet.add(pre);
            garmentSet.add(core);
            return;
          }
        }

        // Route obvious non-style descriptors to Lighting/Specs
        const lightingRegexes = [
          /(lighting|light)\b/,
          /(background|finish|sheen)\b/,
          /(angle|eye level|straight[- ]?on|profile)\b/,
          /\b(\d{1,3}\s?deg|45°)\b/,
          /(from\s+(front|side|top))/,
          /(studio|clean studio|editorial)/,
        ];

        if (garmentKeywords.some((k) => normalized.includes(k))) {
          garmentSet.add(tag);
          return;
        }
        if (fabricKeywords.some((k) => normalized.includes(k))) {
          fabricSet.add(tag);
          return;
        }

        // Palette or colorway phrasing: classify as Color and attempt to extract color tokens
        const paletteRegex = /(palette|colorway|hue|tint)/;
        if (paletteRegex.test(normalized)) {
          // naive token extraction of common color names
          const colorTokens = normalized
            .replace(/[:\d.\s]+$/, '')
            .split(/[^a-z#]+/)
            .filter(Boolean);
          const knownColors = [
            'black','white','gray','grey','cream','beige','ivory','red','maroon','crimson','pink','magenta','fuchsia','orange','amber','peach','yellow','gold','mustard','green','sage','olive','teal','mint','blue','navy','cobalt','cyan','turquoise','purple','violet','indigo','brown','tan','chocolate'
          ];
          const found = colorTokens.filter((t) => knownColors.includes(t));
          if (found.length > 0) {
            found.forEach((c) => colorSet.add(c));
          } else {
            colorSet.add(tag);
          }
          return;
        }

        if (lightingKeywords.some((k) => normalized.includes(k)) || lightingRegexes.some((re) => re.test(normalized))) {
          lightingSet.add(tag);
          return;
        }

        if (styleDescriptors.some((k) => normalized === k)) {
          styleSet.add(tag);
          return;
        }
        // Fallback: treat as style if appears descriptive and not a hex code or numeric
        if (!/^#?[0-9a-f]{3,8}$/i.test(normalized)) {
          styleSet.add(tag);
        }
      });

      const garment = img.metadata?.garmentType || (img.metadata as any)?.garment || null;
      if (garment) {
        // Split metadata garment if it contains silhouette adjectives
        const gNorm = String(garment).toLowerCase();
        const foundSilhouette = silhouetteKeywords.find((s) => gNorm.startsWith(s + ' '));
        if (foundSilhouette) {
          silhouetteSet.add(foundSilhouette);
          const core = gNorm.replace(foundSilhouette + ' ', '');
          garmentSet.add(core);
        } else {
          garmentSet.add(garment);
        }
      }

      const colors = img.metadata?.colors || [];
      colors.forEach((color) => {
        if (typeof color === 'string' && color.trim().length > 0) {
          colorSet.add(color);
        }
      });

      const fabrics = (img.metadata as any)?.fabrics || [];
      fabrics.forEach((fabric: any) => {
        if (typeof fabric === 'string' && fabric.trim().length > 0) {
          fabricSet.add(fabric);
        }
      });

      const specs = (img.metadata as any)?.specs || (img.metadata as any)?.lighting || [];
      (Array.isArray(specs) ? specs : [specs]).forEach((spec: any) => {
        if (typeof spec === 'string' && spec.trim().length > 0) {
          const norm = spec.toLowerCase();
          if (lightingKeywords.some((k) => norm.includes(k))) {
            lightingSet.add(spec);
          }
        }
      });
    });

    const toSortedArray = (set: Set<string>) =>
      Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    return {
      style: toSortedArray(styleSet),
      garment: toSortedArray(garmentSet),
      silhouette: toSortedArray(silhouetteSet),
      color: toSortedArray(colorSet),
      fabric: toSortedArray(fabricSet),
      lighting: toSortedArray(lightingSet),
    } as const;
  }, [images]);

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const matchesTag = (img: GalleryImage, rawTag: string) => {
    const tag = rawTag.toLowerCase();

    // Style tags live in img.tags
    if ((img.tags || []).some((t) => t.toLowerCase() === tag)) return true;

    // Prepare helper to test hyphen/space variants (e.g., wide-leg vs wide leg)
    const withVariants = (term: string) => {
      const variants = new Set<string>([term]);
      variants.add(term.replace(/-/g, ' '));
      variants.add(term.replace(/\s+/g, '-'));
      return Array.from(variants);
    };
    const textIncludesAny = (source: string | undefined, terms: string[]) => {
      if (!source) return false;
      const s = source.toLowerCase();
      return terms.some((t) => s.includes(t));
    };

    // Garment matching (normalize away leading silhouette modifiers) and silhouette detection anywhere in garment
    const garment = img.metadata?.garmentType || (img.metadata as any)?.garment;
    if (typeof garment === 'string') {
      const gNorm = garment.toLowerCase();
      const leading = silhouetteKeywords.find((s) => gNorm.startsWith(s + ' '));
      const core = leading ? gNorm.replace(leading + ' ', '') : gNorm;
      if (core === tag) return true;
      // Silhouette tag match: allow anywhere in garment string including hyphen/space variants
      if (silhouetteKeywords.includes(tag)) {
        const patterns = withVariants(tag);
        if (textIncludesAny(gNorm, patterns)) return true;
      }
    }

    // Colors (direct)
    if ((img.metadata?.colors || []).some((c) => typeof c === 'string' && c.toLowerCase() === tag)) return true;

    // Colors inferred from palette phrases in tags
    const tags = (img.tags || []).map((t) => t.toLowerCase());
    const paletteRegex = /(palette|colorway|hue|tint)/;
    if (tags.some((t) => paletteRegex.test(t))) {
      const knownColors = [
        'black','white','gray','grey','cream','beige','ivory','red','maroon','crimson','pink','magenta','fuchsia','orange','amber','peach','yellow','gold','mustard','green','sage','olive','teal','mint','blue','navy','cobalt','cyan','turquoise','purple','violet','indigo','brown','tan','chocolate'
      ];
      for (const t of tags) {
        if (!paletteRegex.test(t)) continue;
        const colorTokens = t
          .replace(/[:\d.\s]+$/, '')
          .split(/[^a-z#]+/)
          .filter(Boolean);
        if (colorTokens.some((c) => knownColors.includes(c) && c === tag)) return true;
      }
    }

    // Silhouette match from tags (not only exact tag; allow substring and hyphen/space variants)
    if (silhouetteKeywords.includes(tag)) {
      const patterns = withVariants(tag);
      if (tags.some((t) => patterns.some((p) => t.includes(p)))) return true;

      // Also check potential metadata arrays
      const metaSil = (img.metadata as any)?.silhouette || (img.metadata as any)?.fit || [];
      const metaArray = Array.isArray(metaSil) ? metaSil : [metaSil];
      if (metaArray.some((s: any) => typeof s === 'string' && patterns.some((p) => s.toLowerCase().includes(p)))) return true;
    }

    // Fabrics
    const fabrics = (img.metadata as any)?.fabrics || [];
    if ((Array.isArray(fabrics) ? fabrics : [fabrics]).some((f) => typeof f === 'string' && f.toLowerCase() === tag)) return true;

    // Lighting/specs
    const specs = (img.metadata as any)?.specs || (img.metadata as any)?.lighting || [];
    if ((Array.isArray(specs) ? specs : [specs]).some((s) => typeof s === 'string' && s.toLowerCase() === tag)) return true;

    return false;
  };

  const collectionImages = useMemo(() => {
    let base: GalleryImage[] = images;

    if (activeCollection === 'Liked') {
      base = images.filter((img) => img.liked && !img.archived);
    } else if (activeCollection === 'User-Generated') {
      base = images.filter((img) => 
        (img.metadata?.generationMethod === 'generate_endpoint' || 
         img.metadata?.generationMethod === 'voice_command') && !img.archived
      );
    } else if (activeCollection === 'Recent') {
      base = recentImages;
    } else if (activeCollection === 'Archive') {
      base = images.filter((img) => img.archived);
    } else {
      base = images.filter((img) => !img.archived);
    }

    if (selectedTags.length === 0) {
      return base;
    }

    return base.filter((img) =>
      selectedTags.some((tag) => matchesTag(img, tag))
    );
  }, [images, recentImages, activeCollection, selectedTags]);

  const handleImageOpen = (index: number) => {
    const target = collectionImages[index];
    if (!target) return;
    onImageView(target.id);
    setSelectedImage(index);
  };

  const handleImageViewed = (id: string) => {
    onImageView(id);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Simplified Collection Bar */}
      <div className="sticky top-16 z-40 bg-white border-b border-gray-200 py-4 px-6">
        <div className="flex items-center justify-between">
          {/* Main Collections - Only 4 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveCollection('All');
                setSelectedTags([]);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all duration-200 ${
                activeCollection === 'All' && selectedTags.length === 0
                  ? 'bg-[#000000] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All {images.length}
            </button>

            <button
              onClick={() => {
                setActiveCollection('Liked');
                setSelectedTags([]);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all duration-200 ${
                activeCollection === 'Liked'
                  ? 'bg-[#ec4899] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Heart className="w-4 h-4" />
              Liked {likedCount}
            </button>

            <button
              onClick={() => {
                setActiveCollection('User-Generated');
                setSelectedTags([]);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all duration-200 ${
                activeCollection === 'User-Generated'
                  ? 'bg-[#6366f1] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              User-Generated {userGeneratedCount}
            </button>
            
            <button
              onClick={() => {
                setActiveCollection('Recent');
                setSelectedTags([]);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all duration-200 ${
                activeCollection === 'Recent'
                  ? 'bg-[#000000] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Clock className="w-4 h-4" />
              Recent
            </button>

            <button
              onClick={() => {
                setActiveCollection('Archive');
                setSelectedTags([]);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all duration-200 ${
                activeCollection === 'Archive'
                  ? 'bg-[#6b7280] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Archive className="w-4 h-4" />
              Archive {archivedCount}
            </button>

            {/* More Filters Button */}
            <button
              onClick={() => setShowFilterModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all duration-200"
            >
              <Plus className="w-4 h-4" />
              More Filters
              {selectedTags.length > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-[#6366f1] text-white rounded-full text-xs">
                  {selectedTags.length}
                </span>
              )}
            </button>
          </div>

          {/* Layout Toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLayoutMode('masonry')}
              className={layoutMode === 'masonry' ? 'bg-gray-100' : ''}
            >
              <LayoutGrid className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLayoutMode('grid')}
              className={layoutMode === 'grid' ? 'bg-gray-100' : ''}
            >
              <Grid className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Gallery */}
      <div className="p-6 space-y-6">
        {/* Auto-Generate Card */}
        <AutoGenerateCard
          enabled={autoGenerate}
          onToggle={setAutoGenerate}
          batchSize={autoBatchSize}
          onBatchSizeChange={setAutoBatchSize}
        />

        {/* Images */}
        {collectionImages.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">No images found</p>
            <p className="text-gray-400 text-sm mt-2">
              Try adjusting your filters or generate new designs
            </p>
          </div>
        ) : layoutMode === 'masonry' ? (
          <Masonry columnsCount={3} gutter="24px">
            {collectionImages.map((image, index) => (
              <ImageCard
                key={image.id}
                image={image}
                onLike={onLike}
                onDiscard={onDiscard}
                onUnarchive={onUnarchive}
                onView={() => handleImageOpen(index)}
                onClick={() => handleImageOpen(index)}
              />
            ))}
          </Masonry>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collectionImages.map((image, index) => (
              <div key={image.id} className="aspect-[3/4]">
                <div className="h-full">
                  <ImageCard
                    image={image}
                    onLike={onLike}
                    onDiscard={onDiscard}
                    onUnarchive={onUnarchive}
                    onView={() => handleImageOpen(index)}
                    onClick={() => handleImageOpen(index)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter Modal */}
      <FilterModal
        open={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        filters={filterGroups}
        selectedTags={selectedTags}
        onTagToggle={handleTagToggle}
        onClearAll={() => setSelectedTags([])}
      />

      {/* Swipe View Modal */}
      {selectedImage !== null && (
        <SwipeView
          images={collectionImages}
          initialIndex={selectedImage}
          onClose={() => setSelectedImage(null)}
          onLike={onLike}
          onDiscard={onDiscard}
          onImageViewed={handleImageViewed}
        />
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import ImageCard from './ImageCard';
import { SwipeView } from './SwipeView';
import { FilterModal } from './FilterModal';
import { AutoGenerateCard } from './AutoGenerateCard';
import { Grid, LayoutGrid, Plus, Heart, Sparkles, Clock, Archive } from 'lucide-react';
import { Button } from './ui/button';
import type { GalleryImage } from '../types/images';

export type HomeCollection = 'All' | 'Liked' | 'User-Generated' | 'Recent' | 'Archive';

interface HomeGalleryProps {
  images: GalleryImage[];
  onLike: (id: string) => void;
  onDiscard: (id: string) => void;
  onUnarchive?: (id: string) => void;
  onImageView?: (id: string) => void;
  initialCollection?: HomeCollection;
}

export function HomeGallery({
  images,
  onLike,
  onDiscard,
  onUnarchive,
  onImageView,
  initialCollection = 'All',
}: HomeGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const [activeCollection, setActiveCollection] = useState<HomeCollection>(initialCollection);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'large' | 'small'>('large');
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [autoBatchSize, setAutoBatchSize] = useState(5);

  useEffect(() => {
    setActiveCollection(initialCollection);
    setSelectedTags([]);
  }, [initialCollection]);

  const allImageTags = useMemo(() => {
    const tagSet = new Set<string>();
    images.forEach((img) => {
      const tags = Array.isArray(img.tags) ? img.tags : [];
      tags.forEach((tag) => {
        if (typeof tag === 'string' && tag.trim()) {
          tagSet.add(tag);
        }
      });
    });
    return Array.from(tagSet);
  }, [images]);

  const likedCount = useMemo(
    () => images.filter((img) => img.liked && !img.archived).length,
    [images]
  );

  const userGeneratedCount = useMemo(
    () =>
      images.filter(
        (img) =>
          !img.archived &&
          (img.metadata?.generationMethod === 'generate_endpoint' ||
            img.metadata?.generationMethod === 'voice_command' ||
            img.metadata?.generationMethod === 'batch_generation')
      ).length,
    [images]
  );

  const archivedCount = useMemo(
    () => images.filter((img) => img.archived).length,
    [images]
  );

  const collectionImages = useMemo(() => {
    const nonArchived = images.filter((img) => !img.archived);

    switch (activeCollection) {
      case 'Liked':
        return nonArchived.filter((img) => img.liked);
      case 'User-Generated':
        return nonArchived.filter(
          (img) =>
            img.metadata?.generationMethod === 'generate_endpoint' ||
            img.metadata?.generationMethod === 'voice_command' ||
            img.metadata?.generationMethod === 'batch_generation'
        );
      case 'Recent':
        return nonArchived
          .slice()
          .sort(
            (a, b) =>
              (b.lastInteractedAt?.getTime() ?? 0) -
              (a.lastInteractedAt?.getTime() ?? 0)
          );
      case 'Archive':
        return images.filter((img) => img.archived);
      default:
        return nonArchived;
    }
  }, [images, activeCollection]);

  const filteredImages = useMemo(() => {
    if (selectedTags.length === 0) return collectionImages;

    return collectionImages.filter((img) => {
      const tags = Array.isArray(img.tags) ? img.tags : [];
      return selectedTags.some((tag) => tags.includes(tag));
    });
  }, [collectionImages, selectedTags]);

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleImageOpen = (index: number) => {
    const target = filteredImages[index];
    if (target && onImageView) {
      onImageView(target.id);
    }
    setSelectedImage(index);
  };

  const handleImageViewed = (id: string) => {
    onImageView?.(id);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Collection Bar */}
      <div className="sticky top-16 z-40 bg-white border-b border-gray-200 py-4 px-6">
        <div className="flex items-center justify-between">
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
              All {images.filter((img) => !img.archived).length}
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

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLayoutMode('large')}
              className={layoutMode === 'large' ? 'bg-gray-100' : ''}
              aria-label="Large card view"
            >
              <LayoutGrid className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLayoutMode('small')}
              className={layoutMode === 'small' ? 'bg-gray-100' : ''}
              aria-label="Compact grid view"
            >
              <Grid className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Gallery */}
      <div className="p-6 space-y-6">
        <AutoGenerateCard
          enabled={autoGenerate}
          onToggle={(enabled) => setAutoGenerate(enabled)}
          batchSize={autoBatchSize}
          onBatchSizeChange={(size) => setAutoBatchSize(size)}
        />

        {filteredImages.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">No images found</p>
            <p className="text-gray-400 text-sm mt-2">
              Try adjusting your filters or generate new designs
            </p>
          </div>
        ) : layoutMode === 'large' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredImages.map((image, index) => (
              <div key={image.id} className="aspect-[3/4]">
                <ImageCard
                  image={image}
                  onLike={onLike}
                  onDiscard={onDiscard}
                  onUnarchive={onUnarchive}
                  onView={() => handleImageOpen(index)}
                  onClick={() => handleImageOpen(index)}
                  size="large"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {filteredImages.map((image, index) => (
              <ImageCard
                key={image.id}
                image={image}
                onLike={onLike}
                onDiscard={onDiscard}
                onUnarchive={onUnarchive}
                onView={() => handleImageOpen(index)}
                onClick={() => handleImageOpen(index)}
                size="small"
              />
            ))}
          </div>
        )}
      </div>

      <FilterModal
        open={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        availableTags={allImageTags}
        selectedTags={selectedTags}
        onTagToggle={handleTagToggle}
        onClearAll={() => setSelectedTags([])}
      />

      {selectedImage !== null && (
        <SwipeView
          images={filteredImages}
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

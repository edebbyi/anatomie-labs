import { useState } from 'react';
import Masonry from 'react-responsive-masonry';
import { ImageCard } from './ImageCard';
import { SwipeView } from './SwipeView';
import { FilterModal } from './FilterModal';
import { AutoGenerateCard } from './AutoGenerateCard';
import { GeneratedImage } from '../lib/mockData';
import { Grid, LayoutGrid, Plus, Heart, Sparkles, Clock } from 'lucide-react';
import { Button } from './ui/button';

interface HomeGalleryProps {
  images: GeneratedImage[];
  onLike: (id: string) => void;
  onDiscard: (id: string) => void;
}

export function HomeGallery({ images, onLike, onDiscard }: HomeGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const [activeCollection, setActiveCollection] = useState<string>('All');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'masonry' | 'grid'>('masonry');
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [autoBatchSize, setAutoBatchSize] = useState(50);

  // Extract unique tags from all images
  const allImageTags = Array.from(
    new Set(images.flatMap((img) => img.tags))
  );

  const likedCount = images.filter((img) => img.liked).length;

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const filteredImages = images.filter((img) => {
    // Filter by collection first
    if (activeCollection === 'Liked' && !img.liked) return false;
    if (activeCollection === 'All' && selectedTags.length === 0) return true;
    
    // Then filter by tags if any selected
    if (selectedTags.length > 0) {
      return selectedTags.some((tag) => img.tags.includes(tag));
    }
    
    return true;
  });

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
                setActiveCollection('Generated');
                setSelectedTags([]);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all duration-200 ${
                activeCollection === 'Generated'
                  ? 'bg-[#6366f1] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Generated
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
        {filteredImages.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">No images found</p>
            <p className="text-gray-400 text-sm mt-2">
              Try adjusting your filters or generate new designs
            </p>
          </div>
        ) : layoutMode === 'masonry' ? (
          <Masonry columnsCount={3} gutter="24px">
            {filteredImages.map((image, index) => (
              <ImageCard
                key={image.id}
                image={image}
                onLike={onLike}
                onDiscard={onDiscard}
                onView={() => setSelectedImage(index)}
              />
            ))}
          </Masonry>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredImages.map((image, index) => (
              <div key={image.id} className="aspect-[3/4]">
                <div className="h-full">
                  <ImageCard
                    image={image}
                    onLike={onLike}
                    onDiscard={onDiscard}
                    onView={() => setSelectedImage(index)}
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
        availableTags={allImageTags}
        selectedTags={selectedTags}
        onTagToggle={handleTagToggle}
        onClearAll={() => setSelectedTags([])}
      />

      {/* Swipe View Modal */}
      {selectedImage !== null && (
        <SwipeView
          images={filteredImages}
          initialIndex={selectedImage}
          onClose={() => setSelectedImage(null)}
          onLike={onLike}
          onDiscard={onDiscard}
        />
      )}
    </div>
  );
}

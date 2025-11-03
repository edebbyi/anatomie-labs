import { X, Heart, Info, Grid, Rows } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BasicImage } from './ImageCard';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface SwipeViewProps {
  images: BasicImage[];
  initialIndex: number;
  onClose: () => void;
  onLike: (id: string) => void;
  onDiscard: (id: string) => void;
  onImageViewed?: (id: string) => void;
}

export function SwipeView({
  images,
  initialIndex,
  onClose,
  onLike,
  onDiscard,
  onImageViewed,
}: SwipeViewProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showMetadata, setShowMetadata] = useState(false);
  const [direction, setDirection] = useState(0);
  const [mode, setMode] = useState<'card' | 'vertical'>('card');

  const currentImage = images[currentIndex];

  const resolveGeneratedAt = (image?: BasicImage) => {
    if (!image) return undefined;
    const source =
      image.timestamp ||
      (image as any).createdAt ||
      (image as any).created_at ||
      (image as any)?.metadata?.generatedAt ||
      (image as any)?.metadata?.generated_at;

    const parsed =
      source instanceof Date ? source : source ? new Date(source) : undefined;

    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : undefined;
  };

  const generatedLabel = (() => {
    const date = resolveGeneratedAt(currentImage);
    if (!date) return 'Unknown';
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  })();

  const metadata = (currentImage?.metadata || {}) as Record<string, any>;

  const promptText = (() => {
    // For voice commands, display the user's original query
    const userQuery = (metadata.userQuery || '').trim();
    if (userQuery) return userQuery;

    // Otherwise, use the regular prompt
    const raw = (currentImage?.prompt || '').trim();
    if (!raw) return 'Prompt unavailable';
    return raw;
  })();
  const tags =
    Array.isArray(currentImage?.tags) && (currentImage.tags as string[]).length > 0
      ? (currentImage.tags as string[])
      : Array.isArray(metadata.styleTags)
        ? (metadata.styleTags as string[])
        : [];

  const displayData = {
    garment: metadata.garmentType || metadata.garment,
    colors: Array.isArray(metadata.colors) ? metadata.colors : [],
    fabric: metadata.fabric || metadata.texture,
    silhouette: metadata.silhouette || metadata.silhouette_type,
    details: metadata.details,
    shot: metadata.shot || metadata.lighting,
  };

  useEffect(() => {
    if (currentImage) {
      onImageViewed?.(currentImage.id);
    }
  }, [currentImage, onImageViewed]);

  const handleSwipe = (dir: number) => {
    setDirection(dir);
    if (dir > 0) {
      onLike(currentImage.id);
    } else {
      onDiscard(currentImage.id);
    }
    
    setTimeout(() => {
      if (currentIndex < images.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setShowMetadata(false);
      } else {
        onClose();
      }
    }, 200);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') handleSwipe(-1);
    if (e.key === 'ArrowRight') handleSwipe(1);
    if (e.key === 'Escape') onClose();
  };

  useEffect(() => {
    const listener = handleKeyDown as unknown as EventListener;
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  });

  if (mode === 'vertical') {
    return (
      <div className="fixed inset-0 bg-black z-50 overflow-y-auto snap-y snap-mandatory">
        {/* Header */}
        <div className="fixed top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4 flex items-center justify-between">
          <Button variant="ghost" onClick={onClose} className="text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => setMode('card')}
            className="text-white hover:bg-white/10"
          >
            <Grid className="w-5 h-5" />
          </Button>
        </div>

        {/* Images */}
        {images.map((image, index) => (
          <div
            key={image.id}
            className="h-screen w-full snap-start flex items-center justify-center relative"
          >
            <img
              src={image.url}
              alt={image.prompt}
              className="max-h-full max-w-full object-contain"
            />
            
            {/* Floating actions */}
            <div className="absolute left-6 top-1/2 -translate-y-1/2">
              <Button
                onClick={() => onDiscard(image.id)}
                className="w-14 h-14 rounded-full bg-black/50 hover:bg-black/70 text-white"
              >
                <X className="w-6 h-6" />
              </Button>
            </div>
            <div className="absolute right-6 top-1/2 -translate-y-1/2">
              <Button
                onClick={() => onLike(image.id)}
                className="w-14 h-14 rounded-full bg-[#ec4899] hover:bg-[#db2777] text-white"
              >
                <Heart className="w-6 h-6" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
      {/* Header */}
      <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-4">
        <Button variant="ghost" onClick={onClose} className="text-white hover:bg-white/10">
          <X className="w-5 h-5" />
        </Button>
        <p className="text-white text-sm">
          {currentIndex + 1} / {images.length}
        </p>
        <Button
          variant="ghost"
          onClick={() => setMode('vertical')}
          className="text-white hover:bg-white/10"
        >
          <Rows className="w-5 h-5" />
        </Button>
      </div>

      {/* Card */}
      <div className="max-w-2xl w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentImage.id}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{
              x: direction > 0 ? 300 : -300,
              opacity: 0,
              rotate: direction > 0 ? 15 : -15,
            }}
            transition={{ duration: 0.2 }}
            className="relative"
          >
            {!showMetadata ? (
              // Front of card - Image
              <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
                <img
                  src={currentImage.url}
                  alt={currentImage.prompt}
                  className="w-full h-auto max-h-[70vh] object-contain"
                />
                <div className="p-4 flex flex-wrap gap-2">
                  {tags.map((tag, i) => (
                    <Badge key={`${tag}-${i}`} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              // Back of card - Metadata
              <div className="bg-white rounded-2xl overflow-hidden shadow-2xl p-6 min-h-[500px]">
                <div className="space-y-6">
                  <div>
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                      {metadata.userQuery ? 'Your Query' : 'Prompt'}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-900">
                      {promptText}
                    </p>
                  </div>

                  {metadata.enhancedPrompt && metadata.userQuery && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                        Enhanced Prompt (API)
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-gray-600">
                        {metadata.enhancedPrompt}
                      </p>
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    {displayData.garment && (
                      <div>
                        <p className="text-sm text-gray-500">Garment</p>
                        <p className="text-gray-900">{displayData.garment}</p>
                      </div>
                    )}
                    {displayData.colors.length > 0 && (
                      <div>
                        <p className="text-sm text-gray-500">Colors</p>
                        <p className="text-gray-900">
                          {displayData.colors.join(', ')}
                        </p>
                      </div>
                    )}
                    {displayData.fabric && (
                      <div>
                        <p className="text-sm text-gray-500">Fabric</p>
                        <p className="text-gray-900">{displayData.fabric}</p>
                      </div>
                    )}
                    {displayData.silhouette && (
                      <div>
                        <p className="text-sm text-gray-500">Silhouette</p>
                        <p className="text-gray-900">{displayData.silhouette}</p>
                      </div>
                    )}
                    {displayData.details && (
                      <div className="md:col-span-2">
                        <p className="text-sm text-gray-500">Details</p>
                        <p className="text-gray-900">{displayData.details}</p>
                      </div>
                    )}
                    {displayData.shot && (
                      <div>
                        <p className="text-sm text-gray-500">Shot</p>
                        <p className="text-gray-900">{displayData.shot}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">Tags</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {tags.length > 0 ? (
                        tags.map((tag, idx) => (
                          <Badge key={`${tag}-${idx}`} variant="secondary">
                            {tag}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-gray-400">No tags</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">Generated</p>
                    <p className="text-gray-900">{generatedLabel}</p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Controls */}
        <div className="flex items-center justify-between mt-6">
          <Button
            onClick={() => handleSwipe(-1)}
            variant="outline"
            className="text-white border-white hover:bg-white/10"
          >
            ← Discard
          </Button>

          <Button
            variant="ghost"
            onClick={() => setShowMetadata(!showMetadata)}
            className="text-white hover:bg-white/10"
          >
            <Info className="w-5 h-5 mr-2" />
            {showMetadata ? 'Show Image' : 'Info'}
          </Button>

          <Button
            onClick={() => handleSwipe(1)}
            variant="outline"
            className="text-white border-white hover:bg-white/10"
          >
            Like →
          </Button>
        </div>
      </div>
    </div>
  );
}

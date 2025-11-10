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

  useEffect(() => {
    if (currentImage?.id && onImageViewed) {
      onImageViewed(currentImage.id);
    }
  }, [currentImage?.id, onImageViewed]);

  const handleSwipe = (dir: number) => {
    if (!currentImage) return;
    setDirection(dir);
    if (dir > 0) {
      onLike(currentImage.id);
    } else {
      onDiscard(currentImage.id);
    }

    setTimeout(() => {
      if (currentIndex < images.length - 1) {
        setCurrentIndex((prev) => prev + 1);
        setShowMetadata(false);
      } else {
        onClose();
      }
    }, 200);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handleSwipe(-1);
      if (e.key === 'ArrowRight') handleSwipe(1);
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, images.length, onClose]);

  if (!currentImage) {
    return null;
  }

  const resolveGeneratedAt = () => {
    const source =
      currentImage.timestamp ||
      (currentImage as any).createdAt ||
      (currentImage as any).created_at ||
      (currentImage as any)?.metadata?.generatedAt ||
      (currentImage as any)?.metadata?.generated_at;

    const parsed =
      source instanceof Date ? source : source ? new Date(source) : undefined;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : undefined;
  };

  const metadata = (currentImage.metadata || {}) as Record<string, any>;
  const tags = Array.isArray(currentImage.tags) ? currentImage.tags : [];
  const generatedLabel = resolveGeneratedAt()?.toLocaleString() ?? 'Unknown';

  if (mode === 'vertical') {
    return (
      <div className="fixed inset-0 bg-black z-50 overflow-y-auto snap-y snap-mandatory">
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

        {images.map((image) => (
          <div
            key={image.id}
            className="h-screen w-full snap-start flex items-center justify-center relative"
          >
            <img
              src={image.url}
              alt={image.prompt}
              className="max-h-full max-w-full object-contain"
            />
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
              <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
                <img
                  src={currentImage.url}
                  alt={currentImage.prompt ? 'Generated design' : ''}
                  className="w-full h-auto max-h-[70vh] object-contain"
                  onError={(e) => {
                    const el = e.currentTarget as HTMLImageElement & { dataset?: Record<string, string> };
                    if (el.dataset && el.dataset.fallbackApplied === 'true') return;
                    if (el.dataset) el.dataset.fallbackApplied = 'true';
                    el.src =
                      'data:image/svg+xml;utf8,' +
                      encodeURIComponent(
                        `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1000"><rect width="100%" height="100%" fill="#111827"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6b7280" font-family="system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial" font-size="24">Image unavailable</text></svg>`
                      );
                  }}
                />
                {tags.length > 0 && (
                  <div className="p-4 flex flex-wrap gap-2">
                    {tags.map((tag, index) => (
                      <Badge key={`${currentImage.id}-tag-${index}`} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl overflow-hidden shadow-2xl p-6 min-h-[500px]">
                <div className="space-y-6">
                  <div>
                    <p className="text-sm text-gray-500">Prompt</p>
                    <p className="text-gray-900 mt-2 whitespace-pre-wrap">
                      {(currentImage.prompt || '').trim() || 'Prompt unavailable'}
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {metadata.garmentType && (
                      <MetadataItem label="Garment" value={metadata.garmentType} />
                    )}
                    {Array.isArray(metadata.colors) && metadata.colors.length > 0 && (
                      <MetadataItem label="Colors" value={metadata.colors.join(', ')} />
                    )}
                    {(metadata.fabric || metadata.texture) && (
                      <MetadataItem label="Fabric" value={metadata.fabric || metadata.texture} />
                    )}
                    {metadata.silhouette && (
                      <MetadataItem label="Silhouette" value={metadata.silhouette} />
                    )}
                    {metadata.details && (
                      <MetadataItem label="Details" value={metadata.details} fullWidth />
                    )}
                    {(metadata.shot || metadata.lighting) && (
                      <MetadataItem label="Shot" value={metadata.shot || metadata.lighting} />
                    )}
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">Tags</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {tags.length > 0 ? (
                        tags.map((tag, index) => (
                          <Badge key={`${currentImage.id}-meta-tag-${index}`} variant="secondary">
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
            onClick={() => setShowMetadata((prev) => !prev)}
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

interface MetadataItemProps {
  label: string;
  value: string;
  fullWidth?: boolean;
}

function MetadataItem({ label, value, fullWidth }: MetadataItemProps) {
  return (
    <div className={fullWidth ? 'md:col-span-2' : undefined}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-gray-900">{value}</p>
    </div>
  );
}

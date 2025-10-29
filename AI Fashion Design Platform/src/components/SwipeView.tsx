import { X, Heart, Info, Grid, Rows } from 'lucide-react';
import { useState } from 'react';
import { GeneratedImage } from '../lib/mockData';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface SwipeViewProps {
  images: GeneratedImage[];
  initialIndex: number;
  onClose: () => void;
  onLike: (id: string) => void;
  onDiscard: (id: string) => void;
}

export function SwipeView({
  images,
  initialIndex,
  onClose,
  onLike,
  onDiscard,
}: SwipeViewProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showMetadata, setShowMetadata] = useState(false);
  const [direction, setDirection] = useState(0);
  const [mode, setMode] = useState<'card' | 'vertical'>('card');

  const currentImage = images[currentIndex];

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

  useState(() => {
    window.addEventListener('keydown', handleKeyDown as any);
    return () => window.removeEventListener('keydown', handleKeyDown as any);
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
                  {currentImage.tags.map((tag, i) => (
                    <Badge key={i} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              // Back of card - Metadata
              <div className="bg-white rounded-2xl overflow-hidden shadow-2xl p-6 min-h-[500px]">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500">Garment</p>
                    <p className="text-gray-900">{currentImage.metadata.garment}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Colors</p>
                    <p className="text-gray-900">{currentImage.metadata.colors.join(', ')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Fabric</p>
                    <p className="text-gray-900">{currentImage.metadata.fabric}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Silhouette</p>
                    <p className="text-gray-900">{currentImage.metadata.silhouette}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Details</p>
                    <p className="text-gray-900">{currentImage.metadata.details}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Shot</p>
                    <p className="text-gray-900">{currentImage.metadata.shot}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Tags</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {currentImage.tags.map((tag, i) => (
                        <Badge key={i} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Generated</p>
                    <p className="text-gray-900">
                      {new Date(currentImage.created_at).toLocaleString()}
                    </p>
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

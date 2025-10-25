import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Heart, Download, Share2, Info } from 'lucide-react';
import { useSwipe, useKeyboard, useLockBodyScroll } from '../hooks';

interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: string;
  metadata?: {
    garmentType?: string;
    colors?: string[];
    silhouette?: string;
    fabric?: string;
    styleTags?: string[];
  };
}

interface LightboxProps {
  images: GeneratedImage[];
  initialIndex: number;
  onClose: () => void;
}

const Lightbox: React.FC<LightboxProps> = ({ images, initialIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  // Lock body scroll when lightbox is open
  useLockBodyScroll(true);

  const currentImage = images[currentIndex];

  // Handle swipe gestures
  const swipeHandlers = useSwipe({
    onSwipeLeft: () => goToNext(),
    onSwipeRight: () => goToPrevious(),
    onSwipeUp: () => setIsFavorite(!isFavorite),
    minDistance: 50,
  });

  // Handle keyboard shortcuts
  useKeyboard({
    ArrowLeft: () => goToPrevious(),
    ArrowRight: () => goToNext(),
    Escape: onClose,
    l: () => setIsFavorite(!isFavorite),
    d: () => handleDownload(),
    i: () => setIsFlipped(!isFlipped),
  });

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
    setIsFlipped(false);
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    setIsFlipped(false);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = currentImage.url;
    link.download = `podna-design-${currentImage.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
      {...swipeHandlers}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
        aria-label="Close lightbox"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Image Counter */}
      <div className="absolute top-4 left-4 text-white text-sm font-medium">
        {currentIndex + 1} / {images.length}
      </div>

      {/* Main Content */}
      <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Image Container with Flip Effect */}
        <div
          className="relative flex-1 flex items-center justify-center bg-black rounded-lg overflow-hidden cursor-pointer group"
          onClick={() => setIsFlipped(!isFlipped)}
          style={{
            perspective: '1000px',
          }}
        >
          <div
            style={{
              transformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              transition: 'transform 0.6s',
            }}
            className="w-full h-full flex items-center justify-center"
          >
            {/* Front: Image */}
            <div
              style={{ backfaceVisibility: 'hidden' }}
              className="w-full h-full flex items-center justify-center"
            >
              <img
                src={currentImage.url}
                alt={currentImage.prompt}
                className="max-w-full max-h-full object-contain"
              />
              {/* Info Icon Indicator */}
              <div className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Info className="w-5 h-5 text-white" />
              </div>
            </div>

            {/* Back: Prompt and Details */}
            <div
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
              className="absolute inset-0 w-full h-full bg-gradient-to-br from-gray-900 to-black p-6 flex flex-col overflow-y-auto"
            >
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-3">Prompt</h3>
                <p className="text-gray-200 text-sm leading-relaxed mb-6">
                  {currentImage.prompt}
                </p>

                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-gray-300 mb-3">Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Generated:</span>
                      <span className="text-gray-100">
                        {formatDate(currentImage.timestamp)}
                      </span>
                    </div>

                    {currentImage.metadata?.garmentType && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Garment:</span>
                        <span className="text-gray-100 capitalize">
                          {currentImage.metadata.garmentType}
                        </span>
                      </div>
                    )}

                    {currentImage.metadata?.colors &&
                      currentImage.metadata.colors.length > 0 && (
                        <div>
                          <span className="text-gray-400 block mb-2">Colors:</span>
                          <div className="flex flex-wrap gap-2">
                            {currentImage.metadata.colors.map((color, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 bg-white/10 text-gray-200 rounded-full text-xs capitalize"
                              >
                                {color}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                    {currentImage.metadata?.silhouette && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Silhouette:</span>
                        <span className="text-gray-100 capitalize">
                          {currentImage.metadata.silhouette}
                        </span>
                      </div>
                    )}

                    {currentImage.metadata?.fabric && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Fabric:</span>
                        <span className="text-gray-100 capitalize">
                          {currentImage.metadata.fabric}
                        </span>
                      </div>
                    )}

                    {currentImage.metadata?.styleTags &&
                      currentImage.metadata.styleTags.length > 0 && (
                        <div>
                          <span className="text-gray-400 block mb-2">Style Tags:</span>
                          <div className="flex flex-wrap gap-2">
                            {currentImage.metadata.styleTags.map((tag, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 bg-white/10 text-gray-200 rounded-full text-xs capitalize"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/10 text-center">
                <p className="text-xs text-gray-400">Click to flip back</p>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-4 flex items-center justify-between">
          {/* Left Controls */}
          <div className="flex gap-2">
            <button
              onClick={goToPrevious}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={goToNext}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
              aria-label="Next image"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Right Controls */}
          <div className="flex gap-2">
            <button
              onClick={() => setIsFavorite(!isFavorite)}
              className={`p-2 rounded-lg transition-colors ${
                isFavorite
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              aria-label="Add to favorites"
              title="L key"
            >
              <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={handleDownload}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
              aria-label="Download image"
              title="D key"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsFlipped(!isFlipped)}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
              aria-label="Show prompt"
              title="I key"
            >
              <Info className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Keyboard Shortcuts Help */}
        <div className="mt-4 text-center text-xs text-gray-400">
          <p>← → Arrow keys | L favorite | D download | I info | ESC close</p>
        </div>
      </div>
    </div>
  );
};

export default Lightbox;


import React, { useState, useEffect, useRef } from 'react';
import { X, Heart, Download, Info } from 'lucide-react';
import { useKeyboard, useLockBodyScroll } from '../hooks';

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
  onLike?: (imageId: string) => void;
  onDismiss?: (imageId: string) => void;
  showFavorite?: boolean;
}

const Lightbox: React.FC<LightboxProps> = ({
  images,
  initialIndex,
  onClose,
  onLike,
  onDismiss,
  showFavorite = false
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [exitDirection, setExitDirection] = useState<'up' | 'down' | 'left' | 'right' | null>(null);

  // Touch/drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const wheelTimeRef = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  useLockBodyScroll(true);

  const currentImage = images[currentIndex];

  // Keyboard handlers
  const keyboardHandlers: Record<string, () => void> = {
    ArrowUp: () => goToPrevious(),
    ArrowDown: () => goToNext(),
    ArrowLeft: showFavorite ? () => handleDismiss() : () => {},
    ArrowRight: showFavorite ? () => handleLike() : () => {},
    Escape: () => startClose(),
    d: () => handleDownload(),
    i: () => setIsFlipped(!isFlipped),
  };

  if (showFavorite) {
    keyboardHandlers.l = () => handleLike();
    keyboardHandlers.x = () => handleDismiss();
  }

  useKeyboard(keyboardHandlers);

  const handleWheel = (e: React.WheelEvent) => {
    if (isExiting || isFlipped) return;
    
    const now = Date.now();
    if (now - wheelTimeRef.current < 450) return;
    wheelTimeRef.current = now;

    if (e.deltaY < 0 && currentIndex > 0) {
      animateNavigation('up', () => goToPrevious());
    } else if (e.deltaY > 0 && currentIndex < images.length - 1) {
      animateNavigation('down', () => goToNext());
    }
  };

  const animateNavigation = (direction: 'up' | 'down' | 'left' | 'right', callback: () => void) => {
    setIsExiting(true);
    setExitDirection(direction);
    setTimeout(() => {
      callback();
      setIsExiting(false);
      setExitDirection(null);
    }, 300);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isFlipped || isExiting) return;
    const touch = e.targetTouches[0];
    setDragStart({ x: touch.clientX, y: touch.clientY });
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || isFlipped || isExiting) return;

    const touch = e.targetTouches[0];
    const deltaX = touch.clientX - dragStart.x;
    const deltaY = touch.clientY - dragStart.y;

    setDragOffset({ x: deltaX, y: deltaY });
  };

  const handleTouchEnd = () => {
    if (!isDragging || isFlipped || isExiting) return;

    const { x: deltaX, y: deltaY } = dragOffset;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Determine if horizontal or vertical swipe
    if (absDeltaX > absDeltaY && absDeltaX > 120 && showFavorite) {
      // Horizontal swipe for like/dismiss
      if (deltaX > 0) {
        handleLike();
      } else {
        handleDismiss();
      }
    } else if (absDeltaY > absDeltaX && absDeltaY > 100) {
      // Vertical swipe for navigation
      if (deltaY < 0 && currentIndex < images.length - 1) {
        animateNavigation('down', () => goToNext());
      } else if (deltaY > 0 && currentIndex > 0) {
        animateNavigation('up', () => goToPrevious());
      }
    }

    // Reset drag state
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isFlipped || isExiting || !showFavorite) return;
    setDragStart({ x: e.clientX, y: e.clientY });
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || isFlipped || isExiting) return;
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    setDragOffset({ x: deltaX, y: deltaY });
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    handleTouchEnd();
  };

  const handleLike = () => {
    if (isExiting) return;
    if (onLike) onLike(currentImage.id);
    
    animateNavigation('right', () => {
      if (currentIndex < images.length - 1) {
        goToNext();
      } else {
        startClose();
      }
    });
  };

  const handleDismiss = () => {
    if (isExiting) return;
    if (onDismiss) onDismiss(currentImage.id);
    
    animateNavigation('left', () => {
      if (currentIndex < images.length - 1) {
        goToNext();
      } else {
        startClose();
      }
    });
  };

  const goToNext = () => {
    setCurrentIndex((prev) => Math.min(prev + 1, images.length - 1));
    setIsFlipped(false);
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
    setIsFlipped(false);
  };

  const startClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 250);
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

  // Calculate card transform based on drag and exit state
  const getCardTransform = () => {
    if (isExiting && exitDirection) {
      const distance = 1200;
      switch (exitDirection) {
        case 'up': return `translateY(${distance}px) scale(0.7)`;
        case 'down': return `translateY(-${distance}px) scale(0.7)`;
        case 'left': return `translateX(-${distance}px) rotate(-20deg) scale(0.7)`;
        case 'right': return `translateX(${distance}px) rotate(20deg) scale(0.7)`;
      }
    }

    if (isDragging) {
      const rotation = (dragOffset.x / window.innerWidth) * 20;
      return `translate(${dragOffset.x}px, ${dragOffset.y}px) rotate(${rotation}deg)`;
    }

    return 'translate(0, 0) scale(1)';
  };

  const getCardOpacity = () => {
    if (isClosing) return 0;
    if (isExiting) return 0;
    if (isDragging) {
      const maxDistance = 250;
      const distance = Math.sqrt(dragOffset.x ** 2 + dragOffset.y ** 2);
      return Math.max(0.6, 1 - distance / maxDistance * 0.4);
    }
    return 1;
  };

  return (
    <div
      className="fixed inset-0 z-[9999]"
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.92)',
        opacity: isClosing ? 0 : 1,
        transition: 'opacity 0.25s ease-out',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onWheel={handleWheel}
      onClick={(e) => {
        if (e.target === e.currentTarget) startClose();
      }}
    >
      {/* Close Button */}
      <button
        onClick={startClose}
        className="absolute top-6 right-6 z-50 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
        aria-label="Close lightbox"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Image Counter */}
      <div className="absolute top-6 left-6 text-white text-base font-medium z-50">
        {currentIndex + 1} / {images.length}
      </div>

      {/* Instructions */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-white/70 text-sm text-center select-none z-50">
        <p>
          {showFavorite ? 'Swipe ↔ to like/dismiss | ' : ''}Swipe ↕ to navigate | Click to flip
        </p>
      </div>

      {/* Card */}
      <div
        ref={cardRef}
        className="relative cursor-pointer"
        style={{
          width: 'min(90vw, 650px)',
          height: 'min(85vh, 800px)',
          transform: getCardTransform(),
          opacity: getCardOpacity(),
          transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease-out',
          perspective: '1200px',
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (!isDragging && Math.abs(dragOffset.x) < 5 && Math.abs(dragOffset.y) < 5) {
            setIsFlipped(!isFlipped);
          }
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (isDragging) handleMouseUp();
        }}
      >
        <div
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            transition: 'transform 0.6s ease',
            width: '100%',
            height: '100%',
          }}
        >
          {/* Front: Image */}
          <div
            style={{ 
              backfaceVisibility: 'hidden',
              position: 'absolute',
              inset: 0,
            }}
            className="bg-white rounded-2xl shadow-2xl overflow-hidden flex items-center justify-center"
          >
            <img
              src={currentImage.url}
              alt={currentImage.prompt}
              className="max-w-full max-h-full object-contain"
              draggable={false}
            />
            
            {/* Info Icon */}
            <div className="absolute top-5 right-5 bg-black/20 hover:bg-black/30 rounded-full p-2.5 transition-colors">
              <Info className="w-5 h-5 text-white" />
            </div>
          </div>

          {/* Back: Details */}
          <div
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              position: 'absolute',
              inset: 0,
            }}
            className="bg-gradient-to-br from-gray-900 to-black rounded-2xl shadow-2xl p-8 overflow-y-auto"
          >
            <div className="text-white">
              <h3 className="text-xl font-semibold mb-4">Prompt</h3>
              <p className="text-gray-300 leading-relaxed mb-8">
                {currentImage.prompt}
              </p>

              <h4 className="text-lg font-semibold text-gray-400 mb-4">Details</h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Generated:</span>
                  <span className="text-gray-300">{formatDate(currentImage.timestamp)}</span>
                </div>

                {currentImage.metadata?.garmentType && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Garment:</span>
                    <span className="text-gray-300 capitalize">
                      {currentImage.metadata.garmentType}
                    </span>
                  </div>
                )}

                {currentImage.metadata?.silhouette && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Silhouette:</span>
                    <span className="text-gray-300 capitalize">
                      {currentImage.metadata.silhouette}
                    </span>
                  </div>
                )}

                {currentImage.metadata?.fabric && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Fabric:</span>
                    <span className="text-gray-300 capitalize">
                      {currentImage.metadata.fabric}
                    </span>
                  </div>
                )}

                {currentImage.metadata?.colors && currentImage.metadata.colors.length > 0 && (
                  <div>
                    <span className="text-gray-500 block mb-2">Colors:</span>
                    <div className="flex flex-wrap gap-2">
                      {currentImage.metadata.colors.map((color, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-white/10 text-gray-300 rounded-full text-xs capitalize"
                        >
                          {color}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {currentImage.metadata?.styleTags && currentImage.metadata.styleTags.length > 0 && (
                  <div>
                    <span className="text-gray-500 block mb-2">Style Tags:</span>
                    <div className="flex flex-wrap gap-2">
                      {currentImage.metadata.styleTags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-white/10 text-gray-300 rounded-full text-xs capitalize"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 pt-4 border-t border-white/10 text-center">
                <p className="text-xs text-gray-500">Click to flip back • Press I</p>
              </div>
            </div>
          </div>
        </div>

        {/* Like/Dismiss Buttons */}
        {showFavorite && !isFlipped && (
          <div 
            className="absolute -bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-6 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleDismiss}
              className="w-16 h-16 bg-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
              aria-label="Dismiss"
            >
              <X className="w-8 h-8 text-red-500" strokeWidth={2.5} />
            </button>
            
            <button
              onClick={handleLike}
              className="w-16 h-16 bg-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
              aria-label="Like"
            >
              <Heart className="w-8 h-8 text-pink-500" strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>

      {/* Download Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleDownload();
        }}
        className="absolute bottom-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-50"
        aria-label="Download image"
        title="Download (D key)"
      >
        <Download className="w-6 h-6" />
      </button>
    </div>
  );
};

export default Lightbox;
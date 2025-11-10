import React, { useState, useEffect, useRef } from 'react';
import { X, Heart, Download, Info } from 'lucide-react';
import { Badge } from './ui/badge';

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
    details?: string;
    shot?: string;
    texture?: string;
    lighting?: string;
    promptId?: string;
    generationId?: string;
    generatedAt?: string;
    spec?: unknown;
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
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationDirection, setAnimationDirection] = useState<'up' | 'down' | 'left' | 'right' | null>(null);
  
  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const wheelTimeoutRef = useRef<number>(0);

  const currentImage = images[currentIndex];
  const metadata = (currentImage?.metadata || {}) as Record<string, any>;
  const tags =
    Array.isArray(currentImage?.tags) && (currentImage.tags as string[]).length > 0
      ? (currentImage.tags as string[])
      : Array.isArray(metadata.styleTags)
        ? (metadata.styleTags as string[])
        : [];
  const promptText = (currentImage?.prompt || '').trim() || 'Prompt unavailable';
  const displayData = {
    garment: metadata.garmentType || metadata.garment,
    colors: Array.isArray(metadata.colors) ? metadata.colors : [],
    fabric: metadata.fabric || metadata.texture,
    silhouette: metadata.silhouette || metadata.silhouette_type,
    details: metadata.details,
    shot: metadata.shot || metadata.lighting,
  };

  const generatedLabel = (() => {
    const value = resolveGeneratedAt(currentImage);
    if (!value) return 'Unknown';
    return value.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  })();

  // Lock body scroll and ensure full coverage
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalHeight = document.body.style.height;
    
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100vh';
    
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.height = originalHeight;
    };
  }, []);

  // Reset flip when changing cards
  useEffect(() => {
    setIsFlipped(false);
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAnimating) return;
      
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowUp' && currentIndex > 0) {
        goToPrevious();
      } else if (e.key === 'ArrowDown' && currentIndex < images.length - 1) {
        goToNext();
      } else if (e.key === 'i' || e.key === 'I') {
        setIsFlipped(!isFlipped);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isFlipped, images.length, onClose, isAnimating]);

  const goToNext = () => {
    if (isAnimating || currentIndex >= images.length - 1) return;
    setIsAnimating(true);
    setAnimationDirection('up');
    setTimeout(() => {
      setCurrentIndex(currentIndex + 1);
      setIsAnimating(false);
      setAnimationDirection(null);
    }, 350);
  };

  const goToPrevious = () => {
    if (isAnimating || currentIndex <= 0) return;
    setIsAnimating(true);
    setAnimationDirection('down');
    setTimeout(() => {
      setCurrentIndex(currentIndex - 1);
      setIsAnimating(false);
      setAnimationDirection(null);
    }, 350);
  };

  const handleLike = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setAnimationDirection('right');
    if (onLike) onLike(currentImage.id);
    setTimeout(() => {
      if (currentIndex < images.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        onClose();
      }
      setIsAnimating(false);
      setAnimationDirection(null);
    }, 350);
  };

  const handleDismiss = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setAnimationDirection('left');
    if (onDismiss) onDismiss(currentImage.id);
    setTimeout(() => {
      if (currentIndex < images.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        onClose();
      }
      setIsAnimating(false);
      setAnimationDirection(null);
    }, 350);
  };

  // Mouse wheel navigation
  const handleWheel = (e: React.WheelEvent) => {
    if (isAnimating || isFlipped) return;
    
    const now = Date.now();
    if (now - wheelTimeoutRef.current < 500) return;
    wheelTimeoutRef.current = now;

    if (e.deltaY > 0) {
      goToNext();
    } else if (e.deltaY < 0) {
      goToPrevious();
    }
  };

  // Drag handlers
  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (isAnimating || isFlipped) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    setIsDragging(true);
    setDragStart({ x: clientX, y: clientY });
    setDragOffset({ x: 0, y: 0 });
  };

  const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging || isAnimating || isFlipped) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    setDragOffset({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y
    });
  };

  const handleDragEnd = () => {
    if (!isDragging || isAnimating) return;
    
    const { x: deltaX, y: deltaY } = dragOffset;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    const threshold = 80;

    if (absDeltaX > absDeltaY && absDeltaX > threshold && showFavorite) {
      if (deltaX > 0) {
        handleLike();
      } else {
        handleDismiss();
      }
    } else if (absDeltaY > absDeltaX && absDeltaY > threshold) {
      if (deltaY > 0) {
        goToPrevious();
      } else {
        goToNext();
      }
    }
    
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (isDragging || isAnimating) return;
    if (Math.abs(dragOffset.x) > 5 || Math.abs(dragOffset.y) > 5) return;
    
    e.stopPropagation();
    setIsFlipped(!isFlipped);
  };

  // Calculate transforms
  const getCardTransform = () => {
    if (animationDirection) {
      const distance = 1200;
      switch (animationDirection) {
        case 'up': return `translateY(-${distance}px) scale(0.85)`;
        case 'down': return `translateY(${distance}px) scale(0.85)`;
        case 'left': return `translateX(-${distance}px) rotate(-20deg) scale(0.8)`;
        case 'right': return `translateX(${distance}px) rotate(20deg) scale(0.8)`;
      }
    }

    if (isDragging) {
      const { x, y } = dragOffset;
      const rotation = (x / window.innerWidth) * 15;
      return `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
    }

    return 'translate(0, 0)';
  };

  const getCardOpacity = () => {
    if (animationDirection) return 0;
    if (isDragging) {
      const distance = Math.sqrt(dragOffset.x ** 2 + dragOffset.y ** 2);
      return Math.max(0.6, 1 - distance / 400);
    }
    return 1;
  };

  const getDragIndicator = () => {
    if (!isDragging || !showFavorite) return null;
    
    const { x, y } = dragOffset;
    const absDeltaX = Math.abs(x);
    const absDeltaY = Math.abs(y);
    
    if (absDeltaX > absDeltaY && absDeltaX > 40) {
      return x > 0 ? 'like' : 'dismiss';
    }
    return null;
  };

  const dragIndicator = getDragIndicator();

  function resolveGeneratedAt(image: any) {
    if (!image) return null;

    const source =
      image.timestamp ||
      image.createdAt ||
      image.created_at ||
      image?.metadata?.generatedAt ||
      image?.metadata?.generated_at;

    const parsed =
      source instanceof Date ? source : source ? new Date(source) : null;

    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000000',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
      }}
      onWheel={handleWheel}
    >
      {/* Top Bar */}
      <div 
        style={{
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          flexShrink: 0,
        }}
      >
        <div style={{ color: 'white', fontSize: '14px', fontWeight: '500' }}>
          {currentIndex + 1} / {images.length}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>
          Scroll or swipe to navigate • Click to flip
        </div>
        <button
          onClick={onClose}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.1)',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
        >
          <X size={20} />
        </button>
      </div>

      {/* Main Content Area */}
      <div 
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Card - OPTIMIZED FOR PORTRAIT FASHION IMAGES */}
        <div
          style={{
            width: 'min(92vw, 650px)',  // Narrower for portrait images
            height: 'min(88vh, 1000px)', // Taller for portrait images
            maxWidth: '650px',  // Max width for portrait aspect ratio
            maxHeight: '88vh',
            transform: getCardTransform(),
            opacity: getCardOpacity(),
            transition: isDragging ? 'none' : 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
            cursor: isDragging ? 'grabbing' : 'grab',
            position: 'relative',
          }}
          onMouseDown={handleDragStart}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
        >
          {/* Drag Indicator */}
          {dragIndicator && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '20px',
                backgroundColor: dragIndicator === 'like'
                  ? 'rgba(255, 255, 255, 0.08)'
                  : 'rgba(0, 0, 0, 0.3)',
                pointerEvents: 'none',
                zIndex: 10,
              }}
            >
              {dragIndicator === 'like' ? (
                <Heart size={96} color="white" style={{ opacity: 0.6 }} strokeWidth={1.5} />
              ) : (
                <X size={96} color="white" style={{ opacity: 0.6 }} strokeWidth={2} />
              )}
            </div>
          )}

          {/* Card Flipper */}
          <div
            style={{
              width: '100%',
              height: '100%',
              transformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              transition: 'transform 0.6s',
              position: 'relative',
            }}
            onClick={handleCardClick}
          >
            {/* Front - Image */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backfaceVisibility: 'hidden',
                backgroundColor: 'white',
                borderRadius: '20px',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 25px 70px rgba(0,0,0,0.4)',
              }}
            >
              <img
                src={currentImage.url}
                alt=""
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',  // This ensures the image fills properly
                  display: 'block',
                }}
                draggable={false}
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
              <div
                style={{
                  position: 'absolute',
                  bottom: '20px',
                  right: '20px',
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s',
                }}
              >
                <Info size={20} color="white" />
              </div>
            </div>

            {/* Back - Details */}
            <div
              className="absolute inset-0 overflow-y-auto rounded-[20px] bg-white p-8 shadow-2xl"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div className="space-y-6 text-gray-900">
                <div>
                  <p className="text-sm font-medium uppercase tracking-wider text-gray-500">Prompt</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{promptText}</p>
                </div>

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
                      <p className="text-gray-900">{displayData.colors.join(', ')}</p>
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
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div
        style={{
          height: '100px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {showFavorite && !isFlipped ? (
          <div style={{ display: 'flex', gap: '24px' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss();
              }}
              disabled={isAnimating}
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'white',
                border: 'none',
                cursor: isAnimating ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                transition: 'transform 0.2s',
                opacity: isAnimating ? 0.5 : 1,
              }}
              onMouseEnter={(e) => !isAnimating && (e.currentTarget.style.transform = 'scale(1.1)')}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <X size={28} color="#111" strokeWidth={2.5} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleLike();
              }}
              disabled={isAnimating}
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'white',
                border: 'none',
                cursor: isAnimating ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                transition: 'transform 0.2s',
                opacity: isAnimating ? 0.5 : 1,
              }}
              onMouseEnter={(e) => !isAnimating && (e.currentTarget.style.transform = 'scale(1.1)')}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <Heart size={28} color="#111" strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              const link = document.createElement('a');
              link.href = currentImage.url;
              link.download = `podna-${currentImage.id}.png`;
              link.click();
            }}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
          >
            <Download size={20} />
          </button>
        )}
      </div>
    </div>
  );
};

export default Lightbox;

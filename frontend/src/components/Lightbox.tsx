import React, { useState, useEffect, useRef } from 'react';
import { X, Heart, Download, Info } from 'lucide-react';

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
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationDirection, setAnimationDirection] = useState<'up' | 'down' | 'left' | 'right' | null>(null);
  
  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const wheelTimeoutRef = useRef<number>(0);

  const currentImage = images[currentIndex];

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

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
                alt="Design"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',  // This ensures the image fills properly
                  display: 'block',
                }}
                draggable={false}
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
              style={{
                position: 'absolute',
                inset: 0,
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
                borderRadius: '20px',
                padding: '32px',
                overflowY: 'auto',
                color: 'white',
              }}
            >
              <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>Prompt</h3>
              <p style={{ color: '#d1d5db', fontSize: '14px', lineHeight: '1.6', marginBottom: '32px' }}>
                {currentImage.prompt}
              </p>

              <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#9ca3af' }}>Details</h4>
              <div style={{ fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '12px' }}>
                  <span style={{ color: '#6b7280' }}>Generated</span>
                  <span style={{ color: '#d1d5db' }}>{formatDate(currentImage.timestamp)}</span>
                </div>

                {currentImage.metadata?.garmentType && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '12px' }}>
                    <span style={{ color: '#6b7280' }}>Garment</span>
                    <span style={{ color: '#d1d5db', textTransform: 'capitalize' }}>{currentImage.metadata.garmentType}</span>
                  </div>
                )}

                {currentImage.metadata?.silhouette && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '12px' }}>
                    <span style={{ color: '#6b7280' }}>Silhouette</span>
                    <span style={{ color: '#d1d5db', textTransform: 'capitalize' }}>{currentImage.metadata.silhouette}</span>
                  </div>
                )}

                {currentImage.metadata?.fabric && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '12px' }}>
                    <span style={{ color: '#6b7280' }}>Fabric</span>
                    <span style={{ color: '#d1d5db', textTransform: 'capitalize' }}>{currentImage.metadata.fabric}</span>
                  </div>
                )}

                {currentImage.metadata?.colors && currentImage.metadata.colors.length > 0 && (
                  <div style={{ paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '12px' }}>
                    <span style={{ color: '#6b7280', display: 'block', marginBottom: '8px' }}>Colors</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {currentImage.metadata.colors.map((color, idx) => (
                        <span
                          key={idx}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            color: '#d1d5db',
                            borderRadius: '16px',
                            fontSize: '12px',
                            textTransform: 'capitalize',
                          }}
                        >
                          {color}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {currentImage.metadata?.styleTags && currentImage.metadata.styleTags.length > 0 && (
                  <div>
                    <span style={{ color: '#6b7280', display: 'block', marginBottom: '8px' }}>Style Tags</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {currentImage.metadata.styleTags.map((tag, idx) => (
                        <span
                          key={idx}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            color: '#d1d5db',
                            borderRadius: '16px',
                            fontSize: '12px',
                            textTransform: 'capitalize',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
                <p style={{ fontSize: '11px', color: '#6b7280' }}>Click to flip back</p>
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
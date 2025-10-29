import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Heart, X, XIcon, Grid3x3, Grid2x2, Info, Settings, Clock } from 'lucide-react';
import authAPI from '../services/authAPI';
import CommandBar from '../components/CommandBar';
import ImageCard from '../components/ImageCard';

interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: Date;
  metadata?: {
    garmentType?: string;
    silhouette?: string;
    colors?: string[];
    texture?: string;
    lighting?: string;
    generatedAt?: string;
    model?: string;
    confidence?: number;
  };
  tags?: string[];
}

interface ImageLightboxProps {
  images: GeneratedImage[];
  currentIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onFeedback: (imageId: string, liked: boolean) => void;
}

const ImageLightbox: React.FC<ImageLightboxProps> = ({
  images,
  currentIndex,
  onClose,
  onNext,
  onPrevious,
  onFeedback,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  
  const currentImage = images[currentIndex];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && currentIndex > 0) onPrevious();
      if (e.key === 'ArrowRight' && currentIndex < images.length - 1) onNext();
      if (e.key === 'i' || e.key === 'I') setIsFlipped(!isFlipped);
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, images.length, isFlipped, onClose, onNext, onPrevious]);

  // Reset flip state when changing images
  useEffect(() => {
    setIsFlipped(false);
  }, [currentIndex]);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart || !isDragging) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    
    setDragOffset({ x: deltaX, y: deltaY });
  };

  const handleTouchEnd = () => {
    if (!touchStart || !isDragging) return;
    
    const { x: deltaX } = dragOffset;
    const threshold = 100;
    
    // Only horizontal swipe (like/dislike)
    if (Math.abs(deltaX) > threshold) {
      if (deltaX > 0) {
        handleSwipeLike();
      } else {
        handleSwipePass();
      }
    } else {
      resetDrag();
    }
  };

  // Mouse handlers for desktop drag
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setTouchStart({ x: e.clientX, y: e.clientY });
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!touchStart || !isDragging) return;
    
    const deltaX = e.clientX - touchStart.x;
    const deltaY = e.clientY - touchStart.y;
    
    setDragOffset({ x: deltaX, y: deltaY });
  };

  const handleMouseUp = () => {
    if (!touchStart || !isDragging) return;
    
    const { x: deltaX } = dragOffset;
    const threshold = 100;
    
    // Only horizontal drag (like/dislike)
    if (Math.abs(deltaX) > threshold) {
      if (deltaX > 0) {
        handleSwipeLike();
      } else {
        handleSwipePass();
      }
    } else {
      resetDrag();
    }
  };

  // Add global mouse up listener to handle releasing outside the card
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        if (!touchStart) return;
        const deltaX = e.clientX - touchStart.x;
        const deltaY = e.clientY - touchStart.y;
        setDragOffset({ x: deltaX, y: deltaY });
      };

      const handleGlobalMouseUp = () => {
        if (!touchStart) return;
        const { x: deltaX } = dragOffset;
        const threshold = 100;
        
        if (Math.abs(deltaX) > threshold) {
          if (deltaX > 0) {
            handleSwipeLike();
          } else {
            handleSwipePass();
          }
        } else {
          resetDrag();
        }
      };

      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      
      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDragging, touchStart, dragOffset]);

  const resetDrag = () => {
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
    setTouchStart(null);
  };

  const handleSwipeLike = () => {
    setIsExiting(true);
    setDragOffset({ x: window.innerWidth || 1000, y: 0 });
    setTimeout(() => {
      onFeedback(currentImage.id, true);
      if (currentIndex < images.length - 1) {
        onNext();
      } else {
        onClose();
      }
      setIsExiting(false);
      resetDrag();
    }, 300);
  };

  const handleSwipePass = () => {
    setIsExiting(true);
    setDragOffset({ x: -(window.innerWidth || 1000), y: 0 });
    setTimeout(() => {
      onFeedback(currentImage.id, false);
      if (currentIndex < images.length - 1) {
        onNext();
      } else {
        onClose();
      }
      setIsExiting(false);
      resetDrag();
    }, 300);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTransform = () => {
    if (isExiting) {
      const { x } = dragOffset;
      const rotation = x > 0 ? 15 : -15;
      return `translateX(${x}px) rotate(${rotation}deg)`;
    }
    
    if (isDragging) {
      const rotation = Math.max(-15, Math.min(15, dragOffset.x / 20));
      return `translate(${dragOffset.x}px, ${dragOffset.y}px) rotate(${rotation}deg)`;
    }
    
    return 'translate(0, 0) rotate(0deg)';
  };

  const getOpacity = () => {
    if (isExiting) return 0;
    if (isDragging) {
      const distance = Math.sqrt(dragOffset.x ** 2 + dragOffset.y ** 2);
      return Math.max(0.5, 1 - distance / 500);
    }
    return 1;
  };

  return (
    <div 
      className="fixed inset-0 bg-black/90 z-50 overflow-hidden"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-50"
        aria-label="Close"
      >
        <XIcon className="w-6 h-6" />
      </button>

      {/* Instructions */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-white/60 text-sm text-center pointer-events-none z-40">
        <p>Drag → to like • Drag ← to pass • Arrow keys to browse</p>
      </div>

      {/* Counter */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white text-lg font-medium pointer-events-none z-40">
        {currentIndex + 1} / {images.length}
      </div>

      {/* Swipeable Card Container - positioned higher */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ paddingTop: '3rem', paddingBottom: '8rem' }}>
        <div
          className="relative w-[85vw] h-full max-w-5xl max-h-[70vh]"
          onClick={(e) => e.stopPropagation()}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{
            perspective: '1000px',
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
        >
        <div
          className="relative w-full h-full"
          style={{
            transform: getTransform(),
            opacity: getOpacity(),
            transition: isDragging ? 'none' : 'transform 0.3s ease, opacity 0.3s ease',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Card Inner (with flip) */}
          <div
            className="relative w-full h-full"
            style={{
              transformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              transition: 'transform 0.6s',
            }}
          >
            {/* Front: Image */}
            <div
              className="absolute inset-0 rounded-2xl overflow-hidden bg-black flex items-center justify-center"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <img
                src={currentImage.url}
                alt={currentImage.prompt}
                className="max-w-full max-h-full object-contain"
                draggable={false}
              />
              
              {/* Info button overlay */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFlipped(!isFlipped);
                }}
                className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 rounded-full p-3 transition-colors z-10"
                aria-label="Show info"
              >
                <Info className="w-6 h-6 text-white" />
              </button>

              {/* Swipe feedback overlays */}
              {isDragging && Math.abs(dragOffset.x) > Math.abs(dragOffset.y) && (
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  style={{
                    backgroundColor: dragOffset.x > 0 
                      ? `rgba(34, 197, 94, ${Math.min(Math.abs(dragOffset.x) / 200, 0.5)})` 
                      : `rgba(239, 68, 68, ${Math.min(Math.abs(dragOffset.x) / 200, 0.5)})`,
                  }}
                >
                  {dragOffset.x > 0 ? (
                    <Heart className="w-24 h-24 text-white fill-white" />
                  ) : (
                    <X className="w-24 h-24 text-white" />
                  )}
                </div>
              )}
            </div>

            {/* Back: Details */}
            <div
              className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black rounded-2xl p-8 overflow-y-auto"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              {/* Info button on back to flip back */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFlipped(!isFlipped);
                }}
                className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 rounded-full p-3 transition-colors z-10"
                aria-label="Hide info"
              >
                <Info className="w-6 h-6 text-white" />
              </button>

              <h3 className="text-2xl font-semibold text-white mb-4">Prompt</h3>
              <p className="text-gray-200 text-base leading-relaxed mb-8">
                {currentImage.prompt}
              </p>

              <h4 className="text-xl font-semibold text-gray-300 mb-4">Details</h4>
              <div className="space-y-3">
                <div className="flex justify-between text-base">
                  <span className="text-gray-400">Generated:</span>
                  <span className="text-gray-100">{formatDate(currentImage.timestamp)}</span>
                </div>

                {currentImage.metadata?.garmentType && (
                  <div className="flex justify-between text-base">
                    <span className="text-gray-400">Garment:</span>
                    <span className="text-gray-100 capitalize">{currentImage.metadata.garmentType}</span>
                  </div>
                )}

                {currentImage.metadata?.silhouette && (
                  <div className="flex justify-between text-base">
                    <span className="text-gray-400">Silhouette:</span>
                    <span className="text-gray-100 capitalize">{currentImage.metadata.silhouette}</span>
                  </div>
                )}

                {currentImage.metadata?.colors && currentImage.metadata.colors.length > 0 && (
                  <div>
                    <span className="text-gray-400 block mb-2">Colors:</span>
                    <div className="flex flex-wrap gap-2">
                      {currentImage.metadata.colors.map((color, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-white/10 text-gray-200 rounded-full text-sm capitalize"
                        >
                          {color}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-white/10 text-center">
                <p className="text-sm text-gray-400">Click info button or press I key to flip back</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons - pass and like only */}
        <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-8 pointer-events-auto">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSwipePass();
            }}
            className="w-16 h-16 rounded-full bg-white hover:bg-gray-100 text-gray-800 shadow-2xl flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
            aria-label="Pass"
          >
            <X className="w-8 h-8" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSwipeLike();
            }}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-2xl flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
            aria-label="Like"
          >
            <Heart className="w-8 h-8 fill-current" />
          </button>
        </div>
      </div>
      </div>
    </div>
  );
};

const Home: React.FC = () => {
  const location = useLocation();
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [gridView, setGridView] = useState<'small' | 'large'>('large');
  const [shouldHighlightSuggestions, setShouldHighlightSuggestions] = useState(true);
  const [feedback, setFeedback] = useState<Record<string, 'liked' | 'disliked' | null>>({});
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [nextRunTime, setNextRunTime] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadImages();

    const now = new Date();
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    next.setHours(23, 0, 0, 0);

    const isToday = now.toDateString() === next.toDateString();
    const time = next.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    setNextRunTime(isToday ? `Today at ${time}` : `Tomorrow at ${time}`);

    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }

    highlightTimeoutRef.current = setTimeout(() => {
      setShouldHighlightSuggestions(false);
      highlightTimeoutRef.current = null;
    }, 60000);

    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (location.pathname === '/home') {
      setShouldHighlightSuggestions(true);

      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }

      highlightTimeoutRef.current = setTimeout(() => {
        setShouldHighlightSuggestions(false);
        highlightTimeoutRef.current = null;
      }, 60000);
    }

    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, [location.pathname]);

  const loadImages = async () => {
    setLoading(true);
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const designerId = currentUser.id;

      // Determine the correct localStorage key
      const storageKey = designerId ? `generatedImages_${designerId}` : 'generatedImages';

      if (!designerId) {
        const storedImages = localStorage.getItem('generatedImages');
        if (storedImages) {
          const parsed = JSON.parse(storedImages);
          setImages(parsed);
        }
        setLoading(false);
        return;
      }

      // Load from localStorage first (for images generated via voice command)
      let localImages: GeneratedImage[] = [];
      const storedImages = localStorage.getItem(storageKey);
      if (storedImages) {
        try {
          localImages = JSON.parse(storedImages);
        } catch (e) {
          console.error('Error parsing stored images:', e);
        }
      }

      // Try to fetch from API
      try {
        const token = authAPI.getToken();
        const response = await fetch(`http://localhost:3001/api/podna/gallery`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const result = await response.json();

          if (result.success && result.data && result.data.generations && result.data.generations.length > 0) {
            const apiImages: GeneratedImage[] = result.data.generations.map((img: any) => {
              const timestamp = img.createdAt ? new Date(img.createdAt) : new Date();
              return {
                id: img.id || `img-${Date.now()}-${Math.random()}`,
                url: img.url,
                prompt: img.promptText || 'AI generated from your style profile',
                timestamp: timestamp,
                metadata: img.metadata || {},
                tags: img.tags || []
              };
            });

            // Merge local images with API images, removing duplicates by ID
            const imageMap = new Map<string, GeneratedImage>();

            // Add API images first
            apiImages.forEach(img => imageMap.set(img.id, img));

            // Add local images (will override API images if same ID, or add new ones)
            localImages.forEach(img => imageMap.set(img.id, img));

            const mergedImages = Array.from(imageMap.values())
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            setImages(mergedImages);
            localStorage.setItem(storageKey, JSON.stringify(mergedImages));
          } else {
            // API returned no images, but keep local images
            setImages(localImages);
          }
        } else {
          // API request failed, use local images
          console.warn('Failed to fetch from API, using local images');
          setImages(localImages);
        }
      } catch (apiError) {
        // API error, use local images
        console.error('Error fetching from API:', apiError);
        setImages(localImages);
      }
    } catch (error) {
      console.error('Error loading images:', error);
      // Don't clear images on error, try to load from localStorage
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const designerId = currentUser.id;
      const storageKey = designerId ? `generatedImages_${designerId}` : 'generatedImages';
      const storedImages = localStorage.getItem(storageKey);
      if (storedImages) {
        try {
          setImages(JSON.parse(storedImages));
        } catch (e) {
          setImages([]);
        }
      } else {
        setImages([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (imageId: string, liked: boolean) => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = currentUser.id;

      if (!userId) {
        console.warn('No user ID, feedback not saved');
        return;
      }

      setFeedback({ ...feedback, [imageId]: liked ? 'liked' : 'disliked' });

      const token = authAPI.getToken();
      const response = await fetch('http://localhost:3001/api/agents/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify([{
          image_id: imageId,
          designer_id: userId,
          selected: liked,
          rejected: !liked
        }])
      });

      if (response.ok) {
        console.log('✅ Feedback submitted successfully');
      } else {
        console.error('❌ Feedback submission failed');
      }
    } catch (err: any) {
      console.error('❌ Error submitting feedback:', err);
    }
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const nextImage = () => {
    if (lightboxIndex < images.length - 1) {
      setLightboxIndex(lightboxIndex + 1);
    }
  };

  const previousImage = () => {
    if (lightboxIndex > 0) {
      setLightboxIndex(lightboxIndex - 1);
    }
  };

  const handleGenerate = async (e?: React.FormEvent | string) => {
    if (e && typeof e === 'object' && 'preventDefault' in e) {
      e.preventDefault();
    }

    const commandText = typeof e === 'string' ? e : '';
    if (!commandText.trim()) return;

    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = currentUser.id;

      // Determine the correct localStorage key
      const storageKey = userId ? `generatedImages_${userId}` : 'generatedImages';

      const token = authAPI.getToken();
      const response = await fetch('http://localhost:3001/api/generate/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId,
          description: commandText,
          model: 'google-imagen',
          count: 1
        })
      });

      if (!response.ok) {
        throw new Error('Generation failed');
      }

      const result = await response.json();

      if (result.success && result.assets && result.assets.length > 0) {
        const newImages: GeneratedImage[] = result.assets.map((img: any, idx: number) => ({
          id: img.id?.toString() || `gen-${Date.now()}-${idx}`,
          url: img.url || img.cdnUrl || img.cdn_url, // Support both camelCase and snake_case
          prompt: commandText,
          timestamp: new Date()
        }));

        const updated = [...newImages, ...images];
        setImages(updated);

        // Save to the correct localStorage key based on whether user is logged in
        localStorage.setItem(storageKey, JSON.stringify(updated));

        console.log('✅ Generation successful:', {
          count: newImages.length,
          command: commandText,
          storageKey,
          assets: result.assets
        });
      }
    } catch (err: any) {
      console.error('❌ Generation failed:', err);
    }
  };

  const handleAutoGenerateToggle = () => {
    setAutoGenerate(!autoGenerate);
  };

  const handleCardLike = async (e: React.MouseEvent, imageId: string) => {
    e.stopPropagation();
    await handleFeedback(imageId, true);
  };

  const handleCardDislike = async (e: React.MouseEvent, imageId: string) => {
    e.stopPropagation();
    await handleFeedback(imageId, false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-gray-900" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
                Your Generations
              </h1>
              <span className="text-sm sm:text-base text-gray-600">
                {images.length}
              </span>
            </div>

            <div className="flex items-center gap-4 sm:gap-6">
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={autoGenerate}
                      onChange={handleAutoGenerateToggle}
                      className="w-5 h-5 rounded cursor-pointer"
                    />
                    <span className="hidden sm:inline">Auto-generate</span>
                  </label>
                  {autoGenerate && (
                    <span className="text-xs text-gray-500 flex items-center gap-1 ml-7">
                      <Clock className="w-3 h-3" />
                      Next: {nextRunTime}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                aria-label="Settings"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-8">
        <div className="mb-6 flex justify-end">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setGridView('large')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                gridView === 'large'
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Large Grid"
            >
              <Grid2x2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setGridView('small')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                gridView === 'small'
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Small Grid"
            >
              <Grid3x3 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {images.length > 0 ? (
          <div
            className={
              gridView === 'small'
                ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4'
                : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8'
            }
          >
            {images.map((image, index) => (
              <ImageCard
                key={image.id}
                image={image}
                onClick={() => openLightbox(index)}
                onLike={(e) => handleCardLike(e, image.id)}
                onDislike={(e) => handleCardDislike(e, image.id)}
                feedback={feedback[image.id]}
                size={gridView}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg">No images yet. Start generating designs.</p>
          </div>
        )}

        {lightboxOpen && (
          <ImageLightbox
            images={images}
            currentIndex={lightboxIndex}
            onClose={closeLightbox}
            onNext={nextImage}
            onPrevious={previousImage}
            onFeedback={handleFeedback}
          />
        )}

        <CommandBar
          onCommandExecute={handleGenerate}
          highlightSuggestions={shouldHighlightSuggestions}
        />
      </div>
    </div>
  );
};

export default Home;
import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { RotateCcw, Heart, X, XIcon, Grid3x3, Grid2x2, Info, Settings, Clock } from 'lucide-react';
import authAPI from '../services/authAPI';
import CommandBar from '../components/CommandBar';
import ImageCard from '../components/ImageCard';
import ImageModal from '../components/ImageModal';

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
  const [feedback, setFeedback] = useState<Record<string, 'liked' | 'disliked' | null>>({});
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
  const [touchCurrent, setTouchCurrent] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState({ x: 0, y: 0 });
  const [swipeFeedback, setSwipeFeedback] = useState<'like' | 'dislike' | null>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);

  const [entered, setEntered] = useState(false);
  const [enterFrom, setEnterFrom] = useState<'bottom' | 'top'>('bottom');
  const prevIndexRef = useRef(currentIndex);
  const [isClosing, setIsClosing] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [exitX, setExitX] = useState(0);
  const [exitY, setExitY] = useState(0);
  const wheelTimeRef = useRef(0);

  const currentImage = images[currentIndex];

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.targetTouches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setTouchCurrent({ x: touch.clientX, y: touch.clientY });
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    const touch = e.targetTouches[0];
    setTouchCurrent({ x: touch.clientX, y: touch.clientY });

    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;

    // Determine if horizontal or vertical swipe
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // Horizontal swipe - for like/dislike
      setSwipeOffset({ x: deltaX, y: 0 });
      if (deltaX > 50) {
        setSwipeFeedback('like');
      } else if (deltaX < -50) {
        setSwipeFeedback('dislike');
      } else {
        setSwipeFeedback(null);
      }
    } else {
      // Vertical swipe - for navigation
      setSwipeOffset({ x: 0, y: deltaY });
      setSwipeFeedback(null);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;

    const deltaX = touchCurrent.x - touchStart.x;
    const deltaY = touchCurrent.y - touchStart.y;

    const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);

    if (isHorizontal) {
      // Horizontal swipe - like/dislike with exit animation
      if (Math.abs(deltaX) > 120) {
        const dir = deltaX > 0 ? 1 : -1; // right like, left dismiss
        setIsExiting(true);
        setExitX(dir * (window.innerWidth || 1000));
        setSwipeFeedback(dir > 0 ? 'like' : 'dislike');
        setTimeout(() => {
          onFeedback(currentImage.id, dir > 0);
          setFeedback({ ...feedback, [currentImage.id]: dir > 0 ? 'liked' : 'disliked' });
          onNext();
          setIsExiting(false);
          setExitX(0);
        }, 320);
      }
    } else {
      // Vertical swipe - navigate between images
      if (deltaY < -100 && currentIndex < images.length - 1) {
        // Swipe up -> next
        setIsExiting(true);
        setExitY(-1 * (window.innerHeight || 800));
        setTimeout(() => {
          onNext();
          setIsExiting(false);
          setExitY(0);
        }, 300);
      } else if (deltaY > 100 && currentIndex > 0) {
        // Swipe down -> previous
        setIsExiting(true);
        setExitY(1 * (window.innerHeight || 800));
        setTimeout(() => {
          onPrevious();
          setIsExiting(false);
          setExitY(0);
        }, 300);
      }
    }

    // Reset drag capture
    setIsDragging(false);
    setSwipeOffset({ x: 0, y: 0 });
    setSwipeFeedback(null);
    setTouchStart({ x: 0, y: 0 });
    setTouchCurrent({ x: 0, y: 0 });
  };

  const handleFeedback = (liked: boolean) => {
    setFeedback({ ...feedback, [currentImage.id]: liked ? 'liked' : 'disliked' });
    onFeedback(currentImage.id, liked);
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

  // Animate entrance on index change
  useEffect(() => {
    const from: 'bottom' | 'top' = currentIndex > prevIndexRef.current ? 'bottom' : 'top';
    setEnterFrom(from);
    prevIndexRef.current = currentIndex;

    setEntered(false);
    const id = setTimeout(() => setEntered(true), 20);
    return () => clearTimeout(id);
  }, [currentIndex]);

  const startClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 220);
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') startClose();
      if (e.key === 'ArrowLeft') {
        onPrevious();
      }
      if (e.key === 'ArrowRight') {
        onNext();
      }
      // Add support for up/down arrow keys to navigate images
      if (e.key === 'ArrowUp') {
        onPrevious();
      }
      if (e.key === 'ArrowDown') {
        onNext();
      }
      // Add 'i' key to flip card
      if (e.key === 'i' || e.key === 'I') {
        setIsFlipped(!isFlipped);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onClose, onNext, onPrevious, isFlipped]);

  // Scroll handler for mouse wheel navigation (throttled)
  const handleWheel = (e: React.WheelEvent) => {
    const now = Date.now();
    if (now - wheelTimeRef.current < 450) return;
    wheelTimeRef.current = now;

    if (e.deltaY < 0 && currentIndex > 0) {
      // Scroll up -> previous image (card moves down)
      setIsExiting(true);
      setExitY(1 * (window.innerHeight || 800));
      setTimeout(() => {
        onPrevious();
        setIsExiting(false);
        setExitY(0);
      }, 300);
    } else if (e.deltaY > 0 && currentIndex < images.length - 1) {
      // Scroll down -> next image (card moves up)
      setIsExiting(true);
      setExitY(-1 * (window.innerHeight || 800));
      setTimeout(() => {
        onNext();
        setIsExiting(false);
        setExitY(0);
      }, 300);
    }
  };

  return (
    <div
      ref={lightboxRef}
      className="fixed inset-0 w-screen h-screen bg-black/85 z-50 overflow-y-auto overscroll-contain transition-opacity"
      onWheel={handleWheel}
      onClick={startClose}
      style={{ opacity: isClosing ? 0 : 1 }}
    >
      {/* Close button */}
      <button
        onClick={(e) => { e.stopPropagation(); startClose(); }}
        className="absolute top-6 right-6 z-50 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
        aria-label="Close lightbox"
      >
        <XIcon className="w-6 h-6" />
      </button>

      {/* Swipe Instructions */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-white/60 text-sm text-center select-none pointer-events-none">
        <p>Swipe ↑ ↓ to navigate | Swipe → to like | Swipe ← to pass</p>
      </div>

      {/* Counter */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white text-base font-medium pointer-events-none">
        {currentIndex + 1} / {images.length}
      </div>

      {/* Main Content with Swipe Animation */}
      <div
        className="relative w-full min-h-[100vh]"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Sticky centered card wrapper to keep card fixed while scrolling */}
        <div className="sticky top-0 h-screen flex items-center justify-center">
          <div
            className="relative w-[90vw] h-[90vh] cursor-pointer"
            onClick={(e) => { e.stopPropagation(); setIsFlipped(!isFlipped); }}
            style={{
              perspective: '1000px',
              transform: `translate(${isExiting ? exitX : swipeOffset.x}px, ${isExiting ? exitY : swipeOffset.y}px) rotate(${(isExiting && exitX !== 0) ? (exitX > 0 ? 12 : -12) : (isDragging && Math.abs(swipeOffset.x) > Math.abs(swipeOffset.y) ? Math.max(-12, Math.min(12, swipeOffset.x / 10)) : 0)}deg) scale(${entered ? 1 : 0.8})`,
              transition: isDragging ? 'none' : 'transform 0.35s ease, opacity 0.35s ease',
              opacity: isClosing ? 0 : (isExiting ? 0 : 1),
            }}
          >
            <div
              style={{
                transformStyle: 'preserve-3d',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                transition: 'transform 0.6s',
              }}
              className="relative w-full h-full"
            >
              {/* Front: Image */}
              <div
                style={{ backfaceVisibility: 'hidden' }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <img
                  src={currentImage.url}
                  alt={currentImage.prompt}
                  className="max-w-full max-h-full object-contain"
                  draggable={false}
                />
                {/* Info Icon Indicator */}
                <div className="absolute top-6 right-6 bg-white/20 hover:bg-white/30 rounded-full p-3 transition-opacity">
                  <Info className="w-6 h-6 text-white" />
                </div>
              </div>

              {/* Back: Prompt and Details */}
              <div
                style={{
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                }}
                className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black p-12 flex flex-col"
              >
                <div className="flex-1 overflow-y-auto">
                  <h3 className="text-2xl font-semibold text-white mb-6">Prompt</h3>
                  <p className="text-gray-200 text-lg leading-relaxed mb-10">
                    {currentImage.prompt}
                  </p>

                  <div className="mt-8">
                    <h4 className="text-xl font-semibold text-gray-300 mb-6">Details</h4>
                    <div className="space-y-4 text-lg">
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

                      {currentImage.metadata?.colors && currentImage.metadata.colors.length > 0 && (
                        <div>
                          <span className="text-gray-400 block mb-3">Colors:</span>
                          <div className="flex flex-wrap gap-2">
                            {currentImage.metadata.colors.map((color, idx) => (
                              <span
                                key={idx}
                                className="px-4 py-2 bg-white/10 text-gray-200 rounded-full text-base capitalize"
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
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-white/10 text-center">
                  <p className="text-base text-gray-400">Click to flip back | Press I key</p>
                </div>
              </div>
            </div>

            {/* Bottom Like/Pass Controls over the card */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-8 pointer-events-auto">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSwipeFeedback('dislike');
                  setIsExiting(true);
                  setExitX(-1 * (window.innerWidth || 1000));
                  setTimeout(() => {
                    handleFeedback(false);
                    onNext();
                    setIsExiting(false);
                    setExitX(0);
                  }, 320);
                }}
                className="w-14 h-14 rounded-full bg-white text-gray-800 shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                aria-label="Pass"
              >
                <X className="w-7 h-7" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSwipeFeedback('like');
                  setIsExiting(true);
                  setExitX(1 * (window.innerWidth || 1000));
                  setTimeout(() => {
                    handleFeedback(true);
                    onNext();
                    setIsExiting(false);
                    setExitX(0);
                  }, 320);
                }}
                className="w-14 h-14 rounded-full bg-white text-gray-800 shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                aria-label="Like"
              >
                <Heart className="w-7 h-7" />
              </button>
            </div>
          </div>
        </div>

        {/* Scroll spacer to show scrollbar movement */}
        <div aria-hidden className="pointer-events-none" style={{ height: `${Math.max(1, images.length) * 100}vh` }} />
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
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
  const [touchEnd, setTouchEnd] = useState(0);
  const [shouldHighlightSuggestions, setShouldHighlightSuggestions] = useState(true);
  const [feedback, setFeedback] = useState<Record<string, 'liked' | 'disliked' | null>>({});
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [nextRunTime, setNextRunTime] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadImages();

    // Calculate next run time for auto-generate
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

    if (isToday) {
      setNextRunTime(`Today at ${time}`);
    } else {
      setNextRunTime(`Tomorrow at ${time}`);
    }

    // Set a timer to stop highlighting after 60 seconds
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
      // Reset the highlighting when navigating to the home page
      setShouldHighlightSuggestions(true);

      // Clear any existing timeout
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }

      // Set a new timeout to stop highlighting after 60 seconds
      highlightTimeoutRef.current = setTimeout(() => {
        setShouldHighlightSuggestions(false);
        highlightTimeoutRef.current = null;
      }, 60000); // Stop highlighting after 60 seconds
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

      if (!designerId) {
        // Not logged in, check localStorage only
        const storedImages = localStorage.getItem('generatedImages');
        if (storedImages) {
          const parsed = JSON.parse(storedImages);
          setImages(parsed);
        }
        setLoading(false);
        return;
      }

      // Fetch from backend (via Node.js API)
      const token = authAPI.getToken();
      const response = await fetch(`http://localhost:3001/api/podna/gallery`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch images');
      }

      const result = await response.json();
      console.log('📸 Images API response for user:', designerId, result);

      if (result.success && result.data && result.data.generations && result.data.generations.length > 0) {
        const loadedImages: GeneratedImage[] = result.data.generations.map((img: any) => {
          console.log('🖼️ Processing image:', img);
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
        console.log('✅ Loaded images for user', designerId, ':', loadedImages.length);
        setImages(loadedImages);
        // Save to localStorage with user ID to prevent cross-contamination
        localStorage.setItem(`generatedImages_${designerId}`, JSON.stringify(loadedImages));
        // Clear old generatedImages key
        localStorage.removeItem('generatedImages');
      } else {
        // No images from API - clear state instead of using old data
        console.log('No images found for user:', designerId);
        setImages([]);
        localStorage.removeItem(`generatedImages_${designerId}`);
        localStorage.removeItem('generatedImages');
      }
    } catch (error) {
      console.error('Error loading images:', error);
      // Don't fallback to old user's data - just show empty
      setImages([]);
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

      console.log(`📊 Submitting feedback: ${liked ? 'liked' : 'disliked'} image ${imageId}`);

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
    // Handle both form submission and voice command string
    if (e && typeof e === 'object' && 'preventDefault' in e) {
      e.preventDefault();
    }

    const commandText = typeof e === 'string' ? e : '';
    if (!commandText.trim()) return;

    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = currentUser.id;

      console.log('🎨 Starting generation:', { userId, prompt: commandText });

      // Use the REAL generation pipeline (VLT + prompt templates + style profile + RLHF)
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
      console.log('✅ Generation complete:', result);

      if (result.success && result.assets && result.assets.length > 0) {
        const newImages: GeneratedImage[] = result.assets.map((img: any, idx: number) => ({
          id: img.id || `gen-${Date.now()}-${idx}`,
          url: img.url || img.cdnUrl,
          prompt: commandText,
          timestamp: new Date()
        }));

        const updated = [...newImages, ...images];
        setImages(updated);
        localStorage.setItem('generatedImages', JSON.stringify(updated));
      }
    } catch (err: any) {
      console.error('❌ Generation failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-gray-900" />
      </div>
    );
  }

  // Handle touch events for swipe navigation in grid
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart.x || !touchEnd) return;

    const distance = touchStart.x - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    // Only handle horizontal swipes in grid view
    if (isLeftSwipe || isRightSwipe) {
      // Prevent default behavior to avoid scrolling
      if (gridRef.current) {
        gridRef.current.style.pointerEvents = 'none';
        setTimeout(() => {
          if (gridRef.current) {
            gridRef.current.style.pointerEvents = 'auto';
          }
        }, 300);
      }
    }

    setTouchStart({ x: 0, y: 0 });
    setTouchEnd(0);
  };

  const handleAutoGenerateToggle = () => {
    setAutoGenerate(!autoGenerate);
    // TODO: Call API to save preference
  };

  const handleCardLike = async (e: React.MouseEvent, imageId: string) => {
    e.stopPropagation();
    setFeedback({ ...feedback, [imageId]: 'liked' });
    await handleFeedback(imageId, true);
  };

  const handleCardDislike = async (e: React.MouseEvent, imageId: string) => {
    e.stopPropagation();
    setFeedback({ ...feedback, [imageId]: 'disliked' });
    await handleFeedback(imageId, false);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Control Bar */}
      <header className="sticky top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Left Section */}
            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
                Your Generations
              </h1>
              <span className="text-sm sm:text-base text-gray-600">
                {images.length} {images.length === 1 ? 'image' : 'images'}
              </span>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-4 sm:gap-6">
              {/* Auto-Generate Toggle */}
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

              {/* Settings Button */}
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
        {/* Grid View Controls */}
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

        {/* Images Grid */}
        {images.length > 0 ? (
          <div
            ref={gridRef}
            className={
              gridView === 'small'
                ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4'
                : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8'
            }
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
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
            <p className="text-gray-400 text-lg">No images yet. Start by generating your first design above.</p>
          </div>
        )}

        {/* Lightbox Modal - Moved outside the main content flow */}
        {lightboxOpen && (
          <div className="fixed inset-0 z-50">
            <ImageLightbox
              images={images}
              currentIndex={lightboxIndex}
              onClose={closeLightbox}
              onNext={nextImage}
              onPrevious={previousImage}
              onFeedback={handleFeedback}
            />
          </div>
        )}

        {/* Voice Command Bar - with highlighting for suggestions */}
        <CommandBar
          onCommandExecute={handleGenerate}
          highlightSuggestions={shouldHighlightSuggestions}
        />
      </div>
    </div>
  );
};

export default Home;
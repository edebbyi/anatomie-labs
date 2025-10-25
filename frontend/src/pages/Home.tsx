import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Heart, X, ChevronLeft, ChevronRight, XIcon, Grid3x3, Grid2x2 } from 'lucide-react';
import authAPI from '../services/authAPI';
import CommandBar from '../components/CommandBar';

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
  const [touchEnd, setTouchEnd] = useState({ x: 0, y: 0 });
  const lightboxRef = useRef<HTMLDivElement>(null);

  const currentImage = images[currentIndex];

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };

  const handleTouchEnd = () => {
    if (!touchStart.x || !touchEnd.x) return;
    
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const isLeftSwipe = distanceX > 50;
    const isRightSwipe = distanceX < -50;
    const isUpSwipe = distanceY > 50;
    const isDownSwipe = distanceY < -50;
    
    // Horizontal swipes for next/previous image
    if (isLeftSwipe) {
      onNext();
    }
    
    if (isRightSwipe) {
      onPrevious();
    }
    
    // Vertical swipes for next/previous image
    if (isUpSwipe || isDownSwipe) {
      // Up or down swipe navigates to next/previous image
      if (isUpSwipe) {
        onNext();
      } else {
        onPrevious();
      }
    }
    
    setTouchStart({ x: 0, y: 0 });
    setTouchEnd({ x: 0, y: 0 });
  };

  const handleFeedback = (liked: boolean) => {
    setFeedback({ ...feedback, [currentImage.id]: liked ? 'liked' : 'disliked' });
    onFeedback(currentImage.id, liked);
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') {
        onPrevious();
      }
      if (e.key === 'ArrowRight') {
        onNext();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onClose, onNext, onPrevious]);

  return (
    <div 
      ref={lightboxRef}
      className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
      >
        <XIcon className="w-6 h-6" />
      </button>

      {/* Navigation arrows */}
      {currentIndex > 0 && (
        <button
          onClick={onPrevious}
          className="absolute left-4 z-50 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}
      {currentIndex < images.length - 1 && (
        <button
          onClick={onNext}
          className="absolute right-4 z-50 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}

      {/* Main content area */}
      <div
        className="relative w-full max-w-4xl h-[80vh] mx-4"
      >
        <div className="relative w-full h-full">
          <img
            src={currentImage.url}
            alt={currentImage.prompt}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
          {/* Feedback buttons */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleFeedback(false);
              }}
              className={`p-4 rounded-full transition-all ${
                feedback[currentImage.id] === 'disliked'
                  ? 'bg-gray-900 text-white scale-110'
                  : 'bg-white/90 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <X className="w-8 h-8" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleFeedback(true);
              }}
              className={`p-4 rounded-full transition-all ${
                feedback[currentImage.id] === 'liked'
                  ? 'bg-red-500 text-white scale-110'
                  : 'bg-white/90 text-gray-700 hover:bg-red-50 hover:text-red-500'
              }`}
            >
              <Heart className={`w-8 h-8 ${feedback[currentImage.id] === 'liked' ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Counter */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
        {currentIndex + 1} / {images.length}
      </div>
    </div>
  );
};

const Home: React.FC = () => {
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [gridView, setGridView] = useState<'small' | 'large'>('large');
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
  const [touchEnd, setTouchEnd] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadImages();
  }, []);

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

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-7xl mx-auto">
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
              <div
                key={image.id}
                className="group cursor-pointer"
                onClick={() => openLightbox(index)}
              >
                <div className={
                  gridView === 'small' 
                    ? 'aspect-square bg-gray-100 rounded-lg overflow-hidden' 
                    : 'aspect-square bg-gray-100 rounded-lg overflow-hidden'
                }>
                  <img
                    src={image.url}
                    alt="AI generated design"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                {/* Display some metadata tags */}
                {image.metadata && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {image.metadata.garmentType && (
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                        {image.metadata.garmentType}
                      </span>
                    )}
                    {image.metadata.colors && image.metadata.colors.length > 0 && (
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                        {image.metadata.colors[0]}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg">No images yet. Start by generating your first design above.</p>
          </div>
        )}

        {/* Lightbox Modal */}
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

        {/* Voice Command Bar */}
        <CommandBar onCommandExecute={handleGenerate} />
      </div>
    </div>
  );
};

export default Home;
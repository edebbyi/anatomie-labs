import React, { useState, useEffect, useRef } from 'react';
import { Heart, X, Info, ArrowLeft, List, Layers, ThumbsUp, ThumbsDown, Eye, Grid3X3 } from 'lucide-react';

interface Image {
  id: string;
  url: string;
  prompt: string;
  promptId?: string;
  tags: string[];
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
}

interface Prompt {
  id: string;
  prompt: string;
  tags: string[];
  images: Image[];
  metadata: any;
  totalImages: number;
  avgConfidence: number;
}

interface SwipeViewProps {
  prompts: Prompt[];
  onClose: () => void;
  initialIndex?: number;
  onLikeImage: (imageId: string) => void;
  onDiscardImage: (imageId: string) => void;
  onLikeAllPrompt: (promptId: string) => void;
  onDiscardAllPrompt: (promptId: string) => void;
}

const SwipeView: React.FC<SwipeViewProps> = ({
  prompts,
  onClose,
  initialIndex = 0,
  onLikeImage,
  onDiscardImage,
  onLikeAllPrompt,
  onDiscardAllPrompt,
}) => {
  const [currentPromptIndex, setCurrentPromptIndex] = useState(initialIndex);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'prompt' | 'image'>('prompt');
  const [showMetadata, setShowMetadata] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const currentPrompt = prompts[currentPromptIndex];
  const currentImage = currentPrompt?.images[currentImageIndex];

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handleDiscard();
      if (e.key === 'ArrowRight') handleLike();
      if (e.key === 'ArrowUp') handlePrevious();
      if (e.key === 'ArrowDown') handleNext();
      if (e.key === 'Escape') onClose();
      if (e.key === 'i' || e.key === 'I') setShowMetadata(!showMetadata);
      if (e.key === 't' || e.key === 'T') toggleViewMode();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPromptIndex, currentImageIndex, viewMode, showMetadata]);

  const toggleViewMode = () => {
    setViewMode(viewMode === 'prompt' ? 'image' : 'prompt');
    setShowMetadata(false);
  };

  const handleNext = () => {
    if (viewMode === 'prompt') {
      if (currentPromptIndex < prompts.length - 1) {
        setCurrentPromptIndex(currentPromptIndex + 1);
        setCurrentImageIndex(0);
      }
    } else {
      if (currentImageIndex < currentPrompt.images.length - 1) {
        setCurrentImageIndex(currentImageIndex + 1);
      } else if (currentPromptIndex < prompts.length - 1) {
        setCurrentPromptIndex(currentPromptIndex + 1);
        setCurrentImageIndex(0);
      }
    }
  };

  const handlePrevious = () => {
    if (viewMode === 'prompt') {
      if (currentPromptIndex > 0) {
        setCurrentPromptIndex(currentPromptIndex - 1);
        setCurrentImageIndex(0);
      }
    } else {
      if (currentImageIndex > 0) {
        setCurrentImageIndex(currentImageIndex - 1);
      } else if (currentPromptIndex > 0) {
        setCurrentPromptIndex(currentPromptIndex - 1);
        setCurrentImageIndex(prompts[currentPromptIndex - 1].images.length - 1);
      }
    }
  };

  const handleLike = () => {
    if (viewMode === 'prompt') {
      onLikeAllPrompt(currentPrompt.id);
      handleNext();
    } else {
      onLikeImage(currentImage.id);
      handleNext();
    }
    setShowMetadata(false);
  };

  const handleDiscard = () => {
    if (viewMode === 'prompt') {
      onDiscardAllPrompt(currentPrompt.id);
      handleNext();
    } else {
      onDiscardImage(currentImage.id);
      handleNext();
    }
    setShowMetadata(false);
  };

  // Touch/Mouse drag handlers for card swipe
  const handleDragStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    setDragStart({ x: clientX, y: clientY });
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    const offsetX = clientX - dragStart.x;
    const offsetY = clientY - dragStart.y;
    setDragOffset({ x: offsetX, y: offsetY });
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    // If dragged more than 100px, trigger action
    if (Math.abs(dragOffset.x) > 100) {
      if (dragOffset.x > 0) {
        handleLike();
      } else {
        handleDiscard();
      }
    }

    setDragOffset({ x: 0, y: 0 });
  };

  const getCardRotation = () => {
    return dragOffset.x / 20; // Rotate based on drag
  };

  const getCardOpacity = () => {
    return 1 - Math.abs(dragOffset.x) / 500;
  };

  if (!currentPrompt || !currentImage) return null;

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/50 backdrop-blur-sm">
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="text-center text-white text-sm">
          <div className="font-medium">
            {viewMode === 'prompt' ? 'Prompt' : 'Image'} Mode
          </div>
          <div className="text-xs opacity-75">
            {viewMode === 'prompt' 
              ? `${currentPromptIndex + 1} / ${prompts.length} prompts`
              : `${currentImageIndex + 1} / ${currentPrompt?.images.length || 0} images`
            }
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Toggle View Mode */}
          <button
            onClick={toggleViewMode}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title={viewMode === 'prompt' ? 'Switch to image mode' : 'Switch to prompt mode'}
          >
            {viewMode === 'prompt' ? <Grid3X3 className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>

          {/* Toggle Metadata */}
          <button
            onClick={() => setShowMetadata(!showMetadata)}
            className={`p-2 rounded-full transition-colors ${
              showMetadata ? 'bg-white text-black' : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title="Toggle metadata"
          >
            <Info className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex items-center justify-center p-4 relative">
        {viewMode === 'prompt' ? (
          /* Prompt Mode - Show prompt card with multiple images */
          <div
            ref={cardRef}
            className="relative w-full max-w-2xl h-full max-h-[80vh] cursor-grab active:cursor-grabbing"
            style={{
              transform: `translateX(${dragOffset.x}px) translateY(${dragOffset.y}px) rotate(${getCardRotation()}deg)`,
              opacity: getCardOpacity(),
              transition: isDragging ? 'none' : 'all 0.3s ease-out',
            }}
            onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
            onMouseMove={(e) => handleDragMove(e.clientX, e.clientY)}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
            onTouchStart={(e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchMove={(e) => handleDragMove(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchEnd={handleDragEnd}
          >
            <div className="relative w-full h-full bg-white rounded-2xl overflow-hidden shadow-2xl">
              {showMetadata ? (
                /* Prompt Metadata */
                <div className="w-full h-full bg-gradient-to-br from-gray-900 to-gray-800 p-8 overflow-y-auto">
                  <h3 className="text-2xl font-bold text-white mb-6">Prompt Details</h3>
                  <div className="space-y-6 text-white">
                    <div>
                      <p className="text-sm text-gray-400 mb-2">Prompt Text</p>
                      <p className="text-lg leading-relaxed">{currentPrompt.prompt}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-2">Style Tags</p>
                      <div className="flex flex-wrap gap-2">
                        {currentPrompt.tags.map((tag, idx) => (
                          <span key={idx} className="px-3 py-1 bg-white/10 rounded-full text-sm">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-2">Statistics</p>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Total Images:</span>
                          <span className="ml-2 font-semibold">{currentPrompt.totalImages}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Avg Confidence:</span>
                          <span className="ml-2 font-semibold">{(currentPrompt.avgConfidence * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Prompt Preview - Grid of images */
                <div className="w-full h-full p-6">
                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Style Prompt</h3>
                    <p className="text-gray-600 text-sm" style={{ 
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>{currentPrompt.prompt}</p>
                  </div>
                  
                  {/* Image Grid */}
                  <div className="grid grid-cols-2 gap-3 h-3/4">
                    {currentPrompt.images.slice(0, 4).map((img, idx) => (
                      <div key={img.id} className="relative rounded-lg overflow-hidden bg-gray-100">
                        <img
                          src={img.url}
                          alt={`${currentPrompt.prompt} - Image ${idx + 1}`}
                          className="w-full h-full object-cover"
                          draggable={false}
                        />
                        {idx === 3 && currentPrompt.images.length > 4 && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <span className="text-white font-bold text-lg">+{currentPrompt.images.length - 4}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {/* Bulk Action Buttons */}
                  <div className="mt-4 flex justify-center space-x-4">
                    <button
                      onClick={() => onLikeAllPrompt(currentPrompt.id)}
                      className="flex items-center px-4 py-2 bg-green-100 hover:bg-green-200 text-green-800 rounded-lg transition-colors"
                    >
                      <ThumbsUp className="h-4 w-4 mr-2" />
                      Like All ({currentPrompt.totalImages})
                    </button>
                    <button
                      onClick={() => onDiscardAllPrompt(currentPrompt.id)}
                      className="flex items-center px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg transition-colors"
                    >
                      <ThumbsDown className="h-4 w-4 mr-2" />
                      Discard All ({currentPrompt.totalImages})
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Swipe Indicators for Prompt Mode */}
            {isDragging && (
              <>
                <div
                  className="absolute top-1/2 left-4 transform -translate-y-1/2 transition-opacity"
                  style={{ opacity: dragOffset.x < -50 ? 1 : 0 }}
                >
                  <div className="p-4 bg-red-500 rounded-full">
                    <ThumbsDown className="h-8 w-8 text-white" />
                  </div>
                </div>
                <div
                  className="absolute top-1/2 right-4 transform -translate-y-1/2 transition-opacity"
                  style={{ opacity: dragOffset.x > 50 ? 1 : 0 }}
                >
                  <div className="p-4 bg-green-500 rounded-full">
                    <ThumbsUp className="h-8 w-8 text-white" />
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          /* Image Mode - Show single image */
          <div
            ref={cardRef}
            className="relative w-full max-w-md h-full max-h-[70vh] cursor-grab active:cursor-grabbing"
            style={{
              transform: `translateX(${dragOffset.x}px) translateY(${dragOffset.y}px) rotate(${getCardRotation()}deg)`,
              opacity: getCardOpacity(),
              transition: isDragging ? 'none' : 'all 0.3s ease-out',
            }}
            onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
            onMouseMove={(e) => handleDragMove(e.clientX, e.clientY)}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
            onTouchStart={(e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchMove={(e) => handleDragMove(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchEnd={handleDragEnd}
          >
            <div className="relative w-full h-full bg-white rounded-2xl overflow-hidden shadow-2xl">
              {showMetadata ? (
                /* Image Metadata */
                <div className="w-full h-full bg-gradient-to-br from-gray-900 to-gray-800 p-6 overflow-y-auto">
                  <h3 className="text-xl font-bold text-white mb-4">Image Details</h3>
                  <div className="space-y-4 text-white">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Prompt</p>
                      <p className="text-base">{currentImage.prompt}</p>
                    </div>
                    {currentImage.metadata?.garmentType && (
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Garment Type</p>
                        <p className="text-base">{currentImage.metadata.garmentType}</p>
                      </div>
                    )}
                    {currentImage.metadata?.silhouette && (
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Silhouette</p>
                        <p className="text-base">{currentImage.metadata.silhouette}</p>
                      </div>
                    )}
                    {currentImage.metadata?.colors && (
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Color Palette</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {currentImage.metadata.colors.map((color, idx) => (
                            <span key={idx} className="px-3 py-1 bg-white/10 rounded-full text-sm">
                              {color}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Style Tags</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {currentImage.tags.map((tag, idx) => (
                          <span key={idx} className="px-3 py-1 bg-white/10 rounded-full text-sm">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Single Image View */
                <>
                  <img
                    src={currentImage.url}
                    alt={currentImage.prompt}
                    className="w-full h-full object-contain"
                    draggable={false}
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
                    <div className="flex flex-wrap gap-2">
                      {currentImage.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-white/90 backdrop-blur-sm text-sm font-medium text-gray-800 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Swipe Indicators for Image Mode */}
            {isDragging && (
              <>
                <div
                  className="absolute top-1/2 left-4 transform -translate-y-1/2 transition-opacity"
                  style={{ opacity: dragOffset.x < -50 ? 1 : 0 }}
                >
                  <div className="p-4 bg-red-500 rounded-full">
                    <X className="h-8 w-8 text-white" />
                  </div>
                </div>
                <div
                  className="absolute top-1/2 right-4 transform -translate-y-1/2 transition-opacity"
                  style={{ opacity: dragOffset.x > 50 ? 1 : 0 }}
                >
                  <div className="p-4 bg-green-500 rounded-full">
                    <Heart className="h-8 w-8 text-white fill-current" />
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center space-x-6">
          <button
            onClick={handleDiscard}
            className="p-4 bg-red-500 hover:bg-red-600 rounded-full text-white shadow-2xl transition-all hover:scale-110"
            title={viewMode === 'prompt' ? 'Discard all images from this prompt' : 'Discard this image'}
          >
            {viewMode === 'prompt' ? <ThumbsDown className="h-8 w-8" /> : <X className="h-8 w-8" />}
          </button>
          <button
            onClick={handleLike}
            className="p-4 bg-green-500 hover:bg-green-600 rounded-full text-white shadow-2xl transition-all hover:scale-110"
            title={viewMode === 'prompt' ? 'Like all images from this prompt' : 'Like this image'}
          >
            {viewMode === 'prompt' ? <ThumbsUp className="h-8 w-8" /> : <Heart className="h-8 w-8" />}
          </button>
        </div>
      </div>

      {/* Help Text */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 backdrop-blur-sm text-white px-4 py-2 rounded-full text-xs pointer-events-none">
        {viewMode === 'prompt' ? (
          <span>Swipe or use ← → arrows • Press T to switch to image mode • Tap <Info className="inline h-3 w-3" /> for details</span>
        ) : (
          <span>Swipe individual images • Press T for prompt mode • Use ← → or ↑ ↓ to navigate</span>
        )}
      </div>
    </div>
  );
};

export default SwipeView;

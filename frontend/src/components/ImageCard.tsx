import { Heart, X, Eye, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Badge } from './ui/badge';

type FeedbackState = 'liked' | 'disliked' | null | undefined;

export interface BasicImage {
  id: string;
  url: string;
  prompt?: string;
  tags?: string[];
  liked?: boolean;
  metadata?: Record<string, unknown>;
  timestamp?: Date | string;
  origin?: 'user' | 'system' | 'imported';
  lastInteractedAt?: Date | string;
}

interface ImageCardProps {
  image: BasicImage & { archived?: boolean };
  onClick?: () => void;
  onView?: (image: BasicImage) => void;
  onLike?: (id: string) => void;
  onDislike?: (id: string) => void;
  onDiscard?: (id: string) => void;
  onUnarchive?: (id: string) => void;
  feedback?: FeedbackState;
  size?: 'small' | 'large';
}

const ImageCard: React.FC<ImageCardProps> = ({
  image,
  onClick,
  onView,
  onLike,
  onDislike,
  onDiscard,
  onUnarchive,
  feedback,
  size = 'large'
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget as HTMLImageElement & { dataset?: Record<string, string> };
    if (el.dataset && el.dataset.fallbackApplied === 'true') return;
    if (el.dataset) el.dataset.fallbackApplied = 'true';
    // Fallback placeholder to avoid showing long prompt text as alt content
    el.src = 'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600"><rect width="100%" height="100%" fill="#e5e7eb"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-family="system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial" font-size="24">Image unavailable</text></svg>`
      );
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick();
    } else if (onView) {
      onView(image);
    }
  };

  const handleLike = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onLike?.(image.id);
  };

  const handleDislike = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (onDislike) {
      onDislike(image.id);
    } else {
      onDiscard?.(image.id);
    }
  };

  const handleView = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onView?.(image);
  };

  const handleUnarchive = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onUnarchive?.(image.id);
  };

  const isLiked = feedback === 'liked' || image.liked;
  const isDisliked = feedback === 'disliked';

  return (
    <div
      className={`relative w-full cursor-pointer group overflow-hidden rounded-lg ${
        size === 'small' ? 'aspect-square' : 'h-full'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      {!imageLoaded && <div className="absolute inset-0 bg-gray-200 animate-pulse" />}

      <img
        src={image.url}
        alt={image.prompt ? 'Generated design' : ''}
        className={`w-full h-full object-cover transition-opacity duration-200 ${
          imageLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => setImageLoaded(true)}
        onError={handleImageError}
      />

      {(isHovered || isLiked || isDisliked) && (
        <div className="absolute inset-0 bg-black/50 transition-opacity duration-200 flex flex-col items-center justify-center gap-4">
          <div className="flex gap-4">
            {image.archived && onUnarchive ? (
              <>
                <button
                  onClick={handleUnarchive}
                  className="w-12 h-12 rounded-full bg-white/90 text-gray-800 hover:bg-white hover:scale-110 flex items-center justify-center transition-all duration-200"
                  aria-label="Restore from archive"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>

                {onView && (
                  <button
                    onClick={handleView}
                    className="w-12 h-12 rounded-full bg-white/90 text-gray-800 hover:bg-white hover:scale-110 flex items-center justify-center transition-all duration-200"
                    aria-label="View details"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                )}
              </>
            ) : (
              <>
                {onLike && (
                  <button
                    onClick={handleLike}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                      isLiked
                        ? 'bg-[#ec4899] text-white'
                        : 'bg-white/90 text-gray-800 hover:bg-white hover:scale-110'
                    }`}
                    aria-label="Like"
                  >
                    <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                  </button>
                )}

                {(onDislike || onDiscard) && (
                  <button
                    onClick={handleDislike}
                    className={`w-12 h-12 rounded-full bg-white/90 text-gray-800 hover:bg-white hover:scale-110 flex items-center justify-center transition-all duration-200 ${
                      isDisliked ? 'ring-2 ring-red-500' : ''
                    }`}
                    aria-label="Dislike"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}

                {onView && (
                  <button
                    onClick={handleView}
                    className="w-12 h-12 rounded-full bg-white/90 text-gray-800 hover:bg-white hover:scale-110 flex items-center justify-center transition-all duration-200"
                    aria-label="View details"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {image.tags && image.tags.length > 0 && (
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
          {image.tags.slice(0, 3).map((tag, index) => (
            <Badge
              key={`${image.id}-tag-${index}`}
              variant="secondary"
              className="bg-white/90 text-gray-800 backdrop-blur-sm text-xs px-2 py-0.5"
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {isLiked && (
        <div className="absolute top-3 right-3">
          <div className="w-8 h-8 rounded-full bg-[#ec4899] flex items-center justify-center shadow-lg">
            <Heart className="w-4 h-4 text-white fill-current" />
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageCard;

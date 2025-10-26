import React from 'react';
import { Info, Heart, X } from 'lucide-react';

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

interface ImageCardProps {
  image: GeneratedImage;
  onClick: () => void;
  onLike?: (e: React.MouseEvent) => void;
  onDislike?: (e: React.MouseEvent) => void;
  size: 'small' | 'large';
  feedback?: 'liked' | 'disliked' | null;
}

const ImageCard: React.FC<ImageCardProps> = ({
  image,
  onClick,
  onLike,
  onDislike,
  size,
  feedback
}) => {
  return (
    <div className="group cursor-pointer relative">
      <div
        className={
          size === 'small'
            ? 'aspect-square bg-gray-100 rounded-lg overflow-hidden relative'
            : 'aspect-square bg-gray-100 rounded-lg overflow-hidden relative'
        }
        onClick={onClick}
      >
        <img
          src={image.url}
          alt="AI generated design"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* Info Icon - Top Right */}
        <div className="absolute top-3 right-3 bg-white/20 hover:bg-white/30 rounded-full p-2 transition-all duration-200 opacity-100">
          <Info className="w-4 h-4 text-white" />
        </div>

        {/* Like/Dislike Buttons - Bottom Center */}
        {(onLike || onDislike) && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {onDislike && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDislike(e);
                }}
                className={`p-3 rounded-full transition-all ${
                  feedback === 'disliked'
                    ? 'bg-gray-900 text-white scale-110'
                    : 'bg-white/90 text-gray-700 hover:bg-gray-100'
                }`}
                aria-label="Dislike"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            {onLike && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onLike(e);
                }}
                className={`p-3 rounded-full transition-all ${
                  feedback === 'liked'
                    ? 'bg-red-500 text-white scale-110'
                    : 'bg-white/90 text-gray-700 hover:bg-red-50 hover:text-red-500'
                }`}
                aria-label="Like"
              >
                <Heart className={`w-5 h-5 ${feedback === 'liked' ? 'fill-current' : ''}`} />
              </button>
            )}
          </div>
        )}
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
  );
};

export default ImageCard;
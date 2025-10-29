import { Heart, X, Eye } from 'lucide-react';
import { GeneratedImage } from '../lib/mockData';
import { useState } from 'react';
import { Badge } from './ui/badge';

interface ImageCardProps {
  image: GeneratedImage;
  onLike: (id: string) => void;
  onDiscard: (id: string) => void;
  onView: (image: GeneratedImage) => void;
}

export function ImageCard({ image, onLike, onDiscard, onView }: ImageCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <div
      className="relative cursor-pointer group overflow-hidden rounded-lg"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onView(image)}
    >
      {/* Skeleton loader */}
      {!imageLoaded && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}
      
      {/* Image */}
      <img
        src={image.url}
        alt={image.prompt}
        className={`w-full h-auto block transition-opacity duration-200 ${
          imageLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => setImageLoaded(true)}
      />

      {/* Overlay on hover */}
      {isHovered && (
        <div className="absolute inset-0 bg-black/50 transition-opacity duration-200 flex flex-col items-center justify-center gap-4">
          {/* Action buttons */}
          <div className="flex gap-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onLike(image.id);
              }}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                image.liked
                  ? 'bg-[#ec4899] text-white'
                  : 'bg-white/90 text-gray-800 hover:bg-white hover:scale-110'
              }`}
            >
              <Heart className={`w-5 h-5 ${image.liked ? 'fill-current' : ''}`} />
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDiscard(image.id);
              }}
              className="w-12 h-12 rounded-full bg-white/90 text-gray-800 hover:bg-white hover:scale-110 flex items-center justify-center transition-all duration-200"
            >
              <X className="w-5 h-5" />
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onView(image);
              }}
              className="w-12 h-12 rounded-full bg-white/90 text-gray-800 hover:bg-white hover:scale-110 flex items-center justify-center transition-all duration-200"
            >
              <Eye className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Tags at bottom */}
      <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
        {image.tags.slice(0, 3).map((tag, index) => (
          <Badge
            key={index}
            variant="secondary"
            className="bg-white/90 text-gray-800 backdrop-blur-sm text-xs px-2 py-0.5"
          >
            {tag}
          </Badge>
        ))}
      </div>

      {/* Liked indicator */}
      {image.liked && (
        <div className="absolute top-3 right-3">
          <div className="w-8 h-8 rounded-full bg-[#ec4899] flex items-center justify-center shadow-lg">
            <Heart className="w-4 h-4 text-white fill-current" />
          </div>
        </div>
      )}
    </div>
  );
}

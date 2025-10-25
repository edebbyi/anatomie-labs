import React, { useState } from 'react';
import { Info } from 'lucide-react';

interface FlipCardProps {
  imageUrl: string;
  prompt: string;
  timestamp: Date;
  metadata?: {
    garmentType?: string;
    colors?: string[];
    silhouette?: string;
    fabric?: string;
    styleTags?: string[];
  };
  onFlip?: () => void;
}

const FlipCard: React.FC<FlipCardProps> = ({ 
  imageUrl, 
  prompt, 
  timestamp, 
  metadata,
  onFlip
}) => {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
    if (onFlip) {
      onFlip();
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  return (
    <div 
      className="relative w-full h-full cursor-pointer group"
      onClick={handleFlip}
    >
      {/* Card Container with 3D Flip Effect */}
      <div 
        className={`relative w-full h-full transition-transform duration-700 transform-style-3d ${
          isFlipped ? 'rotate-y-180' : ''
        }`}
        style={{ 
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
        }}
      >
        {/* Front of Card (Image) */}
        <div 
          className="absolute inset-0 w-full h-full backface-hidden rounded-2xl overflow-hidden"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <img
            src={imageUrl}
            alt={prompt}
            className="w-full h-full object-cover"
          />
          
          {/* Info Icon Overlay - Always visible to indicate interactivity */}
          <div className="absolute top-3 right-3 bg-white/20 hover:bg-white/30 rounded-full p-2 transition-all duration-200 group-hover:scale-110">
            <Info className="w-5 h-5 text-white" />
          </div>
        </div>

        {/* Back of Card (Prompt and Metadata) */}
        <div 
          className="absolute inset-0 w-full h-full backface-hidden rounded-2xl overflow-hidden bg-white p-4 flex flex-col"
          style={{ 
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)'
          }}
        >
          <div className="flex-1 overflow-y-auto">
            <h3 className="font-medium text-gray-900 mb-2">Prompt</h3>
            <p className="text-sm text-gray-700 mb-4">{prompt}</p>
            
            <div className="mt-4">
              <h4 className="font-medium text-gray-900 mb-2">Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Generated:</span>
                  <span className="text-gray-900">{formatDate(timestamp)}</span>
                </div>
                
                {metadata?.garmentType && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Garment:</span>
                    <span className="text-gray-900 capitalize">{metadata.garmentType}</span>
                  </div>
                )}
                
                {metadata?.colors && metadata.colors.length > 0 && (
                  <div>
                    <span className="text-gray-500 block mb-1">Colors:</span>
                    <div className="flex flex-wrap gap-1">
                      {metadata.colors.slice(0, 5).map((color, idx) => (
                        <span 
                          key={idx} 
                          className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs capitalize"
                        >
                          {color}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {metadata?.silhouette && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Silhouette:</span>
                    <span className="text-gray-900 capitalize">{metadata.silhouette}</span>
                  </div>
                )}
                
                {metadata?.fabric && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Fabric:</span>
                    <span className="text-gray-900 capitalize">{metadata.fabric}</span>
                  </div>
                )}
                
                {metadata?.styleTags && metadata.styleTags.length > 0 && (
                  <div>
                    <span className="text-gray-500 block mb-1">Style Tags:</span>
                    <div className="flex flex-wrap gap-1">
                      {metadata.styleTags.slice(0, 5).map((tag, idx) => (
                        <span 
                          key={idx} 
                          className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs capitalize"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-3 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-500">Click to flip back</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlipCard;
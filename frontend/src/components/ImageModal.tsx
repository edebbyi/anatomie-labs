import React from 'react';
import { X, Heart, Download, Share2 } from 'lucide-react';

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

interface ImageModalProps {
  image: GeneratedImage;
  onClose: () => void;
}

const ImageModal: React.FC<ImageModalProps> = ({ image, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="bg-white rounded-2xl overflow-hidden flex-1 flex flex-col">
          <div className="flex-1 flex items-center justify-center p-4 bg-gray-50">
            <img
              src={image.url}
              alt={image.prompt}
              className="max-w-full max-h-[70vh] object-contain"
            />
          </div>
          
          <div className="p-6 border-t border-gray-200">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{image.prompt}</h3>
                <p className="text-gray-600 text-sm">
                  Generated on {image.timestamp.toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                  <Heart className="w-5 h-5 text-gray-700" />
                </button>
                <button className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                  <Download className="w-5 h-5 text-gray-700" />
                </button>
                <button className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                  <Share2 className="w-5 h-5 text-gray-700" />
                </button>
              </div>
            </div>
            
            {image.metadata && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {image.metadata.garmentType && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Garment Type</h4>
                    <p className="text-gray-900">{image.metadata.garmentType}</p>
                  </div>
                )}
                {image.metadata.colors && image.metadata.colors.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Colors</h4>
                    <div className="flex flex-wrap gap-2">
                      {image.metadata.colors.map((color, idx) => (
                        <span 
                          key={idx} 
                          className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-sm capitalize"
                        >
                          {color}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {image.metadata.silhouette && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Silhouette</h4>
                    <p className="text-gray-900">{image.metadata.silhouette}</p>
                  </div>
                )}
                {image.metadata.texture && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Texture</h4>
                    <p className="text-gray-900">{image.metadata.texture}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageModal;
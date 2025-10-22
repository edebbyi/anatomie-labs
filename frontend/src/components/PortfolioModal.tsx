import React, { useState, useEffect } from 'react';
import { X, Eye, Download, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

interface PortfolioImage {
  id: string;
  url: string;
  thumbnail_url: string;
  filename: string;
  vlt_analysis?: {
    garmentType?: string;
    colors?: { primary?: string };
    attributes?: any;
    style?: { overall?: string };
  };
  uploaded_at: string;
}

interface PortfolioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PortfolioModal: React.FC<PortfolioModalProps> = ({ isOpen, onClose }) => {
  const [images, setImages] = useState<PortfolioImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<PortfolioImage | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'single'>('grid');

  useEffect(() => {
    if (isOpen) {
      fetchPortfolioImages();
    }
  }, [isOpen]);

  const fetchPortfolioImages = async () => {
    setLoading(true);
    try {
      const userProfile = localStorage.getItem('userProfile');
      let userId = 'ec058a8c-b2d7-4888-9e66-b7b02e393152';
      
      if (userProfile) {
        try {
          const profile = JSON.parse(userProfile);
          userId = profile.userId || userId;
        } catch (e) {
          console.error('Failed to parse userProfile', e);
        }
      }
      
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_URL}/persona/portfolio/${userId}`);
      
      if (response.ok) {
        const data = await response.json();
        setImages(data.data || []);
      } else {
        console.error('Failed to fetch portfolio images');
      }
    } catch (error) {
      console.error('Error fetching portfolio images:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageClick = (image: PortfolioImage) => {
    setSelectedImage(image);
    setViewMode('single');
  };

  const handleNextImage = () => {
    if (!selectedImage) return;
    const currentIndex = images.findIndex(img => img.id === selectedImage.id);
    const nextIndex = (currentIndex + 1) % images.length;
    setSelectedImage(images[nextIndex]);
  };

  const handlePreviousImage = () => {
    if (!selectedImage) return;
    const currentIndex = images.findIndex(img => img.id === selectedImage.id);
    const prevIndex = (currentIndex - 1 + images.length) % images.length;
    setSelectedImage(images[prevIndex]);
  };

  const handleDownload = (image: PortfolioImage) => {
    const link = document.createElement('a');
    link.href = image.url;
    link.download = image.filename || `portfolio-image-${image.id}`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async (image: PortfolioImage) => {
    if (window.confirm('Are you sure you want to remove this image from your portfolio?')) {
      try {
        const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
        const response = await fetch(`${API_URL}/persona/portfolio/${image.id}`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          setImages(prev => prev.filter(img => img.id !== image.id));
          if (selectedImage?.id === image.id) {
            setSelectedImage(null);
            setViewMode('grid');
          }
        }
      } catch (error) {
        console.error('Error deleting image:', error);
      }
    }
  };

  const getImageTags = (image: PortfolioImage) => {
    const tags = [];
    if (image.vlt_analysis?.garmentType) tags.push(image.vlt_analysis.garmentType);
    if (image.vlt_analysis?.colors?.primary) tags.push(image.vlt_analysis.colors.primary);
    if (image.vlt_analysis?.style?.overall) tags.push(image.vlt_analysis.style.overall);
    return tags.slice(0, 3);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-airbnb-float max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-podna-gray-100">
          <div className="flex items-center space-x-3">
            {viewMode === 'single' && (
              <button 
                onClick={() => {
                  setViewMode('grid');
                  setSelectedImage(null);
                }}
                className="p-2 hover:bg-podna-gray-100 rounded-lg transition-all duration-200"
              >
                <ChevronLeft className="h-5 w-5 text-podna-gray-600" />
              </button>
            )}
            <div>
              <h2 className="text-2xl font-bold font-display text-podna-gray-900">
                {viewMode === 'single' ? 'Portfolio Image' : 'Your Portfolio'}
              </h2>
              <p className="text-sm text-podna-gray-600">
                {viewMode === 'single' 
                  ? `${images.findIndex(img => img.id === selectedImage?.id) + 1} of ${images.length}`
                  : `${images.length} images in your collection`
                }
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-podna-gray-100 rounded-xl transition-all duration-200"
          >
            <X className="h-6 w-6 text-podna-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-100px)]">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-podna-primary-500"></div>
            </div>
          ) : viewMode === 'grid' ? (
            /* Grid View */
            <div className="p-6">
              {images.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-podna-gray-600">No portfolio images found.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {images.map((image) => (
                    <div 
                      key={image.id}
                      className="group relative bg-white rounded-xl overflow-hidden shadow-airbnb-card hover:shadow-airbnb-card-hover transition-all duration-300 cursor-pointer"
                      onClick={() => handleImageClick(image)}
                    >
                      <div className="aspect-square relative overflow-hidden">
                        <img
                          src={image.thumbnail_url || image.url}
                          alt={image.filename}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        
                        {/* Overlay on hover */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          {/* Tags */}
                          <div className="absolute bottom-3 left-3 right-3">
                            <div className="flex flex-wrap gap-1 mb-2">
                              {getImageTags(image).map((tag, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 bg-white/90 backdrop-blur-md text-xs font-medium text-podna-gray-800 rounded-full"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                          
                          {/* Action buttons */}
                          <div className="absolute top-3 right-3 flex space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(image);
                              }}
                              className="p-2 bg-white/90 backdrop-blur-md rounded-full hover:bg-white transition-all duration-200"
                            >
                              <Download className="h-4 w-4 text-podna-gray-700" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(image);
                              }}
                              className="p-2 bg-white/90 backdrop-blur-md rounded-full hover:bg-white transition-all duration-200"
                            >
                              <Trash2 className="h-4 w-4 text-podna-accent-500" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Single Image View */
            selectedImage && (
              <div className="relative">
                <div className="flex items-center justify-center min-h-[60vh] bg-podna-gray-50">
                  <img
                    src={selectedImage.url}
                    alt={selectedImage.filename}
                    className="max-h-[60vh] max-w-full object-contain rounded-xl shadow-airbnb-card"
                  />
                </div>
                
                {/* Navigation arrows */}
                <button
                  onClick={handlePreviousImage}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 p-3 bg-white/90 backdrop-blur-md rounded-full shadow-airbnb hover:bg-white transition-all duration-200"
                >
                  <ChevronLeft className="h-6 w-6 text-podna-gray-700" />
                </button>
                <button
                  onClick={handleNextImage}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 p-3 bg-white/90 backdrop-blur-md rounded-full shadow-airbnb hover:bg-white transition-all duration-200"
                >
                  <ChevronRight className="h-6 w-6 text-podna-gray-700" />
                </button>
                
                {/* Image details */}
                <div className="p-6 bg-white border-t border-podna-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-podna-gray-900">
                      {selectedImage.filename || 'Portfolio Image'}
                    </h3>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleDownload(selectedImage)}
                        className="flex items-center space-x-2 px-4 py-2 bg-podna-primary-50 text-podna-primary-600 rounded-lg hover:bg-podna-primary-100 transition-all duration-200"
                      >
                        <Download className="h-4 w-4" />
                        <span className="text-sm font-medium">Download</span>
                      </button>
                      <button
                        onClick={() => handleDelete(selectedImage)}
                        className="flex items-center space-x-2 px-4 py-2 bg-podna-accent-50 text-podna-accent-600 rounded-lg hover:bg-podna-accent-100 transition-all duration-200"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="text-sm font-medium">Remove</span>
                      </button>
                    </div>
                  </div>
                  
                  {/* VLT Analysis */}
                  {selectedImage.vlt_analysis && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {selectedImage.vlt_analysis.garmentType && (
                        <div className="bg-podna-gray-50 rounded-lg p-3">
                          <p className="text-xs font-medium text-podna-gray-500 uppercase tracking-wide">Garment Type</p>
                          <p className="text-sm font-semibold text-podna-gray-900 capitalize">{selectedImage.vlt_analysis.garmentType}</p>
                        </div>
                      )}
                      {selectedImage.vlt_analysis.colors?.primary && (
                        <div className="bg-podna-gray-50 rounded-lg p-3">
                          <p className="text-xs font-medium text-podna-gray-500 uppercase tracking-wide">Primary Color</p>
                          <p className="text-sm font-semibold text-podna-gray-900 capitalize">{selectedImage.vlt_analysis.colors.primary}</p>
                        </div>
                      )}
                      {selectedImage.vlt_analysis.style?.overall && (
                        <div className="bg-podna-gray-50 rounded-lg p-3">
                          <p className="text-xs font-medium text-podna-gray-500 uppercase tracking-wide">Style</p>
                          <p className="text-sm font-semibold text-podna-gray-900 capitalize">{selectedImage.vlt_analysis.style.overall}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default PortfolioModal;
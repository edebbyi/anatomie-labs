import React, { useState, useEffect } from 'react';
import {
  Image,
  Sliders,
  X,
  Filter,
  Palette,
  Shirt,
  Tag,
  User,
  Download,
  Heart,
  Share2
} from 'lucide-react';
import { agentsAPI } from '../services/agentsAPI';
import FlipCard from '../components/FlipCard';
import Lightbox from '../components/Lightbox';
import SkeletonLoader from '../components/SkeletonLoader';

interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: string;
  metadata?: {
    colors?: string[];
    garmentType?: string;
    styleTags?: string[];
    silhouette?: string;
    fabric?: string;
    // Add other metadata fields as needed
  };
}

const Gallery: React.FC = () => {
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [filteredImages, setFilteredImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedGarments, setSelectedGarments] = useState<string[]>([]);
  const [selectedStyleTags, setSelectedStyleTags] = useState<string[]>([]);
  const [selectedSilhouettes, setSelectedSilhouettes] = useState<string[]>([]);
  const [selectedFabrics, setSelectedFabrics] = useState<string[]>([]);
  
  // Available filter options
  const [availableColors, setAvailableColors] = useState<string[]>([]);
  const [availableGarments, setAvailableGarments] = useState<string[]>([]);
  const [availableStyleTags, setAvailableStyleTags] = useState<string[]>([]);
  const [availableSilhouettes, setAvailableSilhouettes] = useState<string[]>([]);
  const [availableFabrics, setAvailableFabrics] = useState<string[]>([]);
  
  // UI states
  const [showFilters, setShowFilters] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  // Load generated images
  useEffect(() => {
    const loadImages = async () => {
      try {
        setLoading(true);
        const result = await agentsAPI.getGeneratedImages();
        
        if (result.success) {
          setImages(result.data.generations);
          setFilteredImages(result.data.generations);
          extractFilterOptions(result.data.generations);
        } else {
          setError(result.message || 'Failed to load images');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load images');
      } finally {
        setLoading(false);
      }
    };
    
    loadImages();
  }, []);

  // Extract filter options from images
  const extractFilterOptions = (images: GeneratedImage[]) => {
    const colors = new Set<string>();
    const garments = new Set<string>();
    const styleTags = new Set<string>();
    const silhouettes = new Set<string>();
    const fabrics = new Set<string>();
    
    images.forEach(image => {
      if (image.metadata) {
        if (image.metadata.colors) {
          image.metadata.colors.forEach(color => colors.add(color));
        }
        if (image.metadata.garmentType) {
          garments.add(image.metadata.garmentType);
        }
        if (image.metadata.styleTags) {
          image.metadata.styleTags.forEach(tag => styleTags.add(tag));
        }
        if (image.metadata.silhouette) {
          silhouettes.add(image.metadata.silhouette);
        }
        if (image.metadata.fabric) {
          fabrics.add(image.metadata.fabric);
        }
      }
    });
    
    setAvailableColors(Array.from(colors).sort());
    setAvailableGarments(Array.from(garments).sort());
    setAvailableStyleTags(Array.from(styleTags).sort());
    setAvailableSilhouettes(Array.from(silhouettes).sort());
    setAvailableFabrics(Array.from(fabrics).sort());
  };

  // Apply filters
  useEffect(() => {
    let result = [...images];
    
    if (selectedColors.length > 0) {
      result = result.filter(image => 
        image.metadata?.colors?.some(color => selectedColors.includes(color))
      );
    }
    
    if (selectedGarments.length > 0) {
      result = result.filter(image => 
        selectedGarments.includes(image.metadata?.garmentType || '')
      );
    }
    
    if (selectedStyleTags.length > 0) {
      result = result.filter(image => 
        image.metadata?.styleTags?.some(tag => selectedStyleTags.includes(tag))
      );
    }
    
    if (selectedSilhouettes.length > 0) {
      result = result.filter(image => 
        selectedSilhouettes.includes(image.metadata?.silhouette || '')
      );
    }
    
    if (selectedFabrics.length > 0) {
      result = result.filter(image => 
        selectedFabrics.includes(image.metadata?.fabric || '')
      );
    }
    
    setFilteredImages(result);
  }, [selectedColors, selectedGarments, selectedStyleTags, selectedSilhouettes, selectedFabrics, images]);

  // Toggle filter selection
  const toggleFilter = (filterType: string, value: string) => {
    switch (filterType) {
      case 'color':
        setSelectedColors(prev => 
          prev.includes(value) 
            ? prev.filter(item => item !== value) 
            : [...prev, value]
        );
        break;
      case 'garment':
        setSelectedGarments(prev => 
          prev.includes(value) 
            ? prev.filter(item => item !== value) 
            : [...prev, value]
        );
        break;
      case 'styleTag':
        setSelectedStyleTags(prev => 
          prev.includes(value) 
            ? prev.filter(item => item !== value) 
            : [...prev, value]
        );
        break;
      case 'silhouette':
        setSelectedSilhouettes(prev => 
          prev.includes(value) 
            ? prev.filter(item => item !== value) 
            : [...prev, value]
        );
        break;
      case 'fabric':
        setSelectedFabrics(prev => 
          prev.includes(value) 
            ? prev.filter(item => item !== value) 
            : [...prev, value]
        );
        break;
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedColors([]);
    setSelectedGarments([]);
    setSelectedStyleTags([]);
    setSelectedSilhouettes([]);
    setSelectedFabrics([]);
  };

  // Check if any filters are applied
  const hasActiveFilters = () => {
    return (
      selectedColors.length > 0 ||
      selectedGarments.length > 0 ||
      selectedStyleTags.length > 0 ||
      selectedSilhouettes.length > 0 ||
      selectedFabrics.length > 0
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-podna-surface p-4 sm:p-6 md:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-podna-primary-500 mb-4"></div>
          <p className="text-gray-600">Loading your gallery...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-podna-surface p-4 sm:p-6 md:p-8 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-red-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to load gallery</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-podna-surface">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8">
        {/* Header */}
        <div className="mb-8 sm:mb-10 md:mb-12">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-light text-gray-900 mb-2">Gallery</h2>
              <p className="text-gray-600">Browse and filter your generated designs</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <Sliders className="w-4 h-4 text-gray-600" />
                <span>Filters</span>
                {hasActiveFilters() && (
                  <span className="ml-2 px-2 py-0.5 bg-podna-primary-100 text-podna-primary-700 text-xs rounded-full">
                    {selectedColors.length + selectedGarments.length + selectedStyleTags.length + selectedSilhouettes.length + selectedFabrics.length}
                  </span>
                )}
              </button>
              <button className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors">
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
            </div>
          </div>
          
          {/* Active Filters */}
          {hasActiveFilters() && (
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <span className="text-sm text-gray-600">Active filters:</span>
              {selectedColors.map(color => (
                <span 
                  key={`color-${color}`} 
                  className="flex items-center gap-1 px-3 py-1.5 bg-podna-primary-100 text-podna-primary-700 rounded-full text-sm"
                >
                  <Palette className="w-3 h-3" />
                  {color}
                  <button 
                    onClick={() => toggleFilter('color', color)}
                    className="ml-1 hover:bg-podna-primary-200 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {selectedGarments.map(garment => (
                <span 
                  key={`garment-${garment}`} 
                  className="flex items-center gap-1 px-3 py-1.5 bg-podna-primary-100 text-podna-primary-700 rounded-full text-sm"
                >
                  <Shirt className="w-3 h-3" />
                  {garment}
                  <button 
                    onClick={() => toggleFilter('garment', garment)}
                    className="ml-1 hover:bg-podna-primary-200 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {selectedStyleTags.map(tag => (
                <span 
                  key={`tag-${tag}`} 
                  className="flex items-center gap-1 px-3 py-1.5 bg-podna-primary-100 text-podna-primary-700 rounded-full text-sm"
                >
                  <Tag className="w-3 h-3" />
                  {tag}
                  <button 
                    onClick={() => toggleFilter('styleTag', tag)}
                    className="ml-1 hover:bg-podna-primary-200 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {selectedSilhouettes.map(silhouette => (
                <span 
                  key={`silhouette-${silhouette}`} 
                  className="flex items-center gap-1 px-3 py-1.5 bg-podna-primary-100 text-podna-primary-700 rounded-full text-sm"
                >
                  <User className="w-3 h-3" />
                  {silhouette}
                  <button 
                    onClick={() => toggleFilter('silhouette', silhouette)}
                    className="ml-1 hover:bg-podna-primary-200 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {selectedFabrics.map(fabric => (
                <span 
                  key={`fabric-${fabric}`} 
                  className="flex items-center gap-1 px-3 py-1.5 bg-podna-primary-100 text-podna-primary-700 rounded-full text-sm"
                >
                  <span className="w-3 h-3 bg-gray-400 rounded-full"></span>
                  {fabric}
                  <button 
                    onClick={() => toggleFilter('fabric', fabric)}
                    className="ml-1 hover:bg-podna-primary-200 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition-colors"
              >
                <X className="w-3 h-3" />
                Clear all
              </button>
            </div>
          )}
        </div>
        
        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-airbnb-card mb-8 animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Filter className="w-5 h-5 text-podna-primary-500" />
                Filter Gallery
              </h2>
              <button
                onClick={clearFilters}
                disabled={!hasActiveFilters()}
                className={`text-sm px-3 py-1.5 rounded-lg ${
                  hasActiveFilters()
                    ? 'text-podna-primary-600 hover:bg-podna-primary-50'
                    : 'text-gray-400 cursor-not-allowed'
                }`}
              >
                Clear all filters
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              {/* Color Filter */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-podna-primary-500" />
                  Color
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {availableColors.map(color => (
                    <button
                      key={color}
                      onClick={() => toggleFilter('color', color)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                        selectedColors.includes(color)
                          ? 'bg-podna-primary-100 text-podna-primary-700'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full border border-gray-300" style={{ backgroundColor: color.toLowerCase() }}></div>
                      <span className="capitalize">{color}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Garment Type Filter */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <Shirt className="w-4 h-4 text-podna-primary-500" />
                  Garment
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {availableGarments.map(garment => (
                    <button
                      key={garment}
                      onClick={() => toggleFilter('garment', garment)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedGarments.includes(garment)
                          ? 'bg-podna-primary-100 text-podna-primary-700'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      <span className="capitalize">{garment}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Style Tags Filter */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-podna-primary-500" />
                  Style Tag
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {availableStyleTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleFilter('styleTag', tag)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedStyleTags.includes(tag)
                          ? 'bg-podna-primary-100 text-podna-primary-700'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      <span className="capitalize">{tag}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Silhouette Filter */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-podna-primary-500" />
                  Silhouette
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {availableSilhouettes.map(silhouette => (
                    <button
                      key={silhouette}
                      onClick={() => toggleFilter('silhouette', silhouette)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedSilhouettes.includes(silhouette)
                          ? 'bg-podna-primary-100 text-podna-primary-700'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      <span className="capitalize">{silhouette}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Fabric Filter */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <span className="w-4 h-4 bg-gray-400 rounded-full"></span>
                  Fabric
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {availableFabrics.map(fabric => (
                    <button
                      key={fabric}
                      onClick={() => toggleFilter('fabric', fabric)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedFabrics.includes(fabric)
                          ? 'bg-podna-primary-100 text-podna-primary-700'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      <span className="capitalize">{fabric}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Gallery Grid */}
        {loading ? (
          <SkeletonLoader count={8} columns={4} />
        ) : filteredImages.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {filteredImages.map((image, index) => (
              <div
                key={image.id}
                className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-airbnb-card transition-all duration-300 hover:shadow-airbnb-card-hover cursor-pointer"
                onClick={() => setSelectedImageIndex(index)}
              >
                <FlipCard
                  imageUrl={image.url}
                  prompt={image.prompt}
                  timestamp={new Date(image.timestamp)}
                  metadata={image.metadata}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-10 sm:p-12 text-center h-full flex flex-col items-center justify-center">
            <div className="bg-gray-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mb-5">
              <Image className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {hasActiveFilters() ? 'No matching designs found' : 'No designs in your gallery yet'}
            </h3>
            <p className="text-gray-500 max-w-md">
              {hasActiveFilters() 
                ? 'Try adjusting your filters to see more results.' 
                : 'Generate your first design using the prompt builder. Your images will appear here.'}
            </p>
          </div>
        )}

        {/* Lightbox Modal */}
        {selectedImageIndex !== null && (
          <Lightbox
            images={filteredImages}
            initialIndex={selectedImageIndex}
            onClose={() => setSelectedImageIndex(null)}
          />
        )}
      </div>
    </div>
  );
};

export default Gallery;
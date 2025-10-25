import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, Tag, Image as ImageIcon, Plus, Loader, Sparkles } from 'lucide-react';
import authAPI from '../services/authAPI';
import EnhancedStyleProfile from '../components/EnhancedStyleProfile';

interface StyleLabel {
  name: string;
  score: number;
  count?: number;
}

interface Distribution {
  [key: string]: number;
}

interface PortfolioImage {
  id: string;
  filename: string;
  url: string;
  width: number;
  height: number;
  uploaded_at: string;
}

interface BrandDNA {
  primaryAesthetic: string;
  secondaryAesthetics: string[];
  signatureColors: Array<{
    name: string;
    weight: number;
    hex: string;
  }>;
  signatureFabrics: Array<{
    name: string;
    weight: number;
    properties: {
      texture: string;
      drape: string;
      weight: string;
    };
  }>;
  signatureConstruction: Array<{
    detail: string;
    frequency: number;
  }>;
  preferredPhotography: {
    shotTypes: Array<{ type: string; frequency: number }>;
    lighting: Array<{ type: string; frequency: number }>;
    angles: Array<{ angle: string; frequency: number }>;
  };
  primaryGarments: Array<{
    type: string;
    weight: number;
  }>;
  confidence: {
    aesthetic: number;
    overall: number;
  };
  metadata: {
    totalImages: number;
    lastUpdated: string;
    driftScore: number;
  };
}

interface StyleProfile {
  id: string;
  portfolioId: string;
  styleLabels: StyleLabel[];
  styleTags: string[];
  clusters: any[];
  summaryText: string;
  totalImages: number;
  distributions: {
    garments: Distribution;
    colors: Distribution;
    fabrics: Distribution;
    silhouettes: Distribution;
  };
  portfolioImages: PortfolioImage[];
  updatedAt: string;
  brandDNA?: BrandDNA;
  aestheticThemes?: Array<{
    name: string;
    count: number;
    strength: number;
    frequency: string;
    examples: string[];
    garment_types: string[];
    construction_details: string[];
    description: string;
  }>;
  // Add ultra detailed descriptors for the enhanced component
  ultraDetailedDescriptors?: any[];
}

const StyleProfile: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<PortfolioImage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentUser = authAPI.getCurrentUser();
  const token = authAPI.getToken();
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
  const loadedRef = React.useRef(false);

  useEffect(() => {
    if (!currentUser) {
      navigate('/signup');
      return;
    }
    // Prevent duplicate calls in React Strict Mode
    if (loadedRef.current) return;
    loadedRef.current = true;
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${apiUrl}/podna/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          setError('No style profile found. Please upload a portfolio first.');
          setLoading(false);
          return;
        }
        if (response.status === 429) {
          setError('Too many requests. Please wait a moment and refresh the page.');
          setLoading(false);
          return;
        }
        throw new Error('Failed to load profile');
      }

      const result = await response.json();
      
      if (result.success && result.data?.profile) {
        setProfile(result.data.profile);
      }
    } catch (err: any) {
      console.error('Error loading profile:', err);
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleAddImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    if (!file.name.endsWith('.zip')) {
      setError('Please upload a ZIP file');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('portfolio', file);

      const response = await fetch(`${apiUrl}/podna/portfolio/${profile.portfolioId}/add-images`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to add images');
      }

      // Reload profile to show new images
      await loadProfile();

      // Show success message
      alert(`Successfully added ${result.data.addedCount} new images!`);
    } catch (err: any) {
      console.error('Error adding images:', err);
      setError(err.message || 'Failed to add images');
    } finally {
      setUploading(false);
    }
  };

  const getTopDistribution = (dist: Distribution, limit = 5) => {
    return Object.entries(dist)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([key, value]) => ({
        label: key,
        percentage: Math.round(value * 100)
      }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="w-12 h-12 text-gray-900 animate-spin" />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => navigate('/onboarding')}
              className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
            >
              Upload Portfolio
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-light text-gray-900 mb-2">Your Style Profile</h1>
          <p className="text-gray-600">{profile.summaryText}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Enhanced Style Profile Component */}
        {profile.ultraDetailedDescriptors && profile.ultraDetailedDescriptors.length > 0 ? (
          <EnhancedStyleProfile 
            styleProfile={profile} 
            ultraDetailedDescriptors={profile.ultraDetailedDescriptors} 
          />
        ) : (
          <>
            {/* Brand DNA Section */}
            {profile.brandDNA && (
              <div className="mb-8">
                <h2 className="text-2xl font-light text-gray-900 mb-4 flex items-center">
                  <Sparkles className="w-6 h-6 mr-2" />
                  Your Brand DNA
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Core Aesthetic Card */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="font-semibold text-gray-900 mb-3">Core Aesthetic</h3>
                    <div className="space-y-2">
                      <div className="px-3 py-2 bg-gray-900 text-white rounded-lg text-center">
                        <div className="text-lg font-medium">{profile.brandDNA.primaryAesthetic}</div>
                        <div className="text-xs opacity-75">
                          {Math.round(profile.brandDNA.confidence.aesthetic * 100)}% confidence
                        </div>
                      </div>
                      
                      {profile.brandDNA.secondaryAesthetics?.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs text-gray-500">Secondary aesthetics:</p>
                          {profile.brandDNA.secondaryAesthetics.map((aesthetic: string, idx: number) => (
                            <div key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm text-center">
                              {aesthetic}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Signature Colors */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="font-semibold text-gray-900 mb-3">Signature Colors</h3>
                    <div className="space-y-2">
                      {profile.brandDNA.signatureColors.map((color: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-lg border-2 border-gray-300 flex-shrink-0"
                            style={{ backgroundColor: color.hex }}
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900 capitalize">{color.name}</div>
                            <div className="text-xs text-gray-500">{Math.round(color.weight * 100)}% of portfolio</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Signature Fabrics */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="font-semibold text-gray-900 mb-3">Signature Fabrics</h3>
                    <div className="space-y-2">
                      {profile.brandDNA.signatureFabrics.map((fabric: any, idx: number) => (
                        <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                          <div className="text-sm font-medium text-gray-900 capitalize mb-1">
                            {fabric.name}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <span className="px-2 py-0.5 bg-white rounded border border-gray-200">
                              {fabric.properties.texture}
                            </span>
                            <span className="px-2 py-0.5 bg-white rounded border border-gray-200">
                              {fabric.properties.drape}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {Math.round(fabric.weight * 100)}% usage
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Generate Action */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Ready to generate?</h4>
                      <p className="text-sm text-gray-600">
                        Create new designs that match your signature aesthetic
                      </p>
                    </div>
                    <button
                      onClick={() => navigate('/generation')}
                      className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 flex items-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      Generate Designs
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Aesthetic Themes with Actions */}
            {profile.aestheticThemes && profile.aestheticThemes.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-light text-gray-900 mb-4">Aesthetic Themes</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {profile.aestheticThemes.map((theme: any, idx: number) => (
                    <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-900">{theme.name}</h3>
                        <span className="text-sm text-gray-500">{theme.frequency}</span>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-3">{theme.description}</p>
                      
                      {/* Construction Details */}
                      {theme.construction_details?.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs text-gray-500 mb-1">Signature details:</p>
                          <div className="flex flex-wrap gap-1">
                            {theme.construction_details.map((detail: string, didx: number) => (
                              <span key={didx} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                                {detail}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Generate Button */}
                      <button
                        onClick={() => {
                          navigate('/generation', {
                            state: { 
                              seedAesthetic: theme.name,
                              seedElements: theme.construction_details,
                              promptHint: `${theme.name} style design`
                            }
                          });
                        }}
                        className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 flex items-center justify-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        Generate {theme.name} designs
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Style Labels */}
            <div className="mb-8">
              <h2 className="text-2xl font-light text-gray-900 mb-4 flex items-center">
                <Tag className="w-6 h-6 mr-2" />
                Style Tags
              </h2>
              <div className="flex flex-wrap gap-3">
                {profile.styleTags && profile.styleTags.length > 0 ? (
                  profile.styleTags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-4 py-2 bg-gray-900 text-white rounded-full text-sm"
                    >
                      {tag}
                    </span>
                  ))
                ) : profile.styleLabels && profile.styleLabels.length > 0 ? (
                  profile.styleLabels.map((label, idx) => (
                    <span
                      key={idx}
                      className="px-4 py-2 bg-gray-900 text-white rounded-full text-sm"
                    >
                      {label.name}
                    </span>
                  ))
                ) : (
                  <p className="text-gray-400">No style tags available yet</p>
                )}
              </div>
            </div>

            {/* Distributions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Garments */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Top Garments</h3>
                <div className="space-y-2">
                  {getTopDistribution(profile.distributions.garments, 3).map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 capitalize">{item.label}</span>
                      <span className="text-sm font-semibold text-gray-900">{item.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Colors */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Top Colors</h3>
                <div className="space-y-2">
                  {getTopDistribution(profile.distributions.colors, 3).map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 capitalize">{item.label}</span>
                      <span className="text-sm font-semibold text-gray-900">{item.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fabrics */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Top Fabrics</h3>
                <div className="space-y-2">
                  {getTopDistribution(profile.distributions.fabrics, 3).map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 capitalize">{item.label}</span>
                      <span className="text-sm font-semibold text-gray-900">{item.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Silhouettes */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Top Silhouettes</h3>
                <div className="space-y-2">
                  {getTopDistribution(profile.distributions.silhouettes, 3).map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 capitalize">{item.label}</span>
                      <span className="text-sm font-semibold text-gray-900">{item.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Portfolio Images - Improved UX with Horizontal Scroll */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-light text-gray-900 flex items-center">
              <ImageIcon className="w-6 h-6 mr-2" />
              Portfolio Images ({profile.portfolioImages?.length || 0})
            </h2>
            
            {/* Add Images Button */}
            <label className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 cursor-pointer flex items-center gap-2">
              {uploading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Add More Images
                </>
              )}
              <input
                type="file"
                accept=".zip"
                onChange={handleAddImages}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>

          {profile.portfolioImages && profile.portfolioImages.length > 0 ? (
            <div className="overflow-x-auto">
              <div className="flex gap-4 pb-4" style={{ minWidth: 'max-content' }}>
                {profile.portfolioImages.slice(0, 20).map((image) => (
                  <div
                    key={image.id}
                    className="flex-shrink-0 w-32 h-32 bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-gray-900 transition-all"
                    onClick={() => setSelectedImage(image)}
                  >
                    <img
                      src={image.url}
                      alt={image.filename}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
              {profile.portfolioImages.length > 20 && (
                <div className="mt-4 text-center">
                  <p className="text-gray-600">
                    Showing 20 of {profile.portfolioImages.length} images. 
                  </p>
                  <button 
                    onClick={() => {
                      // Show first image in lightbox to allow navigation through all
                      setSelectedImage(profile.portfolioImages[0]);
                    }}
                    className="mt-2 text-gray-900 hover:underline"
                  >
                    View all images
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-16 bg-gray-50 rounded-lg">
              <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-400">No portfolio images found</p>
            </div>
          )}
        </div>

        {/* Image Lightbox */}
        {selectedImage && (
          <div
            className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-8"
            onClick={() => setSelectedImage(null)}
          >
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white"
            >
              <X className="w-6 h-6" />
            </button>

            <img
              src={selectedImage.url}
              alt={selectedImage.filename}
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-sm">
              {selectedImage.filename}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StyleProfile;
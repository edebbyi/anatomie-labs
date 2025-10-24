import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, Tag, Image as ImageIcon, Plus, Loader } from 'lucide-react';
import authAPI from '../services/authAPI';

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

interface StyleProfile {
  id: string;
  portfolioId: string;
  styleLabels: StyleLabel[];
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

        {/* Style Labels */}
        <div className="mb-8">
          <h2 className="text-2xl font-light text-gray-900 mb-4 flex items-center">
            <Tag className="w-6 h-6 mr-2" />
            Style Tags
          </h2>
          <div className="flex flex-wrap gap-3">
            {profile.styleLabels && profile.styleLabels.length > 0 ? (
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

        {/* Portfolio Images */}
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {profile.portfolioImages.map((image) => (
                <div
                  key={image.id}
                  className="aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-gray-900 transition-all"
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

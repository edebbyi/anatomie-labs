import React, { useState, useEffect, useRef } from 'react';
import { Palette, Loader, Plus, Upload, Tag, Sparkles, Edit2, Save, X as XIcon } from 'lucide-react';
import axios from 'axios';
import authAPI from '../services/authAPI';

interface StyleData {
  dominantColors: string[];
  styleTags: string[];
  materials: string[];
  silhouettes: string[];
  aesthetic: string;
}

interface PortfolioImage {
  id: string;
  url: string;
  timestamp: Date;
}

const StyleProfile: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingTags, setEditingTags] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [profile, setProfile] = useState<StyleData>({
    dominantColors: [],
    styleTags: [],
    materials: [],
    silhouettes: [],
    aesthetic: '',
  });
  const [portfolioImages, setPortfolioImages] = useState<PortfolioImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const currentUser = localStorage.getItem('currentUser');
      const userId = currentUser ? JSON.parse(currentUser).id : null;
      
      if (!userId) {
        setLoading(false);
        return;
      }

      const token = authAPI.getToken();
      
      // Load enriched style profile from Node service (style clustering)
      try {
        const profileResponse = await fetch(`${API_URL}/style-clustering/profile/${userId}`);
        
        if (profileResponse.ok) {
          const result = await profileResponse.json();
          console.log('🎨 Style profile (node):', result);
          
          if (result.success && result.data) {
            const prof = result.data;
            setProfile({
              dominantColors: prof.signature_elements?.colors || [],
              styleTags: prof.style_tags || [],
              materials: prof.signature_elements?.materials || [],
              silhouettes: prof.signature_elements?.silhouettes || [],
              aesthetic: prof.insights?.dominantStyle || (prof.style_tags?.[0] || 'Contemporary'),
            });
          }
        }
      } catch (err) {
        console.log('No style profile found:', err);
      }
      
      // Load portfolio images
      try {
        const portfolioResponse = await fetch(`${API_URL}/agents/portfolio/${userId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (portfolioResponse.ok) {
          const result = await portfolioResponse.json();
          console.log('🖼️ Portfolio:', result);
          
          if (result.success && result.data.images) {
            const images = result.data.images.map((img: any) => ({
              id: img.id,
              url: img.url,
              timestamp: new Date(img.created_at || Date.now())
            }));
            setPortfolioImages(images);
          }
        }
      } catch (err) {
        console.log('No portfolio found:', err);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUploading(true);
    
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = currentUser.id;
      const token = authAPI.getToken();
      
      // Upload to R2 first
      const formData = new FormData();
      Array.from(files).forEach(file => formData.append('images', file));
      
      const uploadResponse = await fetch(`${API_URL}/images/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      if (!uploadResponse.ok) throw new Error('Upload failed');
      
      const uploadResult = await uploadResponse.json();
      const imageUrls = uploadResult.urls;
      
      console.log('⬆️ Uploaded images:', imageUrls);
      
      // Add to portfolio and re-analyze
      const analyzeResponse = await fetch(`${API_URL}/agents/portfolio/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          designer_id: userId,
          image_urls: imageUrls
        })
      });
      
      if (analyzeResponse.ok) {
        console.log('✅ Portfolio updated and re-analyzed');
        // Reload profile
        await loadProfile();
      }
    } catch (error) {
      console.error('❌ Upload failed:', error);
      alert('Failed to upload images. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  const addTag = () => {
    if (newTag.trim() && !profile.styleTags.includes(newTag.trim())) {
      setProfile({
        ...profile,
        styleTags: [...profile.styleTags, newTag.trim()]
      });
      setNewTag('');
    }
  };
  
  const removeTag = (tagToRemove: string) => {
    setProfile({
      ...profile,
      styleTags: profile.styleTags.filter(tag => tag !== tagToRemove)
    });
  };
  
  const saveTags = async () => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = currentUser.id;
      const token = authAPI.getToken();
      
      // Update style profile with new tags
      const response = await fetch(`${API_URL}/agents/profile/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          style_tags: profile.styleTags
        })
      });
      
      if (response.ok) {
        console.log('✅ Tags updated');
        setEditingTags(false);
      } else {
        console.error('❌ Failed to update tags');
        alert('Failed to save tags');
      }
    } catch (error) {
      console.error('❌ Error saving tags:', error);
      alert('Failed to save tags');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader className="w-12 h-12 text-gray-900 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-12">
          <h1 className="text-5xl font-light text-gray-900 mb-2">Style Profile</h1>
          <p className="text-gray-600">Your AI-analyzed fashion style</p>
        </div>

        {/* Style Tags */}
        <div className="bg-white border border-gray-200 rounded-lg p-8 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Tag className="w-6 h-6 text-gray-900" />
              <h2 className="text-2xl font-medium text-gray-900">Style Tags</h2>
            </div>
            {!editingTags ? (
              <button
                onClick={() => setEditingTags(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
            ) : (
              <button
                onClick={saveTags}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-900 text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            )}
          </div>
          
          {profile.styleTags.length > 0 ? (
            <div className="flex flex-wrap gap-3 mb-4">
              {profile.styleTags.map((tag, idx) => (
                <span key={idx} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm flex items-center gap-2">
                  {tag}
                  {editingTags && (
                    <button
                      onClick={() => removeTag(tag)}
                      className="hover:bg-white/20 rounded-full p-0.5"
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 mb-4">No style tags yet. Add some below.</p>
          )}
          
          {editingTags && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addTag()}
                placeholder="Add a style tag..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <button
                onClick={addTag}
                className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Add
              </button>
            </div>
          )}
        </div>

        {/* Colors */}
        {profile.dominantColors.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-8 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Palette className="w-6 h-6 text-gray-900" />
              <h2 className="text-2xl font-medium text-gray-900">Color Palette</h2>
            </div>
            <div className="flex flex-wrap gap-4">
              {profile.dominantColors.map((color, idx) => (
                <div key={idx} className="flex flex-col items-center gap-2">
                  <div
                    className="w-20 h-20 rounded-lg border border-gray-300 shadow-sm"
                    style={{ backgroundColor: color }}
                  />
                  <p className="text-sm text-gray-600">{color}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Materials */}
        {profile.materials.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-8 mb-6">
            <h2 className="text-2xl font-medium text-gray-900 mb-6">Materials</h2>
            <div className="flex flex-wrap gap-3">
              {profile.materials.map((mat, idx) => (
                <span key={idx} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm">
                  {mat}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Silhouettes */}
        {profile.silhouettes.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-8 mb-6">
            <h2 className="text-2xl font-medium text-gray-900 mb-6">Silhouettes</h2>
            <div className="flex flex-wrap gap-3">
              {profile.silhouettes.map((sil, idx) => (
                <span key={idx} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm">
                  {sil}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Portfolio Gallery */}
        <div className="bg-white border border-gray-200 rounded-lg p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-gray-900" />
              <h2 className="text-2xl font-medium text-gray-900">Portfolio</h2>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {uploading ? 'Uploading...' : 'Add Images'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
          
          {portfolioImages.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {portfolioImages.map((img) => (
                <div key={img.id} className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={img.url}
                    alt="Portfolio image"
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 border-2 border-dashed border-gray-300 rounded-lg">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-400 text-lg mb-2">No portfolio images yet</p>
              <p className="text-gray-500 text-sm">Click "Add Images" to upload your designs</p>
            </div>
          )}
        </div>

        {profile.styleTags.length === 0 && profile.dominantColors.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg">
              Complete onboarding to analyze your style profile
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StyleProfile;

import React, { useState, useEffect, useRef } from 'react';
import { User, LogOut, Upload, Camera, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import authAPI from '../services/authAPI';

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = authAPI.getCurrentUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [profile, setProfile] = useState({
    name: currentUser?.name || '',
    email: currentUser?.email || '',
    company: '',
    logoUrl: null as string | null,
  });

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = () => {
    const savedProfile = localStorage.getItem('userProfile');
    if (savedProfile) {
      const parsed = JSON.parse(savedProfile);
      setProfile({
        name: parsed.name || currentUser?.name || '',
        email: parsed.email || currentUser?.email || '',
        company: parsed.company || '',
        logoUrl: parsed.logoUrl || null,
      });
      if (parsed.logoUrl) {
        setLogoPreview(parsed.logoUrl);
      }
    }
  };

  const handleLogoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    setUploading(true);

    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setLogoPreview(base64String);
        setProfile({
          ...profile,
          logoUrl: base64String,
        });
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading logo:', error);
      alert('Failed to upload logo');
      setUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    setProfile({
      ...profile,
      logoUrl: null,
    });
  };

  const handleLogout = () => {
    authAPI.logout();
    navigate('/login');
  };

  const handleSave = () => {
    // Validate required fields
    if (!profile.name.trim()) {
      alert('Name is required');
      return;
    }
    if (!profile.email.trim()) {
      alert('Email is required');
      return;
    }

    setSaving(true);
    
    try {
      localStorage.setItem('userProfile', JSON.stringify(profile));
      
      // Trigger storage event to update other components
      window.dispatchEvent(new Event('storage'));
      
      alert('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-12">
          <h1 className="text-5xl font-light text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">Manage your account</p>
        </div>

        {/* Profile Section */}
        <div className="bg-white border border-gray-200 rounded-lg p-8 mb-6">
          <div className="flex flex-col md:flex-row gap-8 mb-8">
            {/* Logo Upload Section */}
            <div className="flex-shrink-0">
              <div className="space-y-4">
                <div className="relative">
                  {logoPreview || profile.logoUrl ? (
                    <div className="relative group">
                      <img
                        src={logoPreview || profile.logoUrl || ''}
                        alt="Company Logo"
                        className="w-32 h-32 rounded-lg object-cover border-4 border-gray-200"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={handleLogoClick}
                          className="text-white text-sm font-medium"
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="w-32 h-32 rounded-lg bg-gray-100 flex items-center justify-center border-4 border-gray-200">
                      <User className="w-16 h-16 text-gray-400" />
                    </div>
                  )}
                  <button
                    onClick={handleLogoClick}
                    disabled={uploading}
                    className="absolute bottom-0 right-0 p-2 bg-gray-900 text-white rounded-full shadow-lg hover:bg-gray-800 disabled:opacity-50"
                  >
                    {uploading ? (
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                  </button>
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                
                <div className="space-y-2">
                  <button
                    onClick={handleLogoClick}
                    disabled={uploading}
                    className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Logo
                  </button>
                  
                  {(logoPreview || profile.logoUrl) && (
                    <button
                      onClick={handleRemoveLogo}
                      className="w-full flex items-center justify-center px-4 py-2 border border-red-300 rounded-lg text-sm font-medium text-red-700 bg-white hover:bg-red-50"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Remove Logo
                    </button>
                  )}
                  
                  <p className="text-xs text-gray-500 text-center">
                    PNG, JPG up to 5MB
                  </p>
                </div>
              </div>
            </div>

            {/* Profile Info */}
            <div className="flex-grow">
              <div className="mb-6">
                <h2 className="text-2xl font-medium text-gray-900">{profile.name || 'User'}</h2>
                <p className="text-gray-600">{profile.email}</p>
                {profile.company && (
                  <p className="text-gray-500 text-sm mt-1">{profile.company}</p>
                )}
              </div>
            </div>
          </div>

          {/* Profile Form */}
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
              <input
                type="text"
                value={profile.company}
                onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900"
                placeholder="Your company name (optional)"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/onboarding')}
            className="w-full py-3 bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50"
          >
            Re-upload Portfolio
          </button>
          
          <button
            onClick={handleLogout}
            className="w-full py-3 bg-red-50 text-red-600 rounded-lg border border-red-200 hover:bg-red-100 flex items-center justify-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;

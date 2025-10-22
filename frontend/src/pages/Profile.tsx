import React, { useState, useEffect, useRef } from 'react';
import { User, Upload, Camera, Save, X, Edit2 } from 'lucide-react';

interface UserProfile {
  userId: string;
  name: string;
  email: string;
  company: string;
  logoUrl: string | null;
  createdAt: string;
  preferences: {
    defaultModel: string;
    defaultGenerationCount: number;
  };
}

const Profile: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile>({
    userId: 'anatomie-user',
    name: 'ANATOMIE Team',
    email: 'team@anatomie.com',
    company: 'ANATOMIE',
    logoUrl: null,
    createdAt: new Date().toISOString(),
    preferences: {
      defaultModel: 'stable-diffusion',
      defaultGenerationCount: 10,
    },
  });

  const [editing, setEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState(profile);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = () => {
    // Load from localStorage for demo
    const savedProfile = localStorage.getItem('userProfile');
    if (savedProfile) {
      const parsed = JSON.parse(savedProfile);
      setProfile(parsed);
      setEditedProfile(parsed);
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
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    setUploading(true);

    try {
      // Convert to base64 for demo (in production, upload to server)
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setLogoPreview(base64String);
        setEditedProfile({
          ...editedProfile,
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
    setEditedProfile({
      ...editedProfile,
      logoUrl: null,
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save to localStorage for demo (in production, save to backend)
      localStorage.setItem('userProfile', JSON.stringify(editedProfile));
      
      setProfile(editedProfile);
      setEditing(false);
      
      // Trigger storage event to update header immediately
      window.dispatchEvent(new Event('storage'));
      
      // Force page reload to update header (temporary workaround)
      window.location.reload();
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedProfile(profile);
    setLogoPreview(profile.logoUrl);
    setEditing(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage your account information and preferences
          </p>
        </div>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Edit2 className="mr-2 h-4 w-4" />
            Edit Profile
          </button>
        ) : (
          <div className="flex space-x-3">
            <button
              onClick={handleCancel}
              className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-anatomie-accent hover:bg-indigo-700 disabled:opacity-50"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* Profile Card */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Logo Section */}
            <div className="lg:col-span-1">
              <div className="space-y-4">
                <div className="text-center">
                  <div className="relative inline-block">
                    {logoPreview || profile.logoUrl ? (
                      <div className="relative group">
                        <img
                          src={logoPreview || profile.logoUrl || ''}
                          alt="Company Logo"
                          className="h-32 w-32 rounded-lg object-cover border-4 border-gray-200"
                        />
                        {editing && (
                          <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={handleLogoClick}
                              className="text-white text-sm font-medium"
                            >
                              Change
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-32 w-32 rounded-lg bg-gray-100 flex items-center justify-center border-4 border-gray-200">
                        <User className="h-16 w-16 text-gray-400" />
                      </div>
                    )}
                    {editing && (
                      <button
                        onClick={handleLogoClick}
                        disabled={uploading}
                        className="absolute bottom-0 right-0 p-2 bg-anatomie-accent text-white rounded-full shadow-lg hover:bg-indigo-700"
                      >
                        {uploading ? (
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                        ) : (
                          <Camera className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>

                {editing && (
                  <div className="space-y-2">
                    <button
                      onClick={handleLogoClick}
                      disabled={uploading}
                      className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Logo
                    </button>
                    {(logoPreview || profile.logoUrl) && (
                      <button
                        onClick={handleRemoveLogo}
                        className="w-full flex items-center justify-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50"
                      >
                        <X className="mr-2 h-4 w-4" />
                        Remove Logo
                      </button>
                    )}
                    <p className="text-xs text-gray-500 text-center">
                      PNG, JPG up to 5MB
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Profile Information */}
            <div className="lg:col-span-2 space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Full Name
                    </label>
                    {editing ? (
                      <input
                        type="text"
                        value={editedProfile.name}
                        onChange={(e) =>
                          setEditedProfile({ ...editedProfile, name: e.target.value })
                        }
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-anatomie-accent focus:border-anatomie-accent"
                      />
                    ) : (
                      <p className="mt-1 text-sm text-gray-900">{profile.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    {editing ? (
                      <input
                        type="email"
                        value={editedProfile.email}
                        onChange={(e) =>
                          setEditedProfile({ ...editedProfile, email: e.target.value })
                        }
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-anatomie-accent focus:border-anatomie-accent"
                      />
                    ) : (
                      <p className="mt-1 text-sm text-gray-900">{profile.email}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Company
                    </label>
                    {editing ? (
                      <input
                        type="text"
                        value={editedProfile.company}
                        onChange={(e) =>
                          setEditedProfile({ ...editedProfile, company: e.target.value })
                        }
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-anatomie-accent focus:border-anatomie-accent"
                      />
                    ) : (
                      <p className="mt-1 text-sm text-gray-900">{profile.company}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      User ID
                    </label>
                    <p className="mt-1 text-sm text-gray-500">{profile.userId}</p>
                  </div>
                </div>
              </div>

              {/* Preferences */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Generation Preferences
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Default Model
                    </label>
                    {editing ? (
                      <select
                        value={editedProfile.preferences.defaultModel}
                        onChange={(e) =>
                          setEditedProfile({
                            ...editedProfile,
                            preferences: {
                              ...editedProfile.preferences,
                              defaultModel: e.target.value,
                            },
                          })
                        }
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-anatomie-accent focus:border-anatomie-accent"
                      >
                        <option value="stable-diffusion">Stable Diffusion</option>
                        <option value="dall-e">DALL-E</option>
                        <option value="midjourney">Midjourney</option>
                      </select>
                    ) : (
                      <p className="mt-1 text-sm text-gray-900 capitalize">
                        {profile.preferences.defaultModel.replace('-', ' ')}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Default Generation Count
                    </label>
                    {editing ? (
                      <input
                        type="number"
                        min="4"
                        max="20"
                        value={editedProfile.preferences.defaultGenerationCount}
                        onChange={(e) =>
                          setEditedProfile({
                            ...editedProfile,
                            preferences: {
                              ...editedProfile.preferences,
                              defaultGenerationCount: parseInt(e.target.value),
                            },
                          })
                        }
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-anatomie-accent focus:border-anatomie-accent"
                      />
                    ) : (
                      <p className="mt-1 text-sm text-gray-900">
                        {profile.preferences.defaultGenerationCount} images
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Account Info */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Account Information
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Member Since</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {new Date(profile.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Account Status</dt>
                      <dd className="mt-1">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Settings */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Additional Settings
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Email Notifications</p>
                <p className="text-sm text-gray-500">
                  Receive updates about your generations
                </p>
              </div>
              <button
                type="button"
                className="bg-anatomie-accent relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-anatomie-accent focus:ring-offset-2"
              >
                <span className="translate-x-5 inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Auto-save Preferences</p>
                <p className="text-sm text-gray-500">
                  Automatically save your generation preferences
                </p>
              </div>
              <button
                type="button"
                className="bg-anatomie-accent relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-anatomie-accent focus:ring-offset-2"
              >
                <span className="translate-x-5 inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;

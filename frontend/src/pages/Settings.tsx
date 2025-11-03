import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  LogOut,
  Trash2,
  UploadCloud,
  CheckCircle,
  AlertCircle,
  Loader,
} from 'lucide-react';

import authAPI from '../services/authAPI';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Separator } from '../components/ui/separator';

type StoredProfile = {
  name: string;
  email: string;
  company: string;
  logoUrl: string | null;
  notifications?: NotificationPreferences;
};

type NotificationPreferences = {
  email: boolean;
  generationComplete: boolean;
  weeklyDigest: boolean;
};

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  email: true,
  generationComplete: true,
  weeklyDigest: false,
};

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = authAPI.getCurrentUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<StoredProfile>({
    name: currentUser?.name || '',
    email: currentUser?.email || '',
    company: '',
    logoUrl: null,
  });
  const [notifications, setNotifications] =
    useState<NotificationPreferences>(DEFAULT_NOTIFICATIONS);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Model Gender Preference State
  const [modelGenderPreference, setModelGenderPreference] = useState<{
    setting: 'auto' | 'female' | 'male' | 'both';
    detected_gender: string | null;
    confidence: number;
    manual_override: boolean;
  }>({
    setting: 'auto',
    detected_gender: null,
    confidence: 0,
    manual_override: false
  });
  const [isLoadingGender, setIsLoadingGender] = useState(false);
  const [isSavingGender, setIsSavingGender] = useState(false);
  const [genderMessage, setGenderMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadProfile();
    loadModelGenderPreference();
  }, []);

  const loadModelGenderPreference = async () => {
    try {
      setIsLoadingGender(true);
      const user = authAPI.getCurrentUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const token = authAPI.getToken();
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await fetch(`/api/model-gender/preference?userId=${user.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setModelGenderPreference(data.preference);
      }
    } catch (error) {
      console.error('Failed to load model gender preference:', error);
    } finally {
      setIsLoadingGender(false);
    }
  };

  const handleModelGenderChange = async (newSetting: 'auto' | 'female' | 'male' | 'both') => {
    try {
      setIsSavingGender(true);
      setGenderMessage(null);

      const user = authAPI.getCurrentUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const token = authAPI.getToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('/api/model-gender/preference', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: user.id,
          setting: newSetting,
          manual_override: newSetting !== 'auto'
        })
      });

      console.log('Model gender preference response:', {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText
      });

      if (response.ok) {
        const data = await response.json();
        setModelGenderPreference(data.preference);
        setGenderMessage({ type: 'success', text: `Model gender preference set to: ${newSetting}` });
        setTimeout(() => setGenderMessage(null), 3000);
      } else {
        let errorMessage = 'Failed to save preference';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          // Response body might be empty, use default error message
          errorMessage = `Server error (${response.status}): ${response.statusText || 'Unknown error'}`;
        }
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Failed to save model gender preference:', error);
      setGenderMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save preference' });
    } finally {
      setIsSavingGender(false);
    }
  };

  const portfolioStats = useMemo(() => {
    const stored = localStorage.getItem('portfolioSummary');
    if (!stored) return null;
    try {
      const parsed = JSON.parse(stored);
      return {
        count:
          parsed?.totalImages ??
          parsed?.imageCount ??
          parsed?.images ??
          parsed?.portfolioCount ??
          0,
        lastUpdated: parsed?.updatedAt ?? parsed?.lastUpdated ?? null,
      };
    } catch {
      return null;
    }
  }, []);

  const loadProfile = () => {
    const savedProfile = localStorage.getItem('userProfile');
    if (!savedProfile) return;

    try {
      const parsed: StoredProfile = JSON.parse(savedProfile);
      setProfile({
        name: parsed.name || currentUser?.name || '',
        email: parsed.email || currentUser?.email || '',
        company: parsed.company || '',
        logoUrl: parsed.logoUrl || null,
      });
      setNotifications({
        ...DEFAULT_NOTIFICATIONS,
        ...parsed.notifications,
      });

      if (parsed.logoUrl) {
        setLogoPreview(parsed.logoUrl);
      }
    } catch (error) {
      console.error('Failed to parse stored profile', error);
    }
  };

  const handleLogoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      window.alert('Please select an image file (PNG, JPG, SVG)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      window.alert('File size must be less than 5MB');
      return;
    }

    setUploading(true);

    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setLogoPreview(base64String);
        setProfile((prev) => ({
          ...prev,
          logoUrl: base64String,
        }));
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading logo:', error);
      window.alert('Failed to upload logo');
      setUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    setProfile((prev) => ({
      ...prev,
      logoUrl: null,
    }));
  };

  const handleSave = () => {
    if (!profile.name.trim()) {
      window.alert('Name is required');
      return;
    }
    if (!profile.email.trim()) {
      window.alert('Email is required');
      return;
    }

    setSaving(true);

    try {
      const payload: StoredProfile = {
        ...profile,
        notifications,
      };
      localStorage.setItem('userProfile', JSON.stringify(payload));
      window.dispatchEvent(new Event('storage'));
      window.alert('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      window.alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      window.alert('Please type DELETE to confirm');
      return;
    }

    setIsDeleting(true);
    try {
      await authAPI.deleteAccount();
      navigate('/login');
    } catch (error) {
      window.alert('Failed to delete account. Please try again.');
      setIsDeleting(false);
    }
  };

  const handleLogout = () => {
    authAPI.logout();
    navigate('/login');
  };

  const toggleNotification = (key: keyof NotificationPreferences) => {
    setNotifications((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-10">
        <header className="space-y-3">
          <span className="text-xs uppercase tracking-[0.4em] text-gray-400">
            Account Console
          </span>
          <h1 className="text-4xl font-light text-gray-900">
            Settings & Preferences
          </h1>
          <p className="max-w-2xl text-sm text-gray-600">
            Update your personal details, brand identity, and Podna
            notifications. Changes are stored locally until we enable account
            sync.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle>Profile</CardTitle>
              <CardDescription>
                Your Podna identity shown across the studio
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="grid gap-2">
                <Label htmlFor="settings-name">Name</Label>
                <Input
                  id="settings-name"
                  value={profile.name}
                  onChange={(event) =>
                    setProfile((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Alex Garcia"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="settings-email">Email</Label>
                <Input
                  id="settings-email"
                  type="email"
                  value={profile.email}
                  onChange={(event) =>
                    setProfile((prev) => ({
                      ...prev,
                      email: event.target.value,
                    }))
                  }
                  placeholder="alex@example.com"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="settings-company">Company / Label</Label>
                <Input
                  id="settings-company"
                  value={profile.company}
                  onChange={(event) =>
                    setProfile((prev) => ({
                      ...prev,
                      company: event.target.value,
                    }))
                  }
                  placeholder="PODNA Studio"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle>Brand Identity</CardTitle>
              <CardDescription>
                Upload your mark to personalise reports and share-outs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-center">
                <div className="relative">
                  <div className="flex h-32 w-32 items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Brand logo"
                        className="h-full w-full rounded-2xl object-cover"
                      />
                    ) : (
                      <span className="text-sm uppercase tracking-[0.25em] text-gray-400">
                        {profile.company
                          ? profile.company[0]
                          : profile.name.charAt(0) || 'P'}
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="absolute -bottom-3 -right-3 rounded-full shadow"
                    onClick={handleLogoClick}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="grid gap-3">
                <Button variant="outline" onClick={handleLogoClick}>
                  <UploadCloud className="mr-2 h-4 w-4" />
                  Upload logo
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start text-sm text-red-600 hover:bg-red-50"
                  onClick={handleRemoveLogo}
                  disabled={!logoPreview}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove current logo
                </Button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />

              <p className="text-xs text-gray-500">
                PNG, JPG, or SVG up to 5MB. We recommend a transparent PNG for
                the cleanest presentation.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle>Portfolio & Style Data</CardTitle>
              <CardDescription>
                Keep your brand DNA current by refreshing your portfolio
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Images analysed</span>
                  <span className="text-base font-medium text-gray-900">
                    {portfolioStats?.count ?? '—'}
                  </span>
                </div>
                {portfolioStats?.lastUpdated && (
                  <p className="mt-2 text-xs text-gray-500">
                    Last updated:{' '}
                    {new Date(portfolioStats.lastUpdated).toLocaleDateString()}
                  </p>
                )}
              </div>

              <div className="space-y-3 text-sm text-gray-600">
                <p>
                  Upload a refreshed ZIP from your latest campaign or lookbook to
                  retrain the style profile.
                </p>
                <p>
                  Podna will automatically recompute your clusters, signature
                  elements, and colour weighting.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => navigate('/onboarding')}
                >
                  Re-upload portfolio
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/style-profile')}
                >
                  View style profile
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle>Notifications</CardTitle>
              <CardDescription>
                Choose the signals you want from the Podna studio
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-6">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-700">
                    Email updates
                  </p>
                  <p className="text-xs text-gray-500">
                    Receive account and platform announcements
                  </p>
                </div>
                <Switch
                  checked={notifications.email}
                  onCheckedChange={() => toggleNotification('email')}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-6">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-700">
                    Generation complete alerts
                  </p>
                  <p className="text-xs text-gray-500">
                    We’ll nudge you when a batch finishes processing
                  </p>
                </div>
                <Switch
                  checked={notifications.generationComplete}
                  onCheckedChange={() =>
                    toggleNotification('generationComplete')
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-6">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-700">
                    Weekly style digest
                  </p>
                  <p className="text-xs text-gray-500">
                    Receive a summary of wins, gaps, and new opportunities
                  </p>
                </div>
                <Switch
                  checked={notifications.weeklyDigest}
                  onCheckedChange={() => toggleNotification('weeklyDigest')}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Model Gender Preference */}
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle>Model Gender Preference</CardTitle>
            <CardDescription>
              Control which model gender appears in AI-generated designs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingGender ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                {/* Detection Status */}
                {modelGenderPreference.detected_gender && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-blue-900">
                          Auto-detected from portfolio: <span className="capitalize font-semibold">{modelGenderPreference.detected_gender}</span>
                        </p>
                        <p className="text-xs text-blue-700 mt-1">
                          Confidence: {Math.round(modelGenderPreference.confidence * 100)}%
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Gender Options */}
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Model Gender Setting</Label>
                    <p className="text-sm text-gray-600 mb-3">
                      Choose how model gender is selected for your generated images
                    </p>
                  </div>

                  <div className="grid gap-2">
                    {[
                      {
                        value: 'auto' as const,
                        label: 'Auto',
                        description: 'Match portfolio analysis (recommended)'
                      },
                      {
                        value: 'female' as const,
                        label: 'Women Only',
                        description: 'Always generate with female models'
                      },
                      {
                        value: 'male' as const,
                        label: 'Men Only',
                        description: 'Always generate with male models'
                      },
                      {
                        value: 'both' as const,
                        label: 'Both Genders',
                        description: 'Intelligently alternate between male and female models'
                      }
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleModelGenderChange(option.value)}
                        disabled={isSavingGender}
                        className={`
                          p-3 rounded-lg border-2 text-left transition-all
                          ${modelGenderPreference.setting === option.value
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-200 bg-white hover:border-indigo-300'
                          }
                          ${isSavingGender ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`
                            w-5 h-5 rounded-full border-2 mt-1 flex-shrink-0
                            ${modelGenderPreference.setting === option.value
                              ? 'border-indigo-500 bg-indigo-500'
                              : 'border-gray-300'
                            }
                          `} />
                          <div>
                            <p className="font-medium text-gray-900">{option.label}</p>
                            <p className="text-xs text-gray-600 mt-0.5">{option.description}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status Message */}
                {genderMessage && (
                  <div className={`
                    mt-4 p-3 rounded-lg flex items-start gap-2
                    ${genderMessage.type === 'success'
                      ? 'bg-green-50 text-green-900 border border-green-200'
                      : 'bg-red-50 text-red-900 border border-red-200'
                    }
                  `}>
                    {genderMessage.type === 'success' ? (
                      <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    )}
                    <p className="text-sm">{genderMessage.text}</p>
                  </div>
                )}

                {/* Info Box */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-4">
                  <p className="text-xs text-gray-700">
                    💡 <strong>Tip:</strong> When "Both Genders" is selected, the system intelligently balances which gender appears based on your recent preferences to increase design variety.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50/40">
          <CardHeader>
            <CardTitle className="text-red-700">Danger zone</CardTitle>
            <CardDescription className="text-red-600">
              Permanently remove your Podna account and related data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-red-600">
              This action cannot be undone. Type{' '}
              <span className="font-semibold">DELETE</span> below to confirm.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                className="bg-white"
                placeholder="Type DELETE to confirm"
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
              />
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting…' : 'Delete account'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-200 pt-6 text-sm text-gray-500 sm:flex-row">
          <div>
            Signed in as <span className="font-medium">{profile.email}</span>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Settings;

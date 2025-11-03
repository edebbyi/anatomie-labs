import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';

interface ModelGenderPreference {
  setting: 'auto' | 'female' | 'male' | 'both';
  detected_gender: string | null;
  confidence: number;
  manual_override: boolean;
}

export function SettingsPage() {
  const [modelGenderPreference, setModelGenderPreference] = useState<ModelGenderPreference>({
    setting: 'auto',
    detected_gender: null,
    confidence: 0,
    manual_override: false
  });
  const [isLoadingGender, setIsLoadingGender] = useState(false);
  const [isSavingGender, setIsSavingGender] = useState(false);
  const [genderMessage, setGenderMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadModelGenderPreference();
  }, []);

  const loadModelGenderPreference = async () => {
    try {
      setIsLoadingGender(true);
      const response = await fetch('/api/model-gender/preference');
      if (response.ok) {
        const data = await response.json();
        setModelGenderPreference(data.preference);
      }
    } catch (error) {
      console.error('Failed to load model gender preference:', error);
      setGenderMessage({ type: 'error', text: 'Failed to load preference' });
    } finally {
      setIsLoadingGender(false);
    }
  };

  const handleModelGenderChange = async (newSetting: 'auto' | 'female' | 'male' | 'both') => {
    try {
      setIsSavingGender(true);
      setGenderMessage(null);

      const response = await fetch('/api/model-gender/preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setting: newSetting,
          manual_override: newSetting !== 'auto'
        })
      });

      if (response.ok) {
        const data = await response.json();
        setModelGenderPreference(data.preference);
        setGenderMessage({ type: 'success', text: `Model gender preference set to: ${newSetting}` });
      } else {
        throw new Error('Failed to save preference');
      }
    } catch (error) {
      console.error('Failed to save model gender preference:', error);
      setGenderMessage({ type: 'error', text: 'Failed to save preference' });
    } finally {
      setIsSavingGender(false);
    }
  };

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">Manage your account and preferences</p>
        </div>

        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" defaultValue="Jane Doe" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" defaultValue="jane@example.com" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company">Company</Label>
              <Input id="company" defaultValue="ANATOMIE" />
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>

        {/* Portfolio */}
        <Card>
          <CardHeader>
            <CardTitle>Portfolio</CardTitle>
            <CardDescription>Manage your style training images</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">Current Portfolio:</p>
                  <p className="text-2xl text-gray-900">52 images analyzed</p>
                </div>
              </div>
              <p className="text-sm text-gray-500">Last updated: Jan 15, 2025</p>
            </div>
            <Separator />
            <div className="flex gap-2">
              <Button variant="outline">Re-upload Portfolio</Button>
              <Button>Update Style Profile</Button>
            </div>
          </CardContent>
        </Card>

        {/* Model Gender Preference */}
        <Card>
          <CardHeader>
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

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Choose what updates you want to receive</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Email notifications</Label>
                <p className="text-sm text-gray-500">Receive email updates</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Generation complete alerts</Label>
                <p className="text-sm text-gray-500">
                  Get notified when AI generation finishes
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Weekly style reports</Label>
                <p className="text-sm text-gray-500">
                  Receive weekly insights about your style
                </p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        {/* Advanced */}
        <Card>
          <CardHeader>
            <CardTitle>Advanced</CardTitle>
            <CardDescription>Developer and advanced options</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                ⚠️ Developer Options - These features are for advanced users only
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="outline">Analytics Dashboard</Button>
              <Button variant="outline">Coverage Analysis</Button>
              <Button variant="outline">RLHF Feedback System</Button>
            </div>
          </CardContent>
        </Card>

        {/* Privacy & Account */}
        <Card>
          <CardHeader>
            <CardTitle>Privacy & Account</CardTitle>
            <CardDescription>Manage your account settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2">
              <Button variant="outline">Change Password</Button>
              <Button variant="outline">Export Data</Button>
              <Separator />
              <Button variant="destructive">Delete Account</Button>
            </div>
          </CardContent>
        </Card>

        {/* Sign Out */}
        <div className="flex justify-center pb-8">
          <Button variant="outline" size="lg">
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}

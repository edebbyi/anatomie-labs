import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';

export function SettingsPage() {
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

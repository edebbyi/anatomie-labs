import { Sparkles, Edit, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { StyleProfile as StyleProfileType } from '../lib/mockData';
import { TagChip } from './TagChip';

interface StyleProfileProps {
  profile: StyleProfileType;
  onGenerateStyle: (styleName: string) => void;
}

export function StyleProfile({ profile, onGenerateStyle }: StyleProfileProps) {
  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header Card */}
        <Card className="bg-gradient-to-r from-[#6366f1]/10 to-[#8b5cf6]/10 border-0">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  Your Style DNA
                </CardTitle>
                <CardDescription className="mt-2 text-base max-w-3xl">
                  {profile.summaryText}
                </CardDescription>
              </div>
              <Button variant="outline" size="icon">
                <Edit className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-8 text-sm">
              <div>
                <span className="text-gray-600">Analyzed:</span>{' '}
                <span className="text-gray-900">{profile.portfolioCount} images</span>
              </div>
              <div>
                <span className="text-gray-600">Generated:</span>{' '}
                <span className="text-gray-900">{profile.generatedCount}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Aesthetic Themes */}
        <div>
          <h2 className="text-gray-900 mb-4">Aesthetic Themes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {profile.clusters.map((cluster) => (
              <Card
                key={cluster.name}
                className="hover:shadow-lg transition-all duration-200 group"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {cluster.name}
                        <Badge variant="outline" className="ml-2">
                          {cluster.weight}%
                        </Badge>
                      </CardTitle>
                      <CardDescription className="mt-2">
                        {cluster.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Signature details:</p>
                    <div className="flex flex-wrap gap-2">
                      {cluster.signatureDetails.map((detail, i) => (
                        <Badge key={i} variant="secondary">
                          {detail}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    onClick={() => onGenerateStyle(cluster.name)}
                    className="w-full bg-[#6366f1] text-white hover:bg-[#4f46e5]"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate {cluster.name} designs
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Style Tags */}
        <Card>
          <CardHeader>
            <CardTitle>Style Tags</CardTitle>
            <CardDescription>
              Your aesthetic labels based on AI analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {profile.styleLabels.map((label) => (
                <TagChip
                  key={label.name}
                  tag={label.name}
                  category="style"
                  removable
                  onRemove={(tag) => console.log('Remove tag:', tag)}
                  onClick={(tag) => console.log('Filter by tag:', tag)}
                />
              ))}
              <Button variant="outline" size="sm" className="rounded-full">
                <Plus className="w-4 h-4 mr-1" />
                Add Tag
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Top Distributions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Top Garments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Garments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(profile.distributions.garments).map(([garment, percentage]) => (
                <div key={garment}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700">{garment}</span>
                    <span className="text-sm text-gray-900">{percentage}%</span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Top Colors */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Colors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(profile.distributions.colors)
                .slice(0, 5)
                .map(([color, percentage]) => (
                  <div key={color}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-700">{color}</span>
                      <span className="text-sm text-gray-900">{percentage}%</span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                ))}
            </CardContent>
          </Card>

          {/* Top Fabrics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Fabrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(profile.distributions.fabrics).map(([fabric, percentage]) => (
                <div key={fabric}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700">{fabric}</span>
                    <span className="text-sm text-gray-900">{percentage}%</span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Top Silhouettes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Silhouettes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(profile.distributions.silhouettes).map(
                ([silhouette, percentage]) => (
                  <div key={silhouette}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-700">{silhouette}</span>
                      <span className="text-sm text-gray-900">{percentage}%</span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </div>

        {/* Portfolio Images */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Portfolio Images ({profile.portfolioCount})</CardTitle>
                <CardDescription>
                  Your uploaded images used for style analysis
                </CardDescription>
              </div>
              <Button variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add More Images
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center text-gray-400"
                >
                  <Sparkles className="w-8 h-8" />
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Add more portfolio images to refine your style profile and improve AI
              generation accuracy.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

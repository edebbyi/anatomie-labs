import { useState } from 'react';
import { Zap, Package, Palette, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Slider } from './ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { ChevronDown } from 'lucide-react';

interface GeneratePageProps {
  onGenerate: (count: number, prompt?: string) => void;
}

export function GeneratePage({ onGenerate }: GeneratePageProps) {
  const [prompt, setPrompt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [creativity, setCreativity] = useState([0.7]);
  const [batchSize, setBatchSize] = useState(50);

  const quickBatches = [
    {
      icon: Zap,
      title: 'QUICK TEST',
      count: 5,
      time: '~1 min',
      description: 'Perfect for quick iterations',
    },
    {
      icon: Package,
      title: 'STANDARD BATCH',
      count: 50,
      time: '~5 min',
      description: 'Balanced speed and variety',
    },
    {
      icon: Palette,
      title: 'LARGE BATCH',
      count: 100,
      time: '~10 min',
      description: 'Maximum creative exploration',
    },
  ];

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-gray-900 mb-2">Generate Designs</h1>
          <p className="text-gray-600">
            Create AI-powered fashion designs tailored to your unique style
          </p>
        </div>

        {/* Quick Batch Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {quickBatches.map((batch) => (
            <Card
              key={batch.title}
              className="hover:shadow-lg transition-shadow duration-200 cursor-pointer"
              onClick={() => onGenerate(batch.count)}
            >
              <CardHeader>
                <div className="w-12 h-12 rounded-full bg-[#6366f1] flex items-center justify-center mb-3">
                  <batch.icon className="w-6 h-6 text-white" />
                </div>
                <CardTitle>{batch.title}</CardTitle>
                <CardDescription>{batch.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-2xl text-gray-900">{batch.count} images</p>
                  <p className="text-sm text-gray-500">{batch.time}</p>
                  <Button className="w-full bg-[#6366f1] text-white hover:bg-[#4f46e5] mt-4">
                    Generate
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Intelligent Prompt Builder */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#6366f1]" />
              <CardTitle>Intelligent Prompt Builder</CardTitle>
            </div>
            <CardDescription>
              Describe your design vision and let AI bring it to life
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-gray-700 mb-2 block">
                Describe your design:
              </label>
              <Textarea
                placeholder="e.g., elegant evening dress with flowing silhouette, navy blue color, minimalist details..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[120px]"
              />
            </div>

            {/* Advanced Controls */}
            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    ⚙️ Advanced Controls
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      showAdvanced ? 'rotate-180' : ''
                    }`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-700 mb-2 block">
                      Creativity Level: {creativity[0].toFixed(1)}
                    </label>
                    <Slider
                      value={creativity}
                      onValueChange={setCreativity}
                      min={0.1}
                      max={0.9}
                      step={0.1}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Lower = More faithful to style | Higher = More experimental
                    </p>
                  </div>

                  <div>
                    <label className="text-sm text-gray-700 mb-2 block">
                      Batch Size
                    </label>
                    <Select
                      value={batchSize.toString()}
                      onValueChange={(v) => setBatchSize(parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 images</SelectItem>
                        <SelectItem value="25">25 images</SelectItem>
                        <SelectItem value="50">50 images</SelectItem>
                        <SelectItem value="75">75 images</SelectItem>
                        <SelectItem value="100">100 images</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm text-gray-700 mb-2 block">
                      AI Provider
                    </label>
                    <Select defaultValue="imagen">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="imagen">Imagen-4 Ultra (Recommended)</SelectItem>
                        <SelectItem value="sdxl">Stable Diffusion XL</SelectItem>
                        <SelectItem value="dalle">DALL-E 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm text-gray-700 mb-2 block">
                      Garment Type
                    </label>
                    <Select defaultValue="any">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        <SelectItem value="dress">Dress</SelectItem>
                        <SelectItem value="blazer">Blazer</SelectItem>
                        <SelectItem value="pants">Pants</SelectItem>
                        <SelectItem value="top">Top</SelectItem>
                        <SelectItem value="suit">Suit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Button
              onClick={() => onGenerate(batchSize, prompt)}
              className="w-full bg-[#6366f1] text-white hover:bg-[#4f46e5]"
              disabled={!prompt.trim()}
            >
              Generate Design →
            </Button>
          </CardContent>
        </Card>

        {/* Recent Generations */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Generations</CardTitle>
            <CardDescription>Your latest AI-generated batches</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { count: 50, style: 'elegant dresses', time: '5 min ago', status: 'completed' },
                { count: 25, style: 'minimalist blazers', time: '1 hour ago', status: 'completed' },
                { count: 10, style: 'casual wear', time: '2 hours ago', status: 'completed' },
              ].map((gen, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="text-sm text-gray-900">
                      {gen.count} {gen.style}
                    </p>
                    <p className="text-xs text-gray-500">{gen.time}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#10b981] bg-[#10b981]/10 px-2 py-1 rounded">
                      {gen.status}
                    </span>
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

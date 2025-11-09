import React, { useState } from 'react';
import { Sparkles, Loader, Image } from 'lucide-react';
import { testAPI } from '../services/testAPI';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';

const TestGeneration: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e && 'preventDefault' in e) {
      e.preventDefault();
    }

    if (!prompt.trim()) {
      setError('Please describe your design before generating.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      console.log('🎨 Starting image generation with prompt:', prompt);
      
      const result = await testAPI.generateImages(prompt, {
        count: 4,
        enforceBrandDNA: true,
        brandDNAStrength: 0.8,
        creativity: 0.3
      });

      console.log('✅ Generation result:', result);

      if (result.success && result.data?.generations) {
        const newImages = result.data.generations.map((gen: any, idx: number) => ({
          id: gen.id || `test-${Date.now()}-${idx}`,
          url: gen.url,
          prompt: prompt,
          timestamp: new Date(),
        }));

        setImages(prev => [...newImages, ...prev]);
        setSuccess(`Successfully generated ${newImages.length} images!`);
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000);
        
      } else {
        throw new Error(result.message || 'Generation failed');
      }

    } catch (err: any) {
      console.error('❌ Generation failed:', err);
      setError(err.message || 'Failed to generate images');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="max-w-7xl mx-auto px-6 py-10 space-y-10">
        <header className="space-y-3">
          <span className="text-sm uppercase tracking-[0.25em] text-gray-400">
            Test Generation Studio
          </span>
          <h1 className="text-4xl md:text-5xl font-light text-gray-900">Generate Designs</h1>
          <p className="text-gray-600 max-w-3xl">
            Test version of AI-powered fashion design generation. This bypasses complex authentication to focus on the core image generation functionality.
          </p>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Generation Form */}
          <div className="space-y-8">
            <Card>
              <CardHeader className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#6366f1]" />
                  <CardTitle>Test Prompt Builder</CardTitle>
                </div>
                <CardDescription>
                  Enter your design prompt and test the image generation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Describe your design
                  </label>
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., black blazer with strong architectural shoulders..."
                    rows={4}
                    disabled={loading}
                  />
                </div>

                <Button
                  onClick={(e) => handleGenerate(e)}
                  disabled={loading || !prompt.trim()}
                  className="w-full h-12 text-base font-medium bg-gray-900 hover:bg-gray-800 disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate designs
                    </>
                  )}
                </Button>

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50/70 p-4 text-sm text-red-600">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="rounded-lg border border-green-200 bg-green-50/70 p-4 text-sm text-green-600">
                    {success}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Results */}
          <div className="space-y-8">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Generated Designs</CardTitle>
                  <CardDescription>Test generation results</CardDescription>
                </div>
                {images.length > 0 && (
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => setImages([])}>
                    Clear all
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {images.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {images.map((image) => (
                      <div key={image.id} className="group">
                        <div className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-gray-100">
                          <img
                            src={image.url}
                            alt={image.prompt}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            onError={(e) => {
                              console.error('❌ Image failed to load:', image.url);
                              e.currentTarget.src = 'data:image/svg+xml,%3Csvg width="200" height="200" xmlns="http://www.w3.org/2000/svg"%3E%3Crect width="200" height="200" fill="%23f3f4f6"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="system-ui" font-size="14" fill="%236b7280"%3EImage failed%3C/text%3E%3C/svg%3E';
                            }}
                            onLoad={() => console.log('✅ Image loaded successfully:', image.url)}
                          />
                        </div>

                        <div className="space-y-1">
                          <p className="text-sm text-gray-600 line-clamp-2">{image.prompt}</p>
                          <p className="text-xs text-gray-400">
                            Generated at {new Date(image.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-gray-200 py-12 text-center">
                    <Image className="w-12 h-12 text-gray-400" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-gray-900">No designs generated yet</p>
                      <p className="text-sm text-gray-500">
                        Use the prompt builder to create your first test designs.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestGeneration;
</create_file>
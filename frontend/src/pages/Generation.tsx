import React, { useState } from 'react';
import { Sparkles, Loader } from 'lucide-react';
import { agentsAPI } from '../services/agentsAPI';
import CommandBar from '../components/CommandBar';

const Generation: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<any[]>([]);
  const [count, setCount] = useState(4);
  const [error, setError] = useState<string | null>(null);

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const designerId = currentUser.id || 'demo-user';

  const handleGenerate = async (commandOrEvent?: string | React.FormEvent) => {
    if (commandOrEvent && typeof commandOrEvent === 'object' && 'preventDefault' in commandOrEvent) {
      commandOrEvent.preventDefault();
    }

    const promptText = typeof commandOrEvent === 'string' ? commandOrEvent : prompt;
    if (!promptText.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const result = await agentsAPI.generateImage(designerId, promptText, {
        mode: 'specific',
        quantity: count
      });

      if (result.success && result.results?.results) {
        const newImages = result.results.results.map((img: any, idx: number) => ({
          id: `gen-${Date.now()}-${idx}`,
          url: img.image_url,
          prompt: promptText,
          timestamp: new Date()
        }));

        setImages(prev => [...newImages, ...prev]);

        // Save to localStorage for Home page
        const existing = JSON.parse(localStorage.getItem('generatedImages') || '[]');
        localStorage.setItem('generatedImages', JSON.stringify([...newImages, ...existing]));

        if (typeof commandOrEvent !== 'string') {
          setPrompt('');
        }
      }
    } catch (err: any) {
      console.error('Generation failed:', err);
      setError(err.message || 'Failed to generate images');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-5xl font-light text-gray-900 mb-2">Generate Designs</h1>
          <p className="text-gray-600">Create new fashion designs with AI</p>
        </div>

        {/* Generation Form */}
        <form onSubmit={handleGenerate} className="max-w-3xl mx-auto mb-16">
          <div className="space-y-6">
            <div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what you want to create..."
                rows={4}
                className="w-full px-6 py-4 text-lg border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 resize-none"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-2">
                Number of images: {count}
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value))}
                className="w-full"
                disabled={loading}
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>1</span>
                <span>5</span>
                <span>10</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="w-full px-8 py-4 bg-gray-900 text-white rounded-lg text-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate
                </>
              )}
            </button>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>
        </form>

        {/* Generated Images */}
        {images.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {images.map((image) => (
              <div key={image.id} className="group">
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-3">
                  <img
                    src={image.url}
                    alt={image.prompt}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <p className="text-sm text-gray-600 line-clamp-2">{image.prompt}</p>
              </div>
            ))}
          </div>
        )}

        {/* Voice Command Bar */}
        <CommandBar onCommandExecute={handleGenerate} />
      </div>
    </div>
  );
};

export default Generation;

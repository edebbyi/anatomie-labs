import React, { useState, useEffect, useCallback } from 'react';
import { 
  Sparkles, 
  Loader, 
  Brain, 
  Image as ImageIcon,
  Wand2,
  AlertCircle,
  User,
  Zap,
  Settings
} from 'lucide-react';
import { generationAPI, portfolioAPI, workflowAPI, systemAPI, StyleProfile } from '../services/agentsAPI';
import authAPI from '../services/authAPI';
import { normalizeGalleryImage, serializeGalleryImage } from '../utils/gallery';
import type { GalleryImage } from '../types/images';

interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  cost?: number;
  personalized: boolean;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

const AgentsGeneration: React.FC = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Style profile state
  const [hasProfile, setHasProfile] = useState(false);
  const [styleProfile, setStyleProfile] = useState<StyleProfile | null>(null);
  const [checkingProfile, setCheckingProfile] = useState(true);
  
  // Generation settings
  const [generationMode, setGenerationMode] = useState<'specific' | 'batch'>('specific');
  const [quantity, setQuantity] = useState(1);
  const [usePersonalization, setUsePersonalization] = useState(true);

  useEffect(() => {
    if (generationMode === 'batch' && quantity < 5) {
      setQuantity(5);
    } else if (generationMode === 'specific' && quantity > 10) {
      setQuantity(10);
    }
  }, [generationMode, quantity]);

  // Agents system status
  const [agentsAvailable, setAgentsAvailable] = useState(false);

  const persistAgentImages = useCallback((
    rawImages: any[],
    context: { mode: 'specific' | 'batch'; prompt: string; personalized: boolean }
  ) => {
    if (!Array.isArray(rawImages) || rawImages.length === 0) {
      return;
    }

    const currentUser = authAPI.getCurrentUser();
    const storageKey = currentUser?.id ? `generatedImages_${currentUser.id}` : 'generatedImages';

    let existing: GalleryImage[] = [];
    try {
      const existingRaw = localStorage.getItem(storageKey);
      if (existingRaw) {
        const parsed = JSON.parse(existingRaw);
        if (Array.isArray(parsed)) {
          existing = parsed
            .map((item: any) => normalizeGalleryImage(item))
            .filter((img): img is GalleryImage => Boolean(img));
        }
      }
    } catch (storageError) {
      console.warn('Failed to read stored gallery images for AI agents', storageError);
    }

    const existingIds = new Set(existing.map((image) => image.id));
    const normalized = rawImages
      .map((raw: any, index: number) => {
        const url = raw?.url || raw?.image_url;
        if (typeof url !== 'string' || url.trim().length === 0) {
          return null;
        }

        const metadataSource =
          (raw && typeof raw.metadata === 'object' && raw.metadata !== null
            ? (raw.metadata as Record<string, unknown>)
            : {}) as Record<string, unknown>;

        const metadata: Record<string, unknown> = {
          ...metadataSource,
          agentSource: 'ai_agents',
          personalized: context.personalized,
        };

        if (!metadata.generationMethod) {
          metadata.generationMethod = context.mode === 'batch' ? 'batch_generation' : 'generate_endpoint';
        }

        if (raw.generation_cost !== undefined) {
          metadata.agentGenerationCost = raw.generation_cost;
        }
        if (raw.processing_cost !== undefined) {
          metadata.agentProcessingCost = raw.processing_cost;
        }

        const promptText =
          (typeof raw.prompt === 'string' && raw.prompt.trim()) ||
          (typeof metadataSource['original_prompt'] === 'string' &&
            (metadataSource['original_prompt'] as string).trim()) ||
          context.prompt;

        const generatedAt =
          raw.created_at ||
          (typeof metadataSource['generated_at'] === 'string'
            ? (metadataSource['generated_at'] as string)
            : undefined);

        const normalizedImage = normalizeGalleryImage({
          id: raw.image_id || raw.id || raw.prompt_id || `agents-${Date.now()}-${index}`,
          url,
          prompt: promptText,
          timestamp: generatedAt ? new Date(generatedAt) : new Date(),
          metadata,
          tags: [
            context.mode === 'batch' ? 'batch generation' : 'specific generation',
            context.personalized ? 'personalized' : 'standard',
            'ai agents',
          ],
          origin: 'user',
          lastInteractedAt: new Date(),
        });

        if (!normalizedImage || existingIds.has(normalizedImage.id)) {
          return null;
        }

        return normalizedImage;
      })
      .filter((img): img is GalleryImage => Boolean(img));

    if (normalized.length === 0) {
      return;
    }

    const merged = [...normalized, ...existing];

    const serialized = JSON.stringify(merged.map((image) => serializeGalleryImage(image)));

    try {
      localStorage.setItem(storageKey, serialized);
      if (storageKey !== 'generatedImages') {
        localStorage.setItem('generatedImages', serialized);
      }
    } catch (storageError) {
      console.warn('Failed to persist AI agent images to gallery storage', storageError);
    }
  }, []);

  useEffect(() => {
    const currentUser = authAPI.getCurrentUser();
    if (currentUser) {
      setUserId(currentUser.id);
      checkAgentsAndProfile(currentUser.id);
    } else {
      setError('Please log in to use AI generation');
    }
  }, []);

  const checkAgentsAndProfile = async (userId: string) => {
    try {
      // Check agents availability
      const available = await systemAPI.isAvailable();
      setAgentsAvailable(available);

      if (!available) {
        setError('AI Agents system is not available. Please try again later.');
        setCheckingProfile(false);
        return;
      }

      // Check if user has a style profile
      const hasUserProfile = await portfolioAPI.hasProfile(userId);
      setHasProfile(hasUserProfile);

      if (hasUserProfile) {
        const profileData = await portfolioAPI.getProfile(userId);
        setStyleProfile(profileData.profile_data);
      }
      
      setCheckingProfile(false);
    } catch (error: any) {
      console.error('Error checking profile:', error);
      setCheckingProfile(false);
    }
  };

  const handleGenerate = async () => {
    if (!userId || !prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      if (!(usePersonalization && hasProfile)) {
        throw new Error('Basic generation not implemented in this demo');
      }

      const result = await generationAPI.smartGenerate(userId, prompt, {
        mode: generationMode,
        quantity
      });

      if (!result?.success) {
        throw new Error(result?.message || 'Generation failed');
      }

      const imagesPayload = Array.isArray(result?.data?.images)
        ? result.data.images
        : Array.isArray(result?.results?.results)
          ? result.results.results
          : [];

      const personalized = Boolean(usePersonalization && hasProfile);

      if (imagesPayload.length > 0) {
        const mappedImages: GeneratedImage[] = imagesPayload
          .map((img: any, index: number) => {
            const url = img?.url || img?.image_url;
            if (typeof url !== 'string' || url.trim().length === 0) {
              return null;
            }

            const cost =
              typeof img?.generation_cost === 'number'
                ? img.generation_cost + (typeof img?.processing_cost === 'number' ? img.processing_cost : 0)
                : typeof img?.cost === 'number'
                  ? img.cost
                  : undefined;

            const promptText =
              (typeof img?.prompt === 'string' && img.prompt.trim()) ||
              (typeof img?.metadata?.original_prompt === 'string' &&
                img.metadata.original_prompt.trim()) ||
              prompt;

            return {
              id: img?.id || img?.image_id || img?.prompt_id || `agents-${Date.now()}-${index}`,
              url,
              prompt: promptText,
              cost,
              personalized,
              createdAt: img?.created_at || img?.metadata?.generated_at,
              metadata:
                img?.metadata && typeof img.metadata === 'object' ? img.metadata : undefined,
            };
          })
          .filter((img): img is GeneratedImage => Boolean(img));

        if (mappedImages.length > 0) {
          setGeneratedImages((prev) => [...mappedImages, ...prev]);
          persistAgentImages(imagesPayload, {
            mode: generationMode,
            prompt,
            personalized,
          });
          const quantityLabel = mappedImages.length === 1 ? 'image' : 'images';
          setSuccess(
            `Generated ${mappedImages.length} ${generationMode === 'batch' ? 'batch ' : ''}${quantityLabel} with AI agents.`
          );
        } else {
          setSuccess(result.message || 'Generation complete, but no images were returned.');
        }
      } else if (generationMode === 'batch' && result?.data?.status) {
        setSuccess(result.message || 'Batch generation started. Images will appear shortly.');
      } else {
        setSuccess(result.message || 'Generation complete, but no images were returned.');
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const promptSuggestions = [
    'elegant evening dress with flowing silhouette',
    'casual streetwear outfit with modern aesthetic',
    'professional business attire with contemporary style',
    'bohemian summer dress with natural fabrics',
    'minimalist coat with architectural details',
    'avant-garde fashion piece with experimental design'
  ];

  if (checkingProfile) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-4" />
          <p className="text-gray-600">Checking AI system and style profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="w-8 h-8 text-purple-600" />
          <h1 className="text-3xl font-bold">AI Agents Generation</h1>
        </div>
        <p className="text-gray-600">
          Generate personalized fashion images using your unique style profile
        </p>
      </div>

      {/* System Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className={`p-4 rounded-lg border-2 ${
          agentsAvailable 
            ? 'border-green-200 bg-green-50' 
            : 'border-red-200 bg-red-50'
        }`}>
          <div className="flex items-center gap-2">
            <Zap className={`w-5 h-5 ${agentsAvailable ? 'text-green-600' : 'text-red-600'}`} />
            <span className="font-medium">AI Agents</span>
          </div>
          <p className={`text-sm ${agentsAvailable ? 'text-green-600' : 'text-red-600'}`}>
            {agentsAvailable ? 'Online' : 'Offline'}
          </p>
        </div>

        <div className={`p-4 rounded-lg border-2 ${
          hasProfile 
            ? 'border-green-200 bg-green-50' 
            : 'border-yellow-200 bg-yellow-50'
        }`}>
          <div className="flex items-center gap-2">
            <User className={`w-5 h-5 ${hasProfile ? 'text-green-600' : 'text-yellow-600'}`} />
            <span className="font-medium">Style Profile</span>
          </div>
          <p className={`text-sm ${hasProfile ? 'text-green-600' : 'text-yellow-600'}`}>
            {hasProfile ? 'Ready' : 'Not Found'}
          </p>
        </div>

        <div className={`p-4 rounded-lg border-2 ${
          hasProfile && agentsAvailable
            ? 'border-green-200 bg-green-50' 
            : 'border-gray-200 bg-gray-50'
        }`}>
          <div className="flex items-center gap-2">
            <Wand2 className={`w-5 h-5 ${
              hasProfile && agentsAvailable ? 'text-green-600' : 'text-gray-600'
            }`} />
            <span className="font-medium">Personalization</span>
          </div>
          <p className={`text-sm ${
            hasProfile && agentsAvailable ? 'text-green-600' : 'text-gray-600'
          }`}>
            {hasProfile && agentsAvailable ? 'Available' : 'Unavailable'}
          </p>
        </div>
      </div>

      {/* Style Profile Info */}
      {hasProfile && styleProfile && (
        <div className="bg-purple-50 rounded-lg p-6 mb-8">
          <h3 className="font-bold text-lg mb-4">Your Style Profile</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="font-medium text-sm">Primary Style</p>
              <p className="text-purple-600">{styleProfile.aesthetic_profile.primary_style}</p>
            </div>
            <div>
              <p className="font-medium text-sm">Confidence</p>
              <p className="text-purple-600">{Math.round(styleProfile.confidence_score * 100)}%</p>
            </div>
            <div>
              <p className="font-medium text-sm">Version</p>
              <p className="text-purple-600">v{styleProfile.version}</p>
            </div>
            <div>
              <p className="font-medium text-sm">Images Analyzed</p>
              <p className="text-purple-600">{styleProfile.images_analyzed}</p>
            </div>
          </div>
        </div>
      )}

      {/* No Profile Warning */}
      {!hasProfile && agentsAvailable && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="font-bold text-yellow-800">Style Profile Required</h3>
              <p className="text-yellow-700 mb-3">
                To use personalized AI generation, you need to analyze your portfolio first.
              </p>
              <button className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors">
                Analyze Portfolio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Success Display */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {/* Generation Form */}
      <div className="bg-white rounded-lg border shadow-sm p-6 mb-8">
        <h2 className="text-xl font-bold mb-6">Generate Images</h2>
        
        {/* Settings Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block font-medium mb-2">Mode</label>
            <select
              value={generationMode}
              onChange={(e) => setGenerationMode(e.target.value as 'specific' | 'batch')}
              className="w-full p-2 border rounded-lg"
            >
              <option value="specific">Specific (1-10 images)</option>
              <option value="batch">Batch (5-100 images)</option>
            </select>
          </div>
          
          <div>
            <label className="block font-medium mb-2">Quantity</label>
            <input
              type="number"
              min={generationMode === 'specific' ? 1 : 5}
              max={generationMode === 'specific' ? 10 : 100}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value))}
              className="w-full p-2 border rounded-lg"
            />
          </div>
          
          <div>
            <label className="block font-medium mb-2">Personalization</label>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="personalization"
                checked={usePersonalization}
                onChange={(e) => setUsePersonalization(e.target.checked)}
                disabled={!hasProfile}
                className="w-4 h-4 text-purple-600"
              />
              <label htmlFor="personalization" className="text-sm">
                Use AI style profile {!hasProfile ? '(not available)' : ''}
              </label>
            </div>
          </div>
        </div>

        {/* Prompt Input */}
        <div className="mb-4">
          <label className="block font-medium mb-2">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the fashion item you want to generate..."
            className="w-full p-3 border rounded-lg h-20 resize-none"
          />
        </div>

        {/* Prompt Suggestions */}
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-2">Suggestions:</p>
          <div className="flex flex-wrap gap-2">
            {promptSuggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => setPrompt(suggestion)}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim() || !agentsAvailable}
          className={`w-full px-6 py-3 rounded-lg font-medium transition-colors ${
            isGenerating || !prompt.trim() || !agentsAvailable
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-purple-600 text-white hover:bg-purple-700'
          }`}
        >
          {isGenerating ? (
            <div className="flex items-center justify-center gap-2">
              <Loader className="w-5 h-5 animate-spin" />
              Generating...
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5" />
              Generate {hasProfile && usePersonalization ? 'Personalized ' : ''}Images
            </div>
          )}
        </button>
      </div>

      {/* Generated Images Grid */}
      {generatedImages.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-6">Generated Images ({generatedImages.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {generatedImages.map((image) => (
              <div key={image.id} className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <img
                  src={image.url}
                  alt={image.prompt}
                  className="w-full h-64 object-cover"
                />
                <div className="p-4">
                  <p className="text-sm text-gray-600 mb-2">{image.prompt}</p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>
                      {typeof image.cost === 'number'
                        ? `$${image.cost.toFixed(3)}`
                        : 'AI Agents'}
                    </span>
                    {image.personalized && (
                      <span className="bg-purple-100 text-purple-600 px-2 py-1 rounded-full">
                        Personalized
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentsGeneration;

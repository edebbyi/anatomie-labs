import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Loader,
  Image,
  Sliders,
  Palette,
  Pause,
  RotateCcw,
  Save,
  Eye,
  Zap,
  Package,
} from 'lucide-react';
import { agentsAPI } from '../services/agentsAPI';
import CommandBar from '../components/CommandBar';
import authAPI from '../services/authAPI';
import { API_URL } from '../config/env';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Slider } from '../components/ui/slider';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../components/ui/collapsible';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';

const Generation: React.FC = () => {
  // Core state
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Enhanced prompt builder state
  const [enhancedPrompt, setEnhancedPrompt] = useState('');
  const [validationResults, setValidationResults] = useState<any>(null);
  const [styleProfile, setStyleProfile] = useState<any>(null);
  
  // Brand DNA state
  const [enforceBrandDNA, setEnforceBrandDNA] = useState(true);
  const [brandDNAStrength, setBrandDNAStrength] = useState(0.8);
  
  // Visual controls state
  const [styleControls, setStyleControls] = useState({
    femininity: 85,
    structure: 78,
    luxury: 90,
    tech: 45,
    mood: 70
  });
  
  // Generation modes
  const [generationMode, setGenerationMode] = useState<'single' | 'collection' | 'campaign' | 'exploration'>('single');
  
  // Composition and lighting presets
  const [compositionPreset, setCompositionPreset] = useState('full_body_studio');
  const [lightingPreset, setLightingPreset] = useState('mario_testino_glamour');
  const [modelType, setModelType] = useState('front_facing');
  
  // Batch generation state
  const [batchConfig, setBatchConfig] = useState({
    size: 10,
    strategy: 'consistent',
    varyParams: ['pose', 'lighting', 'composition'],
    processingMode: 'realtime'
  });
  
  // UI state
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({
    current: 0,
    total: 0,
    status: 'idle'
  });

  const quickBatches = [
    {
      id: 'quick',
      icon: Zap,
      title: 'Quick Test',
      description: 'Perfect for fast iterations',
      count: 10,
      time: '~1 min',
    },
    {
      id: 'standard',
      icon: Package,
      title: 'Standard Batch',
      description: 'Balanced variety and speed',
      count: 25,
      time: '~3 min',
    },
    {
      id: 'explore',
      icon: Palette,
      title: 'Creative Exploration',
      description: 'Maximum variation for new ideas',
      count: 50,
      time: '~6 min',
    },
  ] as const;

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const designerId = currentUser.id || 'demo-user';

  // Load user's style profile on component mount
  useEffect(() => {
    const loadStyleProfile = async () => {
      try {
        const profileResult = await agentsAPI.getStyleProfile(designerId);
        if (profileResult.success) {
          setStyleProfile(profileResult.profile_data);
        }
      } catch (err) {
        console.warn('Could not load style profile:', err);
      }
    };
    
    loadStyleProfile();
  }, [designerId]);

  // Handle prompt enhancement in real-time
  useEffect(() => {
    if (prompt.trim()) {
      // In a real implementation, this would call an API to enhance the prompt
      // For now, we'll simulate enhancement
      const simulateEnhancement = () => {
        // Simple enhancement simulation
        let enhanced = prompt;
        if (styleProfile) {
          // Add some style profile elements
          if (styleProfile.signature_elements?.colors?.[0]) {
            enhanced += `, in ${styleProfile.signature_elements.colors[0]} tones`;
          }
          if (styleProfile.aesthetic_profile?.primary_style) {
            enhanced += `, ${styleProfile.aesthetic_profile.primary_style} aesthetic`;
          }
        }
        setEnhancedPrompt(enhanced);
        
        // Simple validation simulation
        const clarityScore = Math.min(100, prompt.length * 2);
        const brandAlignment = styleProfile ? 85 : 50;
        setValidationResults({
          clarityScore,
          brandAlignment,
          warnings: clarityScore < 70 ? ['Consider adding more descriptive details'] : [],
          estimatedQuality: clarityScore > 80 ? 'High' : clarityScore > 60 ? 'Medium' : 'Low'
        });
      };
      
      const timer = setTimeout(simulateEnhancement, 300);
      return () => clearTimeout(timer);
    } else {
      setEnhancedPrompt('');
      setValidationResults(null);
    }
  }, [prompt, styleProfile]);

  const handleGenerate = async (
    commandOrEvent?: string | React.FormEvent,
    options?: { countOverride?: number; source?: 'voice' | 'text' }
  ) => {
    if (commandOrEvent && typeof commandOrEvent === 'object' && 'preventDefault' in commandOrEvent) {
      commandOrEvent.preventDefault();
    }

    const promptText = typeof commandOrEvent === 'string' ? commandOrEvent : prompt;
    if (!promptText.trim()) {
      setError('Please describe your design before generating.');
      return;
    }

    setLoading(true);
    setError(null);
    setIsGenerating(true);

    try {
      // Use new brand DNA endpoint
      const token = authAPI.getToken();
      if (!token) {
        throw new Error('Authentication is required to generate images.');
      }
      const apiUrl = API_URL;
      
      const response = await fetch(`${apiUrl}/podna/generate-with-dna`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: promptText,
          enforceBrandDNA,
          brandDNAStrength,
          creativity: generationMode === 'exploration' ? 0.7 : 
                     generationMode === 'single' ? 0.3 : 0.5,
          count: options?.countOverride ??
                 (generationMode === 'collection' ? 8 : 
                  generationMode === 'campaign' ? 6 : 
                  batchConfig.size)
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Generation failed');
      }

      const result = await response.json();

      if (result.success && result.data?.generations) {
        const newImages = result.data.generations.map((gen: any, idx: number) => ({
          id: gen.id || `gen-${Date.now()}-${idx}`,
          url: gen.url,
          prompt: promptText,
          timestamp: new Date(),
          brandConsistencyScore: gen.brand_consistency_score || 0.5,
          brandDNAApplied: gen.brand_dna_applied || false
        }));

        setImages(prev => [...newImages, ...prev]);

        // Save to localStorage
        const existing = JSON.parse(localStorage.getItem('generatedImages') || '[]');
        localStorage.setItem('generatedImages', JSON.stringify([...newImages, ...existing]));

        if (typeof commandOrEvent !== 'string') {
          setPrompt('');
        }
        
        // Show average brand consistency
        if (result.data.avgBrandConsistency) {
          console.log('Average brand consistency:', Math.round(result.data.avgBrandConsistency * 100) + '%');
        }
      }
    } catch (err: any) {
      console.error('Generation failed:', err);
      setError(err.message || 'Failed to generate images');
    } finally {
      setLoading(false);
      setIsGenerating(false);
      setBatchProgress({
        current: 0,
        total: 0,
        status: 'idle'
      });
    }
  };

  const handleQuickBatch = async (countOverride: number) => {
    if (!prompt.trim()) {
      setError('Please describe your design before generating.');
      return;
    }

    await handleGenerate(prompt, { countOverride });
  };

  // Handle style control changes
  const handleStyleControlChange = (control: string, value: number) => {
    setStyleControls(prev => ({
      ...prev,
      [control]: value
    }));
  };

  // Handle batch configuration changes
  const handleBatchConfigChange = (field: string, value: any) => {
    setBatchConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Toggle vary parameters
  const toggleVaryParam = (param: string) => {
    setBatchConfig(prev => {
      const newVaryParams = prev.varyParams.includes(param)
        ? prev.varyParams.filter(p => p !== param)
        : [...prev.varyParams, param];
      
      return {
        ...prev,
        varyParams: newVaryParams
      };
    });
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="max-w-7xl mx-auto px-6 py-10 space-y-10">
        <header className="space-y-3">
          <span className="text-sm uppercase tracking-[0.25em] text-gray-400">
            Podna Generation Studio
          </span>
          <h1 className="text-4xl md:text-5xl font-light text-gray-900">Generate Designs</h1>
          <p className="text-gray-600 max-w-3xl">
            Precision control center for AI-powered fashion design. Balance creativity with brand
            alignment and ship new looks faster.
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {quickBatches.map((batch) => {
            const Icon = batch.icon;
            return (
              <Card
                key={batch.id}
                className="h-full bg-white border border-gray-200 hover:border-gray-300 transition-colors"
              >
                <CardHeader className="space-y-3">
                  <div className="w-12 h-12 rounded-full bg-[#6366f1]/10 flex items-center justify-center text-[#6366f1]">
                    <Icon className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-lg text-gray-900">{batch.title}</CardTitle>
                  <CardDescription>{batch.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{batch.count} images</span>
                    <span>{batch.time}</span>
                  </div>
                  <Button
                    type="button"
                    onClick={() => handleQuickBatch(batch.count)}
                    disabled={loading || !prompt.trim()}
                    className="w-full bg-[#6366f1] text-white hover:bg-[#4f46e5] disabled:opacity-60"
                  >
                    {loading ? 'Generating...' : 'Generate'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Left Panel - Controls */}
          <div className="xl:col-span-2 space-y-8">
            {/* Prompt Builder */}
            <Card>
              <CardHeader className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#6366f1]" />
                  <CardTitle>Intelligent Prompt Builder</CardTitle>
                </div>
                <CardDescription>
                  Describe your design vision and guide the AI with contextual controls.
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

                {enhancedPrompt && (
                  <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-medium text-gray-700">Enhanced Interpretation</span>
                      {validationResults?.estimatedQuality && (
                        <Badge variant="outline" className="text-xs font-normal">
                          {validationResults.estimatedQuality}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">{enhancedPrompt}</p>
                    {validationResults && (
                      <div className="space-y-2 border-t border-gray-200 pt-3 text-xs text-gray-500">
                        <div className="flex items-center justify-between">
                          <span>Clarity: {validationResults.clarityScore}%</span>
                          <span>Brand alignment: {validationResults.brandAlignment}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-[#6366f1] h-1.5 rounded-full"
                            style={{ width: `${validationResults.clarityScore}%` }}
                          />
                        </div>
                        {validationResults.warnings?.length > 0 && (
                          <ul className="list-disc list-inside text-amber-600">
                            {validationResults.warnings.map((warning: string) => (
                              <li key={warning}>{warning}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <Collapsible open={showAdvancedControls} onOpenChange={setShowAdvancedControls}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <span className="flex items-center gap-2">
                        <Sliders className="w-4 h-4" />
                        Advanced AI Controls
                      </span>
                      <span className="text-xs text-gray-500">
                        {showAdvancedControls ? 'Hide' : 'Optional'}
                      </span>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4 space-y-6">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Enforce Brand DNA</p>
                        <p className="text-xs text-gray-500">
                          Keep generations aligned with your signature codes.
                        </p>
                      </div>
                      <Switch
                        checked={enforceBrandDNA}
                        onCheckedChange={(checked) => setEnforceBrandDNA(checked)}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-medium text-gray-700">Brand DNA strength</span>
                        <span className="text-gray-500">{Math.round(brandDNAStrength * 100)}%</span>
                      </div>
                      <Slider
                        value={[brandDNAStrength]}
                        min={0.5}
                        max={1}
                        step={0.05}
                        onValueChange={(value) =>
                          setBrandDNAStrength(value[0] ?? brandDNAStrength)
                        }
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-2">
                        <span>Balanced</span>
                        <span>Strong</span>
                        <span>Max</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-medium text-gray-700">Prefer creativity</span>
                        <span className="text-gray-500">
                          {generationMode === 'exploration'
                            ? 'Exploration'
                            : generationMode === 'campaign'
                              ? 'Campaign'
                              : generationMode === 'collection'
                                ? 'Collection'
                                : 'Focused'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Creativity adjusts automatically when you change the generation mode below.
                      </p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
            
            {styleProfile && (
              <Card>
                <CardHeader className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Palette className="w-5 h-5 text-[#6366f1]" />
                      <CardTitle>Your Brand DNA</CardTitle>
                    </div>
                    <Badge variant={enforceBrandDNA ? 'default' : 'outline'} className="text-xs font-medium">
                      {enforceBrandDNA ? 'Aligned' : 'Exploratory'}
                    </Badge>
                  </div>
                  <CardDescription>
                    Signals detected from your portfolio help the system stay true to your brand.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Enforce Brand DNA</p>
                      <p className="text-xs text-gray-500">
                        {enforceBrandDNA
                          ? 'Active — AI prioritises your signature codes.'
                          : 'Inactive — output will be more exploratory.'}
                      </p>
                    </div>
                    <Switch
                      checked={enforceBrandDNA}
                      onCheckedChange={(checked) => setEnforceBrandDNA(checked)}
                    />
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-xs uppercase tracking-wide text-gray-500">Core aesthetic</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1.5 rounded-full bg-gray-900 text-xs font-medium uppercase tracking-wide text-white">
                        {styleProfile.brandDNA?.primaryAesthetic || 'Contemporary'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {Math.round((styleProfile.brandDNA?.confidence?.aesthetic || 0.5) * 100)}% confidence
                      </span>
                    </div>
                    {styleProfile.brandDNA?.secondaryAesthetics?.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {styleProfile.brandDNA.secondaryAesthetics.map((aesthetic: string, idx: number) => (
                          <span key={idx} className="px-2 py-1 rounded-full bg-gray-100 text-xs text-gray-600 capitalize">
                            {aesthetic}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {styleProfile.brandDNA?.signatureColors?.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs uppercase tracking-wide text-gray-500">Signature colors</h3>
                      <div className="flex flex-wrap gap-3">
                        {styleProfile.brandDNA.signatureColors.slice(0, 5).map((color: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span
                              className="h-6 w-6 rounded-full border border-gray-200"
                              style={{ backgroundColor: color.hex }}
                            />
                            <span className="text-xs text-gray-600 capitalize">
                              {color.name} · {Math.round(color.weight * 100)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {styleProfile.brandDNA?.signatureFabrics?.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs uppercase tracking-wide text-gray-500">Signature fabrics</h3>
                      <div className="flex flex-wrap gap-2">
                        {styleProfile.brandDNA.signatureFabrics.slice(0, 4).map((fabric: any, idx: number) => (
                          <span
                            key={idx}
                            className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 capitalize"
                          >
                            {fabric.name} · {Math.round(fabric.weight * 100)}%
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {styleProfile.brandDNA?.signatureConstruction?.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs uppercase tracking-wide text-gray-500">Signature details</h3>
                      <ul className="space-y-1 text-sm text-gray-600">
                        {styleProfile.brandDNA.signatureConstruction.slice(0, 3).map((detail: any, idx: number) => (
                          <li key={idx} className="flex items-center justify-between">
                            <span className="capitalize">{detail.detail}</span>
                            <span className="text-xs text-gray-400">
                              {Math.round(detail.frequency * 100)}%
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="space-y-1">
                <CardTitle>Style Dimensions</CardTitle>
                <CardDescription>Fine-tune the balance of your aesthetic pillars.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(styleControls).map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span className="capitalize">{key}</span>
                      <span>{value}</span>
                    </div>
                    <Slider
                      value={[value]}
                      min={0}
                      max={100}
                      step={1}
                      onValueChange={(val) => handleStyleControlChange(key, val[0] ?? value)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="space-y-1">
                <CardTitle>Visual Direction</CardTitle>
                <CardDescription>Choose the composition, lighting, and model focus for this batch.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-700">Composition</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      'Full body studio',
                      '3/4 length editorial',
                      'Detail/close-up',
                      'Flat lay',
                      'Lifestyle',
                      'Back view'
                    ].map((preset) => {
                      const value = preset.toLowerCase().replace(/\s+/g, '_');
                      const active = compositionPreset === value;
                      return (
                        <Button
                          key={preset}
                          type="button"
                          variant={active ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCompositionPreset(value)}
                          className={(active ? 'bg-gray-900 hover:bg-gray-800 text-white ' : 'bg-white text-gray-700 ') + 'transition-colors'}
                        >
                          {preset}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-700">Lighting</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      'Mario Testino',
                      'Natural window',
                      'Studio high-key',
                      'Dramatic single',
                      'Soft editorial',
                      'Golden hour'
                    ].map((preset) => {
                      const value = preset.toLowerCase().replace(/\s+/g, '_');
                      const active = lightingPreset === value;
                      return (
                        <Button
                          key={preset}
                          type="button"
                          variant={active ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setLightingPreset(value)}
                          className={(active ? 'bg-gray-900 hover:bg-gray-800 text-white ' : 'bg-white text-gray-700 ') + 'transition-colors'}
                        >
                          {preset}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-700">Model focus</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      'Front-facing',
                      'Back view',
                      'Profile',
                      'Multiple angles',
                      'Flat lay',
                      'Detail shots'
                    ].map((type) => {
                      const value = type.toLowerCase().replace(/\s+/g, '_');
                      const active = modelType === value;
                      return (
                        <Button
                          key={type}
                          type="button"
                          variant={active ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setModelType(value)}
                          className={(active ? 'bg-gray-900 hover:bg-gray-800 text-white ' : 'bg-white text-gray-700 ') + 'transition-colors'}
                        >
                          {type}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="space-y-1">
                <CardTitle>Generation Strategy</CardTitle>
                <CardDescription>Control quantity, diversity, and variation for this batch.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-700">Generation mode</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {([
                      { id: 'single', label: 'Focused look', desc: 'Up to 12 aligned images' },
                      { id: 'collection', label: 'Collection', desc: 'Coordinated set of 8' },
                      { id: 'campaign', label: 'Campaign', desc: 'Hero + supporting shots' },
                      { id: 'exploration', label: 'Exploration', desc: 'Wide creative variations' }
                    ] as const).map((mode) => {
                      const active = generationMode === mode.id;
                      return (
                        <Button
                          key={mode.id}
                          type="button"
                          variant={active ? 'default' : 'outline'}
                          className={(active ? 'bg-gray-900 hover:bg-gray-800 text-white ' : 'bg-white text-gray-700 ') + 'justify-start transition-colors'}
                          onClick={() => setGenerationMode(mode.id)}
                        >
                          <div className="flex flex-col items-start">
                            <span className="text-sm font-medium">{mode.label}</span>
                            <span className="text-xs text-gray-500">{mode.desc}</span>
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <h3 className="font-medium text-gray-700">Batch size</h3>
                    <span>{batchConfig.size} images</span>
                  </div>
                  <Slider
                    value={[batchConfig.size]}
                    min={10}
                    max={120}
                    step={5}
                    onValueChange={(value) =>
                      handleBatchConfigChange('size', value[0] ?? batchConfig.size)
                    }
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>10</span>
                    <span>60</span>
                    <span>120</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-700">Variation strategy</h3>
                  <div className="flex flex-wrap gap-2">
                    {['consistent', 'diverse', 'structured'].map((strategy) => {
                      const active = batchConfig.strategy === strategy;
                      return (
                        <Button
                          key={strategy}
                          type="button"
                          variant={active ? 'default' : 'outline'}
                          size="sm"
                          className={(active ? 'bg-gray-900 hover:bg-gray-800 text-white ' : 'bg-white text-gray-700 ') + 'transition-colors'}
                          onClick={() => handleBatchConfigChange('strategy', strategy)}
                        >
                          {strategy.charAt(0).toUpperCase() + strategy.slice(1)}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-700">Vary parameters</h3>
                  <div className="flex flex-wrap gap-2">
                    {['pose', 'lighting', 'composition', 'color', 'styling', 'background'].map((param) => {
                      const active = batchConfig.varyParams.includes(param);
                      return (
                        <Button
                          key={param}
                          type="button"
                          variant={active ? 'default' : 'outline'}
                          size="sm"
                          className={(active ? 'bg-gray-900 hover:bg-gray-800 text-white ' : 'bg-white text-gray-700 ') + 'transition-colors'}
                          onClick={() => toggleVaryParam(param)}
                        >
                          {param}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={(event) => handleGenerate(event)}
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
          </div>

          {/* Right Panel - Preview and Results */}
          <div className="xl:col-span-2 space-y-8">
            {isGenerating && batchProgress.status === 'processing' && (
              <Card>
                <CardHeader className="flex items-center justify-between">
                  <div>
                    <CardTitle>Batch Generation Progress</CardTitle>
                    <CardDescription>We’re building your looks in real time.</CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {batchProgress.total ? Math.round((batchProgress.current / batchProgress.total) * 100) : 0}%
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>
                      Processing {batchProgress.current} of {batchProgress.total} images
                    </span>
                    <span>
                      {batchProgress.total ? Math.round((batchProgress.current / batchProgress.total) * 100) : 0}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full bg-gray-900 transition-all"
                      style={{ width: `${batchProgress.total ? (batchProgress.current / batchProgress.total) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-1 text-gray-700">
                      <Pause className="w-4 h-4" />
                      Pause
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1 text-gray-700">
                      <RotateCcw className="w-4 h-4" />
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Generated Designs</CardTitle>
                  <CardDescription>Your most recent AI creations</CardDescription>
                </div>
                {images.length > 0 && (
                  <Button variant="outline" size="sm" className="gap-2">
                    <Save className="w-4 h-4" />
                    Export all
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {images.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {images.map((image) => (
                      <div key={image.id} className="group">
                        <div className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-gray-100">
                          <img
                            src={image.url}
                            alt={image.prompt}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />

                          {image.brandDNAApplied && image.brandConsistencyScore !== undefined && (
                            <div className="absolute right-2 top-2">
                              <Badge className="backdrop-blur-sm">
                                {Math.round(image.brandConsistencyScore * 100)}% match
                              </Badge>
                            </div>
                          )}

                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/50 group-hover:opacity-100">
                            <div className="flex gap-2">
                              <Button variant="outline" size="icon" className="rounded-full bg-white/90 text-gray-900 border-none shadow-sm">
                                <Save className="w-4 h-4" />
                              </Button>
                              <Button variant="outline" size="icon" className="rounded-full bg-white/90 text-gray-900 border-none shadow-sm">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <p className="text-sm text-gray-600 line-clamp-2">{image.prompt}</p>
                          {image.brandConsistencyScore !== undefined && (
                            <p className="text-xs text-gray-400">
                              Brand consistency · {Math.round(image.brandConsistencyScore * 100)}%
                            </p>
                          )}
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
                        Use the prompt builder or quick batches to create your first collection.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
        
        {/* Voice Command Bar */}
        <div className="mt-12">
          <CommandBar onCommandExecute={handleGenerate} />
        </div>
      </div>
    </div>
  );
};

export default Generation;

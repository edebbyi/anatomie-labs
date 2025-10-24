import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Loader, 
  Image, 
  Sliders, 
  Palette, 
  Camera, 
  Sun, 
  User, 
  Play, 
  Pause, 
  RotateCcw,
  Save,
  Eye,
  EyeOff
} from 'lucide-react';
import { agentsAPI } from '../services/agentsAPI';
import CommandBar from '../components/CommandBar';

const Generation: React.FC = () => {
  // Core state
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<any[]>([]);
  const [count, setCount] = useState(4);
  const [error, setError] = useState<string | null>(null);
  
  // Enhanced prompt builder state
  const [enhancedPrompt, setEnhancedPrompt] = useState('');
  const [validationResults, setValidationResults] = useState<any>(null);
  const [styleProfile, setStyleProfile] = useState<any>(null);
  
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
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({
    current: 0,
    total: 0,
    status: 'idle'
  });

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

  const handleGenerate = async (commandOrEvent?: string | React.FormEvent) => {
    if (commandOrEvent && typeof commandOrEvent === 'object' && 'preventDefault' in commandOrEvent) {
      commandOrEvent.preventDefault();
    }

    const promptText = typeof commandOrEvent === 'string' ? commandOrEvent : prompt;
    if (!promptText.trim()) return;

    setLoading(true);
    setError(null);
    setIsGenerating(true);

    try {
      // For batch generation, we would use different logic
      if (generationMode === 'collection' || generationMode === 'campaign' || batchConfig.size > 10) {
        // Simulate batch generation
        setBatchProgress({
          current: 0,
          total: batchConfig.size,
          status: 'processing'
        });
        
        // Simulate progress updates
        const interval = setInterval(() => {
          setBatchProgress(prev => {
            const newCurrent = Math.min(prev.current + 1, prev.total);
            if (newCurrent >= prev.total) {
              clearInterval(interval);
              return { ...prev, status: 'completed', current: prev.total };
            }
            return { ...prev, current: newCurrent };
          });
        }, 500);
      }

      const result = await agentsAPI.generateImage(designerId, promptText, {
        mode: generationMode === 'exploration' ? 'batch' : 'specific',
        quantity: generationMode === 'collection' ? 8 : 
                  generationMode === 'campaign' ? 6 : 
                  batchConfig.size
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
      setIsGenerating(false);
      setBatchProgress({
        current: 0,
        total: 0,
        status: 'idle'
      });
    }
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
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-5xl font-light text-gray-900 mb-2">Generate Designs</h1>
          <p className="text-gray-600">Precision control center for AI-powered fashion design</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Controls */}
          <div className="lg:col-span-1 space-y-6">
            {/* Prompt Builder */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Intelligent Prompt Builder
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Describe your design
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., black blazer with strong architectural shoulders..."
                    rows={3}
                    className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
                    disabled={loading}
                  />
                </div>
                
                {/* Enhanced Prompt Preview */}
                {enhancedPrompt && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Enhanced Interpretation</h3>
                    <p className="text-sm text-gray-600">{enhancedPrompt}</p>
                    
                    {/* Validation Results */}
                    {validationResults && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex items-center justify-between text-xs">
                          <span>Clarity: {validationResults.clarityScore}%</span>
                          <span>Brand Alignment: {validationResults.brandAlignment}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                          <div 
                            className="bg-green-600 h-1.5 rounded-full" 
                            style={{ width: `${validationResults.clarityScore}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Style Profile Integration */}
            {styleProfile && (
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Palette className="w-5 h-5" />
                  Active Style Profile
                </h2>
                
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700">Your Brand DNA</h3>
                    <ul className="mt-2 space-y-1">
                      {styleProfile.signature_elements?.colors?.slice(0, 3).map((color: string, idx: number) => (
                        <li key={idx} className="text-sm text-gray-600">• {color}</li>
                      ))}
                      {styleProfile.aesthetic_profile?.primary_style && (
                        <li className="text-sm text-gray-600">• {styleProfile.aesthetic_profile.primary_style}</li>
                      )}
                    </ul>
                  </div>
                  
                  <button 
                    className="text-xs text-gray-500 hover:text-gray-700"
                    onClick={() => setStyleProfile(null)}
                  >
                    Disable for this session
                  </button>
                </div>
              </div>
            )}
            
            {/* Advanced Controls Toggle */}
            <button
              onClick={() => setShowAdvancedControls(!showAdvancedControls)}
              className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <span className="font-medium text-gray-900">Advanced Controls</span>
              <Sliders className={`w-5 h-5 text-gray-500 transition-transform ${showAdvancedControls ? 'rotate-90' : ''}`} />
            </button>
            
            {/* Advanced Controls Panel */}
            {showAdvancedControls && (
              <div className="space-y-6">
                {/* Style Dimension Sliders */}
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Style Dimensions</h3>
                  
                  <div className="space-y-5">
                    {Object.entries(styleControls).map(([key, value]) => (
                      <div key={key}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700 capitalize">{key}</span>
                          <span className="text-gray-500">{value}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={value}
                          onChange={(e) => handleStyleControlChange(key, parseInt(e.target.value))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Composition Presets */}
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Composition</h3>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      'Full body studio',
                      '3/4 length editorial',
                      'Detail/close-up',
                      'Flat lay',
                      'Lifestyle',
                      'Back view'
                    ].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setCompositionPreset(preset.toLowerCase().replace(/\s+/g, '_'))}
                        className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                          compositionPreset === preset.toLowerCase().replace(/\s+/g, '_')
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Lighting Presets */}
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Lighting</h3>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      'Mario Testino',
                      'Natural window',
                      'Studio high-key',
                      'Dramatic single',
                      'Soft editorial',
                      'Golden hour'
                    ].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setLightingPreset(preset.toLowerCase().replace(/\s+/g, '_'))}
                        className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                          lightingPreset === preset.toLowerCase().replace(/\s+/g, '_')
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Model Selection */}
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Model</h3>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      'Front-facing',
                      'Back view',
                      'Profile',
                      'Multiple angles',
                      'Flat lay',
                      'Detail shots'
                    ].map((type) => (
                      <button
                        key={type}
                        onClick={() => setModelType(type.toLowerCase().replace(/\s+/g, '_'))}
                        className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                          modelType === type.toLowerCase().replace(/\s+/g, '_')
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Generation Modes */}
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Generation Mode</h3>
                  
                  <div className="space-y-3">
                    {([
                      { id: 'single', label: 'Single', desc: '1-10 images' },
                      { id: 'collection', label: 'Collection', desc: 'Coordinating set (8 pieces)' },
                      { id: 'campaign', label: 'Campaign', desc: 'Hero + supporting shots' },
                      { id: 'exploration', label: 'Exploration', desc: 'Wide creative variations' }
                    ] as const).map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => setGenerationMode(mode.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          generationMode === mode.id
                            ? 'border-gray-900 bg-gray-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-medium text-gray-900">{mode.label}</div>
                        <div className="text-sm text-gray-500">{mode.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Batch Configuration */}
                {(generationMode === 'collection' || generationMode === 'campaign' || generationMode === 'exploration') && (
                  <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Batch Configuration</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Batch Size: {batchConfig.size}
                        </label>
                        <input
                          type="range"
                          min="10"
                          max="200"
                          value={batchConfig.size}
                          onChange={(e) => handleBatchConfigChange('size', parseInt(e.target.value))}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                          <span>10</span>
                          <span>100</span>
                          <span>200</span>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Variation Strategy
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {['consistent', 'diverse', 'structured'].map((strategy) => (
                            <button
                              key={strategy}
                              onClick={() => handleBatchConfigChange('strategy', strategy)}
                              className={`px-2 py-1 text-xs rounded transition-colors ${
                                batchConfig.strategy === strategy
                                  ? 'bg-gray-900 text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {strategy.charAt(0).toUpperCase() + strategy.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Vary Parameters
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {['pose', 'lighting', 'composition', 'color', 'styling', 'background'].map((param) => (
                            <button
                              key={param}
                              onClick={() => toggleVaryParam(param)}
                              className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
                                batchConfig.varyParams.includes(param)
                                  ? 'bg-gray-900 text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {batchConfig.varyParams.includes(param) ? (
                                <Eye className="w-3 h-3" />
                              ) : (
                                <EyeOff className="w-3 h-3" />
                              )}
                              {param}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              className="w-full px-6 py-4 bg-gray-900 text-white rounded-lg text-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
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
          
          {/* Right Panel - Preview and Results */}
          <div className="lg:col-span-2">
            {/* Batch Progress */}
            {isGenerating && batchProgress.status === 'processing' && (
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Batch Generation Progress</h2>
                
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span>Processing: {batchProgress.current} / {batchProgress.total} images</span>
                    <span>{Math.round((batchProgress.current / batchProgress.total) * 100)}%</span>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-gray-900 h-2.5 rounded-full transition-all duration-300" 
                      style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                    ></div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 flex items-center gap-1">
                      <Pause className="w-4 h-4" />
                      Pause
                    </button>
                    <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 flex items-center gap-1">
                      <RotateCcw className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Generated Images */}
            {images.length > 0 ? (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Generated Designs</h2>
                  <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 flex items-center gap-1">
                    <Save className="w-4 h-4" />
                    Export All
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
              </div>
            ) : (
              <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg p-12 text-center">
                <Image className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No designs generated yet</h3>
                <p className="text-gray-500">Create your first design using the prompt builder</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Voice Command Bar */}
        <div className="mt-12">
          <CommandBar onCommandExecute={handleGenerate} />
        </div>
      </div>
    </div>
  );
};

export default Generation;
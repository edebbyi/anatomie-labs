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
  EyeOff,
  Zap,
  Star,
  TrendingUp,
  X
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
  
  // Image modal state
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
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
      // Use enhanced /generate endpoint with interpretation
      const token = localStorage.getItem('authToken');
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
      
      if (!token) {
        throw new Error('Authentication required. Please log in first.');
      }
      
      // For single generation, use the enhanced /generate endpoint
      if (generationMode === 'single') {
        const response = await fetch(`${apiUrl}/podna/generate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prompt: promptText,
            mode: 'exploratory',
            provider: 'imagen-4-ultra',
            interpret: true // Enable enhanced interpretation
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Generation failed');
        }

        const result = await response.json();

        if (result.success && result.data?.generation) {
          const gen = result.data.generation;
          const newImage = {
            id: gen.id || `gen-${Date.now()}`,
            url: gen.url,
            prompt: promptText,
            timestamp: new Date(),
            brandConsistencyScore: gen.brand_consistency_score || 0.5,
            brandDNAApplied: true
          };

          setImages(prev => [newImage, ...prev]);

          // Save to localStorage
          const existing = JSON.parse(localStorage.getItem('generatedImages') || '[]');
          localStorage.setItem('generatedImages', JSON.stringify([newImage, ...existing]));

          if (typeof commandOrEvent !== 'string') {
            setPrompt('');
          }
        }
      } else {
        // For batch generations, use the /generate-with-dna endpoint
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
            creativity: generationMode === 'exploration' ? 0.7 : 0.5,
            count: generationMode === 'collection' ? 8 : 
                   generationMode === 'campaign' ? 6 : 
                   batchConfig.size
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
    <div className="min-h-screen bg-podna-surface p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 sm:mb-10 md:mb-12 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-light text-gray-900 mb-2 animate-fade-in">
            Generate Designs
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto animate-slide-up">
            Precision control center for AI-powered fashion design
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Controls */}
          <div className="lg:col-span-1 space-y-5 sm:space-y-6">
            {/* Prompt Builder */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-airbnb-card hover:shadow-airbnb-card-hover transition-all duration-300 animate-slide-in-right">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-podna-primary-500" />
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
                    className="w-full px-4 py-3 text-base border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-podna-primary-300 focus:border-transparent resize-none transition-all"
                    disabled={loading}
                  />
                </div>
                
                {/* Enhanced Prompt Preview */}
                {enhancedPrompt && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                      <Zap className="w-4 h-4 text-podna-accent-500" />
                      Enhanced Interpretation
                    </h3>
                    <p className="text-sm text-gray-600">{enhancedPrompt}</p>
                    
                    {/* Validation Results */}
                    {validationResults && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="grid grid-cols-2 gap-4">
                          {/* Clarity Score */}
                          <div>
                            <div className="flex justify-between items-center text-xs mb-1">
                              <span className="font-medium text-gray-700 flex items-center gap-1">
                                <Star className="w-3 h-3" />
                                Prompt Clarity
                              </span>
                              <span className={`font-semibold ${
                                validationResults.clarityScore > 80 ? 'text-green-600' : 
                                validationResults.clarityScore > 60 ? 'text-yellow-600' : 
                                'text-red-600'
                              }`}>
                                {validationResults.clarityScore}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full transition-all ${
                                  validationResults.clarityScore > 80 ? 'bg-green-500' :
                                  validationResults.clarityScore > 60 ? 'bg-yellow-500' :
                                  'bg-red-500'
                                }`}
                                style={{ width: `${validationResults.clarityScore}%` }}
                              />
                            </div>
                          </div>
                          
                          {/* Brand Alignment Score */}
                          <div>
                            <div className="flex justify-between items-center text-xs mb-1">
                              <span className="font-medium text-gray-700 flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" />
                                Brand Alignment
                              </span>
                              <span className={`font-semibold ${
                                validationResults.brandAlignment > 80 ? 'text-blue-600' : 
                                validationResults.brandAlignment > 60 ? 'text-blue-400' : 
                                'text-gray-500'
                              }`}>
                                {validationResults.brandAlignment}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full transition-all ${
                                  validationResults.brandAlignment > 80 ? 'bg-blue-500' :
                                  validationResults.brandAlignment > 60 ? 'bg-blue-300' :
                                  'bg-gray-400'
                                }`}
                                style={{ width: `${validationResults.brandAlignment}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        
                        {/* Warnings */}
                        {validationResults.warnings?.length > 0 && (
                          <div className="pt-3 border-t border-gray-200">
                            {validationResults.warnings.map((warning: string, idx: number) => (
                              <p key={idx} className="text-xs text-yellow-600 flex items-start gap-1.5 mt-1">
                                <span className="mt-0.5">⚠️</span>
                                <span>{warning}</span>
                              </p>
                            ))}
                          </div>
                        )}
                        
                        {/* Brand Consistency Tips */}
                        {validationResults.brandAlignment < 70 && styleProfile && (
                          <div className="pt-3 border-t border-gray-200">
                            <p className="text-xs text-gray-600 mb-1 font-medium flex items-center gap-1">
                              💡 To increase brand alignment, try mentioning:
                            </p>
                            <ul className="text-xs text-gray-500 space-y-0.5 pl-4 mt-1">
                              {styleProfile.brandDNA?.signatureColors?.slice(0, 2).map((color: any, idx: number) => (
                                <li key={idx} className="list-disc">{color.name} tones</li>
                              ))}
                              {styleProfile.brandDNA?.signatureFabrics?.[0] && (
                                <li className="list-disc">{styleProfile.brandDNA.signatureFabrics[0].name} fabric</li>
                              )}
                              {styleProfile.brandDNA?.primaryAesthetic && (
                                <li className="list-disc">{styleProfile.brandDNA.primaryAesthetic} style</li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Style Profile Integration */}
            {styleProfile && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-airbnb-card hover:shadow-airbnb-card-hover transition-all duration-300 animate-slide-in-right stagger-1">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <Palette className="w-5 h-5 text-podna-primary-500" />
                    Your Brand DNA
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      enforceBrandDNA 
                        ? 'bg-podna-primary-100 text-podna-primary-700' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {enforceBrandDNA ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {/* Core Aesthetic */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Core Aesthetic</h3>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1.5 bg-gray-900 text-white rounded-full text-sm font-medium">
                        {styleProfile.brandDNA?.primaryAesthetic || 'Contemporary'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {Math.round((styleProfile.brandDNA?.confidence?.aesthetic || 0.5) * 100)}% confidence
                      </span>
                    </div>
                    
                    {styleProfile.brandDNA?.secondaryAesthetics?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {styleProfile.brandDNA.secondaryAesthetics.map((aesthetic: string, idx: number) => (
                          <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                            {aesthetic}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Signature Colors */}
                  {styleProfile.brandDNA?.signatureColors?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Signature Colors</h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        {styleProfile.brandDNA.signatureColors.slice(0, 5).map((color: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <div 
                              className="w-7 h-7 rounded-full border border-gray-300 shadow-sm"
                              style={{ backgroundColor: color.hex }}
                              title={`${color.name} (${Math.round(color.weight * 100)}%)`}
                            />
                            <span className="text-xs text-gray-600 capitalize hidden sm:inline">{color.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Signature Fabrics */}
                  {styleProfile.brandDNA?.signatureFabrics?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Signature Fabrics</h3>
                      <div className="flex flex-wrap gap-2">
                        {styleProfile.brandDNA.signatureFabrics.slice(0, 4).map((fabric: any, idx: number) => (
                          <span key={idx} className="px-2.5 py-1.5 bg-gray-50 text-gray-700 rounded-lg text-xs border border-gray-200">
                            {fabric.name} ({Math.round(fabric.weight * 100)}%)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Signature Construction */}
                  {styleProfile.brandDNA?.signatureConstruction?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Signature Details</h3>
                      <ul className="space-y-1">
                        {styleProfile.brandDNA.signatureConstruction.slice(0, 3).map((detail: any, idx: number) => (
                          <li key={idx} className="text-sm text-gray-600 flex items-center">
                            <span className="mr-2 text-podna-primary-500">•</span>
                            <span className="capitalize">{detail.detail}</span>
                            <span className="ml-2 text-xs text-gray-400">
                              ({Math.round(detail.frequency * 100)}%)
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Brand Consistency Info */}
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between text-xs mb-3">
                      <span className="text-gray-600">
                        AI will {enforceBrandDNA ? 'maintain' : 'loosely follow'} brand consistency
                      </span>
                      <button
                        onClick={() => setEnforceBrandDNA(!enforceBrandDNA)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                          enforceBrandDNA
                            ? 'bg-gray-900 text-white hover:bg-gray-800'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {enforceBrandDNA ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                    
                    {!enforceBrandDNA && (
                      <div className="mt-2 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                        <p className="text-xs text-yellow-800">
                          ⚠️ Brand DNA disabled. Generations may be more experimental but less aligned with your signature style.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Brand DNA Controls */}
            {showAdvancedControls && styleProfile && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-airbnb-card hover:shadow-airbnb-card-hover transition-all duration-300 animate-slide-in-right stagger-2">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Brand DNA Control</h3>
                
                <div className="space-y-4">
                  {/* Brand DNA Toggle */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Enforce Brand DNA</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        AI will strongly prefer your signature elements
                      </p>
                    </div>
                    <button
                      onClick={() => setEnforceBrandDNA(!enforceBrandDNA)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        enforceBrandDNA ? 'bg-podna-primary-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          enforceBrandDNA ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  
                  {/* Brand DNA Strength */}
                  {enforceBrandDNA && (
                    <div className="p-3 bg-gray-50 rounded-xl">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium text-gray-700">Brand DNA Strength</span>
                        <span className="text-gray-500">{Math.round(brandDNAStrength * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="100"
                        value={brandDNAStrength * 100}
                        onChange={(e) => setBrandDNAStrength(parseInt(e.target.value) / 100)}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-podna-primary-500"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>Balanced</span>
                        <span>Strong</span>
                        <span>Maximum</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        {brandDNAStrength < 0.7 
                          ? 'Balanced: Mix of brand and creative exploration' 
                          : brandDNAStrength < 0.9 
                            ? 'Strong: Heavy preference for brand elements' 
                            : 'Maximum: Strict adherence to brand signature'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Advanced Controls Toggle */}
            <button
              onClick={() => setShowAdvancedControls(!showAdvancedControls)}
              className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 transition-all duration-300 shadow-airbnb-card"
            >
              <span className="font-medium text-gray-900">Advanced Controls</span>
              <Sliders className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${showAdvancedControls ? 'rotate-90' : ''}`} />
            </button>
            
            {/* Advanced Controls Panel */}
            {showAdvancedControls && (
              <div className="space-y-5 sm:space-y-6">
                {/* Style Dimension Sliders */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-airbnb-card hover:shadow-airbnb-card-hover transition-all duration-300 animate-slide-in-right stagger-3">
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
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-podna-primary-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Composition Presets */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-airbnb-card hover:shadow-airbnb-card-hover transition-all duration-300 animate-slide-in-right stagger-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Composition</h3>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                        className={`px-3 py-2.5 text-sm rounded-xl transition-all duration-200 ${
                          compositionPreset === preset.toLowerCase().replace(/\s+/g, '_')
                            ? 'bg-gray-900 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Lighting Presets */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-airbnb-card hover:shadow-airbnb-card-hover transition-all duration-300 animate-slide-in-right stagger-5">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Lighting</h3>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                        className={`px-3 py-2.5 text-sm rounded-xl transition-all duration-200 ${
                          lightingPreset === preset.toLowerCase().replace(/\s+/g, '_')
                            ? 'bg-gray-900 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Model Selection */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-airbnb-card hover:shadow-airbnb-card-hover transition-all duration-300 animate-slide-in-right stagger-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Model</h3>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                        className={`px-3 py-2.5 text-sm rounded-xl transition-all duration-200 ${
                          modelType === type.toLowerCase().replace(/\s+/g, '_')
                            ? 'bg-gray-900 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Generation Modes */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-airbnb-card hover:shadow-airbnb-card-hover transition-all duration-300 animate-slide-in-right stagger-7">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Generation Mode</h3>
                  
                  <div className="space-y-3">
                    {([
                      { id: 'single', label: 'Single', desc: '1-10 images', icon: <Star className="w-4 h-4" /> },
                      { id: 'collection', label: 'Collection', desc: 'Coordinating set (8 pieces)', icon: <Palette className="w-4 h-4" /> },
                      { id: 'campaign', label: 'Campaign', desc: 'Hero + supporting shots', icon: <Zap className="w-4 h-4" /> },
                      { id: 'exploration', label: 'Exploration', desc: 'Wide creative variations', icon: <TrendingUp className="w-4 h-4" /> }
                    ] as const).map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => setGenerationMode(mode.id)}
                        className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-start gap-3 ${
                          generationMode === mode.id
                            ? 'border-gray-900 bg-gray-50 shadow-sm'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className={`p-2 rounded-lg mt-0.5 ${
                          generationMode === mode.id
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {mode.icon}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{mode.label}</div>
                          <div className="text-sm text-gray-500">{mode.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Batch Configuration */}
                {(generationMode === 'collection' || generationMode === 'campaign' || generationMode === 'exploration') && (
                  <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-airbnb-card hover:shadow-airbnb-card-hover transition-all duration-300 animate-slide-in-right stagger-8">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Batch Configuration</h3>
                    
                    <div className="space-y-5">
                      <div className="p-4 bg-gray-50 rounded-xl">
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          Batch Size: {batchConfig.size}
                        </label>
                        <input
                          type="range"
                          min="10"
                          max="200"
                          value={batchConfig.size}
                          onChange={(e) => handleBatchConfigChange('size', parseInt(e.target.value))}
                          className="w-full accent-podna-primary-500"
                        />
                        <div className="flex justify-between text-xs text-gray-400 mt-2">
                          <span>10</span>
                          <span>100</span>
                          <span>200</span>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-gray-50 rounded-xl">
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          Variation Strategy
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {['consistent', 'diverse', 'structured'].map((strategy) => (
                            <button
                              key={strategy}
                              onClick={() => handleBatchConfigChange('strategy', strategy)}
                              className={`px-3 py-2 text-sm rounded-lg transition-all duration-200 ${
                                batchConfig.strategy === strategy
                                  ? 'bg-gray-900 text-white shadow-sm'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {strategy.charAt(0).toUpperCase() + strategy.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="p-4 bg-gray-50 rounded-xl">
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          Vary Parameters
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {['pose', 'lighting', 'composition', 'color', 'styling', 'background'].map((param) => (
                            <button
                              key={param}
                              onClick={() => toggleVaryParam(param)}
                              className={`px-3 py-2 text-sm rounded-lg transition-all duration-200 flex items-center gap-2 ${
                                batchConfig.varyParams.includes(param)
                                  ? 'bg-gray-900 text-white shadow-sm'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {batchConfig.varyParams.includes(param) ? (
                                <Eye className="w-4 h-4" />
                              ) : (
                                <EyeOff className="w-4 h-4" />
                              )}
                              <span className="capitalize truncate">{param}</span>
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
              className="w-full px-6 py-4 bg-gray-900 text-white rounded-2xl text-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  <span>Generate</span>
                </>
              )}
            </button>
            
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl animate-fade-in">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>
          
          {/* Right Panel - Preview and Results */}
          <div className="lg:col-span-2">
            {/* Batch Progress */}
            {isGenerating && batchProgress.status === 'processing' && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-airbnb-card mb-6 animate-slide-up">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Batch Generation Progress</h2>
                
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span>Processing: {batchProgress.current} / {batchProgress.total} images</span>
                    <span>{Math.round((batchProgress.current / batchProgress.total) * 100)}%</span>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-podna-primary-600 h-3 rounded-full transition-all duration-500 ease-out" 
                      style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                    ></div>
                  </div>
                  
                  <div className="flex gap-3">
                    <button className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm hover:bg-gray-200 flex items-center gap-2 transition-colors">
                      <Pause className="w-4 h-4" />
                      Pause
                    </button>
                    <button className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm hover:bg-gray-200 flex items-center gap-2 transition-colors">
                      <RotateCcw className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Generated Images */}
            {images.length > 0 ? (
              <div className="animate-fade-in">
                <div className="flex justify-between items-center mb-5">
                  <h2 className="text-xl font-semibold text-gray-900">Generated Designs</h2>
                  <button className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm hover:bg-gray-200 flex items-center gap-2 transition-colors">
                    <Save className="w-4 h-4" />
                    Export All
                  </button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {images.map((image) => (
                    <div 
                      key={image.id} 
                      className="group animate-fade-in stagger-1 cursor-pointer"
                      onClick={() => {
                        // Open image in modal
                        setSelectedImage(image);
                        setIsModalOpen(true);
                      }}
                    >
                      <div className="aspect-square bg-gray-100 rounded-2xl overflow-hidden mb-3 relative shadow-airbnb-card transition-all duration-300 hover:shadow-airbnb-card-hover">
                        <img
                          src={image.url}
                          alt={image.prompt}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        
                        {/* Brand Consistency Badge */}
                        {image.brandDNAApplied && image.brandConsistencyScore !== undefined && (
                          <div className="absolute top-3 right-3">
                            <div 
                              className={`px-2.5 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm cursor-pointer shadow-sm ${
                                image.brandConsistencyScore > 0.8 
                                  ? 'bg-green-500/90 text-white' 
                                  : image.brandConsistencyScore > 0.6 
                                    ? 'bg-yellow-500/90 text-white' 
                                    : 'bg-gray-500/90 text-white'
                              }`}
                              title={`Click for detailed breakdown`}
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent opening the image when clicking the badge
                                // Fetch detailed brand consistency breakdown
                                (async () => {
                                  try {
                                    const token = localStorage.getItem('authToken');
                                    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
                                    
                                    if (!token) {
                                      throw new Error('Authentication required. Please log in first.');
                                    }
                                    
                                    const response = await fetch(`${apiUrl}/podna/brand-consistency/${image.id}`, {
                                      headers: {
                                        'Authorization': `Bearer ${token}`
                                      }
                                    });
                                    
                                    if (response.ok) {
                                      const result = await response.json();
                                      // In a real implementation, you would show a modal with the detailed breakdown
                                      alert(`Brand Consistency Breakdown:
Overall: ${Math.round(result.data.overallScore * 100)}%

Aesthetic: ${Math.round(result.data.breakdown.aesthetic.score * 100)}%
Colors: ${Math.round(result.data.breakdown.colors.score * 100)}%
Fabric: ${Math.round(result.data.breakdown.fabric.score * 100)}%
Construction: ${Math.round(result.data.breakdown.construction.score * 100)}%
Photography: ${Math.round(result.data.breakdown.photography.score * 100)}%`);
                                    }
                                  } catch (err) {
                                    console.error('Failed to fetch brand consistency details:', err);
                                  }
                                })();
                              }}
                            >
                              {Math.round(image.brandConsistencyScore * 100)}% match
                            </div>
                          </div>
                        )}
                        
                        {/* Hover Overlay with Actions */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <div className="flex gap-3">
                            <button 
                              className="p-3 bg-white rounded-full hover:bg-gray-100 transition-all transform hover:scale-105 shadow-lg"
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent opening the image when clicking the save button
                                // Save functionality would go here
                              }}
                            >
                              <Save className="w-5 h-5 text-gray-900" />
                            </button>
                            <button 
                              className="p-3 bg-white rounded-full hover:bg-gray-100 transition-all transform hover:scale-105 shadow-lg"
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent opening the image when clicking the eye button
                                // Open image in new tab
                                window.open(image.url, '_blank');
                              }}
                            >
                              <Eye className="w-5 h-5 text-gray-900" />
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-1.5">
                        <p className="text-sm text-gray-600 line-clamp-2">{image.prompt}</p>
                        {image.brandConsistencyScore !== undefined && (
                          <p className="text-xs text-gray-400 flex items-center gap-1">
                            <Palette className="w-3 h-3" />
                            Brand consistency: {Math.round(image.brandConsistencyScore * 100)}%
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-10 sm:p-12 text-center h-full flex flex-col items-center justify-center">
                <div className="bg-gray-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mb-5">
                  <Image className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No designs generated yet</h3>
                <p className="text-gray-500 max-w-md">Create your first design using the prompt builder. Your generated images will appear here.</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Image Modal */}
        {isModalOpen && selectedImage && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setIsModalOpen(false)}>
            <div className="relative max-w-4xl max-h-full" onClick={(e) => e.stopPropagation()}>
              <button 
                className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/75 transition-colors"
                onClick={() => setIsModalOpen(false)}
              >
                <X className="w-6 h-6" />
              </button>
              <img 
                src={selectedImage.url} 
                alt={selectedImage.prompt}
                className="max-h-[90vh] max-w-full object-contain"
              />
              <div className="absolute bottom-4 left-4 right-4 bg-black/70 text-white p-4 rounded-lg">
                <p className="text-sm">{selectedImage.prompt}</p>
                {selectedImage.brandConsistencyScore !== undefined && (
                  <p className="text-xs mt-2 flex items-center gap-1">
                    <Palette className="w-3 h-3" />
                    Brand consistency: {Math.round(selectedImage.brandConsistencyScore * 100)}%
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Voice Command Bar */}
        <div className="mt-10 sm:mt-12">
          <CommandBar onCommandExecute={handleGenerate} />
        </div>
      </div>
    </div>
  );
};

export default Generation;
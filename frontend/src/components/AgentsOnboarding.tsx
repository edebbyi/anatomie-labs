import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, 
  CheckCircle, 
  Loader, 
  Upload, 
  AlertCircle, 
  Brain, 
  Image as ImageIcon,
  Heart,
  Star 
} from 'lucide-react';
import { systemAPI, StyleProfile } from '../services/agentsAPI';
import authAPI from '../services/authAPI';
import { default as nodeApi, generationAPI as nodeGenerationAPI } from '../services/api';
import onboardingAPI from '../services/onboardingAPI';

interface OnboardingStep {
  step: number;
  title: string;
  description: string;
  agent?: string;
}

const steps: OnboardingStep[] = [
  { step: 1, title: 'AI Agents Ready', description: 'Check system status', agent: 'System' },
  { step: 2, title: 'Portfolio Analysis', description: 'Upload portfolio ZIP file', agent: 'Visual Analyst' },
  { step: 3, title: 'Style Profile', description: 'Creating your AI style profile', agent: 'Visual Analyst' },
  { step: 4, title: 'First Generation', description: 'Generate personalized images', agent: 'Image Renderer' },
];

interface UploadedImage {
  id: string;
  file: File;
  url: string;
  uploaded: boolean;
}

const AgentsOnboarding: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  
  // Step 1: System check
  const [agentsAvailable, setAgentsAvailable] = useState(false);
  const [agentsList, setAgentsList] = useState<string[]>([]);
  
  // Step 2: Image upload
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [zipFile, setZipFile] = useState<File | null>(null);
  
  // Step 3: Style profile
  const [styleProfile, setStyleProfile] = useState<any | null>(null);
  
  // Step 4: Generated images
  const [generatedImages, setGeneratedImages] = useState<Array<{id: string, url: string, prompt: string}>>([]);

  // Initialize user data
  useEffect(() => {
    const currentUser = authAPI.getCurrentUser();
    if (currentUser) {
      setUserId(currentUser.id);
    } else {
      navigate('/login');
      return;
    }

    // Check AI agents system
    checkAgentsSystem();
  }, [navigate]);
  
  // Auto-trigger generation when reaching step 4
  useEffect(() => {
    if (currentStep === 4 && styleProfile && !isProcessing && generatedImages.length === 0) {
      generateFirstImages();
    }
  }, [currentStep, styleProfile]);

  const checkAgentsSystem = async () => {
    setIsProcessing(true);
    setProcessingMessage('Checking AI Agents system...');
    
    try {
      const available = await systemAPI.isAvailable();
      if (!available) {
        setError('AI Agents system is not available. Please try again later.');
        return;
      }

      const health = await systemAPI.health();
      setAgentsAvailable(true);
      setAgentsList(health.agents);
      setProcessingMessage('AI Agents ready!');
      
      setTimeout(() => {
        setIsProcessing(false);
        setCurrentStep(2);
      }, 1000);
      
    } catch (error: any) {
      setError(`Failed to connect to AI system: ${error.message}`);
      setIsProcessing(false);
    }
  };

  // ZIP file upload handler
  const handleZipUpload = (files: FileList) => {
    if (files.length !== 1) {
      setError('Please upload exactly one ZIP file containing your portfolio images');
      return;
    }

    const file = files[0];
    
    // Check if it's a ZIP file
    if (!file.type.includes('zip') && !file.name.toLowerCase().endsWith('.zip')) {
      setError('Please upload a ZIP file (.zip) containing your portfolio images');
      return;
    }

    // Check file size (max 50MB for ZIP)
    if (file.size > 50 * 1024 * 1024) {
      setError('ZIP file too large. Please ensure your portfolio ZIP is under 50MB');
      return;
    }

    // Create a preview entry for the ZIP file
    const zipPreview: UploadedImage = {
      id: Math.random().toString(36).substr(2, 9),
      file,
      url: '', // No preview URL for ZIP
      uploaded: false
    };

    setUploadedImages([zipPreview]);
    setZipFile(file);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) {
      handleZipUpload(e.dataTransfer.files);
    }
  };

  const removeImage = (id: string) => {
    setUploadedImages(prev => prev.filter(img => img.id !== id));
  };

  const analyzePortfolio = async () => {
    if (!zipFile) {
      setError('Please upload a ZIP file containing your portfolio images');
      return;
    }

    if (!userId) {
      setError('User not found. Please log in again.');
      return;
    }

    setCurrentStep(3);
    setIsProcessing(true);
    setError(null);
    
    try {
      setProcessingMessage('Processing ZIP file...');

      // Analyze ZIP via backend (streaming)
      const vltResult = await onboardingAPI.processPortfolio(zipFile, {
        name: '', email: '', company: '', role: ''
      }, {
        onProgress: (p, msg) => setProcessingMessage(msg || `Analyzing... ${p}%`),
        timeout: 300000
      });

      setProcessingMessage('Creating your style profile...');

      // Create style profile with clustering and enrichment (style tags)
      const createResp = await nodeApi.post('/style-clustering/create-profile', {
        userId,
        vltResult
      });

      const createdProfile = createResp.data?.data;
      if (!createdProfile) {
        throw new Error('Style profile creation failed');
      }

      // Store locally for later use
      setStyleProfile(createdProfile);
      localStorage.setItem('userStyleProfile', JSON.stringify(createdProfile));

      setProcessingMessage('Style profile created!');
      setTimeout(() => {
        setIsProcessing(false);
        setCurrentStep(4);
      }, 1000);
      
    } catch (error: any) {
      setError(`Portfolio analysis failed: ${error.message}`);
      setIsProcessing(false);
    }
  };

  const generateFirstImages = async () => {
    if (!userId || !styleProfile) {
      setError('Missing user ID or style profile');
      return;
    }

    setIsProcessing(true);
    setProcessingMessage('Generating your first personalized images...');
    
    try {
      // Simple queries to be enhanced by backend agent system
      const queries = [
        'elegant evening dress',
        'casual summer outfit', 
        'professional business attire',
        'trendy streetwear'
      ];

      const generatedResults = [];
      
      for (let i = 0; i < queries.length; i++) {
        const query = queries[i];
        setProcessingMessage(`Generating image ${i + 1}/4 using your style profile...`);
        
        try {
          // Use Node generation which uses agent system + style profile via generateFromQuery
          const genResp = await nodeGenerationAPI.generate({
            userId,
            description: query,
            count: 1
          });
          
          const result = {
            success: true,
            results: {
              results: genResp.assets?.map((a: any) => ({
                prompt_id: a.id,
                image_url: a.url,
                metadata: { original_prompt: genResp.metadata?.prompt || query }
              })) || []
            }
          };

          if (result.success && result.results?.results && result.results.results.length > 0) {
            const genImg = result.results.results[0];
            generatedResults.push({
              id: genImg.prompt_id || `gen-${Date.now()}-${i}`,
              url: genImg.image_url || '',
              prompt: genImg.metadata?.original_prompt || query
            });
          } else {
            console.warn(`Generation ${i + 1} failed:`, result);
          }
        } catch (genError: any) {
          console.error(`Generation ${i + 1} error:`, genError);
          // Continue with next generation instead of failing completely
        }
        
        // Small delay between generations
        if (i < prompts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      setGeneratedImages(generatedResults);
      setProcessingMessage(`Generated ${generatedResults.length}/4 images successfully!`);
      
      // Save generated images to localStorage for gallery display
      const imagesForGallery = generatedResults.map(img => ({
        ...img,
        timestamp: new Date().toISOString(),
        source: 'onboarding'
      }));
      localStorage.setItem('aiGeneratedImages', JSON.stringify(imagesForGallery));
      
      // Save onboarding completion
      localStorage.setItem('agentsOnboardingComplete', 'true');
      localStorage.setItem('userStyleProfile', JSON.stringify(styleProfile));
      
      setIsProcessing(false);
      
      setTimeout(() => {
        navigate('/home'); // Navigate to home instead of dashboard
      }, 3000);
      
    } catch (error: any) {
      setError(`Image generation failed: ${error.message}`);
      setIsProcessing(false);
      console.error('Generation error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <Brain className="w-8 h-8" />
              <h1 className="text-2xl font-bold">AI Agents Onboarding</h1>
            </div>
            
            {/* Progress Steps */}
            <div className="flex items-center gap-4">
              {steps.map((step, index) => (
                <div key={step.step} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    currentStep > step.step ? 'bg-green-500' :
                    currentStep === step.step ? 'bg-white text-purple-600' :
                    'bg-purple-400'
                  }`}>
                    {currentStep > step.step ? <CheckCircle className="w-4 h-4" /> : step.step}
                  </div>
                  <div className="text-sm">
                    <div className="font-medium">{step.title}</div>
                    <div className="text-purple-200 text-xs">{step.agent}</div>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`w-8 h-0.5 ${currentStep > step.step ? 'bg-green-500' : 'bg-purple-400'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-8">
            
            {/* Error Display */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <span className="text-red-700">{error}</span>
              </div>
            )}

            {/* Step 1: System Check */}
            {currentStep === 1 && (
              <div className="text-center">
                <Sparkles className="w-16 h-16 text-purple-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">AI Agents System</h2>
                <p className="text-gray-600 mb-6">Initializing the 5-agent AI system for personalized fashion generation</p>
                
                {isProcessing ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader className="w-5 h-5 animate-spin text-purple-500" />
                    <span>{processingMessage}</span>
                  </div>
                ) : agentsAvailable ? (
                  <div>
                    <div className="mb-4 p-4 bg-green-50 rounded-lg">
                      <p className="text-green-700 font-medium">✅ AI Agents Ready!</p>
                      <p className="text-sm text-green-600 mt-1">
                        Available: {agentsList.join(', ')}
                      </p>
                    </div>
                    <button
                      onClick={() => setCurrentStep(2)}
                      className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Continue to Portfolio Upload
                    </button>
                  </div>
                ) : null}
              </div>
            )}

            {/* Step 2: ZIP Upload */}
            {currentStep === 2 && (
              <div>
                <h2 className="text-2xl font-bold mb-2">Upload Your Design Portfolio</h2>
                <p className="text-gray-600 mb-6">Upload a ZIP file containing 50+ images of your designs so the Visual Analyst can learn your style accurately</p>
                
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragOver 
                      ? 'border-purple-400 bg-purple-50' 
                      : 'border-gray-300 hover:border-purple-300'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-medium mb-2">Drag & drop your portfolio ZIP file here</p>
                  <p className="text-gray-500 mb-4">or click to select a ZIP file (max 50MB)</p>
                  <input
                    type="file"
                    accept=".zip,application/zip,application/x-zip-compressed"
                    onChange={(e) => e.target.files && handleZipUpload(e.target.files)}
                    className="hidden"
                    id="zip-upload"
                  />
                  <label
                    htmlFor="zip-upload"
                    className="inline-block px-4 py-2 bg-purple-600 text-white rounded-lg cursor-pointer hover:bg-purple-700 transition-colors"
                  >
                    Select ZIP File
                  </label>
                </div>

                {/* ZIP File Preview */}
                {uploadedImages.length > 0 && (
                  <div className="mt-6">
                    <h3 className="font-medium mb-3">Uploaded Portfolio</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      {uploadedImages.map((zipFile) => (
                        <div key={zipFile.id} className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                            <Upload className="w-6 h-6 text-purple-600" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{zipFile.file.name}</p>
                            <p className="text-sm text-gray-500">
                              {(zipFile.file.size / (1024 * 1024)).toFixed(1)} MB • ZIP Archive
                            </p>
                          </div>
                          <button
                            onClick={() => removeImage(zipFile.id)}
                            className="w-8 h-8 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors flex items-center justify-center"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-4">
                      <button
                        onClick={analyzePortfolio}
                        className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
                      >
                        Analyze Portfolio ZIP File
                      </button>
                      <p className="text-sm text-gray-500 mt-2">
                        The ZIP file should contain 50+ fashion design images (JPG, PNG, etc.) for accurate style analysis
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Style Profile Creation */}
            {currentStep === 3 && (
              <div className="text-center">
                <Brain className="w-16 h-16 text-purple-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Creating Your Style Profile</h2>
                <p className="text-gray-600 mb-6">The Visual Analyst is examining your designs...</p>
                
                {isProcessing ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader className="w-5 h-5 animate-spin text-purple-500" />
                    <span>{processingMessage}</span>
                  </div>
                ) : styleProfile ? (
                  <div className="max-w-2xl mx-auto">
                  <div className="bg-purple-50 rounded-lg p-6 mb-6">
                      <h3 className="text-lg font-bold mb-4">Your Style Profile</h3>
                      <div className="grid grid-cols-2 gap-4 text-left">
                        <div>
                          <p className="font-medium">Dominant Style:</p>
                          <p className="text-purple-600">{styleProfile.insights?.dominantStyle || 'unknown'}</p>
                        </div>
                        <div>
                          <p className="font-medium">Clusters:</p>
                          <p className="text-purple-600">{styleProfile.clusterCount}</p>
                        </div>
                        <div>
                          <p className="font-medium">Style Tags:</p>
                          <p className="text-sm text-gray-600">{(styleProfile.style_tags || []).join(', ') || '—'}</p>
                        </div>
                        <div>
                          <p className="font-medium">Signature Colors:</p>
                          <div className="flex gap-1 mt-1">
                            {(styleProfile.signature_elements?.colors || []).slice(0, 3).map((color, i) => (
                              <div key={i} className="w-4 h-4 rounded" style={{ backgroundColor: color }} />
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="font-medium">Key Silhouettes:</p>
                          <p className="text-sm text-gray-600">{(styleProfile.signature_elements?.silhouettes || []).join(', ')}</p>
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={generateFirstImages}
                      className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Generate Personalized Images
                    </button>
                  </div>
                ) : null}
              </div>
            )}

            {/* Step 4: Image Generation */}
            {currentStep === 4 && (
              <div className="text-center">
                <ImageIcon className="w-16 h-16 text-purple-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Generating Your First Images</h2>
                <p className="text-gray-600 mb-6">Creating personalized designs using your style profile...</p>
                
                {isProcessing ? (
                  <div className="flex items-center justify-center gap-2 mb-6">
                    <Loader className="w-5 h-5 animate-spin text-purple-500" />
                    <span>{processingMessage}</span>
                  </div>
                ) : null}

                {/* Generated Images Grid */}
                {generatedImages.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-4">Generated Images ({generatedImages.length})</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      {generatedImages.map((image) => (
                        <div key={image.id} className="relative">
                          <img
                            src={image.url}
                            alt={image.prompt}
                            className="w-full h-40 object-cover rounded-lg"
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2 rounded-b-lg">
                            <p className="text-xs truncate">{image.prompt}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {!isProcessing && (
                      <div>
                        <p className="text-green-600 font-medium mb-4">🎉 Onboarding Complete!</p>
                        <p className="text-gray-600">Redirecting to your dashboard...</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentsOnboarding;
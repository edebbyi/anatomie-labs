import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Upload, Loader } from 'lucide-react';
import { agentsAPI } from '../services/agentsAPI';
import authAPI from '../services/authAPI';

const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'upload' | 'processing'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [detailedProgress, setDetailedProgress] = useState<string>('');  // NEW: Detailed progress
  const [error, setError] = useState<string | null>(null);

  const currentUser = authAPI.getCurrentUser();
  const userId = currentUser?.id;

  React.useEffect(() => {
    if (!currentUser) {
      navigate('/signup');
    }
  }, [currentUser, navigate]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.zip')) {
      setError('Please upload a ZIP file');
      return;
    }

    if (selectedFile.size > 500 * 1024 * 1024) {
      setError('File must be less than 500MB');
      return;
    }

    setFile(selectedFile);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file || !userId) {
      console.error('❌ Upload failed: Missing file or userId', { file: !!file, userId });
      return;
    }

    console.log('🚀 Starting onboarding upload', {
      fileName: file.name,
      fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
      userId
    });

    setStep('processing');
    setLoading(true);
    setError(null);

    try {
      setMessage('Uploading portfolio...');
      setProgress(10);
      console.log('📤 Step 1: Creating FormData with ZIP file');

      // Upload ZIP using the new Podna endpoint
      const formData = new FormData();
      formData.append('portfolio', file);  // Changed from 'file' to 'portfolio'
      
      setMessage('Processing portfolio with AI agents...');
      setProgress(20);

      const token = authAPI.getToken();
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
      
      // Step 1: Upload portfolio ZIP to Podna system
      const uploadUrl = `${apiUrl}/podna/upload`;
      console.log('🔑 Auth token obtained:', token ? '✅ Valid' : '❌ Missing');
      console.log('🌐 Step 1 - Upload to:', uploadUrl);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      console.log('📡 Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Upload request failed:', errorData);
        throw new Error(errorData.message || 'Upload failed');
      }

      const uploadResult = await response.json();
      console.log('✅ Upload successful! Result:', uploadResult);
      
      if (!uploadResult.success) {
        console.error('❌ Upload failed:', uploadResult);
        throw new Error(uploadResult.message || 'Upload failed');
      }

      const portfolioId = uploadResult.data?.portfolioId;
      const imageCount = uploadResult.data?.imageCount || 0;
      console.log('📦 Portfolio ID:', portfolioId);
      console.log('🖼️  Images uploaded:', imageCount);
      
      if (imageCount === 0) {
        throw new Error(
          'No images were found in your ZIP file. Please ensure your ZIP contains image files ' +
          '(.jpg, .jpeg, .png, .webp) at the root level (not in a subfolder) and try again.'
        );
      }
      
      // Step 2: Analyze portfolio with Gemini via Replicate
      setMessage('Analyzing images with AI...');
      setProgress(30);
      setDetailedProgress('Starting image analysis...');
      console.log('🔬 Step 2 - Analyzing portfolio:', portfolioId);
      
      const analyzeUrl = `${apiUrl}/podna/analyze/${portfolioId}`;
      
      // Start polling for progress
      const progressInterval = setInterval(async () => {
        try {
          const progressResponse = await fetch(`${analyzeUrl}/progress`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (progressResponse.ok) {
            const progressData = await progressResponse.json();
            if (progressData.success && progressData.data) {
              const prog = progressData.data;
              
              if (prog.status === 'analyzing') {
                // Update progress bar (30% base + up to 20% for analysis)
                const analysisProgress = 30 + Math.round((prog.percentage / 100) * 20);
                setProgress(analysisProgress);
                
                // Update detailed message
                const detail = `Analyzing image ${prog.current} of ${prog.total}...`;
                setDetailedProgress(detail);
                
                console.log('📊 Analysis progress:', {
                  current: prog.current,
                  total: prog.total,
                  percentage: prog.percentage,
                  image: prog.currentImage
                });
              } else if (prog.status === 'complete') {
                setDetailedProgress(`Complete! Analyzed ${prog.analyzed} images.`);
                clearInterval(progressInterval);
              }
            }
          }
        } catch (err) {
          console.log('Progress check failed:', err);
        }
      }, 2000); // Poll every 2 seconds
      
      // Start the analysis
      const analyzeResponse = await fetch(analyzeUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Stop polling
      clearInterval(progressInterval);
      
      const analyzeResult = await analyzeResponse.json();
      console.log('✅ Analysis complete:', analyzeResult);
      
      if (!analyzeResult.success) {
        throw new Error(analyzeResult.message || 'Analysis failed');
      }
      
      // Step 3: Generate style profile
      setMessage('Creating your style profile...');
      setProgress(50);
      console.log('👤 Step 3 - Generating style profile');
      
      const profileUrl = `${apiUrl}/podna/profile/generate/${portfolioId}`;
      const profileResponse = await fetch(profileUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const profileResult = await profileResponse.json();
      console.log('✅ Profile created:', profileResult);
      
      if (!profileResult.success) {
        throw new Error(profileResult.message || 'Profile generation failed');
      }
      
      // Step 4: Generate initial images with Imagen-4 Ultra
      setMessage('Generating your first custom designs...');
      setProgress(70);
      console.log('🎨 Step 4 - Generating initial images');
      
      const generateUrl = `${apiUrl}/podna/generate/batch`;
      const generateResponse = await fetch(generateUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          count: 5,  // Generate 5 initial images (reduced from 8 for faster onboarding)
          mode: 'exploratory',  // Use exploratory mode
          provider: 'imagen-4-ultra'  // Use Imagen-4 Ultra via Replicate
        })
      });
      
      const generateResult = await generateResponse.json();
      console.log('✅ Generation complete:', generateResult);
      
      if (!generateResult.success) {
        console.warn('⚠️ Generation failed:', generateResult.message);
        // Don't throw - continue without images
      }

      setMessage('Your custom designs are ready!');
      setProgress(90);

      // Extract generated images from Podna response
      const generations = generateResult.data?.generations || [];
      
      if (generations.length > 0) {
        console.log('🎨 Processing generated images:', generations.length);
        console.log('📸 Sample generation:', generations[0]);
        
        // Save generated images to localStorage for Home page
        const newImages = generations.map((gen: any, idx: number) => ({
          id: gen.id || `onboard-${Date.now()}-${idx}`,
          url: gen.url,
          prompt: gen.prompt_text || gen.text || 'Custom design from your style',
          timestamp: new Date(),
          metadata: {
            generationId: gen.id,
            promptId: gen.prompt_id,
            spec: gen.json_spec
          }
        }));
        console.log('💾 Saving images to localStorage:', newImages.length);
        console.log('🖼️ First image URL:', newImages[0]?.url);
        localStorage.setItem('generatedImages', JSON.stringify(newImages));
        localStorage.setItem('aiGeneratedImages', JSON.stringify(newImages));
        console.log('✅ Images saved successfully');
      } else {
        console.warn('⚠️ No images generated, but onboarding will continue');
      }

      setProgress(100);
      setMessage('Complete!');
      console.log('🎉 Onboarding complete!');
      
      // Mark onboarding as complete
      const userProfile = {
        userId,
        name: currentUser.name,
        email: currentUser.email,
        onboardingComplete: true,
        timestamp: new Date().toISOString()
      };
      console.log('💾 Saving user profile to localStorage:', userProfile);
      localStorage.setItem('userProfile', JSON.stringify(userProfile));

      console.log('🏠 Redirecting to home in 1 second...');
      setTimeout(() => navigate('/home'), 1000);
    } catch (err: any) {
      console.error('❌ Onboarding error:', {
        message: err.message,
        error: err,
        stack: err.stack
      });
      setError(err.message || 'Failed to process portfolio. You can skip for now.');
      setLoading(false);
      setStep('upload');
    }
  };

  if (step === 'processing') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center">
          <Loader className="w-16 h-16 text-gray-900 mx-auto animate-spin mb-8" />
          <h1 className="text-3xl font-light text-gray-900 mb-2">Analyzing Your Style</h1>
          <p className="text-gray-600 mb-4">{message}</p>
          {detailedProgress && (
            <p className="text-sm text-gray-500 mb-4 italic">{detailedProgress}</p>
          )}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gray-900 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 mt-4">{Math.round(progress)}%</p>
          
          {/* Show helpful tip during analysis */}
          {progress >= 30 && progress < 50 && (
            <div className="mt-8 p-4 bg-gray-50 rounded-lg text-left">
              <p className="text-xs text-gray-600">
                <strong>Did you know?</strong> We're analyzing each image individually to understand your unique style patterns, color preferences, and garment choices.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-12">
          <Sparkles className="w-12 h-12 text-gray-900 mx-auto mb-4" />
          <h1 className="text-5xl font-light text-gray-900 mb-4">Welcome to Podna</h1>
          <p className="text-xl text-gray-600">Let's analyze your portfolio</p>
        </div>

        <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-12">
          <input
            type="file"
            accept=".zip"
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="flex flex-col items-center cursor-pointer"
          >
            <Upload className="w-16 h-16 text-gray-400 mb-4" />
            <p className="text-lg text-gray-700 mb-2">
              {file ? file.name : 'Upload your portfolio'}
            </p>
            <p className="text-sm text-gray-500">
              ZIP file with 50-500 images
            </p>
          </label>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!file || loading}
          className="w-full mt-8 py-4 bg-gray-900 text-white rounded-lg text-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? 'Processing...' : 'Continue'}
        </button>

        <button
          onClick={() => navigate('/home')}
          className="w-full mt-4 py-4 bg-white text-gray-700 rounded-lg text-lg border border-gray-300 hover:bg-gray-50 transition-all"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
};

export default Onboarding;

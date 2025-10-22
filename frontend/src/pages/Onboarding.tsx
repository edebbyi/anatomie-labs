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

      // Upload ZIP using the new agents endpoint
      const formData = new FormData();
      formData.append('file', file);
      
      setMessage('Processing portfolio with AI agents...');
      setProgress(20);

      const token = authAPI.getToken();
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
      const uploadUrl = `${apiUrl}/agents/portfolio/upload`;
      console.log('🔑 Auth token obtained:', token ? '✅ Valid' : '❌ Missing');
      console.log('🌐 Making request to:', uploadUrl);

      // Call the unified portfolio upload endpoint
      // This handles: ZIP extraction → R2 upload → Visual Analyst analysis → Initial generation
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

      const result = await response.json();
      console.log('✅ Upload successful! Result:', result);
      
      if (!result.success) {
        console.error('❌ Processing failed:', result);
        throw new Error(result.message || 'Processing failed');
      }

      console.log('📊 Portfolio analysis complete:', {
        imagesUploaded: result.data?.imagesUploaded,
        hasProfile: !!result.data?.profile,
        hasGeneration: !!result.data?.initialGeneration
      });
      console.log('🔍 Full initialGeneration object:', result.data?.initialGeneration);

      setMessage('Portfolio analyzed! Style profile created.');
      setProgress(60);

      // The endpoint already generated images, extract them
      // Check multiple possible locations for images
      const images = result.data?.initialGeneration?.results?.results || // Agents service format
                     result.data?.initialGeneration?.images || 
                     result.data?.initialGeneration?.results || 
                     result.data?.initialGeneration?.data?.images ||
                     result.data?.images;
      
      if (images && images.length > 0) {
        console.log('🎨 Processing generated images:', images.length);
        console.log('📸 Sample image:', images[0]);
        setMessage('Initial designs generated!');
        setProgress(90);
        
        // Save generated images to localStorage for Home page
        const newImages = images.map((img: any, idx: number) => ({
          id: img.image_id || img.id || `onboard-${Date.now()}-${idx}`,
          url: img.url || img.image_url || img.cdnUrl,
          prompt: img.prompt || 'Initial onboarding generation',
          timestamp: new Date()
        }));
        console.log('💾 Saving images to localStorage:', newImages.length);
        console.log('🖼️ First image URL:', newImages[0]?.url);
        localStorage.setItem('generatedImages', JSON.stringify(newImages));
        localStorage.setItem('aiGeneratedImages', JSON.stringify(newImages));
        console.log('✅ Images saved successfully');
      } else {
        console.warn('⚠️ No images found in response');
        console.log('📦 Full result.data:', result.data);
        console.log('🔎 initialGeneration structure:', Object.keys(result.data?.initialGeneration || {}));
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
          <p className="text-gray-600 mb-8">{message}</p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gray-900 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 mt-4">{Math.round(progress)}%</p>
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

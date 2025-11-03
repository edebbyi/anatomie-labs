import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner@2.0.3';
import CommandBar from '../components/CommandBar';
import { HomeGallery } from '../components/HomeGallery';
import { useGalleryData } from '../hooks/useGalleryData';
import { API_URL } from '../config/env';
import authAPI from '../services/authAPI';

const Home: React.FC = () => {
  const location = useLocation();
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const {
    images,
    loading,
    submitFeedback,
    updateImages,
    appendGeneratedImages,
    recordInteraction,
  } = useGalleryData();

  const [highlightSuggestions, setHighlightSuggestions] = useState(true);

  useEffect(() => {
    if (location.pathname === '/home') {
      setHighlightSuggestions(true);
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightSuggestions(false);
        highlightTimeoutRef.current = null;
      }, 60_000);
    }

    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = null;
      }
    };
  }, [location.pathname]);

  const handleLike = async (imageId: string) => {
    recordInteraction(imageId);
    
    // Get current image state
    const currentImage = images.find(img => img.id === imageId);
    const isCurrentlyLiked = currentImage?.liked ?? false;
    
    // Toggle the like state
    const newLikedState = !isCurrentlyLiked;
    
    await submitFeedback(imageId, newLikedState);
    
    // Show appropriate toast message
    if (newLikedState) {
      toast.success('Added to likes');
    } else {
      toast('Removed from likes', {
        description: 'You can find it in your collection anytime.',
      });
    }
  };

  const handleDiscard = async (imageId: string) => {
    recordInteraction(imageId);
    await submitFeedback(imageId, false);
    updateImages((previous) =>
      previous.map((img) =>
        img.id === imageId
          ? { ...img, archived: true, archivedAt: new Date() }
          : img
      )
    );
    toast('Design moved to archive', {
      description: 'You can restore it from the Archive tab anytime.',
    });
  };

  const handleUnarchive = async (imageId: string) => {
    const token = authAPI.getToken();
    
    if (!token) {
      toast.error('You need to be signed in');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/podna/unarchive/${imageId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to restore design');
      }

      updateImages((previous) =>
        previous.map((img) =>
          img.id === imageId
            ? { ...img, archived: false, archivedAt: undefined }
            : img
        )
      );

      toast.success('Design restored from archive');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to restore design';
      toast.error(message);
    }
  };

  const handleGenerate = async (command: string, options?: { source?: 'voice' | 'text' }) => {
    const token = authAPI.getToken();
    const currentUser = authAPI.getCurrentUser();

    if (!token || !currentUser) {
      toast.error('You need to be signed in to generate new designs.');
      return;
    }

    // Determine generation method based on source
    const generationMethod = options?.source === 'voice' ? 'voice_command' : 'generate_endpoint';

    if (options?.source === 'voice') {
      // Route voice-sourced text to the voice processing endpoint
      await toast.promise(
        (async () => {
          const response = await fetch(`${API_URL}/voice/process-text`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ command, userId: currentUser.id }),
          });

          if (!response.ok) {
            throw new Error('Voice command processing failed');
          }

          const result = await response.json();
          if (!result.success) {
            throw new Error(result.message || 'Voice processing unsuccessful');
          }

          const gen = result.data?.generation;
          if (gen && Array.isArray(gen.assets) && gen.assets.length > 0) {
            appendGeneratedImages(gen.assets, command, generationMethod);
          } else {
            // If backend did not generate immediately, fallback to generic generate with the enhanced prompt
            const enhanced = result.data?.parsedCommand?.enhancedPrompt || command;
            const quantity = result.data?.parsedCommand?.quantity || 1;
            const payload = {
              userId: currentUser.id,
              description: enhanced,
              prompt: enhanced,
              count: quantity,
              settings: {
                count: quantity,
                provider: 'google-imagen',
              },
            };

            const genResp = await fetch(`${API_URL}/generate/generate`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(payload),
            });

            if (!genResp.ok) {
              throw new Error('Generation failed');
            }

            const genResult = await genResp.json();
            if (!genResult.success || !Array.isArray(genResult.assets)) {
              throw new Error(genResult.message || 'No assets returned');
            }

            appendGeneratedImages(genResult.assets, enhanced, generationMethod);
          }
        })(),
        {
          loading: 'Processing voice command...',
          success: 'New design ready! Check your collection.',
          error: (err) => err?.message || 'Voice command failed',
        }
      );
      return;
    }

    // Default text-based generation
    const payload = {
      userId: currentUser.id,
      description: command,
      prompt: command,
      count: 1,
      settings: {
        count: 1,
        provider: 'google-imagen',
      },
    };

    await toast.promise(
      (async () => {
        const response = await fetch(`${API_URL}/generate/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error('Generation failed');
        }

        const result = await response.json();
        if (!result.success || !Array.isArray(result.assets)) {
          throw new Error(result.message || 'No assets returned');
        }

        appendGeneratedImages(result.assets, command, generationMethod);
      })(),
      {
        loading: 'Generating your design...',
        success: 'New design ready! Check your collection.',
        error: (err) => err?.message || 'Generation failed',
      }
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-12 h-12 rounded-full border-4 border-gray-200 border-t-gray-900 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <HomeGallery
          images={images}
          onLike={handleLike}
          onDiscard={handleDiscard}
          onUnarchive={handleUnarchive}
          onImageView={recordInteraction}
        />
      </div>

      <CommandBar
        onCommandExecute={handleGenerate}
        highlightSuggestions={highlightSuggestions}
        placeholder="Generate 10 tailored blazers in sage green..."
      />
    </div>
  );
};

export default Home;

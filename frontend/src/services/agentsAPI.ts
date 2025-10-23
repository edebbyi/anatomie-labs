/**
 * AI Agents API Client
 * Communicates with the Python FastAPI agents service
 */

import axios from 'axios';

const AGENTS_API_URL = process.env.REACT_APP_AGENTS_API_URL || 'http://localhost:8000';

const agentsHTTP = axios.create({
  baseURL: AGENTS_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000, // 2 minutes for generation tasks
});

// Add response interceptor for error handling
agentsHTTP.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('Agents API Error:', error.response?.data || error.message);
    throw error;
  }
);

// Type definitions
export interface StyleProfile {
  designer_id: string;
  version: number;
  signature_elements: {
    colors: string[];
    silhouettes: string[];
    materials: string[];
    patterns: string[];
  };
  aesthetic_profile: {
    primary_style: string;
    formality_range: { min: number; max: number; avg: number };
    color_palette_type: string;
  };
  attribute_weights: {
    color: number;
    silhouette: number;
    material: number;
    details: number;
  };
  generation_guidelines: {
    must_maintain: string[];
    allow_variation: string[];
    avoid: string[];
  };
  confidence_score: number;
  images_analyzed: number;
  created_at: string;
}

export interface GeneratedImage {
  prompt_id: string;
  success: boolean;
  image_url: string;
  category: string;
  generation_cost: number;
  processing_cost: number;
  metadata: {
    original_prompt: string;
    generated_at: string;
  };
}

export interface BatchStatus {
  batch_id: string;
  designer_id: string;
  status: 'processing' | 'completed' | 'failed';
  total_images: number;
  completed_images: number;
  progress_percentage: number;
  created_at: string;
  completed_at?: string;
}

export interface FeedbackInput {
  image_id: string;
  designer_id: string;
  overall_rating?: number; // 1-5
  color_rating?: number;
  silhouette_rating?: number;
  material_rating?: number;
  aesthetic_rating?: number;
  selected: boolean;
  rejected: boolean;
  comments?: string;
}

// API Functions

/**
 * PORTFOLIO ANALYSIS (Visual Analyst Agent)
 */
export const portfolioAPI = {
  /**
   * Analyze portfolio images and create style profile
   */
  analyze: async (designerId: string, imageUrls: string[]): Promise<{
    success: boolean;
    profile_data: StyleProfile;
    message: string;
  }> => {
    const response = await agentsHTTP.post('/portfolio/analyze', {
      designer_id: designerId,
      images: imageUrls
    });
    return response.data;
  },

  /**
   * Get designer's style profile
   */
  getProfile: async (designerId: string, version?: number): Promise<{
    success: boolean;
    profile_data: StyleProfile;
  }> => {
    const url = version 
      ? `/portfolio/profile/${designerId}?version=${version}`
      : `/portfolio/profile/${designerId}`;
    
    const response = await agentsHTTP.get(url);
    return response.data;
  },

  /**
   * Check if designer has a style profile
   */
  hasProfile: async (designerId: string): Promise<boolean> => {
    try {
      await portfolioAPI.getProfile(designerId);
      return true;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return false;
      }
      throw error;
    }
  }
};

/**
 * IMAGE GENERATION (Prompt Architect + Image Renderer Agents)
 */
export const generationAPI = {
  /**
   * Generate images using AI agents
   */
  generate: async (
    designerId: string, 
    prompt: string, 
    options: {
      mode?: 'specific' | 'batch';
      quantity?: number;
    } = {}
  ): Promise<{
    success: boolean;
    mode: string;
    batch_id?: string;
    status?: string;
    results?: {
      successful: number;
      failed: number;
      total_cost: number;
      results: GeneratedImage[];
    };
    message: string;
  }> => {
    const response = await agentsHTTP.post('/generation/generate', {
      designer_id: designerId,
      prompt,
      mode: options.mode || 'specific',
      quantity: options.quantity || 1
    });
    return response.data;
  },

  /**
   * Get batch generation status
   */
  getBatchStatus: async (batchId: string): Promise<{
    success: boolean;
    data: BatchStatus;
  }> => {
    const response = await agentsHTTP.get(`/generation/batch/${batchId}/status`);
    return response.data;
  },

  /**
   * Get all generated images for a designer
   */
  getUserImages: async (designerId: string): Promise<{
    success: boolean;
    images: any[];
  }> => {
    try {
      const response = await agentsHTTP.get(`/generation/images/${designerId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return { success: true, images: [] };
      }
      throw error;
    }
  },

  /**
   * Enhanced generation with automatic profile checking
   */
  smartGenerate: async (
    designerId: string,
    prompt: string,
    options: {
      mode?: 'specific' | 'batch';
      quantity?: number;
      requireProfile?: boolean;
    } = {}
  ) => {
    // Check if profile exists if required
    if (options.requireProfile !== false) {
      const hasProfile = await portfolioAPI.hasProfile(designerId);
      if (!hasProfile) {
        throw new Error('Style profile required. Please analyze your portfolio first.');
      }
    }

    return generationAPI.generate(designerId, prompt, options);
  }
};

/**
 * FEEDBACK & LEARNING (Quality Curator Agent)
 */
export const feedbackAPI = {
  /**
   * Submit feedback for learning
   */
  submit: async (feedbackList: FeedbackInput[]): Promise<{
    success: boolean;
    feedback_count: number;
    profile_updated: boolean;
    new_version?: number;
    message: string;
  }> => {
    const response = await agentsHTTP.post('/feedback/submit', feedbackList);
    return response.data;
  },

  /**
   * Submit simple feedback (like/dislike)
   */
  submitSimple: async (
    imageId: string, 
    designerId: string, 
    action: 'like' | 'dislike' | 'love',
    comments?: string
  ) => {
    const feedback: FeedbackInput = {
      image_id: imageId,
      designer_id: designerId,
      selected: action === 'like' || action === 'love',
      rejected: action === 'dislike',
      overall_rating: action === 'love' ? 5 : action === 'like' ? 4 : action === 'dislike' ? 2 : undefined,
      comments
    };

    return feedbackAPI.submit([feedback]);
  },

  /**
   * Submit detailed rating feedback
   */
  submitRating: async (
    imageId: string,
    designerId: string,
    ratings: {
      overall?: number;
      color?: number;
      silhouette?: number;
      material?: number;
      aesthetic?: number;
    },
    comments?: string
  ) => {
    const feedback: FeedbackInput = {
      image_id: imageId,
      designer_id: designerId,
      overall_rating: ratings.overall,
      color_rating: ratings.color,
      silhouette_rating: ratings.silhouette,
      material_rating: ratings.material,
      aesthetic_rating: ratings.aesthetic,
      selected: (ratings.overall || 0) >= 4,
      rejected: (ratings.overall || 0) <= 2,
      comments
    };

    return feedbackAPI.submit([feedback]);
  }
};

/**
 * SYSTEM HEALTH & INFO
 */
export const systemAPI = {
  /**
   * Check agents service health
   */
  health: async (): Promise<{
    status: string;
    service: string;
    agents: string[];
    timestamp: string;
  }> => {
    const response = await agentsHTTP.get('/health');
    return response.data;
  },

  /**
   * Get service information
   */
  info: async (): Promise<{
    message: string;
    version: string;
    agents: number;
    endpoints: Record<string, string>;
  }> => {
    const response = await agentsHTTP.get('/');
    return response.data;
  },

  /**
   * Check if agents service is available
   */
  isAvailable: async (): Promise<boolean> => {
    try {
      const health = await systemAPI.health();
      return health.status === 'healthy';
    } catch {
      return false;
    }
  }
};

/**
 * WORKFLOW HELPERS
 */
export const workflowAPI = {
  /**
   * Complete onboarding workflow: check service + analyze portfolio
   */
  completeOnboarding: async (designerId: string, imageUrls: string[]) => {
    // Check if agents service is available
    const available = await systemAPI.isAvailable();
    if (!available) {
      throw new Error('AI Agents service is not available. Please try again later.');
    }

    // Analyze portfolio
    return await portfolioAPI.analyze(designerId, imageUrls);
  },

  /**
   * Enhanced generation workflow with error handling
   */
  generateWithFallback: async (
    designerId: string,
    prompt: string,
    options: {
      mode?: 'specific' | 'batch';
      quantity?: number;
      fallbackToBasic?: boolean;
    } = {}
  ) => {
    try {
      return await generationAPI.smartGenerate(designerId, prompt, options);
    } catch (error: any) {
      if (error.message.includes('Style profile required') && options.fallbackToBasic) {
        // Fallback to basic generation without personalization
        console.warn('Falling back to basic generation (no personalization)');
        throw new Error('Portfolio analysis required for personalized generation. Please upload your designs first.');
      }
      throw error;
    }
  }
};

// Main API object combining all modules
export const agentsAPI = {
  // Portfolio analysis
  analyzePortfolio: portfolioAPI.analyze,
  getStyleProfile: portfolioAPI.getProfile,
  hasStyleProfile: portfolioAPI.hasProfile,
  
  // Image generation
  generateImage: generationAPI.generate,
  smartGenerate: generationAPI.smartGenerate,
  getBatchStatus: generationAPI.getBatchStatus,
  getUserImages: generationAPI.getUserImages,
  
  // Feedback
  submitFeedback: feedbackAPI.submit,
  submitSimpleFeedback: feedbackAPI.submitSimple,
  submitRatingFeedback: feedbackAPI.submitRating,
  
  // System
  health: systemAPI.health,
  info: systemAPI.info,
  isAvailable: systemAPI.isAvailable,
  
  // Workflows
  completeOnboarding: workflowAPI.completeOnboarding,
  generateWithFallback: workflowAPI.generateWithFallback
};

export default agentsHTTP;

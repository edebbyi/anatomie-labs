/**
 * Agent Service Client - Bridge between Node.js backend and Python AI agents
 * Handles communication with the FastAPI microservice running the 5 agents
 */

const axios = require('axios');
const logger = require('../utils/logger');

class AgentService {
  constructor() {
    this.baseURL = process.env.AGENTS_SERVICE_URL || 'http://localhost:8000';
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 120000, // 2 minutes for generation tasks
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.info(`Agent Service Request: ${config.method.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('Agent Service Request Error:', error.message);
        return Promise.reject(error);
      }
    );
    
    this.client.interceptors.response.use(
      (response) => {
        logger.info(`Agent Service Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error(`Agent Service Error: ${error.response?.status || 'Network'} ${error.config?.url}`, {
          error: error.response?.data || error.message
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Health check for the agents service
   */
  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      logger.error('Agents service health check failed:', error.message);
      return { status: 'unhealthy', error: error.message };
    }
  }

  /**
   * VISUAL ANALYST AGENT
   * Analyze portfolio images and create style profile
   */
  async analyzePortfolio(designerId, imageUrls) {
    try {
      logger.info(`Analyzing portfolio for designer ${designerId} with ${imageUrls.length} images`);
      
      const response = await this.client.post('/portfolio/analyze', {
        designer_id: designerId,
        images: imageUrls
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Portfolio analysis failed:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.detail || error.message
      };
    }
  }

  /**
   * Get designer's style profile
   */
  async getStyleProfile(designerId, version = null) {
    try {
      const url = version 
        ? `/portfolio/profile/${designerId}?version=${version}`
        : `/portfolio/profile/${designerId}`;
        
      const response = await this.client.get(url);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      if (error.response?.status === 404) {
        return {
          success: false,
          error: 'Style profile not found',
          code: 'PROFILE_NOT_FOUND'
        };
      }
      
      return {
        success: false,
        error: error.response?.data?.detail || error.message
      };
    }
  }

  /**
   * PROMPT ARCHITECT + IMAGE RENDERER AGENTS
   * Generate images using the multi-agent pipeline
   */
  async generateImages(designerId, prompt, mode = 'specific', quantity = 1) {
    try {
      logger.info(`Generating images for designer ${designerId}: ${mode} mode`);
      
      const response = await this.client.post('/generation/generate', {
        designer_id: designerId,
        prompt: prompt,
        mode: mode,
        quantity: quantity
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Image generation failed:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.detail || error.message
      };
    }
  }

  /**
   * Get batch generation status
   */
  async getBatchStatus(batchId) {
    try {
      const response = await this.client.get(`/generation/batch/${batchId}/status`);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      if (error.response?.status === 404) {
        return {
          success: false,
          error: 'Batch not found',
          code: 'BATCH_NOT_FOUND'
        };
      }
      
      return {
        success: false,
        error: error.response?.data?.detail || error.message
      };
    }
  }

  /**
   * Get all generated images for a designer
   */
  async getUserImages(designerId) {
    try {
      const response = await this.client.get(`/generation/images/${designerId}`);
      
      return {
        success: true,
        images: response.data.images || []
      };
    } catch (error) {
      if (error.response?.status === 404) {
        return {
          success: true,
          images: []
        };
      }
      
      return {
        success: false,
        error: error.response?.data?.detail || error.message
      };
    }
  }

  /**
   * QUALITY CURATOR AGENT
   * Submit feedback for learning
   */
  async submitFeedback(feedbackList) {
    try {
      logger.info(`Submitting ${feedbackList.length} feedback entries`);
      
      const response = await this.client.post('/feedback/submit', feedbackList);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Feedback submission failed:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.detail || error.message
      };
    }
  }

  /**
   * COORDINATOR AGENT WORKFLOWS
   * High-level orchestration methods
   */

  /**
   * Complete onboarding workflow: analyze portfolio + create profile
   */
  async completeOnboarding(designerId, imageUrls) {
    try {
      logger.info(`Starting onboarding workflow for designer ${designerId}`);
      
      // Step 1: Analyze portfolio
      const analysisResult = await this.analyzePortfolio(designerId, imageUrls);
      
      if (!analysisResult.success) {
        throw new Error(`Portfolio analysis failed: ${analysisResult.error}`);
      }

      // Step 2: Verify profile was created
      const profileResult = await this.getStyleProfile(designerId);
      
      if (!profileResult.success) {
        throw new Error(`Style profile creation failed: ${profileResult.error}`);
      }

      return {
        success: true,
        data: {
          analysis: analysisResult.data,
          profile: profileResult.data,
          message: 'Onboarding completed successfully'
        }
      };
    } catch (error) {
      logger.error('Onboarding workflow failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Smart generation workflow: check profile + generate + learn
   */
  async smartGeneration(designerId, prompt, mode = 'specific', quantity = 1) {
    try {
      logger.info(`Starting smart generation for designer ${designerId}`);
      
      // Step 1: Check if style profile exists
      const profileCheck = await this.getStyleProfile(designerId);
      
      if (!profileCheck.success && profileCheck.code === 'PROFILE_NOT_FOUND') {
        return {
          success: false,
          error: 'Style profile required. Please complete portfolio analysis first.',
          code: 'PROFILE_REQUIRED'
        };
      }

      // Step 2: Generate images
      const generationResult = await this.generateImages(designerId, prompt, mode, quantity);
      
      return generationResult;
    } catch (error) {
      logger.error('Smart generation workflow failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Learning workflow: submit feedback + update profile
   */
  async learnFromFeedback(designerId, feedbackData) {
    try {
      logger.info(`Starting learning workflow for designer ${designerId}`);
      
      // Submit feedback to Quality Curator
      const feedbackResult = await this.submitFeedback(feedbackData);
      
      if (!feedbackResult.success) {
        throw new Error(`Feedback processing failed: ${feedbackResult.error}`);
      }

      // If profile was updated, get the new version
      if (feedbackResult.data.profile_updated) {
        const updatedProfile = await this.getStyleProfile(designerId);
        
        return {
          success: true,
          data: {
            feedback: feedbackResult.data,
            updated_profile: updatedProfile.success ? updatedProfile.data : null,
            message: 'Learning completed - profile updated with feedback'
          }
        };
      }

      return {
        success: true,
        data: {
          feedback: feedbackResult.data,
          message: 'Feedback recorded - profile will update after more samples'
        }
      };
    } catch (error) {
      logger.error('Learning workflow failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Create singleton instance
const agentService = new AgentService();

module.exports = agentService;
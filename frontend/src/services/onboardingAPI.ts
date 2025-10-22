import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export interface OnboardingData {
  name: string;
  email: string;
  company: string;
  role: string;
}

export interface VLTAnalysisResult {
  jobId: string;
  status: string;
  backend: string;
  model: string;
  timestamp: string;
  records: Array<{
    imageId: string;
    garmentType: string;
    silhouette: string;
    fabric: any;
    colors: any;
    construction: any;
    style: any;
    promptText: string;
    confidence: number;
    attributes: any;
  }>;
  summary: {
    totalImages: number;
    garmentTypes: Record<string, number>;
    dominantColors: Record<string, number>;
    fabricTypes: Record<string, number>;
    silhouettes: Record<string, number>;
    averageConfidence: number;
  };
}

// Types for GMM clustering and style profiles
export interface StyleCluster {
  id: number;
  size: number;
  percentage: number;
  style_summary: string;
  dominant_attributes: Record<string, any>;
  centroid_confidence: number;
  representative_records: string[];
}

export interface ClusteringResult {
  clusterCount: number;
  styleClusters: StyleCluster[];
  coverage?: {
    overallCoverage: number;
  };
  insights?: {
    dominantStyle: string;
  };
  embeddings?: {
    stored: number;
    failed: number;
  };
}

class OnboardingAPI {
  /**
   * Process portfolio ZIP file with VLT analysis (with streaming progress)
   */
  async processPortfolio(
    zipFile: File,
    userData: OnboardingData,
    options?: {
      model?: string;
      passes?: string;
      onProgress?: (progress: number, message: string, data?: any) => void;
      timeout?: number; // Timeout in milliseconds
    }
  ): Promise<VLTAnalysisResult> {
    const formData = new FormData();
    formData.append('zipFile', zipFile);
    formData.append('model', options?.model || 'gemini');
    formData.append('passes', options?.passes || 'A,B,C');
    
    // Add user data
    formData.append('name', userData.name);
    formData.append('email', userData.email);
    formData.append('company', userData.company);
    formData.append('role', userData.role);

    return new Promise((resolve, reject) => {
      const timeoutMs = options?.timeout || 300000; // Default 5 minutes
      let timeoutId: NodeJS.Timeout;
      let isTimedOut = false;

      // Set up timeout
      timeoutId = setTimeout(() => {
        isTimedOut = true;
        reject(new Error(
          `Analysis timed out after ${timeoutMs / 1000}s. The ZIP file may contain too many images or the API is slow. Please try with fewer images or retry later.`
        ));
      }, timeoutMs);

      // Use streaming endpoint for real-time progress
      fetch(`${API_URL}/vlt/analyze/stream`, {
        method: 'POST',
        body: formData,
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();

          if (!reader) {
            throw new Error('Response body is not readable');
          }

          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim().startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));

                  if (data.error) {
                    clearTimeout(timeoutId);
                    reject(new Error(data.error));
                    return;
                  }

                  if (options?.onProgress && !isTimedOut) {
                    options.onProgress(
                      data.progress || 0,
                      data.message || '',
                      {
                        currentImage: data.currentImage,
                        totalImages: data.totalImages
                      }
                    );
                  }

                  if (data.done && data.result) {
                    clearTimeout(timeoutId);
                    if (!isTimedOut) {
                      resolve(data.result);
                    }
                    return;
                  }
                } catch (err) {
                  console.error('Error parsing SSE data:', err);
                }
              }
            }
          }
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          console.error('Portfolio processing error:', error);
          if (!isTimedOut) {
            reject(
              new Error(
                error.message || 'Failed to process portfolio'
              )
            );
          }
        });
    });
  }

  /**
   * Check VLT service health
   */
  async checkVLTHealth(): Promise<boolean> {
    try {
      const response = await axios.get(`${API_URL}/vlt/health`);
      return response.data.data.status === 'healthy';
    } catch (error) {
      console.error('VLT health check failed:', error);
      return false;
    }
  }

  /**
   * Get available VLT models
   */
  async getAvailableModels(): Promise<any> {
    try {
      const response = await axios.get(`${API_URL}/vlt/models`);
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch VLT models:', error);
      return {
        models: [{ id: 'gemini', name: 'Gemini Vision', recommended: true }],
        defaultModel: 'gemini',
      };
    }
  }

  /**
   * Save style profile from VLT analysis and create style clusters
   * Implements Stage 2 GMM clustering with style profiles like 'Minimalist Tailoring'
   */
  async saveStyleProfile(
    userId: string,
    vltResult: VLTAnalysisResult
  ): Promise<void> {
    try {
      // Step 1: Save basic portfolio data
      const response = await axios.post(`${API_URL}/persona/profile`, {
        userId,
        vltAnalysis: vltResult,
        summary: vltResult.summary,
        timestamp: new Date().toISOString(),
      });
      console.log('Basic profile saved successfully:', response.data);
      
      // Step 2: Create comprehensive style clustering profile with GMM
      // This implements Stage 2 from your instruction stages
      try {
        const clusteringResponse = await axios.post(`${API_URL}/style-clustering/create-profile`, {
          userId,
          vltResult,
          // GMM configuration for Stage 2
          clustering: {
            algorithm: 'GMM', // Gaussian Mixture Models
            n_clusters: Math.min(5, Math.max(2, Math.floor(vltResult.records.length / 10))),
            createStyleProfiles: true, // Enable named style profiles
            targetProfiles: [
              'Minimalist Tailoring',
              'Fluid Evening', 
              'Experimental Edge',
              'Sporty Chic',
              'Romantic Bohemian',
              'Urban Contemporary',
              'Classic Refined'
            ]
          }
        });
        
        const clusterData: ClusteringResult = clusteringResponse.data;
        console.log('Stage 2 GMM clustering profile created:', {
          clusters: clusterData.clusterCount,
          coverage: clusterData.coverage?.overallCoverage,
          dominantStyle: clusterData.insights?.dominantStyle,
          styleProfiles: clusterData.styleClusters?.map((c: StyleCluster) => c.style_summary),
          vectorsStored: clusterData.embeddings?.stored
        });
        
        // Log Stage 2 specific metrics
        if (clusterData.styleClusters) {
          console.log('Stage 2 Style Clusters:', clusterData.styleClusters.map((cluster: StyleCluster) => ({
            name: cluster.style_summary,
            weight: `${cluster.percentage}%`,
            keyAttributes: cluster.dominant_attributes
          })));
        }
        
      } catch (clusteringError) {
        console.warn('Stage 2 GMM clustering failed, continuing with basic profile:', clusteringError);
        // Don't throw - basic profile still works, but log the issue
        console.error('This means Stage 2 style profiles like "Minimalist Tailoring" were not created');
      }
      
    } catch (error) {
      console.error('Failed to save style profile:', error);
      throw error; // Throw error so onboarding knows it failed
    }
  }
  
  /**
   * Get user's style profile with clusters and coverage
   */
  async getStyleProfile(userId: string): Promise<any> {
    try {
      const response = await axios.get(`${API_URL}/style-clustering/profile/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get style profile:', error);
      return null;
    }
  }

  /**
   * Generate initial images for onboarding (50 images with streaming progress)
   */
  async generateInitialImages(
    userId: string,
    options: {
      targetCount?: number;
      provider?: string;
      onProgress?: (progress: number, message: string, stats?: any) => void;
    } = {}
  ): Promise<{ totalGenerated: number; selected: number }> {
    const targetCount = options.targetCount || 20; // Default 20 images (10 prompts × 2 each)
    const provider = options.provider || 'google-imagen';

    return new Promise((resolve, reject) => {
      // Use fetch with SSE for POST request
      fetch(`${API_URL}/generate/onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          targetCount,
          bufferPercent: 10,
          provider,
        }),
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();

          if (!reader) {
            throw new Error('Response body is not readable');
          }

          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim().startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));

                  if (data.error) {
                    reject(new Error(data.error));
                    return;
                  }

                  if (options.onProgress) {
                    options.onProgress(
                      data.progress || 0,
                      data.message || '',
                      data.stats
                    );
                  }

                  if (data.done && data.result) {
                    resolve({
                      totalGenerated: data.result.totalGenerated,
                      selected: data.result.selected,
                    });
                    return;
                  }
                } catch (err) {
                  console.error('Error parsing SSE data:', err);
                }
              }
            }
          }
        })
        .catch((error) => {
          console.error('Generation stream error:', error);
          reject(
            new Error(
              error.message || 'Failed to generate images. Please try again.'
            )
          );
        });
    });
  }
}

export default new OnboardingAPI();

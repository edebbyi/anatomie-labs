/**
 * Voice Command API Client
 * Communicates with the backend voice command endpoints
 */

import axios from 'axios';
import authAPI from './authAPI';
import { API_URL } from '../config/env';

const voiceHTTP = axios.create({
  baseURL: `${API_URL}/voice`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 1 minute for voice processing
});

// Add auth token to requests
voiceHTTP.interceptors.request.use(
  (config) => {
    const token = authAPI.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
voiceHTTP.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('Voice API Error:', error.response?.data || error.message);
    throw error;
  }
);

// Type definitions
export interface VoiceCommandResponse {
  success: boolean;
  data: {
    // What the user said (human-readable)
    displayQuery: string;
    originalCommand: string;

    // Enhanced prompt sent to API
    enhancedPrompt: string;
    negativePrompt: string;

    // Parsed command details
    parsedCommand: any;

    // Generation results
    generation: any;
    timestamp: string;
  };
  message?: string;
}

export interface VoiceSuggestion {
  type: string;
  priority: number;
  prompt: string;
  command: string;
  reasoning: string;
  metadata?: any;
}

export interface VoiceSuggestionsResponse {
  success: boolean;
  data: VoiceSuggestion[];
  meta: {
    season: string;
    count: number;
  };
}

export interface VoiceExample {
  category: string;
  commands: string[];
}

export interface VoiceExamplesResponse {
  success: boolean;
  data: VoiceExample[];
}

// API Functions

/**
 * Process a text voice command
 */
export const processTextCommand = async (command: string): Promise<VoiceCommandResponse> => {
  const response = await voiceHTTP.post<VoiceCommandResponse>('/process-text', {
    command
  });
  return response.data;
};

/**
 * Get AI-generated suggestions based on user profile and trends
 */
export const getSuggestions = async (): Promise<VoiceSuggestionsResponse> => {
  const response = await voiceHTTP.get<VoiceSuggestionsResponse>('/suggestions');
  return response.data;
};

/**
 * Get example voice commands
 */
export const getExamples = async (): Promise<VoiceExamplesResponse> => {
  const response = await voiceHTTP.get<VoiceExamplesResponse>('/commands/examples');
  return response.data;
};

/**
 * Voice API service
 */
export const voiceAPI = {
  processTextCommand,
  getSuggestions,
  getExamples
};

export default voiceHTTP;

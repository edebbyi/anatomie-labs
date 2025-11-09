// Simple test API for image generation without complex auth
const API_URL = import.meta.env.VITE_API_URL || 'https://3001-8b0db23c-efc9-4c0b-ba7a-028a4af13021.proxy.daytona.works/api';

export const testAPI = {
  // Login
  login: async (email, password) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    
    return await response.json();
  },

  // Generate images (simple endpoint without complex auth)
  generateImages: async (prompt, options = {}) => {
    const response = await fetch(`${API_URL}/test/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        count: options.count || 4,
        enforceBrandDNA: options.enforceBrandDNA || true,
        brandDNAStrength: options.brandDNAStrength || 0.8,
        creativity: options.creativity || 0.3
      }),
    });
    
    return await response.json();
  },

  // Get style profile (mock)
  getStyleProfile: async (userId) => {
    const response = await fetch(`${API_URL}/agents/style-profile/${userId}`);
    return await response.json();
  }
};

export default testAPI;
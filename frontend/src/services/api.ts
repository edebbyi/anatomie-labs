import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Generation APIs
export const generationAPI = {
  generate: async (data: {
    userId: string;
    description: string;
    model?: string;
    count?: number;
    vltAttributes?: any;
  }) => {
    const response = await api.post('/generate/generate', data);
    return response.data;
  },
  
  getStatus: async (jobId: string) => {
    const response = await api.get(`/generation/status/${jobId}`);
    return response.data;
  },
};

// Clustering APIs
export const clusteringAPI = {
  analyze: async (data: { batchId: string; k?: number }) => {
    const response = await api.post('/clusters/analyze', data);
    return response.data;
  },
  
  getResults: async (batchId: string) => {
    const response = await api.get(`/clusters/results/${batchId}`);
    return response.data;
  },
  
  findOptimalK: async (data: { batchId: string; minK?: number; maxK?: number }) => {
    const response = await api.post('/clusters/optimal-k', data);
    return response.data;
  },
};

// Diversity APIs
export const diversityAPI = {
  select: async (data: {
    batchId: string;
    targetCount: number;
    qualityWeight?: number;
  }) => {
    const response = await api.post('/diversity/select', data);
    return response.data;
  },
  
  analyze: async (data: { batchId: string }) => {
    const response = await api.post('/diversity/analyze', data);
    return response.data;
  },
  
  getResults: async (selectionId: string) => {
    const response = await api.get(`/diversity/results/${selectionId}`);
    return response.data;
  },
};

// Coverage APIs
export const coverageAPI = {
  analyze: async (data: { batchId: string; userId: string }) => {
    const response = await api.post('/coverage/analyze', data);
    return response.data;
  },
  
  getReport: async (reportId: string) => {
    const response = await api.get(`/coverage/report/${reportId}`);
    return response.data;
  },
  
  getGaps: async (params?: { severity?: string; status?: string }) => {
    const response = await api.get('/coverage/gaps', { params });
    return response.data;
  },
  
  adjustPrompt: async (data: { basePrompt: string; gapIds?: string[] }) => {
    const response = await api.post('/coverage/adjust-prompt', data);
    return response.data;
  },
  
  getTrends: async (userId: string, days?: number) => {
    const response = await api.get('/coverage/trends', {
      params: { userId, days },
    });
    return response.data;
  },
  
  getSummary: async (userId: string) => {
    const response = await api.get('/coverage/summary', {
      params: { userId },
    });
    return response.data;
  },
};

// Feedback APIs
export const feedbackAPI = {
  submit: async (data: {
    userId: string;
    imageId: string;
    feedbackType: 'positive' | 'negative' | 'neutral';
    userRating?: number;
    comments?: string;
    vltAttributes?: any;
  }) => {
    const response = await api.post('/feedback/submit', data);
    return response.data;
  },
  
  getHistory: async (userId: string, params?: { limit?: number; offset?: number }) => {
    const response = await api.get(`/feedback/history/${userId}`, { params });
    return response.data;
  },
  
  getOutliers: async (params?: { limit?: number; minConfidence?: number }) => {
    const response = await api.get('/feedback/outliers', { params });
    return response.data;
  },
  
  processLearning: async () => {
    const response = await api.post('/feedback/process-learning');
    return response.data;
  },
  
  getStyleProfiles: async (limit?: number) => {
    const response = await api.get('/feedback/style-profiles', {
      params: { limit },
    });
    return response.data;
  },
};

// Analytics APIs
export const analyticsAPI = {
  getDashboard: async (userId: string) => {
    const response = await api.get(`/analytics/dashboard/${userId}`);
    return response.data;
  },
  
  getStyleEvolution: async (userId: string) => {
    const response = await api.get(`/analytics/style-evolution/${userId}`);
    return response.data;
  },
  
  getClusterPerformance: async (userId: string) => {
    const response = await api.get(`/analytics/cluster-performance/${userId}`);
    return response.data;
  },
  
  getAttributeSuccess: async (userId?: string) => {
    const response = await api.get('/analytics/attribute-success', {
      params: { userId },
    });
    return response.data;
  },
  
  getRecommendations: async (userId: string) => {
    const response = await api.get(`/analytics/recommendations/${userId}`);
    return response.data;
  },
  
  getInsightsSummary: async (userId: string) => {
    const response = await api.get(`/analytics/insights-summary/${userId}`);
    return response.data;
  },
  
  clearCache: async () => {
    const response = await api.post('/analytics/clear-cache');
    return response.data;
  },
};

// Health check
export const healthCheck = async (service?: string) => {
  const endpoint = service ? `/${service}/health-check` : '/analytics/health-check';
  const response = await api.get(endpoint);
  return response.data;
};

export default api;

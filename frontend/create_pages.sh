#!/bin/bash

# Script to create remaining page components for ANATOMIE Designer BFF Frontend

echo "🎨 Creating remaining page components..."

# Create Generation.tsx
cat > src/pages/Generation.tsx << 'EOF'
import React, { useState } from 'react';
import { generationAPI, clusteringAPI, diversityAPI, coverageAPI } from '../services/api';
import { Upload, Sparkles, Loader } from 'lucide-react';

const Generation: React.FC = () => {
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<any[]>([]);
  const [model, setModel] = useState('stable-diffusion');
  const userId = 'anatomie-user';

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const generateResult = await generationAPI.generate({
        userId,
        description,
        model,
        count: 10,
      });

      const batchId = generateResult.data.batchId;
      await clusteringAPI.analyze({ batchId });
      
      const diversityResult = await diversityAPI.select({
        batchId,
        targetCount: 4,
        qualityWeight: 0.7,
      });

      await coverageAPI.analyze({ batchId, userId });
      setGeneratedImages(diversityResult.data.selectedImages || []);
    } catch (error) {
      console.error('Generation error:', error);
      alert('Generation failed. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Generate Images</h1>
        <p className="mt-2 text-sm text-gray-600">
          Create diverse fashion design variations with AI
        </p>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-anatomie-accent focus:border-anatomie-accent"
              placeholder="elegant minimalist dress with clean lines..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-anatomie-accent focus:border-anatomie-accent"
            >
              <option value="stable-diffusion">Stable Diffusion</option>
              <option value="dall-e">DALL-E</option>
              <option value="midjourney">Midjourney</option>
            </select>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !description}
            className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-anatomie-accent hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Images
              </>
            )}
          </button>
        </div>
      </div>

      {generatedImages.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Generated Images
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {generatedImages.map((img, index) => (
              <div key={index} className="relative group">
                <img
                  src={img.url}
                  alt={`Generated ${index + 1}`}
                  className="w-full h-64 object-cover rounded-lg"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Generation;
EOF

echo "✅ Created Generation.tsx"

# Create Analytics.tsx
cat > src/pages/Analytics.tsx << 'EOF'
import React, { useState, useEffect } from 'react';
import { analyticsAPI } from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Award } from 'lucide-react';

const Analytics: React.FC = () => {
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const userId = 'anatomie-user';

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const data = await analyticsAPI.getDashboard(userId);
      setDashboard(data.data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-anatomie-accent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics & Insights</h1>
        <p className="mt-2 text-sm text-gray-600">
          Track your design performance and style evolution
        </p>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          <TrendingUp className="inline mr-2 h-5 w-5" />
          Style Evolution (90 Days)
        </h3>
        {dashboard?.styleEvolution?.weeklyData && (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dashboard.styleEvolution.weeklyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="outlierRate" stroke="#6366f1" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          <Award className="inline mr-2 h-5 w-5" />
          Top Performing Attributes
        </h3>
        <div className="space-y-3">
          {dashboard?.attributeSuccess?.topPerformers?.slice(0, 5).map((attr: any, index: number) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">{attr.value}</p>
                <p className="text-sm text-gray-500">{attr.attribute}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-green-600">{attr.outlierRate.toFixed(1)}%</p>
                <p className="text-xs text-gray-500">{attr.totalOccurrences} uses</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Analytics;
EOF

echo "✅ Created Analytics.tsx"

# Create Coverage.tsx
cat > src/pages/Coverage.tsx << 'EOF'
import React, { useState, useEffect } from 'react';
import { coverageAPI } from '../services/api';
import { Target, AlertTriangle, CheckCircle } from 'lucide-react';

const Coverage: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const [gaps, setGaps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = 'anatomie-user';

  useEffect(() => {
    loadCoverage();
  }, []);

  const loadCoverage = async () => {
    setLoading(true);
    try {
      const [summaryData, gapsData] = await Promise.all([
        coverageAPI.getSummary(userId),
        coverageAPI.getGaps({ status: 'open' }),
      ]);

      setSummary(summaryData.data);
      setGaps(gapsData.data || []);
    } catch (error) {
      console.error('Error loading coverage:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-anatomie-accent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Coverage Analysis</h1>
        <p className="mt-2 text-sm text-gray-600">
          Track VLT attribute coverage and identify gaps
        </p>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Overall Coverage</h3>
            <p className="text-3xl font-bold text-anatomie-accent mt-2">
              {summary?.overallCoverage || 0}%
            </p>
          </div>
          <Target className="h-16 w-16 text-anatomie-accent opacity-50" />
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          <AlertTriangle className="inline mr-2 h-5 w-5 text-yellow-600" />
          Coverage Gaps ({gaps.length})
        </h3>
        <div className="space-y-3">
          {gaps.map((gap, index) => (
            <div key={index} className="flex items-start p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900">
                    {gap.attribute_name}: {gap.attribute_value}
                  </p>
                  <span className={`px-2 py-1 text-xs rounded-full ${getSeverityColor(gap.severity)}`}>
                    {gap.severity}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Current: {gap.current_coverage}% | Target: {gap.target_coverage}%
                </p>
              </div>
            </div>
          ))}
          {gaps.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-2" />
              <p>No coverage gaps detected!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Coverage;
EOF

echo "✅ Created Coverage.tsx"

# Create Feedback.tsx
cat > src/pages/Feedback.tsx << 'EOF'
import React, { useState, useEffect } from 'react';
import { feedbackAPI } from '../services/api';
import { ThumbsUp, ThumbsDown, MessageSquare, Star } from 'lucide-react';

const Feedback: React.FC = () => {
  const [history, setHistory] = useState<any[]>([]);
  const [outliers, setOutliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = 'anatomie-user';

  useEffect(() => {
    loadFeedback();
  }, []);

  const loadFeedback = async () => {
    setLoading(true);
    try {
      const [historyData, outliersData] = await Promise.all([
        feedbackAPI.getHistory(userId, { limit: 10 }),
        feedbackAPI.getOutliers({ limit: 5, minConfidence: 0.75 }),
      ]);

      setHistory(historyData.data || []);
      setOutliers(outliersData.data || []);
    } catch (error) {
      console.error('Error loading feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFeedbackIcon = (type: string) => {
    switch (type) {
      case 'positive':
        return <ThumbsUp className="h-5 w-5 text-green-600" />;
      case 'negative':
        return <ThumbsDown className="h-5 w-5 text-red-600" />;
      default:
        return <MessageSquare className="h-5 w-5 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-anatomie-accent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">User Feedback</h1>
        <p className="mt-2 text-sm text-gray-600">
          Track feedback and exceptional generations
        </p>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          <Star className="inline mr-2 h-5 w-5 text-yellow-500" />
          Exceptional Generations
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {outliers.map((outlier, index) => (
            <div key={index} className="relative">
              <img
                src={outlier.image_url}
                alt={`Outlier ${index + 1}`}
                className="w-full h-48 object-cover rounded-lg"
              />
              <div className="mt-2 text-center">
                <p className="text-sm font-medium text-gray-900">
                  Score: {outlier.clip_score?.toFixed(2)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Recent Feedback
        </h3>
        <div className="space-y-3">
          {history.map((item, index) => (
            <div key={index} className="flex items-start p-4 bg-gray-50 rounded-lg">
              <div className="flex-shrink-0 mt-1">
                {getFeedbackIcon(item.feedback_type)}
              </div>
              <div className="ml-3 flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900">
                    {item.feedback_type.charAt(0).toUpperCase() + item.feedback_type.slice(1)}
                  </p>
                  <span className="text-sm text-gray-500">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>
                {item.comments && (
                  <p className="text-sm text-gray-600 mt-1">{item.comments}</p>
                )}
                {item.user_rating && (
                  <div className="flex items-center mt-2">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i < item.user_rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Feedback;
EOF

echo "✅ Created Feedback.tsx"

# Create .env file
cat > .env << 'EOF'
REACT_APP_API_URL=http://localhost:3000/api
PORT=3001
EOF

echo "✅ Created .env file"

echo ""
echo "🎉 All page components created successfully!"
echo ""
echo "Next steps:"
echo "1. cd /Users/esosaimafidon/Documents/GitHub/anatomie-lab/frontend"
echo "2. npm start"
echo "3. Open http://localhost:3001 in your browser"
echo ""
echo "Make sure your backend is running on port 3000!"

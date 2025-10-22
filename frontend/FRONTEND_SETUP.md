# ANATOMIE Designer BFF - Frontend Setup Guide

## 🎨 Overview

A modern React + TypeScript frontend for the Designer BFF Pipeline with:
- Image generation and upload interface
- Real-time analytics dashboard
- Coverage and diversity visualization
- User feedback system
- Responsive design with Tailwind CSS

---

## ✅ Current Status

### Completed:
- [x] React + TypeScript setup
- [x] Tailwind CSS configuration
- [x] Routing with React Router
- [x] API client service (all 11 stages)
- [x] Layout component with navigation
- [x] Dashboard page

### Remaining Pages (Templates Provided Below):
- [ ] Generation page
- [ ] Analytics page
- [ ] Coverage page
- [ ] Feedback page

---

## 🚀 Quick Start

```bash
# Navigate to frontend directory
cd /Users/esosaimafidon/Documents/GitHub/anatomie-lab/frontend

# Install dependencies (already done)
npm install

# Create environment file
echo "REACT_APP_API_URL=http://localhost:3000/api" > .env

# Start development server
npm start
```

The app will open at `http://localhost:3001` (to avoid conflict with backend on port 3000).

---

## 📁 Project Structure

```
frontend/
├── public/
├── src/
│   ├── components/
│   │   └── Layout.tsx          ✅ Complete
│   ├── pages/
│   │   ├── Dashboard.tsx       ✅ Complete
│   │   ├── Generation.tsx      ⏳ Create from template below
│   │   ├── Analytics.tsx       ⏳ Create from template below
│   │   ├── Coverage.tsx        ⏳ Create from template below
│   │   └── Feedback.tsx        ⏳ Create from template below
│   ├── services/
│   │   └── api.ts              ✅ Complete
│   ├── App.tsx                 ✅ Complete
│   ├── index.tsx
│   └── index.css               ✅ Complete
├── tailwind.config.js          ✅ Complete
├── postcss.config.js           ✅ Complete
└── package.json
```

---

## 🎨 Page Templates

### 1. Generation Page (`src/pages/Generation.tsx`)

```typescript
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
      // Step 1: Generate images
      const generateResult = await generationAPI.generate({
        userId,
        description,
        model,
        count: 10, // Over-generate
      });

      const batchId = generateResult.data.batchId;

      // Step 2: Cluster
      await clusteringAPI.analyze({ batchId });

      // Step 3: Select diverse subset
      const diversityResult = await diversityAPI.select({
        batchId,
        targetCount: 4,
        qualityWeight: 0.7,
      });

      // Step 4: Analyze coverage
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

      {/* Generation Form */}
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
              placeholder="elegant minimalist dress with clean lines and modern silhouette..."
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

      {/* Results */}
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
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all rounded-lg flex items-center justify-center">
                  <button className="opacity-0 group-hover:opacity-100 px-4 py-2 bg-white text-sm rounded-md">
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Generation;
```

### 2. Analytics Page (`src/pages/Analytics.tsx`)

```typescript
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

      {/* Style Evolution Chart */}
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

      {/* Top Performers */}
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

      {/* Recommendations */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Personalized Recommendations
        </h3>
        <div className="space-y-3">
          {dashboard?.recommendations?.map((rec: any, index: number) => (
            <div key={index} className="p-4 bg-blue-50 border-l-4 border-blue-400 rounded">
              <p className="font-medium text-gray-900">{rec.message}</p>
              <p className="text-sm text-gray-600 mt-1">
                Type: {rec.type} | Priority: {rec.priority}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Analytics;
```

### 3. Coverage Page (`src/pages/Coverage.tsx`)

```typescript
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

      {/* Coverage Score */}
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

      {/* Gaps */}
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
              <p>No coverage gaps detected! All attributes meeting targets.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Coverage;
```

### 4. Feedback Page (`src/pages/Feedback.tsx`)

```typescript
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

      {/* Outliers */}
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

      {/* Feedback History */}
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
```

---

## 🔧 Creating Remaining Files

Run these commands to create the remaining page files:

```bash
cd /Users/esosaimafidon/Documents/GitHub/anatomie-lab/frontend/src/pages

# Copy templates from this guide into each file
# Or use the provided code to create them programmatically
```

---

## 🎨 Customization

### Colors
Edit `tailwind.config.js` to match ANATOMIE branding:

```javascript
colors: {
  anatomie: {
    primary: '#1a1a1a',      // Your brand black
    secondary: '#f5f5f5',     // Your brand light
    accent: '#6366f1',        // Adjust to your accent color
  }
}
```

### Logo
Add your logo to `/public` and update `Layout.tsx`.

---

## 🧪 Testing

```bash
# Run tests
npm test

# Build for production
npm run build

# Preview production build
npm install -g serve
serve -s build
```

---

## 📱 Features

### Completed:
✅ Modern UI with Tailwind CSS
✅ Responsive design
✅ Dark/light theme support
✅ Complete API integration
✅ Real-time data loading
✅ Error handling

### To Add:
- Image upload component
- Real-time generation progress
- Advanced filtering
- Export functionality
- User authentication

---

## 🚀 Deployment

### Option 1: Netlify
```bash
npm run build
# Drag build folder to netlify.com
```

### Option 2: Vercel
```bash
npm install -g vercel
vercel
```

### Option 3: Docker
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npx", "serve", "-s", "build", "-l", "3001"]
```

---

## 🔗 Integration with Backend

Make sure your backend is running:

```bash
# In backend directory
cd /Users/esosaimafidon/Documents/GitHub/anatomie-lab
npm start
```

Backend should be accessible at `http://localhost:3000`.

---

## 📝 Next Steps

1. Create remaining page components using templates above
2. Test with real ANATOMIE images
3. Customize branding/colors
4. Add authentication
5. Deploy to production

---

## 💡 Tips

- Use Chrome DevTools for debugging
- Check Network tab for API errors
- Monitor console for React errors
- Test on mobile devices
- Use React DevTools extension

---

**Version:** 1.0.0
**Last Updated:** January 2024

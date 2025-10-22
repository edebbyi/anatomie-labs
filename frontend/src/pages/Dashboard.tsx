import React, { useState, useEffect } from 'react';
import { analyticsAPI, coverageAPI } from '../services/api';
import {
  TrendingUp,
  Target,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Activity,
} from 'lucide-react';

interface DashboardStats {
  totalGenerations: number;
  outlierRate: number;
  coverageScore: number;
  activeGaps: number;
  healthScore: number;
  healthRating: string;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalGenerations: 0,
    outlierRate: 0,
    coverageScore: 0,
    activeGaps: 0,
    healthScore: 0,
    healthRating: 'good',
  });
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = 'anatomie-user'; // In production, this would come from auth

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load analytics summary
      const analyticsData = await analyticsAPI.getInsightsSummary(userId);
      
      // Load coverage summary
      const coverageData = await coverageAPI.getSummary(userId);
      
      // Load recommendations
      const recsData = await analyticsAPI.getRecommendations(userId);

      // Calculate stats
      setStats({
        totalGenerations: analyticsData.data?.dataPoints || 0,
        outlierRate: analyticsData.data?.bestProfile?.outlierRate || 0,
        coverageScore: coverageData.data?.overallCoverage || 0,
        activeGaps: coverageData.data?.activeGaps || 0,
        healthScore: 75, // Would come from analytics
        healthRating: 'good',
      });

      setRecommendations(recsData.data?.recommendations || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (rating: string) => {
    switch (rating) {
      case 'excellent':
        return 'text-green-600';
      case 'good':
        return 'text-blue-600';
      case 'fair':
        return 'text-yellow-600';
      default:
        return 'text-red-600';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
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
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          Welcome to the ANATOMIE Designer BFF Pipeline
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* Health Score */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Activity className={`h-6 w-6 ${getHealthColor(stats.healthRating)}`} />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Health Score
                  </dt>
                  <dd className="flex items-baseline">
                    <div className={`text-2xl font-semibold ${getHealthColor(stats.healthRating)}`}>
                      {stats.healthScore}/100
                    </div>
                    <div className="ml-2 flex items-baseline text-sm font-semibold text-green-600">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Outlier Rate */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Sparkles className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Outlier Rate
                  </dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">
                      {stats.outlierRate}%
                    </div>
                    <div className="ml-2 text-sm text-gray-600">
                      success rate
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Coverage Score */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Target className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Coverage Score
                  </dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">
                      {stats.coverageScore}%
                    </div>
                    <div className="ml-2 text-sm text-gray-600">
                      {stats.activeGaps} gaps
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Personalized Recommendations
          </h3>
          <div className="mt-5 space-y-4">
            {recommendations.length > 0 ? (
              recommendations.map((rec, index) => (
                <div
                  key={index}
                  className="flex items-start p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex-shrink-0">
                    {rec.priority === 'high' ? (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    ) : (
                      <CheckCircle className="h-5 w-5 text-blue-600" />
                    )}
                  </div>
                  <div className="ml-3 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">
                        {rec.message}
                      </p>
                      <span
                        className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(
                          rec.priority
                        )}`}
                      >
                        {rec.priority}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      Type: {rec.type} | Confidence: {rec.confidence}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">
                No recommendations available. Generate some images to get started!
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <button
              onClick={() => (window.location.href = '/generation')}
              className="flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-anatomie-accent hover:bg-indigo-700"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Generate Images
            </button>
            <button
              onClick={() => (window.location.href = '/analytics')}
              className="flex items-center justify-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <Activity className="mr-2 h-4 w-4" />
              View Analytics
            </button>
            <button
              onClick={() => (window.location.href = '/coverage')}
              className="flex items-center justify-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <Target className="mr-2 h-4 w-4" />
              Check Coverage
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

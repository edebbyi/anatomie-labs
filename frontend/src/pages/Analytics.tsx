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

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

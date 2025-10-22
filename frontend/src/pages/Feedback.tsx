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

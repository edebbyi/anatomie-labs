import React, { useState } from 'react';
import { Heart, ThumbsDown, Star, MessageCircle, Brain, TrendingUp } from 'lucide-react';
import { feedbackAPI } from '../services/agentsAPI';

interface FeedbackProps {
  imageId?: string;
  imageUrl?: string;
  prompt?: string;
  designerId?: string;
  onFeedbackSubmitted?: (feedback: any) => void;
}

const AgentsFeedback: React.FC<FeedbackProps> = ({
  imageId = 'demo-image-001',
  imageUrl = 'https://via.placeholder.com/300x300?text=Demo+Fashion+Design',
  prompt = 'A modern minimalist dress design in neutral tones',
  designerId = 'demo-designer-001',
  onFeedbackSubmitted
}) => {
  const [showDetailedFeedback, setShowDetailedFeedback] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  
  // Simple feedback state
  const [simpleAction, setSimpleAction] = useState<'like' | 'dislike' | 'love' | null>(null);
  
  // Detailed feedback state
  const [ratings, setRatings] = useState({
    overall: 0,
    color: 0,
    silhouette: 0,
    material: 0,
    aesthetic: 0
  });
  const [comments, setComments] = useState('');

  const handleSimpleFeedback = async (action: 'like' | 'dislike' | 'love') => {
    setIsSubmitting(true);
    try {
      const result = await feedbackAPI.submitSimple(
        imageId,
        designerId,
        action,
        comments || undefined
      );
      
      setSimpleAction(action);
      setFeedbackSubmitted(true);
      
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted(result);
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDetailedFeedback = async () => {
    if (Object.values(ratings).every(r => r === 0)) {
      alert('Please provide at least one rating');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await feedbackAPI.submitRating(
        imageId,
        designerId,
        ratings,
        comments || undefined
      );
      
      setFeedbackSubmitted(true);
      
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted(result);
      }
    } catch (error) {
      console.error('Error submitting detailed feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const StarRating: React.FC<{ 
    value: number; 
    onChange: (value: number) => void; 
    label: string 
  }> = ({ value, onChange, label }) => (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-sm font-medium w-20">{label}:</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => onChange(star)}
            className={`w-6 h-6 ${
              star <= value ? 'text-yellow-400' : 'text-gray-300'
            } hover:text-yellow-400 transition-colors`}
          >
            <Star className="w-full h-full fill-current" />
          </button>
        ))}
      </div>
    </div>
  );

  if (feedbackSubmitted) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Brain className="w-5 h-5 text-green-600" />
          <span className="font-medium text-green-800">Feedback Submitted!</span>
        </div>
        <p className="text-green-700 text-sm">
          Thank you! The Quality Curator agent will use your feedback to improve future generations.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg p-4">
      {/* Image Preview */}
      <div className="flex gap-4 mb-4">
        <img
          src={imageUrl}
          alt={prompt}
          className="w-20 h-20 object-cover rounded-lg"
        />
        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-2">{prompt}</p>
          <p className="text-xs text-gray-500">Help the AI learn your preferences</p>
        </div>
      </div>

      {!showDetailedFeedback ? (
        /* Simple Feedback */
        <div>
          <p className="text-sm font-medium mb-3">How do you feel about this image?</p>
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => handleSimpleFeedback('love')}
              disabled={isSubmitting}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                simpleAction === 'love' 
                  ? 'bg-red-100 text-red-700 border border-red-200' 
                  : 'bg-gray-100 hover:bg-red-50 text-gray-700'
              }`}
            >
              <Heart className="w-4 h-4" />
              Love it
            </button>
            
            <button
              onClick={() => handleSimpleFeedback('like')}
              disabled={isSubmitting}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                simpleAction === 'like' 
                  ? 'bg-green-100 text-green-700 border border-green-200' 
                  : 'bg-gray-100 hover:bg-green-50 text-gray-700'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Like it
            </button>
            
            <button
              onClick={() => handleSimpleFeedback('dislike')}
              disabled={isSubmitting}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                simpleAction === 'dislike' 
                  ? 'bg-red-100 text-red-700 border border-red-200' 
                  : 'bg-gray-100 hover:bg-red-50 text-gray-700'
              }`}
            >
              <ThumbsDown className="w-4 h-4" />
              Don't like
            </button>
          </div>

          <div className="mb-4">
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Optional: Add specific comments about what you like or dislike..."
              className="w-full p-2 border rounded-lg text-sm h-16 resize-none"
            />
          </div>

          <button
            onClick={() => setShowDetailedFeedback(true)}
            className="text-purple-600 hover:text-purple-800 text-sm underline"
          >
            Give detailed ratings instead
          </button>
        </div>
      ) : (
        /* Detailed Feedback */
        <div>
          <p className="text-sm font-medium mb-4">Rate different aspects:</p>
          
          <StarRating
            value={ratings.overall}
            onChange={(value) => setRatings(prev => ({ ...prev, overall: value }))}
            label="Overall"
          />
          
          <StarRating
            value={ratings.color}
            onChange={(value) => setRatings(prev => ({ ...prev, color: value }))}
            label="Color"
          />
          
          <StarRating
            value={ratings.silhouette}
            onChange={(value) => setRatings(prev => ({ ...prev, silhouette: value }))}
            label="Silhouette"
          />
          
          <StarRating
            value={ratings.material}
            onChange={(value) => setRatings(prev => ({ ...prev, material: value }))}
            label="Material"
          />
          
          <StarRating
            value={ratings.aesthetic}
            onChange={(value) => setRatings(prev => ({ ...prev, aesthetic: value }))}
            label="Aesthetic"
          />

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Comments:</label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="What specifically do you like or dislike? This helps the AI learn..."
              className="w-full p-2 border rounded-lg text-sm h-20 resize-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDetailedFeedback}
              disabled={isSubmitting}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-300"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Detailed Feedback'}
            </button>
            
            <button
              onClick={() => setShowDetailedFeedback(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Back to simple
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Batch Feedback Component for multiple images
export const BatchFeedback: React.FC<{
  images: Array<{
    id: string;
    url: string;
    prompt: string;
  }>;
  designerId: string;
  onComplete?: () => void;
}> = ({ images, designerId, onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [feedbackList, setFeedbackList] = useState<Array<any>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFeedbackSubmitted = (feedback: any) => {
    setFeedbackList(prev => [...prev, feedback]);
    
    if (currentIndex < images.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // All feedback collected, submit batch
      submitBatchFeedback();
    }
  };

  const submitBatchFeedback = async () => {
    setIsSubmitting(true);
    try {
      await feedbackAPI.submit(feedbackList);
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Error submitting batch feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (currentIndex >= images.length) {
    return (
      <div className="text-center p-8">
        <Brain className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold mb-2">All Feedback Submitted!</h3>
        <p className="text-gray-600">
          Thank you for helping the AI learn your preferences. 
          Future generations will be more aligned with your style.
        </p>
      </div>
    );
  }

  const currentImage = images[currentIndex];

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Rate Generated Images</h3>
          <span className="text-sm text-gray-500">
            {currentIndex + 1} of {images.length}
          </span>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
          <div 
            className="bg-purple-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / images.length) * 100}%` }}
          />
        </div>
      </div>

      <AgentsFeedback
        imageId={currentImage.id}
        imageUrl={currentImage.url}
        prompt={currentImage.prompt}
        designerId={designerId}
        onFeedbackSubmitted={handleFeedbackSubmitted}
      />
    </div>
  );
};

// Standalone feedback page for demo/testing
export const AgentsFeedbackPage: React.FC = () => {
  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Feedback System</h1>
        <p className="text-gray-600">
          Help train our AI by providing feedback on generated fashion designs.
          Your input helps the Quality Curator agent improve future generations.
        </p>
      </div>
      
      <div className="bg-gray-50 p-6 rounded-lg mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-600" />
          How it works
        </h2>
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-start gap-2">
            <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-bold">1</span>
            <span>View AI-generated fashion designs</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
            <span>Provide quick feedback or detailed ratings</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-bold">3</span>
            <span>AI learns your style preferences for future generations</span>
          </div>
        </div>
      </div>
      
      <AgentsFeedback />
    </div>
  );
};

export default AgentsFeedback;

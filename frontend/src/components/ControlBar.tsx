import React, { useState, useEffect } from 'react';
import { Settings, Clock } from 'lucide-react';

interface ControlBarProps {
  imageCount?: number;
  onSettingsClick?: () => void;
}

const ControlBar: React.FC<ControlBarProps> = ({ imageCount = 0, onSettingsClick }) => {
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [nextRunTime, setNextRunTime] = useState<string>('');

  useEffect(() => {
    // Calculate next run time (example: tomorrow at 11 PM)
    const now = new Date();
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    next.setHours(23, 0, 0, 0);

    const isToday = now.toDateString() === next.toDateString();
    const time = next.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    if (isToday) {
      setNextRunTime(`Today at ${time}`);
    } else {
      setNextRunTime(`Tomorrow at ${time}`);
    }
  }, []);

  const handleAutoGenerateToggle = () => {
    setAutoGenerate(!autoGenerate);
    // TODO: Call API to save preference
  };

  return (
    <header className="sticky top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          {/* Left Section */}
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
              Your Generations
            </h1>
            <span className="text-sm sm:text-base text-gray-600">
              {imageCount} {imageCount === 1 ? 'image' : 'images'}
            </span>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Auto-Generate Toggle */}
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-1">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={autoGenerate}
                    onChange={handleAutoGenerateToggle}
                    className="w-5 h-5 rounded cursor-pointer"
                  />
                  <span className="hidden sm:inline">Auto-generate</span>
                </label>
                {autoGenerate && (
                  <span className="text-xs text-gray-500 flex items-center gap-1 ml-7">
                    <Clock className="w-3 h-3" />
                    Next: {nextRunTime}
                  </span>
                )}
              </div>
            </div>

            {/* Settings Button */}
            <button
              onClick={onSettingsClick}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default ControlBar;


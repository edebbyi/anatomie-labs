import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, Sparkles, X, Lightbulb } from 'lucide-react';
import { voiceAPI } from '../services/voiceAPI';

interface CommandBarProps {
  onCommandExecute: (command: string) => void;
  highlightSuggestions?: boolean; // New prop to control highlighting
}

interface CommandConfirmation {
  command: string;
  parsedIntent: {
    action: string;
    count?: number;
    item?: string;
    details?: string;
  };
}

interface VoiceSuggestion {
  type: string;
  priority: number;
  prompt: string;
  command: string;
  reasoning: string;
  metadata?: any;
}

const CommandBar: React.FC<CommandBarProps> = ({ onCommandExecute, highlightSuggestions = false }) => {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<CommandConfirmation | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [suggestions, setSuggestions] = useState<VoiceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [shouldHighlight, setShouldHighlight] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [showFAB, setShowFAB] = useState(false);
  const recognitionRef = useRef<any>(null);
  const suggestionsContainerRef = useRef<HTMLDivElement>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollRef = useRef(0);

  useEffect(() => {
    // Initialize speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    // Load suggestions
    loadSuggestions();

    // Handle scroll events for auto-hide
    const handleScroll = () => {
      const currentScroll = window.scrollY;
      const isScrollingDown = currentScroll > lastScrollRef.current;
      lastScrollRef.current = currentScroll;

      if (isScrollingDown && currentScroll > 100) {
        setIsVisible(false);
        setShowFAB(true);
      } else {
        setIsVisible(true);
        setShowFAB(false);
      }

      // Clear existing timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }

      // Auto-hide after 3 seconds of inactivity
      hideTimeoutRef.current = setTimeout(() => {
        if (currentScroll > 100) {
          setIsVisible(false);
          setShowFAB(true);
        }
      }, 3000);
    };

    // Handle keyboard shortcut (/)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !input) {
        e.preventDefault();
        setIsVisible(true);
        setShowFAB(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [input]);

  // Effect to handle highlighting when requested
  useEffect(() => {
    if (highlightSuggestions) {
      setShouldHighlight(true);
      
      // Clear any existing timeout
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
      
      // Set a timeout to automatically stop highlighting after 60 seconds
      highlightTimeoutRef.current = setTimeout(() => {
        setShouldHighlight(false);
        highlightTimeoutRef.current = null;
      }, 60000); // 60 seconds
      
      return () => {
        if (highlightTimeoutRef.current) {
          clearTimeout(highlightTimeoutRef.current);
        }
      };
    }
  }, [highlightSuggestions]);

  const loadSuggestions = async () => {
    try {
      const response = await voiceAPI.getSuggestions();
      setSuggestions(response.data.slice(0, 6)); // Limit to 6 suggestions
    } catch (error) {
      console.error('Failed to load suggestions:', error);
      // Fallback to example suggestions
      setSuggestions([
        {
          type: 'exploratory',
          priority: 0.9,
          prompt: 'Show me dresses',
          command: 'show me dresses',
          reasoning: 'Browse your dress collection'
        },
        {
          type: 'exploratory',
          priority: 0.8,
          prompt: 'Take me to playground',
          command: 'take me to playground',
          reasoning: 'Go to the design playground'
        },
        {
          type: 'generative',
          priority: 0.7,
          prompt: 'Make me 50 travel outfits',
          command: 'make me 50 travel outfits',
          reasoning: 'Generate travel-inspired designs'
        }
      ]);
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in your browser');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const parseCommand = (cmd: string): CommandConfirmation => {
    const lowerCmd = cmd.toLowerCase().trim();
    
    // Parse "make X items" or "generate X items"
    const makeMatch = lowerCmd.match(/(make|generate|create)\s+(\d+)\s+(.*)/);
    if (makeMatch) {
      const count = parseInt(makeMatch[2]);
      const item = makeMatch[3];
      return {
        command: cmd,
        parsedIntent: {
          action: 'generate',
          count,
          item,
          details: `Generate ${count} ${item}`,
        },
      };
    }

    // Parse "show X" or "filter by X"
    const showMatch = lowerCmd.match(/(show|filter|display)\s+(.*)/);
    if (showMatch) {
      return {
        command: cmd,
        parsedIntent: {
          action: 'filter',
          item: showMatch[2],
          details: `Filter gallery to show ${showMatch[2]}`,
        },
      };
    }

    // Parse "delete X" or "remove X"
    const deleteMatch = lowerCmd.match(/(delete|remove)\s+(.*)/);
    if (deleteMatch) {
      return {
        command: cmd,
        parsedIntent: {
          action: 'delete',
          item: deleteMatch[2],
          details: `Delete ${deleteMatch[2]}`,
        },
      };
    }

    // Default: treat as search/filter
    return {
      command: cmd,
      parsedIntent: {
        action: 'search',
        details: `Search for: ${cmd}`,
      },
    };
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;

    const parsed = parseCommand(input);
    setPendingCommand(parsed);
    setShowConfirmation(true);
  };

  const confirmCommand = () => {
    if (pendingCommand) {
      onCommandExecute(pendingCommand.command);
      setInput('');
      setPendingCommand(null);
      setShowConfirmation(false);
      setIsExpanded(false);
    }
  };

  const cancelCommand = () => {
    setPendingCommand(null);
    setShowConfirmation(false);
  };

  const handleSuggestionClick = (command: string) => {
    setInput(command);
    // Auto-submit the suggestion
    setTimeout(() => {
      const parsed = parseCommand(command);
      setPendingCommand(parsed);
      setShowConfirmation(true);
    }, 100);
    
    // Stop highlighting when user clicks on a suggestion
    setShouldHighlight(false);
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
  };

  const toggleSuggestions = () => {
    setShowSuggestions(!showSuggestions);
    if (!showSuggestions) {
      // Reload suggestions when opening
      loadSuggestions();
    }
    
    // Stop highlighting when user opens suggestions
    setShouldHighlight(false);
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
  };

  return (
    <>
      {/* Floating Command Bar - Fixed to bottom of viewport */}
      <div className={`fixed bottom-20 left-0 right-0 z-50 w-full px-4 sm:px-6 lg:px-8 transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}>
        <div className="max-w-2xl mx-auto">
          {/* Suggestions Panel */}
          {showSuggestions && (
            <div 
              ref={suggestionsContainerRef}
              className="mb-3 bg-white rounded-2xl shadow-lg border border-gray-200 max-h-60 overflow-y-auto"
            >
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-medium text-gray-900 flex items-center">
                  <Lightbulb className="h-4 w-4 mr-2 text-amber-500" />
                  AI Suggestions
                </h3>
                <button 
                  onClick={toggleSuggestions}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-2">
                {suggestions.length > 0 ? (
                  suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion.command)}
                      className="w-full text-left p-3 hover:bg-gray-50 rounded-lg transition-colors group"
                    >
                      <div className="font-medium text-gray-900 group-hover:text-podna-primary-600">
                        {suggestion.prompt}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {suggestion.reasoning}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    No suggestions available
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-airbnb-card hover:shadow-airbnb-card-hover transition-all duration-300 border border-gray-200">
            <form onSubmit={handleSubmit} className="flex items-center gap-3 p-3">
              {/* Sparkles Icon - Highlighted when shouldHighlight is true */}
              <button
                type="button"
                onClick={toggleSuggestions}
                className={`p-2 rounded-xl transition-all duration-300 ${
                  shouldHighlight 
                    ? 'bg-yellow-400 text-yellow-900 animate-highlight-pulse ring-4 ring-yellow-200' 
                    : 'bg-podna-primary-100 text-podna-primary-600 hover:bg-podna-primary-200'
                }`}
              >
                <Sparkles className={`h-5 w-5 ${shouldHighlight ? 'animate-highlight-bounce' : ''}`} />
              </button>

              {/* Text Input */}
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Say or type a command..."
                className="flex-1 px-4 py-3 focus:outline-none text-gray-900 placeholder-gray-400 bg-transparent"
              />

              {/* Mic Button */}
              <button
                type="button"
                onClick={toggleListening}
                className={`p-3 rounded-xl transition-all duration-200 ${
                  isListening
                    ? 'bg-podna-primary-600 text-white shadow-md'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {isListening ? (
                  <MicOff className="h-5 w-5 animate-pulse" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </button>

              {/* Send Button */}
              <button
                type="submit"
                disabled={!input.trim()}
                className="p-3 bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <Send className="h-5 w-5" />
              </button>
            </form>

          </div>

          {/* Listening Indicator */}
          {isListening && (
            <div className="mt-3 text-center animate-fade-in">
              <p className="text-sm text-gray-700 bg-white rounded-xl px-4 py-2 inline-block shadow-md border border-gray-200">
                🎤 Listening...
              </p>
            </div>
          )}
        </div>
      </div>

      {/* FAB Button - Shows when command bar is hidden */}
      {showFAB && (
        <button
          onClick={() => {
            setIsVisible(true);
            setShowFAB(false);
          }}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-podna-primary-600 text-white rounded-full shadow-lg hover:shadow-xl hover:bg-podna-primary-700 transition-all duration-200 flex items-center justify-center animate-fade-in"
          aria-label="Show command bar"
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}

      {/* Confirmation Modal */}
      {showConfirmation && pendingCommand && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-medium text-gray-900">Confirm Command</h3>
              <button onClick={cancelCommand} className="text-gray-400 hover:text-gray-600 rounded-lg p-1 hover:bg-gray-100 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100">
              <p className="text-sm text-gray-600 mb-2">Your command:</p>
              <p className="text-lg font-medium text-gray-900">"{pendingCommand.command}"</p>
              <p className="text-sm text-gray-600 mt-3">{pendingCommand.parsedIntent.details}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={cancelCommand}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmCommand}
                className="flex-1 px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CommandBar;
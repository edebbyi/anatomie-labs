import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, Sparkles, X, Lightbulb } from 'lucide-react';
import { voiceAPI } from '../services/voiceAPI';

interface CommandBarProps {
  onCommandExecute: (command: string) => void;
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

const CommandBar: React.FC<CommandBarProps> = ({ onCommandExecute }) => {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<CommandConfirmation | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [suggestions, setSuggestions] = useState<VoiceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const recognitionRef = useRef<any>(null);
  const suggestionsContainerRef = useRef<HTMLDivElement>(null);

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

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

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
  };

  const toggleSuggestions = () => {
    setShowSuggestions(!showSuggestions);
    if (!showSuggestions) {
      // Reload suggestions when opening
      loadSuggestions();
    }
  };

  return (
    <>
      {/* Floating Command Bar */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-2xl px-4">
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
            {/* Sparkles Icon */}
            <button
              type="button"
              onClick={toggleSuggestions}
              className="p-2 bg-podna-primary-100 text-podna-primary-600 rounded-xl hover:bg-podna-primary-200 transition-colors"
            >
              <Sparkles className="h-5 w-5" />
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
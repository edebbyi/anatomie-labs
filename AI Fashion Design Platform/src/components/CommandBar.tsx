import { Mic, ArrowRight, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Input } from './ui/input';
import { motion } from 'motion/react';

interface CommandBarProps {
  onCommand: (command: string) => void;
}

export function CommandBar({ onCommand }: CommandBarProps) {
  const [isActive, setIsActive] = useState(false);
  const [command, setCommand] = useState('');
  const [isListening, setIsListening] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (command.trim()) {
      onCommand(command);
      setCommand('');
      setIsActive(false);
    }
  };

  const handleVoiceClick = () => {
    setIsListening(!isListening);
    // In a real app, this would trigger Web Speech API
    setTimeout(() => {
      setIsListening(false);
    }, 2000);
  };

  return (
    <motion.div
      className="fixed bottom-6 right-6 z-50"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <form onSubmit={handleSubmit}>
        <motion.div
          className={`flex items-center gap-2 rounded-full shadow-2xl transition-all duration-300 border-2 ${
            isActive || isListening
              ? 'bg-[#6366f1] border-[#6366f1] shadow-[0_0_40px_rgba(99,102,241,0.5)]'
              : 'bg-white border-[#6366f1]'
          }`}
          animate={
            isActive || isListening
              ? {
                  boxShadow: [
                    '0 0 20px rgba(99,102,241,0.3)',
                    '0 0 40px rgba(99,102,241,0.5)',
                    '0 0 20px rgba(99,102,241,0.3)',
                  ],
                }
              : {}
          }
          transition={{ duration: 2, repeat: isActive || isListening ? Infinity : 0 }}
        >
          {/* Voice button */}
          <button
            type="button"
            onClick={handleVoiceClick}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
              isListening
                ? 'bg-white/20 text-white'
                : isActive
                ? 'bg-white/10 text-white hover:bg-white/20'
                : 'bg-[#6366f1] text-white hover:bg-[#4f46e5]'
            }`}
          >
            <motion.div
              animate={isListening ? { scale: [1, 1.2, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1 }}
            >
              <Mic className="w-6 h-6" />
            </motion.div>
          </button>

          {/* Text input */}
          <Input
            type="text"
            placeholder="Say or type a command..."
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onFocus={() => setIsActive(true)}
            onBlur={() => !command && setIsActive(false)}
            className={`transition-all duration-300 border-0 focus-visible:ring-0 text-base ${
              isActive || isListening
                ? 'w-80 md:w-96 text-white placeholder:text-white/80'
                : 'w-0 opacity-0'
            }`}
          />

          {/* Submit button */}
          {(isActive || command) && (
            <motion.button
              type="submit"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-12 h-12 rounded-full bg-white/20 text-white hover:bg-white/30 flex items-center justify-center mr-1 transition-all duration-200"
            >
              <ArrowRight className="w-6 h-6" />
            </motion.button>
          )}
        </motion.div>
      </form>

      {/* Enhanced Suggestions with Examples */}
      {isActive && !command && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-full mb-3 right-0 bg-white rounded-xl shadow-2xl p-4 w-96 border border-gray-200"
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-[#6366f1]" />
            <p className="text-sm text-gray-700">Try these commands:</p>
          </div>
          <div className="space-y-2">
            {[
              { cmd: 'make 50 elegant dresses', desc: 'Generate specific designs' },
              { cmd: 'generate minimalist blazers', desc: 'Create by style' },
              { cmd: 'show liked images', desc: 'Filter your collection' },
            ].map((suggestion, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setCommand(suggestion.cmd);
                  onCommand(suggestion.cmd);
                  setCommand('');
                  setIsActive(false);
                }}
                className="w-full text-left p-3 rounded-lg hover:bg-[#6366f1]/10 transition-colors group"
              >
                <p className="text-sm text-gray-900 group-hover:text-[#6366f1] transition-colors">
                  {suggestion.cmd}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{suggestion.desc}</p>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

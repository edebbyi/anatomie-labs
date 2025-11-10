import { motion } from 'motion/react';
import { Sparkles, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from './ui/card';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Button } from './ui/button';

interface AutoGenerateCardProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  batchSize: number;
  onBatchSizeChange: (size: number) => void;
}

export function AutoGenerateCard({
  enabled,
  onToggle,
  batchSize,
  onBatchSizeChange,
}: AutoGenerateCardProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const collapseTimerRef = useRef<number | null>(null);

  const handleSettingsClick = () => {
    navigate('/settings');
  };

  const clearCollapseTimer = () => {
    if (collapseTimerRef.current) {
      window.clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
  };

  const startAutoCollapse = () => {
    clearCollapseTimer();
    // Auto collapse after 6 seconds of inactivity
    collapseTimerRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 6000);
  };

  const onToggleClick = () => {
    const next = !enabled;
    onToggle(next);
    if (next) {
      setIsOpen(true);
      startAutoCollapse();
    } else {
      setIsOpen(false);
      clearCollapseTimer();
    }
  };

  useEffect(() => {
    return () => clearCollapseTimer();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
    >
      <Card className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] border-0 text-white overflow-hidden relative">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,black)]" />
        <CardContent className="p-4 sm:p-6 relative">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5" />
                <h3 className="text-base sm:text-lg truncate">Smart Auto-Generation</h3>
              </div>
              <p className="text-white/90 text-xs sm:text-sm mb-3 sm:mb-4 truncate">
                Automatically generate new designs when you've reviewed all images
              </p>

              <div className="space-y-2">
                <div className="flex items-center justify-between bg-white/10 rounded-full px-3 py-2 backdrop-blur-sm">
                  <Label htmlFor="auto-gen" className="text-white text-xs sm:text-sm cursor-pointer">
                    Enable auto-generation
                  </Label>
                  <button
                    id="auto-gen"
                    type="button"
                    aria-pressed={enabled}
                    onClick={onToggleClick}
                    className={`relative inline-flex items-center h-7 rounded-full px-2 transition-colors focus:outline-none focus:ring-2 focus:ring-white/40 ${
                      enabled ? 'bg-emerald-500' : 'bg-white/20'
                    }`}
                  >
                    <span className={`text-[10px] font-medium text-white transition-opacity ${enabled ? 'opacity-100' : 'opacity-50'}`}>
                      {enabled ? 'ON' : 'OFF'}
                    </span>
                  </button>
                </div>

                {enabled && (
                  <div className="bg-white/10 rounded-lg backdrop-blur-sm overflow-hidden">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-3 py-2 text-left text-white/90 hover:bg-white/10"
                      onClick={() => {
                        const next = !isOpen;
                        setIsOpen(next);
                        if (next) startAutoCollapse(); else clearCollapseTimer();
                      }}
                    >
                      <span className="text-xs sm:text-sm">Batch size</span>
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
                      transition={{ duration: 0.2 }}
                      onMouseEnter={clearCollapseTimer}
                      onMouseLeave={startAutoCollapse}
                      className="px-3 pb-3"
                    >
                      <Select
                        value={batchSize.toString()}
                        onValueChange={(v) => {
                          onBatchSizeChange(parseInt(v));
                          startAutoCollapse();
                        }}
                      >
                        <SelectTrigger id="batch-size" className="bg-white/20 border-white/30 text-white h-9 focus:ring-0 focus:outline-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#6f6ef6]/95 text-white border-white/20 backdrop-blur-md shadow-xl">
                          <SelectItem className="focus:bg-white/20 focus:text-white" value="5">5 images</SelectItem>
                          <SelectItem className="focus:bg-white/20 focus:text-white" value="25">25 images</SelectItem>
                          <SelectItem className="focus:bg-white/20 focus:text-white" value="50">50 images</SelectItem>
                          <SelectItem className="focus:bg-white/20 focus:text-white" value="100">100 images</SelectItem>
                        </SelectContent>
                      </Select>
                    </motion.div>
                  </div>
                )}
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 ml-2 sm:ml-4 shrink-0"
              onClick={handleSettingsClick}
              title="Open Settings"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

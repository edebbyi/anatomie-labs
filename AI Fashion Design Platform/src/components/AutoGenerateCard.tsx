import { motion } from 'motion/react';
import { Sparkles, Settings } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Switch } from './ui/switch';
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
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
    >
      <Card className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] border-0 text-white overflow-hidden relative">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,black)]" />
        <CardContent className="p-6 relative">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5" />
                <h3 className="text-lg">Smart Auto-Generation</h3>
              </div>
              <p className="text-white/90 text-sm mb-4">
                Automatically generate new designs when you've reviewed all images
              </p>

              <div className="space-y-4">
                <div className="flex items-center justify-between bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                  <Label htmlFor="auto-gen" className="text-white cursor-pointer">
                    Enable auto-generation
                  </Label>
                  <Switch
                    id="auto-gen"
                    checked={enabled}
                    onCheckedChange={onToggle}
                    className="data-[state=checked]:bg-white/30"
                  />
                </div>

                {enabled && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-white/10 rounded-lg p-3 backdrop-blur-sm"
                  >
                    <Label htmlFor="batch-size" className="text-white text-sm mb-2 block">
                      Batch size
                    </Label>
                    <Select
                      value={batchSize.toString()}
                      onValueChange={(v) => onBatchSizeChange(parseInt(v))}
                    >
                      <SelectTrigger
                        id="batch-size"
                        className="bg-white/20 border-white/30 text-white"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25">25 images</SelectItem>
                        <SelectItem value="50">50 images</SelectItem>
                        <SelectItem value="75">75 images</SelectItem>
                        <SelectItem value="100">100 images</SelectItem>
                      </SelectContent>
                    </Select>
                  </motion.div>
                )}
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 ml-4"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

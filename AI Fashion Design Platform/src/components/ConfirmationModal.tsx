import { Mic } from 'lucide-react';
import { motion } from 'motion/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';

interface ConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onExecute: () => void;
  userCommand: string;
  interpretation: {
    count: number;
    style?: string;
    garment?: string;
    estimatedTime: string;
  };
}

export function ConfirmationModal({
  open,
  onClose,
  onExecute,
  userCommand,
  interpretation,
}: ConfirmationModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-[#6366f1] flex items-center justify-center">
              <Mic className="w-5 h-5 text-white" />
            </div>
            Command Confirmation
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <p className="text-sm text-gray-500 mb-2">You said:</p>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-100 rounded-lg p-3"
            >
              <p className="text-gray-900">"{userCommand}"</p>
            </motion.div>
          </div>

          <div>
            <p className="text-sm text-gray-500 mb-2">I understood:</p>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-[#6366f1]/10 rounded-lg p-3 space-y-1"
            >
              <p className="text-sm">• Generate {interpretation.count} images</p>
              {interpretation.style && (
                <p className="text-sm">• Style: {interpretation.style}</p>
              )}
              {interpretation.garment && (
                <p className="text-sm">• Garment: {interpretation.garment}</p>
              )}
              <p className="text-sm">• Est. time: {interpretation.estimatedTime}</p>
            </motion.div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onExecute();
              onClose();
            }}
            className="bg-[#6366f1] text-white hover:bg-[#4f46e5]"
          >
            Execute →
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

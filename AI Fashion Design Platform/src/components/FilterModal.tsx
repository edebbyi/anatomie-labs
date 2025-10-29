import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Separator } from './ui/separator';

interface FilterModalProps {
  open: boolean;
  onClose: () => void;
  availableTags: string[];
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
  onClearAll: () => void;
}

export function FilterModal({
  open,
  onClose,
  availableTags,
  selectedTags,
  onTagToggle,
  onClearAll,
}: FilterModalProps) {
  // Categorize tags (mock categorization based on common fashion terms)
  const categorize = (tag: string) => {
    const styles = ['elegant', 'minimalist', 'casual', 'modern', 'contemporary', 'sporty', 'luxury', 'designer'];
    const garments = ['dress', 'blazer', 'suit', 'top', 'gown', 'ensemble'];
    const descriptors = ['formal', 'professional', 'tailored', 'flowing', 'fitted', 'dramatic'];
    
    if (styles.some(s => tag.toLowerCase().includes(s))) return 'style';
    if (garments.some(g => tag.toLowerCase().includes(g))) return 'garment';
    if (descriptors.some(d => tag.toLowerCase().includes(d))) return 'descriptor';
    return 'other';
  };

  const categories = {
    style: availableTags.filter(t => categorize(t) === 'style'),
    garment: availableTags.filter(t => categorize(t) === 'garment'),
    descriptor: availableTags.filter(t => categorize(t) === 'descriptor'),
    other: availableTags.filter(t => categorize(t) === 'other'),
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Filter Gallery</DialogTitle>
          <DialogDescription>
            Select tags to filter your design collection
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Selected Tags */}
          {selectedTags.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-700">Selected Filters</p>
                <Button variant="ghost" size="sm" onClick={onClearAll}>
                  Clear All
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedTags.map((tag) => (
                  <Badge
                    key={tag}
                    className="bg-[#6366f1] text-white hover:bg-[#4f46e5] cursor-pointer px-3 py-1.5"
                    onClick={() => onTagToggle(tag)}
                  >
                    {tag}
                    <X className="w-3 h-3 ml-1.5" />
                  </Badge>
                ))}
              </div>
              <Separator className="mt-4" />
            </div>
          )}

          {/* Style Tags */}
          {categories.style.length > 0 && (
            <div>
              <p className="text-sm text-gray-700 mb-3">Style</p>
              <div className="flex flex-wrap gap-2">
                {categories.style.map((tag) => (
                  <Badge
                    key={tag}
                    variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                    className={`cursor-pointer px-3 py-1.5 transition-all ${
                      selectedTags.includes(tag)
                        ? 'bg-[#6366f1] text-white hover:bg-[#4f46e5]'
                        : 'hover:bg-gray-100'
                    }`}
                    onClick={() => onTagToggle(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Garment Tags */}
          {categories.garment.length > 0 && (
            <div>
              <p className="text-sm text-gray-700 mb-3">Garment Type</p>
              <div className="flex flex-wrap gap-2">
                {categories.garment.map((tag) => (
                  <Badge
                    key={tag}
                    variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                    className={`cursor-pointer px-3 py-1.5 transition-all ${
                      selectedTags.includes(tag)
                        ? 'bg-[#6366f1] text-white hover:bg-[#4f46e5]'
                        : 'hover:bg-gray-100'
                    }`}
                    onClick={() => onTagToggle(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Descriptor Tags */}
          {categories.descriptor.length > 0 && (
            <div>
              <p className="text-sm text-gray-700 mb-3">Descriptors</p>
              <div className="flex flex-wrap gap-2">
                {categories.descriptor.map((tag) => (
                  <Badge
                    key={tag}
                    variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                    className={`cursor-pointer px-3 py-1.5 transition-all ${
                      selectedTags.includes(tag)
                        ? 'bg-[#6366f1] text-white hover:bg-[#4f46e5]'
                        : 'hover:bg-gray-100'
                    }`}
                    onClick={() => onTagToggle(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Other Tags */}
          {categories.other.length > 0 && (
            <div>
              <p className="text-sm text-gray-700 mb-3">Other</p>
              <div className="flex flex-wrap gap-2">
                {categories.other.map((tag) => (
                  <Badge
                    key={tag}
                    variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                    className={`cursor-pointer px-3 py-1.5 transition-all ${
                      selectedTags.includes(tag)
                        ? 'bg-[#6366f1] text-white hover:bg-[#4f46e5]'
                        : 'hover:bg-gray-100'
                    }`}
                    onClick={() => onTagToggle(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onClose}
            className="bg-[#6366f1] text-white hover:bg-[#4f46e5]"
          >
            Apply Filters
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

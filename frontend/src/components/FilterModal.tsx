import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
  const categorize = (tag: string) => {
    const normalized = tag.toLowerCase();
    const styles = ['elegant', 'minimalist', 'casual', 'modern', 'contemporary', 'sporty', 'luxury', 'designer'];
    const garments = ['dress', 'blazer', 'suit', 'top', 'gown', 'ensemble', 'skirt', 'coat', 'jacket'];
    const descriptors = ['formal', 'professional', 'tailored', 'flowing', 'fitted', 'dramatic'];

    if (styles.some((value) => normalized.includes(value))) return 'style';
    if (garments.some((value) => normalized.includes(value))) return 'garment';
    if (descriptors.some((value) => normalized.includes(value))) return 'descriptor';
    return 'other';
  };

  const categories = {
    style: availableTags.filter((tag) => categorize(tag) === 'style'),
    garment: availableTags.filter((tag) => categorize(tag) === 'garment'),
    descriptor: availableTags.filter((tag) => categorize(tag) === 'descriptor'),
    other: availableTags.filter((tag) => categorize(tag) === 'other'),
  };

  const handleOpenChange = (state: boolean) => {
    if (!state) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Filter Gallery</DialogTitle>
          <DialogDescription>
            Select tags to filter your design collection
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
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

          {categories.style.length > 0 && (
            <CategorySection
              title="Style"
              tags={categories.style}
              selectedTags={selectedTags}
              onTagToggle={onTagToggle}
            />
          )}

          {categories.garment.length > 0 && (
            <CategorySection
              title="Garment Type"
              tags={categories.garment}
              selectedTags={selectedTags}
              onTagToggle={onTagToggle}
            />
          )}

          {categories.descriptor.length > 0 && (
            <CategorySection
              title="Descriptors"
              tags={categories.descriptor}
              selectedTags={selectedTags}
              onTagToggle={onTagToggle}
            />
          )}

          {categories.other.length > 0 && (
            <CategorySection
              title="Other"
              tags={categories.other}
              selectedTags={selectedTags}
              onTagToggle={onTagToggle}
            />
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

interface CategorySectionProps {
  title: string;
  tags: string[];
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
}

function CategorySection({
  title,
  tags,
  selectedTags,
  onTagToggle,
}: CategorySectionProps) {
  if (tags.length === 0) return null;

  return (
    <div>
      <p className="text-sm text-gray-700 mb-3">{title}</p>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
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
  );
}

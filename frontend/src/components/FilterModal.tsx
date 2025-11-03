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

type FilterGroups = {
  style: string[]; // Only style descriptors like "sporty chic", "minimalist", etc.
  garment: string[]; // Garment types only
  silhouette?: string[]; // Silhouette/modifier tags
  color: string[]; // Color tags only
  fabric?: string[]; // Fabrics/materials
  lighting?: string[]; // Lighting/specs
};

interface FilterModalProps {
  open: boolean;
  onClose: () => void;
  filters: FilterGroups;
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
  onClearAll: () => void;
}

export function FilterModal({
  open,
  onClose,
  filters,
  selectedTags,
  onTagToggle,
  onClearAll,
}: FilterModalProps) {
  const handleOpenChange = (state: boolean) => {
    if (!state) {
      onClose();
    }
  };

  const sections: Array<{
    key: keyof FilterGroups;
    label: string;
    isColor?: boolean;
  }> = [
    { key: 'style', label: 'Style Tags' },
    { key: 'garment', label: 'Garment' },
    { key: 'silhouette', label: 'Silhouette' },
    { key: 'color', label: 'Color', isColor: true },
    { key: 'fabric', label: 'Fabric' },
    { key: 'lighting', label: 'Lighting/Specs' },
  ];

  const renderBadge = (tag: string, isColor: boolean) => {
    const isSelected = selectedTags.includes(tag);

    return (
      <Badge
        key={tag}
        variant={isSelected ? 'default' : 'outline'}
        className={`cursor-pointer px-3 py-1.5 transition-all ${
          isSelected
            ? 'bg-[#6366f1] text-white hover:bg-[#4f46e5]'
            : 'hover:bg-gray-100'
        }`}
        onClick={() => onTagToggle(tag)}
      >
        {isColor ? (
          <span
            aria-hidden
            className="mr-2 inline-flex h-3 w-3 rounded-full border border-gray-300 align-middle"
            style={{ backgroundColor: tag }}
          />
        ) : null}
        {tag}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl bg-white text-gray-900 border border-gray-200 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-gray-900">
            Filter Gallery
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            Combine style tags, garments, and colour palettes to narrow your
            collection.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {selectedTags.length > 0 && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm text-gray-700">Active filters</p>
                <Button variant="ghost" size="sm" onClick={onClearAll}>
                  Clear all
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedTags.map((tag) => (
                  <Badge
                    key={`selected-${tag}`}
                    className="cursor-pointer bg-[#6366f1] px-3 py-1.5 text-white hover:bg-[#4f46e5]"
                    onClick={() => onTagToggle(tag)}
                  >
                    {tag}
                    <X className="ml-1.5 h-3 w-3" />
                  </Badge>
                ))}
              </div>
              <Separator className="mt-4" />
            </div>
          )}

          {sections.map(({ key, label, isColor }) => {
            const options = filters[key];
            if (!options || options.length === 0) {
              return null;
            }

            return (
              <div key={key}>
                <p className="mb-3 text-sm text-gray-700">{label}</p>
                <div className="flex flex-wrap gap-2">
                  {options.map((tag) => renderBadge(tag, Boolean(isColor)))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onClose}
            className="bg-[#6366f1] text-white hover:bg-[#4f46e5]"
          >
            Apply filters
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

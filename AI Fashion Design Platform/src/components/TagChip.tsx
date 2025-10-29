import { X } from 'lucide-react';
import { Badge } from './ui/badge';

interface TagChipProps {
  tag: string;
  category?: 'garment' | 'color' | 'fabric' | 'style';
  removable?: boolean;
  onRemove?: (tag: string) => void;
  onClick?: (tag: string) => void;
}

export function TagChip({ 
  tag, 
  category = 'style', 
  removable = false, 
  onRemove, 
  onClick 
}: TagChipProps) {
  const categoryColors = {
    garment: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
    color: 'bg-purple-100 text-purple-800 hover:bg-purple-200',
    fabric: 'bg-green-100 text-green-800 hover:bg-green-200',
    style: 'bg-orange-100 text-orange-800 hover:bg-orange-200'
  };

  const colorClass = categoryColors[category];

  return (
    <Badge
      className={`${colorClass} cursor-pointer transition-all duration-200 px-3 py-1 group relative`}
      onClick={() => onClick?.(tag)}
    >
      <span>{tag}</span>
      {removable && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.(tag);
          }}
          className="ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </Badge>
  );
}

// Mock data for Podna application

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  tags: string[];
  metadata: {
    garment: string;
    colors: string[];
    fabric: string;
    silhouette: string;
    details: string;
    shot: string;
  };
  liked: boolean;
  created_at: string;
}

export interface StyleProfile {
  summaryText: string;
  styleLabels: Array<{ name: string; score: number }>;
  distributions: {
    garments: Record<string, number>;
    colors: Record<string, number>;
    fabrics: Record<string, number>;
    silhouettes: Record<string, number>;
  };
  clusters: Array<{
    name: string;
    weight: number;
    description: string;
    signatureDetails: string[];
  }>;
  portfolioCount: number;
  generatedCount: number;
}

export const mockImages: GeneratedImage[] = [
  {
    id: '1',
    url: 'https://images.unsplash.com/photo-1759229874810-26aa9a3dda92?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbGVnYW50JTIwZmFzaGlvbiUyMGRyZXNzfGVufDF8fHx8MTc2MTcxMzM1OHww&ixlib=rb-4.1.0&q=80&w=1080',
    prompt: 'Elegant evening dress with flowing silhouette',
    tags: ['elegant', 'evening', 'flowing', 'formal'],
    metadata: {
      garment: 'Evening Dress',
      colors: ['Black', 'Gold'],
      fabric: 'Silk chiffon, flowing',
      silhouette: 'A-line, flowing',
      details: 'Deep V-neck, draped fabric, metallic accents',
      shot: 'Full length, studio'
    },
    liked: false,
    created_at: '2025-01-15T14:34:00Z'
  },
  {
    id: '2',
    url: 'https://images.unsplash.com/photo-1760512914787-6a9487dd95aa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwYmxhemVyJTIwZmFzaGlvbnxlbnwxfHx8fDE3NjE3NjIzNzl8MA&ixlib=rb-4.1.0&q=80&w=1080',
    prompt: 'Minimalist blazer with clean lines',
    tags: ['minimalist', 'professional', 'blazer', 'tailored'],
    metadata: {
      garment: 'Blazer (fitted)',
      colors: ['Beige', 'Cream'],
      fabric: 'Wool gabardine, smooth',
      silhouette: 'Slim fit, structured',
      details: 'Notched lapel, princess seams, welt pockets',
      shot: 'Three-quarter, studio'
    },
    liked: true,
    created_at: '2025-01-15T13:22:00Z'
  },
  {
    id: '3',
    url: 'https://images.unsplash.com/photo-1626454015258-3175c09b7769?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuYXZ5JTIwZHJlc3MlMjBmYXNoaW9ufGVufDF8fHx8MTc2MTc2MjM4MHww&ixlib=rb-4.1.0&q=80&w=1080',
    prompt: 'Navy dress with contemporary silhouette',
    tags: ['navy', 'contemporary', 'dress', 'sophisticated'],
    metadata: {
      garment: 'Cocktail Dress',
      colors: ['Navy Blue', 'Dark'],
      fabric: 'Cotton blend, structured',
      silhouette: 'Fitted, modern',
      details: 'Asymmetric neckline, seam details',
      shot: 'Full length, outdoor'
    },
    liked: true,
    created_at: '2025-01-15T12:10:00Z'
  },
  {
    id: '4',
    url: 'https://images.unsplash.com/photo-1704775988639-e9fe3b7d94fd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb250ZW1wb3JhcnklMjBmYXNoaW9uJTIwb3V0Zml0fGVufDF8fHx8MTc2MTc2MjM4MHww&ixlib=rb-4.1.0&q=80&w=1080',
    prompt: 'Contemporary fashion outfit with sporty elements',
    tags: ['contemporary', 'sporty', 'casual', 'modern'],
    metadata: {
      garment: 'Ensemble (top + pants)',
      colors: ['White', 'Cream', 'Neutral'],
      fabric: 'Cotton jersey, soft',
      silhouette: 'Relaxed, oversized',
      details: 'Layered styling, minimalist aesthetic',
      shot: 'Full body, editorial'
    },
    liked: false,
    created_at: '2025-01-15T11:45:00Z'
  },
  {
    id: '5',
    url: 'https://images.unsplash.com/photo-1761001312550-b1ee02221308?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYXNoaW9uJTIwc2lsaG91ZXR0ZSUyMHN0dWRpb3xlbnwxfHx8fDE3NjE3NjIzODB8MA&ixlib=rb-4.1.0&q=80&w=1080',
    prompt: 'Fashion silhouette with dramatic lighting',
    tags: ['dramatic', 'silhouette', 'editorial', 'artistic'],
    metadata: {
      garment: 'Statement Dress',
      colors: ['Black', 'Monochrome'],
      fabric: 'Mixed textiles, textured',
      silhouette: 'Architectural, bold',
      details: 'Volume play, dramatic shapes',
      shot: 'Silhouette, studio'
    },
    liked: true,
    created_at: '2025-01-15T10:30:00Z'
  },
  {
    id: '6',
    url: 'https://images.unsplash.com/photo-1740128041185-b2afa550f7cc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZXNpZ25lciUyMGNsb3RoaW5nJTIwbWluaW1hbGlzdHxlbnwxfHx8fDE3NjE3NjIzODF8MA&ixlib=rb-4.1.0&q=80&w=1080',
    prompt: 'Designer minimalist clothing with clean aesthetic',
    tags: ['minimalist', 'designer', 'clean', 'luxury'],
    metadata: {
      garment: 'Top',
      colors: ['White', 'Ivory'],
      fabric: 'Linen blend, crisp',
      silhouette: 'Boxy, modern',
      details: 'Clean lines, minimal seaming',
      shot: 'Close-up, studio'
    },
    liked: true,
    created_at: '2025-01-14T16:20:00Z'
  },
  {
    id: '7',
    url: 'https://images.unsplash.com/photo-1567409928336-730decd96b00?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxldmVuaW5nJTIwZ293biUyMGVsZWdhbnR8ZW58MXx8fHwxNzYxNjkzNzgwfDA&ixlib=rb-4.1.0&q=80&w=1080',
    prompt: 'Evening gown with elegant draping',
    tags: ['evening', 'gown', 'elegant', 'formal'],
    metadata: {
      garment: 'Evening Gown',
      colors: ['Ivory', 'Champagne'],
      fabric: 'Silk satin, luxurious',
      silhouette: 'Flowing, dramatic',
      details: 'Deep V-neck, side slit, draped back',
      shot: 'Full length, studio'
    },
    liked: false,
    created_at: '2025-01-14T15:10:00Z'
  },
  {
    id: '8',
    url: 'https://images.unsplash.com/photo-1656786779124-3eb10b7014a5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXN1YWwlMjBmYXNoaW9uJTIwc3R5bGV8ZW58MXx8fHwxNzYxNjM4NTI3fDA&ixlib=rb-4.1.0&q=80&w=1080',
    prompt: 'Casual fashion style with modern edge',
    tags: ['casual', 'modern', 'street', 'relaxed'],
    metadata: {
      garment: 'Casual Ensemble',
      colors: ['Blue', 'Denim'],
      fabric: 'Cotton denim, casual',
      silhouette: 'Straight, relaxed',
      details: 'Pockets, utilitarian touches',
      shot: 'Full body, lifestyle'
    },
    liked: false,
    created_at: '2025-01-14T14:00:00Z'
  },
  {
    id: '9',
    url: 'https://images.unsplash.com/photo-1751399566443-a07d07344bdf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0YWlsb3JlZCUyMHN1aXQlMjBmYXNoaW9ufGVufDF8fHx8MTc2MTc2MjM4Mnww&ixlib=rb-4.1.0&q=80&w=1080',
    prompt: 'Tailored suit with sharp silhouette',
    tags: ['tailored', 'suit', 'professional', 'sharp'],
    metadata: {
      garment: 'Suit',
      colors: ['Charcoal', 'Grey'],
      fabric: 'Wool suiting, structured',
      silhouette: 'Fitted, sharp',
      details: 'Peak lapel, single-breasted, functional pockets',
      shot: 'Three-quarter, studio'
    },
    liked: true,
    created_at: '2025-01-14T12:30:00Z'
  },
  {
    id: '10',
    url: 'https://images.unsplash.com/photo-1557777586-f6682739fcf3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYXNoaW9uJTIwZGVzaWduJTIwc2tldGNofGVufDF8fHx8MTc2MTc2MjM4M3ww&ixlib=rb-4.1.0&q=80&w=1080',
    prompt: 'Fashion design concept sketch',
    tags: ['design', 'sketch', 'conceptual', 'creative'],
    metadata: {
      garment: 'Design Sketch',
      colors: ['Mixed', 'Various'],
      fabric: 'Concept phase',
      silhouette: 'Various designs',
      details: 'Hand-drawn, creative exploration',
      shot: 'Flat lay, studio'
    },
    liked: true,
    created_at: '2025-01-14T11:00:00Z'
  },
  {
    id: '11',
    url: 'https://images.unsplash.com/photo-1719518411339-5158cea86caf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBmYXNoaW9uJTIwZWRpdG9yaWFsfGVufDF8fHx8MTc2MTY5NjM0OHww&ixlib=rb-4.1.0&q=80&w=1080',
    prompt: 'Luxury fashion editorial piece',
    tags: ['luxury', 'editorial', 'high-fashion', 'elegant'],
    metadata: {
      garment: 'Editorial Ensemble',
      colors: ['White', 'Cream'],
      fabric: 'Premium textiles, luxurious',
      silhouette: 'Avant-garde, dramatic',
      details: 'Statement pieces, artistic styling',
      shot: 'Editorial, studio'
    },
    liked: true,
    created_at: '2025-01-14T09:45:00Z'
  },
  {
    id: '12',
    url: 'https://images.unsplash.com/photo-1632766863758-779fe6654c20?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBmYXNoaW9uJTIwbW9kZWx8ZW58MXx8fHwxNzYxNzYyMzgzfDA&ixlib=rb-4.1.0&q=80&w=1080',
    prompt: 'Modern fashion model in contemporary styling',
    tags: ['modern', 'contemporary', 'minimal', 'chic'],
    metadata: {
      garment: 'Contemporary Dress',
      colors: ['Black', 'White'],
      fabric: 'Mixed materials, modern',
      silhouette: 'Modern, sleek',
      details: 'Geometric cuts, contemporary aesthetic',
      shot: 'Full body, lifestyle'
    },
    liked: false,
    created_at: '2025-01-13T18:20:00Z'
  }
];

export const mockStyleProfile: StyleProfile = {
  summaryText: "Based on 52 images, your signature style includes sport chic, minimalist tailoring. Your wardrobe is 41% dresses, with navy, cobalt, ivory tones. You favor linen, silk, cotton fabrics.",
  styleLabels: [
    { name: 'Minimalist', score: 220 },
    { name: 'Utilitarian', score: 180 },
    { name: 'Sporty-Chic', score: 165 },
    { name: 'Contemporary sportswear', score: 145 },
    { name: 'Smart casual (polished)', score: 130 }
  ],
  distributions: {
    garments: {
      'Ribbed Knit': 40,
      'BLAZER': 20,
      'Quilted Vest': 20,
      'DRESS': 15,
      'Tailored Pants': 5
    },
    colors: {
      'Charcoal Grey': 27,
      'Cream': 21,
      'Navy Blue': 10,
      'Cobalt Blue': 8,
      'Ivory': 7,
      'Black': 7,
      'Sage Green': 6,
      'Beige': 5,
      'White': 5,
      'Burgundy': 4
    },
    fabrics: {
      'Merino Wool': 30,
      'Cotton Twill': 20,
      'Wool Gabardine': 20,
      'Linen': 15,
      'Silk': 10,
      'Cotton Jersey': 5
    },
    silhouettes: {
      'Straight': 40,
      'Fitted': 30,
      'Boxy': 20,
      'A-line': 10
    }
  },
  clusters: [
    {
      name: 'Minimalist',
      weight: 220,
      description: 'Clean lines, restrained palette, focus on quality',
      signatureDetails: ['topstitching', 'none visible', 'metal buttons']
    },
    {
      name: 'Utilitarian',
      weight: 180,
      description: 'Functional design, practical details, durable materials',
      signatureDetails: ['patch pockets', 'reinforced seams', 'utility straps']
    },
    {
      name: 'Sporty-Chic',
      weight: 165,
      description: 'Athletic influence meets refined styling',
      signatureDetails: ['ribbed textures', 'contrast piping', 'elastic details']
    },
    {
      name: 'Contemporary sportswear',
      weight: 145,
      description: 'Modern athleisure aesthetic, comfort-focused',
      signatureDetails: ['drawstrings', 'zip closures', 'mesh panels']
    }
  ],
  portfolioCount: 52,
  generatedCount: 347
};

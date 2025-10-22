# Dynamic Template Generation from Style Profiles

## Problem You Identified ✅

**Original Issue:**
Templates were hardcoded as:
- Elegant Evening
- Minimalist Modern  
- Romantic Bohemian
- Dramatic Avant-Garde

**Question:** What if the brand isn't minimalist modern? What if they're something else entirely?

**Answer:** You're absolutely right! Templates should be **dynamically generated from each user's actual portfolio**, not hardcoded generic styles.

## Solution: Style Profile → Templates

Now templates are **automatically generated from Stage 2 GMM clustering**:

```
Portfolio Upload
     ↓
VLT Analysis (Stage 1)
     ↓
Style Profile Clustering (Stage 2)
  • GMM identifies 3-7 "style modes"
  • Each cluster has dominant attributes
     ↓
Dynamic Template Generation ← NEW!
  • Each cluster becomes a template
  • Templates use ACTUAL portfolio attributes
  • No hardcoded assumptions
     ↓
RLHF Learning (Stage 5 & 10)
  • Learns within user's actual styles
```

## How It Works

### 1. Style Profile Example

After uploading portfolio, Stage 2 GMM clustering identifies:

```javascript
styleProfile = {
  clusters: [
    {
      id: 0,
      size: 45,
      percentage: 60.0,
      dominant_attributes: {
        silhouette: ['A-line', 30],
        color: ['burgundy', 35],
        style_overall: ['sophisticated', 40],
        style_mood: ['luxurious', 38],
        neckline: ['V-neck', 28],
        fabrication: ['silk charmeuse', 25]
      },
      style_summary: 'sophisticated, A-line silhouette, burgundy tones',
      representative_records: ['img_5', 'img_23', 'img_41']
    },
    {
      id: 1,
      size: 25,
      percentage: 33.3,
      dominant_attributes: {
        silhouette: ['fitted', 20],
        color: ['black', 23],
        style_overall: ['modern', 22],
        style_mood: ['minimalist', 19],
        fabrication: ['structured cotton', 18]
      },
      style_summary: 'modern, fitted silhouette, black tones',
      representative_records: ['img_12', 'img_34']
    },
    {
      id: 2,
      size: 5,
      percentage: 6.7,
      dominant_attributes: {
        style_overall: ['avant-garde', 4],
        style_mood: ['experimental', 4]
      },
      style_summary: 'avant-garde, experimental',
      representative_records: ['img_67']
    }
  ]
}
```

### 2. Templates Auto-Generated

System **automatically creates 3 templates** from these clusters:

```javascript
{
  // Template 1: From Cluster 0 (60% of portfolio)
  cluster_0: {
    id: 'cluster_0',
    name: 'sophisticated, A-line silhouette, burgundy tones',
    description: 'Based on 60% of your portfolio',
    structure: {
      quality: ['high fashion photography', 'professional product shot', ...],
      garment: [
        '{garment_type}',
        'A-line silhouette',  // ← From YOUR portfolio
        '{neckline} neckline',
        '{sleeve_length}',
        '{length} length'
      ],
      style: [
        'sophisticated style',  // ← From YOUR portfolio
        'luxurious mood',       // ← From YOUR portfolio
        'refined aesthetic'
      ],
      color: [
        'burgundy color palette',  // ← From YOUR portfolio
        '{finish} finish',
        'rich tones'
      ],
      lighting: [
        'sophisticated studio lighting',
        'subtle dramatic shadows',
        'professional key light'
      ],
      details: [
        'detailed texture',
        'silk charmeuse fabric quality',  // ← From YOUR portfolio
        'perfect A-line drape'            // ← From YOUR portfolio
      ]
    },
    modifiers: {
      high_reward: [
        'sophisticated aesthetic',        // ← From YOUR portfolio
        'sophisticated design language',
        'luxurious mood',                 // ← From YOUR portfolio
        'magazine editorial quality',
        'luxury fashion',
        'designer quality',
        'signature style',                // Has representative records
        'brand aesthetic'
      ],
      medium_reward: [
        'dress design',                   // From garment type
        'burgundy palette',               // ← From YOUR portfolio
        'burgundy tones'
      ]
    }
  },
  
  // Template 2: From Cluster 1 (33% of portfolio)
  cluster_1: {
    id: 'cluster_1',
    name: 'modern, fitted silhouette, black tones',
    description: 'Based on 33% of your portfolio',
    structure: {
      garment: [
        '{garment_type}',
        'fitted silhouette',     // ← From YOUR portfolio
        ...
      ],
      style: [
        'modern style',          // ← From YOUR portfolio
        'minimalist mood',       // ← From YOUR portfolio
        ...
      ],
      color: [
        'black color palette',   // ← From YOUR portfolio
        ...
      ],
      lighting: [
        'bright even studio lighting',  // Auto-derived from "modern"
        'clean illumination',
        'minimal shadows'
      ],
      background: [
        'pure white background',    // Auto-derived from "minimalist"
        'minimal setting',
        'negative space'
      ]
    },
    modifiers: {
      high_reward: [
        'modern aesthetic',
        'modern design language',
        'minimalist mood',
        ...
      ],
      medium_reward: [
        'black palette',
        'black tones',
        ...
      ]
    }
  },
  
  // Template 3: From Cluster 2 (7% of portfolio)
  cluster_2: {
    id: 'cluster_2',
    name: 'avant-garde, experimental',
    description: 'Based on 7% of your portfolio',
    structure: {
      style: [
        'avant-garde style',      // ← From YOUR portfolio
        'experimental mood',      // ← From YOUR portfolio
        ...
      ],
      lighting: [
        'dramatic side lighting',  // Auto-derived from "avant-garde"
        'deep shadows',
        'bold contrast'
      ]
    }
  }
}
```

### 3. Template Selection

When generating images:

```javascript
// System automatically selects dominant template (Cluster 0 - 60%)
const template = promptTemplateService.generatePrompt(vltSpec, styleProfile, {
  userId: 'brand_123'
});

// Returns prompt using Cluster 0 template:
"high fashion photography, professional product shot, full body shot,
dress, A-line silhouette, V-neck neckline, burgundy color palette,
sophisticated style, luxurious mood, silk charmeuse fabric quality,
perfect A-line drape, sophisticated studio lighting,
+ magazine editorial quality [AI-learned, 0.82 score]
+ sophisticated design language [AI-learned, 0.75 score]
+ signature style [AI-learned, 0.68 score]"
```

## Automatic Derivation Logic

### Lighting (based on style)

```javascript
if style includes 'minimalist' or 'modern':
  → 'bright even studio lighting', 'clean illumination'

else if style includes 'romantic' or mood includes 'soft':
  → 'soft natural window light', 'golden hour lighting'

else if style includes 'dramatic' or mood includes 'bold':
  → 'dramatic side lighting', 'deep shadows'

else:
  → 'sophisticated studio lighting', 'subtle dramatic shadows'
```

### Background (based on style)

```javascript
if style includes 'minimalist' or 'modern':
  → 'pure white background', 'minimal setting'

else if style includes 'romantic' or 'bohemian':
  → 'natural setting', 'soft bokeh'

else if style includes 'dramatic':
  → 'dramatic setting', 'bold backdrop'

else:
  → 'clean minimal background', 'professional studio setup'
```

### Composition (based on garment type)

```javascript
if garment is 'top', 'blouse', 'shirt', 'jacket':
  → '3/4 body, waist up'

else if garment is 'pants', 'skirt':
  → 'full body, emphasis on lower half'

else:
  → 'full body shot'
```

## Real-World Examples

### Example 1: Athletic Wear Brand

**Portfolio:** 70% activewear, performance fabrics, dynamic poses

**Auto-Generated Templates:**
```javascript
cluster_0: {
  name: 'performance, athletic silhouette, moisture-wicking',
  garment: ['performance fabric', 'athletic cut', ...],
  style: ['performance style', 'active mood'],
  lighting: ['bright studio lighting', 'dynamic energy'],
  modifiers: {
    high_reward: ['performance aesthetic', 'athletic design', 'functional fashion']
  }
}
```

### Example 2: Vintage-Inspired Brand

**Portfolio:** 60% vintage cuts, 40% retro colors, nostalgic mood

**Auto-Generated Templates:**
```javascript
cluster_0: {
  name: 'vintage, retro silhouette, nostalgic tones',
  garment: ['vintage-inspired', 'retro cut', ...],
  style: ['vintage style', 'nostalgic mood'],
  color: ['retro color palette', 'period-accurate tones'],
  modifiers: {
    high_reward: ['vintage aesthetic', 'retro charm', 'timeless appeal']
  }
}
```

### Example 3: Sustainable Fashion Brand

**Portfolio:** Natural fabrics, earth tones, organic aesthetic

**Auto-Generated Templates:**
```javascript
cluster_0: {
  name: 'sustainable, organic silhouette, earth tones',
  garment: ['organic cotton fabric quality', ...],
  style: ['sustainable style', 'conscious mood'],
  color: ['earth tone palette', 'natural colors'],
  lighting: ['natural daylight', 'organic illumination'],
  background: ['natural setting', 'eco-friendly backdrop'],
  modifiers: {
    high_reward: ['sustainable aesthetic', 'conscious design', 'ethical fashion']
  }
}
```

## Benefits

### 1. **True Personalization**
- Each brand gets templates based on THEIR actual style
- No forcing brands into generic categories
- Respects brand identity from day one

### 2. **Automatic Adaptation**
- As portfolio evolves, templates auto-update
- New clusters → new templates
- Shifting percentages → different dominant template

### 3. **RLHF Learns Within Brand Context**
- Token scores specific to brand's aesthetic
- Exploration stays relevant to brand DNA
- Can't drift too far from core identity

### 4. **Scalable**
- Works for any fashion vertical
- No manual template creation needed
- Self-organizing system

## Fallback Behavior

**What if no style profile exists yet?**

During onboarding (before portfolio analyzed):
```javascript
// System uses generic templates as fallback
if (!styleProfile) {
  logger.warn('No style profile, using generic templates');
  return this.genericTemplates;  // The 4 original templates
}
```

**After portfolio upload:**
```javascript
// Immediately switches to user-specific templates
const styleProfile = await mlService.createStyleProfile(userId, vltRecords);
// From now on, all prompts use brand-specific templates
```

## Cache & Performance

**Templates are cached per user:**
```javascript
// Cache key includes profile update timestamp
const cacheKey = `${userId}_${styleProfile.updated_at}`;

// Regenerates only when style profile changes
if (this.userTemplates[cacheKey]) {
  return this.userTemplates[cacheKey];  // Fast cache hit
}

// Generate templates once, reuse thousands of times
const templates = this._generateTemplatesFromClusters(styleProfile);
this.userTemplates[cacheKey] = templates;
```

## Summary

✅ **Problem Solved:**
- No more hardcoded "Minimalist Modern" or "Romantic Bohemian"
- Templates **dynamically generated from each user's actual portfolio**
- System adapts to ANY brand aesthetic automatically

🎯 **How It Works:**
1. Upload portfolio → Stage 2 GMM clustering
2. Each cluster → becomes a template
3. Dominant cluster → primary template
4. RLHF learns within brand's actual styles

🚀 **Result:**
- Athletic wear brand gets "performance" templates
- Vintage brand gets "retro" templates  
- Sustainable brand gets "eco-conscious" templates
- ANATOMIE gets ANATOMIE-specific templates

**Your templates are YOUR brand's DNA, extracted directly from YOUR portfolio!** 🎨

# LLM-Generated Template Names

## Why Use LLM for Naming?

### ❌ Technical Names (Original)
```
- "sophisticated, A-line silhouette, burgundy tones"
- "modern, fitted silhouette, black tones"
- "avant-garde, experimental"
```

**Problems:**
- Descriptive but not inspiring
- Technical/analytical tone
- Not memorable
- Doesn't capture "vibe"

### ✅ LLM-Generated Names
```
- "Burgundy Muse"
- "Urban Minimalist"
- "Avant-Garde Rebel"
```

**Benefits:**
- Evocative and memorable
- Brand-voice aligned
- Inspires creativity
- Marketing-ready
- Users get excited about them

## How It Works

### 1. Template Generation (Technical)
```javascript
// Stage 2 GMM clustering creates templates
styleProfile.clusters[0] = {
  id: 0,
  percentage: 60,
  dominant_attributes: {
    silhouette: ['A-line', 30],
    color: ['burgundy', 35],
    style_overall: ['sophisticated', 40],
    style_mood: ['luxurious', 38]
  },
  style_summary: 'sophisticated, A-line silhouette, burgundy tones'
}

// Creates template with technical name
template = {
  name: 'sophisticated, A-line silhouette, burgundy tones',
  technicalName: 'sophisticated, A-line silhouette, burgundy tones',
  ...
}
```

### 2. LLM Enhancement (Async, Non-Blocking)
```javascript
// After templates created, enhance names in background
_enhanceTemplateNames(templates, userId).catch(err => {
  // Fallback: keep technical names if LLM fails
});

// LLM generates evocative name
template.name = 'Burgundy Muse'  // ← LLM-generated
template.technicalName = 'sophisticated, A-line silhouette, burgundy tones'  // ← Preserved
template.nameSource = 'llm_generated'
```

### 3. User Sees Enhanced Name
```
Your Style Modes:

┌────────────────────────────────────────┐
│ 🎨 Burgundy Muse                       │
│ Based on 60% of your portfolio         │
│ sophisticated, A-line, burgundy tones  │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ 🏙️ Urban Minimalist                    │
│ Based on 33% of your portfolio         │
│ modern, fitted, black tones            │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ 🚀 Avant-Garde Rebel                   │
│ Based on 7% of your portfolio          │
│ bold, experimental                     │
└────────────────────────────────────────┘
```

## LLM Prompt

```
You are a creative fashion copywriter for [BRAND_NAME].

Given this fashion style analysis:
- Technical description: "sophisticated, A-line silhouette, burgundy tones"
- Style attributes: sophisticated style, luxurious mood, refined aesthetic
- Color palette: burgundy color palette, matte finish, rich tones
- Garment characteristics: dress, A-line silhouette, V-neck neckline
- Represents 60% of the brand's aesthetic

Generate a short, evocative name (2-3 words max) that captures the essence and vibe.

The name should be:
- Memorable and distinctive
- Aligned with high-end fashion brand voice
- Evocative rather than purely descriptive
- Inspiring for designers

Examples:
- "Midnight Sophisticate" (for elegant, black, evening wear)
- "Burgundy Muse" (for sophisticated, burgundy, A-line)
- "Urban Minimalist" (for modern, clean, black)
- "Ethereal Romance" (for soft, flowing, feminine)

Generate ONE name only, no explanation.
```

## Example Outputs

### Input → Output Pairs

| Technical Description | LLM-Generated Name | Notes |
|----------------------|-------------------|-------|
| sophisticated, A-line, burgundy | **Burgundy Muse** | Captures luxury + color |
| modern, fitted, black | **Urban Minimalist** | Evokes city sophistication |
| romantic, flowing, soft | **Ethereal Romance** | Captures dreamy quality |
| performance, athletic, dynamic | **Dynamic Edge** | Active + competitive |
| vintage, retro, nostalgic | **Timeless Revival** | Past meets present |
| sustainable, organic, earth tones | **Earth Conscious** | Values-aligned |
| dramatic, bold, experimental | **Avant-Garde Rebel** | Daring + artistic |
| elegant, evening, formal | **Midnight Sophisticate** | Time + elegance |

## Brand Context Integration

### Basic (Default)
```javascript
brandContext = 'a fashion brand'
// Generic high-end fashion voice
```

### Enhanced (With Brand Profile)
```javascript
// Fetch from user profile
const user = await getUserProfile(userId);
brandContext = user.brandName || user.companyName;

// Example: "ANATOMIE"
// LLM aligns names with ANATOMIE's brand voice
```

### Future: Brand Voice Customization
```javascript
brandContext = {
  name: 'ANATOMIE',
  voice: 'sophisticated, modern, empowering',
  keywords: ['travel', 'versatility', 'confidence'],
  avoidWords: ['boring', 'basic', 'ordinary']
}

// LLM generates names that align with brand voice
// "Travel Ready Elegance" vs generic "Elegant Modern"
```

## Performance & Cost

### Model Selection
```javascript
model: 'gpt-4o-mini'  // $0.00015 per 1K input tokens
temperature: 0.8       // Higher for creativity
max_tokens: 20         // Just need 2-3 words
```

### Cost Analysis
```
Per template name:
- Input: ~200 tokens ($0.00003)
- Output: ~5 tokens ($0.00006)
- Total: ~$0.00009 per name

For 5 templates:
- Total: ~$0.00045 (less than a penny)

Per 1000 users (5 templates each):
- Total: ~$0.45 (negligible)
```

### Caching Strategy
```javascript
// Names generated once per style profile
// Cached until profile updates
const cacheKey = `${userId}_${styleProfile.updated_at}`;

// Only regenerates when:
// 1. User uploads new portfolio
// 2. Style profile re-clustered
// 3. Manual refresh requested
```

## Fallback Strategy

### 1. Non-Blocking
```javascript
// Templates returned immediately with technical names
const templates = this._generateTemplatesFromClusters(styleProfile);

// LLM enhancement happens async
this._enhanceTemplateNames(templates, userId).catch(err => {
  logger.warn('Using technical names', { error: err.message });
});

// User sees technical names initially
// Names "upgrade" when LLM completes (background)
```

### 2. Graceful Degradation
```javascript
try {
  template.name = await this._generateTemplateName(...);
  template.nameSource = 'llm_generated';
} catch (error) {
  // Keep technical name if LLM fails
  template.name = template.technicalName;
  template.nameSource = 'technical';
  logger.warn('LLM naming failed, using technical name');
}
```

### 3. Offline Mode
```javascript
if (!process.env.OPENAI_API_KEY) {
  // Skip LLM enhancement entirely
  logger.info('No OpenAI key, using technical names');
  return; // Keep technical names
}
```

## UI Integration

### Display Both Names
```jsx
<TemplateCard>
  <TemplateName>
    {template.name}  {/* "Burgundy Muse" */}
    {template.nameSource === 'llm_generated' && <Badge>✨</Badge>}
  </TemplateName>
  
  <TechnicalDescription>
    {template.technicalName}  {/* "sophisticated, A-line, burgundy" */}
  </TechnicalDescription>
  
  <PercentageBar percentage={template.percentage} />
</TemplateCard>
```

### User Can Override
```jsx
<TemplateSettings>
  <Input 
    value={template.name} 
    onChange={handleRename}
    placeholder="Custom name..."
  />
  <Button onClick={() => regenerateName(templateId)}>
    🔄 Regenerate Name
  </Button>
  <Button onClick={() => resetToTechnical(templateId)}>
    Reset to Technical
  </Button>
</TemplateSettings>
```

## Alternative: Multiple Name Options

Instead of generating one name, generate 3 options:

```javascript
const prompt = `...
Generate THREE evocative name options (2-3 words each), one per line.
Only the names, no numbering or explanation.`;

const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  temperature: 0.9,  // Higher for more variety
  max_tokens: 50
});

const names = response.choices[0].message.content
  .split('\n')
  .map(n => n.trim())
  .filter(n => n.length > 0);

// Store all options
template.nameOptions = names;
template.name = names[0];  // Use first as default

// Let user pick favorite
```

**UI:**
```
┌────────────────────────────────────────┐
│ Choose a name for this style:          │
│                                         │
│ ○ Burgundy Muse                        │
│ ○ Sophisticated Silhouette             │
│ ○ Ruby Elegance                        │
│                                         │
│ [Select]                                │
└────────────────────────────────────────┘
```

## Recommendation: YES, Use LLM!

### ✅ Do It Because:
1. **Minimal Cost**: <$0.001 per user
2. **Huge UX Improvement**: Names become features
3. **Brand Alignment**: Can match brand voice
4. **Marketing Value**: "Style Modes" become selling point
5. **User Delight**: More inspiring than technical names
6. **Fallback Works**: Technical names if LLM fails

### 🎯 Best Approach:
```
1. Generate templates immediately (technical names)
2. Enhance with LLM async (non-blocking)
3. Upgrade names when ready (smooth UX)
4. Cache forever (until profile updates)
5. Let users override/regenerate
```

### 💡 Future Enhancement:
```
Let users provide brand voice keywords:
"Our brand is: sustainable, minimalist, empowering"

LLM generates names aligned with those values:
- "Conscious Minimalist"
- "Empowered Simplicity"
- "Sustainable Grace"
```

## Configuration

Add to `.env`:
```bash
# OpenAI for template naming (optional)
OPENAI_API_KEY=sk-...

# Control LLM naming
USE_LLM_TEMPLATE_NAMES=true
LLM_NAMING_MODEL=gpt-4o-mini
LLM_NAMING_TEMPERATURE=0.8
```

## Summary

**Answer: YES, absolutely use LLM for template names!**

✅ **Benefits:**
- Evocative names instead of technical descriptions
- Brand-voice aligned
- Inspires creativity
- Marketing-ready
- Negligible cost

✅ **Implementation:**
- Non-blocking (doesn't slow down generation)
- Graceful fallback (technical names if fails)
- Cached (generated once per style profile)
- User-overridable (custom names supported)

✅ **Cost:**
- ~$0.00009 per template name
- ~$0.00045 per user (5 templates)
- ~$0.45 per 1000 users

🎨 **Result:**
Instead of seeing "sophisticated, A-line silhouette, burgundy tones", users see **"Burgundy Muse"** and get inspired! ✨

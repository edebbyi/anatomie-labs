# RLHF Prompt Templating System - Complete Guide

## Overview

Implemented an **Evolving Multi-Template System with Integrated Randomization** for prompt engineering with RLHF (Reinforcement Learning from Human Feedback).

This system combines:
1. **Structured Templates** (consistency)
2. **Random Exploration** (discovery)
3. **RLHF Learning** (continuous improvement)

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    User Interaction                         │
│  Save, Share, Remix, Dislike, Time Viewed                   │
└───────────────────┬────────────────────────────────────────┘
                    │ Feedback Signal
                    ↓
┌────────────────────────────────────────────────────────────┐
│           Prompt Template Service (Node.js)                 │
│  - Multiple Domain Templates (4 fashion styles)             │
│  - Token Score Tracking (RLHF rewards)                      │
│  - Exploration Rate (20% random)                            │
│  - Online Learning (exponential moving average)             │
└───────────────────┬────────────────────────────────────────┘
                    │ Calls for batch training
                    ↓
┌────────────────────────────────────────────────────────────┐
│            Python ML Service (Port 8001)                    │
│  - Reward Model Training                                    │
│  - Policy Optimization (PPO)                                │
│  - Feature Extraction                                       │
└────────────────────────────────────────────────────────────┘
```

## How It Works

### 1. Template Library (4 Fashion Styles)

**Created 4 domain-specific templates:**

#### Template 1: Elegant Evening Wear
```javascript
{
  id: 'elegant_evening',
  structure: {
    quality: ['high fashion photography', 'professional product shot', ...],
    composition: ['full body shot', '{angle} angle', ...],
    garment: ['{garment_type}', '{silhouette} silhouette', ...],
    style: ['elegant style', 'sophisticated mood', ...],
    lighting: ['sophisticated studio lighting', ...],
    ...
  },
  modifiers: {
    high_reward: ['magazine editorial quality', 'haute couture', ...],
    medium_reward: ['evening gown aesthetic', 'formal occasion', ...]
  }
}
```

#### Template 2: Minimalist Modern
- Clean, architectural, contemporary fashion
- Bauhaus inspired, Japanese minimalism, geometric precision

#### Template 3: Romantic Bohemian  
- Soft, flowing, feminine romantic style
- Vintage inspired, ethereal beauty, soft femininity

#### Template 4: Dramatic Avant-Garde
- Bold, artistic, experimental fashion
- Runway fashion, editorial statement, museum worthy

### 2. Prompt Generation Process

```javascript
// Called during image generation (Stage 6)
const prompt = promptTemplateService.generatePrompt(vltSpec, styleProfile, {
  userId: 'user_123',
  exploreMode: false,  // Auto: 20% explore, 80% exploit
  userModifiers: ['sustainable fashion', 'artisan quality']
});

// Returns:
{
  mainPrompt: "high fashion photography, professional product shot, ...",
  negativePrompt: "blurry, low quality, ...",
  metadata: {
    templateId: 'elegant_evening',
    templateName: 'Elegant Evening Wear',
    exploreMode: false,
    components: {
      core: {
        text: "high fashion photography, full body shot, dress, A-line silhouette, ...",
        editable: false,
        description: 'Base description from your portfolio'
      },
      learned: {
        tokens: ['haute couture', 'luxury fashion', 'timeless elegance'],
        editable: true,
        description: 'AI-learned preferences (from your feedback)',
        scores: [
          { token: 'haute couture', score: 0.85 },
          { token: 'luxury fashion', score: 0.78 },
          { token: 'timeless elegance', score: 0.72 }
        ]
      },
      exploratory: {
        tokens: [],  // Only in explore mode
        editable: true,
        description: 'Experimental variations (for discovery)'
      },
      user: {
        tokens: ['sustainable fashion', 'artisan quality'],
        editable: true,
        description: 'Your custom additions'
      }
    }
  }
}
```

### 3. RLHF Feedback Loop

**User Actions → Reward Signals:**

| User Action | Reward | Weight |
|-------------|--------|--------|
| Save | +1.0 | Highest |
| Share | +0.9 | Very High |
| Remix | +0.8 | High |
| View > 5s | +0.5 | Medium |
| View < 5s | +0.1 | Low |
| Dislike | -0.5 | Negative |
| Irrelevant | -1.0 | Strong Negative |

**Processing Feedback:**

```javascript
// When user saves/shares an image
promptTemplateService.processFeedback({
  userId: 'user_123',
  generationId: 'gen_xyz',
  feedbackType: 'save',  // +1.0 reward
  promptUsed: "high fashion photography, ...",
  tokensUsed: {
    core: [...],
    learned: ['haute couture', 'luxury fashion'],
    exploratory: ['sculptural form'],  // Discovery bonus +1.5x
    user: ['sustainable fashion']
  },
  timeViewed: 8.5
});

// System updates token scores:
// 'haute couture': 0.65 → 0.685 (EMA with α=0.1)
// 'luxury fashion': 0.58 → 0.616
// 'sculptural form': 0.50 → 0.575 (×1.5 for exploratory)
```

### 4. Exploration vs Exploitation

**20% Exploration Mode:**
- Randomly combines tokens from different templates
- Tests novel descriptors (low frequency, high potential)
- Cross-pollination: "elegant evening" + "minimalist modern" modifiers
- Discovery bonus: Exploratory tokens get 1.5x weight in updates

**80% Exploitation Mode:**
- Uses highest-scoring tokens for user
- Leverages learned preferences
- Consistent, predictable results

### 5. Template Selection

**Auto-selects template based on:**

1. **Style Profile (Stage 2 GMM)**: If available, uses dominant cluster
   ```javascript
   styleProfile.clusters[0].dominant_attributes.style_overall = 'minimalist'
   → selects 'minimalist_modern' template
   ```

2. **VLT Style**: Fallback if no style profile
   ```javascript
   vltSpec.style.overall = 'romantic'
   → selects 'romantic_bohemian' template
   ```

3. **Manual Override**: User can force specific template

### 6. Token Score Evolution

**Example Evolution Over Time:**

```
Initial State (Bootstrap):
- All tokens start at 0.5 (neutral)

After 5 "saves" with 'haute couture':
- 'haute couture': 0.5 → 0.65 → 0.74 → 0.79 → 0.83 → 0.85

After 2 "dislikes" with 'bold fashion':
- 'bold fashion': 0.5 → 0.40 → 0.32

After user discovers 'sculptural form' (exploratory + save):
- 'sculptural form': 0.5 → 0.65 (×1.5 weight)
```

## UI Integration

### Color-Coded Prompt Display

When user clicks "Remix":

```
┌─────────────────────────────────────────────────────────┐
│ Edit Prompt                                              │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ [GRAY TEXT - Not Editable]                              │
│ high fashion photography, professional product shot,     │
│ full body shot, elegant dress, A-line silhouette        │
│                                                          │
│ [GREEN TEXT - AI-Learned (High Score)]                  │
│ + haute couture (85% confidence)                [×]      │
│ + luxury fashion (78% confidence)               [×]      │
│ + timeless elegance (72% confidence)            [×]      │
│                                                          │
│ [YELLOW TEXT - Experimental]                            │
│ + sculptural form (exploratory)                 [×]      │
│                                                          │
│ [BLUE TEXT - Your Additions]                            │
│ + sustainable fashion                            [×]      │
│ + artisan quality                                [×]      │
│                                                          │
│ [+ Add Modifier...]                                      │
│                                                          │
│ Template: Elegant Evening Wear [Change]                 │
│ Explore Mode: Off [Toggle]                              │
│                                                          │
│ [Generate] [Cancel]                                      │
└─────────────────────────────────────────────────────────┘
```

### Benefits:
- **Transparency**: User sees why certain tokens are included
- **Control**: Can remove AI-learned tokens to train system
- **Discovery**: Can see exploratory tokens that led to interesting results

## Integration with Existing Services

### In Generation Pipeline (generationService.js)

```javascript
// Stage 2: Generate Prompt
const promptTemplateService = require('./promptTemplateService');

const fashionPrompt = promptTemplateService.generatePrompt(vltSpec, styleProfile, {
  userId: userId,
  exploreMode: settings.exploreMode,
  userModifiers: settings.userModifiers || []
});

// Pass to Stage 6 (Imagen-4-Ultra)
const generationResult = await imagenAdapter.generate({
  prompt: fashionPrompt.mainPrompt,
  negativePrompt: fashionPrompt.negativePrompt,
  ...
});

// Store metadata for feedback loop
await storePromptMetadata(generationId, {
  promptUsed: fashionPrompt.mainPrompt,
  templateId: fashionPrompt.metadata.templateId,
  tokensUsed: fashionPrompt.metadata.components
});
```

### Feedback Endpoint (API)

```javascript
// POST /api/feedback/submit
router.post('/submit', authMiddleware, async (req, res) => {
  const { generationId, feedbackType, timeViewed } = req.body;
  
  // Get prompt metadata
  const promptMeta = await getPromptMetadata(generationId);
  
  // Process feedback
  promptTemplateService.processFeedback({
    userId: req.user.id,
    generationId,
    feedbackType,
    promptUsed: promptMeta.promptUsed,
    tokensUsed: promptMeta.tokensUsed,
    timeViewed
  });
  
  res.json({ success: true });
});
```

## Performance & Scalability

### Token Score Storage

**Current**: In-memory (PromptTemplateService)
**Production**: Database table

```sql
CREATE TABLE token_scores (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  token VARCHAR(255),
  score FLOAT DEFAULT 0.5,
  count INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, token)
);

CREATE INDEX idx_token_scores_user ON token_scores(user_id);
CREATE INDEX idx_token_scores_score ON token_scores(score DESC);
```

### Batch RLHF Training

**Every 100 feedbacks or nightly:**

1. Collect feedback logs
2. Send to Python ML service
3. Train reward model with PPO
4. Update policy weights
5. Sync token scores back to Node.js

```javascript
// Scheduled job
cron.schedule('0 2 * * *', async () => {
  const feedbackBatch = await getFeedbackSince(lastTrainingDate);
  
  const mlService = require('./mlService');
  const result = await mlService.trainRLHFModel({
    userId: 'global',
    feedbackData: feedbackBatch
  });
  
  // Update token scores
  await updateTokenScores(result.updatedWeights);
});
```

## Testing & Validation

### A/B Testing Setup

```javascript
// 50% users get RLHF-optimized prompts
// 50% users get baseline prompts (no learning)

const useRLHF = user.id % 2 === 0;

const prompt = useRLHF ? 
  promptTemplateService.generatePrompt(vltSpec, styleProfile, options) :
  baselinePromptService.generatePrompt(vltSpec);

// Track metrics
logExperiment({
  userId: user.id,
  variant: useRLHF ? 'rlhf' : 'baseline',
  generationId,
  saveRate: ...,
  shareRate: ...,
  avgTimeViewed: ...
});
```

### Expected Improvements

After 1000 generations with feedback:
- **Save Rate**: +15-25%
- **Share Rate**: +10-20%
- **Time Viewed**: +30-40%
- **Remix Rate**: +20-30%

## Next Steps

### Immediate:
1. ✅ Template system implemented
2. ✅ RLHF feedback processing
3. ⏳ Database persistence for token scores
4. ⏳ UI for color-coded prompt editing
5. ⏳ Feedback API endpoints

### Short-term:
1. Python ML service for batch RLHF training
2. Reward model with transformer/linear regression
3. Policy optimization (PPO)
4. A/B testing framework
5. Analytics dashboard

### Long-term:
1. Per-user reward models
2. Multi-modal feedback (not just saves/shares)
3. Prompt variation generation with LLM
4. Auto-discovery of emerging design trends
5. Cross-user preference learning (privacy-preserving)

## Example: Full Lifecycle

```javascript
// 1. Upload Portfolio → Stage 2: Style Profile
const styleProfile = await mlService.createStyleProfile(userId, vltRecords);
// Result: User has 3 clusters: 60% minimalist, 30% elegant, 10% dramatic

// 2. Generate First Image
const prompt1 = promptTemplateService.generatePrompt(vltSpec, styleProfile, {
  userId,
  exploreMode: false  // Start with exploitation
});
// Uses 'minimalist_modern' template (dominant cluster)
// Tokens: ['bauhaus inspired', 'geometric precision', 'clean lines']
// All start at 0.5 score (neutral)

// 3. User Saves Image → +1.0 reward
promptTemplateService.processFeedback({
  feedbackType: 'save',
  tokensUsed: {
    learned: ['bauhaus inspired', 'geometric precision'],
    ...
  }
});
// Token scores: 'bauhaus inspired': 0.5 → 0.55, 'geometric precision': 0.5 → 0.55

// 4. Generate 2nd Image (Still exploiting)
const prompt2 = promptTemplateService.generatePrompt(...);
// Same tokens ranked higher, more likely to be selected

// 5. Generate 6th Image (20% chance to explore)
const prompt6 = promptTemplateService.generatePrompt(...);
// exploreMode: true
// Cross-template tokens: ['timeless elegance'] from 'elegant_evening'
// Novel token: ['sculptural form']

// 6. User LOVES the exploratory image → Save + Share
promptTemplateService.processFeedback({
  feedbackType: 'save',
  tokensUsed: {
    exploratory: ['timeless elegance', 'sculptural form']
  }
});
// These get 1.5x weight: 'sculptural form': 0.5 → 0.625

// 7. After 100 generations
// Token scores converged:
// - 'bauhaus inspired': 0.82 (consistently saved)
// - 'geometric precision': 0.75
// - 'sculptural form': 0.71 (discovered via exploration)
// - 'bold fashion': 0.28 (user dislikes)

// 8. Batch RLHF Training (nightly)
// Python ML service trains reward model
// Learns: User prefers minimalist + sculptural elements
// Policy updated to generate more of this combination
```

## Summary

✅ **Implemented:**
- 4 domain-specific fashion templates
- RLHF feedback processing
- Online learning (exponential moving average)
- Exploration (20%) vs Exploitation (80%)
- Token score tracking
- Cross-template discovery

📊 **Key Features:**
- Structured consistency + random exploration
- Continuous learning from user feedback
- Transparent, editable prompts in UI
- Scales to per-user personalization

🚀 **Ready for:**
- Integration with generation pipeline
- UI prompt editor with color coding
- Feedback API endpoints
- A/B testing and metrics

This system ensures that prompts **constantly improve** while maintaining **creative diversity** and **user control**! 🎨

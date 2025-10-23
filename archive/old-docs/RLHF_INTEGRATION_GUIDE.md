# RLHF Integration Guide

## Overview

The RLHF (Reinforcement Learning with Human Feedback) system is now fully integrated into the prompt generation pipeline. This system learns from user feedback to continuously improve image generation quality by adjusting token weights based on what users like, save, share, and engage with.

## Architecture

### Components

1. **RLHFWeightService** (`src/services/rlhfWeightService.js`)
   - Manages learned token weights per user
   - Implements epsilon-greedy exploration/exploitation
   - Stores weights in database for persistence
   - Processes feedback signals to update weights

2. **PromptTemplateService** (`src/services/promptTemplateService.js`)
   - Uses RLHF weights during token selection
   - Categorizes tokens into RLHF categories
   - Tracks which tokens are used in each generation

3. **GenerationService** (`src/services/generationService.js`)
   - Stores RLHF token metadata with generated images
   - Enables feedback loop for learning

4. **RLHF API Routes** (`src/api/routes/rlhf.js`)
   - Submit feedback: `POST /api/rlhf/feedback`
   - Get weights: `GET /api/rlhf/weights`
   - Get top tokens: `GET /api/rlhf/top-tokens`
   - Get learning stats: `GET /api/rlhf/stats`
   - Select tokens: `POST /api/rlhf/select-tokens`

## How It Works

### 1. Token Categorization

Tokens are automatically categorized into:
- **lighting**: cinematic lighting, soft box, golden hour, etc.
- **composition**: full body shot, 3/4 body, overhead shot, etc.
- **style**: minimalist, elegant, romantic, modern, etc.
- **quality**: professional photography, 8k, sharp focus, etc.
- **mood**: sophisticated, playful, dramatic, serene, etc.
- **modelPose**: standing pose, seated, dynamic, confident, etc.

### 2. Prompt Generation Flow

```javascript
// 1. User uploads portfolio → VLT analysis generates attributes
const vltSpec = await vltService.analyzeImage(imageFile);

// 2. Generate prompt with RLHF weights
const prompt = await promptTemplateService.generatePrompt(vltSpec, styleProfile, {
  userId: userId,
  exploreMode: false, // 85% exploitation, 15% exploration
  userModifiers: []
});

// 3. RLHF tokens are selected based on learned weights
// - For each category (lighting, style, etc.)
// - System queries user's learned weights
// - Uses epsilon-greedy to balance exploration/exploitation

// 4. Metadata tracks which tokens were used
prompt.metadata.rlhfTokensUsed = {
  lighting: ['cinematic lighting', 'golden hour'],
  style: ['elegant', 'sophisticated'],
  composition: ['full body shot'],
  quality: ['professional photography', '8k'],
  // ...
};
```

### 3. Feedback Processing

When a user interacts with a generated image:

```javascript
// User saves an image
await rlhfWeightService.processFeedback({
  userId: 'user-uuid',
  imageId: 'image-uuid',
  generationId: 'gen-uuid',
  feedbackType: 'save', // or 'share', 'generate_similar', 'dislike', etc.
  tokensUsed: {
    lighting: ['cinematic lighting'],
    style: ['elegant'],
    // ... (from generation metadata)
  },
  timeViewed: 5000 // milliseconds
});

// The system:
// 1. Computes reward signal based on feedback type:
//    - 'save': +1.0
//    - 'share': +1.2
//    - 'generate_similar': +1.5 (strongest signal)
//    - 'dislike': -0.5
//    - 'delete': -1.0

// 2. Updates weight for each token using exponential moving average:
//    new_weight = current_weight + learning_rate * (reward - current_weight)

// 3. Clamps weight between 0 and 2
// 4. Logs feedback for batch learning
```

### 4. Token Selection (Epsilon-Greedy)

```javascript
// 85% of the time: EXPLOITATION (use best known tokens)
const topTokens = await rlhfWeightService.selectTokens(userId, 'lighting', 3);
// Returns: ['cinematic lighting', 'golden hour', 'soft box'] (highest weights)

// 15% of the time: EXPLORATION (try random tokens)
// Returns random selection to discover new patterns
```

## API Usage Examples

### Submit Feedback
```bash
curl -X POST http://localhost:3001/api/rlhf/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid",
    "imageId": "image-uuid",
    "generationId": "gen-uuid",
    "feedbackType": "save",
    "tokensUsed": {
      "lighting": ["cinematic lighting"],
      "style": ["elegant", "sophisticated"],
      "composition": ["full body shot"]
    },
    "timeViewed": 5000
  }'
```

### Get User's Learned Weights
```bash
# Get all weights
curl http://localhost:3001/api/rlhf/weights?userId=user-uuid

# Get weights for specific category
curl http://localhost:3001/api/rlhf/weights?userId=user-uuid&category=lighting
```

### Get Top Performing Tokens
```bash
curl "http://localhost:3001/api/rlhf/top-tokens?userId=user-uuid&category=style&limit=10"
```

### Get Learning Statistics
```bash
curl http://localhost:3001/api/rlhf/stats?userId=user-uuid
```

### Select Tokens Based on Preferences
```bash
curl -X POST http://localhost:3001/api/rlhf/select-tokens \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid",
    "category": "lighting",
    "count": 3,
    "exploreMode": false
  }'
```

## Database Schema

### `rlhf_token_weights`
```sql
CREATE TABLE rlhf_token_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  category VARCHAR(50) NOT NULL, -- lighting, style, composition, etc.
  token VARCHAR(255) NOT NULL,
  weight DECIMAL(5,3) DEFAULT 1.0, -- Weight between 0 and 2
  usage_count INTEGER DEFAULT 0,
  positive_feedback INTEGER DEFAULT 0,
  negative_feedback INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, category, token)
);
```

### `rlhf_feedback_log`
```sql
CREATE TABLE rlhf_feedback_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  image_id UUID REFERENCES generated_images(id),
  generation_id UUID,
  feedback_type VARCHAR(50) NOT NULL,
  tokens_used JSONB NOT NULL,
  reward DECIMAL(5,3) NOT NULL,
  time_viewed INTEGER, -- milliseconds
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Frontend Integration

### 1. Capture Feedback Events

```typescript
// When user saves an image
const handleSaveImage = async (image: GeneratedImage) => {
  await fetch('/api/rlhf/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: user.id,
      imageId: image.id,
      generationId: image.generationId,
      feedbackType: 'save',
      tokensUsed: image.metadata.rlhfTokensUsed,
      timeViewed: Date.now() - imageViewStartTime
    })
  });
};

// Similar handlers for:
// - handleShareImage (feedbackType: 'share')
// - handleGenerateSimilar (feedbackType: 'generate_similar')
// - handleDislikeImage (feedbackType: 'dislike')
// - handleDeleteImage (feedbackType: 'delete')
```

### 2. Display Learning Stats (Optional)

```typescript
const learningStats = await fetch(
  `/api/rlhf/stats?userId=${user.id}`
).then(r => r.json());

// Show user:
// - Total images generated
// - Learning progress (feedback ratio)
// - Most preferred tokens
// - Exploration vs exploitation balance
```

### 3. Show Token Breakdown (Advanced)

```typescript
// When showing generation details
<TokenBreakdown tokens={image.metadata.rlhfTokensUsed} />

// Displays:
// - Lighting: cinematic lighting, golden hour
// - Style: elegant, sophisticated
// - Composition: full body shot
// - etc.
```

## Learning Dynamics

### Initial State (Cold Start)
- All tokens start with weight = 1.0
- System uses 15% exploration to gather data
- After ~10-20 feedback signals, patterns emerge

### Learned State
- Popular tokens gain weight (up to 2.0)
- Disliked tokens lose weight (down to 0.0)
- System balances exploration (15%) with exploitation (85%)

### Weight Update Formula
```
new_weight = old_weight + α * (reward - old_weight)

where:
  α (alpha) = 0.1 (learning rate)
  reward = feedback signal (-1.0 to +1.5)
```

### Example Weight Evolution
```
Token: "cinematic lighting"

Initial: weight = 1.0
After 'save': weight = 1.0 + 0.1 * (1.0 - 1.0) = 1.0
After 'share': weight = 1.0 + 0.1 * (1.2 - 1.0) = 1.02
After 'generate_similar': weight = 1.02 + 0.1 * (1.5 - 1.02) = 1.068
After 'save': weight = 1.068 + 0.1 * (1.0 - 1.068) = 1.061

After 10+ positive signals: weight ≈ 1.3-1.5
After negative signal: weight decreases toward 0
```

## Monitoring and Debugging

### Check RLHF Service Status
```bash
# View logs
tail -f /tmp/backend.log | grep -i rlhf

# Expected output:
# RLHF Weight Service initialized
# RLHF-based token selection
# Processing RLHF feedback
```

### Query Weights Directly
```sql
-- See all weights for a user
SELECT category, token, weight, usage_count, positive_feedback, negative_feedback
FROM rlhf_token_weights
WHERE user_id = 'user-uuid'
ORDER BY weight DESC
LIMIT 20;

-- See feedback log
SELECT feedback_type, reward, tokens_used, created_at
FROM rlhf_feedback_log
WHERE user_id = 'user-uuid'
ORDER BY created_at DESC
LIMIT 10;
```

### Check Token Selection
```bash
# Test token selection endpoint
curl -X POST http://localhost:3001/api/rlhf/select-tokens \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid",
    "category": "style",
    "count": 5,
    "exploreMode": false
  }'
```

## Performance Considerations

### Database Queries
- Weights are cached in-memory during prompt generation
- Updates are async and non-blocking
- Uses database connection pooling

### Learning Rate
- α = 0.1 provides stable learning
- Takes ~10-20 signals for noticeable changes
- Can be adjusted per user if needed

### Exploration Rate
- ε = 0.15 (15% exploration)
- Balances discovery with consistency
- Can be increased during onboarding phase

## Future Enhancements

### 1. Collaborative Filtering
- Learn from similar users
- Bootstrap new users with community weights
- Identify style tribes/segments

### 2. Contextual Bandits
- Adjust weights based on context (occasion, season, garment type)
- Multi-armed bandit algorithms for optimal exploration

### 3. Deep RL Integration
- Use neural networks to learn token embeddings
- Cross-category learning (e.g., lighting + mood interactions)
- Policy gradient methods for prompt optimization

### 4. A/B Testing
- Run experiments with different learning rates
- Test exploration strategies
- Measure impact on user satisfaction

## Troubleshooting

### Issue: Weights not updating
**Check:**
1. Feedback API is being called correctly
2. tokensUsed matches generation metadata
3. Database connection is working
4. User ID is correct

### Issue: Poor token selection
**Check:**
1. Enough feedback data collected (need 10+ signals)
2. Exploration rate might be too high
3. Token categorization is correct
4. Weight values are in expected range (0-2)

### Issue: System always explores
**Check:**
1. Exploration rate setting (should be 0.15)
2. exploreMode parameter in API calls
3. Random number generator working correctly

## Summary

The RLHF integration creates a feedback loop:
1. **Generate** images with learned token weights
2. **Track** which tokens were used
3. **Capture** user feedback signals
4. **Update** token weights based on feedback
5. **Improve** future generations automatically

This creates a personalized, continuously improving system that learns each user's unique preferences over time, resulting in higher quality outputs and better user satisfaction.

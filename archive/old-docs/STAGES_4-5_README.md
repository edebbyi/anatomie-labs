# Designer BFF - Stages 4-5 Implementation

**Model Routing & RLHF Optimization**

## 🎯 Overview

This implementation covers Stages 4-5 of the Designer BFF pipeline:

- **Stage 4: Model Routing** - Intelligent selection of optimal image generation models based on prompt characteristics, cost, quality requirements, and historical performance
- **Stage 5: RLHF Optimization** - Reinforcement Learning with Human Feedback for continuous prompt quality improvement

## 📁 New Files Created

```
anatomie-lab/
├── src/services/
│   ├── modelRoutingService.js          # Stage 4: Intelligent model selection
│   └── rlhfService.js                  # Stage 5: RLHF prompt optimization
└── database/migrations/
    └── 004_create_routing_rlhf_tables.sql  # Database schema
```

## 🏗️ Stage 4: Model Routing Service

### Purpose
Intelligently routes prompts to the optimal image generation model (Imagen, DALL-E, Midjourney, Stable Diffusion) based on multiple factors.

### Supported Models

| Model | Cost/Image | Quality | Speed | Best For |
|-------|-----------|---------|-------|----------|
| **Google Imagen 3** | $0.04 | 90% | 8s | Photorealism, Fashion, Complex Compositions |
| **DALL-E 3** | $0.08 | 88% | 12s | Artistic, Text-in-image, Diverse Styles |
| **Midjourney v6** | $0.06 | 92% | 25s | Editorial, Fashion, Style Consistency |
| **Stable Diffusion XL** | $0.02 | 82% | 6s | Cost-effective, Fast, Customizable |

### Routing Strategies

```javascript
const strategies = {
  QUALITY_FIRST: 'quality_first',      // Prioritize quality over cost/speed
  COST_OPTIMIZED: 'cost_optimized',    // Minimize costs
  BALANCED: 'balanced',                // Balance all factors
  SPEED_OPTIMIZED: 'speed_optimized',  // Fastest generation
  CUSTOM: 'custom'                     // Custom weights
};
```

### Feature Analysis

The routing service extracts and analyzes these prompt features:

- **Complexity** (0-1): Based on length, keyword count, complexity indicators
- **Style Type**: photorealistic, artistic, editorial, abstract, minimalist
- **Realism Level** (0-1): How photorealistic vs artistic
- **Detail Level** (0-1): Amount of specific details requested
- **Color Complexity** (0-1): Color sophistication in prompt
- **Has Text**: Whether prompt requests text in image
- **Is Fashion**: Fashion-related content
- **Is Editorial**: Editorial/magazine style

### Scoring System

Each provider is scored on 5 dimensions:

1. **Quality Score** (30%): Base quality rating
2. **Suitability Score** (25%): Match with prompt features
3. **Cost Score** (20%): Inverse of cost (lower cost = higher score)
4. **Speed Score** (15%): Inverse of latency
5. **Historical Score** (10%): Past performance for this user

### Usage Example

```javascript
const modelRoutingService = require('./src/services/modelRoutingService');

const routing = await modelRoutingService.routePrompt(enhancedPrompt, {
  strategy: 'balanced',
  userId: 'user_123',
  personaData: { matchScore: 0.85 },
  constraints: {
    maxCost: 0.05,
    minQuality: 0.85
  }
});

console.log(routing);
// {
//   provider: { id: 'google-imagen', name: 'Google Imagen 3', ... },
//   score: 0.873,
//   reasoning: 'Specialized in fashion imagery; High quality provider (90%)',
//   alternatives: [
//     { provider: 'Midjourney v6', score: 0.865, reason: 'Very close alternative' },
//     { provider: 'DALL-E 3', score: 0.742, reason: 'More cost-effective option' }
//   ],
//   features: { complexity: 0.7, isFashion: true, ... }
// }
```

## 🔄 Stage 5: RLHF Service

### Purpose
Continuously improve prompt quality using reinforcement learning with human feedback.

### Reward System

Rewards are calculated from multiple signals:

```javascript
const rewardWeights = {
  userOutlier: 1.0,        // User marks as "outlier" (favorite) - highest reward
  userComment: 0.5,        // Positive comments
  vltValidation: 0.7,      // VLT quality validation
  generationSuccess: 0.6,  // Successful generation
  personaMatch: 0.4,       // Good persona alignment
  costEfficiency: 0.3      // Within budget
};
```

### Total Reward Calculation

```
totalReward = 
  baseQuality * 0.3 +
  userFeedback * 0.3 +
  validationScore * 0.2 +
  personaAlignment * 0.1 +
  costEfficiency * 0.1
```

### Optimization Strategies

The RLHF service applies 4 optimization strategies:

1. **Quality Enhancement**: Add quality descriptors if missing
2. **Pattern Incorporation**: Use historically successful terms
3. **Feedback Learning**: Emphasize positive themes, de-emphasize negative
4. **Exploration**: Try variations for discovery (20% of the time)

### Feedback Types

```javascript
const feedbackScores = {
  'outlier': 1.0,          // Highest - user loved it
  'heart': 0.9,            // Strong positive
  'positive_comment': 0.8,  // Positive feedback
  'neutral_comment': 0.5,   // Neutral
  'negative_comment': 0.2,  // Negative feedback
  'dislike': 0.1           // Strong negative
};
```

### Usage Example

```javascript
const rlhfService = require('./src/services/rlhfService');

const optimized = await rlhfService.optimizePrompt(enhancedPrompt, {
  userId: 'user_123',
  previousFeedback: [
    { type: 'outlier', keywords: ['elegant', 'minimalist'], ageInDays: 5 },
    { type: 'heart', keywords: ['soft lighting'], ageInDays: 10 }
  ],
  personaData: { matchScore: 0.85 },
  targetQuality: 0.9
});

console.log(optimized);
// {
//   originalPrompt: { ... },
//   optimizedPrompt: { ... },  // Modified with improvements
//   currentReward: 0.72,
//   expectedReward: 0.89,
//   modifications: [
//     {
//       type: 'quality_enhancement',
//       description: 'Added quality descriptors',
//       impact: 'positive',
//       confidence: 0.8
//     },
//     {
//       type: 'feedback_learning',
//       description: 'Applied user feedback patterns',
//       impact: 'positive',
//       confidence: 0.75
//     }
//   ],
//   confidence: 0.83
// }
```

## 📊 Database Schema

### New Tables

**routing_decisions**: Track model selection decisions
```sql
CREATE TABLE routing_decisions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  provider_id VARCHAR(100),
  score DECIMAL(5,4),
  features JSONB,
  all_scores JSONB,
  strategy VARCHAR(50),
  created_at TIMESTAMP
);
```

**prompt_optimizations**: Store RLHF optimizations
```sql
CREATE TABLE prompt_optimizations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  original_prompt JSONB,
  optimized_prompt JSONB,
  reward_score DECIMAL(5,4),
  expected_reward DECIMAL(5,4),
  modifications JSONB,
  successful_terms TEXT[],
  success_rate DECIMAL(5,4),
  created_at TIMESTAMP
);
```

**reward_scores**: User feedback rewards
```sql
CREATE TABLE reward_scores (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  prompt_id INTEGER,
  image_id INTEGER,
  feedback_type VARCHAR(50),
  total_reward DECIMAL(5,4),
  components JSONB,
  created_at TIMESTAMP
);
```

**model_performance_metrics**: Track model performance
```sql
CREATE TABLE model_performance_metrics (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  provider_id VARCHAR(100),
  success_rate DECIMAL(5,4),
  quality_score DECIMAL(5,4),
  avg_latency INTEGER,
  avg_cost DECIMAL(10,4),
  total_generations INTEGER,
  metadata JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**model_providers**: Model provider configuration
```sql
CREATE TABLE model_providers (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(200),
  cost_per_image DECIMAL(10,4),
  avg_quality DECIMAL(5,4),
  avg_latency INTEGER,
  strengths TEXT[],
  weaknesses TEXT[],
  is_available BOOLEAN,
  is_enabled BOOLEAN
);
```

### Analytics Views

**v_routing_performance**: Routing statistics by provider
```sql
CREATE VIEW v_routing_performance AS
SELECT 
  provider_id,
  COUNT(*) as total_decisions,
  AVG(score) as avg_score,
  COUNT(DISTINCT user_id) as unique_users,
  DATE_TRUNC('day', created_at) as decision_date
FROM routing_decisions
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY provider_id, DATE_TRUNC('day', created_at);
```

**v_rlhf_performance**: RLHF optimization performance
```sql
CREATE VIEW v_rlhf_performance AS
SELECT 
  user_id,
  COUNT(*) as total_optimizations,
  AVG(reward_score) as avg_reward,
  AVG(expected_reward) as avg_expected,
  AVG(expected_reward - reward_score) as avg_improvement
FROM prompt_optimizations
GROUP BY user_id;
```

**v_model_provider_comparison**: Compare all providers
```sql
CREATE VIEW v_model_provider_comparison AS
SELECT 
  mp.id,
  mp.name,
  mp.cost_per_image,
  COALESCE(AVG(mpm.quality_score), mp.avg_quality) as actual_quality,
  COALESCE(AVG(mpm.success_rate), 0.8) as success_rate,
  COUNT(rd.id) as times_selected
FROM model_providers mp
LEFT JOIN routing_decisions rd ON mp.id = rd.provider_id
LEFT JOIN model_performance_metrics mpm ON mp.id = mpm.provider_id
GROUP BY mp.id, mp.name, mp.cost_per_image, mp.avg_quality;
```

## 🚀 Setup & Configuration

### 1. Run Database Migrations

```bash
psql $DATABASE_URL -f database/migrations/004_create_routing_rlhf_tables.sql
```

### 2. Configure Model Providers

Update `.env` with model provider credentials:

```bash
# Google Cloud (for Imagen)
GOOGLE_CLOUD_PROJECT_ID=your_project_id
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json

# OpenAI (for DALL-E 3)
OPENAI_API_KEY=your_openai_api_key

# Midjourney (if available)
MIDJOURNEY_API_KEY=your_midjourney_api_key

# Replicate (for Stable Diffusion)
REPLICATE_API_TOKEN=your_replicate_token
```

### 3. Test Routing Service

```javascript
const routing = require('./src/services/modelRoutingService');

// Test provider availability
const available = routing.getAvailableProviders();
console.log(`${available.length} providers available`);

// Test routing
const mockPrompt = {
  enhanced: {
    mainPrompt: 'elegant minimalist dress in silk, professional studio photography',
    keywords: ['dress', 'silk', 'minimalist', 'elegant'],
    photographyStyle: 'studio'
  }
};

const result = await routing.routePrompt(mockPrompt, {
  strategy: 'balanced',
  userId: 'test_user'
});

console.log(`Selected: ${result.provider.name}`);
console.log(`Score: ${result.score.toFixed(3)}`);
console.log(`Reasoning: ${result.reasoning}`);
```

### 4. Test RLHF Service

```javascript
const rlhf = require('./src/services/rlhfService');

const optimized = await rlhf.optimizePrompt(mockPrompt, {
  userId: 'test_user',
  previousFeedback: [
    { type: 'outlier', keywords: ['elegant'], ageInDays: 3 }
  ],
  targetQuality: 0.85
});

console.log(`Reward improvement: ${(optimized.expectedReward - optimized.currentReward).toFixed(3)}`);
console.log(`Modifications: ${optimized.modifications.length}`);
```

## 📈 Performance Metrics

### Stage 4: Model Routing
- **Routing Decision**: ~50-200ms
- **Feature Extraction**: ~10-30ms
- **Provider Scoring**: ~20-50ms per provider
- **Database Logging**: ~10-30ms

### Stage 5: RLHF Optimization
- **Reward Calculation**: ~30-80ms
- **Historical Analysis**: ~50-150ms (database query)
- **Optimization Application**: ~20-50ms
- **Total Optimization**: ~100-300ms

## 🔄 Integration with Pipeline

The full pipeline now includes Stages 4-5:

```
Input Image
   ↓
Stage 1: VLT Analysis
   ↓
Stage 2: Prompt Enhancement
   ↓
Stage 3: Persona Matching
   ↓
Stage 4: Model Routing  ← NEW
   ↓
Stage 5: RLHF Optimization  ← NEW
   ↓
Ready for Generation (Stage 6)
```

## 📊 Analytics & Monitoring

### Key Metrics to Track

**Routing Performance:**
- Provider selection distribution
- Average routing scores by strategy
- User-specific routing patterns
- Cost savings from optimal routing

**RLHF Performance:**
- Average reward scores over time
- Optimization success rate
- User feedback correlation
- Prompt quality improvement trends

### Sample Queries

```sql
-- Most popular providers (last 30 days)
SELECT 
  provider_id,
  COUNT(*) as selections,
  AVG(score) as avg_score
FROM routing_decisions
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY provider_id
ORDER BY selections DESC;

-- RLHF improvement over time
SELECT 
  DATE_TRUNC('week', created_at) as week,
  AVG(expected_reward - reward_score) as avg_improvement,
  COUNT(*) as total_optimizations
FROM prompt_optimizations
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY week
ORDER BY week DESC;

-- User feedback distribution
SELECT 
  feedback_type,
  COUNT(*) as count,
  AVG(total_reward) as avg_reward
FROM reward_scores
GROUP BY feedback_type
ORDER BY count DESC;
```

## 🚧 Next Steps

### Stage 6: Image Generation
- Implement model provider adapters (Imagen, DALL-E, etc.)
- Multi-image batch generation (4 images per prompt)
- Generation parameter optimization
- Async job processing

### Stages 7-11: Post-Processing & Feedback
- GFPGAN face enhancement
- Real-ESRGAN upscaling
- VLT quality validation
- DPP diversity sampling
- User feedback loop
- Analytics dashboard

## 📝 Notes

- Model routing decisions are logged for continuous improvement
- RLHF optimizations use exponential decay for recency weighting
- Historical performance data updates automatically via database triggers
- All costs are estimates and should be updated with actual pricing
- Provider availability is checked dynamically based on environment variables

---

**Status:** ✅ Stages 4-5 Complete

**Next Milestone:** Stage 6 - Image Generation with Multi-Model Support

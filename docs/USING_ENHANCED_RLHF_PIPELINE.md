# Using the Enhanced RLHF Pipeline

This document explains how to use the enhanced Reinforcement Learning with Human Feedback (RLHF) pipeline in the Podna agent system.

## Overview

The enhanced RLHF pipeline provides improved accuracy, faster learning, and reduced hallucinations through:

1. **Anti-Hallucination Validation**
2. **Continuous Learning from All Interactions**
3. **Thompson Sampling for Better Exploration**
4. **Rich Style Tag Metadata**

## Pipeline Components

### 1. Enhanced Style Descriptor Agent

Analyzes fashion images with anti-hallucination measures:

```javascript
const enhancedStyleDescriptorAgent = require('./src/services/enhancedStyleDescriptorAgent');

// Analyze a portfolio with progress tracking
const results = await enhancedStyleDescriptorAgent.analyzePortfolio(portfolioId, (progress) => {
  console.log(`Analyzing image ${progress.current} of ${progress.total}`);
});
```

### 2. Advanced Prompt Builder Agent

Creates prompts using Thompson Sampling:

```javascript
const advancedPromptBuilderAgent = require('./src/services/advancedPromptBuilderAgent');

// Generate a prompt with Thompson Sampling
const prompt = await advancedPromptBuilderAgent.generatePrompt(userId, {
  mode: 'exploratory',
  creativity: 0.2 // 20% exploration
});
```

### 3. Continuous Learning Agent

Tracks all user interactions:

```javascript
const continuousLearningAgent = require('./src/services/continuousLearningAgent');

// Track an interaction
await continuousLearningAgent.trackInteraction(userId, generationId, {
  event_type: 'view',
  duration_ms: 5000,
  scroll_depth: 0.8,
  metadata: { source: 'gallery' }
});
```

### 4. Validation Agent

Prevents hallucinations in style descriptors:

```javascript
const validationAgent = require('./src/services/validationAgent');

// Validate a descriptor
const validationResult = await validationAgent.validateDescriptor(descriptor, imageUrl);
```

## Integration in Podna Routes

The enhanced agents are integrated into the podna.js routes:

1. **Portfolio Analysis** - Uses Enhanced Style Descriptor Agent
2. **Image Generation** - Uses Advanced Prompt Builder Agent
3. **Feedback Processing** - Integrates Continuous Learning Agent
4. **Onboarding** - Full enhanced pipeline

## Database Schema

The enhanced pipeline uses four new tables:

1. **interaction_events** - Tracks user interactions
2. **style_tag_metadata** - Stores rich style tag metadata
3. **thompson_sampling_params** - Thompson Sampling parameters
4. **validation_results** - Validation results

## Monitoring and Analytics

Several views are available for monitoring:

```sql
-- View user learning progress
SELECT * FROM user_learning_progress WHERE user_id = '...';

-- View style tag performance
SELECT * FROM style_tag_performance WHERE user_id = '...';

-- View validation quality metrics
SELECT * FROM validation_quality_metrics;
```

## Utility Functions

```sql
-- Get top style tags for a user
SELECT * FROM get_top_style_tags('user-id', 10);

-- Get Thompson Sampling recommendations
SELECT * FROM get_thompson_recommendations('user-id', 'garments');
```

## Best Practices

1. **Always track interactions** - Use Continuous Learning Agent for all user interactions
2. **Validate descriptors** - Use Validation Agent to prevent hallucinations
3. **Use Thompson Sampling** - Prefer Advanced Prompt Builder Agent over basic prompt builder
4. **Monitor performance** - Regularly check the database views for learning progress

## Troubleshooting

### Common Issues

1. **Missing database tables** - Run the migration script:
   ```bash
   psql $DATABASE_URL -f database/migrations/008_enhanced_rlhf_pipeline.sql
   ```

2. **Foreign key constraint errors** - Ensure referenced records exist in parent tables

3. **UUID format errors** - Ensure all IDs are proper UUID format

### Verification

Run the verification script to ensure all components work:
```bash
node verify-enhanced-agents.js
```

## Testing

The test script verifies all components work together:
```bash
node test-enhanced-rlhf.js
```

## Conclusion

The enhanced RLHF pipeline provides significant improvements in accuracy and learning speed. By following the integration patterns shown in podna.js and using the enhanced agents, you can take advantage of all the improvements while maintaining compatibility with existing systems.
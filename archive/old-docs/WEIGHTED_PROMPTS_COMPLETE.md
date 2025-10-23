# Weighted Prompts Implementation - Complete

## Overview
Implemented weighted prompts with brackets to ensure the image generation service always uses the PromptGeneratorAgent, creating dynamic, varied prompts for every image generation.

## Changes Made

### 1. PromptGeneratorAgent Enhancement

#### Added Weight System
```javascript
this.weights = {
  garment: 1.4,        // Very important
  silhouette: 1.3,     // Very important
  styleTag: 1.2,       // Important
  model: 1.3,          // Important for representation
  material: 1.1,       // Somewhat important
  setting: 1.0,        // Normal importance
  quality: 1.1         // Somewhat important
};
```

#### Syntax Usage
- **Parentheses with weights**: `(element:weight)` - Strong emphasis
- **Brackets**: `[element]` - Subtle emphasis
- **Plain text**: Normal importance

#### Example Output

**Before:**
```
professional fashion photography, dress, fitted silhouette, neutral tones, contemporary professional style, wool material, studio backdrop, high fashion editorial, timeless aesthetic
```

**After (with weights and model characteristics):**
```
professional fashion photography, (dress:1.4), (fitted silhouette:1.3), neutral tones, (contemporary professional style:1.2), (medium skin tone model:1.3), (female model:1.3), (25-35 age:1.3), (wool material:1.1), studio backdrop, (high fashion editorial:1.1), timeless aesthetic, [asymmetric details]
```

### 2. Model Characteristics Integration

The prompts now include:
- **Skin tones**: light, medium, dark, olive
- **Gender**: male, female, non-binary
- **Age ranges**: 18-24, 25-35, 36-50, 50+
- **Ethnicities**: Various representations

All model characteristics are **weighted at 1.3** for strong adherence.

### 3. Generation Endpoint Update

Modified `/api/agents/generate` to:
1. **Always fetch** the user's style profile
2. **Always use** PromptGeneratorAgent for every image
3. **Include user prompt** as a modifier to the generated prompt
4. **Log weight and bracket usage** for debugging

```javascript
// Generate prompts using PromptGeneratorAgent (with weights and brackets)
const promptGeneratorAgent = require('../../services/promptGeneratorAgent');
const prompts = promptGeneratorAgent.generateBatch(styleProfile, quantity, {
  userModifiers: [prompt] // Include user's text as modifier
});
```

### 4. Logging Enhancements

Every generated prompt now logs:
- Whether it has weights (contains `:`)
- Whether it has brackets (contains `[` or `(`)
- Number of model characteristics included
- Preview of the generated prompt

```javascript
logger.info(`Generated ${prompts.length} weighted prompts with agent`, {
  userId: req.user.id,
  examples: prompts.slice(0, 2).map(p => ({
    preview: p.mainPrompt.substring(0, 100) + '...',
    hasWeights: p.mainPrompt.includes(':'),
    hasBrackets: p.mainPrompt.includes('[') || p.mainPrompt.includes('(')
  }))
});
```

## Benefits

### 1. **Consistency**
Every image generation (onboarding and regular) uses the same PromptGeneratorAgent.

### 2. **Control**
Weights allow fine-tuning which elements the model prioritizes:
- Garment type (1.4) - Most important
- Silhouette (1.3) - Very important
- Model characteristics (1.3) - Ensures diversity
- Style tags (1.2) - Important for aesthetic
- Materials/Quality (1.1) - Subtle guidance

### 3. **Diversity**
- Uses rotation algorithm (`_selectWithVariation`) to cycle through options
- Includes model characteristics from portfolio analysis
- Explores different combinations each time

### 4. **Transparency**
- All prompts are logged with full details
- Stored in database with metadata
- Easy to debug and improve

## Weight Guidelines

| Weight | Use Case | Example |
|--------|----------|---------|
| 1.4+ | Critical elements | Garment type |
| 1.2-1.3 | Important elements | Silhouette, style, models |
| 1.0-1.1 | Supporting elements | Materials, quality |
| Brackets `[]` | Subtle hints | Design details |

## Testing

### Check Weighted Prompts
1. Complete onboarding with portfolio
2. Generate new images via `/api/agents/generate`
3. Check backend logs for:
   ```
   hasWeights: true
   hasBrackets: true
   modelCharacteristics: 3
   ```

### Verify in Database
```sql
SELECT 
  vlt_analysis->>'promptText' as prompt,
  vlt_analysis->'hasWeights' as has_weights
FROM images 
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 5;
```

## Example Logs

```
Generated 10 weighted prompts with agent {
  userId: 'user-123',
  examples: [
    {
      preview: 'professional fashion photography, (dress:1.4), (fitted silhouette:1.3), neutral tones...',
      hasWeights: true,
      hasBrackets: true
    },
    {
      preview: 'professional fashion photography, (jacket:1.4), (relaxed silhouette:1.3), beige tones...',
      hasWeights: true,
      hasBrackets: true
    }
  ]
}

Generating image 1/10 {
  hasWeights: true,
  hasBrackets: true,
  modelCharacteristics: 3
}
```

## Future Enhancements

1. **Dynamic Weights**: Adjust weights based on user feedback (RLHF)
2. **Regional Weights**: Different weights for different prompt sections
3. **Negative Weights**: Reduce emphasis on certain elements
4. **Bracket Variations**: Use different bracket types for different emphasis levels

## Related Files

- `src/services/promptGeneratorAgent.js` - Main agent implementation
- `src/api/routes/agents.js` - Generation endpoints
- `PROMPT_MODEL_CHARACTERISTICS_FIX.md` - Model characteristics documentation

# Fix: Enforce 50-Word Prompt Limit

## Problem Summary
Current prompts are ~90-150 words, but image generation APIs work best with 30-50 words max.

## Files to Modify

### 1. `src/services/promptTemplateService.js`

#### Change 1: Update `_assemblePrompt()` method (line 932)

**Before:**
```javascript
_assemblePrompt(components) {
  const { core, learned, exploratory, user, template } = components;
  
  const allParts = [
    core,
    ...learned,
    ...exploratory,
    ...user
  ].filter(p => p && p.length > 0);
  
  const text = allParts.join(', ');
  
  return {
    text,
    length: text.length,
    tokenCount: text.split(/[\s,]+/).length
  };
}
```

**After:**
```javascript
_assemblePrompt(components, maxWords = 50) {
  const { core, learned, exploratory, user, template } = components;
  
  // Prioritize components (core most important, exploratory least)
  const prioritized = [
    { parts: [core], priority: 1, weight: 0.6 },           // 60% of budget
    { parts: learned, priority: 2, weight: 0.25 },         // 25% of budget
    { parts: user, priority: 3, weight: 0.10 },            // 10% of budget
    { parts: exploratory, priority: 4, weight: 0.05 }      // 5% of budget
  ];
  
  const tokens = [];
  let currentWordCount = 0;
  
  // Allocate words based on priority and weight
  for (const { parts, priority, weight } of prioritized) {
    const allocated = Math.floor(maxWords * weight);
    let used = 0;
    
    for (const part of parts) {
      if (!part) continue;
      
      const partWords = part.split(/[\s,]+/).filter(w => w.length > 0);
      const partWordCount = partWords.length;
      
      if (currentWordCount + partWordCount <= maxWords && used + partWordCount <= allocated) {
        tokens.push(part);
        currentWordCount += partWordCount;
        used += partWordCount;
      } else {
        // Truncate if we're close to limit
        const remaining = Math.min(maxWords - currentWordCount, allocated - used);
        if (remaining > 0) {
          tokens.push(partWords.slice(0, remaining).join(' '));
          currentWordCount += remaining;
        }
        break;
      }
    }
    
    if (currentWordCount >= maxWords) {
      logger.debug('Reached max word limit', { currentWordCount, maxWords });
      break;
    }
  }
  
  const text = tokens.join(', ');
  const actualWordCount = text.split(/[\s,]+/).filter(w => w.length > 0).length;
  
  return {
    text,
    length: text.length,
    tokenCount: actualWordCount,
    truncated: actualWordCount >= maxWords,
    maxWords: maxWords,
    budget: {
      core: Math.floor(maxWords * 0.6),
      learned: Math.floor(maxWords * 0.25),
      user: Math.floor(maxWords * 0.10),
      exploratory: Math.floor(maxWords * 0.05)
    }
  };
}
```

#### Change 2: Simplify core template structure (line ~240-450)

**Reduce template verbosity** - find the `_generateTemplatesFromClusters()` method and update the structure:

**Before** (example cluster template):
```javascript
structure: {
  quality: [
    "high fashion photography",
    "professional product shot",
    "studio quality",
    "8k resolution",
    "sharp focus"
  ],
  composition: [
    "full body shot",
    "3/4 angle",
    "professional fashion model",
    "confident pose"
  ],
  garment: [
    "{garment_type}",
    "fitted silhouette",
    "{neckline} neckline",
    "{sleeve_length}",
    "{length} length"
  ],
  color: [
    "black color palette",
    "{finish} finish",
    "rich tones"
  ],
  style: [
    "contemporary style",
    "sophisticated mood",
    "refined aesthetic"
  ],
  lighting: [
    "sophisticated studio lighting",
    "subtle dramatic shadows",
    "professional key light"
  ],
  background: [
    "clean minimal background",
    "soft gray or white",
    "professional studio setup"
  ],
  details: [
    "perfect fabric drape",
    "detailed texture",
    "impeccable tailoring"
  ]
}
```

**After** (condensed, essential only):
```javascript
structure: {
  // Combine into single streamlined array (15-20 words max)
  core: [
    "professional fashion photography",                    // Quality
    "{garment_type}",                                      // Garment
    "{silhouette} silhouette",                            
    `${dominantColor} color palette`,                      // Color from cluster
    `${dominantStyle} style`,                              // Style from cluster
    "studio lighting",                                     // Lighting
    "clean background"                                     // Background
  ]
}
```

Update the `_buildCorePrompt()` method (line ~753):

**Before:**
```javascript
_buildCorePrompt(vltSpec, template) {
  const parts = [];
  
  parts.push(...template.structure.quality);
  // ... (adds ALL sections)
  
  return parts.join(', ');
}
```

**After:**
```javascript
_buildCorePrompt(vltSpec, template) {
  // Use condensed core structure
  const core = template.structure.core.map(c => 
    this._replacePlaceholders(c, vltSpec)
  );
  
  return core.join(', ');
}
```

#### Change 3: Update `generatePrompt()` to pass maxWords

**Line 75 - Update call to `_assemblePrompt()`:**

```javascript
// Step 6: Assemble final prompt with word limit
const maxWords = options.maxWords || 50;  // Default to 50 words
const finalPrompt = this._assemblePrompt({
  core: corePrompt,
  learned: learnedModifiers,
  exploratory: exploratoryTokens,
  user: userTokens,
  template: template
}, maxWords);
```

---

### 2. `src/services/promptEnhancementService.js`

#### Change: Update system prompt word count (line 150)

**Before:**
```javascript
6. Generate prompts that are 150-300 words
```

**After:**
```javascript
6. Generate prompts that are 30-50 words MAXIMUM - be concise and impactful
```

---

### 3. Add Configuration Option

Create `config/promptConfig.js`:

```javascript
module.exports = {
  prompt: {
    maxWords: 50,
    minWords: 20,
    budgetAllocation: {
      core: 0.60,        // 60% - Most important (base description)
      learned: 0.25,     // 25% - RLHF tokens (learned preferences)
      user: 0.10,        // 10% - User custom additions
      exploratory: 0.05  // 5% - Exploration/discovery
    },
    providers: {
      'google-imagen': { maxWords: 50, recommended: 40 },
      'google-gemini': { maxWords: 60, recommended: 45 },
      'stable-diffusion-xl': { maxWords: 75, recommended: 50 },
      'openai-dalle3': { maxWords: 400, recommended: 50 }  // DALL-E 3 supports longer prompts
    }
  }
};
```

Then use in `promptTemplateService.js`:

```javascript
const promptConfig = require('../config/promptConfig');

// In generatePrompt():
const providerConfig = promptConfig.prompt.providers[options.provider || 'google-imagen'];
const maxWords = options.maxWords || providerConfig.recommended || 50;
```

---

## Testing

### Test 1: Verify Word Count Limit

```javascript
// test/services/promptTemplateService.test.js

describe('Prompt Length Limiting', () => {
  it('should limit prompts to 50 words', async () => {
    const vltSpec = {
      garmentType: 'dress',
      silhouette: 'fitted',
      colors: { primary: 'black' }
    };
    
    const styleProfile = {
      clusters: [{ 
        dominant_attributes: { 
          color: ['black', 5],
          style_aesthetic: ['elegant', 4]
        }
      }]
    };
    
    const result = await promptTemplateService.generatePrompt(
      vltSpec, 
      styleProfile, 
      { userId: 'test-user', maxWords: 50 }
    );
    
    const wordCount = result.mainPrompt.split(/[\s,]+/).filter(w => w.length > 0).length;
    
    expect(wordCount).toBeLessThanOrEqual(50);
    expect(result.metadata.components.core.editable).toBe(false);
  });
  
  it('should prioritize core over exploratory tokens when truncating', async () => {
    // ... test that core always appears, exploratory dropped first
  });
});
```

### Test 2: Manual Check

```bash
# Generate a prompt and check length
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-123",
    "prompt": "elegant evening dress",
    "settings": { "maxWords": 50 }
  }'

# Response should include:
{
  "mainPrompt": "...",  // Check word count
  "metadata": {
    "tokenCount": 42,   // Should be <= 50
    "truncated": false,
    "maxWords": 50
  }
}
```

---

## Migration Plan

1. **Phase 1**: Add word counting and logging (no truncation yet)
   - Update `_assemblePrompt()` to track word counts
   - Log prompts that exceed 50 words
   - Collect data on typical prompt lengths

2. **Phase 2**: Add truncation logic with high limit (75 words)
   - Implement priority-based truncation
   - Set maxWords to 75 (soft enforcement)
   - Monitor for issues

3. **Phase 3**: Reduce to target limit (50 words)
   - Simplify core templates
   - Set maxWords to 50
   - Fine-tune budget allocation

4. **Phase 4**: Optimize for quality
   - A/B test different word counts
   - Compare image quality metrics
   - Adjust based on user feedback

---

## Expected Impact

### Before Fix
```
Prompt: "high fashion photography, professional product shot, studio quality, 
8k resolution, sharp focus, full body shot, 3/4 angle, professional fashion model, 
confident pose, dress, fitted silhouette, round neckline, sleeveless, midi length, 
black color palette, matte finish, rich tones, contemporary style, sophisticated mood, 
refined aesthetic, sophisticated studio lighting, subtle dramatic shadows, 
professional key light, clean minimal background, soft gray or white, 
professional studio setup, perfect fabric drape, detailed texture, 
impeccable tailoring, contemporary aesthetic, sophisticated mood, luxury fashion"

Word Count: 95 words
Issue: Too verbose, dilutes key details
```

### After Fix
```
Prompt: "professional fashion photography, elegant black dress, fitted silhouette, 
contemporary sophisticated style, sleeveless midi length, studio lighting, 
confident pose, clean background, luxury aesthetic"

Word Count: 27 words
Result: Focused, impactful, optimal for image generation
```

### Benefits
✅ Better image quality (models focus on key details)
✅ Faster generation (less text to process)
✅ More consistent results (less ambiguity)
✅ Still personalized (your style clusters preserved)
✅ RLHF still works (learned tokens prioritized)

---

## Quick Implementation Script

Run this to apply all fixes at once:

```bash
# Backup current files
cp src/services/promptTemplateService.js src/services/promptTemplateService.js.backup
cp src/services/promptEnhancementService.js src/services/promptEnhancementService.js.backup

# Apply fixes (you'll need to manually edit the files based on this guide)
# Or create patches:

cat > /tmp/prompt-length-fix.patch << 'EOF'
# Paste git diff output here after manual changes
EOF

git apply /tmp/prompt-length-fix.patch
```

Would you like me to create the actual code patches for you to apply?

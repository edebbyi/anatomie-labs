# How Prompt Generation Actually Works

## Important Clarifications

### LLM Usage
**YES, there IS an LLM option** - but it's **NOT the default!**

- **`promptEnhancementService.js`** (Stage 2): Uses Claude 3.5 Sonnet or GPT-4 to generate 150-300 word prompts
- **`promptTemplateService.js`** (Stage 3): NO LLM - uses template-based generation with RLHF

**Current Flow:**
```javascript
// generationService.js line 101-157
const fashionPrompt = await promptTemplateService.generatePrompt(vltSpec, styleProfile, {...});
// ↑ This uses TEMPLATES, not LLM!

// The LLM service (promptEnhancementService) exists but is NOT being called in current flow
```

### Prompt Length Issue ⚠️
**You're right - prompts are TOO LONG!**

The current system generates **~100-150 word prompts** but image generation APIs work best with **~50 words max**.

**The Problem:**
- Line 948: `tokenCount: text.split(/[\s,]+/).length` - tracks word count but doesn't enforce limits
- Line 797: `return parts.join(', ')` - combines ALL parts without truncation
- Line 150 (promptEnhancementService): "Generate prompts that are 150-300 words" ❌

---

## Step-by-Step Process (Template-Based, Current Implementation)

### INPUT
```javascript
{
  userId: "test-user-123",
  prompt: "elegant evening dress",
  vltSpec: {
    garmentType: "dress",
    silhouette: "fitted",
    colors: { primary: "black" },
    style: { overall: "elegant" }
  }
}
```

---

### STEP 1: Fetch Style Profile (generationService.js, line 107-130)

```javascript
// Backend fetches your clusters from ML service
const response = await axios.get('http://localhost:8001/api/style-profile/test-user-123');

styleProfile = {
  n_clusters: 3,
  clusters: [
    {
      id: 1,
      size: 5,
      percentage: 62.5,
      dominant_attributes: {
        color: ["black", 4],
        style_aesthetic: ["elegant", 4],
        style_overall: ["contemporary", 5],
        style_mood: ["sophisticated", 5]
      },
      style_summary: "contemporary, black tones"
    },
    {
      id: 2,
      percentage: 25.0,
      dominant_attributes: {
        color: ["beige", 1],
        style_aesthetic: ["casual", 2]
      },
      style_summary: "contemporary, beige tones"
    },
    {
      id: 0,
      percentage: 12.5,
      dominant_attributes: {
        style_aesthetic: ["romantic", 1]
      },
      style_summary: "contemporary, black tones"
    }
  ]
}
```

---

### STEP 2: Generate Templates from Clusters (promptTemplateService.js, line 50)

```javascript
const templates = this._getUserTemplates(userId, styleProfile);
```

#### What happens inside `_getUserTemplates()`:

**Code** (line 174-205):
```javascript
_getUserTemplates(userId, styleProfile) {
  // Check if we have style profile
  if (!styleProfile || !styleProfile.clusters) {
    return this.genericTemplates; // Fallback
  }
  
  // Generate templates from YOUR clusters
  const templates = this._generateTemplatesFromClusters(styleProfile);
  return templates;
}
```

**Result**: 3 templates created, one per cluster:

```javascript
templates = {
  "cluster_1": {
    id: "cluster_1",
    name: "Contemporary Black Elegance",  // Your dominant style
    percentage: 62.5,
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
        "{garment_type}",          // Will be replaced with "dress"
        "fitted silhouette",        // From your cluster
        "{neckline} neckline",
        "{sleeve_length}",
        "{length} length"
      ],
      style: [
        "contemporary style",       // From your cluster
        "sophisticated mood",       // From your cluster
        "refined aesthetic"
      ],
      color: [
        "black color palette",      // From your cluster (62.5% of your portfolio is black!)
        "{finish} finish",
        "rich tones"
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
    },
    modifiers: {
      high_reward: [
        "magazine editorial quality",
        "contemporary aesthetic",      // From YOUR portfolio
        "elegant design language",     // From YOUR portfolio
        "sophisticated mood",          // From YOUR portfolio
        "luxury fashion",
        "designer quality"
      ],
      medium_reward: [
        "black palette",              // From YOUR portfolio
        "black tones",                // From YOUR portfolio
        "signature style",
        "brand aesthetic"
      ]
    }
  },
  "cluster_2": { ... },  // Contemporary Casual
  "cluster_3": { ... }   // Romantic Contemporary
}
```

**Key Point**: The template is built FROM YOUR ACTUAL PORTFOLIO ANALYSIS! It knows:
- 62.5% of your designs are black
- Your style is "contemporary elegant sophisticated"
- Your aesthetic preferences

---

### STEP 3: Select Best Template (promptTemplateService.js, line 53)

```javascript
const template = this._selectTemplate(vltSpec, styleProfile, templates);
```

**Logic**:
- Looks at the VLT spec: `{ garmentType: "dress", style: { overall: "elegant" } }`
- Matches to your **Cluster 1** (Contemporary Black Elegance) - 62.5%
- This is your dominant cluster, so it's selected

**Result**: Uses `cluster_1` template

---

### STEP 4: Build Core Prompt (promptTemplateService.js, line 56)

```javascript
const corePrompt = this._buildCorePrompt(vltSpec, template);
```

**What happens**:
1. Takes template structure
2. Replaces placeholders with VLT data
3. Combines all elements

**Code** (line 753-789):
```javascript
_buildCorePrompt(vltSpec, template) {
  const parts = [];
  
  // Quality modifiers
  parts.push(...template.structure.quality);
  // → ["high fashion photography", "professional product shot", "studio quality", "8k resolution", "sharp focus"]
  
  // Composition with VLT data
  const composition = template.structure.composition.map(c => 
    this._replacePlaceholders(c, vltSpec)
  );
  parts.push(...composition);
  // → ["full body shot", "3/4 angle", "professional fashion model", "confident pose"]
  
  // Garment description
  const garment = template.structure.garment.map(g => 
    this._replacePlaceholders(g, vltSpec)
  );
  parts.push(...garment);
  // → ["dress", "fitted silhouette", "round neckline", "sleeveless", "midi length"]
  
  // Colors (from YOUR cluster!)
  const colors = template.structure.color.map(c => 
    this._replacePlaceholders(c, vltSpec)
  );
  parts.push(...colors);
  // → ["black color palette", "matte finish", "rich tones"]
  
  // Style (from YOUR cluster!)
  parts.push(...template.structure.style);
  // → ["contemporary style", "sophisticated mood", "refined aesthetic"]
  
  // Lighting
  parts.push(...template.structure.lighting);
  // → ["sophisticated studio lighting", "subtle dramatic shadows", "professional key light"]
  
  // Background
  parts.push(...template.structure.background);
  // → ["clean minimal background", "soft gray or white", "professional studio setup"]
  
  // Details
  parts.push(...template.structure.details);
  // → ["perfect fabric drape", "detailed texture", "impeccable tailoring"]
  
  return parts.join(', ');
}
```

**Result - Core Prompt** (~90 words - TOO LONG!):
```
"high fashion photography, professional product shot, studio quality, 8k resolution, 
sharp focus, full body shot, 3/4 angle, professional fashion model, confident pose, 
dress, fitted silhouette, round neckline, sleeveless, midi length, black color palette, 
matte finish, rich tones, contemporary style, sophisticated mood, refined aesthetic, 
sophisticated studio lighting, subtle dramatic shadows, professional key light, 
clean minimal background, soft gray or white, professional studio setup, perfect fabric drape, 
detailed texture, impeccable tailoring"
```

⚠️ **PROBLEM**: This is ~90 words. Most image APIs perform better with 30-50 words!

---

### STEP 5: RLHF Token Selection (promptTemplateService.js, line 59)

```javascript
const learnedModifiers = await this._selectLearnedModifiers(
  vltSpec, styleProfile, userId, exploreMode
);
```

**What happens** (line 803-877):

```javascript
async _selectLearnedModifiers(vltSpec, styleProfile, userId, exploreMode) {
  const template = this._selectTemplate(vltSpec, styleProfile);
  
  // Get tokens from YOUR template
  const highRewardTokens = template.modifiers.high_reward;
  // → ["magazine editorial quality", "contemporary aesthetic", "elegant design language", 
  //    "sophisticated mood", "luxury fashion", "designer quality"]
  
  const mediumRewardTokens = template.modifiers.medium_reward;
  // → ["black palette", "black tones", "signature style", "brand aesthetic"]
  
  // Categorize tokens by type
  const categorizedTokens = this._categorizeTokensForRLHF([
    ...highRewardTokens,
    ...mediumRewardTokens
  ], vltSpec);
  
  // Result:
  // {
  //   lighting: [],
  //   composition: [],
  //   style: ["contemporary aesthetic", "elegant design language", "signature style", "brand aesthetic"],
  //   quality: ["magazine editorial quality", "luxury fashion", "designer quality"],
  //   mood: ["sophisticated mood"],
  //   modelPose: []
  // }
  
  const selectedTokens = [];
  
  // For each category, ask RLHF service for best tokens
  for (const [category, tokens] of Object.entries(categorizedTokens)) {
    if (tokens.length > 0) {
      // Query learned weights from database
      const rlhfSelected = await rlhfWeightService.selectTokens(
        userId,     // "test-user-123"
        category,   // "style"
        count       // 2
      );
      
      // RLHF uses epsilon-greedy:
      // - 85% chance: Pick tokens with highest weights
      // - 15% chance: Pick random tokens (exploration)
      
      selectedTokens.push(...rlhfSelected);
    }
  }
  
  return selectedTokens;
}
```

**RLHF Logic** (rlhfWeightService.js, line 135-164):
```javascript
async selectTokens(userId, category, count = 3) {
  // Get weights from database
  const weights = await this.getWeights(userId, category);
  // If no learned weights yet, use defaults (all 1.0)
  
  // Epsilon-greedy: 15% exploration, 85% exploitation
  if (Math.random() < 0.15) {
    // EXPLORE: Random selection
    return this._randomSelect(Object.keys(weights), count);
  } else {
    // EXPLOIT: Select highest weighted tokens
    const sortedTokens = Object.entries(weights)
      .sort(([, a], [, b]) => b - a)  // Sort by weight descending
      .map(([token]) => token);
    
    return sortedTokens.slice(0, count);  // Top N
  }
}
```

**Result - RLHF Selected Tokens** (example):
```javascript
[
  "contemporary aesthetic",      // weight: 1.0 (no feedback yet)
  "sophisticated mood",          // weight: 1.0
  "luxury fashion"               // weight: 1.0
]
```

**Note**: After users save/share images, these weights will increase (up to 2.0) or decrease (down to 0.0), making better tokens more likely to be selected!

---

### STEP 6: Optional Exploration Tokens (promptTemplateService.js, line 67)

```javascript
const exploratoryTokens = exploreMode ? 
  this._generateExploratoryTokens(template, vltSpec) : [];
```

**If exploreMode = true** (20% of generations):
```javascript
// Borrow tokens from other templates for discovery
exploratoryTokens = [
  "architectural precision",  // From minimalist template
  "fluid dynamics"           // Random novel descriptor
]
```

**If exploreMode = false** (80% of generations):
```javascript
exploratoryTokens = []
```

---

### STEP 7: User Modifiers (promptTemplateService.js, line 71)

```javascript
const userTokens = userModifiers || [];
```

If user provides custom tokens via UI:
```javascript
userTokens = ["vintage inspired", "art deco elements"]
```

Otherwise:
```javascript
userTokens = []
```

---

### STEP 8: Assemble Final Prompt (promptTemplateService.js, line 74)

```javascript
const finalPrompt = this._assemblePrompt({
  core: corePrompt,
  learned: learnedModifiers,
  exploratory: exploratoryTokens,
  user: userTokens,
  template: template
});
```

**Code** (line 880-898):
```javascript
_assemblePrompt(components) {
  const { core, learned, exploratory, user, template } = components;
  
  // Combine all parts
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

**FINAL ASSEMBLED PROMPT** (~95 words - TOO LONG!):
```
"high fashion photography, professional product shot, studio quality, 8k resolution, 
sharp focus, full body shot, 3/4 angle, professional fashion model, confident pose, 
dress, fitted silhouette, round neckline, sleeveless, midi length, black color palette, 
matte finish, rich tones, contemporary style, sophisticated mood, refined aesthetic, 
sophisticated studio lighting, subtle dramatic shadows, professional key light, 
clean minimal background, soft gray or white, professional studio setup, perfect fabric drape, 
detailed texture, impeccable tailoring, contemporary aesthetic, sophisticated mood, 
luxury fashion"
```

⚠️ **PROBLEM**: Final prompt is ~95 words! Should be max 50 words for optimal image generation.

---

### STEP 9: Generate Negative Prompt (promptTemplateService.js, line 83)

```javascript
const negativePrompt = this._generateNegativePrompt(vltSpec, template);
```

**Result**:
```
"blurry, low quality, pixelated, distorted, bad anatomy, poorly rendered, amateur, 
wrinkled fabric, stained, damaged clothing, overexposed, underexposed, bad lighting, 
cropped awkwardly, cluttered background, watermark, text, logo"
```

---

### STEP 10: Return Complete Prompt (promptTemplateService.js, line 92)

```javascript
return {
  mainPrompt: finalPrompt.text,
  negativePrompt: negativePrompt,
  metadata: {
    templateId: "cluster_1",
    templateName: "Contemporary Black Elegance",
    exploreMode: false,
    rlhfTokensUsed: {
      style: ["contemporary aesthetic", "sophisticated mood"],
      quality: ["luxury fashion"]
    },
    components: {
      core: { ... },
      learned: { ... },
      exploratory: { ... },
      user: { ... }
    }
  }
}
```

---

## OUTPUT - What Gets Sent to Image Generation API

### Main Prompt:
```
"high fashion photography, professional product shot, studio quality, 8k resolution, 
sharp focus, full body shot, 3/4 angle, professional fashion model, confident pose, 
dress, fitted silhouette, round neckline, sleeveless, midi length, black color palette, 
matte finish, rich tones, contemporary style, sophisticated mood, refined aesthetic, 
sophisticated studio lighting, subtle dramatic shadows, professional key light, 
clean minimal background, soft gray or white, professional studio setup, perfect fabric drape, 
detailed texture, impeccable tailoring, contemporary aesthetic, sophisticated mood, 
luxury fashion"
```

### Negative Prompt:
```
"blurry, low quality, pixelated, distorted, bad anatomy, poorly rendered, amateur, 
wrinkled fabric, stained, damaged clothing, overexposed, underexposed, bad lighting, 
cropped awkwardly, cluttered background, watermark, text, logo"
```

---

## Key Points

### 1. **Template is Built from YOUR Portfolio**
- 62.5% black → "black color palette" in prompt
- Contemporary style → "contemporary style" in prompt
- Sophisticated mood → "sophisticated mood" in prompt

### 2. **RLHF Learns Over Time**
When users interact with generated images:
- **Save/Share** → Increases weight of tokens used (up to 2.0)
- **Dislike/Delete** → Decreases weight (down to 0.0)
- Future generations use higher-weighted tokens more often

### 3. **Exploration vs Exploitation**
- **85% of time**: Use best-known tokens (exploitation)
- **15% of time**: Try random tokens (exploration)
- This balances consistency with discovery

### 4. **Personalization Layers**
1. **Core**: From template (YOUR portfolio clusters)
2. **RLHF**: Learned from feedback (YOUR preferences)
3. **Exploratory**: Random discovery (new possibilities)
4. **User**: Custom additions (YOUR creative input)

---

## Comparison: Generic vs Personalized

### WITHOUT Your Clusters (Generic):
```
"high fashion photography, professional model, elegant evening dress, 
sophisticated style, studio lighting, high resolution"
```
→ Generic, could be anyone's prompt

### WITH Your Clusters (Personalized):
```
"high fashion photography, professional product shot, studio quality, 8k resolution, 
sharp focus, full body shot, 3/4 angle, professional fashion model, confident pose, 
dress, fitted silhouette, round neckline, sleeveless, midi length, black color palette, 
matte finish, rich tones, contemporary style, sophisticated mood, refined aesthetic, 
sophisticated studio lighting, subtle dramatic shadows, professional key light, 
clean minimal background, soft gray or white, professional studio setup, perfect fabric drape, 
detailed texture, impeccable tailoring, contemporary aesthetic, sophisticated mood, 
luxury fashion"
```
→ Specific to YOUR "Contemporary Black Elegance" aesthetic!

---

## Summary

Prompt generation is a **multi-layered personalization system**:

1. Analyzes YOUR portfolio → Creates style clusters
2. Builds templates FROM your clusters → "Contemporary Black Elegance"
3. Selects tokens using RLHF weights → Learns what YOU like
4. Combines everything → Highly personalized prompt
5. Sends to image API → Generates images matching YOUR aesthetic
6. Learns from feedback → Gets better over time

**Every part of the prompt is influenced by YOUR unique style!** 🎨

---

## Issues to Fix

### 1. ❌ Prompts Are Too Long
**Current**: ~90-150 words
**Recommended**: 30-50 words max

**Why?**
- Image models (DALL-E, Stable Diffusion, Imagen) work best with concise prompts
- Long prompts dilute important details
- Can cause model confusion or ignore later tokens

### 2. 🔀 LLM Service Exists But Isn't Used
**`promptEnhancementService.js`** has Claude/GPT integration but:
- It's not called in the current generation flow
- It generates 150-300 word prompts (even worse!)
- Line 150: `"Generate prompts that are 150-300 words"` should be 30-50

### 3. 📊 No Truncation Logic
**`promptTemplateService.js` line 932-950:**
```javascript
_assemblePrompt(components) {
  const { core, learned, exploratory, user, template } = components;
  
  // Combine all parts
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
    tokenCount: text.split(/[\s,]+/).length  // ← Tracks count but doesn't limit!
  };
}
```

**Fix Needed**: Add word count limit and intelligent truncation.

---

## Recommended Fixes

### Fix 1: Add Word Limit to Template Assembly

```javascript
// src/services/promptTemplateService.js line 932
_assemblePrompt(components, maxWords = 50) {
  const { core, learned, exploratory, user, template } = components;
  
  // Prioritize components
  const prioritized = [
    { parts: [core], priority: 1 },                    // Core is most important
    { parts: learned, priority: 2 },                   // RLHF tokens next
    { parts: user, priority: 3 },                      // User input
    { parts: exploratory, priority: 4 }                // Exploration least important
  ];
  
  // Build prompt up to word limit
  const tokens = [];
  let currentWordCount = 0;
  
  for (const { parts, priority } of prioritized) {
    for (const part of parts) {
      const partWords = part.split(/[\s,]+/).length;
      if (currentWordCount + partWords <= maxWords) {
        tokens.push(part);
        currentWordCount += partWords;
      } else if (currentWordCount < maxWords) {
        // Partial inclusion if close to limit
        const remaining = maxWords - currentWordCount;
        const partTokens = part.split(/[\s,]+/);
        tokens.push(partTokens.slice(0, remaining).join(' '));
        currentWordCount = maxWords;
        break;
      }
    }
    if (currentWordCount >= maxWords) break;
  }
  
  const text = tokens.join(', ');
  
  return {
    text,
    length: text.length,
    tokenCount: currentWordCount,
    truncated: currentWordCount >= maxWords,
    maxWords: maxWords
  };
}
```

### Fix 2: Reduce Core Template Verbosity

**Current core template** has TOO many elements:
- quality (5 tokens)
- composition (4 tokens)
- garment (5 tokens)
- color (3 tokens)
- style (3 tokens)
- lighting (3 tokens)
- background (3 tokens)
- details (3 tokens)

**= 29 tokens just for core!**

**Recommended**: Pick top 3-4 elements per template:

```javascript
structure: {
  // Only include essential elements (15-20 words max)
  core: [
    "professional fashion photography",     // Quality
    "{garment_type}",                       // Garment
    "{silhouette} silhouette",
    "black color palette",                   // Color (from YOUR cluster)
    "contemporary elegant style",            // Style (from YOUR cluster)
    "studio lighting",                       // Lighting
    "clean background"                       // Background
  ]
}
```

### Fix 3: Update LLM Service Prompt Length

```javascript
// src/services/promptEnhancementService.js line 150
buildSystemPrompt(options) {
  return `You are an expert fashion photographer and AI image generation prompt engineer.

GUIDELINES:
1. Use rich, descriptive fashion terminology
2. Include precise details about fabric, texture, construction, and fit
3. Specify professional photography elements (lighting, composition, styling)
4. Balance technical garment details with artistic vision
5. Optimize for ${options.style || 'professional'} aesthetic
6. Generate prompts that are 30-50 words MAX  ← CHANGED FROM 150-300!
7. Include negative prompts to avoid common AI artifacts
...`;
}
```

---

## Example: Before vs After

### ❌ BEFORE (95 words)
```
"high fashion photography, professional product shot, studio quality, 8k resolution, 
sharp focus, full body shot, 3/4 angle, professional fashion model, confident pose, 
dress, fitted silhouette, round neckline, sleeveless, midi length, black color palette, 
matte finish, rich tones, contemporary style, sophisticated mood, refined aesthetic, 
sophisticated studio lighting, subtle dramatic shadows, professional key light, 
clean minimal background, soft gray or white, professional studio setup, perfect fabric drape, 
detailed texture, impeccable tailoring, contemporary aesthetic, sophisticated mood, 
luxury fashion"
```

### ✅ AFTER (42 words)
```
"professional fashion photography, elegant black evening dress, fitted silhouette, 
contemporary sophisticated style, sleeveless midi length, studio lighting, 
confident pose, clean minimal background, perfect fabric drape, 
rich tones, luxury aesthetic"
```

**Result**: 
- More focused and impactful
- Keeps YOUR style signature (black, contemporary, sophisticated)
- Within optimal 30-50 word range
- Image models will produce better results! 🎨

# Example Generated Prompts with Model Gender Weighting

## How Model Gender Appears in Final Prompts

All examples show the actual prompt syntax that will be sent to Imagen/Flux/Stable Diffusion.

---

## Example 1: User Portfolio Has 70% Female Models

**User Settings:** `auto` (automatic detection)
**Portfolio Analysis Result:** 
- Feminine: 70%
- Masculine: 20%
- Androgynous: 10%
- **Detected Gender:** `female` (confidence: 0.70)

### Generated Prompt
```
[contemporary:1.4], [blazer with notched lapels, tailored construction:1.3], 
[wool gabardine fabric with pressed finish:1.2], [navy blue and cream palette:1.3], 
[three-quarter length shot:1.3], [standing front-facing:1.2], 
[stunning female model, elegant pose, feminine silhouette:1.3], 
[soft lighting from front:1.1], [3/4 front angle:1.2], [at eye level:1.0], 
[clean studio background:1.0], [professional fashion photography:1.3], 
[high detail:1.2], [8k:1.1], [sharp focus:1.0], [studio quality:1.0]
```

**What the Model Sees:**
- ✅ HIGH EMPHASIS (1.3+): contemporary, blazer description, colors, shot type, **female model**, photography quality
- ✅ MEDIUM EMPHASIS (1.1-1.2): fabric, pose, lighting, angle, detail
- ✅ NORMAL (1.0): background, focus, quality

**Result:** Images will consistently feature **female models** in elegant poses with tailored blazers

---

## Example 2: User Manually Selects "Male"

**User Settings:** `male` (manual override)
**Manual Override:** `true`

### Generated Prompt
```
[contemporary:1.4], [casual shirt jacket in denim:1.3], 
[denim fabric with worn texture:1.2], [medium blue and white palette:1.3], 
[three-quarter length shot:1.3], [standing front-facing:1.2], 
[stunning male model, strong presence, masculine bearing:1.3], 
[natural outdoor lighting from side:1.1], [3/4 front angle:1.2], 
[at eye level:1.0], [outdoor urban background:1.0], 
[professional fashion photography:1.3], [high detail:1.2], [8k:1.1], 
[sharp focus:1.0], [studio quality:1.0]
```

**Key Difference from Example 1:**
```
[stunning female model, elegant pose, feminine silhouette:1.3]
                    ↓ CHANGED TO ↓
[stunning male model, strong presence, masculine bearing:1.3]
```

**Result:** Images will feature **male models** with confident, strong posture

---

## Example 3: Batch Generation with "Both" Setting (Alternation)

**User Settings:** `both` (male/female alternation)
**Batch:** 6 image generation

### Generation 1 (Index: 0 - Even)
**Selected Gender:** `female`
```
..., [stunning female model, elegant pose, feminine silhouette:1.3], ...
```

### Generation 2 (Index: 1 - Odd)
**Selected Gender:** `male`
```
..., [stunning male model, strong presence, masculine bearing:1.3], ...
```

### Generation 3 (Index: 2 - Even)
**Selected Gender:** `female`
```
..., [stunning female model, elegant pose, feminine silhouette:1.3], ...
```

### Generation 4 (Index: 3 - Odd)
**Selected Gender:** `male`
```
..., [stunning male model, strong presence, masculine bearing:1.3], ...
```

### Generation 5 (Index: 4 - Even)
**Selected Gender:** `female`
```
..., [stunning female model, elegant pose, feminine silhouette:1.3], ...
```

### Generation 6 (Index: 5 - Odd)
**Selected Gender:** `male`
```
..., [stunning male model, strong presence, masculine bearing:1.3], ...
```

**Result:** Alternating pattern of female → male → female → male → female → male

---

## Example 4: Portfolio with Mixed Models (50/50)

**User Settings:** `auto`
**Portfolio Analysis Result:**
- Feminine: 48%
- Masculine: 47%
- Androgynous: 5%
- **Detected Gender:** `both` (mixed, too close to distinguish)

### Generated Prompt
```
[contemporary:1.4], [evening gown with flowing fabric:1.3], 
[silk charmeuse fabric with luxurious drape:1.2], [deep burgundy and champagne palette:1.3], 
[full-body fashion shot:1.3], [model turning slightly:1.2], 
[diverse models, mixed gender representation, inclusive casting:1.3], 
[dramatic theatrical lighting:1.1], [front angle with slight turn:1.2], 
[at eye level:1.0], [studio backdrop with gradient:1.0], 
[professional fashion photography:1.3], [high detail:1.2], [8k:1.1], 
[sharp focus:1.0], [studio quality:1.0]
```

**Note:** Uses `diverse models` prompt instead of specific gender
**Result:** Models of various genders for inclusive fashion presentation

---

## Example 5: "Auto" Mode with No Prior Analysis

**User Settings:** `auto`
**Portfolio Analysis:** Not yet completed OR no gender data
**Fallback Gender:** `both`

### Generated Prompt
```
..., [diverse models, mixed gender representation, inclusive casting:1.3], ...
```

**Result:** Default to showing diverse models until portfolio is analyzed

---

## Understanding Weight Impact

### Weight 1.3 (What We Use for Model Gender)
The model pays 30% more attention to this instruction.

**Comparison with other weights in the prompt:**
```
1.4 - Contemporary (highest weight, dominant aesthetic)
1.3 - Model Gender, Garment Type, Colors (PRIMARY ELEMENTS)
1.2 - Fabric, Pose, Angle (secondary details)
1.1 - Lighting, Details (refinement)
1.0 - Background, Focus, Quality (foundation)
```

**Visual Impact:**
- If prompt says `[stunning female model:1.3]`, the AI will:
  - Generate female anatomy ✅
  - Position body elegantly ✅
  - Use feminine styling cues ✅

- If weight was `[stunning female model:0.8]`, the AI might:
  - Sometimes ignore the instruction
  - Could generate androgynous or male models
  - Less reliable

---

## Where These Prompts Are Used

### 1. During Image Generation
```javascript
// In /src/routes/generation.js
const prompt = await IntelligentPromptBuilder.generatePrompt(userId, {
  garmentType: 'blazer',
  season: 'fall',
  creativity: 0.3
});

// Result: Full weighted prompt with model gender
// Sent to Replicate/Imagen API
```

### 2. In Batch Generation
```javascript
// When generating 4 images with 'both' setting:
for (let i = 0; i < 4; i++) {
  const prompt = await IntelligentPromptBuilder.generatePrompt(userId, {
    garmentType: 'blazer',
    generationIndex: i  // 0, 1, 2, 3
    // Used for alternation: 0,2=female, 1,3=male
  });
}
```

### 3. In Voice Commands
```javascript
// User says: "Create 3 looks with a blazer"
// System generates 3 prompts, possibly alternating genders
```

---

## Debugging: How to Check Your Prompts

### 1. In Browser Console (Frontend)
When you generate images, check the network request:
```javascript
// Look for the POST to /api/generate
// Response will include:
{
  "success": true,
  "generation": {
    "prompt": "[contemporary:1.4], [blazer:1.3], ... [stunning female model:1.3] ...",
    "model_gender_applied": true,
    "user_gender_preference": {
      "setting": "auto",
      "detected_gender": "female"
    }
  }
}
```

### 2. In Server Logs
```
[2024-01-15 10:30:45] Added model gender to prompt
{
  userId: "abc-123",
  gender: "female",
  setting: "auto",
  confidence: 0.70
}
```

### 3. Direct API Call
```bash
curl -X GET 'http://localhost:3000/api/model-gender/prompt-element?userId=USER_ID' \
  -H 'Authorization: Bearer TOKEN'

# Returns:
{
  "success": true,
  "promptElement": "stunning female model, elegant pose, feminine silhouette",
  "gender": "female",
  "setting": "auto",
  "detectedGender": "female"
}
```

---

## Prompt Weight Syntax Guide

The syntax `[text:weight]` is compatible with:
- ✅ Stable Diffusion (with emphasis-compatible models)
- ✅ Flux
- ✅ Replicate API
- ✅ ComfyUI nodes
- ⚠️ Needs to be stripped out for DALL-E (uses different syntax)

**Weight Ranges:**
```
< 0.8 = under-emphasized (less likely to execute)
0.8-1.0 = normal to slightly reduced
1.0 = baseline (normal)
1.0-1.3 = more emphasized (what we use)
> 1.5 = heavily emphasized (can cause artifacts)
```

---

## Next Steps for Advanced Users

### 1. Monitor Generated Images
- Are they consistently female/male when you want them?
- Do alternating batches show pattern?

### 2. Adjust Weight if Needed
Edit `/src/services/IntelligentPromptBuilder.js` line 347:
```javascript
// Current: weight 1.3
components.push(this.formatToken(modelGenderElement.promptElement, 1.3));

// To increase emphasis: 1.4 or 1.5
// To decrease emphasis: 1.2 or 1.1
```

### 3. A/B Test Different Prompts
Compare:
- `[female model:1.2]` vs `[stunning female model:1.3]` vs `[elegant female model:1.3]`
- Different weights
- Different descriptors

---

## Summary

✅ Model gender is included in every prompt with weight **1.3**
✅ Matches other high-importance elements (garment, color)
✅ Works across all generation modes (single, batch, voice)
✅ Auto-detects from portfolio OR manual override
✅ Alternates in "both" mode for variety
✅ Uses semantic descriptors (elegant, strong, diverse) not just "female/male"
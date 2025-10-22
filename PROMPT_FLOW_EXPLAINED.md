# Prompt Generation Flow - What's Connected & What's Not

## 📊 Current State

### ✅ What's Working:

1. **Image Analysis** → Extracts fashion attributes
2. **Style Clustering** → Creates 3 personalized clusters  
3. **RLHF Weight Service** → Learns token preferences
4. **Prompt Template Service** → Generates prompts with RLHF

### ⚠️ What's NOT Connected Yet:

**The style clusters aren't being fetched from the ML service during generation!**

---

## 🔄 How Prompting Currently Works

### Current Flow (Without ML Clusters):

```
User Request
    ↓
generationService.js (line 106-117)
    ↓
styleProfile = settings.styleProfile (passed in manually)
OR
styleProfile = null (line 110 is commented out!)
    ↓
promptTemplateService.generatePrompt(vltSpec, styleProfile)
    ↓
If NO styleProfile → Uses generic fallback templates
If styleProfile provided → Uses your clusters
    ↓
RLHF selects best tokens
    ↓
Final prompt assembled
    ↓
Send to Replicate/DALL-E/etc
```

---

## 📍 Where Each Step Happens

### 1. **generationService.js** (Line 101-117)
```javascript
// Stage 2: Generate Fashion Prompt from VLT using Template System
logger.info('Generating fashion prompt from VLT with RLHF', { generationId });
const promptTemplateService = require('./promptTemplateService');

// Get user's style profile (from Stage 2 ML service if available)
let styleProfile = settings.styleProfile;
if (!styleProfile && userId) {
  // TODO: Fetch from ML service
  // const mlService = require('./mlService');
  // styleProfile = await mlService.getStyleProfile(userId);  // ← COMMENTED OUT!
}

const fashionPrompt = await promptTemplateService.generatePrompt(vltSpec, styleProfile, {
  userId: userId,
  exploreMode: settings.exploreMode,
  userModifiers: settings.userModifiers || []
});
```

**Status**: ⚠️ Lines 108-110 are commented out - doesn't fetch clusters

---

### 2. **promptTemplateService.js** (Line 36-65)
```javascript
async generatePrompt(vltSpec, styleProfile, options = {}) {
  // Step 1: Get or create templates from user's style profile
  const templates = this._getUserTemplates(userId, styleProfile);
  
  // Step 2: Select best template for this VLT spec
  const template = this._selectTemplate(vltSpec, styleProfile, templates, forceTemplate);
  
  // Step 3: Build core prompt structure from VLT
  const corePrompt = this._buildCorePrompt(vltSpec, template);
  
  // Step 4: Add RLHF-learned modifiers (high-reward tokens)
  const learnedModifiers = await this._selectLearnedModifiers(
    vltSpec, styleProfile, userId, exploreMode
  );
  
  // Step 5: Optional random exploration (for discovery)
  const exploratoryTokens = exploreMode ? 
    this._generateExploratoryTokens(template, vltSpec) : [];
  
  // Step 6: Assemble final prompt
  const finalPrompt = this._assemblePrompt({
    core: corePrompt,
    learned: learnedModifiers,
    exploratory: exploratoryTokens,
    user: userTokens,
    template: template
  });
}
```

**Status**: ✅ Works - but needs styleProfile passed in

---

### 3. **_getUserTemplates()** (Line 174-205)
```javascript
_getUserTemplates(userId, styleProfile) {
  // If no style profile, use generic templates
  if (!styleProfile || !styleProfile.clusters) {
    logger.warn('No style profile available, using generic templates', { userId });
    return this.genericTemplates;  // ← FALLBACK (what you're using now)
  }
  
  // Generate templates from style profile clusters
  const templates = this._generateTemplatesFromClusters(styleProfile);
  
  return templates;
}
```

**Status**: ✅ Works - but falls back to generic templates without clusters

---

### 4. **_selectLearnedModifiers()** (Line 803-877)
```javascript
async _selectLearnedModifiers(vltSpec, styleProfile, userId, exploreMode) {
  // If userId is provided, use RLHF weight service
  if (userId) {
    // Categorize tokens for RLHF
    const categorizedTokens = this._categorizeTokensForRLHF([...]);
    
    // Select tokens using RLHF weights for each category
    for (const [category, tokens] of Object.entries(categorizedTokens)) {
      const rlhfSelected = await rlhfWeightService.selectTokens(
        userId, category, count
      );
      selectedTokens.push(...validSelected);
    }
  }
}
```

**Status**: ✅ Works - uses RLHF weights

---

## 🔗 What Needs to Be Connected

### Missing Link: Fetch Style Clusters from ML Service

**File**: `generationService.js` (around line 108)

**Current (Commented Out)**:
```javascript
// TODO: Fetch from ML service
// const mlService = require('./mlService');
// styleProfile = await mlService.getStyleProfile(userId);
```

**What It Should Be**:
```javascript
if (!styleProfile && userId) {
  // Fetch from Python ML service
  const axios = require('axios');
  try {
    const response = await axios.get(`http://localhost:8001/api/style-profile/${userId}`);
    styleProfile = response.data.profile;
    logger.info('Fetched style profile from ML service', { userId, clusters: styleProfile.n_clusters });
  } catch (error) {
    logger.warn('Failed to fetch style profile, using generic templates', { error: error.message });
  }
}
```

---

## 🎯 What Happens With & Without Clusters

### WITHOUT Clusters (Current):
```
1. User: "elegant evening dress"
2. System: Uses generic "elegant_evening" template
3. RLHF: Selects tokens from generic template
4. Prompt: "high fashion photography, professional model, elegant evening dress..."
```

### WITH Clusters (After connecting):
```
1. User: "elegant evening dress"
2. System: Fetches your 3 clusters from ML service
3. System: Uses Cluster 1 "Contemporary Black Elegance" template
4. RLHF: Selects tokens specific to YOUR style
5. Prompt: "high fashion photography, contemporary black elegant sophisticated dress, 
   fitted silhouette, dramatic lighting, professional model..."
```

---

## 🚀 Quick Fix to Connect Everything

I can add the missing connection right now. It's literally 10 lines of code:

```javascript
// In generationService.js, replace lines 106-111 with:

let styleProfile = settings.styleProfile;
if (!styleProfile && userId) {
  const axios = require('axios');
  try {
    const response = await axios.get(`http://localhost:8001/api/style-profile/${userId}`);
    styleProfile = response.data.profile;
  } catch (error) {
    logger.warn('Using generic templates', { error: error.message });
  }
}
```

**Want me to implement this connection now?** It will make your generations use your actual style clusters!

---

## Summary

| Component | Status | Location |
|-----------|--------|----------|
| **Image Analysis** | ✅ Working | `fashionAnalysisService.js` |
| **Style Clustering** | ✅ Working | ML Service running |
| **Cluster Storage** | ✅ Working | `models/test-user-123_profile.joblib` |
| **Fetch Clusters** | ❌ Missing | `generationService.js` line 108 |
| **Template Generation** | ✅ Working | `promptTemplateService.js` |
| **RLHF Token Selection** | ✅ Working | `rlhfWeightService.js` |
| **Prompt Assembly** | ✅ Working | `promptTemplateService.js` |

**The only missing piece is fetching the clusters from the ML service!**

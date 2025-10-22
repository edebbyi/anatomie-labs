# Fix: Gallery Cards Show Actual Prompts

## Problem
Gallery cards were showing "Generated designs" or generic fallback text instead of the actual prompts used to generate the images.

## Root Cause
The prompt text wasn't being properly passed through the generation pipeline and stored in the database.

### The Flow
1. **Generation Route** creates prompts with `mainPrompt` and `negativePrompt`
2. **Generation Service** receives these in `settings` object
3. **uploadAndStoreAssets** needs to extract and store them in `vlt_analysis` JSON field
4. **Frontend** reads from `vlt_analysis.promptText` or `vlt_analysis.mainPrompt`

### What Was Broken
In `generationService.js`, the `uploadAndStoreAssets` method was trying to access:
```javascript
params.settings?.mainPrompt  // ❌ Undefined - settings wasn't passed
```

## What Was Fixed

### 1. Backend: Pass Prompt Data Through Pipeline
**File**: `src/services/generationService.js` (Lines 258-260)

Added prompt data to uploadAndStoreAssets call:
```javascript
const allUploadedAssets = await this.uploadAndStoreAssets({
  generationId,
  userId,
  images: generationResult.images,
  provider: routing.provider,
  vltSpec,
  optimized,
  routing,
  promptId: settings.promptId || generationId,
  mainPrompt: settings.mainPrompt || finalPrompt, // ✅ Now passed
  negativePrompt: settings.negativePrompt || negativePrompt, // ✅ Now passed
  promptMetadata: settings.promptMetadata || {} // ✅ Now passed
});
```

### 2. Backend: Store Prompt in Database
**File**: `src/services/generationService.js` (Lines 640-643)

Updated to use passed params directly:
```javascript
const vltAnalysis = {
  ...(params.vltSpec || {}),
  promptId: params.promptId || null,
  promptText: params.mainPrompt || image.revisedPrompt || 'Generated image', // ✅ Fixed
  mainPrompt: params.mainPrompt || image.revisedPrompt, // ✅ Fixed
  negativePrompt: params.negativePrompt || '', // ✅ Fixed
  promptMetadata: params.promptMetadata || {}, // ✅ Fixed
  // ... rest of fields
};
```

### 3. Frontend: Improved Prompt Extraction
**File**: `frontend/src/pages/Home.tsx` (Lines 84-89)

Enhanced extraction logic with better fallbacks:
```javascript
const promptText = item.vlt_analysis?.promptText || 
                   item.vlt_analysis?.mainPrompt ||
                   item.vlt_analysis?.originalPrompt ||
                   (item.metadata && typeof item.metadata === 'object' ? 
                     (item.metadata.prompt || item.metadata.mainPrompt) : null) || 
                   `${item.vlt_analysis?.aesthetic || 'contemporary'} ${item.vlt_analysis?.garmentType || 'garment'} design`;
```

### 4. Frontend: Added Debug Logging
**File**: `frontend/src/pages/Home.tsx` (Lines 92-98)

Added logging to identify when fallback prompts are used:
```javascript
if (promptText.includes('contemporary') || promptText.includes('design')) {
  console.warn('Using fallback prompt for image:', item.id, 'Available fields:', {
    hasPromptText: !!item.vlt_analysis?.promptText,
    hasMainPrompt: !!item.vlt_analysis?.mainPrompt,
    hasMetadata: !!item.metadata
  });
}
```

## What You'll See Now

### Before Fix
```
Gallery Card:
"contemporary garment design"  ❌
```

### After Fix
```
Gallery Card:
"professional fashion photography, blazer, clean architectural lines,
minimalist sophistication, black tones, structured modern style"  ✅
```

## Database Schema
The prompt is stored in the `images` table, `vlt_analysis` JSONB column:

```json
{
  "promptId": "prompt-1",
  "promptText": "professional fashion photography, blazer...",
  "mainPrompt": "professional fashion photography, blazer...",
  "negativePrompt": "blurry, low quality, distorted...",
  "promptMetadata": {
    "garmentType": "blazer",
    "proportionBased": true,
    "templateId": "cluster_1"
  }
}
```

## Testing

1. **Generate new images** (existing images won't have the prompt stored)
2. **Check browser console** for debug warnings
3. **Inspect gallery cards** - should show actual prompts
4. **Verify in database**:
   ```sql
   SELECT vlt_analysis->>'promptText' FROM images LIMIT 1;
   ```

## Files Changed

1. `src/services/generationService.js`:
   - Lines 258-260: Pass prompt data to uploadAndStoreAssets
   - Lines 640-643: Store prompt in vlt_analysis

2. `frontend/src/pages/Home.tsx`:
   - Lines 84-89: Improved prompt extraction
   - Lines 92-98: Debug logging

## Important Notes

⚠️ **This fix only affects NEW images**. Images generated before this fix will still show fallback prompts.

✅ **To see the fix in action**: Complete a fresh onboarding or generate new images.

✅ **Debug logging**: Check browser console to see which prompts are using fallbacks.

## Complete Fix Checklist

Now with **7 total fixes**:

1. ✅ Image count: 120 → 20 images
2. ✅ Hardcoded "romantic florals" removed
3. ✅ VLT analysis display added
4. ✅ Prompt builder uses VLT data
5. ✅ Portfolio validation added
6. ✅ Style profile used in generation
7. ✅ **Gallery shows actual prompts** (NEW!)

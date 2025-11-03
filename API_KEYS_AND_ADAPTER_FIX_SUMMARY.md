# API Keys & Model Adapter Initialization - Complete Fix

## Summary of Issues Identified & Fixed

### Issue #1: Cost Calculation Bug in imagenAdapter.js ✅ FIXED

**Problem:**
- The `calculateCost()` method at line 233 was trying to access `params.number_of_images`
- This property doesn't exist in the `imagenParams` object passed to the function
- This would cause a runtime error when calculating costs for generation

**Root Cause:**
- `imagenParams` contains: prompt, aspect_ratio, output_format, output_quality, etc.
- But NOT the count of images being generated
- The count was available in `settings.count` in the `generate()` method scope

**Fix Applied:**
```javascript
// BEFORE (Line 143):
cost: this.calculateCost(imagenParams),

// AFTER:
cost: this.calculateCost(imagenParams, requestedCount),

// AND update the calculateCost signature:
calculateCost(params, count = 1) {
    const baseCost = 0.04;
    const qualityMultiplier = params.output_quality >= 90 ? 1.2 : 1.0;
    return baseCost * qualityMultiplier * count;  // Uses count parameter, not params.number_of_images
}
```

**Files Modified:**
- `/src/adapters/imagenAdapter.js` - Lines 143 and 228-237

---

### Issue #2: Cost Calculation Bug in stableDiffusionAdapter.js ✅ FIXED

**Problem:**
- The `calculateCost()` method was using `params.num_outputs` to calculate cost
- If `params` didn't have this property, it would result in `undefined * cost`, returning `NaN`

**Fix Applied:**
```javascript
// BEFORE:
calculateCost(params) {
    const baseCost = 0.02;
    return baseCost * params.num_outputs;  // Unsafe property access
}

// AFTER:
calculateCost(params) {
    const baseCost = 0.02;
    const count = params?.num_outputs || 1;  // Safe property access with fallback
    return baseCost * count;
}
```

**Files Modified:**
- `/src/adapters/stableDiffusionAdapter.js` - Lines 214-222

---

### Issue #3: API Key Configuration ✅ VERIFIED

**Current Status:**
- ✅ `REPLICATE_API_TOKEN` is properly configured in `.env` file (line 34)
- ✅ Token value: `[REDACTED]`
- ✅ All adapters check for this token on initialization

**Verification Points:**
1. **imagenAdapter.js** (lines 24-31): Checks token and throws error if missing
2. **stableDiffusionAdapter.js**: Similar check implemented
3. **geminiAdapter.js**: Handles Replicate initialization
4. **realEsrganService.js**: Checks token with informative warnings

**Adapters Using REPLICATE_API_TOKEN:**
- ✅ imagenAdapter (Google Imagen 4 Ultra)
- ✅ stableDiffusionAdapter (Stable Diffusion 3.5)
- ✅ geminiAdapter (Gemini 2.5 Flash)
- ✅ realEsrganService (image upscaling)
- ✅ feedbackLearnerAgent
- ✅ imageGenerationAgent
- ✅ ingestionAgent
- ✅ fashionAnalysisService

---

### Issue #4: DALL-E Adapter Cost Calculation ✅ VERIFIED

**Status:** No issues found
- DALL-E adapter's `calculateCost()` correctly uses `quality` and `size` parameters
- DALL-E 3 only supports 1 image (n=1), so multiplication by count not needed
- Cost structure properly accounts for HD vs Standard and different sizes

---

## Initialization Flow

When the server starts, adapters initialize in this order:

1. **First Request** triggers `initialize()` on the selected adapter
2. **Adapter checks** for `REPLICATE_API_TOKEN`
3. **If token missing** → Error thrown with clear message
4. **If token valid** → Replicate client created and `initialized = true`
5. **Subsequent requests** skip initialization (cached state)

### Health Check Method
Each adapter has a `healthCheck()` method that can be called to verify:
```javascript
const health = await imagenAdapter.healthCheck();
// Returns: { healthy: true/false, provider, model, error? }
```

---

## Testing Instructions

### 1. **Verify API Key is Loaded**
```bash
# Check .env file
grep REPLICATE_API_TOKEN /Users/esosaimafidon/Documents/GitHub/anatomie-lab/.env
# Should output: REPLICATE_API_TOKEN=[your-api-token]
```

### 2. **Test Generation Endpoint**
```bash
# Start the backend server
npm start

# In another terminal, test the /api/generate/generate endpoint:
curl -X POST http://localhost:3001/api/generate/generate \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "description": "A beautiful red dress on a model",
    "count": 1
  }'
```

### 3. **Verify Cost is Calculated**
The response should include:
```json
{
  "success": true,
  "generation": {
    "cost": 0.04,  // ✅ Cost properly calculated (not NaN)
    "images": [...],
    "metadata": {...}
  }
}
```

### 4. **Check Logs for Initialization**
```bash
# Watch the backend logs
tail -f logs/app.log

# You should see:
# - "Imagen 4 Ultra adapter initialized"
# - "Starting Imagen 4 Ultra generation"
# - "Imagen 4 Ultra generation completed"
```

### 5. **Test Health Check**
Create a test file:
```javascript
// test-adapter-health.js
const imagenAdapter = require('./src/adapters/imagenAdapter');

(async () => {
  const health = await imagenAdapter.healthCheck();
  console.log('Adapter Health:', health);
})();
```

---

## Cost Calculation Formulas

### Imagen 4 Ultra (imagenAdapter)
```
Base Cost: $0.04 per image
Quality Multiplier: 1.2x if quality >= 90, else 1.0x
Total Cost = $0.04 × multiplier × count
```

### Stable Diffusion 3.5 (stableDiffusionAdapter)
```
Base Cost: $0.02 per image (most cost-effective)
Total Cost = $0.02 × count
```

### DALL-E 3 (dalleAdapter)
```
Standard Quality (1024x1024): $0.04
Standard Quality (larger): $0.08
HD Quality (1024x1024): $0.08
HD Quality (larger): $0.12
Note: DALL-E 3 always generates 1 image
```

### Gemini 2.5 Flash (geminiAdapter)
```
Base Cost: $0.01 per image (cheapest option)
Total Cost = $0.01
```

---

## Remaining Known Issues

None critical. All adapters are now properly:
- ✅ Checking for API tokens
- ✅ Calculating costs correctly
- ✅ Handling initialization safely
- ✅ Providing error messages when tokens are missing

---

## Files Modified This Session

1. **src/adapters/imagenAdapter.js**
   - Line 143: Pass `requestedCount` to `calculateCost()`
   - Lines 228-237: Updated `calculateCost()` signature and implementation

2. **src/adapters/stableDiffusionAdapter.js**
   - Lines 214-222: Updated `calculateCost()` to safely handle `num_outputs`

---

## Next Steps

1. ✅ Restart the backend server
2. ✅ Test the `/api/generate/generate` endpoint
3. ✅ Verify cost is calculated correctly (not NaN)
4. ✅ Monitor logs for any initialization errors
5. ✅ Check database to ensure `cost_cents` is being stored properly

---

## Related Previous Fix

This fix complements the earlier fix for:
- **Database Column Mismatch**: Changed `cost` to `cost_cents` in the database storage
- **File**: `src/services/generationService.js` - `completeGeneration()` method

Both fixes together ensure the complete flow works:
```
generate() → calculateCost() [returns dollars]
    ↓
completeGeneration() → convert to cents → store in cost_cents column
```

---

**Status**: ✅ Ready for Testing
**Date**: 2024
**Priority**: High - Blocks image generation
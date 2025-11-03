# Quick Fix Reference - API Keys & Adapter Costs

## 🎯 What Was Fixed

Two critical cost calculation bugs in image generation adapters that would cause:
- `undefined` cost values (breaking cost tracking)
- Generation pipeline failures
- NaN errors in database storage

## 📋 Files Changed

1. **src/adapters/imagenAdapter.js** (2 changes)
   - Line 143: Pass `requestedCount` parameter to `calculateCost()`
   - Lines 228-237: Updated method to accept and use `count` parameter

2. **src/adapters/stableDiffusionAdapter.js** (1 change)
   - Lines 214-222: Safe property access with fallback for `num_outputs`

## ✅ Verification Checklist

- [ ] **API Key**: REPLICATE_API_TOKEN is configured in .env
- [ ] **Server**: npm start (backend running)
- [ ] **Test Script**: `node test-adapter-initialization.js`
- [ ] **Generate Test**: POST to /api/generate/generate endpoint
- [ ] **Cost**: Verify cost is not NaN (check logs and DB)
- [ ] **Logs**: Check for "adapter initialized" messages

## 🚀 Quick Start

```bash
# 1. Restart backend
npm start

# 2. Run verification test
node test-adapter-initialization.js

# 3. Test generation endpoint
curl -X POST http://localhost:3001/api/generate/generate \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "description": "A beautiful red dress on a model",
    "count": 1
  }'
```

## 🔍 Expected Results

### Test Script Output
```
✅ Imagen 4 Ultra: $0.08 (2 images × $0.04)
✅ Stable Diffusion: $0.06 (3 images × $0.02)
✅ DALL-E 3: $0.04 (1 image, standard quality)
✅ Gemini 2.5 Flash: $0.01 (1 image × $0.01)
```

### Generation Response
```json
{
  "success": true,
  "generation": {
    "cost": 0.04,  // ✅ Should be a valid number
    "images": ["https://..."],
    "metadata": {...}
  }
}
```

## 💾 Cost Calculations After Fix

| Adapter | Base Cost | Formula | Example (1 img) |
|---------|-----------|---------|-----------------|
| Imagen 4 Ultra | $0.04 | $0.04 × multiplier × count | $0.04 |
| Stable Diffusion | $0.02 | $0.02 × count | $0.02 |
| DALL-E 3 | Varies | Quality + Size | $0.04-$0.12 |
| Gemini Flash | $0.01 | $0.01 × count | $0.01 |

## ⚠️ If Issues Persist

Check:
1. `.env` file has `REPLICATE_API_TOKEN` set
2. Backend logs for initialization errors
3. Database schema has `cost_cents` column (not `cost`)
4. Network connectivity to Replicate API

## 📚 Related Fixes

- **Database Schema**: Previous fix changed `cost` → `cost_cents` column
- **Generation Service**: Previous fix updates `completeGeneration()` to convert dollars to cents
- **This Fix**: Ensures adapters calculate costs correctly

All three fixes work together for complete cost tracking pipeline.

---

**Status**: Ready to Test ✅
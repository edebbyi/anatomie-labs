# Quick Testing Guide - Portfolio & Image Generation

## Prerequisites

1. **Environment Variables**
   ```bash
   # Check your .env file has these:
   cat .env | grep -E "REPLICATE|R2_|DB_|PINECONE"
   ```

2. **Start the Server**
   ```bash
   npm start
   ```

3. **Start the Frontend**
   ```bash
   cd frontend && npm start
   ```

## Test 1: Portfolio Display ✅

**What to Test:** Gallery shows real uploaded images, not mock data

**Steps:**
1. Navigate to http://localhost:3000/home
2. Wait for images to load
3. Check browser console for any errors

**Expected Results:**
- ✅ Images load from your uploaded portfolio
- ✅ Image URLs are from R2 storage (not picsum.photos)
- ✅ Tags shown are from VLT metadata (garment type, colors, style)
- ✅ Count shows actual number of uploaded images
- ❌ NO "seed" in image URLs
- ❌ NO generic "Design variation X" prompts

**Console Check:**
```javascript
// Should see:
"Fetching user portfolio"
"Portfolio loaded: X images"

// Should NOT see:
"https://picsum.photos/seed/..."
```

## Test 2: Settings Page Count ✅

**What to Test:** Settings displays accurate portfolio count

**Steps:**
1. Navigate to http://localhost:3000/settings
2. Look at "Current Portfolio" card
3. Compare with actual number of uploaded images

**Expected Results:**
- ✅ Shows correct count (e.g., "23 images")
- ✅ Count matches what you see in Home gallery
- ❌ Does NOT show "150 images"

## Test 3: VLT Metadata Integration ✅

**What to Test:** Portfolio images have correct VLT-derived tags

**Steps:**
1. Go to Home page
2. Hover over an image
3. Check the tags displayed

**Expected Results:**
- ✅ Tags like "dress", "elegant", "black", "midi"
- ✅ Tags derived from actual garment attributes
- ❌ NOT generic tags like "casual", "summer", "formal" (unless actually from VLT)

## Test 4: Prompt Generation Service ✅

**What to Test:** VLT data converts to fashion prompts

**Steps:**
1. Open Node REPL:
   ```bash
   node
   ```

2. Test the service:
   ```javascript
   const promptGen = require('./src/services/promptGenerationService');
   
   const testVLT = {
     garmentType: 'dress',
     attributes: {
       silhouette: 'A-line',
       neckline: 'V-neck',
       sleeveLength: 'sleeveless',
       length: 'midi'
     },
     colors: {
       primary: 'black',
       finish: 'matte'
     },
     style: {
       overall: 'elegant',
       mood: 'sophisticated'
     }
   };
   
   const result = promptGen.generatePrompt(testVLT);
   console.log('\n=== MAIN PROMPT ===');
   console.log(result.mainPrompt);
   console.log('\n=== NEGATIVE PROMPT ===');
   console.log(result.negativePrompt);
   console.log('\n=== METADATA ===');
   console.log(result.metadata);
   ```

**Expected Results:**
- ✅ Main prompt is detailed and includes:
  - "high fashion photography"
  - "dress, A-line silhouette, V-neck neckline, sleeveless, midi length"
  - "black color, matte finish"
  - "elegant style, sophisticated mood"
  - Lighting and composition details
- ✅ Negative prompt includes quality/anatomy issues to avoid
- ✅ Metadata has garmentType, style, colors

## Test 5: Image Generation (Full Pipeline) ✅

**What to Test:** Command bar generates real images via Imagen-4-Ultra

**Prerequisites:**
- Portfolio must have at least 1 uploaded image with VLT data
- REPLICATE_API_TOKEN must be set

**Steps:**
1. Go to Home page (http://localhost:3000/home)
2. Open command bar (click mic icon or press shortcut)
3. Type: `generate 1 elegant dress`
4. Press Enter

**Expected Behavior:**
1. ✅ "Generating Images..." overlay appears
2. ✅ Console shows:
   ```
   Executing command: generate 1 elegant dress
   Fetching portfolio item with VLT data
   Generating fashion prompt from VLT
   Starting Imagen 4 Ultra generation
   ```
3. ✅ After 5-15 seconds, image appears in gallery
4. ✅ New image has proper tags
5. ✅ Success alert: "✅ Generated 1 elegant dress!"

**If It Fails:**
- Check REPLICATE_API_TOKEN is valid
- Check portfolio has VLT data: 
  ```bash
  curl -H "Authorization: Bearer YOUR_TOKEN" \
    http://localhost:5000/api/persona/portfolio?limit=1
  ```
- Check server logs for errors

## Test 6: Generation Parameters ✅

**What to Test:** Imagen uses correct Stage 6 parameters

**Steps:**
1. Trigger a generation (as in Test 5)
2. Check server logs for generation details

**Expected in Logs:**
```
Starting Imagen 4 Ultra generation
{
  provider: 'google-imagen',
  promptLength: XXX,
  hasNegativePrompt: true
}

Imagen parameters:
{
  aspect_ratio: '1:1',
  output_format: 'png',
  guidance_scale: 7.5,
  num_inference_steps: 50
}
```

**Verify:**
- ✅ guidance_scale: 7.5
- ✅ num_inference_steps: 50
- ✅ aspect_ratio: '1:1' (1024×1024)

## Test 7: Error Handling ✅

**What to Test:** Graceful error handling

**Test 7a: No Portfolio**
```javascript
// In browser console, clear localStorage
localStorage.clear();
// Refresh and try generation
```
**Expected:** "No portfolio items with VLT data found. Please upload your portfolio first."

**Test 7b: Invalid Token**
```javascript
// In browser console
localStorage.setItem('token', 'invalid-token');
// Try loading portfolio
```
**Expected:** Empty gallery or error message

**Test 7c: API Down**
```bash
# Stop the server
# Try accessing Home page
```
**Expected:** Error message, no crash

## Common Issues & Solutions

### Issue: "No portfolio items found"
**Solution:** 
1. Upload portfolio ZIP via onboarding
2. Ensure VLT analysis completed
3. Check database:
   ```sql
   SELECT COUNT(*) FROM portfolio WHERE user_id = 1;
   ```

### Issue: "Generation failed"
**Solution:**
1. Check REPLICATE_API_TOKEN:
   ```bash
   curl -H "Authorization: Token $REPLICATE_API_TOKEN" \
     https://api.replicate.com/v1/account
   ```
2. Check Replicate credit balance
3. Check server logs for detailed error

### Issue: Images not loading
**Solution:**
1. Check R2 storage configuration
2. Verify image_url or r2_url in database
3. Check CORS settings on R2 bucket

### Issue: Wrong image count
**Solution:**
1. Clear browser cache
2. Check API response:
   ```bash
   curl -H "Authorization: Bearer TOKEN" \
     http://localhost:5000/api/persona/portfolio?limit=1
   ```
3. Verify database count matches API

## Success Criteria Checklist

### Portfolio Display
- [ ] Real images load (not mock)
- [ ] Correct count everywhere
- [ ] VLT tags display properly
- [ ] Images clickable and open in swipe view
- [ ] Filter by tags works

### Settings Page
- [ ] Shows accurate portfolio count
- [ ] Count updates after new uploads
- [ ] Re-upload portfolio option visible

### Image Generation
- [ ] Command bar accepts generate commands
- [ ] Loading state shows during generation
- [ ] Generated images appear in gallery
- [ ] Images stored in R2
- [ ] Database updated with generation metadata
- [ ] Cost tracking works

### Prompt Generation
- [ ] VLT → Prompt conversion works
- [ ] Prompts are detailed and relevant
- [ ] Negative prompts included
- [ ] Metadata preserved

### Error Handling
- [ ] Graceful failures
- [ ] User-friendly error messages
- [ ] Console errors are informative
- [ ] No app crashes

## Performance Benchmarks

### Portfolio Load Time
- ✅ < 2 seconds for 50 images
- ✅ < 5 seconds for 100 images

### Image Generation Time
- ✅ 5-15 seconds per image (Imagen-4-Ultra)
- ✅ Loading state visible entire time
- ✅ Non-blocking UI

### API Response Times
- ✅ /api/persona/portfolio: < 500ms
- ✅ /api/generate/from-prompt: 5-20s (depends on Replicate)
- ✅ Settings count fetch: < 200ms

## Next Steps After Testing

If all tests pass:
1. ✅ System is ready for production use
2. ✅ Can start generating fashion images
3. ✅ Ready to implement Stages 7-11

If tests fail:
1. Check this guide's troubleshooting section
2. Review server logs
3. Verify environment variables
4. Check database state
5. Verify API tokens

## Quick Debug Commands

```bash
# Check if server is running
curl http://localhost:5000/health

# Check portfolio API
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:5000/api/persona/portfolio?limit=1 | jq .

# Check database connection
npm run db:check

# Test VLT service
node -e "const vlt = require('./src/services/vltService'); \
  vlt.healthCheck().then(console.log);"

# Test Imagen adapter
node -e "const imagen = require('./src/adapters/imagenAdapter'); \
  imagen.healthCheck().then(console.log);"
```

---

## Summary

✅ **All Fixed:**
1. Portfolio displays real images with VLT metadata
2. Accurate counts throughout the UI
3. VLT data converts to detailed fashion prompts
4. Imagen-4-Ultra integration with Stage 6 parameters
5. Command bar triggers real generation pipeline
6. Proper error handling and loading states

🚀 **Ready to Test!**

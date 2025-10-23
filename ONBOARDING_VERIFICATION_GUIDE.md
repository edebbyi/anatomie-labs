# Onboarding Flow Verification Guide

## 🎯 Expected Onboarding Flow

The Podna onboarding system follows this 4-step process:

### **Step 1: Upload Portfolio** ✅
- **Endpoint**: `POST /api/podna/upload`
- **What Happens**:
  1. Extracts images from ZIP (validates root-level placement)
  2. Deduplicates images by content hash
  3. Uploads each image to R2 storage
  4. Creates records in `portfolio_images` table
  5. Returns `portfolioId` and `imageCount`

**Verification**:
```sql
SELECT COUNT(*) FROM portfolio_images WHERE portfolio_id = 'YOUR_PORTFOLIO_ID';
-- Expected: 44+ images
```

---

### **Step 2: Analyze Portfolio** ✅
- **Endpoint**: `POST /api/podna/analyze/:portfolioId`
- **What Happens**:
  1. Fetches all portfolio images from database
  2. For each image:
     - Downloads from R2 CDN
     - Sends to Gemini 2.0 Flash via Replicate for vision analysis
     - Extracts structured fashion attributes (garment, colors, fabric, etc.)
     - Saves to `image_descriptors` table
  3. Returns count of analyzed/failed images

**Verification**:
```sql
SELECT COUNT(*) FROM image_descriptors 
WHERE image_id IN (
  SELECT id FROM portfolio_images WHERE portfolio_id = 'YOUR_PORTFOLIO_ID'
);
-- Expected: Should match portfolio image count (minus any failures)
```

**Check Descriptors**:
```sql
SELECT 
  garment_type, 
  silhouette, 
  color_palette, 
  fabric, 
  pattern
FROM image_descriptors
WHERE image_id IN (
  SELECT id FROM portfolio_images WHERE portfolio_id = 'YOUR_PORTFOLIO_ID'
)
LIMIT 5;
```

---

### **Step 3: Generate Style Profile** ✅
- **Endpoint**: `POST /api/podna/profile/generate/:portfolioId`
- **What Happens**:
  1. Aggregates all `image_descriptors` for the portfolio
  2. Calculates distributions:
     - Garment types (e.g., 40% dresses, 30% tops, 20% pants)
     - Color palettes
     - Fabrics
     - Silhouettes
  3. Performs clustering to identify signature styles
  4. Generates style labels (e.g., "minimalist tailoring", "coastal prep")
  5. Creates summary text description
  6. Saves to `style_profiles` table

**Verification**:
```sql
SELECT 
  user_id,
  total_images,
  style_labels,
  garment_distribution,
  color_distribution,
  summary_text,
  created_at
FROM style_profiles
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 1;
```

---

### **Step 4: Generate Initial Images** 🎨
- **Endpoint**: `POST /api/podna/generate/batch`
- **What Happens**:
  1. For each image (default: 8 images):
     - **Prompt Builder Agent**:
       - Reads user's `style_profile`
       - Uses epsilon-greedy strategy (90% exploit, 10% explore)
       - Generates structured prompt spec from style distributions
       - Renders natural language prompt
       - Saves to `prompts` table
     - **Image Generation Agent**:
       - Sends prompt to Stable Diffusion XL via Replicate
       - Downloads generated image
       - Uploads to R2 storage
       - Saves to `generations` table with cost tracking
  2. Returns array of generated images with CDN URLs

**Verification - Prompts Created**:
```sql
SELECT 
  id,
  user_id,
  mode,
  is_exploration,
  LEFT(text, 150) as prompt_preview,
  created_at
FROM prompts
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 8;
```

**Expected Prompt Format**:
```
in the user's signature 'minimalist tailoring' mode: 
straight blazer, in wool, with sheen finish, 
navy and cream palette, soft lighting from 45deg, 
3/4 front angle at eye level, clean studio background, 
modern editorial style
```

**Verification - Images Generated**:
```sql
SELECT 
  g.id,
  g.url,
  g.provider,
  g.width,
  g.height,
  g.cost_cents,
  p.text as prompt_used,
  g.created_at
FROM generations g
JOIN prompts p ON g.prompt_id = p.id
WHERE g.user_id = 'YOUR_USER_ID'
ORDER BY g.created_at DESC
LIMIT 8;
```

---

## 🔍 Quick Verification Script

Run this to check your latest onboarding:

```bash
./verify-onboarding-flow.sh
```

Or manually:

```sql
-- Get latest portfolio
SELECT * FROM portfolios ORDER BY created_at DESC LIMIT 1;

-- Count images
SELECT COUNT(*) FROM portfolio_images WHERE portfolio_id = 'LATEST_ID';

-- Count descriptors
SELECT COUNT(*) FROM image_descriptors WHERE image_id IN (
  SELECT id FROM portfolio_images WHERE portfolio_id = 'LATEST_ID'
);

-- Check profile
SELECT * FROM style_profiles WHERE user_id = 'USER_ID' ORDER BY created_at DESC LIMIT 1;

-- Check prompts
SELECT COUNT(*) FROM prompts WHERE user_id = 'USER_ID';

-- Check generations
SELECT COUNT(*) FROM generations WHERE user_id = 'USER_ID';
```

---

## ⚠️ Common Issues

### 1. **Zero Image Descriptors**
**Symptom**: Step 2 returns success but no descriptors in database

**Cause**: Gemini API model version invalid

**Fix**: Ensure using `'google-deepmind/gemini-2.0-flash-exp'` (without version hash)

**Check**:
```bash
grep "gemini-2.0-flash-exp" src/services/styleDescriptorAgent.js
# Should NOT have a version hash like :5e5b16662a6e
```

### 2. **Profile Generation Fails**
**Symptom**: "No image descriptors found" error

**Cause**: Step 2 analysis failed

**Fix**: Check `image_descriptors` table has rows. Re-run analyze endpoint.

### 3. **Zero Prompts Generated**
**Symptom**: Images generated but no prompts in database

**Cause**: `savePrompt()` method failing or not being called

**Fix**: Check backend logs for prompt-related errors

### 4. **R2 Upload Failures**
**Symptom**: "uploadBuffer is not a function"

**Cause**: Wrong method name - should be `uploadImage()`

**Fix**: Use `r2Storage.uploadImage(buffer, metadata)` not `uploadBuffer()`

---

## 📊 Success Criteria

After completing onboarding, you should have:

- ✅ 1 portfolio record
- ✅ 44+ portfolio images uploaded to R2
- ✅ 44+ image descriptors with fashion attributes
- ✅ 1 style profile with distributions and labels
- ✅ 8 prompts generated from profile
- ✅ 8 generated images uploaded to R2

**Total Cost**: ~$0.16 USD
- Analysis: Free (Gemini via Replicate)
- Generation: 8 × $0.02 = $0.16 (SDXL via Replicate)

---

## 🎨 Frontend Display

After successful onboarding, the frontend should show:

1. **Portfolio Summary**: "44 images analyzed"
2. **Style Profile**: 
   - Primary style labels
   - Color palette visualization
   - Garment distribution chart
3. **Generated Gallery**: 8 custom images matching user's style
4. **Next Steps**: Feedback buttons for each image

---

## 🐛 Debugging Tips

**Check backend logs**:
```bash
tail -f logs/combined.log | grep -E "(Podna|Prompt|Generation|Style Descriptor)"
```

**Check Replicate API status**:
```bash
curl -H "Authorization: Token $REPLICATE_API_TOKEN" \
  https://api.replicate.com/v1/models/google-deepmind/gemini-2.0-flash-exp
```

**Check database state**:
```bash
psql designer_bff -c "
SELECT 
  (SELECT COUNT(*) FROM portfolios) as portfolios,
  (SELECT COUNT(*) FROM portfolio_images) as images,
  (SELECT COUNT(*) FROM image_descriptors) as descriptors,
  (SELECT COUNT(*) FROM style_profiles) as profiles,
  (SELECT COUNT(*) FROM prompts) as prompts,
  (SELECT COUNT(*) FROM generations) as generations;
"
```

---

## 🔄 Re-running Onboarding

To test the flow again:

1. Upload a new ZIP file through frontend
2. Each step should complete in sequence
3. Check database after each step
4. Verify images appear in frontend gallery

**Important**: You can upload multiple portfolios. The system will use the most recent one for generating images.

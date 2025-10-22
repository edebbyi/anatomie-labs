# 🧪 Testing: Generate First 40 Images

This guide walks you through testing the complete onboarding flow that generates 40 high-quality fashion images from a user's portfolio on account creation.

## 📋 Prerequisites

### Required ✅
1. **PostgreSQL** - Database running
   ```bash
   # Check if running
   psql -d designer_bff -c "SELECT 1"
   ```

2. **Node.js Dependencies** - Installed
   ```bash
   npm install
   ```

3. **Portfolio ZIP File** - ANATOMIE images (50+ images recommended)
   - Place in: `./test-data/anatomie-portfolio.zip`
   - Or specify custom path with `--portfolio=` flag

### Optional but Recommended 🔧
4. **Replicate API Token** - For image generation ✅ **ALREADY CONFIGURED!**
- Your token: `{{REPLICATE_API_TOKEN}}`
   - Provides access to:
     - **Imagen 4 Ultra** - Highest quality ($0.04/image)
     - **Stable Diffusion XL** - Cost-effective ($0.02/image)
   - Already set in `.env`: `REPLICATE_API_TOKEN`

5. **Cloudflare R2** - For image storage
   - Set in `.env`:
     - `R2_ACCOUNT_ID=your_account_id`
     - `R2_ACCESS_KEY_ID=your_access_key`
     - `R2_SECRET_ACCESS_KEY=your_secret_key`
     - `R2_BUCKET_NAME=anatomie-generated-images`
   - **Alternative**: Images stored in temp directory

6. **Redis** - For job queue (optional)
   ```bash
   brew install redis
   redis-server
   ```

---

## 🚀 Quick Start

### 1. Prepare Portfolio ZIP
Create a ZIP file with ANATOMIE fashion images:
```bash
# Create test directory
mkdir -p test-data

# Option A: Use your existing portfolio
zip -r test-data/anatomie-portfolio.zip path/to/your/images/*.jpg

# Option B: Use sample images (if available)
# Copy 50+ fashion images to a folder, then:
cd path/to/images/
zip -r ~/Documents/GitHub/anatomie-lab/test-data/anatomie-portfolio.zip *.jpg *.png
```

### 2. Configure Environment
Your `.env` already has everything configured! ✅
```bash
# Required - Already configured ✅
DATABASE_URL=postgresql://esosaimafidon@localhost:5432/designer_bff
VLT_API_URL=https://visual-descriptor-516904417440.us-central1.run.app
VLT_API_KEY={{VLT_API_KEY}}

# Image Generation - Already configured ✅
REPLICATE_API_TOKEN={{REPLICATE_API_TOKEN}}
VLT_USE_REPLICATE=true

# Optional: Choose your image generation provider
# Imagen 4 Ultra: $0.04/image (highest quality) - DEFAULT
# Stable Diffusion XL: $0.02/image (faster, cheaper)
# Edit line 42 in test-first-40-images.js to switch
```

### 3. Run Test
```bash
# With default portfolio location
node test-first-40-images.js --portfolio=./test-data/anatomie-portfolio.zip

# With custom portfolio location
node test-first-40-images.js --portfolio=/path/to/your/portfolio.zip
```

---

## 📊 What Happens During the Test

### **Step 1: Create Test User** (1-2 seconds)
- Creates user account: `test-onboarding@anatomie.com`
- Or reuses existing test user

### **Step 2: VLT Analysis** (45-90 seconds)
- Uploads portfolio ZIP to VLT service
- Gemini Vision analyzes each image
- Extracts:
  - Garment types (dress, pants, top, etc.)
  - Silhouettes (A-line, fitted, relaxed, etc.)
  - Fabrics (cotton, silk, polyester)
  - Colors (primary, secondary, accents)
  - Style attributes (minimalist, elegant, casual)
  - Construction details
- Saves VLT data to database

**Example Output:**
```
✅ VLT analysis complete
   Total Images: 50
   Avg Confidence: 0.87
   Duration: 67.3s
   Garment Types: dress, pants, top, jacket
```

### **Step 3: Style Profile** (instant)
- Creates user's style profile from VLT data
- In production: Calls Python ML service for GMM clustering
- For testing: Creates simplified clusters by garment type

**Example Output:**
```
✅ Style profile generated
   Num Clusters: 4
   Dominant Colors: beige, black, white
   Dominant Fabrics: cotton, polyester, silk
```

### **Step 4: Prompt Generation** (instant)
- Generates 48 prompts (40 target + 20% buffer)
- Uses multi-template system with RLHF
- Components:
  - **Core**: VLT-derived garment description
  - **Learned**: RLHF high-reward modifiers
  - **Exploratory**: Random tokens (20% of prompts)
  - **User**: Custom additions (empty for onboarding)

**Example Output:**
```
✅ Prompts generated
   Count: 48
   With Exploration: 10 (20%)
   Template IDs: cluster-1, cluster-2, cluster-3, cluster-4
```

**Sample Prompt:**
```
high fashion photography, professional product shot, studio quality, 
8k resolution, sharp focus, full body shot, confident pose, 
minimalist A-line dress in beige cotton, smooth texture, 
lightweight fabric, sleeveless, natural waistline, midi length, 
elegant aesthetic, sophisticated mood, clean minimal background...
```

### **Step 5: Image Generation** (5-10 minutes)
- Generates 48 images using Imagen 4 Ultra (or Gemini for testing)
- Batches of 5 images at a time
- ~10-15 seconds per image
- Progress tracking for each image

**Example Output:**
```
🖼️ Step 5: Generating 48 images with google-imagen...
⏱️ Estimated time: 9.6 minutes

Processing batch 1/10
  [1/48] Generating image...
  ✅ [1/48] Generated successfully
  [2/48] Generating image...
  ✅ [2/48] Generated successfully
  ...

✅ Image generation complete
   Success: 46
   Failures: 2
   Success Rate: 95.8%
   Duration: 8.7 minutes
   Avg Per Image: 11.3s
```

### **Step 6: DPP Selection** (5 seconds)
- Uses Determinantal Point Process algorithm
- Selects 40 most diverse images
- Maximizes coverage across style space
- Quality-aware selection

**Example Output:**
```
✅ Image selection complete
   Selected: 40
   Target: 40
   Avg Quality: 0.89
```

### **Step 7: R2 Storage** (30-60 seconds)
- Uploads selected images to Cloudflare R2
- Generates CDN URLs
- Skipped if R2 not configured

**Example Output:**
```
✅ Images stored to R2
   Stored: 40
   Total: 40
```

---

## 📈 Expected Results

### Final Summary
```
═════════════════════════════════════════════════════════════════════════════════
                    🎉 ONBOARDING TEST COMPLETE 🎉
═════════════════════════════════════════════════════════════════════════════════

📊 Summary:
────────────────────────────────────────────────────────────────────────────────
  User Created:           f47ac10b-58cc-4372-a567-0e02b2c3d479
  Portfolio Analyzed:     50 images
  VLT Confidence:         0.87
  Style Clusters:         4
  Images Generated:       46
  Images Selected:        40 (target: 40)
  Success Rate:           87.0%
  Total Duration:         11.2 minutes

💰 Cost Estimate:
────────────────────────────────────────────────────────────────────────────────
  VLT Analysis:           ~$0.50
  Image Generation:       46 × $0.04 = $1.84
  Total Cost:             ~$2.34

✅ Status:                SUCCESS
═════════════════════════════════════════════════════════════════════════════════
```

### Database Records Created
- ✅ 1 User account
- ✅ 50 VLT specifications (portfolio)
- ✅ 1 Style profile
- ✅ 48 Generation jobs
- ✅ 46 Image records (successful generations)
- ✅ 40 Selected images flagged

---

## 🔧 Troubleshooting

### "VLT analysis failed"
**Problem**: VLT service not accessible
**Solutions**:
1. Check `VLT_API_URL` in `.env`
2. Verify API key: `VLT_API_KEY={{VLT_API_KEY}}`
3. Test VLT directly:
   ```bash
   curl https://visual-descriptor-516904417440.us-central1.run.app/health
   ```

### "Image generation failed"
**Problem**: Replicate API token not configured or invalid
**Solutions**:
1. **Verify token in `.env`**:
   ```bash
   # Should be present
   REPLICATE_API_TOKEN={{REPLICATE_API_TOKEN}}
   ```
2. **Test Replicate connection**:
   ```bash
   curl -H "Authorization: Token $REPLICATE_API_TOKEN" \
     https://api.replicate.com/v1/models
   ```
3. **Switch to cheaper provider** (edit test script line 42):
   ```javascript
   // Use Stable Diffusion XL instead of Imagen
   generationProvider: 'stable-diffusion-xl', // $0.02 vs $0.04
   ```
4. **Check Replicate account**:
   - Account active?
   - Billing/credits available?
   - No rate limiting?

### "Database connection failed"
**Problem**: PostgreSQL not running or wrong credentials
**Solutions**:
```bash
# Check if PostgreSQL is running
psql -l

# Check database exists
psql -l | grep designer_bff

# Create database if needed
createdb designer_bff

# Run migrations
psql designer_bff < database/schema.sql
```

### "Portfolio file not found"
**Problem**: ZIP file path incorrect
**Solutions**:
```bash
# Check file exists
ls -lh test-data/anatomie-portfolio.zip

# Use absolute path
node test-first-40-images.js --portfolio=/full/path/to/portfolio.zip
```

### "R2 storage failed"
**Problem**: R2 credentials not configured (non-critical)
**Solutions**:
- Test continues without R2
- Images stored in temp directory
- To fix: Add R2 credentials to `.env`

---

## 🎯 Testing Strategies

### 1. **Quick Test (5 minutes)** - Validate pipeline without cost
```javascript
// Edit test-first-40-images.js
const CONFIG = {
  targetImageCount: 5,      // Only 5 images
  bufferPercent: 20,
  vltModel: 'gemini',
  vltPasses: 'A,B,C',
  generationProvider: 'google-gemini',  // Fast & free
  // ...
};
```

### 2. **Full Test (10-15 minutes)** - Production simulation
```javascript
// Use defaults
const CONFIG = {
  targetImageCount: 40,
  bufferPercent: 20,
  vltModel: 'gemini',
  vltPasses: 'A,B,C',
  generationProvider: 'google-imagen',  // High quality
  // ...
};
```

### 3. **Stress Test (30+ minutes)** - High volume
```javascript
// Large portfolio
const CONFIG = {
  targetImageCount: 100,
  bufferPercent: 25,
  // ...
};
```

---

## 💡 Tips

### Cost Optimization
- **Testing**: Use `stable-diffusion-xl` provider ($0.02/image)
- **Production**: Use `google-imagen` ($0.04/image - highest quality)
- **Both via Replicate** - No separate API keys needed!
- **Buffer**: Adjust `bufferPercent` based on success rate
  - Low success rate → Higher buffer (30-40%)
  - High success rate → Lower buffer (10-20%)
- **Cost comparison** (40 images with 20% buffer = 48 images):
  - Imagen 4 Ultra: 48 × $0.04 = **$1.92**
  - Stable Diffusion XL: 48 × $0.02 = **$0.96** (50% cheaper!)

### Performance
- **Batching**: Test script uses batches of 5 (adjustable)
- **Parallel**: Can increase batch size for faster generation
- **Rate Limits**: 5-second pause between batches (Google API limits)

### Monitoring
- Check logs: `logs/` directory
- Database: Query `generation_jobs` table
- Images: Check `images` table

```sql
-- Check generation status
SELECT status, COUNT(*) FROM generation_jobs GROUP BY status;

-- Check image quality
SELECT AVG(quality_score) FROM images WHERE user_id = 'user-id';

-- Check costs
SELECT SUM(cost) FROM generation_jobs WHERE user_id = 'user-id';
```

---

## 🔄 Running Multiple Tests

```bash
# Test 1: Small portfolio
node test-first-40-images.js --portfolio=./test-data/small-portfolio.zip

# Test 2: Large portfolio
node test-first-40-images.js --portfolio=./test-data/large-portfolio.zip

# Test 3: Different styles
node test-first-40-images.js --portfolio=./test-data/minimalist-portfolio.zip
```

Each test creates a new user or reuses existing test user.

---

## 📚 Next Steps

After successful testing:

1. **Review Generated Images**
   - Check quality scores
   - Verify style consistency
   - Test RLHF feedback loop

2. **Integrate with Frontend**
   - Connect React onboarding flow
   - Display generation progress
   - Show final portfolio

3. **Deploy to Production**
   - Set up R2 storage
   - Configure Imagen API
   - Enable Redis queue
   - Set up monitoring

4. **Optimize**
   - Tune buffer percentage
   - Adjust DPP parameters
   - Refine RLHF rewards
   - Test different templates

---

## 🎉 Success!

If you see the final summary with:
- ✅ 40+ images generated
- ✅ High success rate (>85%)
- ✅ Good quality scores (>0.8)

**You're ready for production!** 🚀

See `MODELS_BUILT_SUMMARY.md` for complete architecture overview.

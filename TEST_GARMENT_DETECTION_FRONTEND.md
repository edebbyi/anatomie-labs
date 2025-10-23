# Testing Garment Detection Improvements - Frontend Guide

## ✅ Prerequisites

Before testing, ensure:
1. ✅ Backend server is running on port 3001
2. ✅ Frontend is running on port 3000
3. ✅ Database has the updated schema (new columns added)
4. ✅ You have a test ZIP file ready

## 🚀 Quick Start

### 1. Check Services Status

```bash
# Check if backend is running
lsof -ti:3001

# Check if frontend is running  
lsof -ti:3000

# If backend not running:
cd /Users/esosaimafidon/Documents/GitHub/anatomie-lab
node server.js

# If frontend not running:
cd /Users/esosaimafidon/Documents/GitHub/anatomie-lab/frontend
npm start
```

### 2. Access the Frontend

Open your browser and go to:
```
http://localhost:3000
```

## 🧪 Testing Workflow

### Step 1: Create Test Account

1. Go to `http://localhost:3000/signup`
2. Create a new test account:
   - Email: `test-garment-detection@test.com`
   - Password: `TestPassword123!`
   - Name: `Test User`

### Step 2: Prepare Test Images

Create a ZIP file with test scenarios:

**Test Case 1: Single Dress Images** (3-5 images)
- Maxi dress
- Mini dress
- Wrap dress

**Test Case 2: Two-Piece Outfits** (3-5 images)
- Matching crop top + high-waist skirt
- Co-ord set (same fabric/pattern)
- Blazer + matching pants

**Test Case 3: Mixed Garments** (remaining images to reach 50+)
- Blazers
- Tops
- Skirts
- Pants

### Step 3: Upload Portfolio

1. After signup, you'll be on the **Onboarding** page
2. Click **"Upload your portfolio"**
3. Select your prepared ZIP file
4. Click **"Continue"**

### Step 4: Monitor Processing

Watch the progress indicators:
- ✅ **Uploading portfolio...** (10%)
- ✅ **Processing portfolio with AI agents...** (20%)
- ✅ **Analyzing images with AI (this may take 2-5 minutes)...** (30%)
- ✅ **Creating your style profile...** (50%)
- ✅ **Generating your first custom designs...** (70%)
- ✅ **Your custom designs are ready!** (90%)
- ✅ **Complete!** (100%)

**Note**: The analysis step takes the longest (~2-5 minutes for 50 images)

### Step 5: Check Results

#### Option A: View in Profile Page

1. Navigate to **Style Profile** page
2. Check the displayed garment distributions

#### Option B: Check Database Directly

```bash
# Open terminal and run:
cd /Users/esosaimafidon/Documents/GitHub/anatomie-lab

# Check garment classifications
node -e "
require('dotenv').config();
const {Pool} = require('pg');
const pool = new Pool({connectionString: process.env.DATABASE_URL});

pool.query(\`
  SELECT 
    garment_type,
    is_two_piece,
    COUNT(*) as count,
    ARRAY_AGG(DISTINCT reasoning) as reasoning_samples
  FROM image_descriptors
  WHERE user_id = (
    SELECT id FROM users 
    WHERE email = 'test-garment-detection@test.com'
  )
  GROUP BY garment_type, is_two_piece
  ORDER BY count DESC
\`).then(r => {
  console.log('\\n📊 Garment Classification Results:\\n');
  console.table(r.rows);
  pool.end();
});
"
```

#### Option C: API Check

```bash
# Get style profile
curl -X GET http://localhost:3001/api/podna/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" | jq
```

## 🔍 What to Look For

### ✅ Success Indicators

1. **No Duplicate Dresses**
   - If you uploaded 3 dress images, you should see exactly 3 "dress" entries
   - NOT multiple classifications for the same image

2. **Two-Piece Detection**
   - Matching top+skirt should be classified as "two-piece" or "co-ord"
   - `is_two_piece` flag should be `true`
   - Reasoning should mention "visible separation" or "matching set"

3. **Accurate Single Garments**
   - Dresses classified as "dress" with `is_two_piece: false`
   - Reasoning mentions "continuous fabric" or "single garment"

### ❌ Issues to Report

1. **Multiple dress detections** for the same image
2. **Two-piece misclassified as dress**
3. **Dress misclassified as two-piece**
4. **Low confidence scores** (< 0.5)
5. **Missing reasoning** field

## 📊 Sample Expected Output

### Good Result:

```
┌─────────┬──────────────┬──────────────┬───────┬──────────────────────────────┐
│ (index) │ garment_type │ is_two_piece │ count │    reasoning_samples         │
├─────────┼──────────────┼──────────────┼───────┼──────────────────────────────┤
│    0    │   'dress'    │    false     │   3   │ ['Continuous fabric...']     │
│    1    │ 'two-piece'  │    true      │   4   │ ['Visible separation...']    │
│    2    │   'blazer'   │    false     │   5   │ ['Single jacket garment']    │
│    3    │   'skirt'    │    false     │   8   │ ['Single bottom piece']      │
└─────────┴──────────────┴──────────────┴───────┴──────────────────────────────┘
```

### Bad Result (Old Behavior):

```
┌─────────┬──────────────┬──────────────┬───────┬──────────────────────────────┐
│ (index) │ garment_type │ is_two_piece │ count │    reasoning_samples         │
├─────────┼──────────────┼──────────────┼───────┼──────────────────────────────┤
│    0    │   'dress'    │    false     │  15   │ ['...'] ← TOO MANY!          │
│    1    │   'dress'    │    false     │  12   │ ['...'] ← DUPLICATES!        │
└─────────┴──────────────┴──────────────┴───────┴──────────────────────────────┘
```

## 🐛 Debugging Tips

### Check Logs

**Backend Logs:**
```bash
tail -f /Users/esosaimafidon/Documents/GitHub/anatomie-lab/server.log | grep -i "Style Descriptor\|garment"
```

**Browser Console:**
1. Open DevTools (F12)
2. Go to Console tab
3. Look for logs starting with 🎨, 🔬, or ✅

### Check Individual Image Analysis

```sql
-- Connect to database
psql postgresql://esosaimafidon@localhost:5432/designer_bff

-- Check specific image
SELECT 
  pi.filename,
  id.garment_type,
  id.is_two_piece,
  id.confidence,
  id.reasoning
FROM image_descriptors id
JOIN portfolio_images pi ON pi.id = id.image_id
WHERE pi.filename LIKE '%dress%'
LIMIT 10;
```

## 🔄 Re-testing

If you need to test again:

### Option 1: Create New User
```
Email: test-garment-2@test.com
```

### Option 2: Clear Existing Data
```sql
-- Delete test user's data
DELETE FROM users WHERE email = 'test-garment-detection@test.com';
-- Cascade will delete portfolios, images, descriptors automatically
```

## 📸 Screenshots to Take

For documentation:

1. **Upload screen** - showing ZIP file selected
2. **Processing screen** - showing progress at ~30%
3. **Profile page** - showing garment distributions
4. **Database results** - terminal output of garment classifications

## ✅ Success Criteria

The test is successful if:
- [ ] No duplicate dress detections
- [ ] Two-piece outfits correctly identified
- [ ] `is_two_piece` flag is accurate
- [ ] `reasoning` field explains the decision
- [ ] Confidence scores are > 0.6
- [ ] All images processed without errors
- [ ] Style profile generates correctly

## 🆘 Troubleshooting

### Issue: "No images found in ZIP"
**Solution**: Ensure images are at the root level, not in subfolders

### Issue: "Portfolio must contain at least 50 images"
**Solution**: Add more images OR temporarily change the minimum in ingestionAgent.js

### Issue: Frontend not connecting to backend
**Solution**: Check CORS settings and API_URL in .env.development

### Issue: Analysis takes too long
**Solution**: Normal for 50+ images. Gemini 2.5 Flash processes ~1 image/second

### Issue: Profile page shows no data
**Solution**: Check if analysis completed successfully in database

## 📝 Test Report Template

```markdown
## Test Results - Garment Detection

**Date**: [Today's date]
**Tester**: [Your name]
**Test Account**: test-garment-detection@test.com

### Test Setup
- Total images in ZIP: ___
- Expected dresses: ___
- Expected two-pieces: ___
- Expected other garments: ___

### Results
- Detected dresses: ___
- Detected two-pieces: ___
- Detected other garments: ___

### Issues Found
1. [List any issues]

### Screenshots
- [Attach screenshots]

### Verdict
✅ Pass / ❌ Fail

### Notes
[Any additional observations]
```

---

## 🎯 Next Steps After Testing

If the test is successful:
1. ✅ Document the results
2. ✅ Test with real-world images
3. ✅ Fine-tune prompt if needed
4. ✅ Add more garment types if missing

If issues are found:
1. ❌ Document specific failures
2. ❌ Check reasoning field for patterns
3. ❌ Adjust prompt in styleDescriptorAgent.js
4. ❌ Re-test

---

**Ready to test?** Follow the steps above and let me know if you encounter any issues! 🚀

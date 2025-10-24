# 🛠️ IMPLEMENTATION GUIDE FOR CODE BUILDER

## 📋 Overview

This package contains a complete prompt generation system for a fashion AI platform. You need to:
1. Deploy database schema
2. Integrate the new prompt builder
3. Wire up feedback loops
4. Test and migrate

**Estimated time:** 2-4 hours

---

## 🎯 What This System Does

**Current Problem:**
- Two redundant prompt builders exist (`advancedPromptBuilderAgent.js` and `promptGeneratorAgent.js`)
- They generate generic prompts (~15 tokens)
- No learning from user feedback
- No caching

**This Solution:**
- One unified `IntelligentPromptBuilder` 
- Generates detailed prompts (~85 tokens) using 150+ attributes
- Thompson Sampling learns what works
- In-memory caching (60-80% hit rate)
- Zero API costs

---

## 📁 Package Structure

```
intelligent-prompt-builder/
├── README.md                          # Complete documentation
├── IMPLEMENTATION.md                  # This file (step-by-step guide)
├── src/
│   └── services/
│       └── IntelligentPromptBuilder.js  # Main implementation
├── database/
│   └── prompt_builder_schema.sql      # Database schema
├── tests/
│   └── migration_guide.js             # Testing & comparison tools
└── docs/
    └── quick_action_guide.js          # Quick reference & troubleshooting
```

---

## ⚙️ Prerequisites

Before implementing, verify:

### 1. Database Access
```sql
-- You need PostgreSQL with these privileges:
-- CREATE TABLE, CREATE VIEW, CREATE FUNCTION
-- Database should already have:
SELECT COUNT(*) FROM ultra_detailed_descriptors;
-- ^ This should return > 0 (ultra-detailed ingestion must be working)
```

### 2. Current Code Structure
```javascript
// Find where prompts are currently generated
// Look for these files in the codebase:
// - src/services/advancedPromptBuilderAgent.js
// - src/services/promptGeneratorAgent.js
// - src/services/promptBuilderAgent.js
```

### 3. Image Generation Endpoint
```javascript
// Find where images are generated
// Look for code like:
const prompt = await promptBuilder.generatePrompt(userId);
const image = await generateImage({ prompt: prompt.text });
```

---

## 🚀 Implementation Steps

### STEP 1: Deploy Database Schema (15 minutes)

**1.1 Connect to database**
```bash
# SSH into your server or use database client
psql -U [username] -d [database_name]
```

**1.2 Run schema**
```bash
# From the intelligent-prompt-builder directory:
psql -U [username] -d [database_name] -f database/prompt_builder_schema.sql
```

**1.3 Verify tables created**
```sql
-- Should return 3 tables:
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('prompts', 'thompson_sampling_params', 'prompt_feedback');

-- Should return 4 views:
SELECT table_name FROM information_schema.views 
WHERE table_schema = 'public' 
AND table_name LIKE '%prompt%';
```

**Expected output:**
- Tables: `prompts`, `thompson_sampling_params`, `prompt_feedback`
- Views: `top_performing_prompts`, `thompson_sampling_effectiveness`, `prompt_generation_stats`, `category_performance`

---

### STEP 2: Deploy Code (15 minutes)

**2.1 Copy main file**
```bash
# Copy to your services directory:
cp src/services/IntelligentPromptBuilder.js [YOUR_PROJECT]/src/services/

# Example:
# cp src/services/IntelligentPromptBuilder.js /var/www/fashion-app/src/services/
```

**2.2 Install (no new dependencies needed)**
The code uses only existing dependencies:
- `pg` (PostgreSQL client) - already in your project
- Node.js standard library

**2.3 Verify file structure**
```bash
# Your project should now have:
ls -la [YOUR_PROJECT]/src/services/IntelligentPromptBuilder.js
```

---

### STEP 3: Update Import Paths (10 minutes)

**3.1 Find database import**

In `IntelligentPromptBuilder.js`, update this line (line 14):
```javascript
// CURRENT:
const db = require('./database');

// UPDATE TO (match your project structure):
const db = require('../database/connection');  // or wherever your db module is
```

**3.2 Find logger import**

In `IntelligentPromptBuilder.js`, update this line (line 15):
```javascript
// CURRENT:
const logger = require('../utils/logger');

// UPDATE TO (match your project structure):
const logger = require('../utils/logger');  // or console if no logger
// OR if no logger:
const logger = { 
  info: console.log, 
  warn: console.warn, 
  error: console.error 
};
```

---

### STEP 4: Integration (30 minutes)

**4.1 Find image generation endpoint**

Look for your image generation code. It probably looks like:
```javascript
// OLD CODE (somewhere in your routes/controllers):
const promptBuilder = require('./services/advancedPromptBuilderAgent');

app.post('/api/generate-image', async (req, res) => {
  const { userId, options } = req.body;
  
  // Old way:
  const prompt = await promptBuilder.generatePrompt(userId, options);
  const image = await imageService.generate({
    prompt: prompt.text,  // ← OLD STRUCTURE
    // ...
  });
  
  res.json({ image });
});
```

**4.2 Update to new system**

```javascript
// NEW CODE:
const intelligentPromptBuilder = require('./services/IntelligentPromptBuilder');

app.post('/api/generate-image', async (req, res) => {
  const { userId, options } = req.body;
  
  // New way:
  const promptData = await intelligentPromptBuilder.generatePrompt(userId, {
    garmentType: options?.garmentType,
    season: options?.season,
    occasion: options?.occasion,
    creativity: options?.creativity || 0.3,
    useCache: true  // Enable caching
  });
  
  const image = await imageService.generate({
    prompt: promptData.positive_prompt,      // ← NEW STRUCTURE
    negative_prompt: promptData.negative_prompt,  // ← NEW FIELD
    // ...
  });
  
  // Store prompt_id for feedback loop
  const result = {
    image,
    prompt_id: promptData.prompt_id,  // ← SAVE THIS
    metadata: promptData.metadata
  };
  
  res.json(result);
});
```

---

### STEP 5: Wire Feedback Loop (20 minutes)

**5.1 Find feedback endpoints**

Look for where users like/save/share images:
```javascript
// Probably something like:
app.post('/api/images/:imageId/like', async (req, res) => {
  const { imageId } = req.params;
  const { userId } = req.user;
  
  // OLD: Just save to database
  await db.query('UPDATE images SET liked = true WHERE id = $1', [imageId]);
  
  res.json({ success: true });
});
```

**5.2 Update to include Thompson feedback**

```javascript
// NEW: Save to database AND update Thompson params
const intelligentPromptBuilder = require('./services/IntelligentPromptBuilder');

app.post('/api/images/:imageId/like', async (req, res) => {
  const { imageId } = req.params;
  const { userId } = req.user;
  
  // Save like to database
  await db.query('UPDATE images SET liked = true WHERE id = $1', [imageId]);
  
  // Get the prompt_id associated with this image
  const result = await db.query(
    'SELECT prompt_id FROM images WHERE id = $1', 
    [imageId]
  );
  const promptId = result.rows[0]?.prompt_id;
  
  // Update Thompson Sampling parameters (system learns!)
  if (promptId) {
    await intelligentPromptBuilder.updateThompsonParamsFromFeedback(
      userId,
      promptId,
      { liked: true, saved: false, shared: false }
    );
  }
  
  res.json({ success: true });
});

// Repeat for save/share endpoints:
app.post('/api/images/:imageId/save', async (req, res) => {
  // ... similar pattern with { liked: false, saved: true, shared: false }
});

app.post('/api/images/:imageId/share', async (req, res) => {
  // ... similar pattern with { liked: false, saved: false, shared: true }
});
```

**5.3 Update image storage**

Make sure you're saving `prompt_id` when storing images:
```javascript
// When saving generated image:
await db.query(
  'INSERT INTO images (id, user_id, url, prompt_id, created_at) VALUES ($1, $2, $3, $4, NOW())',
  [imageId, userId, imageUrl, promptData.prompt_id]  // ← Save prompt_id
);
```

---

### STEP 6: Testing (30 minutes)

**6.1 Install testing tools**
```bash
# Copy test file to your project:
cp tests/migration_guide.js [YOUR_PROJECT]/tests/

# Update imports in migration_guide.js to match your project structure
```

**6.2 Run comparison test**
```bash
node tests/migration_guide.js compare [test-user-id]
```

**Expected output:**
```
========================================
PROMPT BUILDER COMPARISON TEST
========================================

🔧 Running OLD System #1...
✅ OLD System #1 Complete
   Time: 87ms
   Tokens: 18

🚀 Running NEW System...
✅ NEW System Complete
   Time: 143ms
   Tokens: 87
   Cache Hit Rate: 0%
========================================
```

**6.3 Run benchmark test**
```bash
node tests/migration_guide.js benchmark [test-user-id]
```

**Expected output:**
```
📊 RESULTS:
   First generation (cache miss): 145ms
   Cached generations (avg): 1.32ms
   Speed improvement: 110x faster with cache
   Cache hit rate: 95.0%
```

**6.4 Manual testing**

Test the full flow:
1. Generate an image with new system
2. Verify prompt quality (should be very detailed)
3. Like the image
4. Check Thompson params updated:
```sql
SELECT * FROM thompson_sampling_params WHERE user_id = '[test-user-id]';
-- Should see alpha/beta values
```

---

### STEP 7: Gradual Rollout (1 week)

**7.1 Deploy with A/B testing (Day 1)**

Update your image generation endpoint:
```javascript
const { PromptBuilderRouter } = require('./tests/migration_guide');

// Create router with 10% traffic to new system
const promptRouter = new PromptBuilderRouter(10);

app.post('/api/generate-image', async (req, res) => {
  const { userId, options } = req.body;
  
  // Router decides old vs new system
  const promptData = await promptRouter.generatePrompt(userId, options);
  
  // Rest of your code...
});
```

**7.2 Monitor (Days 1-3)**
- Check error logs (should be <1% errors)
- Monitor cache hit rate: `console.log(promptRouter.getStats())`
- Track user feedback

**7.3 Increase traffic (Days 4-7)**
```javascript
// Day 4: Increase to 25%
promptRouter.increaseNewSystemTraffic(25);

// Day 5: Increase to 50%
promptRouter.increaseNewSystemTraffic(50);

// Day 7: Increase to 100%
promptRouter.increaseNewSystemTraffic(100);
```

**7.4 Full migration (Day 8+)**

Once at 100% and stable:
```javascript
// Remove A/B router, use new system directly:
const intelligentPromptBuilder = require('./services/IntelligentPromptBuilder');

app.post('/api/generate-image', async (req, res) => {
  const promptData = await intelligentPromptBuilder.generatePrompt(userId, options);
  // ...
});
```

---

### STEP 8: Cleanup (After 2 weeks of stability)

**8.1 Deprecate old systems**
```bash
# Move old files to archive:
mkdir [YOUR_PROJECT]/src/services/_deprecated
mv [YOUR_PROJECT]/src/services/advancedPromptBuilderAgent.js [YOUR_PROJECT]/src/services/_deprecated/
mv [YOUR_PROJECT]/src/services/promptBuilderAgent.js [YOUR_PROJECT]/src/services/_deprecated/
```

**8.2 Update all imports**
```bash
# Search for old imports:
grep -r "advancedPromptBuilderAgent" [YOUR_PROJECT]/src/
grep -r "promptBuilderAgent" [YOUR_PROJECT]/src/

# Replace all with:
# const intelligentPromptBuilder = require('./services/IntelligentPromptBuilder');
```

**8.3 Clean up test files (optional)**
```bash
# After confirming everything works:
rm [YOUR_PROJECT]/tests/migration_guide.js
```

---

## ✅ Verification Checklist

After implementation, verify:

### Database
- [ ] Tables created: `prompts`, `thompson_sampling_params`, `prompt_feedback`
- [ ] Views created: 4 analytics views
- [ ] Can query: `SELECT * FROM top_performing_prompts LIMIT 1;`

### Code
- [ ] `IntelligentPromptBuilder.js` deployed to services folder
- [ ] Database import path updated
- [ ] Logger import path updated
- [ ] File runs without errors: `node src/services/IntelligentPromptBuilder.js`

### Integration
- [ ] Image generation endpoint updated
- [ ] Prompts now use `positive_prompt` and `negative_prompt`
- [ ] `prompt_id` saved with images
- [ ] Feedback endpoints wired up
- [ ] Thompson params update on feedback

### Testing
- [ ] Comparison test runs: `node tests/migration_guide.js compare [user-id]`
- [ ] Benchmark test runs: `node tests/migration_guide.js benchmark [user-id]`
- [ ] New prompts are ~85 tokens (vs old ~15 tokens)
- [ ] Cache hit rate >0% after multiple generations

### Production
- [ ] Deployed to production with 10% traffic
- [ ] Error rate <1%
- [ ] Cache hit rate >40% after 1 hour
- [ ] User feedback collected
- [ ] Thompson params updating

---

## 🆘 Troubleshooting

### Error: "Cannot find module './database'"
**Fix:** Update line 14 in `IntelligentPromptBuilder.js` to match your project's database import path.

### Error: "relation 'ultra_detailed_descriptors' does not exist"
**Fix:** You need to deploy the ultra-detailed ingestion agent first. This system depends on that data.

### Issue: Prompts are generic (few tokens)
**Check:** 
```sql
SELECT COUNT(*) FROM ultra_detailed_descriptors WHERE user_id = '[user-id]';
```
If count is 0, ultra-detailed ingestion isn't working. Fix that first.

### Issue: Cache hit rate is 0%
**Check:** Verify `useCache: true` in generation options.
**Debug:**
```javascript
console.log(intelligentPromptBuilder.getCacheHitRate());
```

### Error: "Cannot insert into thompson_sampling_params"
**Check:** Did database schema deploy correctly?
```sql
\dt thompson_sampling_params
```

### Issue: Thompson params never update
**Check:** Is feedback loop wired up?
```javascript
// Add debug logging:
console.log('Updating Thompson params for:', userId, promptId);
await intelligentPromptBuilder.updateThompsonParamsFromFeedback(...);
console.log('Updated successfully');
```

---

## 📊 Expected Performance

After implementation:

**Week 1:**
- Cache hit rate: 40-60%
- Generation time (avg): <50ms
- Prompt token count: 70-90

**Month 1:**
- Cache hit rate: 60-75%
- Thompson params: >100 updates
- User satisfaction: Improved image quality

**Month 3:**
- Cache hit rate: 75-80%
- Generation time (avg): <10ms
- System fully learned preferences

---

## 📞 Support

For issues during implementation:
1. Check this guide's Troubleshooting section
2. Review `docs/quick_action_guide.js` for detailed troubleshooting
3. Check `README.md` for usage examples
4. Test with: `node tests/migration_guide.js compare [user-id]`

---

## 🎯 Success Criteria

Implementation is complete when:
- [x] Database schema deployed
- [x] Code integrated and running
- [x] Feedback loop wired up
- [x] Tests pass
- [x] Prompts are 5-7x more detailed than before
- [x] Cache hit rate >40% after 1 hour
- [x] Error rate <1%
- [x] Old systems deprecated

**Estimated total time:** 2-4 hours (plus 1 week monitoring)

Good luck! 🚀

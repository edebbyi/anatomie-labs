# TESTING & VALIDATION QUERIES

## Quick Validation Checklist

Use these SQL queries and code snippets to verify the fixes are working correctly.

## 1. Verify Portfolio Analysis Data

### Check if ultra-detailed analysis captured pose data

```sql
-- Check sample of analyzed images for pose data
SELECT 
  pi.id,
  pi.filename,
  ud.photography->'shot_composition'->>'type' as shot_type,
  ud.photography->'pose'->>'gaze' as gaze,
  ud.photography->'pose'->>'body_position' as body_position,
  ud.photography->'camera_angle'->>'horizontal' as camera_angle,
  ud.overall_confidence
FROM portfolio_images pi
JOIN ultra_detailed_descriptors ud ON pi.id = ud.image_id
WHERE pi.user_id = 'YOUR_USER_ID'
ORDER BY pi.created_at DESC
LIMIT 10;
```

**Expected output:**
- `shot_type` should have values like: "full body", "three-quarter length shot", "waist-up"
- `gaze` should have values like: "camera", "away", "down"
- `body_position` should have values like: "standing", "sitting"
- `camera_angle` should have values like: "straight-on", "3/4 angle", "profile"

### Check if accessories were captured

```sql
-- Check for accessory data
SELECT 
  pi.id,
  pi.filename,
  ud.styling_context->'accessories' as accessories
FROM portfolio_images pi
JOIN ultra_detailed_descriptors ud ON pi.id = ud.image_id
WHERE pi.user_id = 'YOUR_USER_ID'
  AND ud.styling_context->'accessories' IS NOT NULL
LIMIT 5;
```

## 2. Verify Thompson Sampling Learning

### Check if pose preferences are being tracked

```sql
-- Check Thompson sampling parameters for poses
SELECT 
  category,
  attribute,
  alpha,
  beta,
  (alpha::float / (alpha + beta)) as success_rate,
  updated_at
FROM thompson_sampling_params
WHERE user_id = 'YOUR_USER_ID'
  AND category IN ('poses', 'photography', 'accessories', 'styleContext')
ORDER BY category, alpha DESC;
```

**Expected output:**
- Should see entries for `category = 'poses'`
- Attributes should look like: "three-quarter_front-facing", "full-body_front-facing"
- `alpha` and `beta` values should update based on user feedback

### Check prompt generation metadata

```sql
-- Check recently generated prompts for new metadata fields
SELECT 
  p.id,
  p.text as prompt,
  p.json_spec->'shot_type' as shot_type,
  p.json_spec->'camera_angle' as camera_angle,
  p.json_spec->'pose_enforced_front_facing' as enforced_front_facing,
  p.created_at
FROM prompts p
WHERE p.user_id = 'YOUR_USER_ID'
ORDER BY p.created_at DESC
LIMIT 5;
```

**Expected output:**
- `shot_type` should be populated
- `camera_angle` should be populated
- `enforced_front_facing` should be true for most prompts

## 3. Validate Prompt Structure

### Check prompt component order

```javascript
// Node.js script to validate prompt structure
const db = require('./src/services/database');

async function validatePromptStructure(userId) {
  const result = await db.query(
    'SELECT id, text FROM prompts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5',
    [userId]
  );

  result.rows.forEach((row, idx) => {
    console.log(`\n=== Prompt ${idx + 1} (ID: ${row.id}) ===`);
    const tokens = row.text.split(', ');
    
    // Define expected order patterns
    const patterns = {
      styleContext: /signature.*mode/i,
      garment: /blazer|dress|coat|jacket|pants|skirt/i,
      fabric: /fabric|wool|cotton|silk/i,
      color: /palette|color/i,
      shotType: /length shot|full body|waist-up/i,
      facingCamera: /facing camera|front-facing/i,
      lighting: /lighting/i,
      cameraAngle: /angle/i,
      quality: /professional fashion|8k|high detail/i
    };

    // Find position of each component
    const positions = {};
    tokens.forEach((token, pos) => {
      for (const [key, pattern] of Object.entries(patterns)) {
        if (pattern.test(token) && !positions[key]) {
          positions[key] = pos;
        }
      }
    });

    console.log('Component positions:', positions);
    
    // Validate order
    const expectedOrder = [
      'styleContext', 'garment', 'fabric', 'color', 
      'shotType', 'facingCamera', 'lighting', 'cameraAngle', 'quality'
    ];
    
    let lastPos = -1;
    let orderCorrect = true;
    expectedOrder.forEach(key => {
      if (positions[key]) {
        if (positions[key] < lastPos) {
          console.warn(`⚠️  ${key} out of order! Position ${positions[key]}, expected after ${lastPos}`);
          orderCorrect = false;
        }
        lastPos = positions[key];
      }
    });

    if (orderCorrect) {
      console.log('✅ Prompt order is CORRECT');
    } else {
      console.log('❌ Prompt order is INCORRECT');
    }

    // Check for front-facing tokens
    const hasFacingCamera = row.text.includes('facing camera');
    const hasFrontFacing = row.text.includes('front-facing');
    const hasBackView = row.text.includes('back view') || row.text.includes('profile');

    console.log(`Front-facing tokens: ${hasFacingCamera ? '✅' : '❌'} facing camera, ${hasFrontFacing ? '✅' : '❌'} front-facing`);
    console.log(`Unwanted tokens: ${hasBackView ? '⚠️  Found back/profile' : '✅ None found'}`);
  });
}

// Usage
validatePromptStructure('YOUR_USER_ID').then(() => process.exit(0));
```

### Check negative prompts

```sql
-- Check if negative prompts include new anti-back-view tokens
SELECT 
  id,
  negative_prompt,
  CASE 
    WHEN negative_prompt LIKE '%back view%' THEN '✅ Has back view'
    ELSE '❌ Missing back view'
  END as has_back_view_negative,
  CASE 
    WHEN negative_prompt LIKE '%rear view%' THEN '✅ Has rear view'
    ELSE '❌ Missing rear view'
  END as has_rear_view_negative,
  created_at
FROM prompts
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 5;
```

## 4. Test Prompt Generation API

### Generate test prompts with different parameters

```javascript
// Test script
const promptBuilder = require('./src/services/IntelligentPromptBuilder');

async function testPromptGeneration() {
  const userId = 'YOUR_USER_ID';
  
  // Test 1: Default blazer prompt
  console.log('\n=== Test 1: Default Blazer ===');
  const result1 = await promptBuilder.generatePrompt(userId, {
    garmentType: 'blazer',
    creativity: 0.3
  });
  console.log('Prompt:', result1.positive_prompt);
  console.log('Shot type:', result1.metadata.shot_type);
  console.log('Camera angle:', result1.metadata.camera_angle);
  console.log('Front-facing enforced:', result1.metadata.pose_enforced_front_facing);

  // Test 2: High creativity
  console.log('\n=== Test 2: High Creativity ===');
  const result2 = await promptBuilder.generatePrompt(userId, {
    creativity: 0.8
  });
  console.log('Prompt:', result2.positive_prompt);

  // Test 3: Specific garment type
  console.log('\n=== Test 3: Dress ===');
  const result3 = await promptBuilder.generatePrompt(userId, {
    garmentType: 'dress',
    creativity: 0.3
  });
  console.log('Prompt:', result3.positive_prompt);

  // Verify all prompts have front-facing tokens
  const prompts = [result1, result2, result3];
  prompts.forEach((result, idx) => {
    const hasFrontFacing = result.positive_prompt.includes('facing camera') ||
                          result.positive_prompt.includes('front-facing');
    console.log(`\nPrompt ${idx + 1}: ${hasFrontFacing ? '✅' : '❌'} Front-facing`);
  });
}

testPromptGeneration().then(() => process.exit(0)).catch(console.error);
```

## 5. Compare Before/After Prompts

### Query to compare old vs new prompt structure

```sql
-- Get recent prompts to compare
WITH recent_prompts AS (
  SELECT 
    id,
    text,
    json_spec,
    created_at,
    ROW_NUMBER() OVER (ORDER BY created_at DESC) as rn
  FROM prompts
  WHERE user_id = 'YOUR_USER_ID'
    AND created_at > NOW() - INTERVAL '7 days'
)
SELECT 
  id,
  -- Check for new components
  CASE WHEN text LIKE '%facing camera%' THEN '✅' ELSE '❌' END as has_facing_camera,
  CASE WHEN text LIKE '%front-facing pose%' THEN '✅' ELSE '❌' END as has_front_pose,
  CASE WHEN text LIKE '%length shot%' THEN '✅' ELSE '❌' END as has_shot_type,
  CASE WHEN json_spec ? 'shot_type' THEN '✅' ELSE '❌' END as has_metadata_shot_type,
  CASE WHEN json_spec ? 'camera_angle' THEN '✅' ELSE '❌' END as has_metadata_angle,
  -- Extract key components
  SUBSTRING(text FROM 'in (.+?) fabric') as fabric,
  SUBSTRING(text FROM '(\w+ and \w+) palette') as colors,
  created_at
FROM recent_prompts
WHERE rn <= 10
ORDER BY created_at DESC;
```

## 6. Validate Generated Images

### Manual checklist for generated images

After generating 10-20 images with the new prompts, validate:

```javascript
// Image validation checklist
const imageValidation = {
  checklist: [
    { item: 'Model is facing camera (not turned away)', pass: null },
    { item: 'Shot type matches portfolio (3/4 length, full body, etc.)', pass: null },
    { item: 'Camera angle is front or 3/4 front (not profile/side)', pass: null },
    { item: 'Lighting quality matches portfolio style', pass: null },
    { item: 'Colors match requested palette', pass: null },
    { item: 'Garment details match prompt', pass: null },
    { item: 'Overall composition looks professional', pass: null }
  ],
  
  validate: function(imageId) {
    console.log(`\nValidating image: ${imageId}`);
    this.checklist.forEach((check, idx) => {
      const response = prompt(`${idx + 1}. ${check.item} (y/n): `);
      check.pass = response.toLowerCase() === 'y';
    });
    
    const passCount = this.checklist.filter(c => c.pass).length;
    const score = (passCount / this.checklist.length * 100).toFixed(1);
    
    console.log(`\nValidation Score: ${score}%`);
    console.log('Failed checks:');
    this.checklist.filter(c => !c.pass).forEach(c => {
      console.log(`  ❌ ${c.item}`);
    });
    
    return score >= 70; // Pass threshold
  }
};
```

### Track success rate over time

```sql
-- Track front-facing success rate after deployment
SELECT 
  DATE(g.created_at) as date,
  COUNT(*) as total_generations,
  COUNT(*) FILTER (
    WHERE f.feedback_type IN ('like', 'save', 'swipe_right')
  ) as positive_feedback,
  COUNT(*) FILTER (
    WHERE f.feedback_type IN ('dislike', 'delete', 'swipe_left')
  ) as negative_feedback,
  ROUND(
    COUNT(*) FILTER (WHERE f.feedback_type IN ('like', 'save'))::numeric / 
    COUNT(*)::numeric * 100, 
    1
  ) as success_rate_pct
FROM generations g
LEFT JOIN feedback f ON g.id = f.generation_id
WHERE g.created_at > 'YYYY-MM-DD'  -- Date you deployed the fix
GROUP BY DATE(g.created_at)
ORDER BY date DESC;
```

## 7. Regression Tests

### Ensure existing functionality still works

```javascript
// Regression test suite
const tests = [
  {
    name: 'Cache functionality',
    test: async () => {
      const builder = require('./src/services/IntelligentPromptBuilder');
      const userId = 'test-user';
      
      // First call - should be cache miss
      const result1 = await builder.generatePrompt(userId, { useCache: true });
      const misses1 = builder.cacheMisses;
      
      // Second call - should be cache hit
      const result2 = await builder.generatePrompt(userId, { useCache: true });
      const hits = builder.cacheHits;
      
      return hits > 0 && result1.prompt_id === result2.prompt_id;
    }
  },
  {
    name: 'Thompson sampling parameter updates',
    test: async () => {
      const builder = require('./src/services/IntelligentPromptBuilder');
      const userId = 'test-user';
      const promptId = 'test-prompt-id';
      
      await builder.updateThompsonParamsFromFeedback(userId, promptId, {
        liked: true,
        saved: true
      });
      
      const params = await builder.getThompsonParams(userId);
      return params && Object.keys(params).length > 0;
    }
  },
  {
    name: 'Fallback to default prompt',
    test: async () => {
      const builder = require('./src/services/IntelligentPromptBuilder');
      
      // User with no descriptors should get default prompt
      const result = await builder.generatePrompt('new-user-no-descriptors');
      
      return result.metadata.default === true &&
             result.positive_prompt.includes('front-facing');
    }
  }
];

// Run tests
async function runRegressionTests() {
  console.log('Running regression tests...\n');
  
  for (const test of tests) {
    try {
      const passed = await test.test();
      console.log(`${passed ? '✅' : '❌'} ${test.name}`);
    } catch (error) {
      console.log(`❌ ${test.name} - Error: ${error.message}`);
    }
  }
}

runRegressionTests().then(() => process.exit(0));
```

## 8. Performance Validation

### Check query performance

```sql
-- Ensure aggregatePreferences query is performant
EXPLAIN ANALYZE
SELECT * FROM ultra_detailed_descriptors
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 50;

-- Should complete in < 100ms
-- Add index if slow:
CREATE INDEX IF NOT EXISTS idx_ultra_descriptors_user_created 
ON ultra_detailed_descriptors(user_id, created_at DESC);
```

### Monitor cache hit rate

```javascript
// Add to your monitoring/logging
setInterval(() => {
  const builder = require('./src/services/IntelligentPromptBuilder');
  console.log('Cache stats:', {
    hitRate: builder.getCacheHitRate(),
    size: builder.cache.size,
    hits: builder.cacheHits,
    misses: builder.cacheMisses
  });
}, 60000); // Every minute
```

## Success Criteria

Your implementation is successful when:

- ✅ All prompts include "facing camera" or "front-facing pose" tokens
- ✅ Prompt metadata includes `shot_type` and `camera_angle` fields
- ✅ Thompson sampling tracks poses, accessories, and style context
- ✅ 90%+ of generated images show front-facing models
- ✅ Shot types match user's portfolio style
- ✅ User feedback is positive (>70% like/save rate)
- ✅ Cache hit rate is >50% for repeat generations
- ✅ All regression tests pass

## Rollback Plan

If issues occur after deployment:

```bash
# 1. Restore backup
cp src/services/IntelligentPromptBuilder.js.backup src/services/IntelligentPromptBuilder.js

# 2. Clear cache
redis-cli FLUSHDB  # If using Redis
# OR in-memory cache will clear on restart

# 3. Restart application
npm restart

# 4. Verify rollback
curl -X POST http://localhost:3000/api/prompts/generate \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user", "garmentType": "blazer"}'
```

# PROMPT ORDER & SHOT TYPE FIXES - IMPLEMENTATION GUIDE

## Problem Summary

Your AI design system had two critical issues:

1. **Incorrect Prompt Order**: Prompts weren't following the optimal structure (Style → Garment → Color → Model/Pose → Accessories → Lighting → Camera)
2. **Missing Shot Types**: Photography data (shot types, poses, angles) was being captured during analysis but NOT used in generation, causing:
   - Models facing away/to the side instead of front-facing
   - Inconsistent shot types vs. user's uploaded portfolio
   - No learning of user's preferred photography style

## What Was Fixed

### 1. Correct Prompt Order Implementation

**OLD ORDER** (Random/Incomplete):
```
garment → fabric → colors → construction → photography → quality markers
```

**NEW ORDER** (Optimized):
```
Style Context → Garment → Fabric → Colors → Model/Pose → Accessories → Lighting → Camera → Quality
```

**Example Output:**
```
in the user's signature 'single-breasted blazer essentials' mode:, 
(slightly oversized, relaxed single-breasted blazer), 
in wool blend suiting fabric, with soft finish, 
(ecru and black palette), 
(three-quarter length shot:1.3), 
(model facing camera:1.3), 
(front-facing pose:1.2), 
soft lighting from front, 
(3/4 front angle:1.2), 
at eye level, 
clean studio background, 
modern editorial style,
(professional fashion photography:1.3), (high detail:1.2), (8k:1.1)
```

### 2. Shot Type Learning & Application

**NEW FEATURES:**

#### A. Pose Aggregation
The system now tracks and learns from your portfolio:
- Shot types (full body, 3/4 length, close-up, detail shot)
- Body positions (front-facing, profile, etc.)
- Pose styles (confident, relaxed, dynamic)
- Camera angles (front, 3/4, side)

#### B. Front-Facing Enforcement
```javascript
// Always ensure front-facing poses
ensureFrontAngle(angle) {
  const angleLower = angle.toLowerCase();
  
  if (angleLower.includes('side') || 
      angleLower.includes('back') || 
      angleLower.includes('profile')) {
    return '3/4 front angle'; // Override non-front angles
  }
  
  return angle;
}
```

#### C. Default Behavior
If no learned pose data exists:
```javascript
// DEFAULT: Always front-facing
components.push(this.formatToken('three-quarter length shot', 1.3));
components.push(this.formatToken('model facing camera', 1.3));
components.push(this.formatToken('front-facing pose', 1.2));
```

### 3. Enhanced Negative Prompts

**ADDED** to negative prompt list:
```javascript
'back view', 'rear view', 'turned away'
```

This explicitly tells the AI to avoid non-front-facing poses.

## Database Changes Required

### 1. Add Pose Category to Thompson Sampling

```sql
-- No schema changes needed! The thompson_sampling_params table 
-- already supports any category. Just need to start tracking 'poses'

-- Example records that will be created:
INSERT INTO thompson_sampling_params (user_id, category, attribute, alpha, beta)
VALUES 
  ('user-id', 'poses', 'three-quarter_front-facing', 2, 2),
  ('user_id', 'poses', 'full-body_front-facing', 2, 2),
  ('user_id', 'accessories', 'jewelry: gold chain', 2, 2);
```

### 2. Verify Ultra-Detailed Descriptors

Your `ultra_detailed_descriptors` table already captures all needed data:
```sql
-- These columns already exist and contain the data we need:
- photography (JSONB) -- Contains shot types, angles, lighting
- styling_context (JSONB) -- Contains accessories
- contextual_attributes (JSONB) -- Contains mood/aesthetic
```

## Implementation Steps

### Step 1: Replace IntelligentPromptBuilder.js

```bash
# Backup current version
cp src/services/IntelligentPromptBuilder.js src/services/IntelligentPromptBuilder.js.backup

# Replace with fixed version
cp IntelligentPromptBuilder_FIXED.js src/services/IntelligentPromptBuilder.js
```

### Step 2: Clear Existing Cache

```javascript
// In your application startup or via admin endpoint
const promptBuilder = require('./src/services/IntelligentPromptBuilder');
promptBuilder.cache.clear();
```

### Step 3: Test with Existing User

```javascript
// Generate a test prompt
const result = await promptBuilder.generatePrompt(
  'existing-user-id',
  {
    garmentType: 'blazer',
    creativity: 0.3
  }
);

console.log('Generated prompt:', result.positive_prompt);
console.log('Metadata:', result.metadata);
```

### Step 4: Verify Prompt Structure

Check that generated prompts follow this pattern:

```
✓ Style context appears first (if available)
✓ Garment description with silhouette + fit + type
✓ Fabric with finish
✓ Color palette
✓ Shot type with high weight (1.3)
✓ "model facing camera" token
✓ "front-facing pose" token
✓ Lighting with direction
✓ Camera angle (should be front-facing)
✓ Camera height
✓ Background
✓ Quality markers at end
```

## Key Code Changes Explained

### 1. New Preference Categories

```javascript
const preferences = {
  garments: {},
  fabrics: {},
  colors: {},
  construction: {},
  photography: {},
  poses: {},         // NEW
  accessories: {},   // NEW
  styleContext: {}   // NEW
};
```

### 2. Pose Data Extraction

```javascript
// Extract pose from photography analysis
if (photography && photography.pose) {
  const poseKey = this.generatePoseKey(photography);
  preferences.poses[poseKey] = {
    count: 0,
    data: {
      shot_type: photography.shot_composition?.type || 'three-quarter length shot',
      body_position: this.determineFacingDirection(photography.pose),
      pose_style: this.describePoseStyle(photography.pose)
    }
  };
}
```

### 3. Front-Facing Detection

```javascript
determineFacingDirection(pose) {
  if (!pose) return 'front-facing';
  
  const gaze = pose.gaze?.toLowerCase() || '';
  const head = pose.head?.toLowerCase() || '';
  
  // Check if model is facing camera
  if (gaze.includes('camera') || head.includes('straight')) {
    return 'front-facing';
  }
  
  // Override non-front poses
  if (gaze.includes('away') || head.includes('turned')) {
    return 'profile'; // Will be overridden to front-facing
  }
  
  return 'front-facing';
}
```

### 4. Prompt Component Ordering

```javascript
// Components are now added in strict order:

// 1. Style context
if (selected.styleContext) {
  components.push(this.formatToken(`in the user's signature '${selected.styleContext}' mode:`, 1.2));
}

// 2. Garment (with silhouette, fit, type)
const garmentParts = [];
if (selected.garment.silhouette) garmentParts.push(selected.garment.silhouette);
if (selected.garment.fit) garmentParts.push(selected.garment.fit);
garmentParts.push(selected.garment.type);
components.push(this.formatToken(garmentParts.join(', '), 1.3));

// 3. Fabric
const fabricDesc = `in ${selected.fabric.material} fabric, with ${selected.fabric.finish} finish`;
components.push(this.formatToken(fabricDesc, 1.2));

// 4. Colors
const colorList = selected.colors.map(c => c.name).join(' and ');
components.push(this.formatToken(`${colorList} palette`, 1.3));

// 5. Model & Pose (HIGH PRIORITY - 1.3 weight)
components.push(this.formatToken('three-quarter length shot', 1.3));
components.push(this.formatToken('model facing camera', 1.3));
components.push(this.formatToken('front-facing pose', 1.2));

// 6. Accessories
for (const accessory of selected.accessories) {
  components.push(this.formatToken(accessory, 1.0));
}

// 7. Lighting
components.push(this.formatToken(`${lighting} from ${direction}`, 1.1));

// 8. Camera specs
components.push(this.formatToken('3/4 front angle', 1.2));
components.push(this.formatToken('at eye level', 1.0));
components.push(this.formatToken('clean studio background', 1.0));

// 9-10. Style descriptor + quality markers (always last)
```

## Testing Checklist

- [ ] Prompts follow correct order (style → garment → color → pose → lighting → camera)
- [ ] "model facing camera" appears in prompts with high weight (1.3)
- [ ] "front-facing pose" appears in prompts
- [ ] Side/back angles are overridden to "3/4 front angle"
- [ ] Negative prompts include "back view, rear view, turned away"
- [ ] Generated images show models facing camera (not turned away)
- [ ] Shot types match user's portfolio (3/4 length, full body, etc.)
- [ ] Thompson sampling learns from user feedback on poses
- [ ] Prompt metadata includes shot_type and camera_angle fields

## Troubleshooting

### Issue: Still getting side-facing models

**Solutions:**
1. Check negative prompt is being applied:
   ```javascript
   console.log('Negative prompt:', result.negative_prompt);
   // Should include: "back view, rear view, turned away"
   ```

2. Increase weight on front-facing tokens:
   ```javascript
   components.push(this.formatToken('model facing camera', 1.5)); // Increase from 1.3
   components.push(this.formatToken('front-facing pose', 1.4)); // Increase from 1.2
   ```

3. Add more specific negative prompts:
   ```javascript
   this.DEFAULT_NEGATIVE_PROMPT = [
     // ... existing negatives
     'back view', 'rear view', 'turned away',
     'looking away', 'side profile', 'profile view', // ADD THESE
     'facing left', 'facing right', 'over shoulder'  // ADD THESE
   ].join(', ');
   ```

### Issue: Shot types not being learned

**Solutions:**
1. Verify ultra-detailed analysis ran:
   ```sql
   SELECT 
     id, 
     photography->>'shot_composition' as shot_type,
     photography->>'pose' as pose
   FROM ultra_detailed_descriptors
   WHERE user_id = 'your-user-id'
   LIMIT 5;
   ```

2. Check preferences aggregation:
   ```javascript
   const descriptors = await promptBuilder.getUltraDetailedDescriptors(userId);
   const preferences = promptBuilder.aggregatePreferences(descriptors);
   console.log('Pose preferences:', preferences.poses);
   ```

3. Verify Thompson sampling is tracking poses:
   ```sql
   SELECT * FROM thompson_sampling_params
   WHERE user_id = 'your-user-id' AND category = 'poses';
   ```

### Issue: Prompt order still wrong

**Solution:**
Double-check you replaced the correct file and restarted the server:
```bash
# Verify the new code is in place
grep -n "MODEL & POSE" src/services/IntelligentPromptBuilder.js
# Should show line numbers where the new comments appear

# Restart server
npm restart
```

## Expected Results

### Before Fix:
```
(boxy single-breasted blazer), in Woven suiting fabric, 
(ecru and black palette), natural lighting, 
three-quarter length shot, profile angle, 
minimal background, (professional fashion photography:1.3)
```
❌ No front-facing enforcement
❌ "profile angle" causes side-facing models
❌ Missing model/pose section

### After Fix:
```
in the user's signature 'single-breasted blazer essentials' mode:, 
(slightly oversized, relaxed single-breasted blazer), 
in wool blend suiting fabric, with soft finish, 
(ecru and black palette), 
(three-quarter length shot:1.3), 
(model facing camera:1.3), 
(front-facing pose:1.2), 
soft lighting from front, 
(3/4 front angle:1.2), 
at eye level, 
clean studio background, 
modern editorial style,
(professional fashion photography:1.3), (high detail:1.2)
```
✅ Correct order maintained
✅ Explicit front-facing pose tokens with high weights
✅ "3/4 front angle" instead of "profile angle"
✅ Model/pose section prominently featured

## Monitoring & Improvement

### 1. Track Pose Learning
```javascript
// Add to your analytics/logging
logger.info('Pose preferences for user', {
  userId,
  topPoses: Object.entries(preferences.poses)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([key, data]) => ({ key, ...data.data }))
});
```

### 2. Monitor Front-Facing Success Rate
```sql
-- Track feedback on generated images
SELECT 
  COUNT(*) FILTER (WHERE feedback_type IN ('like', 'save')) as positive,
  COUNT(*) FILTER (WHERE feedback_type IN ('dislike', 'delete')) as negative,
  AVG(CASE WHEN metadata->>'pose_enforced_front_facing' = 'true' THEN 1 ELSE 0 END) as front_facing_rate
FROM feedback f
JOIN prompts p ON f.generation_id = p.generation_id
WHERE p.created_at > NOW() - INTERVAL '7 days';
```

### 3. A/B Test Different Weights
```javascript
// Experiment with different weight values for front-facing tokens
const FRONT_FACING_WEIGHTS = {
  conservative: { shot: 1.2, facing: 1.2, pose: 1.1 },
  moderate: { shot: 1.3, facing: 1.3, pose: 1.2 },  // DEFAULT
  aggressive: { shot: 1.4, facing: 1.5, pose: 1.3 }
};
```

## Next Steps

1. **Deploy the fix** to staging environment first
2. **Test with 3-5 real user portfolios** that showed the side-facing issue
3. **Monitor generated images** for the first 100 generations
4. **Collect feedback** from users on pose accuracy
5. **Fine-tune weights** based on results

## Summary

The updated `IntelligentPromptBuilder.js` now:

✅ Follows correct prompt structure order
✅ Learns shot types from portfolio analysis
✅ Enforces front-facing poses by default
✅ Tracks poses, accessories, and style context via Thompson Sampling
✅ Overrides side/back angles to front angles
✅ Includes explicit "model facing camera" tokens
✅ Uses enhanced negative prompts to avoid non-front poses

This should completely resolve both the prompt ordering issue and the side-facing model problem.

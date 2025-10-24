# Quick Start Guide - 5 Minute Implementation

## For Your Code Builder: Fast Track Integration

### Step 1: Copy New Files (2 minutes)

```bash
# Copy these two NEW files to your project:
cp services/specificityAnalyzer.js → YOUR_PROJECT/src/services/
cp services/trendAwareSuggestionEngine.js → YOUR_PROJECT/src/services/
```

### Step 2: Update voice.js (2 minutes)

Open your existing `src/api/routes/voice.js` and make these changes:

#### A. Add imports at the top (line ~8):
```javascript
const SpecificityAnalyzer = require('../../services/specificityAnalyzer');
const TrendAwareSuggestionEngine = require('../../services/trendAwareSuggestionEngine');

const specificityAnalyzer = new SpecificityAnalyzer();
const suggestionEngine = new TrendAwareSuggestionEngine();
```

#### B. Update parseVoiceCommand function (around line 250):

Find this section:
```javascript
// Extract style attributes
const styles = extractStyles(cleanCommand);
const colors = extractColors(cleanCommand);
const fabrics = extractFabrics(cleanCommand);
const occasions = extractOccasions(cleanCommand);
```

Add RIGHT AFTER it:
```javascript
// NEW: Analyze specificity
const specificityAnalysis = specificityAnalyzer.analyzeCommand(command, {
  colors,
  styles,
  fabrics,
  modifiers: [...styles, ...colors, ...fabrics],
  occasions,
  count: quantity
});

logger.info('Command specificity analyzed', {
  specificityScore: specificityAnalysis.specificityScore,
  creativityTemp: specificityAnalysis.creativityTemp,
  mode: specificityAnalysis.mode
});
```

#### C. Update prompt generation (around line 280):

Find this:
```javascript
const generatedPrompt = promptGeneratorAgent.generatePrompt(styleProfile, {
  index: 0,
  exploreMode: specificityAnalysis.mode === 'exploratory',
  userModifiers
});
```

Change to:
```javascript
const generatedPrompt = promptGeneratorAgent.generatePrompt(styleProfile, {
  index: 0,
  exploreMode: specificityAnalysis.mode === 'exploratory',
  creativity: specificityAnalysis.creativityTemp,              // ADD THIS
  respectUserIntent: specificityAnalysis.specificityScore > 0.6, // ADD THIS
  userModifiers
});
```

#### D. Update return statement (around line 310):

Add `specificityAnalysis` to the return object:
```javascript
return {
  action,
  quantity,
  garmentType: normalizedGarmentType,
  attributes: { styles, colors, fabrics, occasions },
  specificityAnalysis,  // ADD THIS LINE
  // ... rest of existing fields
};
```

### Step 3: Update IntelligentPromptBuilder.js (1 minute)

Open your `src/services/IntelligentPromptBuilder.js` and find the `generatePrompt` method.

#### A. Add to parameters:
```javascript
generatePrompt(styleProfile, options = {}) {
  const {
    index = 0,
    exploreMode = false,
    userModifiers = [],
    creativity = 0.7,              // ADD THIS
    respectUserIntent = false,     // ADD THIS
  } = options;
```

#### B. Add weighting logic before applying modifiers:

```javascript
// NEW: Determine user modifier weighting
const userModifierWeight = respectUserIntent ? 2.0 : 1.0;

// Apply user modifiers
if (userModifiers.length > 0) {
  if (respectUserIntent) {
    // High specificity: strong weighting
    const weightedModifiers = userModifiers.map(m => `(${m}:${userModifierWeight})`);
    prompt += ', ' + weightedModifiers.join(', ');
  } else {
    // Low specificity: normal weighting
    prompt += ', ' + userModifiers.join(', ');
  }
}
```

#### C. Add variation instructions:

```javascript
// NEW: Add creativity-based variation instructions
if (creativity >= 1.0) {
  prompt += ', explore creative variations, interpret broadly';
} else if (creativity <= 0.5) {
  prompt += ', precise execution, literal interpretation';
}
```

### Step 4: Test It! (Optional but recommended)

```bash
# Run the test suite
node examples/test_cases.js

# Or test manually with curl
curl -X POST http://localhost:3000/api/voice/process-text \
  -H "Content-Type: application/json" \
  -d '{"command": "make me 10 dresses"}'

# Should return specificityAnalysis in response
```

---

## What This Achieves

✅ **"make me 10 dresses"**
- Specificity: 0.1 (very low)
- Creativity: 1.1 (very high)
- Mode: exploratory
- Result: Diverse, varied designs with lots of creative freedom

✅ **"make a sporty chic cashmere fitted dress"**
- Specificity: 0.85 (very high)
- Creativity: 0.35 (very low)
- Mode: specific
- Result: Precise execution, literal interpretation of descriptors

---

## Optional: Add Suggestions Endpoint

Add this to `voice.js` to enable AI suggestions:

```javascript
router.get('/suggestions', asyncHandler(async (req, res) => {
  const suggestions = await suggestionEngine.generateSuggestions(req.user.id);
  res.json({ success: true, data: suggestions });
}));
```

Then call from frontend:
```javascript
fetch('/api/voice/suggestions')
  .then(res => res.json())
  .then(data => console.log(data.data)); // Array of suggestions
```

---

## Troubleshooting

**Issue**: Module not found errors
**Fix**: Check file paths match your project structure

**Issue**: specificityAnalysis is undefined
**Fix**: Make sure you added it to the return statement in parseVoiceCommand

**Issue**: Creativity parameter not affecting output
**Fix**: Verify IntelligentPromptBuilder is using creativity and respectUserIntent

---

## Next Steps

1. Monitor logs to see specificity scores
2. Adjust scoring weights in specificityAnalyzer.js if needed
3. Customize trend database in trendAwareSuggestionEngine.js
4. Add frontend UI for suggestions

---

**Total Implementation Time: ~5 minutes**
**Testing Time: ~2 minutes**

That's it! Your voice command system now intelligently adapts creativity based on user intent.

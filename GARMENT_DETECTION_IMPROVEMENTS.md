# Garment Detection Improvements

## File Modified
**`/src/services/styleDescriptorAgent.js`**

This is the file that reads images and sends them to Gemini 2.5 Flash for analysis.

## Issues Fixed

### 1. ❌ Multiple Dress Detections
**Problem**: The model was classifying images as "dress" multiple times when there was only one dress in the ZIP.

**Root Cause**: The prompt didn't explicitly instruct the model to identify only ONE primary garment per image.

**Solution**: Added clear rules to the prompt:
```
IMPORTANT RULES:
1. Identify only ONE primary garment type per image
2. Focus on the PRIMARY garment if multiple items are shown
```

### 2. ❌ Two-Piece (Top + Skirt) Misidentification
**Problem**: Matching top+skirt sets were being incorrectly classified as "dress" or separate items.

**Root Cause**: 
- The controlled vocabulary didn't include "two-piece", "co-ord", or "matching set" options
- No guidance on how to distinguish between a dress and a two-piece

**Solution**:
1. **Added new garment types** to the vocabulary:
   - `'two-piece'`
   - `'co-ord'`
   - `'matching set'`

2. **Added specific rules** to help the model distinguish:
```
2. If you see a matching top and bottom (e.g., crop top + skirt in same fabric/pattern), 
   classify as "two-piece" or "co-ord" or "matching set"
3. A DRESS is a single one-piece garment. Do NOT classify separate top+bottom 
   combinations as "dress"
4. If uncertain between dress and two-piece, look for:
   - Dress: Continuous fabric from top to bottom, single garment
   - Two-piece: Visible separation/gap between top and bottom, different pieces
```

3. **Added new fields** to track this information:
   - `is_two_piece`: Boolean flag (true if matching top+bottom set)
   - `reasoning`: Text explaining why the model chose that classification

## Database Changes

Added two new columns to `image_descriptors` table:
```sql
ALTER TABLE image_descriptors ADD COLUMN is_two_piece BOOLEAN DEFAULT false;
ALTER TABLE image_descriptors ADD COLUMN reasoning TEXT;
```

## Updated Controlled Vocabulary

### Before:
```javascript
garment_type: ['dress', 'blazer', 'pants', 'skirt', 'coat', 'jacket', 
              'top', 'blouse', 'shirt', 'sweater', 'cardigan', 'shorts', 
              'jeans', 'chinos', 'suit', 'jumpsuit', 'romper']
```

### After:
```javascript
garment_type: ['dress', 'blazer', 'pants', 'skirt', 'coat', 'jacket', 
              'top', 'blouse', 'shirt', 'sweater', 'cardigan', 'shorts', 
              'jeans', 'chinos', 'suit', 'jumpsuit', 'romper', 
              'two-piece', 'co-ord', 'matching set']  // ← NEW
```

## Enhanced Prompt Structure

The new prompt includes:
1. **Role definition**: "You are a professional fashion analyst"
2. **Clear instructions**: Identify only ONE primary garment
3. **Decision rules**: How to distinguish dress vs two-piece
4. **New output fields**: `is_two_piece` and `reasoning`

## Testing the Changes

To test the improvements:

1. **Restart the server** (changes have been applied):
```bash
npm run dev
```

2. **Upload a test portfolio** with:
   - Images containing single dresses
   - Images containing matching top+skirt sets
   - Mixed garment types

3. **Check the analysis results**:
```javascript
// Query to see garment classifications
SELECT 
  garment_type, 
  is_two_piece, 
  reasoning,
  COUNT(*) as count
FROM image_descriptors
WHERE user_id = 'YOUR_USER_ID'
GROUP BY garment_type, is_two_piece, reasoning;
```

## Expected Behavior

### Example 1: Single Dress
- **Input**: Image of a woman wearing a white linen maxi dress
- **Output**:
  ```json
  {
    "garment_type": "dress",
    "is_two_piece": false,
    "reasoning": "Continuous fabric from top to bottom with no visible separation - single garment"
  }
  ```

### Example 2: Matching Top + Skirt
- **Input**: Image of a matching crop top and high-waist skirt in same fabric
- **Output**:
  ```json
  {
    "garment_type": "two-piece",
    "is_two_piece": true,
    "reasoning": "Visible separation between matching top and skirt pieces in same pattern/fabric - coordinated set"
  }
  ```

## Additional Benefits

1. **Better data quality**: More accurate garment classification
2. **Better style profiling**: Can now track two-piece sets as a style preference
3. **Better image generation**: Prompts can reference "two-piece" garments correctly
4. **Debugging support**: The `reasoning` field helps understand model decisions

## Files Changed

1. `/src/services/styleDescriptorAgent.js` - Main analysis logic
2. Database: `image_descriptors` table - Added 2 new columns

## Next Steps (Optional Enhancements)

If you want further improvements:

1. **Add post-processing validation**: Check if multiple images classified the same garment
2. **Add confidence thresholds**: Flag low-confidence classifications for manual review
3. **Add training examples**: Include few-shot examples in the prompt for edge cases
4. **Add garment counting**: Track how many unique garments were detected per portfolio

---

✅ **Changes are live** - The server has been updated with these improvements.

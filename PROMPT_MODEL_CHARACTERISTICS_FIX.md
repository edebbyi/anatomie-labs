# Prompt Generator Enhancement - Model Characteristics

## Problem
The prompts generated during onboarding were all similar and didn't include model characteristics (skin tone, gender, age, ethnicity) that should come from the Visual Analyst agent.

## Solution
Enhanced `PromptGeneratorAgent` to extract and include model characteristics from the Visual Analyst's style profile.

## Changes Made

### 1. Enhanced `PromptGeneratorAgent.js`
Added extraction of model characteristics from the style profile:

```javascript
// Extract model characteristics from Visual Analyst
const modelCharacteristics = styleProfile.model_characteristics || {};
const skinTones = modelCharacteristics.skin_tones || [];
const genders = modelCharacteristics.genders || [];
const ageRanges = modelCharacteristics.age_ranges || [];
const ethnicities = modelCharacteristics.ethnicities || [];
```

### 2. Build Model Descriptors
For each prompt, select diverse model characteristics:

```javascript
// Add skin tone if available
if (skinTones.length > 0) {
  const skinTone = this._selectWithVariation(skinTones, index);
  if (skinTone && skinTone !== 'unknown') {
    modelDescriptors.push(`${skinTone} skin tone model`);
  }
}

// Add gender preference if available
if (genders.length > 0) {
  const gender = this._selectWithVariation(genders, index);
  if (gender && gender !== 'unknown') {
    modelDescriptors.push(`${gender} model`);
  }
}

// Add age range if available
if (ageRanges.length > 0) {
  const ageRange = this._selectWithVariation(ageRanges, index);
  if (ageRange && ageRange !== 'unknown') {
    modelDescriptors.push(`${ageRange} age`);
  }
}

// Add ethnicity for diversity if available
if (ethnicities.length > 0 && !exploreMode) {
  const ethnicity = this._selectWithVariation(ethnicities, index);
  if (ethnicity && ethnicity !== 'unknown') {
    modelDescriptors.push(`${ethnicity} ethnicity`);
  }
}
```

### 3. Include in Prompts
Model characteristics are added early in the prompt for better adherence:

```javascript
// Add model characteristics early in prompt for better adherence
if (modelDescriptors.length > 0) {
  coreElements.push(modelDescriptors.join(', '));
}
```

## Example Output

### Before
```
professional fashion photography, dress, fitted silhouette, neutral tones, contemporary professional style, wool material, studio backdrop, high fashion editorial, timeless aesthetic
```

### After
```
professional fashion photography, dress, fitted silhouette, neutral tones, contemporary professional style, medium skin tone model, female model, 25-35 age, wool material, studio backdrop, high fashion editorial, timeless aesthetic
```

## Data Source
The model characteristics come from the **Visual Analyst Agent** (Python service) which analyzes the portfolio images during onboarding and extracts:

- **Skin Tones**: light, medium, dark, olive, etc.
- **Genders**: male, female, non-binary
- **Age Ranges**: 18-24, 25-35, 36-50, 50+
- **Ethnicities**: Diverse representation

## Benefits

1. **More Varied Prompts**: Each generation will have different model characteristics
2. **Better Representation**: Ensures diversity in generated images
3. **Portfolio Matching**: Uses actual characteristics from the designer's portfolio
4. **Logged Details**: Model characteristics are now logged for debugging

## Testing

To see the enhanced prompts:
1. Complete onboarding with a portfolio ZIP
2. Check backend logs for prompt generation
3. Look for `modelCharacteristics` field in logs
4. Generated images should reflect the diverse model characteristics

## Next Steps

If the Visual Analyst isn't extracting model characteristics yet, we need to:
1. Update the Python agents service to extract these attributes
2. Ensure they're saved in the style profile
3. Verify the agents service is returning this data to the Node.js backend

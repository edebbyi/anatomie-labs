# 02: Backend Implementation Guide
## Server-Side Code Changes

---

## 📋 Prerequisites

Before starting:
- ✅ `ultraDetailedIngestionAgent.js` is working
- ✅ `trendAnalysisAgent.js` generates profiles
- ✅ `IntelligentPromptBuilder.js` uses Thompson Sampling
- ✅ Database has `ultra_detailed_descriptors` table
- ✅ Database has `style_profiles` table

---

## 🎯 Implementation Checklist

### Phase 1: Brand DNA Extraction (Priority 1)
- [ ] 1.1: Add `extractBrandDNA()` to IntelligentPromptBuilder
- [ ] 1.2: Add `getEnhancedStyleProfile()` method
- [ ] 1.3: Add `calculateBrandConsistency()` method
- [ ] 1.4: Update `generatePrompt()` to accept styleProfile
- [ ] 1.5: Test brand DNA extraction

### Phase 2: Brand-Weighted Prompt Building (Priority 2)
- [ ] 2.1: Implement `thompsonSampleWithBias()`
- [ ] 2.2: Update `buildDetailedPrompt()` to inject brand DNA
- [ ] 2.3: Add brand consistency scoring
- [ ] 2.4: Update metadata to track brand application
- [ ] 2.5: Test prompt generation with brand DNA

### Phase 3: API Endpoints (Priority 3)
- [ ] 3.1: Create `/generate-with-dna` endpoint
- [ ] 3.2: Update `/profile` endpoint with brand DNA
- [ ] 3.3: Create `/brand-consistency/:generationId` endpoint
- [ ] 3.4: Test all endpoints

### Phase 4: Feedback Integration (Priority 4)
- [ ] 4.1: Update `feedbackLearnerAgent.js` with brand DNA
- [ ] 4.2: Add brand drift detection
- [ ] 4.3: Create profile refresh suggestions
- [ ] 4.4: Test feedback loop

---

## 📝 Section 1: Brand DNA Extraction

### 1.1: Add `extractBrandDNA()` Method

**File:** `src/services/IntelligentPromptBuilder.js`

**Location:** Add after `getUltraDetailedDescriptors()` method

```javascript
/**
 * Extract Brand DNA from enhanced style profile
 * This creates a distilled representation of the designer's signature
 * 
 * @param {Object} styleProfile - Enhanced style profile from TrendAnalysisAgent
 * @returns {Object} Brand DNA object
 */
extractBrandDNA(styleProfile) {
  if (!styleProfile) {
    logger.warn('No style profile provided for brand DNA extraction');
    return null;
  }

  try {
    // 1. PRIMARY AESTHETIC
    const primaryAesthetic = styleProfile.aesthetic_themes?.[0];
    const secondaryAesthetics = styleProfile.aesthetic_themes?.slice(1, 3) || [];

    // 2. SIGNATURE COLORS (top 3, weighted by distribution)
    const signatureColors = this.extractTopDistribution(
      styleProfile.color_distribution || {}, 
      3
    ).map(c => ({
      name: c.key,
      weight: c.value,
      hex: this.getColorHex(c.key) // Helper to estimate hex
    }));

    // 3. SIGNATURE FABRICS (top 3, with properties)
    const signatureFabrics = this.extractTopDistribution(
      styleProfile.fabric_distribution || {},
      3
    ).map(f => ({
      name: f.key,
      weight: f.value,
      properties: this.getFabricProperties(f.key) // Infer from common knowledge
    }));

    // 4. SIGNATURE CONSTRUCTION (top 5 recurring details)
    const signatureConstruction = (styleProfile.construction_patterns || [])
      .slice(0, 5)
      .map(c => ({
        detail: c.name,
        frequency: parseFloat(c.frequency.replace('%', '')) / 100
      }));

    // 5. PHOTOGRAPHY PREFERENCES (CRITICAL for shot consistency)
    const preferredShotTypes = this.extractShotTypePreferences(styleProfile);
    const preferredLighting = this.extractLightingPreferences(styleProfile);
    const preferredAngles = this.extractAnglePreferences(styleProfile);

    // 6. PRIMARY GARMENTS (top 5)
    const primaryGarments = this.extractTopDistribution(
      styleProfile.garment_distribution || {},
      5
    ).map(g => ({
      type: g.key,
      weight: g.value
    }));

    // 7. CONFIDENCE METRICS
    const aestheticConfidence = primaryAesthetic?.strength || 0.5;
    const overallConfidence = parseFloat(styleProfile.avg_confidence || 0.5);

    const brandDNA = {
      // Core Identity
      primaryAesthetic: primaryAesthetic?.name || 'contemporary',
      secondaryAesthetics: secondaryAesthetics.map(a => a.name),
      aestheticConfidence,

      // Visual Signatures
      signatureColors,
      signatureFabrics,
      signatureConstruction,

      // Photography DNA (learned from portfolio)
      preferredShotTypes,
      preferredLighting,
      preferredAngles,

      // Garment Preferences
      primaryGarments,

      // Metadata
      totalImages: styleProfile.total_images || 0,
      overallConfidence,
      lastUpdated: new Date().toISOString(),
      driftScore: 0 // Will be calculated separately
    };

    logger.info('Brand DNA extracted successfully', {
      primaryAesthetic: brandDNA.primaryAesthetic,
      colorCount: signatureColors.length,
      fabricCount: signatureFabrics.length,
      constructionCount: signatureConstruction.length,
      confidence: overallConfidence
    });

    return brandDNA;

  } catch (error) {
    logger.error('Failed to extract brand DNA', { error: error.message });
    return null;
  }
}

/**
 * Helper: Extract top N items from distribution object
 */
extractTopDistribution(distribution, n = 3) {
  return Object.entries(distribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, value]) => ({ key, value }));
}

/**
 * Helper: Extract shot type preferences from style profile
 */
extractShotTypePreferences(styleProfile) {
  // Look in ultra-detailed descriptors for photography data
  const descriptors = styleProfile.signature_pieces || [];
  const shotTypeCounts = {};

  descriptors.forEach(desc => {
    const shotType = desc.photography?.shot_composition?.type;
    if (shotType) {
      shotTypeCounts[shotType] = (shotTypeCounts[shotType] || 0) + 1;
    }
  });

  const total = Object.values(shotTypeCounts).reduce((sum, count) => sum + count, 0);
  
  return Object.entries(shotTypeCounts)
    .map(([type, count]) => ({
      type,
      frequency: count / total
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 3);
}

/**
 * Helper: Extract lighting preferences
 */
extractLightingPreferences(styleProfile) {
  const descriptors = styleProfile.signature_pieces || [];
  const lightingCounts = {};

  descriptors.forEach(desc => {
    const lighting = desc.photography?.lighting?.type;
    if (lighting) {
      lightingCounts[lighting] = (lightingCounts[lighting] || 0) + 1;
    }
  });

  const total = Object.values(lightingCounts).reduce((sum, count) => sum + count, 0);
  
  return Object.entries(lightingCounts)
    .map(([type, count]) => ({
      type,
      frequency: count / total
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 3);
}

/**
 * Helper: Extract camera angle preferences
 */
extractAnglePreferences(styleProfile) {
  const descriptors = styleProfile.signature_pieces || [];
  const angleCounts = {};

  descriptors.forEach(desc => {
    const angle = desc.photography?.camera_angle?.horizontal;
    if (angle) {
      angleCounts[angle] = (angleCounts[angle] || 0) + 1;
    }
  });

  const total = Object.values(angleCounts).reduce((sum, count) => sum + count, 0);
  
  return Object.entries(angleCounts)
    .map(([angle, count]) => ({
      angle,
      frequency: count / total
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 3);
}

/**
 * Helper: Get estimated hex for common color names
 */
getColorHex(colorName) {
  const colorMap = {
    'navy': '#1a2b4c',
    'black': '#000000',
    'white': '#ffffff',
    'beige': '#f5f5dc',
    'camel': '#c19a6b',
    'gray': '#808080',
    'charcoal': '#36454f',
    'cream': '#fffdd0',
    'brown': '#964b00',
    'burgundy': '#800020'
  };
  
  return colorMap[colorName.toLowerCase()] || '#808080';
}

/**
 * Helper: Get common fabric properties
 */
getFabricProperties(fabricName) {
  const fabricMap = {
    'wool': { texture: 'smooth', drape: 'structured', weight: 'medium' },
    'cotton': { texture: 'crisp', drape: 'structured', weight: 'light' },
    'silk': { texture: 'smooth', drape: 'fluid', weight: 'light' },
    'linen': { texture: 'textured', drape: 'relaxed', weight: 'light' },
    'cashmere': { texture: 'soft', drape: 'fluid', weight: 'light' },
    'denim': { texture: 'rough', drape: 'stiff', weight: 'heavy' }
  };
  
  return fabricMap[fabricName.toLowerCase()] || { 
    texture: 'smooth', 
    drape: 'structured', 
    weight: 'medium' 
  };
}
```

### 1.2: Add `getEnhancedStyleProfile()` Method

**File:** `src/services/IntelligentPromptBuilder.js`

```javascript
/**
 * Get enhanced style profile for a user
 * This includes all the rich data needed for brand DNA
 * 
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Enhanced style profile
 */
async getEnhancedStyleProfile(userId) {
  try {
    // Get the style profile with all enrichments
    const query = `
      SELECT 
        sp.*,
        (
          SELECT json_agg(
            json_build_object(
              'image_id', udd.image_id,
              'description', udd.executive_summary->>'one_sentence_description',
              'standout_detail', udd.executive_summary->>'standout_detail',
              'photography', udd.photography,
              'garment_type', (udd.garments->0->>'type'),
              'confidence', udd.overall_confidence
            )
          )
          FROM ultra_detailed_descriptors udd
          WHERE udd.user_id = sp.user_id
            AND udd.overall_confidence > 0.75
          ORDER BY udd.overall_confidence DESC
          LIMIT 10
        ) as signature_pieces
      FROM style_profiles sp
      WHERE sp.user_id = $1
    `;

    const result = await db.query(query, [userId]);
    
    if (result.rows.length === 0) {
      logger.warn('No style profile found for user', { userId });
      return null;
    }

    const profile = result.rows[0];
    
    // Parse JSON fields
    return {
      ...profile,
      garment_distribution: this.safeParseJSON(profile.garment_distribution, {}),
      color_distribution: this.safeParseJSON(profile.color_distribution, {}),
      fabric_distribution: this.safeParseJSON(profile.fabric_distribution, {}),
      silhouette_distribution: this.safeParseJSON(profile.silhouette_distribution, {}),
      aesthetic_themes: this.safeParseJSON(profile.aesthetic_themes, []),
      construction_patterns: this.safeParseJSON(profile.construction_patterns, []),
      signature_pieces: profile.signature_pieces || []
    };

  } catch (error) {
    logger.error('Failed to get enhanced style profile', {
      userId,
      error: error.message
    });
    return null;
  }
}
```

### 1.3: Add `calculateBrandConsistency()` Method

```javascript
/**
 * Calculate how consistent a generated prompt/image is with brand DNA
 * 
 * @param {Object} selected - Thompson sampled selections
 * @param {Object} brandDNA - Extracted brand DNA
 * @returns {number} Consistency score 0-1
 */
calculateBrandConsistency(selected, brandDNA) {
  if (!brandDNA) return 0.5; // Neutral if no brand DNA

  let score = 0;
  let maxScore = 0;

  // 1. AESTHETIC MATCH (weight: 25%)
  maxScore += 25;
  if (selected.styleContext === brandDNA.primaryAesthetic) {
    score += 25;
  } else if (brandDNA.secondaryAesthetics.includes(selected.styleContext)) {
    score += 15;
  }

  // 2. COLOR MATCH (weight: 25%)
  maxScore += 25;
  if (selected.colors && selected.colors.length > 0) {
    const brandColors = brandDNA.signatureColors.map(c => c.name);
    const matchedColors = selected.colors.filter(c => 
      brandColors.includes(c.name)
    );
    score += (matchedColors.length / selected.colors.length) * 25;
  }

  // 3. FABRIC MATCH (weight: 15%)
  maxScore += 15;
  if (selected.fabric) {
    const brandFabrics = brandDNA.signatureFabrics.map(f => f.name);
    if (brandFabrics.includes(selected.fabric.material)) {
      score += 15;
    }
  }

  // 4. CONSTRUCTION MATCH (weight: 15%)
  maxScore += 15;
  if (selected.construction && selected.construction.length > 0) {
    const brandConstruction = brandDNA.signatureConstruction.map(c => c.detail);
    const matchedDetails = selected.construction.filter(c =>
      brandConstruction.some(bc => c.includes(bc) || bc.includes(c))
    );
    score += (matchedDetails.length / selected.construction.length) * 15;
  }

  // 5. PHOTOGRAPHY MATCH (weight: 20%)
  maxScore += 20;
  if (selected.pose && brandDNA.preferredShotTypes.length > 0) {
    const preferredShot = brandDNA.preferredShotTypes[0].type;
    if (selected.pose.shot_type === preferredShot) {
      score += 10;
    }
  }
  if (selected.photography && brandDNA.preferredAngles.length > 0) {
    const preferredAngle = brandDNA.preferredAngles[0].angle;
    if (selected.photography.angle === preferredAngle) {
      score += 10;
    }
  }

  const finalScore = maxScore > 0 ? score / maxScore : 0.5;
  
  logger.debug('Brand consistency calculated', {
    score: finalScore.toFixed(2),
    components: {
      aesthetic: selected.styleContext === brandDNA.primaryAesthetic,
      colorMatch: selected.colors?.length || 0,
      fabricMatch: !!selected.fabric,
      constructionMatch: selected.construction?.length || 0
    }
  });

  return finalScore;
}
```

---

## 📝 Section 2: Brand-Weighted Prompt Building

### 2.1: Implement `thompsonSampleWithBias()`

**File:** `src/services/IntelligentPromptBuilder.js`

**Location:** Add after existing `thompsonSample()` method

```javascript
/**
 * Thompson Sampling with brand DNA bias
 * Boosts selection probability for brand-aligned attributes
 * 
 * @param {Object} preferenceDict - Attribute preferences
 * @param {Object} thompsonDict - Thompson parameters
 * @param {Array} brandPreferences - Brand DNA preferred attributes
 * @param {boolean} shouldExplore - Exploration flag
 * @param {number} brandBoost - Multiplier for brand attributes (default: 1.5)
 * @returns {Object} Selected attribute
 */
thompsonSampleWithBias(
  preferenceDict, 
  thompsonDict, 
  brandPreferences = [], 
  shouldExplore = false,
  brandBoost = 1.5
) {
  const items = Object.keys(preferenceDict);
  
  if (items.length === 0) return null;

  // Exploration: still random, but prefer brand attributes
  if (shouldExplore) {
    // Weight random selection toward brand preferences
    const weights = items.map(key => {
      const isBrand = brandPreferences.includes(key);
      return isBrand ? brandBoost : 1.0;
    });
    
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < items.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return preferenceDict[items[i]].data;
      }
    }
    
    return preferenceDict[items[0]].data;
  }

  // Exploitation: Thompson Sampling with brand boost
  let bestKey = null;
  let bestSample = -1;

  for (const key of items) {
    const params = thompsonDict[key] || { 
      alpha: this.DEFAULT_ALPHA, 
      beta: this.DEFAULT_BETA 
    };
    
    let sample = this.betaSample(params.alpha, params.beta);
    
    // Apply brand boost if this is a brand preference
    if (brandPreferences.includes(key)) {
      sample *= brandBoost;
      logger.debug('Applied brand boost', { attribute: key, boost: brandBoost });
    }
    
    if (sample > bestSample) {
      bestSample = sample;
      bestKey = key;
    }
  }

  return bestKey ? preferenceDict[bestKey].data : null;
}
```

### 2.2: Update `buildDetailedPrompt()` to Inject Brand DNA

**File:** `src/services/IntelligentPromptBuilder.js`

**Location:** Replace existing `buildDetailedPrompt()` method

```javascript
/**
 * Build detailed prompt using Thompson Sampling + Brand DNA
 * ORDER: Style → Garment → Color → Model/Pose → Accessories → Lighting → Camera
 * 
 * @param {Array} descriptors - Ultra-detailed descriptors
 * @param {Object} thompsonParams - Thompson Sampling parameters
 * @param {number} creativity - Creativity level (0-1)
 * @param {Object} options - Additional options including brandDNA
 * @returns {Object} { positive, negative, metadata }
 */
async buildDetailedPrompt(descriptors, thompsonParams, creativity, options = {}) {
  const { brandDNA, enforceBrandDNA = true, brandDNAStrength = 0.8 } = options;
  
  // Aggregate preferences from descriptors
  const preferences = this.aggregatePreferences(descriptors);

  // Decide: explore or exploit?
  const shouldExplore = Math.random() < creativity;

  // Build components array
  const components = [];

  // 1. STYLE CONTEXT - Use brand DNA if available
  if (brandDNA && brandDNA.primaryAesthetic && enforceBrandDNA) {
    components.push(
      this.formatToken(`in the designer's signature '${brandDNA.primaryAesthetic}' aesthetic`, 1.3)
    );
  } else if (preferences.styleContext && Object.keys(preferences.styleContext).length > 0) {
    const selectedStyle = this.sampleCategory(
      preferences.styleContext,
      thompsonParams.styleContext || {},
      shouldExplore
    );
    if (selectedStyle) {
      components.push(this.formatToken(`${selectedStyle} style`, 1.2));
    }
  }

  // 2. PRIMARY GARMENT - With brand bias
  const garmentBias = brandDNA && enforceBrandDNA 
    ? brandDNA.primaryGarments.map(g => g.type)
    : [];
  
  const selectedGarment = this.thompsonSampleWithBias(
    preferences.garments,
    thompsonParams.garments || {},
    garmentBias,
    shouldExplore,
    brandDNAStrength + 0.5 // Stronger boost for garments
  );

  if (selectedGarment) {
    // Build comprehensive garment description
    const garmentParts = [];
    
    if (selectedGarment.silhouette) {
      garmentParts.push(selectedGarment.silhouette);
    }
    
    if (selectedGarment.fit) {
      garmentParts.push(selectedGarment.fit);
    }
    
    garmentParts.push(selectedGarment.type);
    
    const garmentDesc = garmentParts.join(', ');
    components.push(this.formatToken(garmentDesc, 1.3));
    
    // Add construction details if brand DNA has signature construction
    if (brandDNA && brandDNA.signatureConstruction && enforceBrandDNA) {
      const topConstruction = brandDNA.signatureConstruction.slice(0, 2);
      topConstruction.forEach(detail => {
        components.push(this.formatToken(detail.detail, 1.1));
      });
    } else if (selectedGarment.details && selectedGarment.details.length > 0) {
      selectedGarment.details.slice(0, 2).forEach(detail => {
        components.push(this.formatToken(detail, 1.1));
      });
    }
  }

  // 3. FABRIC & MATERIAL - With brand bias
  const fabricBias = brandDNA && enforceBrandDNA
    ? brandDNA.signatureFabrics.map(f => f.name)
    : [];
  
  const selectedFabric = this.thompsonSampleWithBias(
    preferences.fabrics,
    thompsonParams.fabrics || {},
    fabricBias,
    shouldExplore,
    brandDNAStrength
  );

  if (selectedFabric) {
    const fabricDesc = selectedFabric.finish 
      ? `in ${selectedFabric.material} fabric, with ${selectedFabric.finish} finish`
      : `in ${selectedFabric.material} fabric`;
    
    components.push(this.formatToken(fabricDesc, 1.2));
  }

  // 4. COLORS - Strong brand bias
  const colorBias = brandDNA && enforceBrandDNA
    ? brandDNA.signatureColors.map(c => c.name)
    : [];
  
  const selectedColors = this.thompsonSampleMultipleWithBias(
    preferences.colors,
    thompsonParams.colors || {},
    colorBias,
    shouldExplore,
    2,
    brandDNAStrength + 0.3 // Extra strong boost for colors
  );

  if (selectedColors && selectedColors.length > 0) {
    const colorList = selectedColors.map(c => c.name || c).join(' and ');
    components.push(this.formatToken(`${colorList} palette`, 1.3));
  }

  // 5. MODEL & POSE - Use brand DNA photography preferences
  let selectedPose = null;
  
  if (brandDNA && brandDNA.preferredShotTypes && brandDNA.preferredShotTypes.length > 0 && enforceBrandDNA) {
    // Use learned shot type
    const preferredShot = brandDNA.preferredShotTypes[0];
    components.push(this.formatToken(preferredShot.type, 1.3));
    
    // Use learned facing direction or default to front
    if (brandDNA.preferredAngles && brandDNA.preferredAngles.length > 0) {
      const preferredAngle = brandDNA.preferredAngles[0].angle;
      components.push(this.formatToken(preferredAngle, 1.2));
    } else {
      components.push(this.formatToken('model facing camera', 1.3));
    }
    
    // Add confident pose
    components.push(this.formatToken('confident pose', 1.1));
    
  } else {
    // DEFAULT: Always front-facing if no learned pose data
    components.push(this.formatToken('three-quarter length shot', 1.3));
    components.push(this.formatToken('model facing camera', 1.3));
    components.push(this.formatToken('front-facing pose', 1.2));
  }

  // 6. ACCESSORIES (if any)
  const selectedAccessories = this.sampleMultiple(
    preferences.accessories,
    thompsonParams.accessories || {},
    shouldExplore,
    2
  );
  
  if (selectedAccessories && selectedAccessories.length > 0) {
    selectedAccessories.forEach(acc => {
      components.push(this.formatToken(acc, 1.0));
    });
  }

  // 7. LIGHTING - Use brand DNA or defaults
  if (brandDNA && brandDNA.preferredLighting && brandDNA.preferredLighting.length > 0 && enforceBrandDNA) {
    const preferredLighting = brandDNA.preferredLighting[0];
    components.push(this.formatToken(`${preferredLighting.type} lighting`, 1.1));
  } else {
    components.push(this.formatToken('soft lighting from front', 1.1));
  }

  // 8. CAMERA SPECS
  components.push(this.formatToken('at eye level', 1.0));
  components.push(this.formatToken('clean studio background', 1.0));

  // 9. STYLE DESCRIPTOR
  components.push(this.formatToken('professional fashion photography', 1.3));

  // 10. QUALITY MARKERS (always at end)
  components.push(this.formatToken('high detail', 1.2));
  components.push(this.formatToken('8k', 1.1));
  components.push(this.formatToken('sharp focus', 1.0));
  components.push(this.formatToken('studio quality', 1.0));

  // Join all components
  const positivePrompt = components.join(', ');

  // Build negative prompt
  const negativePrompt = this.buildNegativePrompt({});

  // Calculate brand consistency
  const selected = {
    garment: selectedGarment,
    fabric: selectedFabric,
    colors: selectedColors,
    styleContext: brandDNA?.primaryAesthetic,
    pose: selectedPose,
    photography: {
      angle: brandDNA?.preferredAngles?.[0]?.angle
    }
  };
  
  const brandConsistencyScore = brandDNA && enforceBrandDNA
    ? this.calculateBrandConsistency(selected, brandDNA)
    : 0.5;

  // Build metadata
  const metadata = {
    thompson_selection: selected,
    creativity_level: creativity,
    token_count: components.length,
    brand_dna_applied: !!brandDNA && enforceBrandDNA,
    brand_consistency_score: brandConsistencyScore,
    brand_dna_strength: brandDNAStrength,
    garment_type: selectedGarment?.type || 'unknown',
    dominant_colors: selectedColors?.map(c => c.name || c) || [],
    fabric: selectedFabric?.material || 'unknown'
  };

  return {
    positive: positivePrompt,
    negative: negativePrompt,
    metadata
  };
}

/**
 * Thompson Sample Multiple with Brand Bias
 */
thompsonSampleMultipleWithBias(
  preferenceDict, 
  thompsonDict, 
  brandPreferences = [], 
  shouldExplore = false,
  n = 2,
  brandBoost = 1.5
) {
  const items = Object.keys(preferenceDict);
  
  if (items.length === 0) return [];

  // Exploration: random selection with brand preference
  if (shouldExplore) {
    const weights = items.map(key => {
      const isBrand = brandPreferences.includes(key);
      return isBrand ? brandBoost : 1.0;
    });
    
    // Weighted random sampling without replacement
    const selected = [];
    const availableItems = [...items];
    const availableWeights = [...weights];
    
    for (let i = 0; i < Math.min(n, items.length); i++) {
      const totalWeight = availableWeights.reduce((sum, w) => sum + w, 0);
      let random = Math.random() * totalWeight;
      
      for (let j = 0; j < availableItems.length; j++) {
        random -= availableWeights[j];
        if (random <= 0) {
          selected.push(preferenceDict[availableItems[j]].data);
          availableItems.splice(j, 1);
          availableWeights.splice(j, 1);
          break;
        }
      }
    }
    
    return selected;
  }

  // Exploitation: Thompson Sampling with brand boost
  const samples = items.map(key => {
    const params = thompsonDict[key] || { 
      alpha: this.DEFAULT_ALPHA, 
      beta: this.DEFAULT_BETA 
    };
    
    let sample = this.betaSample(params.alpha, params.beta);
    
    // Apply brand boost
    if (brandPreferences.includes(key)) {
      sample *= brandBoost;
    }
    
    return { key, sample };
  });

  samples.sort((a, b) => b.sample - a.sample);
  
  return samples.slice(0, n).map(s => preferenceDict[s.key].data);
}
```

---

## 📝 Section 3: API Endpoints

### 3.1: Create `/generate-with-dna` Endpoint

**File:** `src/routes/generations.js` (or your generations route file)

```javascript
/**
 * POST /api/podna/generate-with-dna
 * Generate images with brand DNA enforcement
 */
router.post('/generate-with-dna', authenticate, async (req, res) => {
  try {
    const { userId } = req.user;
    const { 
      prompt, 
      enforceBrandDNA = true, 
      brandDNAStrength = 0.8,
      creativity = 0.3,
      count = 4,
      options = {} 
    } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Prompt is required'
      });
    }

    // Get enhanced style profile
    const IntelligentPromptBuilder = require('../services/IntelligentPromptBuilder');
    const styleProfile = await IntelligentPromptBuilder.getEnhancedStyleProfile(userId);
    
    if (!styleProfile && enforceBrandDNA) {
      return res.status(400).json({
        success: false,
        message: 'No style profile found. Please upload a portfolio first.',
        code: 'NO_STYLE_PROFILE'
      });
    }

    // Extract brand DNA
    const brandDNA = styleProfile 
      ? IntelligentPromptBuilder.extractBrandDNA(styleProfile)
      : null;

    logger.info('Generating with brand DNA', {
      userId,
      prompt: prompt.substring(0, 50),
      enforceBrandDNA,
      hasBrandDNA: !!brandDNA,
      brandConfidence: brandDNA?.overallConfidence
    });

    // Generate enhanced prompt
    const promptResult = await IntelligentPromptBuilder.generatePrompt(userId, {
      ...options,
      creativity,
      brandDNA,
      enforceBrandDNA,
      brandDNAStrength,
      userPrompt: prompt
    });

    // Generate images
    const ImageGenerationAgent = require('../services/imageGenerationAgent');
    const generations = [];

    for (let i = 0; i < count; i++) {
      try {
        const generation = await ImageGenerationAgent.generateImage(
          userId,
          promptResult.prompt_id,
          options
        );
        
        // Add brand consistency score to generation
        generation.brand_consistency_score = promptResult.metadata.brand_consistency_score;
        generation.brand_dna_applied = enforceBrandDNA;
        
        generations.push(generation);
        
      } catch (genError) {
        logger.error('Individual generation failed', {
          userId,
          index: i,
          error: genError.message
        });
      }
    }

    if (generations.length === 0) {
      throw new Error('All generations failed');
    }

    res.json({
      success: true,
      data: {
        generations,
        prompt: promptResult,
        brandDNA: brandDNA ? {
          primaryAesthetic: brandDNA.primaryAesthetic,
          signatureElements: {
            colors: brandDNA.signatureColors.slice(0, 3).map(c => c.name),
            fabrics: brandDNA.signatureFabrics.slice(0, 3).map(f => f.name),
            construction: brandDNA.signatureConstruction.slice(0, 3).map(c => c.detail)
          },
          confidence: brandDNA.overallConfidence
        } : null,
        avgBrandConsistency: generations.reduce((sum, g) => 
          sum + (g.brand_consistency_score || 0.5), 0
        ) / generations.length
      }
    });

  } catch (error) {
    logger.error('Generation with DNA failed', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Generation failed',
      code: 'GENERATION_ERROR'
    });
  }
});
```

### 3.2: Update `/profile` Endpoint

**File:** `src/routes/profile.js` (or your profile route file)

```javascript
/**
 * GET /api/podna/profile
 * Get enhanced style profile with brand DNA
 */
router.get('/profile', authenticate, async (req, res) => {
  try {
    const { userId } = req.user;

    const IntelligentPromptBuilder = require('../services/IntelligentPromptBuilder');
    const styleProfile = await IntelligentPromptBuilder.getEnhancedStyleProfile(userId);
    
    if (!styleProfile) {
      return res.status(404).json({
        success: false,
        message: 'No style profile found',
        code: 'NO_PROFILE'
      });
    }

    // Extract brand DNA
    const brandDNA = IntelligentPromptBuilder.extractBrandDNA(styleProfile);

    res.json({
      success: true,
      data: {
        profile: styleProfile,
        brandDNA: brandDNA ? {
          primaryAesthetic: brandDNA.primaryAesthetic,
          secondaryAesthetics: brandDNA.secondaryAesthetics,
          signatureColors: brandDNA.signatureColors,
          signatureFabrics: brandDNA.signatureFabrics,
          signatureConstruction: brandDNA.signatureConstruction,
          preferredPhotography: {
            shotTypes: brandDNA.preferredShotTypes,
            lighting: brandDNA.preferredLighting,
            angles: brandDNA.preferredAngles
          },
          primaryGarments: brandDNA.primaryGarments,
          confidence: {
            aesthetic: brandDNA.aestheticConfidence,
            overall: brandDNA.overallConfidence
          },
          metadata: {
            totalImages: brandDNA.totalImages,
            lastUpdated: brandDNA.lastUpdated,
            driftScore: brandDNA.driftScore
          }
        } : null
      }
    });

  } catch (error) {
    logger.error('Failed to get profile', {
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to load profile',
      code: 'PROFILE_ERROR'
    });
  }
});
```

---

## 📝 Section 4: Testing

### Test Brand DNA Extraction

```bash
# Test profile endpoint
curl -X GET http://localhost:3001/api/podna/profile \
  -H "Authorization: Bearer YOUR_TOKEN"

# Verify response includes brandDNA object with:
# - primaryAesthetic
# - signatureColors
# - signatureFabrics
# - preferredPhotography
```

### Test Generation with Brand DNA

```bash
# Test generation endpoint
curl -X POST http://localhost:3001/api/podna/generate-with-dna \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "black blazer",
    "enforceBrandDNA": true,
    "brandDNAStrength": 0.8,
    "count": 2
  }'

# Verify response includes:
# - brand_consistency_score for each generation
# - brandDNA summary
# - avgBrandConsistency
```

---

## ✅ Phase 1 Completion Checklist

- [ ] Brand DNA extraction working
- [ ] Enhanced style profile query returns signature pieces
- [ ] Prompt generation uses brand DNA
- [ ] Brand consistency scores calculated
- [ ] `/generate-with-dna` endpoint functional
- [ ] `/profile` endpoint returns brand DNA
- [ ] All tests pass
- [ ] Logging shows brand DNA application

**Success Criteria:** Generate 10 images with brand DNA enabled. At least 7 should have >70% brand consistency scores.

---

**Next:** Read `03-FRONTEND-IMPLEMENTATION.md` for UI changes.

# 03: Frontend Implementation Guide
## UI/UX Changes for Brand DNA Integration

---

## 📋 Overview

This guide covers all React/TypeScript changes needed to display and control Brand DNA in the user interface.

---

## 🎯 Implementation Checklist

### Generation Page Updates
- [ ] 1.1: Add Brand DNA display panel
- [ ] 1.2: Enhance prompt validation with brand alignment
- [ ] 1.3: Add brand consistency toggle
- [ ] 1.4: Add brand strength slider
- [ ] 1.5: Show brand consistency scores on generated images

### Style Profile Page Updates
- [ ] 2.1: Display extracted Brand DNA
- [ ] 2.2: Add "Generate from this aesthetic" buttons
- [ ] 2.3: Add "Use as template" buttons on signature pieces
- [ ] 2.4: Show brand confidence metrics

### API Integration
- [ ] 3.1: Update agentsAPI service
- [ ] 3.2: Add brand DNA types
- [ ] 3.3: Handle brand consistency scores

---

## 📝 Section 1: Generation Page Updates

### 1.1: Brand DNA Display Panel

**File:** `frontend/src/pages/Generation.tsx`

**Location:** Replace existing style profile display section (around line 200)

```typescript
{styleProfile && (
  <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
        <Palette className="w-5 h-5" />
        Your Brand DNA
      </h2>
      <div className="flex items-center gap-2">
        <span className={`text-xs px-2 py-1 rounded-full ${
          enforceBrandDNA 
            ? 'bg-green-100 text-green-700' 
            : 'bg-gray-100 text-gray-600'
        }`}>
          {enforceBrandDNA ? 'Active' : 'Inactive'}
        </span>
      </div>
    </div>
    
    <div className="space-y-4">
      {/* Core Aesthetic */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Core Aesthetic</h3>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 bg-gray-900 text-white rounded-full text-sm font-medium">
            {styleProfile.brandDNA?.primaryAesthetic || 'Contemporary'}
          </span>
          <span className="text-xs text-gray-500">
            {Math.round((styleProfile.brandDNA?.confidence?.aesthetic || 0.5) * 100)}% confidence
          </span>
        </div>
        
        {styleProfile.brandDNA?.secondaryAesthetics?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {styleProfile.brandDNA.secondaryAesthetics.map((aesthetic, idx) => (
              <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                {aesthetic}
              </span>
            ))}
          </div>
        )}
      </div>
      
      {/* Signature Colors */}
      {styleProfile.brandDNA?.signatureColors?.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Signature Colors</h3>
          <div className="flex items-center gap-2">
            {styleProfile.brandDNA.signatureColors.slice(0, 5).map((color, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <div 
                  className="w-6 h-6 rounded-full border border-gray-300"
                  style={{ backgroundColor: color.hex }}
                  title={`${color.name} (${Math.round(color.weight * 100)}%)`}
                />
                <span className="text-xs text-gray-600 capitalize">{color.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Signature Fabrics */}
      {styleProfile.brandDNA?.signatureFabrics?.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Signature Fabrics</h3>
          <div className="flex flex-wrap gap-2">
            {styleProfile.brandDNA.signatureFabrics.slice(0, 4).map((fabric, idx) => (
              <span key={idx} className="px-2 py-1 bg-gray-50 text-gray-700 rounded text-xs border border-gray-200">
                {fabric.name} ({Math.round(fabric.weight * 100)}%)
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* Signature Construction */}
      {styleProfile.brandDNA?.signatureConstruction?.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Signature Details</h3>
          <ul className="space-y-1">
            {styleProfile.brandDNA.signatureConstruction.slice(0, 3).map((detail, idx) => (
              <li key={idx} className="text-sm text-gray-600 flex items-center">
                <span className="mr-2">•</span>
                <span className="capitalize">{detail.detail}</span>
                <span className="ml-2 text-xs text-gray-400">
                  ({Math.round(detail.frequency * 100)}%)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Brand Consistency Info */}
      <div className="pt-3 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-gray-600">
            AI will {enforceBrandDNA ? 'maintain' : 'loosely follow'} brand consistency
          </span>
          <button
            onClick={() => setEnforceBrandDNA(!enforceBrandDNA)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              enforceBrandDNA
                ? 'bg-gray-900 text-white hover:bg-gray-800'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {enforceBrandDNA ? 'Disable' : 'Enable'}
          </button>
        </div>
        
        {!enforceBrandDNA && (
          <div className="mt-2 p-2 bg-yellow-50 rounded-lg">
            <p className="text-xs text-yellow-800">
              ⚠️ Brand DNA disabled. Generations may be more experimental but less aligned with your signature style.
            </p>
          </div>
        )}
      </div>
    </div>
  </div>
)}
```

### 1.2: Enhanced Prompt Validation

**File:** `frontend/src/pages/Generation.tsx`

**Location:** Replace prompt validation display (around line 250)

```typescript
{enhancedPrompt && validationResults && (
  <div className="bg-gray-50 rounded-lg p-4">
    <h3 className="text-sm font-medium text-gray-700 mb-2">
      AI-Enhanced Interpretation
    </h3>
    <p className="text-sm text-gray-600 mb-3">{enhancedPrompt}</p>
    
    <div className="space-y-3">
      {/* Validation Scores */}
      <div className="grid grid-cols-2 gap-3">
        {/* Clarity Score */}
        <div>
          <div className="flex justify-between items-center text-xs mb-1">
            <span className="font-medium text-gray-700">Prompt Clarity</span>
            <span className={`font-semibold ${
              validationResults.clarityScore > 80 ? 'text-green-600' : 
              validationResults.clarityScore > 60 ? 'text-yellow-600' : 
              'text-red-600'
            }`}>
              {validationResults.clarityScore}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div 
              className={`h-1.5 rounded-full transition-all ${
                validationResults.clarityScore > 80 ? 'bg-green-500' :
                validationResults.clarityScore > 60 ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
              style={{ width: `${validationResults.clarityScore}%` }}
            />
          </div>
        </div>
        
        {/* Brand Alignment Score */}
        <div>
          <div className="flex justify-between items-center text-xs mb-1">
            <span className="font-medium text-gray-700">Brand Alignment</span>
            <span className={`font-semibold ${
              validationResults.brandAlignment > 80 ? 'text-blue-600' : 
              validationResults.brandAlignment > 60 ? 'text-blue-400' : 
              'text-gray-500'
            }`}>
              {validationResults.brandAlignment}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div 
              className={`h-1.5 rounded-full transition-all ${
                validationResults.brandAlignment > 80 ? 'bg-blue-500' :
                validationResults.brandAlignment > 60 ? 'bg-blue-300' :
                'bg-gray-400'
              }`}
              style={{ width: `${validationResults.brandAlignment}%` }}
            />
          </div>
        </div>
      </div>
      
      {/* Warnings */}
      {validationResults.warnings?.length > 0 && (
        <div className="pt-2 border-t border-gray-200">
          {validationResults.warnings.map((warning, idx) => (
            <p key={idx} className="text-xs text-yellow-600 flex items-start gap-1">
              <span>⚠️</span>
              <span>{warning}</span>
            </p>
          ))}
        </div>
      )}
      
      {/* Brand Consistency Tips */}
      {validationResults.brandAlignment < 70 && styleProfile && (
        <div className="pt-2 border-t border-gray-200">
          <p className="text-xs text-gray-600 mb-1 font-medium">
            💡 To increase brand alignment, try mentioning:
          </p>
          <ul className="text-xs text-gray-500 space-y-0.5 pl-4">
            {styleProfile.brandDNA?.signatureColors?.slice(0, 2).map((color, idx) => (
              <li key={idx} className="list-disc">{color.name} tones</li>
            ))}
            {styleProfile.brandDNA?.signatureFabrics?.[0] && (
              <li className="list-disc">{styleProfile.brandDNA.signatureFabrics[0].name} fabric</li>
            )}
            {styleProfile.brandDNA?.primaryAesthetic && (
              <li className="list-disc">{styleProfile.brandDNA.primaryAesthetic} style</li>
            )}
          </ul>
        </div>
      )}
    </div>
  </div>
)}
```

### 1.3: Brand DNA Strength Slider

**File:** `frontend/src/pages/Generation.tsx`

**Location:** Add to advanced controls section

```typescript
{/* Brand DNA Controls */}
{showAdvancedControls && styleProfile && (
  <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
    <h3 className="text-lg font-medium text-gray-900 mb-4">Brand DNA Control</h3>
    
    <div className="space-y-4">
      {/* Brand DNA Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">Enforce Brand DNA</p>
          <p className="text-xs text-gray-500">
            AI will strongly prefer your signature elements
          </p>
        </div>
        <button
          onClick={() => setEnforceBrandDNA(!enforceBrandDNA)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enforceBrandDNA ? 'bg-gray-900' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enforceBrandDNA ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
      
      {/* Brand DNA Strength */}
      {enforceBrandDNA && (
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-gray-700">Brand DNA Strength</span>
            <span className="text-gray-500">{Math.round(brandDNAStrength * 100)}%</span>
          </div>
          <input
            type="range"
            min="50"
            max="100"
            value={brandDNAStrength * 100}
            onChange={(e) => setBrandDNAStrength(parseInt(e.target.value) / 100)}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Balanced</span>
            <span>Strong</span>
            <span>Maximum</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {brandDNAStrength < 0.7 
              ? 'Balanced: Mix of brand and creative exploration' 
              : brandDNAStrength < 0.9 
                ? 'Strong: Heavy preference for brand elements' 
                : 'Maximum: Strict adherence to brand signature'}
          </p>
        </div>
      )}
    </div>
  </div>
)}
```

### 1.4: Update Generation Function

**File:** `frontend/src/pages/Generation.tsx`

**Location:** Replace `handleGenerate` function

```typescript
const handleGenerate = async (commandOrEvent?: string | React.FormEvent) => {
  if (commandOrEvent && typeof commandOrEvent === 'object' && 'preventDefault' in commandOrEvent) {
    commandOrEvent.preventDefault();
  }

  const promptText = typeof commandOrEvent === 'string' ? commandOrEvent : prompt;
  if (!promptText.trim()) return;

  setLoading(true);
  setError(null);
  setIsGenerating(true);

  try {
    // Use new brand DNA endpoint
    const response = await fetch(`${apiUrl}/podna/generate-with-dna`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: promptText,
        enforceBrandDNA,
        brandDNAStrength,
        creativity,
        count: generationMode === 'collection' ? 8 : 
               generationMode === 'campaign' ? 6 : 4
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Generation failed');
    }

    const result = await response.json();

    if (result.success && result.data?.generations) {
      const newImages = result.data.generations.map((gen: any, idx: number) => ({
        id: gen.id || `gen-${Date.now()}-${idx}`,
        url: gen.url,
        prompt: promptText,
        timestamp: new Date(),
        brandConsistencyScore: gen.brand_consistency_score || 0.5,
        brandDNAApplied: gen.brand_dna_applied || false
      }));

      setImages(prev => [...newImages, ...prev]);

      // Save to localStorage
      const existing = JSON.parse(localStorage.getItem('generatedImages') || '[]');
      localStorage.setItem('generatedImages', JSON.stringify([...newImages, ...existing]));

      if (typeof commandOrEvent !== 'string') {
        setPrompt('');
      }
      
      // Show average brand consistency
      if (result.data.avgBrandConsistency) {
        console.log('Average brand consistency:', Math.round(result.data.avgBrandConsistency * 100) + '%');
      }
    }
  } catch (err: any) {
    console.error('Generation failed:', err);
    setError(err.message || 'Failed to generate images');
  } finally {
    setLoading(false);
    setIsGenerating(false);
  }
};
```

### 1.5: Display Brand Consistency on Images

**File:** `frontend/src/pages/Generation.tsx`

**Location:** Update image grid rendering

```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {images.map((image) => (
    <div key={image.id} className="group">
      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-3 relative">
        <img
          src={image.url}
          alt={image.prompt}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        
        {/* Brand Consistency Badge */}
        {image.brandDNAApplied && image.brandConsistencyScore !== undefined && (
          <div className="absolute top-2 right-2">
            <div className={`px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm ${
              image.brandConsistencyScore > 0.8 
                ? 'bg-green-500/90 text-white' 
                : image.brandConsistencyScore > 0.6 
                  ? 'bg-yellow-500/90 text-white' 
                  : 'bg-gray-500/90 text-white'
            }`}>
              {Math.round(image.brandConsistencyScore * 100)}% match
            </div>
          </div>
        )}
        
        {/* Hover Overlay with Actions */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="flex gap-2">
            <button className="p-2 bg-white rounded-full hover:bg-gray-100">
              <Save className="w-4 h-4 text-gray-900" />
            </button>
            <button className="p-2 bg-white rounded-full hover:bg-gray-100">
              <Eye className="w-4 h-4 text-gray-900" />
            </button>
          </div>
        </div>
      </div>
      
      <div className="space-y-1">
        <p className="text-sm text-gray-600 line-clamp-2">{image.prompt}</p>
        {image.brandConsistencyScore !== undefined && (
          <p className="text-xs text-gray-400">
            Brand consistency: {Math.round(image.brandConsistencyScore * 100)}%
          </p>
        )}
      </div>
    </div>
  ))}
</div>
```

---

## 📝 Section 2: Style Profile Page Updates

### 2.1: Display Brand DNA Section

**File:** `frontend/src/pages/StyleProfile.tsx`

**Location:** Add after style labels section

```typescript
{/* Brand DNA Section */}
{profile.brandDNA && (
  <div className="mb-8">
    <h2 className="text-2xl font-light text-gray-900 mb-4 flex items-center">
      <Sparkles className="w-6 h-6 mr-2" />
      Your Brand DNA
    </h2>
    
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Core Aesthetic Card */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Core Aesthetic</h3>
        <div className="space-y-2">
          <div className="px-3 py-2 bg-gray-900 text-white rounded-lg text-center">
            <div className="text-lg font-medium">{profile.brandDNA.primaryAesthetic}</div>
            <div className="text-xs opacity-75">
              {Math.round(profile.brandDNA.confidence.aesthetic * 100)}% confidence
            </div>
          </div>
          
          {profile.brandDNA.secondaryAesthetics?.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-gray-500">Secondary aesthetics:</p>
              {profile.brandDNA.secondaryAesthetics.map((aesthetic, idx) => (
                <div key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm text-center">
                  {aesthetic}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Signature Colors */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Signature Colors</h3>
        <div className="space-y-2">
          {profile.brandDNA.signatureColors.map((color, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg border-2 border-gray-300 flex-shrink-0"
                style={{ backgroundColor: color.hex }}
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 capitalize">{color.name}</div>
                <div className="text-xs text-gray-500">{Math.round(color.weight * 100)}% of portfolio</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Signature Fabrics */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Signature Fabrics</h3>
        <div className="space-y-2">
          {profile.brandDNA.signatureFabrics.map((fabric, idx) => (
            <div key={idx} className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm font-medium text-gray-900 capitalize mb-1">
                {fabric.name}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="px-2 py-0.5 bg-white rounded border border-gray-200">
                  {fabric.properties.texture}
                </span>
                <span className="px-2 py-0.5 bg-white rounded border border-gray-200">
                  {fabric.properties.drape}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {Math.round(fabric.weight * 100)}% usage
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
    
    {/* Generate Action */}
    <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium text-gray-900 mb-1">Ready to generate?</h4>
          <p className="text-sm text-gray-600">
            Create new designs that match your signature aesthetic
          </p>
        </div>
        <button
          onClick={() => navigate('/generation')}
          className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Generate Designs
        </button>
      </div>
    </div>
  </div>
)}
```

### 2.2: Add "Generate from Aesthetic" Buttons

**File:** `frontend/src/pages/StyleProfile.tsx`

**Location:** Update aesthetic themes section

```typescript
{/* Aesthetic Themes with Actions */}
{profile.aestheticThemes && profile.aestheticThemes.length > 0 && (
  <div className="mb-8">
    <h2 className="text-2xl font-light text-gray-900 mb-4">Aesthetic Themes</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {profile.aestheticThemes.map((theme, idx) => (
        <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900">{theme.name}</h3>
            <span className="text-sm text-gray-500">{theme.frequency}</span>
          </div>
          
          <p className="text-sm text-gray-600 mb-3">{theme.description}</p>
          
          {/* Construction Details */}
          {theme.construction_details?.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1">Signature details:</p>
              <div className="flex flex-wrap gap-1">
                {theme.construction_details.map((detail, didx) => (
                  <span key={didx} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                    {detail}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Generate Button */}
          <button
            onClick={() => {
              navigate('/generation', {
                state: { 
                  seedAesthetic: theme.name,
                  seedElements: theme.construction_details,
                  promptHint: `${theme.name} style design`
                }
              });
            }}
            className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Generate {theme.name} designs
          </button>
        </div>
      ))}
    </div>
  </div>
)}
```

---

## 📝 Section 3: API Integration

### 3.1: Update agentsAPI Service

**File:** `frontend/src/services/agentsAPI.ts`

**Add new type definitions:**

```typescript
interface BrandDNA {
  primaryAesthetic: string;
  secondaryAesthetics: string[];
  signatureColors: Array<{
    name: string;
    weight: number;
    hex: string;
  }>;
  signatureFabrics: Array<{
    name: string;
    weight: number;
    properties: {
      texture: string;
      drape: string;
      weight: string;
    };
  }>;
  signatureConstruction: Array<{
    detail: string;
    frequency: number;
  }>;
  preferredPhotography: {
    shotTypes: Array<{ type: string; frequency: number }>;
    lighting: Array<{ type: string; frequency: number }>;
    angles: Array<{ angle: string; frequency: number }>;
  };
  primaryGarments: Array<{
    type: string;
    weight: number;
  }>;
  confidence: {
    aesthetic: number;
    overall: number;
  };
  metadata: {
    totalImages: number;
    lastUpdated: string;
    driftScore: number;
  };
}

interface StyleProfile {
  // ... existing fields ...
  brandDNA?: BrandDNA;
}

interface Generation {
  id: string;
  url: string;
  prompt: string;
  brandConsistencyScore?: number;
  brandDNAApplied?: boolean;
  timestamp: Date;
}
```

**Add new API method:**

```typescript
const agentsAPI = {
  // ... existing methods ...
  
  async generateWithBrandDNA(userId: string, prompt: string, options: {
    enforceBrandDNA?: boolean;
    brandDNAStrength?: number;
    creativity?: number;
    count?: number;
  } = {}) {
    const response = await fetch(`${API_URL}/podna/generate-with-dna`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getToken()}`
      },
      body: JSON.stringify({
        prompt,
        enforceBrandDNA: options.enforceBrandDNA ?? true,
        brandDNAStrength: options.brandDNAStrength ?? 0.8,
        creativity: options.creativity ?? 0.3,
        count: options.count ?? 4
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Generation failed');
    }

    return await response.json();
  },
  
  async getStyleProfile(userId: string) {
    const response = await fetch(`${API_URL}/podna/profile`, {
      headers: {
        'Authorization': `Bearer ${this.getToken()}`
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, code: 'NO_PROFILE' };
      }
      throw new Error('Failed to load profile');
    }

    return await response.json();
  }
};

export default agentsAPI;
```

---

## ✅ Frontend Completion Checklist

- [ ] Brand DNA display panel on Generation page
- [ ] Brand alignment in prompt validation
- [ ] Brand DNA toggle functional
- [ ] Brand strength slider working
- [ ] Brand consistency badges on images
- [ ] Brand DNA section on Style Profile
- [ ] "Generate from aesthetic" buttons
- [ ] API types updated
- [ ] All components compile without errors
- [ ] Visual design matches mockups

**Success Criteria:** User can see brand DNA, control enforcement, and view consistency scores on all generated images.

---

**Next:** Read `04-API-ENDPOINTS.md` for complete API documentation.

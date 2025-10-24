# System Architecture & Flow

## Overview
This document explains how the specificity-aware voice command system works.

---

## Data Flow Diagram

```
User Voice Command
      |
      v
┌─────────────────────────────────────────────────────────────────┐
│ 1. COMMAND PARSING                                              │
│    Input: "make me 10 dresses"                                  │
│    Output: {                                                    │
│      quantity: 10,                                              │
│      garmentType: 'dress',                                      │
│      attributes: { colors: [], styles: [], fabrics: [] }       │
│    }                                                            │
└─────────────────────────────────────────────────────────────────┘
      |
      v
┌─────────────────────────────────────────────────────────────────┐
│ 2. SPECIFICITY ANALYSIS                                         │
│    Service: SpecificityAnalyzer                                 │
│                                                                 │
│    Analyzes:                                                    │
│    • Descriptor count (+0.2 each, max +0.6)                    │
│    • Quantity (1 item = +0.3, 10+ = 0)                         │
│    • Language precision (vague = -0.3, precise = +0.3)         │
│    • Technical terms (+0.15 each)                               │
│                                                                 │
│    Output: {                                                    │
│      specificityScore: 0.1,                                     │
│      creativityTemp: 1.1,                                       │
│      mode: 'exploratory'                                        │
│    }                                                            │
└─────────────────────────────────────────────────────────────────┘
      |
      v
┌─────────────────────────────────────────────────────────────────┐
│ 3. STYLE PROFILE RETRIEVAL                                      │
│    Service: agentService.getStyleProfile(userId)                │
│                                                                 │
│    Retrieves user's:                                            │
│    • Dominant styles                                            │
│    • Color preferences                                          │
│    • Garment preferences                                        │
│    • Historical patterns                                        │
└─────────────────────────────────────────────────────────────────┘
      |
      v
┌─────────────────────────────────────────────────────────────────┐
│ 4. INTELLIGENT PROMPT GENERATION                                │
│    Service: IntelligentPromptBuilder                            │
│                                                                 │
│    Inputs:                                                      │
│    • Style profile                                              │
│    • User modifiers from command                                │
│    • Creativity temperature (0.3 - 1.2)                         │
│    • respectUserIntent flag                                     │
│                                                                 │
│    Logic:                                                       │
│    IF respectUserIntent == true:                                │
│      → Apply strong weighting: (modifier:2.0)                   │
│      → Add "precise execution" instructions                     │
│    ELSE:                                                        │
│      → Normal weighting                                         │
│      → Add "explore variations" instructions                    │
│                                                                 │
│    Output: {                                                    │
│      mainPrompt: "elegant contemporary dress, ...",             │
│      negativePrompt: "blurry, low quality, ..."                │
│    }                                                            │
└─────────────────────────────────────────────────────────────────┘
      |
      v
┌─────────────────────────────────────────────────────────────────┐
│ 5. IMAGE GENERATION                                             │
│    Service: generationService / imageGenerationAgent            │
│                                                                 │
│    Sends to Imagen-4 Ultra with:                                │
│    • Enhanced prompt (with creativity instructions)             │
│    • Negative prompt                                            │
│    • Count (from user command)                                  │
│                                                                 │
│    Result: Creative/precise images based on specificity         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Specificity Scoring Examples

### Example 1: "make me 10 dresses"
```
Factors:
  Descriptor Count: 0 descriptors → +0.0
  Quantity: 10 items → +0.1
  Language: neutral → +0.0
  Technical Terms: none → +0.0
  
TOTAL: 0.1 (Very Low Specificity)
→ Creativity: 1.1 (Very High)
→ Mode: Exploratory
→ Behavior: Diverse, varied designs
```

### Example 2: "make a sporty chic cashmere fitted dress in navy blue"
```
Factors:
  Descriptor Count: 5 descriptors → +0.6 (capped)
  Quantity: 1 item → +0.3
  Language: neutral → +0.0
  Technical Terms: cashmere, fitted → +0.3
  Detailed Modifiers: yes → +0.1
  
TOTAL: 1.0+ → Normalized to 0.95 (Very High Specificity)
→ Creativity: 0.35 (Very Low)
→ Mode: Specific
→ Behavior: Precise execution, literal interpretation
```

### Example 3: "surprise me with random outfits"
```
Factors:
  Descriptor Count: 0 → +0.0
  Quantity: ~10 implied → +0.1
  Language: "surprise", "random" → -0.3 (vague)
  Technical Terms: none → +0.0
  
TOTAL: -0.2 → Normalized to 0.0 (Minimum)
→ Creativity: 1.2 (Maximum)
→ Mode: Exploratory
→ Behavior: Maximum creative freedom
```

---

## Creativity to Prompt Mapping

| Creativity | Variation | Prompt Instructions Added |
|-----------|-----------|---------------------------|
| 1.2 - 1.0 | Very High | "explore creative variations, interpret broadly, diverse interpretations" |
| 0.9 - 0.6 | Medium    | "balanced interpretation, some creative freedom" |
| 0.5 - 0.3 | Very Low  | "precise execution, literal interpretation, exact specifications" |

---

## Trend Suggestion System Flow

```
User Requests Suggestions
      |
      v
┌─────────────────────────────────────────────────────────────────┐
│ Suggestion Engine                                               │
│                                                                 │
│ 1. Fetch User Style Profile                                    │
│    • Dominant styles                                            │
│    • Garment preferences                                        │
│                                                                 │
│ 2. Fetch Recent Activity                                       │
│    • Garment types generated                                    │
│    • Generation patterns                                        │
│                                                                 │
│ 3. Detect Current Season                                       │
│    • Based on current date                                      │
│                                                                 │
│ 4. Load Trend Database                                         │
│    • Seasonal trends                                            │
│    • Trend relevance scores                                     │
└─────────────────────────────────────────────────────────────────┘
      |
      v
┌─────────────────────────────────────────────────────────────────┐
│ Generate 4 Types of Suggestions                                 │
│                                                                 │
│ A. SEASONAL                                                     │
│    "Try fisherman style - trending for fall"                    │
│    Priority: 0.9                                                │
│                                                                 │
│ B. PROFILE-BASED                                                │
│    "More minimalist pieces - matches your aesthetic"            │
│    Priority: 0.85                                               │
│                                                                 │
│ C. GAP ANALYSIS                                                 │
│    "Explore blazers - underrepresented in collection"           │
│    Priority: 0.75                                               │
│                                                                 │
│ D. FUSION (Trend + Profile)                                     │
│    "Quiet luxury - perfect for your elegant style"              │
│    Priority: Compatibility score (0.6 - 1.0)                    │
└─────────────────────────────────────────────────────────────────┘
      |
      v
┌─────────────────────────────────────────────────────────────────┐
│ Rank by Priority & Return Top 6                                 │
│                                                                 │
│ Each suggestion includes:                                       │
│ • Prompt text (for display)                                     │
│ • Command (executable)                                          │
│ • Reasoning (why suggested)                                     │
│ • Metadata (confidence, type, etc.)                             │
└─────────────────────────────────────────────────────────────────┘
      |
      v
Display to User as Clickable Chips
```

---

## Integration Points

### 1. Voice Command Route (`/api/voice/process-text`)
- Receives command text
- Calls parseVoiceCommand()
- Returns parsed command with specificity analysis

### 2. Audio Command Route (`/api/voice/process-audio`)
- Receives audio file
- Transcribes to text
- Calls parseVoiceCommand()
- Same flow as text command

### 3. Suggestions Route (`/api/voice/suggestions`)
- Fetches user profile
- Generates contextual suggestions
- Returns ranked suggestion list

---

## Key Algorithms

### Specificity Score Calculation
```
score = 0.0

// Factor 1: Descriptors (max 0.6)
score += min(descriptor_count * 0.2, 0.6)

// Factor 2: Quantity
if quantity == 1: score += 0.3
elif quantity <= 5: score += 0.2
elif quantity <= 10: score += 0.1

// Factor 3: Language
if has_vague_keywords: score -= 0.3
if has_precise_keywords: score += 0.3

// Factor 4: Technical terms
if has_technical_fabric: score += 0.15
if has_construction_term: score += 0.15

// Factor 5: Detailed modifiers
if multiple_attribute_categories: score += 0.1

// Normalize
score = clamp(score, 0.0, 1.0)
```

### Creativity Mapping
```
creativity = 1.2 - (specificity * 0.9)
creativity = clamp(creativity, 0.3, 1.2)
```

### Trend Compatibility
```
compatibility = matching_keywords / total_trend_keywords
compatibility = clamp(compatibility, 0.0, 1.0)

if compatibility > 0.6:
  suggest_trend_to_user()
```

---

## Performance Considerations

- **Specificity Analysis**: <5ms per command
- **Style Profile Fetch**: ~50-100ms (database query)
- **Prompt Generation**: ~10-20ms
- **Suggestion Generation**: ~100-200ms (includes profile + trend lookup)

Total overhead per voice command: **~75-125ms**

---

## Error Handling

```
parseVoiceCommand()
  ├─ Try: Fetch style profile
  │   └─ Catch: Use fallback VLT specification
  │
  ├─ Try: Analyze specificity
  │   └─ Catch: Use default creativity (0.7)
  │
  └─ Try: Generate enhanced prompt
      └─ Catch: Use basic prompt template
```

All errors are logged but system remains functional with reasonable defaults.

---

## Configuration Options

### Environment Variables
```bash
MIN_CREATIVITY_TEMP=0.3
MAX_CREATIVITY_TEMP=1.2
DEFAULT_CREATIVITY_TEMP=0.7
TREND_DATABASE_PATH=./data/fashion_trends.json
```

### Customization Points
1. Specificity scoring weights (in specificityAnalyzer.js)
2. Trend database content (in trendAwareSuggestionEngine.js)
3. Variation instructions (in IntelligentPromptBuilder.js)
4. Keyword dictionaries (vague, precise, technical terms)

---

This architecture ensures intelligent, adaptive behavior while maintaining performance and reliability.

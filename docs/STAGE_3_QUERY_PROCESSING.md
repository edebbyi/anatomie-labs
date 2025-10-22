# Stage 3: Query Processing & Voice Command Interpretation

## Overview

**Stage 3** is the intelligent bridge between natural language user input and the structured data pipeline. It transforms informal voice commands or text queries into actionable, structured requests that the system can execute.

## The Problem

When a user says **"Make me 10 dresses"**, they're NOT asking the AI to generate images with the literal prompt "make me 10 dresses". That would produce nonsensical results. Instead, the system needs to:

1. **Understand** the user's intent (generate fashion designs)
2. **Extract** key information (count: 10, garment type: dress)
3. **Determine** the query type (exploratory vs specific)
4. **Generate** appropriate VLT specifications or sampling strategies
5. **Execute** the proper retrieval/generation pipeline

## Query Types

### Specific Queries (Mode A: Targeted Retrieval)

**User says**: "Make me 80 blue dresses"  
**User says**: "20 structured blazers"  
**User says**: "Create evening gowns"

**What it means**:
- User has specific attributes in mind
- Uses VLT metadata filters
- Hybrid search: semantic vector + metadata
- Find reference examples matching criteria
- Extract common VLT patterns
- Generate 120 variations from these patterns (20% over-generation)

**Pipeline**:
```
Natural Language Query
  ↓
Parse Intent & Extract Entities
  ↓
Build VLT Specification
  {
    garmentType: "dress",
    colors: { primary: "blue" },
    count: 80
  }
  ↓
Targeted Retrieval (Stage 4)
  - Hybrid search (FAISS + metadata)
  - Find 10 reference examples
  - Extract common VLT patterns
  ↓
Prompt Generation (Stage 5)
  - Generate 96 prompts (80 × 1.2)
  - Use VLT patterns
  - RLHF optimization
  ↓
Image Generation
  - Generate 96 images
  - Quality validation
  - Return best 80
```

### Exploratory Queries (Mode B: Stratified Sampling)

**User says**: "Make me 100 outfits"  
**User says**: "Surprise me with 50 pieces"  
**User says**: "Generate overnight batch"

**What it means**:
- User wants diversity and variety
- No specific attributes constraining the search
- Sample from style distributions
- Stratified across garment types
- Use learned weights from historical gaps
- Controlled mutation for diversity

**Pipeline**:
```
Natural Language Query
  ↓
Parse Intent & Extract Entities
  ↓
Build Sampling Strategy
  {
    type: "exploratory",
    count: 100,
    stratification: {
      byGarmentType: true,
      byStyleCluster: true
    },
    distribution: {
      dress: 45%,
      blazer: 30%,
      gown: 15%,
      other: 10%
    }
  }
  ↓
Stratified Sampling (Stage 4)
  - Allocate to style clusters
  - Sample VLT attributes from distributions
  - Add controlled mutation
  - Generate 120 diverse specifications
  ↓
Prompt Generation (Stage 5)
  - Generate 120 prompts
  - Temperature-based variation
  - RLHF optimization
  ↓
Image Generation
  - Generate 120 images
  - Intelligent diversity filtering
  - Return best 100
```

## ML Techniques

### 1. Large Language Model (LLM) - Intent Parsing

**Purpose**: Understand user intent from natural language

**Example**:
```javascript
Input: "Make me 10 dresses"

LLM Analysis:
{
  action: "generate",
  count: 10,
  specificity: "exploratory",
  confidence: 0.95
}
```

**How it works**:
- Uses GPT-4 to parse commands
- Identifies action verbs (make, create, generate)
- Extracts quantities
- Determines if query is specific or exploratory
- Fallback to rule-based parsing if API unavailable

### 2. Named Entity Recognition (NER)

**Purpose**: Extract fashion-specific entities from text

**Example**:
```javascript
Input: "Create 50 elegant blue evening gowns in silk"

NER Extraction:
{
  garmentType: "evening gown",
  count: 50,
  colors: ["blue"],
  styles: ["elegant"],
  fabrics: ["silk"]
}
```

**How it works**:
- Uses GPT-4 with fashion domain expertise
- Identifies:
  - Garment types (dress, gown, blazer)
  - Colors (blue, burgundy, navy)
  - Styles (elegant, casual, modern)
  - Fabrics (silk, velvet, cotton)
  - Modifiers (structured, fitted, loose)
- Fallback to keyword matching if API unavailable

### 3. Query Classification

**Decision Logic**:
```javascript
function determineQueryType(query, entities) {
  // Exploratory indicators
  const hasExploratoryKeyword = 
    ['surprise', 'random', 'varied', 'diverse'].some(kw => 
      query.includes(kw)
    );
  
  // Specific attribute indicators
  const hasSpecificAttributes = 
    entities.colors.length > 0 ||
    entities.styles.length > 0 ||
    entities.fabrics.length > 0;
  
  // Decision
  if (hasExploratoryKeyword && !hasSpecificAttributes) {
    return 'exploratory';
  } else if (hasSpecificAttributes) {
    return 'specific';
  } else if (entities.count > 10) {
    return 'exploratory'; // Large batches = exploratory
  }
  
  return 'specific'; // Default
}
```

## Example Transformations

### Example 1: Simple Count Query

**Input**: `"Make me 10 dresses"`

**Processing**:
```javascript
Intent: { action: "generate", count: 10, specificity: "exploratory" }
Entities: { garmentType: "dress", count: 10 }
Query Type: "exploratory"

Structured Query:
{
  type: "exploratory",
  mode: "stratified_sampling",
  count: 10,
  samplingStrategy: {
    stratification: {
      byGarmentType: false, // Single garment type
      byStyleCluster: true,
      byColorFamily: false
    },
    distribution: {
      dress: 1.0 // 100% dresses
    },
    mutation: {
      enabled: true,
      temperature: 0.7
    }
  },
  strategy: {
    type: "stratified_sampling",
    diversityTarget: "high",
    overGenerationPercent: 20 // Generate 12, return 10
  }
}
```

### Example 2: Specific Attributes Query

**Input**: `"Create 50 blue evening gowns"`

**Processing**:
```javascript
Intent: { action: "create", count: 50, specificity: "specific" }
Entities: { 
  garmentType: "evening gown",
  count: 50,
  colors: ["blue"]
}
Query Type: "specific"

Structured Query:
{
  type: "specific",
  mode: "targeted",
  count: 50,
  vltSpec: {
    garmentType: "evening gown",
    colors: {
      primary: "blue",
      palette: ["blue"]
    }
  },
  strategy: {
    type: "hybrid_search",
    useSemanticVector: true,
    useMetadataFilters: true,
    overGenerationPercent: 20 // Generate 60, return 50
  }
}
```

### Example 3: Exploratory Batch

**Input**: `"Surprise me with 100 outfits"`

**Processing**:
```javascript
Intent: { action: "generate", count: 100, specificity: "exploratory" }
Entities: { count: 100 }
Query Type: "exploratory"

Structured Query:
{
  type: "exploratory",
  mode: "stratified_sampling",
  count: 100,
  samplingStrategy: {
    stratification: {
      byGarmentType: true,
      byStyleCluster: true,
      byColorFamily: false
    },
    distribution: {
      dress: 0.45,  // 45 dresses
      blazer: 0.30, // 30 blazers
      gown: 0.15,   // 15 gowns
      other: 0.10   // 10 other
    },
    mutation: {
      enabled: true,
      temperature: 0.8 // High creativity
    },
    gapAnalysis: {
      enabled: true,
      useHistoricalData: true // Fill gaps in user's history
    }
  },
  strategy: {
    type: "stratified_sampling",
    diversityTarget: "high",
    overGenerationPercent: 20 // Generate 120, return 100
  }
}
```

## Integration with Pipeline

### Connection to Stage 4 (Retrieval/Sampling)

Stage 3 output → Stage 4 input:

**For Specific Queries**:
```javascript
Stage 3 Output:
{
  type: "specific",
  vltSpec: { garmentType: "dress", colors: ["blue"] },
  count: 80
}

Stage 4 (Retrieval Service):
async function retrieveSpecifications(query) {
  // Use VLT spec for targeted search
  const references = await faissSearch(query.vltSpec);
  const vltPatterns = extractCommonPatterns(references);
  const specifications = generateVariations(vltPatterns, query.count * 1.2);
  return specifications;
}
```

**For Exploratory Queries**:
```javascript
Stage 3 Output:
{
  type: "exploratory",
  samplingStrategy: {
    distribution: { dress: 0.45, blazer: 0.30 }
  },
  count: 100
}

Stage 4 (Sampling Service):
async function sampleSpecifications(query) {
  // Use stratified sampling
  const specifications = [];
  
  for (const [garmentType, ratio] of Object.entries(query.distribution)) {
    const count = Math.floor(query.count * ratio * 1.2);
    const samples = await sampleFromCluster(garmentType, count);
    specifications.push(...samples);
  }
  
  return specifications;
}
```

### Connection to Stage 5 (Prompt Generation)

Stage 4 specifications → Stage 5 prompts:

```javascript
// Stage 4 outputs VLT specifications
const vltSpecs = [
  { garmentType: "dress", colors: { primary: "blue" }, ... },
  { garmentType: "dress", colors: { primary: "navy" }, ... },
  ...
];

// Stage 5 converts each VLT spec to a detailed prompt
for (const vltSpec of vltSpecs) {
  const prompt = await promptGenerationService.generateFromVLT(vltSpec);
  // prompt = "elegant blue dress with fitted bodice and flowing skirt, 
  //           crafted in silk charmeuse with glossy finish..."
}
```

## Voice Command Processing

### How Voice Commands Work

1. **Speech-to-Text** (External Service)
   - User speaks: "Make me 10 dresses"
   - STT service converts to text
   - Text sent to Stage 3

2. **Query Processing** (Stage 3)
   - Parse intent
   - Extract entities
   - Classify query type
   - Build structured query

3. **Pipeline Execution** (Stages 4-5)
   - Execute appropriate retrieval/sampling
   - Generate prompts
   - Create images

### Example Voice Flow

```
User speaks: "Create 20 elegant burgundy evening gowns"
  ↓
Speech-to-Text API
  ↓
Text: "create 20 elegant burgundy evening gowns"
  ↓
Stage 3: Query Processing
  Intent: { action: "create", count: 20, specificity: "specific" }
  Entities: { 
    garmentType: "evening gown",
    colors: ["burgundy"],
    styles: ["elegant"],
    count: 20
  }
  Query Type: "specific"
  ↓
Stage 4: Targeted Retrieval
  Search for: garmentType=gown, color=burgundy, style=elegant
  Find 10 reference examples
  Extract VLT patterns
  Generate 24 specifications (20 × 1.2)
  ↓
Stage 5: Prompt Generation
  Convert each VLT spec to detailed prompt
  Apply RLHF optimization
  24 optimized prompts ready
  ↓
Image Generation
  Generate 24 images
  Quality validation
  Return best 20 to user
```

## Configuration

### Environment Variables

```bash
# Required for LLM-based parsing
OPENAI_API_KEY=your_openai_api_key

# Optional: For speech-to-text (if implementing voice)
SPEECH_TO_TEXT_API_KEY=your_stt_api_key
```

### Customization

```javascript
// Adjust query type keywords
queryProcessingService.exploratoryKeywords = [
  'surprise', 'random', 'varied', 'diverse', ...
];

// Adjust sampling distributions
queryProcessingService.defaultDistribution = {
  dress: 0.45,
  blazer: 0.30,
  gown: 0.15,
  other: 0.10
};

// Adjust over-generation buffer
queryProcessingService.overGenerationPercent = 20; // 20% extra
```

## Testing

### Test Query Processing

```javascript
const queryProcessingService = require('./src/services/queryProcessingService');

// Test specific query
const result1 = await queryProcessingService.processQuery(
  "Make me 50 blue evening gowns",
  userId
);

console.log(result1.queryType); // "specific"
console.log(result1.structuredQuery.vltSpec); 
// { garmentType: "evening gown", colors: { primary: "blue" } }

// Test exploratory query
const result2 = await queryProcessingService.processQuery(
  "Surprise me with 100 outfits",
  userId
);

console.log(result2.queryType); // "exploratory"
console.log(result2.structuredQuery.samplingStrategy);
// { stratification: {...}, distribution: {...} }
```

## Performance Metrics

- **Intent Parsing**: ~1-2 seconds (LLM-based), <100ms (fallback)
- **Entity Extraction**: ~1-2 seconds (LLM-based), <100ms (fallback)
- **Query Classification**: <10ms (rule-based)
- **Total Stage 3 Time**: ~2-4 seconds with LLM, <200ms with fallback

## Cost Estimate

- **OpenAI API (GPT-4)**: ~$0.002 per query
- **Fallback (rule-based)**: $0.000 per query

## Future Enhancements

1. **Fine-tuned NER Model**: Train custom NER on fashion domain
2. **Context Awareness**: Remember previous queries in session
3. **Multi-turn Dialogue**: "Make them darker", "Add more variety"
4. **Image Input**: "Make me more like this image"
5. **Style Preference Learning**: Adapt parsing based on user history

## Summary

**Stage 3** is the intelligent interpreter that makes the system understand human language:

- **Input**: Natural language ("Make me 10 dresses")
- **Output**: Structured query with VLT specs or sampling strategy
- **Key Innovation**: Distinguishes specific vs exploratory queries
- **Result**: System knows exactly what to generate and how

Without Stage 3, the pipeline would receive literal prompts like "make me 10 dresses" and produce nonsense. With Stage 3, the system understands intent and executes the right strategy to deliver what the user actually wants.

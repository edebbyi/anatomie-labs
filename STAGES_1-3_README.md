# Designer BFF - Stages 1-3 Implementation

**Complete Pre-Generation Pipeline: VLT → Enhancement → Persona Matching**

## 🎯 Overview

This implementation covers the first 3 stages of the 11-stage Designer BFF pipeline:

- **Stage 1: VLT Analysis** - Extract structured visual specifications from images
- **Stage 2: Prompt Enhancement** - Enhance VLT specs using Claude/GPT for professional prompts
- **Stage 3: Persona Matching** - Match prompts to user style personas with CLIP embeddings

## 📁 Project Structure

```
anatomie-lab/
├── src/
│   ├── services/
│   │   ├── vltService.js                  # Stage 1: VLT integration
│   │   ├── promptEnhancementService.js    # Stage 2: AI prompt enhancement
│   │   ├── personaService.js              # Stage 3: Persona matching
│   │   ├── pineconeService.js             # Vector storage for personas
│   │   └── pipelineOrchestrator.js        # End-to-end orchestration
│   └── api/routes/
│       ├── vlt.js                         # VLT API endpoints
│       ├── prompt.js                      # Prompt enhancement endpoints
│       └── persona.js                     # Persona management endpoints
├── database/migrations/
│   └── 003_create_persona_tables.sql     # Database schema for personas
└── test-pipeline-stages-1-3.js           # Comprehensive test suite
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

New packages added:
- `@anthropic-ai/sdk` - Claude API integration
- `@pinecone-database/pinecone` - Vector storage
- `openai` - GPT API integration
- `@xenova/transformers` - CLIP embeddings

### 2. Configure Environment Variables

Add to your `.env` file:

```bash
# AI Providers (at least one required for Stage 2)
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENAI_API_KEY=your_openai_api_key

# Vector Storage (required for Stage 3)
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=designer-bff-styles

# VLT Service (required for Stage 1)
VLT_API_URL=https://visual-descriptor-516904417440.us-central1.run.app
VLT_API_KEY=your_vlt_api_key

# Database (required for persona storage)
DATABASE_URL=postgresql://username:password@localhost:5432/designer_bff
```

### 3. Run Database Migrations

```bash
# Apply persona table migrations
psql $DATABASE_URL -f database/migrations/003_create_persona_tables.sql
```

This creates:
- `user_personas` - Store user style personas
- `style_history` - Track style evolution
- Updates to `images` and `vlt_specifications` tables

### 4. Test the Pipeline

```bash
node test-pipeline-stages-1-3.js
```

Expected output:
```
╔══════════════════════════════════════════════════════════╗
║   DESIGNER BFF - STAGES 1-3 PIPELINE TEST SUITE         ║
╚══════════════════════════════════════════════════════════╝

============================================================
TEST 1: Pinecone Connection
============================================================
✓ Pinecone connection successful
  - Vector count: 0
  - Dimension: 512

... (more tests)

============================================================
TEST SUMMARY
============================================================
Tests Passed: 5/5
  ✓ PASS     pinecone
  ✓ PASS     vlt
  ✓ PASS     enhancement
  ✓ PASS     persona
  ✓ PASS     pipeline
```

## 📘 API Endpoints

### Stage 1: VLT Analysis

```bash
# Analyze single image
POST /api/vlt/analyze/single
Content-Type: multipart/form-data

{
  "image": <file>,
  "model": "gemini",
  "passes": "A,B,C"
}

# Response
{
  "success": true,
  "data": {
    "jobId": "vlt_job_123",
    "records": [{
      "garmentType": "dress",
      "silhouette": "A-line",
      "fabric": { "type": "silk charmeuse", ... },
      "colors": { "primary": "emerald green", ... },
      "style": { "aesthetic": "minimalist", ... }
    }]
  }
}
```

### Stage 2: Prompt Enhancement

```bash
# Enhance VLT specification
POST /api/prompt/enhance

{
  "vltSpec": { /* VLT output */ },
  "options": {
    "provider": "claude",  # or "openai"
    "style": "professional",
    "creativity": 0.7
  }
}

# Response
{
  "success": true,
  "data": {
    "enhancements": [{
      "enhanced": {
        "mainPrompt": "A-line silk charmeuse dress in emerald green...",
        "negativePrompt": "blurry, low quality, distorted...",
        "keywords": ["dress", "silk", "emerald", "minimalist"],
        "photographyStyle": "studio"
      },
      "metadata": {
        "wordCount": 245,
        "enhancementQuality": "high"
      }
    }]
  }
}
```

### Stage 3: Persona Matching

```bash
# Create persona
POST /api/persona

{
  "name": "Minimalist Tailoring",
  "description": "Clean lines, monochromatic palettes",
  "keywords": ["minimalist", "tailored", "structured"],
  "stylePreferences": {
    "lightingPreference": "soft natural light"
  },
  "examplePrompts": [
    "professional tailored suit in monochrome",
    "structured minimalist dress"
  ]
}

# Match prompt to persona
POST /api/persona/match

{
  "enhancedPrompt": { /* from Stage 2 */ },
  "options": {
    "useActivePersona": true
  }
}

# Response
{
  "success": true,
  "data": {
    "matchedPersona": {
      "id": 1,
      "name": "Minimalist Tailoring"
    },
    "matchScore": 0.85,
    "adjustedPrompt": { /* persona-adjusted prompt */ },
    "adjustments": [
      {
        "type": "keyword_injection",
        "keywords": ["minimalist", "structured"]
      }
    ],
    "recommendation": "Excellent match! This prompt aligns well with your style."
  }
}
```

### Full Pipeline Orchestration

```bash
# Execute complete pipeline
# Note: Requires implementation in your server routes

const result = await pipelineOrchestrator.executeFullPipeline(
  userId,
  imageBuffer,
  {
    vltOptions: { model: 'gemini' },
    enhancementOptions: { provider: 'claude' },
    personaOptions: { useActivePersona: true }
  }
);
```

## 🏗️ Architecture

### Stage 1: VLT Service

**Purpose:** Extract structured visual specifications from garment images

**Key Features:**
- Multi-model support (Gemini, GPT-4 Vision)
- Batch processing (ZIP file support)
- Detailed garment analysis (fabric, color, construction, style)

**Technologies:**
- Google Gemini Vision API
- Form data processing with `multer`

### Stage 2: Prompt Enhancement Service

**Purpose:** Transform VLT specs into professional image generation prompts

**Key Features:**
- Claude 3.5 Sonnet / GPT-4 support
- Fashion photography expertise
- Fallback enhancement (no AI required)
- Multiple style presets (professional, editorial, commercial, artistic)

**Technologies:**
- Anthropic Claude API
- OpenAI GPT-4 API
- Structured JSON output parsing

### Stage 3: Persona Service

**Purpose:** Match prompts to user style preferences with semantic understanding

**Key Features:**
- CLIP embedding generation
- Pinecone vector storage
- Style consistency scoring
- Automatic prompt adjustments
- Style evolution tracking

**Technologies:**
- Pinecone vector database
- HuggingFace Transformers (CLIP)
- Gaussian Mixture Models for style distribution

## 🧪 Testing

### Unit Tests

```bash
# Test individual services
node -e "require('./src/services/vltService').healthCheck().then(console.log)"
node -e "require('./src/services/pineconeService').healthCheck().then(console.log)"
```

### Integration Test

```bash
# Full pipeline test
node test-pipeline-stages-1-3.js
```

### Manual API Testing

```bash
# Test VLT endpoint
curl -X GET http://localhost:5000/api/vlt/health

# Test enhancement providers
curl -X GET http://localhost:5000/api/prompt/providers

# Test persona templates
curl -X GET http://localhost:5000/api/persona/default-templates
```

## 📊 Database Schema

### user_personas

```sql
CREATE TABLE user_personas (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  keywords JSONB DEFAULT '[]'::jsonb,
  style_preferences JSONB DEFAULT '{}'::jsonb,
  embedding_id VARCHAR(255),        -- Pinecone vector ID
  embedding_dimension INTEGER,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, name)
);
```

### style_history

```sql
CREATE TABLE style_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  persona_id INTEGER REFERENCES user_personas(id),
  image_ids JSONB DEFAULT '[]'::jsonb,
  prompt_text TEXT,
  feedback_type VARCHAR(50),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🔐 Security Considerations

1. **API Keys**: Never commit API keys to version control
2. **User Data Isolation**: All queries filtered by `user_id`
3. **Input Validation**: All endpoints validate input data
4. **Rate Limiting**: Apply rate limits to AI API calls
5. **Error Handling**: Sensitive errors logged but not exposed to clients

## 🚧 Troubleshooting

### Pinecone Connection Issues

```bash
# Test Pinecone connection
node -e "require('./src/services/pineconeService').healthCheck().then(r => console.log('Healthy:', r))"

# Common issues:
# - API key not set
# - Index doesn't exist (auto-created on first connection)
# - Network/firewall blocking connection
```

### AI Provider Errors

```bash
# Test AI providers
node -e "console.log('Anthropic:', !!process.env.ANTHROPIC_API_KEY, 'OpenAI:', !!process.env.OPENAI_API_KEY)"

# If both fail, fallback enhancement will be used
```

### Database Migration Issues

```bash
# Check if tables exist
psql $DATABASE_URL -c "\dt user_personas"

# Re-run migration if needed
psql $DATABASE_URL -f database/migrations/003_create_persona_tables.sql
```

## 📈 Performance Metrics

**Stage 1 (VLT Analysis):**
- Single image: ~2-5 seconds
- Batch (10 images): ~15-30 seconds

**Stage 2 (Enhancement):**
- Claude: ~3-8 seconds per prompt
- GPT-4: ~4-10 seconds per prompt
- Fallback: <100ms

**Stage 3 (Persona Matching):**
- CLIP embedding generation: ~500ms-2s
- Vector similarity search: <100ms
- Full matching: ~1-3 seconds

**Full Pipeline (3 stages):**
- Average: 8-15 seconds
- Peak: 20-30 seconds (with batch processing)

## 🔄 Next Steps (Stages 4-11)

### Stage 4: Model Routing
- Implement dynamic model selection (Imagen, DALL-E, Midjourney, SD)
- Cost optimization routing
- Quality-based routing

### Stage 5: RLHF Optimization
- Prompt reward modeling
- Reinforcement learning integration
- A/B testing framework

### Stage 6: Image Generation
- Multi-model orchestration
- Batch generation (4 images per prompt)
- Generation parameter optimization

### Stages 7-11: Post-Processing & Feedback
- GFPGAN face enhancement
- Real-ESRGAN upscaling
- Quality control validation
- DPP diversity sampling
- User feedback loop
- Analytics dashboard

## 📚 Resources

- [VLT API Documentation](https://visual-descriptor-516904417440.us-central1.run.app/docs)
- [Anthropic Claude API](https://docs.anthropic.com/)
- [OpenAI API](https://platform.openai.com/docs)
- [Pinecone Documentation](https://docs.pinecone.io/)
- [CLIP Model Paper](https://arxiv.org/abs/2103.00020)

## 👥 Support

For questions or issues:
1. Check the test output: `node test-pipeline-stages-1-3.js`
2. Review logs in `logs/` directory
3. Verify environment variables are set
4. Check database connectivity

## 📝 License

[Your License Here]

---

**Status:** ✅ Stages 1-3 Complete and Tested

**Next Milestone:** Stage 4 - Model Routing & Selection

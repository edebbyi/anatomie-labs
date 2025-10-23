# Podna Agent System

**AI-powered, personal-style fashion design partner that learns from your portfolio and generates on-brand images.**

---

## Overview

Podna is a simplified 7-agent system that:
1. **Ingests** your portfolio (50+ images from ZIP)
2. **Analyzes** fashion attributes with AI vision
3. **Learns** your style preferences
4. **Generates** infinite on-brand images
5. **Improves** from your feedback (likes/dislikes/critiques)

---

## Agent Architecture

### 1. **Ingestion Agent**
- **Purpose**: Upload ZIP → extract images → deduplicate → normalize
- **Tech**: AdmZip, crypto hashing, R2 storage
- **Outputs**: Portfolio record, image records, embeddings, captions

### 2. **Style Descriptor Agent**
- **Purpose**: Extract normalized fashion attributes from images
- **Tech**: Gemini 2.5 Flash vision model
- **Outputs**: Structured JSON with garment type, colors, fabrics, silhouette, lighting, camera, etc.
- **Validation**: Controlled vocabulary (enums) for consistency

### 3. **Trend Analysis Agent**
- **Purpose**: Aggregate portfolio stats and generate style profile
- **Outputs**: 
  - Distribution charts (garments, colors, fabrics, silhouettes)
  - Style labels (e.g., "sport chic", "minimalist tailoring")
  - Style clusters with signature attributes
  - Summary text

### 4. **Prompt Builder Agent**
- **Purpose**: Generate prompts from style profile
- **Strategy**: Epsilon-greedy bandit (90% exploit best patterns, 10% explore)
- **Inputs**: Style profile, user constraints, prompt history
- **Outputs**: Text prompt + structured JSON spec

### 5. **Image Generation Agent**
- **Purpose**: Generate images using AI models
- **Providers**: Imagen-4 Ultra (primary), Stable Diffusion (fallback)
- **Features**: Cost tracking, seed logging, optional Real-ESRGAN upscaling
- **Batch mode**: Generate multiple images in one call

### 6. **Feedback Learner Agent**
- **Purpose**: Process user feedback and update preferences
- **Feedback types**: Like, Dislike, Swipe Left, Swipe Right, Text critiques
- **Learning**: 
  - Parses critiques with Gemini ("make this blue" → color: blue)
  - Generates learning deltas (weight adjustments)
  - Updates style profile distributions
  - Records prompt history for bandit strategy

### 7. **Orchestration**
- **API Routes**: RESTful endpoints at `/api/podna/*`
- **Complete onboarding**: Single endpoint handles entire workflow

---

## Database Schema

### Core Tables
- **portfolios**: Uploaded ZIP collections
- **portfolio_images**: Individual images from uploads
- **image_embeddings**: Vector embeddings (CLIP/ViT) for semantic search
- **image_descriptors**: Normalized fashion attributes (JSON)
- **style_profiles**: Aggregated user style (clusters, distributions, summary)
- **prompts**: Generated prompts for image generation
- **generations**: AI-generated images
- **feedback**: User likes/dislikes/critiques
- **learning_events**: Learning loop updates (deltas)
- **prompt_history**: Historical performance for bandit strategy

---

## API Endpoints

### Onboarding
- **POST `/api/podna/upload`** - Upload portfolio ZIP
- **POST `/api/podna/analyze/:portfolioId`** - Analyze images
- **POST `/api/podna/profile/generate/:portfolioId`** - Generate style profile
- **POST `/api/podna/onboard`** - Complete onboarding in one call (recommended)

### Profile
- **GET `/api/podna/profile`** - Get user style profile

### Generation
- **POST `/api/podna/generate`** - Generate single image
- **POST `/api/podna/generate/batch`** - Generate batch of images
- **GET `/api/podna/gallery`** - Get generated images

### Feedback
- **POST `/api/podna/feedback`** - Submit feedback (like/dislike/critique)
- **GET `/api/podna/feedback`** - Get feedback history

---

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/anatomie_lab

# Gemini API (required)
GEMINI_API_KEY=your_gemini_api_key

# Google API (for Imagen-4 Ultra)
GOOGLE_API_KEY=your_google_api_key

# Replicate API (for Stable Diffusion fallback)
REPLICATE_API_TOKEN=your_replicate_token

# R2 Storage (Cloudflare)
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=your_bucket_name

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRE_TIME=7d
```

### 3. Database Migration
```bash
psql -U your_user -d anatomie_lab -f database/migrations/008_podna_agent_system.sql
```

### 4. Start Server
```bash
npm run dev
```

---

## Usage Flow

### Step 1: Sign Up
```bash
POST /api/auth/register
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "securepassword"
}
```

### Step 2: Complete Onboarding
```bash
POST /api/podna/onboard
Content-Type: multipart/form-data
Authorization: Bearer <token>

portfolio: <ZIP file with 50+ images>
generateInitial: true
initialCount: 10
```

**Response:**
```json
{
  "success": true,
  "message": "Onboarding completed successfully",
  "data": {
    "portfolio": {
      "id": "uuid",
      "imageCount": 52
    },
    "analysis": {
      "analyzed": 52,
      "failed": 0
    },
    "profile": {
      "id": "uuid",
      "summaryText": "Based on 52 images, your style signature includes sport chic, minimalist tailoring...",
      "styleLabels": [
        { "name": "sport chic", "score": 0.82 },
        { "name": "minimalist tailoring", "score": 0.75 }
      ],
      "clusters": [
        {
          "name": "dress essentials",
          "weight": 0.41,
          "signature_attributes": { ... }
        }
      ]
    },
    "generations": {
      "count": 10,
      "images": [ ... ]
    }
  }
}
```

### Step 3: View Gallery
```bash
GET /api/podna/gallery
Authorization: Bearer <token>
```

### Step 4: Give Feedback
```bash
POST /api/podna/feedback
Authorization: Bearer <token>

{
  "generationId": "uuid",
  "type": "like",
  "note": "Love this! Make sleeves longer next time"
}
```

**System learns:**
- Boosts preferences for attributes in liked image
- Parses critique: "longer sleeves" → increases sleeve_length weight
- Updates style profile
- Future prompts will favor longer sleeves

### Step 5: Generate More
```bash
POST /api/podna/generate
Authorization: Bearer <token>

{
  "mode": "exploratory",
  "provider": "imagen-4-ultra",
  "constraints": {
    "garment_type": "dress",
    "colors": ["blue", "navy"]
  }
}
```

---

## Learning Loop

1. **User likes image** → Boost attributes (color, fabric, silhouette) by +0.1
2. **User dislikes image** → Reduce attributes by -0.05
3. **User critiques** → Parse with Gemini → Apply strong boost (+0.3) to requested changes
4. **Profile updates** → Distributions normalized and saved
5. **Next generation** → Prompt Builder uses updated profile + prompt history (bandit strategy)

---

## Cost Tracking

- **Imagen-4 Ultra**: $0.04/image
- **Stable Diffusion XL**: $0.02/image
- **Gemini 2.5 Flash**: ~$0.0001/image (vision analysis)
- **Real-ESRGAN** (optional): $0.01/upscale

All costs tracked in `generations.cost_cents` and `generations.upscale_cost_cents`.

---

## Development Mode

When `GEMINI_API_KEY` or `GOOGLE_API_KEY` is missing:
- System falls back to mock data
- Placeholder images used
- Logs warnings but continues

---

## Frontend Integration

### Onboarding Component
```typescript
const handleOnboarding = async (zipFile: File) => {
  const formData = new FormData();
  formData.append('portfolio', zipFile);
  formData.append('generateInitial', 'true');
  formData.append('initialCount', '10');

  const response = await fetch('/api/podna/onboard', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  const result = await response.json();
  // result.data.profile has style profile
  // result.data.generations.images has initial gallery
};
```

### Gallery Component
```typescript
const fetchGallery = async () => {
  const response = await fetch('/api/podna/gallery', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const result = await response.json();
  setImages(result.data.generations);
};
```

### Feedback Component
```typescript
const handleLike = async (generationId: string) => {
  await fetch('/api/podna/feedback', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      generationId,
      type: 'like'
    })
  });

  // System automatically updates style profile
};
```

---

## Next Steps (Phase 2)

- [ ] QA/Validation Agent (spec match scoring)
- [ ] Voice Command Agent (speech-to-text + intent parsing)
- [ ] Overnight batch generator (200 images/night)
- [ ] Advanced RLHF (PPO instead of bandit)
- [ ] Team collaboration features
- [ ] Analytics dashboard
- [ ] Public sharing ("Podna Cards")

---

## File Structure

```
src/
├── api/routes/
│   ├── podna.js              # Podna API routes
│   └── auth.js               # Authentication routes
├── services/
│   ├── ingestionAgent.js     # Agent 1: ZIP upload & processing
│   ├── styleDescriptorAgent.js  # Agent 2 & 3: Vision analysis
│   ├── trendAnalysisAgent.js    # Agent 4: Style profile generation
│   ├── promptBuilderAgent.js    # Agent 5: Prompt generation (bandit)
│   ├── imageGenerationAgent.js  # Agent 6: Image generation
│   ├── feedbackLearnerAgent.js  # Agent 7: Feedback processing
│   ├── database.js
│   ├── r2Storage.js
│   └── redis.js
├── middleware/
│   ├── auth.js
│   └── errorHandler.js
└── models/
    └── User.js

database/migrations/
└── 008_podna_agent_system.sql  # Schema migration

server.js                        # Express server
```

---

## Troubleshooting

### "No style profile found"
→ Run onboarding first: `POST /api/podna/onboard`

### "Portfolio must contain at least 50 images"
→ Your ZIP needs ≥50 valid images (.jpg, .jpeg, .png, .webp)

### "Gemini API key not configured"
→ Set `GEMINI_API_KEY` in `.env`

### Images not generating
→ Check `GOOGLE_API_KEY` or `REPLICATE_API_TOKEN` in `.env`

### Database errors
→ Run migration: `psql -f database/migrations/008_podna_agent_system.sql`

---

## License

ISC

---

## Credits

Built with:
- **Gemini 2.5 Flash** (Google) for vision analysis
- **Imagen-4 Ultra** (Google) for image generation
- **Stable Diffusion XL** (Stability AI) for fallback generation
- **PostgreSQL** + **pgvector** for data & embeddings
- **Express.js** + **Node.js** for backend
- **R2** (Cloudflare) for image storage

---

**Podna** - Your AI design partner 🎨✨

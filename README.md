# Podna - AI Fashion Design Partner 🎨

**AI-powered personal style system that learns from your portfolio and generates infinite on-brand images.**

---

## 🚀 Quick Start (5 Minutes)

### 1. Setup Environment
```bash
# Copy environment template
cp .env.podna.example .env

# Edit .env and add required keys:
# - GEMINI_API_KEY (required)
# - GOOGLE_API_KEY (optional, for Imagen)
# - DATABASE_URL (required)
```

### 2. Run Setup
```bash
./setup-podna.sh
```

### 3. Start Server
```bash
npm run dev
```

Server starts on `http://localhost:3001`

### 4. Test System
```bash
# With your portfolio ZIP (50+ fashion images)
node tests/test-podna-system.js /path/to/portfolio.zip

# Without ZIP (see instructions)
node tests/test-podna-system.js
```

---

## 🤖 System Architecture

### 7 Specialized Agents

1. **Ingestion Agent** - ZIP upload, deduplication, embedding generation
2. **Style Descriptor Agent** - Vision analysis with Gemini, normalized JSON extraction  
3. **Trend Analysis Agent** - Portfolio aggregation, style profile generation
4. **Prompt Builder Agent** - Smart prompt generation (epsilon-greedy bandit)
5. **Image Generation Agent** - Imagen-4 Ultra / Stable Diffusion integration
6. **Feedback Learner Agent** - Like/dislike processing, critique parsing
7. **API Orchestration** - RESTful routes at `/api/podna/*`

### Data Flow
```
User → Upload ZIP (50+ images) →
  [Ingestion] Extract & deduplicate →
  [Style Descriptor] Analyze with Gemini →
  [Trend Analysis] Generate style profile →
  [Image Generator] Create initial gallery →
User → Gives Feedback →
  [Feedback Learner] Parse & update profile →
Next generation is better! ∞
```

---

## 📊 API Endpoints

### Base: `http://localhost:3001/api`

#### Authentication
- `POST /auth/register` - Sign up
- `POST /auth/login` - Sign in

#### Onboarding (All-in-One) ⭐
```bash
POST /podna/onboard
Headers: Authorization: Bearer <token>
Body (multipart/form-data):
  - portfolio: <ZIP file>
  - generateInitial: true
  - initialCount: 10
```

**This single endpoint:**
1. Uploads your portfolio
2. Analyzes all images
3. Generates your style profile  
4. Creates initial image gallery

#### Profile
- `GET /podna/profile` - Get user style profile

#### Generation
- `POST /podna/generate` - Generate single image
- `POST /podna/generate/batch` - Generate multiple images
- `GET /podna/gallery` - View generated images

#### Feedback
- `POST /podna/feedback` - Submit feedback (like/dislike/critique)
- `GET /podna/feedback` - View feedback history

---

## 💡 Key Features

### ✅ Smart Learning Loop
- **Like** → Boosts similar attributes (+0.1)
- **Dislike** → Reduces those attributes (-0.05)
- **Critique** → Gemini parses request → Strong boost (+0.3)
- Profile updates automatically → Next images are better

### ✅ Epsilon-Greedy Bandit Strategy
- 90% exploitation (use what works)
- 10% exploration (try new things)
- Prevents local optima

### ✅ Controlled Vocabulary
- Fashion attributes validated against enums
- Consistent, normalized data
- Better prompt quality

---

## 💰 Costs

- **Per user onboarding**: ~$0.41 (50 images analyzed + 10 generated)
- **Per image**: $0.04 (Imagen-4 Ultra) or $0.02 (Stable Diffusion)
- **Monthly (100 users, 50 images each)**: ~$250

---

## 📖 Documentation

- **[Quick Start](PODNA_QUICKSTART.md)** - 5-minute guide
- **[Full Documentation](PODNA_AGENT_SYSTEM.md)** - Complete system docs
- **[Architecture Diagrams](PODNA_ARCHITECTURE_DIAGRAM.md)** - Visual architecture
- **[Implementation Details](PODNA_IMPLEMENTATION_SUMMARY.md)** - Technical details

---

## 🛠️ Troubleshooting

### "Cannot connect to database"
```bash
# Check DATABASE_URL in .env
psql $DATABASE_URL -c "SELECT 1"
```

### "Gemini API key not configured"
Add `GEMINI_API_KEY=your_key_here` to `.env`

### "Portfolio must contain at least 50 images"
Your ZIP needs ≥50 valid images (.jpg, .jpeg, .png, .webp)

### "No style profile found"
Run onboarding first: `POST /api/podna/onboard`

---

## 📁 Project Structure

```
src/
├── api/routes/podna.js          # API routes
├── services/
│   ├── ingestionAgent.js        # Agent 1: Upload & processing
│   ├── styleDescriptorAgent.js  # Agent 2 & 3: Vision analysis
│   ├── trendAnalysisAgent.js    # Agent 4: Profile generation
│   ├── promptBuilderAgent.js    # Agent 5: Prompt generation
│   ├── imageGenerationAgent.js  # Agent 6: Image generation
│   └── feedbackLearnerAgent.js  # Agent 7: Feedback processing
database/migrations/
└── 008_podna_agent_system.sql   # Schema migration
tests/
└── test-podna-system.js         # End-to-end test
```

---

## 🎯 Example Usage

### 1. Sign Up
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "securepass"
  }'
```

### 2. Complete Onboarding
```bash
curl -X POST http://localhost:3001/api/podna/onboard \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "portfolio=@portfolio.zip" \
  -F "generateInitial=true" \
  -F "initialCount=10"
```

### 3. Generate More Images
```bash
curl -X POST http://localhost:3001/api/podna/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "exploratory",
    "provider": "imagen-4-ultra"
  }'
```

### 4. Submit Feedback
```bash
curl -X POST http://localhost:3001/api/podna/feedback \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "generationId": "uuid",
    "type": "like",
    "note": "Love this! Make sleeves longer."
  }'
```

---

## 🎨 What You Get

After onboarding with 50+ images, you'll have:

```json
{
  "styleProfile": {
    "summaryText": "Based on 52 images, your style includes sport chic, minimalist tailoring. 41% dresses, navy/cobalt/ivory tones, linen/silk/cotton fabrics.",
    "styleLabels": [
      { "name": "sport chic", "score": 0.82 },
      { "name": "minimalist tailoring", "score": 0.75 }
    ],
    "distributions": {
      "garments": { "dress": 0.41, "blazer": 0.15 },
      "colors": { "navy": 0.20, "blue": 0.15 },
      "fabrics": { "linen": 0.17, "silk": 0.15 }
    }
  },
  "initialGallery": [
    // 10 on-brand generated images
  ]
}
```

---

## 📜 License

ISC

---

## 🙏 Credits

Built with:
- **Gemini 2.5 Flash** (Google) - Vision analysis
- **Imagen-4 Ultra** (Google) - Image generation
- **Stable Diffusion XL** (Stability AI) - Fallback generation
- **PostgreSQL + pgvector** - Database & embeddings
- **Express.js + Node.js** - Backend
- **Cloudflare R2** - Image storage

---

**Your AI design partner is ready!** 🚀✨

For detailed documentation, see the `/docs` folder or run `./setup-podna.sh` to get started.

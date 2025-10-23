# Podna Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Environment Setup
```bash
# Copy example env file
cp .env.example .env

# Edit .env and add your API keys:
# - GEMINI_API_KEY (required)
# - GOOGLE_API_KEY (for Imagen)
# - REPLICATE_API_TOKEN (for Stable Diffusion)
# - DATABASE_URL
```

### Step 2: Run Setup
```bash
./setup-podna.sh
```

This will:
- Install dependencies
- Run database migration
- Set up pgvector extension

### Step 3: Start Server
```bash
npm run dev
```

Server starts on `http://localhost:3001`

---

## 📝 Quick Test

### Test with Sample Portfolio
```bash
# Prepare a ZIP with 50+ fashion images
node test-podna-system.js /path/to/portfolio.zip
```

### Test Without ZIP (Mock Mode)
```bash
node test-podna-system.js
# Will show instructions for testing with real data
```

---

## 🎯 API Endpoints

### Base URL: `http://localhost:3001/api`

### Authentication
```bash
# Sign up
POST /auth/register
{
  "name": "Your Name",
  "email": "you@example.com",
  "password": "password123"
}

# Returns: { token, user }
```

### Onboarding (All-in-One)
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

### View Profile
```bash
GET /podna/profile
Headers: Authorization: Bearer <token>
```

### Generate Image
```bash
POST /podna/generate
Headers: Authorization: Bearer <token>
{
  "mode": "exploratory",  // or "targeted"
  "provider": "imagen-4-ultra",  // or "stable-diffusion"
  "constraints": {
    "garment_type": "dress",  // optional
    "colors": ["blue", "navy"]  // optional
  }
}
```

### View Gallery
```bash
GET /podna/gallery?limit=50
Headers: Authorization: Bearer <token>
```

### Submit Feedback
```bash
POST /podna/feedback
Headers: Authorization: Bearer <token>
{
  "generationId": "uuid",
  "type": "like",  // like, dislike, swipe_left, swipe_right
  "note": "Love this! Make sleeves longer"  // optional
}
```

---

## 💡 How It Works

```
YOU → Upload Portfolio (50+ images)
      ↓
   [Ingestion Agent] Extracts & deduplicates images
      ↓
   [Style Descriptor] Analyzes with Gemini vision
      ↓
   [Trend Analysis] Builds your style profile
      ↓
   YOUR STYLE PROFILE (colors, fabrics, clusters)
      ↓
   [Prompt Builder] Creates smart prompts
      ↓
   [Image Generator] Imagen-4 Ultra / Stable Diffusion
      ↓
   YOUR GALLERY (infinite on-brand images)
      ↓
   You Give Feedback (like/dislike/critique)
      ↓
   [Feedback Learner] Updates your profile
      ↓
   Next images are even better! 🎨
```

---

## 🎨 Example Style Profile

After uploading 52 images, you might get:

```json
{
  "summaryText": "Based on 52 images, your style signature includes sport chic, minimalist tailoring. Your wardrobe is 41% dresses, with a preference for navy, cobalt, ivory tones. You favor linen, silk, cotton fabrics.",
  
  "styleLabels": [
    { "name": "sport chic", "score": 0.82 },
    { "name": "minimalist tailoring", "score": 0.75 }
  ],
  
  "distributions": {
    "garments": {
      "dress": 0.41,
      "blazer": 0.15,
      "pants": 0.12
    },
    "colors": {
      "navy": 0.20,
      "blue": 0.15,
      "ivory": 0.12
    },
    "fabrics": {
      "linen": 0.17,
      "silk": 0.15,
      "cotton": 0.14
    }
  },
  
  "clusters": [
    {
      "name": "dress essentials",
      "weight": 0.41,
      "signature_attributes": {
        "garment_type": "dress",
        "silhouette": "a-line",
        "colors": ["navy", "cobalt"],
        "fabrics": ["linen", "silk"]
      }
    }
  ]
}
```

---

## 🧠 Learning Loop

### When you like an image:
- ✅ Boosts similar attributes (+0.1)
- ✅ Records success in prompt history
- ✅ Future prompts favor these patterns

### When you dislike an image:
- ❌ Reduces those attributes (-0.05)
- ❌ Prompt Builder explores alternatives

### When you critique:
- 💬 "Make this blue" → Gemini parses it
- 🔵 Strongly boosts color=blue (+0.3)
- 🎯 Next image will likely be blue

---

## 📊 Cost Breakdown

### Per User Onboarding (50 images):
- Analysis: **$0.005** (Gemini vision)
- Initial generation (10 images): **$0.40** (Imagen-4 Ultra)
- **Total: ~$0.41**

### Per Image:
- Imagen-4 Ultra: **$0.04**
- Stable Diffusion: **$0.02**
- Upscale (optional): **$0.01**

---

## 🛠️ Troubleshooting

### "Cannot connect to database"
```bash
# Check DATABASE_URL in .env
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

### "Gemini API key not configured"
```bash
# Add to .env
GEMINI_API_KEY=your_key_here
```

### "Portfolio must contain at least 50 images"
Your ZIP needs ≥50 valid images (.jpg, .jpeg, .png, .webp)

### "No style profile found"
Run onboarding first:
```bash
POST /api/podna/onboard
```

---

## 📚 Full Documentation

- **Complete Guide**: [`PODNA_AGENT_SYSTEM.md`](PODNA_AGENT_SYSTEM.md)
- **Implementation Details**: [`PODNA_IMPLEMENTATION_SUMMARY.md`](PODNA_IMPLEMENTATION_SUMMARY.md)
- **Database Schema**: [`database/migrations/008_podna_agent_system.sql`](database/migrations/008_podna_agent_system.sql)

---

## 🎯 Next Steps

1. ✅ Complete onboarding with your portfolio
2. ✅ Generate your first images
3. ✅ Give feedback to improve results
4. 🔄 Iterate and enjoy infinite on-brand images!

---

**Podna** - Your AI design partner 🎨✨

Built with ❤️ using Gemini, Imagen, and smart agent architecture.

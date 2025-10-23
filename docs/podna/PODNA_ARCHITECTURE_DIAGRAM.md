# Podna Agent System Architecture

## Visual System Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PODNA AGENT SYSTEM                                 │
│                     AI-Powered Fashion Design Partner                       │
└─────────────────────────────────────────────────────────────────────────────┘

                                   USER
                                     │
                                     │ Signs Up
                                     ▼
                            ┌────────────────┐
                            │  Registration  │
                            │  /auth/register│
                            └────────┬───────┘
                                     │ Returns JWT Token
                                     │
                            ┌────────▼───────┐
                            │  Onboarding    │
                            │  /podna/onboard│
                            └────────┬───────┘
                                     │ Uploads ZIP (50+ images)
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
        │                            │                            │
┌───────▼────────┐          ┌────────▼────────┐         ┌────────▼─────────┐
│  AGENT 1       │          │    AGENT 2      │         │    AGENT 4       │
│  Ingestion     │──────────│ Style Descriptor│─────────│ Trend Analysis   │
│                │          │                 │         │                  │
│ • Extract ZIP  │          │ • Gemini Vision │         │ • Aggregate      │
│ • Deduplicate  │          │ • Extract attrs │         │ • Distributions  │
│ • Upload R2    │          │ • Normalize     │         │ • Clusters       │
│ • Embeddings   │          │ • Validate      │         │ • Summary        │
└────────┬───────┘          └─────────────────┘         └────────┬─────────┘
         │                                                        │
         │                                                        │
         │                                              ┌─────────▼──────────┐
         │                                              │   STYLE PROFILE    │
         │                                              │                    │
         │                                              │ • Style Labels     │
         │                                              │ • Distributions    │
         │                                              │ • Clusters         │
         │                                              │ • Summary Text     │
         │                                              └─────────┬──────────┘
         │                                                        │
         │                                                        │
         └────────────────────────────────────────────────────────┘
                                     │
                                     │ User wants to generate
                                     ▼
                            ┌────────────────┐
                            │  AGENT 5       │
                            │ Prompt Builder │
                            │                │
                            │ • Read Profile │
                            │ • Bandit (ε=0.1)│
                            │ • Build Prompt │
                            └────────┬───────┘
                                     │
                                     │ Prompt Text + JSON Spec
                                     ▼
                            ┌────────────────┐
                            │  AGENT 6       │
                            │ Image Generator│
                            │                │
                            │ • Imagen-4     │
                            │ • Stable Diff  │
                            │ • Log Cost     │
                            └────────┬───────┘
                                     │
                                     │ Generated Image
                                     ▼
                            ┌────────────────┐
                            │    GALLERY     │
                            │                │
                            │  User Views &  │
                            │  Gives Feedback│
                            └────────┬───────┘
                                     │
                                     │ Like/Dislike/Critique
                                     ▼
                            ┌────────────────┐
                            │  AGENT 7       │
                            │ Feedback Learner│
                            │                │
                            │ • Parse Critique│
                            │ • Generate Δ   │
                            │ • Update Profile│
                            │ • Record History│
                            └────────┬───────┘
                                     │
                                     │ Learning Delta
                                     ▼
                            ┌────────────────┐
                            │ STYLE PROFILE  │
                            │    UPDATED     │
                            └────────────────┘
                                     │
                                     │ Improved for next generation
                                     │
                              ∞ LEARNING LOOP ∞
```

---

## Data Flow Diagram

```
┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ User    │────▶│ ZIP File │────▶│ Images   │────▶│ Analyze  │────▶│ Profile  │
│ Upload  │     │ 50+ imgs │     │ Extract  │     │ Gemini   │     │ Generate │
└─────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
                                        │                                │
                                        ▼                                │
                                 ┌────────────┐                          │
                                 │ PostgreSQL │◀─────────────────────────┘
                                 │            │
                                 │ • portfolios
                                 │ • images
                                 │ • descriptors
                                 │ • profiles
                                 │ • prompts
                                 │ • generations
                                 │ • feedback
                                 └────────────┘
                                        │
                                        ▼
┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Next    │◀────│ Update   │◀────│ Feedback │◀────│ Generate │◀────│ Build    │
│ Gen     │     │ Profile  │     │ Process  │     │ Image    │     │ Prompt   │
│ Better! │     │ Learning │     │ Like/etc │     │ Imagen   │     │ Bandit   │
└─────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
```

---

## Agent Responsibilities

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          AGENT SPECIALIZATIONS                             │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  1️⃣  INGESTION AGENT                                                       │
│     Input:  ZIP file buffer                                               │
│     Output: Portfolio record, image records, embeddings                   │
│     Tech:   AdmZip, crypto, R2 Storage, CLIP                             │
│     Cost:   Free (processing only)                                        │
│                                                                            │
│  2️⃣  STYLE DESCRIPTOR AGENT                                                │
│     Input:  Image URL                                                     │
│     Output: Normalized fashion JSON                                       │
│     Tech:   Gemini 2.5 Flash vision                                      │
│     Cost:   ~$0.0001 per image                                           │
│                                                                            │
│  3️⃣  TREND ANALYSIS AGENT                                                  │
│     Input:  All image descriptors                                         │
│     Output: Style profile (clusters, distributions, summary)              │
│     Tech:   Statistical aggregation                                       │
│     Cost:   Free (computation only)                                       │
│                                                                            │
│  4️⃣  PROMPT BUILDER AGENT                                                  │
│     Input:  Style profile, constraints, history                           │
│     Output: Text prompt + JSON spec                                       │
│     Tech:   Epsilon-greedy bandit (ε=0.1)                                │
│     Cost:   Free (computation only)                                       │
│                                                                            │
│  5️⃣  IMAGE GENERATION AGENT                                                │
│     Input:  Prompt text                                                   │
│     Output: Generated image URL                                           │
│     Tech:   Imagen-4 Ultra / Stable Diffusion                            │
│     Cost:   $0.04 / $0.02 per image                                      │
│                                                                            │
│  6️⃣  FEEDBACK LEARNER AGENT                                                │
│     Input:  Feedback (like/dislike/critique)                              │
│     Output: Learning delta, updated profile                               │
│     Tech:   Gemini (critique parsing), RL updates                        │
│     Cost:   ~$0.0001 per feedback                                        │
│                                                                            │
│  7️⃣  API ORCHESTRATION                                                     │
│     Input:  HTTP requests                                                 │
│     Output: Coordinated agent responses                                   │
│     Tech:   Express.js, JWT auth                                         │
│     Cost:   Free (server only)                                           │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DATABASE TABLES (10)                               │
└─────────────────────────────────────────────────────────────────────────────┘

        users (existing)
          │
          │ 1:N
          ▼
      portfolios ────┐
          │          │
          │ 1:N      │ 1:N
          ▼          ▼
   portfolio_images  style_profiles
          │                 │
          │ 1:1             │ 1:N
          ▼                 ▼
   image_descriptors    prompts
          │                 │
          │ 1:1             │ 1:N
          ▼                 ▼
   image_embeddings    generations
                            │
                            │ 1:N
                            ▼
                        feedback
                            │
                            │ 1:N
                            ▼
                     learning_events
                            │
                            │ N:N
                            ▼
                     prompt_history

Key Relationships:
• User → Portfolios (1:N)
• Portfolio → Images (1:N)
• Image → Descriptor (1:1)
• Image → Embedding (1:1)
• User → StyleProfile (1:1)
• StyleProfile → Prompts (1:N)
• Prompt → Generation (1:N)
• Generation → Feedback (1:N)
• Feedback → LearningEvent (1:N)
• Prompt ↔ PromptHistory (N:N)
```

---

## API Routes Tree

```
/api
├── /auth
│   ├── POST /register          (Sign up)
│   ├── POST /login             (Sign in)
│   └── GET  /profile           (Get user info)
│
└── /podna
    ├── POST /onboard                    (🌟 All-in-one: Upload + Analyze + Profile + Generate)
    │
    ├── POST /upload                     (Upload ZIP only)
    ├── POST /analyze/:portfolioId       (Analyze images)
    ├── POST /profile/generate/:id       (Generate profile)
    │
    ├── GET  /profile                    (View style profile)
    │
    ├── POST /generate                   (Generate single image)
    ├── POST /generate/batch             (Generate multiple images)
    ├── GET  /gallery                    (View generated images)
    │
    ├── POST /feedback                   (Submit feedback)
    └── GET  /feedback                   (View feedback history)

🌟 Recommended: Use /podna/onboard for complete workflow
```

---

## Technology Stack

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TECHNOLOGY LAYERS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────┐    │
│  │                        FRONTEND (Phase 2)                         │    │
│  │  • React / TypeScript                                             │    │
│  │  • Tailwind CSS                                                   │    │
│  │  • shadcn/ui components                                           │    │
│  └───────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    │ REST API                               │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────┐    │
│  │                        API LAYER                                  │    │
│  │  • Express.js                                                     │    │
│  │  • JWT Authentication                                             │    │
│  │  • Multer (file upload)                                           │    │
│  │  • Rate limiting                                                  │    │
│  └───────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────┐    │
│  │                      AGENT SERVICES                               │    │
│  │  • Node.js services                                               │    │
│  │  • Async/await patterns                                           │    │
│  │  • Error handling                                                 │    │
│  │  • Logging (Winston)                                              │    │
│  └───────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│              ┌─────────────────────┼─────────────────────┐                 │
│              │                     │                     │                 │
│              ▼                     ▼                     ▼                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐        │
│  │   AI SERVICES    │  │    DATABASE      │  │    STORAGE       │        │
│  │                  │  │                  │  │                  │        │
│  │ • Gemini 2.5     │  │ • PostgreSQL 14+ │  │ • Cloudflare R2  │        │
│  │ • Imagen-4 Ultra │  │ • pgvector       │  │ • Signed URLs    │        │
│  │ • Stable Diff    │  │ • JSONB          │  │ • CDN            │        │
│  │ • CLIP (future)  │  │ • Indexes        │  │                  │        │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Learning Loop Visualization

```
                    ┌─────────────────────────┐
                    │   User Gives Feedback   │
                    │  Like / Dislike / Note  │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │  Feedback Learner Agent │
                    │                         │
                    │  1. Parse Critique      │
                    │     "make this blue"    │
                    │      ↓                  │
                    │     {color: "blue"}     │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │   Generate Delta        │
                    │                         │
                    │  Like:   +0.1 to attrs  │
                    │  Dislike: -0.05 to attrs│
                    │  Critique: +0.3 to req  │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │   Update Distributions  │
                    │                         │
                    │  colors: {              │
                    │    navy: 0.20 → 0.18    │
                    │    blue: 0.15 → 0.45    │
                    │  }                      │
                    │  ↓ Normalize to 1.0     │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │  Record Prompt History  │
                    │                         │
                    │  was_liked: true        │
                    │  success_score: 1.0     │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │  Next Generation Uses:  │
                    │                         │
                    │  • Updated profile      │
                    │  • Prompt history       │
                    │  • Bandit strategy      │
                    │                         │
                    │  Result: Better images! │
                    └─────────────────────────┘
```

---

## Bandit Strategy (Epsilon-Greedy)

```
                    ┌─────────────────────────┐
                    │  Generate New Prompt    │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │   Random(0-1) < 0.1?    │
                    └──────┬──────────┬───────┘
                           │          │
                    YES    │          │    NO
                    (10%)  │          │    (90%)
                           │          │
              ┌────────────▼──┐   ┌──▼────────────┐
              │  EXPLORATION  │   │ EXPLOITATION  │
              │               │   │               │
              │ • Randomize   │   │ • Use best    │
              │   weights     │   │   patterns    │
              │ • Try new     │   │ • From history│
              │   combinations│   │ • High success│
              │ • Discover    │   │   rate        │
              │   better      │   │               │
              │   patterns    │   │               │
              └───────┬───────┘   └───┬───────────┘
                      │               │
                      └───────┬───────┘
                              │
                  ┌───────────▼─────────────┐
                  │   Generate Image        │
                  │                         │
                  │   User feedback         │
                  │   updates strategy      │
                  └─────────────────────────┘

Benefits:
• 90% Exploitation: Stick with what works
• 10% Exploration: Find better solutions
• Prevents local optima
• Continuous improvement
```

---

## Cost Breakdown

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          COST ANALYSIS                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PER USER ONBOARDING (50 images)                                           │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │  Ingestion                               FREE                │          │
│  │  Vision Analysis (Gemini)     50 × $0.0001 = $0.005         │          │
│  │  Profile Generation                      FREE                │          │
│  │  Initial Images (10)          10 × $0.04  = $0.400          │          │
│  │                                           ─────────          │          │
│  │  TOTAL:                                   ~$0.41             │          │
│  └─────────────────────────────────────────────────────────────┘          │
│                                                                             │
│  PER IMAGE GENERATION                                                       │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │  Imagen-4 Ultra                           $0.04              │          │
│  │  Stable Diffusion XL (fallback)           $0.02              │          │
│  │  Real-ESRGAN Upscale (optional)           $0.01              │          │
│  └─────────────────────────────────────────────────────────────┘          │
│                                                                             │
│  MONTHLY (100 active users, 50 generations/user/month)                     │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │  Analysis            5,000 × $0.0001  = $0.50               │          │
│  │  Generation          5,000 × $0.04    = $200.00             │          │
│  │  Feedback Processing   100 × $0.0001  = $0.01               │          │
│  │  Infrastructure (DB, R2, Redis)        = $50.00             │          │
│  │                                         ─────────            │          │
│  │  TOTAL:                                 ~$250.51/month      │          │
│  └─────────────────────────────────────────────────────────────┘          │
│                                                                             │
│  COST OPTIMIZATION                                                          │
│  • Use Stable Diffusion for bulk: Save 50%                                │
│  • Cache similar prompts: Reduce redundant generation                      │
│  • Batch operations: Lower per-unit cost                                   │
│  • Smart limits: Prevent abuse                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## System Performance

```
OPERATION              TIME        COST       NOTES
─────────────────────────────────────────────────────────────────────────────
User Registration      < 1s        Free       JWT token generation
ZIP Upload (50 imgs)   ~30s        Free       Depends on file size
Image Analysis         ~5min       $0.005     50 × Gemini vision calls
Profile Generation     < 5s        Free       Statistical aggregation
Single Generation      ~15s        $0.04      Imagen-4 Ultra API
Batch Generation (10)  ~2min       $0.40      Parallel processing
Feedback Processing    < 2s        $0.0001    Gemini critique parsing
Profile Update         < 1s        Free       Database update

BOTTLENECKS:
• Image analysis (5min for 50 images)
  → Can be parallelized or made async
• Image generation (15s per image)
  → Can batch or queue

SCALABILITY:
• Database: PostgreSQL handles millions of records
• Storage: R2 unlimited
• API: Rate limited to prevent abuse
• Agents: Stateless, horizontally scalable
```

---

This architecture is **production-ready** and **scalable**! 🚀

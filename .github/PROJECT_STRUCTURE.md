# Project Structure

## 📁 Clean, Organized Directory

```
anatomie-lab/
│
├── 📄 README.md                    # Main documentation (Podna system)
├── 📄 CLEANUP_SUMMARY.md           # Cleanup details
├── 📄 LICENSE                      # ISC License
│
├── ⚙️  Configuration
│   ├── .env.podna.example          # Environment template
│   ├── setup-podna.sh              # Setup script
│   ├── package.json                # Dependencies
│   ├── webpack.config.js           # Build configuration
│   └── nodemon.json                # Dev server config
│
├── 🗂️  Documentation (docs/)
│   └── podna/
│       ├── PODNA_QUICKSTART.md
│       ├── PODNA_AGENT_SYSTEM.md
│       ├── PODNA_ARCHITECTURE_DIAGRAM.md
│       ├── PODNA_IMPLEMENTATION_SUMMARY.md
│       └── PODNA_COMPLETE_SOLUTION.md
│
├── 💻 Source Code (src/)
│   ├── api/routes/
│   │   ├── auth.js              # Authentication
│   │   ├── podna.js            # Podna agent routes
│   │   └── ...other routes
│   ├── services/
│   │   ├── ingestionAgent.js   # Agent 1: ZIP upload
│   │   ├── styleDescriptorAgent.js  # Agent 2 & 3: Vision analysis
│   │   ├── trendAnalysisAgent.js    # Agent 4: Profile generation
│   │   ├── promptBuilderAgent.js    # Agent 5: Prompt builder
│   │   ├── imageGenerationAgent.js  # Agent 6: Image generation
│   │   └── feedbackLearnerAgent.js  # Agent 7: Learning loop
│   ├── models/
│   │   └── User.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── errorHandler.js
│   └── utils/
│       └── logger.js
│
├── 🗄️  Database (database/)
│   ├── schema.sql
│   └── migrations/
│       ├── 003_create_persona_tables.sql
│       ├── 004_create_routing_rlhf_tables.sql
│       ├── 005_create_generation_tables.sql
│       ├── 006_create_validation_tables.sql
│       ├── 007_create_rlhf_feedback_table.sql
│       └── 008_podna_agent_system.sql  ✨ New Podna schema
│
├── ✅ Tests (tests/)
│   ├── test-podna-system.js    # End-to-end Podna test
│   ├── analyticsInsightsService.test.js
│   ├── analyticsService.test.js
│   └── stage8-validation-test.js
│
├── 🎨 Frontend (frontend/)
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── services/
│   ├── public/
│   └── package.json
│
├── 🤖 Agents Service (agents-service/)
│   ├── main.py
│   ├── requirements.txt
│   └── data/
│
├── 🐍 Python ML Service (python-ml-service/)
│   ├── main.py
│   ├── requirements.txt
│   └── services/
│
├── 🛠️  Scripts (scripts/)
│   ├── clear_database.js
│   ├── reset-database.js
│   └── setup_stage9.sh
│
├── 📦 Archive (archive/)
│   ├── old-docs/              # 70+ archived docs
│   └── old-tests/             # 25+ archived tests
│
└── 🔧 Server
    └── server.js               # Main Express server
```

## 🎯 Key Directories

### Source Code (`src/`)
Core backend logic with 7 agent services, API routes, models, and middleware.

### Database (`database/`)
PostgreSQL schema and migrations, including the new Podna agent system.

### Tests (`tests/`)
Test scripts for end-to-end testing and validation.

### Frontend (`frontend/`)
React/TypeScript frontend with Tailwind CSS.

### Documentation (`docs/podna/`)
Complete Podna system documentation organized in one place.

### Archive (`archive/`)
All old documentation and tests preserved but out of the way.

---

## 📖 Quick Reference

**Get Started:**
1. Read [`README.md`](../README.md)
2. Run `./setup-podna.sh`
3. Start with `npm run dev`
4. Test with `node tests/test-podna-system.js`

**Documentation:**
- Quick Start: `docs/podna/PODNA_QUICKSTART.md`
- Full Docs: `docs/podna/PODNA_AGENT_SYSTEM.md`
- Architecture: `docs/podna/PODNA_ARCHITECTURE_DIAGRAM.md`

---

**Clean, organized, and ready to use!** 🚀

# 🗄️ Database Migration Required!

## ❌ Error: "relation 'portfolios' does not exist"

This error means the Podna database tables haven't been created yet.

---

## ✅ Quick Fix

Run this command in your terminal:

```bash
chmod +x run-podna-migration.sh
./run-podna-migration.sh
```

**OR manually:**

```bash
psql -U esosaimafidon -d designer_bff -f database/migrations/008_podna_agent_system.sql
```

---

## 📊 What This Creates

The migration creates **10 tables** for the Podna agent system:

### Core Tables
1. **`portfolios`** - User portfolio uploads
2. **`portfolio_images`** - Individual images from ZIPs
3. **`image_embeddings`** - Vector embeddings (CLIP)
4. **`image_descriptors`** - Fashion attributes extracted by Gemini

### User Profile
5. **`style_profiles`** - Aggregated user style (distributions, labels)

### Generation System
6. **`prompts`** - Generated prompts for image creation
7. **`generations`** - Generated images (Stable Diffusion XL)

### Learning Loop
8. **`feedback`** - User likes/dislikes/critiques
9. **`learning_events`** - Model updates from feedback
10. **`prompt_history`** - Prompt performance tracking

---

## 🧪 Verify Migration

After running the migration, verify with:

```bash
psql -U esosaimafidon -d designer_bff -c "\dt"
```

You should see all the tables listed, including:
- portfolios
- portfolio_images
- image_descriptors
- style_profiles
- prompts
- generations
- feedback
- learning_events

---

## 🚀 Then Test Onboarding

1. **Migration complete** ✅
2. **Refresh browser** (reload the page)
3. **Try onboarding again**
   - Upload portfolio ZIP
   - Should work now!

---

## 📝 What Each Table Does

### Upload Flow
```
User uploads ZIP
    ↓
portfolios (created)
    ↓
portfolio_images (extracted images)
    ↓
image_embeddings (CLIP vectors)
    ↓
image_descriptors (Gemini analysis)
    ↓
style_profiles (aggregated style)
```

### Generation Flow
```
User clicks "Generate"
    ↓
prompts (created from style profile)
    ↓
generations (Stable Diffusion XL images)
    ↓
User gives feedback
    ↓
feedback (stored)
    ↓
learning_events (profile updates)
    ↓
Next generation is better!
```

---

## 🔍 Troubleshooting

### "permission denied"
```bash
# Make script executable
chmod +x run-podna-migration.sh
```

### "database does not exist"
```bash
# Create database first
createdb -U esosaimafidon designer_bff
```

### "role does not exist"
```bash
# Create user
createuser -s esosaimafidon
```

### "extension 'vector' does not exist"
```bash
# Install pgvector extension
# On Mac with Homebrew PostgreSQL:
brew install pgvector

# Or in psql:
psql -U esosaimafidon -d designer_bff -c "CREATE EXTENSION vector;"
```

---

## ✅ Success Indicators

After migration, you should:
1. ✅ See 10+ new tables in database
2. ✅ No errors when uploading portfolio
3. ✅ Ingestion Agent can save to `portfolios` table
4. ✅ Style Descriptor Agent can save to `image_descriptors`
5. ✅ Generation Agent can save to `generations`

---

## 🎉 Ready!

Once migration completes:
- ✅ All Podna tables created
- ✅ pgvector extension enabled
- ✅ Foreign keys set up
- ✅ Indexes created
- ✅ Ready for onboarding!

**Run the migration script and try again!** 🚀

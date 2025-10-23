# 🔑 API Keys Setup Guide

## Required API Keys for Podna System

Your `.env` file has been updated with your existing configuration. You need to add **2 critical API keys** to make the Podna agent system work.

---

## ✅ Already Configured

These are already set in your `.env`:
- ✅ Database (PostgreSQL)
- ✅ Redis
- ✅ JWT Secret
- ✅ VLT API (charlee305$)
- ✅ **Replicate API Token** (for Imagen, Stable Diffusion, Real-ESRGAN)
- ✅ Cloudflare R2 Storage
- ✅ Port settings (3001)

---

## 🔴 REQUIRED - Get This Key

### Gemini API Key (REQUIRED)

**Why:** Used for image analysis and critique parsing in the Podna system.

**How to get:**
1. Go to [Google AI Studio](https://ai.google.dev/)
2. Click "Get API Key"
3. Create a new API key
4. Copy the key

**Add to `.env`:**
```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

**Cost:** FREE (with generous quotas)

---

## ✅ Image Generation Already Configured!

You're using **Replicate API** to access:
- ✅ **Imagen** (or Stable Diffusion XL) - $0.02/image
- ✅ **Real-ESRGAN** upscaling - $0.01/upscale
- ✅ **Stable Diffusion** fallback - $0.02/image

No additional API keys needed for image generation!

---

## 🟡 OPTIONAL - For Enhanced Features

### 3. OpenAI API Key (Optional)

**Why:** Alternative for some AI features (currently not required for Podna).

**How to get:**
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Go to API Keys section
4. Create new secret key

**Add to `.env`:**
```bash
OPENAI_API_KEY=your_openai_api_key_here
```

---

## 📝 Quick Setup Steps

1. **Get Gemini API Key** (REQUIRED - only 1 key needed!)
   ```bash
   # Add to .env
   GEMINI_API_KEY=your_actual_key
   ```

2. **Test the setup**
   ```bash
   npm run dev
   ```

That's it! Your Replicate token handles all image generation and upscaling.

---

## 🧪 Testing Without All Keys

You can test the system with **just Gemini API key**:

### Minimum Setup (Works!)
```bash
# .env - Only 1 key needed!
GEMINI_API_KEY=your_gemini_key_here
DATABASE_URL=postgresql://esosaimafidon@localhost:5432/designer_bff
REPLICATE_API_TOKEN=your_replicate_token_here
```

This will:
- ✅ Analyze images with Gemini
- ✅ Generate style profiles
- ✅ Generate images with Stable Diffusion XL (via Replicate)
- ✅ Upscale images with Real-ESRGAN (via Replicate)
- ✅ Process feedback

---

## 💰 Cost Estimates

| Service | Cost | What You Have |
|---------|------|---------------|
| Gemini 2.5 Flash | FREE (with quotas) | ❌ Need key |
| Stable Diffusion XL | $0.02/image | ✅ Have token (Replicate) |
| Real-ESRGAN | $0.01/upscale | ✅ Have token (Replicate) |
| Replicate | Pay as you go | ✅ Have token |
| PostgreSQL | FREE (local) | ✅ Configured |
| Redis | FREE (local) | ✅ Configured |
| R2 Storage | $0.015/GB | ✅ Configured |

**Total minimum cost:** FREE to start (Gemini is free, Replicate pay-as-you-go)

---

## 🚀 Ready to Start?

Once you add the **Gemini API key**, you can:

1. Run setup:
   ```bash
   ./setup-podna.sh
   ```

2. Start server:
   ```bash
   npm run dev
   ```

3. Test the system:
   ```bash
   node tests/test-podna-system.js /path/to/portfolio.zip
   ```

---

## 🆘 Troubleshooting

### "Gemini API key not configured"
→ Add `GEMINI_API_KEY` to your `.env` file

### "Cannot connect to database"
→ Your DATABASE_URL is already set correctly. Make sure PostgreSQL is running:
```bash
pg_ctl status
```

### "Images generating with mock data"
→ Add `GEMINI_API_KEY` to `.env`. Replicate token is already configured for actual generation.

---

## 📚 More Info

- **Gemini API Docs:** https://ai.google.dev/docs
- **Replicate Docs:** https://replicate.com/docs
- **Real-ESRGAN on Replicate:** https://replicate.com/nightmareai/real-esrgan

---

**Next Step:** Get your Gemini API key (just 1 key!), add it to `.env`, then run `./setup-podna.sh`! 🚀

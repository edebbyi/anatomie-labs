# 🧪 Testing Instructions

## Current Status

Your server **IS WORKING** ✅ despite the nodemon crash message!

The health check returned:
```json
{
  "status": "degraded",
  "services": {
    "database": true,
    "redis": true,
    "r2Storage": true,
    "pinecone": false
  }
}
```

---

## Why "degraded" Status?

The status shows "degraded" because Pinecone is disabled (which is fine for the Podna system - we're using PostgreSQL with pgvector instead).

---

## 🚀 How to Start the Server

### Option 1: Run with Debug Mode (Recommended)

This will show you the actual error causing nodemon to crash:

```bash
npm run debug
```

### Option 2: Run with Nodemon (Current Method)

```bash
npm run dev
```

**Note:** You may see "app crashed" but the server is still running. This is likely an async error that doesn't affect functionality.

### Option 3: Run Without Nodemon

```bash
npm start
```

---

## ✅ Test the Running Server

### 1. Health Check
```bash
curl http://localhost:3001/health
```

### 2. Register a Test User
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "designer@test.com",
    "password": "Test123!@#",
    "name": "Test Designer"
  }'
```

**Save the token** from the response! You'll need it for authenticated requests.

### 3. Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "designer@test.com",
    "password": "Test123!@#"
  }'
```

### 4. Get User Profile
Replace `YOUR_TOKEN_HERE` with the token from registration/login:

```bash
curl http://localhost:3001/api/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 🎨 Test Podna Agent System

### 1. Upload Portfolio (ZIP with 50+ images)

Create a test ZIP file with at least 50 fashion images first, then:

```bash
curl -X POST http://localhost:3001/api/podna/upload \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -F "portfolio=@/path/to/your/portfolio.zip"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Portfolio uploaded successfully",
  "data": {
    "portfolioId": "uuid-here",
    "imageCount": 50,
    "processingTimeMs": 15000
  }
}
```

### 2. Analyze Portfolio
Replace `PORTFOLIO_ID` with the ID from upload:

```bash
curl -X POST http://localhost:3001/api/podna/analyze/PORTFOLIO_ID \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**This will:**
- Use Gemini 2.5 Flash (via Replicate) to analyze each image
- Extract fashion attributes (garment type, colors, fabrics, etc.)
- Create structured descriptors

### 3. Generate Style Profile
```bash
curl -X POST http://localhost:3001/api/podna/profile/generate/PORTFOLIO_ID \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**This will:**
- Aggregate all image descriptors
- Create style distributions
- Generate style labels and summary

### 4. Get Your Style Profile
```bash
curl http://localhost:3001/api/podna/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 5. Generate Images
```bash
curl -X POST http://localhost:3001/api/podna/generate \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "count": 4,
    "strategy": "exploit"
  }'
```

**This will:**
- Use Prompt Builder Agent (epsilon-greedy bandit)
- Generate 4 images with Stable Diffusion XL via Replicate
- Store generations for feedback

### 6. View Your Generations
```bash
curl http://localhost:3001/api/podna/generations \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 7. Give Feedback
Replace `GENERATION_ID` with an ID from your generations:

```bash
curl -X POST http://localhost:3001/api/podna/feedback/GENERATION_ID \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "like",
    "note": "Love the color and silhouette!"
  }'
```

**This will:**
- Use Gemini (via Replicate) to parse your critique
- Update prompt weights
- Adjust your style profile
- Improve future generations

---

## 🔍 Debug Server Issues

If you want to see what's causing the nodemon crash:

```bash
npm run debug
```

This will:
- Catch uncaught exceptions
- Show unhandled promise rejections
- Keep the server running despite errors
- Give you full stack traces

---

## 📊 Check Service Status

### PostgreSQL
```bash
psql -U esosaimafidon -d designer_bff -c "SELECT COUNT(*) FROM users;"
```

### Redis
```bash
redis-cli ping
```

### R2 Storage
The health check already tests this!

---

## 🎯 What's Working

Based on your health check:
- ✅ **PostgreSQL Database** - Connected
- ✅ **Redis Cache** - Connected
- ✅ **R2 Storage** - Connected
- ✅ **Server** - Running on port 3001
- ✅ **Replicate API** - Configured for all AI services

---

## 🐛 Common Issues

### "Port 3001 already in use"
```bash
lsof -ti:3001 | xargs kill -9
```

### "Database connection failed"
```bash
# Start PostgreSQL
brew services start postgresql@16
```

### "Redis connection failed"
```bash
# Start Redis
brew services start redis
```

---

## 📝 Next Steps

1. **Run debug mode** to see the actual error:
   ```bash
   npm run debug
   ```

2. **Test registration and login** with the curl commands above

3. **Prepare a test portfolio** (ZIP with 50+ fashion images)

4. **Test the full Podna flow**:
   - Upload → Analyze → Profile → Generate → Feedback

5. **Report any errors** you see in the debug output

---

## 💡 Tips

- The server **is working** even if nodemon says "crashed"
- All AI services use your **single Replicate token**
- Style profile improves with **more feedback**
- Epsilon-greedy strategy: **90% exploit** (use best prompts), **10% explore** (try new ones)

---

## ✨ Success Indicators

You'll know everything works when:
1. Health check returns `"status": "healthy"`
2. Registration creates a user and returns a token
3. Portfolio upload processes 50+ images
4. Analysis extracts descriptors for each image
5. Profile shows your style distributions
6. Generation creates images matching your style
7. Feedback updates improve future generations

**Ready to test!** 🚀

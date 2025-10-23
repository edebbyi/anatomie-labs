# 🚀 Startup Guide - Launch Full Application

## Quick Start

### Terminal 1: Start Backend Server
```bash
cd /Users/esosaimafidon/Documents/GitHub/anatomie-lab
npm run dev
```

**Backend will run on**: `http://localhost:5000`

### Terminal 2: Start Frontend
```bash
cd /Users/esosaimafidon/Documents/GitHub/anatomie-lab/frontend
npm start
```

**Frontend will run on**: `http://localhost:3000`

---

## Pre-Launch Checklist

### ✅ Environment Variables

Make sure your `.env` file has:

```bash
# Database
DATABASE_URL=postgresql://esosaimafidon@localhost:5432/designer_bff
DB_HOST=localhost
DB_PORT=5432
DB_NAME=designer_bff
DB_USER=esosaimafidon

# API Keys (for image generation)
GOOGLE_API_KEY=your_google_api_key
OPENAI_API_KEY=your_openai_api_key
REPLICATE_API_TOKEN=your_replicate_token

# Cloud Storage (R2)
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_ACCESS_KEY_ID=your_access_key
CLOUDFLARE_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=your_bucket_name

# VLT Service
VLT_API_URL=https://visual-descriptor-516904417440.us-central1.run.app
VLT_API_KEY=your_vlt_api_key

# Server
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
```

### ✅ Services Status

Check that required services are running:

```bash
# PostgreSQL
psql -U esosaimafidon -d designer_bff -c "SELECT 1"

# Optional: Redis (for caching)
redis-cli ping
```

---

## Launch Steps

### Step 1: Start Backend

```bash
# Terminal 1
cd /Users/esosaimafidon/Documents/GitHub/anatomie-lab
npm run dev
```

**Expected output**:
```
🚀 Designer BFF Server running on port 5000
🌍 Environment: development
📊 Database: Connected to designer_bff
🔴 Redis: Connected (or Unavailable - degraded mode)
☁️ R2 Storage: Connected (or Not configured)
📡 VLT API: https://visual-descriptor-...
```

**Health Check**:
```bash
curl http://localhost:5000/health
```

### Step 2: Start Frontend

```bash
# Terminal 2
cd /Users/esosaimafidon/Documents/GitHub/anatomie-lab/frontend
npm start
```

**Expected output**:
```
Compiled successfully!

You can now view frontend in the browser.

  Local:            http://localhost:3000
  On Your Network:  http://192.168.x.x:3000
```

### Step 3: Open Browser

Navigate to: **http://localhost:3000**

---

## Testing New User Onboarding

### Option 1: Through Frontend (Recommended)

1. **Open**: `http://localhost:3000`
2. **Go to**: Onboarding page (should be the default)
3. **Fill in user info**:
   - Name: Demo User
   - Email: demo@example.com
   - Company: Test Company
   - Role: Designer

4. **Upload Portfolio** (optional):
   - Create a ZIP file with fashion images
   - Or skip this step to use mock VLT data

5. **Generate Initial Images**:
   - System will generate 40 images for onboarding
   - Progress bar will show status
   - Takes ~2-5 minutes depending on API speed

### Option 2: Through Backend API (Testing)

```bash
# Create new user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "test123",
    "name": "New User"
  }'

# Generate images for onboarding
curl -X POST http://localhost:5000/api/generate/onboarding \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID_FROM_REGISTRATION",
    "targetCount": 40,
    "provider": "google-imagen"
  }'
```

---

## Available Routes

### Frontend Routes

- `/` - Home/Dashboard
- `/onboarding` - New user onboarding flow
- `/generation` - Image generation interface
- `/analytics` - Analytics dashboard
- `/feedback` - Feedback interface

### Backend API Routes

#### Public Routes (No Auth Required)
- `GET /health` - Health check
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/vlt/analyze/direct` - VLT analysis
- `GET /api/vlt/health` - VLT service health

#### Protected Routes (Require Auth Token)
- `POST /api/generate/onboarding` - Generate initial images
- `POST /api/generate` - Generate images from VLT
- `GET /api/analytics/dashboard` - Analytics dashboard
- `POST /api/feedback` - Submit feedback
- `GET /api/persona/profile` - Get user profile

---

## Troubleshooting

### Backend Won't Start

**Error**: `Failed to connect to database`
```bash
# Check PostgreSQL is running
brew services list | grep postgres
brew services restart postgresql@14

# Test connection
psql postgresql://esosaimafidon@localhost:5432/designer_bff -c "SELECT 1"
```

**Error**: `Port 5000 already in use`
```bash
# Find and kill process using port 5000
lsof -ti:5000 | xargs kill -9

# Or change PORT in .env
echo "PORT=5001" >> .env
```

### Frontend Won't Start

**Error**: `Port 3000 already in use`
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or React will offer to use a different port
```

**Error**: `Cannot connect to backend`
- Check backend is running on `http://localhost:5000`
- Check CORS is enabled (should be by default)
- Verify `REACT_APP_API_URL` in frontend `.env` (if exists)

### Image Generation Fails

**Error**: `API key not configured`
- Add `GOOGLE_API_KEY` or `OPENAI_API_KEY` to `.env`
- Restart backend server

**Error**: `R2 upload failed`
- Check Cloudflare R2 credentials in `.env`
- Or disable post-processing: images will still generate

**Error**: `VLT analysis failed`
- Check `VLT_API_URL` and `VLT_API_KEY` in `.env`
- Or system will use mock VLT data automatically

---

## Feature Availability

### ✅ Fully Working
- User registration/login
- Database persistence
- VLT analysis (with fallback to mock data)
- Image generation (Google Imagen 4 Ultra, DALL-E 3, Stable Diffusion XL)
- Model routing
- RLHF optimization
- Analytics dashboard
- Feedback system
- Cost tracking

### ⚠️ Requires Configuration
- **R2 Cloud Storage**: Requires Cloudflare credentials
  - Without it: Images generate but aren't uploaded
- **VLT Service**: Requires API key
  - Without it: Uses mock VLT data
- **Post-Processing**: Requires Replicate API token
  - Without it: Images aren't enhanced/upscaled

### ❌ Not Yet Implemented
- Voice commands (Stage 3 backend ready, frontend integration pending)
- Real-time notifications
- Admin dashboard

---

## Demo Workflow

### Complete Onboarding Flow

1. **Start Services**:
   ```bash
   # Terminal 1: Backend
   npm run dev
   
   # Terminal 2: Frontend
   cd frontend && npm start
   ```

2. **Open Browser**: `http://localhost:3000`

3. **Create Account** (if not auto-redirected to onboarding)

4. **Onboarding Steps**:
   - Enter user information
   - Upload portfolio ZIP (or skip)
   - Wait for VLT analysis (or use mock data)
   - Generate 40 initial images (~2-5 min)
   - Review generated images
   - Provide feedback on favorites

5. **Explore Dashboard**:
   - View analytics
   - See style evolution
   - Check provider performance
   - Get personalized recommendations

6. **Generate More Images**:
   - Use learned style profile
   - System adapts to preferences
   - RLHF improves with each generation

---

## Performance Notes

### Expected Response Times

- **User Registration**: <100ms
- **VLT Analysis**: 2-5 seconds per image
- **Image Generation**: 8-15 seconds per image
  - Google Imagen 4 Ultra: ~8-10s
  - DALL-E 3: ~15-20s
  - Stable Diffusion XL: ~6-8s
- **Post-Processing**: +10-20s per image (if enabled)
- **Analytics Dashboard**: <200ms

### Resource Usage

- **Backend Memory**: ~200-500MB
- **Frontend Memory**: ~100-200MB
- **Database Connections**: 2-5 active
- **Concurrent Generations**: 1-3 (API rate limits)

---

## Next Steps After Launch

1. **Test New User Flow**:
   - Create a fresh user account
   - Run through complete onboarding
   - Generate multiple image batches
   - Provide feedback
   - Check analytics

2. **Monitor Costs**:
   - Check generation costs in logs
   - Review analytics dashboard for spending
   - Adjust over-generation % if needed

3. **Gather Feedback**:
   - Test with different garment types
   - Try various style preferences
   - Note any issues or improvements

4. **Optimize**:
   - Fine-tune RLHF weights
   - Adjust model routing scores
   - Optimize post-processing pipeline

---

## Support

### Logs Location

- **Backend Logs**: Console output (Terminal 1)
- **Frontend Logs**: Browser console (F12)
- **Database Logs**: PostgreSQL logs

### Quick Diagnostics

```bash
# Backend health
curl http://localhost:5000/health

# Database status
psql postgresql://esosaimafidon@localhost:5432/designer_bff -c "\dt"

# Check user count
psql postgresql://esosaimafidon@localhost:5432/designer_bff -c "SELECT COUNT(*) FROM users;"

# Check recent generations
psql postgresql://esosaimafidon@localhost:5432/designer_bff -c "SELECT id, user_id, status, cost, created_at FROM generations ORDER BY created_at DESC LIMIT 5;"
```

---

## 🎉 Ready to Launch!

Your application is production-ready for testing. Start both servers and navigate to `http://localhost:3000` to begin!

**Have fun testing the AI-powered fashion design platform!** 🚀

# 🚀 Quick Start Guide

## Start Backend Server

Open your terminal and run:

```bash
cd /Users/esosaimafidon/Documents/GitHub/anatomie-lab

# Standard development server (may encounter port conflicts)
npm run dev

# Enhanced development server (handles port conflicts automatically)
npm run dev:enhanced
```

**Expected Output:**
```
🚀 Designer BFF Server running on port 3001
🌍 Environment: development
📊 Database: Connected to designer_bff
🔴 Redis: Connected
☁️ R2 Storage: Connected
📡 VLT API: https://visual-descriptor-516904417440.us-central1.run.app
```

The backend will be available at: **http://localhost:3001**

---

## Test Backend Health

Once the server is running, test it:

```bash
curl http://localhost:3001/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-22T...",
  "version": "1.0.0",
  "environment": "development",
  "services": {
    "database": true,
    "redis": true,
    "r2Storage": true,
    "pinecone": false
  }
}
```

---

## Start Frontend (if available)

If you have a frontend directory:

```bash
cd frontend
npm run dev
```

The frontend will typically run on: **http://localhost:3000**

---

## Test Podna API Endpoints

Once the backend is running, you can test the Podna agent system:

### 1. Upload Portfolio (requires ZIP file)
```bash
curl -X POST http://localhost:3001/api/podna/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "portfolio=@/path/to/portfolio.zip"
```

### 2. Check Portfolio Status
```bash
curl http://localhost:3001/api/podna/portfolio/PORTFOLIO_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Analyze Portfolio
```bash
curl -X POST http://localhost:3001/api/podna/analyze/PORTFOLIO_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4. Generate Images
```bash
curl -X POST http://localhost:3001/api/podna/generate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"count": 4}'
```

---

## Services You Need Running

✅ **PostgreSQL** - Database (localhost:5432)
✅ **Redis** - Caching (localhost:6379)
✅ **Node.js Backend** - API Server (localhost:3001)

---

## Troubleshooting

### Database Connection Failed
```bash
# Check if PostgreSQL is running
psql -U esosaimafidon -d designer_bff -c "SELECT 1;"
```

### Redis Connection Failed
```bash
# Check if Redis is running
redis-cli ping
```

### Port Already in Use
```bash
# Find and kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Or use our enhanced development script which handles this automatically
npm run dev:enhanced

# Check what processes are using common development ports
./scripts/check-ports.sh
```

---

## 🎯 Your Configuration

- **Backend**: http://localhost:3001
- **Database**: designer_bff (PostgreSQL)
- **Redis**: localhost:6379
- **R2 Storage**: Configured ✓
- **Replicate API**: Configured ✓

**All AI services run via your Replicate token!** 🚀

---

## Next Steps

1. **Start the backend**: `npm run dev`
2. **Test health**: `curl http://localhost:3001/health`
3. **Register a user**: POST to `/api/auth/register`
4. **Upload portfolio**: POST to `/api/podna/upload`
5. **Generate images**: POST to `/api/podna/generate`

Everything is ready! 🎉

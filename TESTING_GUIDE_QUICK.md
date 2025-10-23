# 🧪 Quick Testing Guide

## 🚀 Start the System

### Option 1: Automated Start (Recommended)
```bash
./start-test.sh
```

This will:
- ✅ Check database and Redis connections
- ✅ Start backend on `http://localhost:3001`
- ✅ Start frontend on `http://localhost:3000`
- ✅ Show you all URLs and logs

### Option 2: Manual Start

**Terminal 1 - Backend:**
```bash
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

---

## 🛑 Stop the System

```bash
./stop-servers.sh
```

Or press `Ctrl+C` in both terminals.

---

## ✅ Test the Backend API

### 1. Health Check
```bash
curl http://localhost:3001/health
```

**Expected response:**
```json
{
  "status": "healthy" or "degraded",
  "services": {
    "database": true,
    "redis": true,
    "r2Storage": true
  }
}
```

### 2. Register a User
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "test123456"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "token": "eyJhbGc..."
  }
}
```

### 3. Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123456"
  }'
```

### 4. Get Profile (with token)
```bash
curl http://localhost:3001/api/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 🎨 Test the Frontend

### 1. Open in Browser
```
http://localhost:3000
```

### 2. Test Registration Flow
1. Go to `/signup`
2. Fill in name, email, password
3. Click "Sign Up"
4. Should redirect to `/onboarding`

### 3. Test Onboarding (if you have Gemini API key)
1. Upload a ZIP with 50+ fashion images
2. Watch progress as system analyzes images
3. View your generated style profile
4. See initial generated images

### 4. Test Gallery
1. Go to `/gallery` or home page
2. View generated images
3. Click an image to see lightbox
4. Like/dislike images
5. Add critiques ("make this blue")

---

## 📊 View Logs

**Backend logs:**
```bash
tail -f backend.log
```

**Frontend logs:**
```bash
tail -f frontend.log
```

**Real-time server output:**
```bash
# If using manual start, check the terminal windows
```

---

## 🧪 End-to-End Test

Run the automated test:
```bash
node tests/test-podna-system.js /path/to/portfolio.zip
```

**Note:** This requires:
- ✅ Gemini API key configured
- ✅ A ZIP file with 50+ images
- ✅ Backend running

---

## ⚠️ Troubleshooting

### Backend won't start

**Check port 3001:**
```bash
lsof -i :3001
```

**Kill process if needed:**
```bash
kill -9 $(lsof -ti:3001)
```

**Check logs:**
```bash
cat backend.log
```

### Frontend won't start

**Check port 3000:**
```bash
lsof -i :3000
```

**Kill and restart:**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm start
```

### Database errors

**Check PostgreSQL is running:**
```bash
pg_ctl status
```

**Test connection:**
```bash
psql postgresql://esosaimafidon@localhost:5432/designer_bff -c "SELECT 1"
```

### Redis errors

**Check Redis is running:**
```bash
redis-cli ping
```

**Start Redis:**
```bash
brew services start redis
```

### API returns 404

**Check routes are loaded:**
```bash
grep "podna" backend.log
```

Should see: `Podna routes loaded`

---

## 🎯 Quick Test Checklist

- [ ] Backend starts on port 3001
- [ ] Frontend starts on port 3000
- [ ] Health endpoint returns 200
- [ ] Can register new user
- [ ] Can login
- [ ] Can access protected routes with token
- [ ] Frontend loads without errors
- [ ] Can navigate between pages
- [ ] Signup form works
- [ ] Login form works

---

## 📖 API Endpoints Reference

### Public Endpoints
- `GET /health` - System health check
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Protected Endpoints (require Bearer token)
- `GET /api/auth/profile` - Get user profile
- `POST /api/podna/onboard` - Complete onboarding
- `POST /api/podna/generate` - Generate image
- `GET /api/podna/gallery` - View gallery
- `POST /api/podna/feedback` - Submit feedback
- `GET /api/podna/profile` - Get style profile

---

## 🔑 Testing Without Gemini API Key

You can test basic functionality:
- ✅ User registration/login
- ✅ Frontend navigation
- ✅ UI components
- ⚠️ Image analysis (will show warning)
- ⚠️ Style profile generation (limited)
- ✅ Image generation (uses Replicate/Stable Diffusion)

---

## 🎉 Success Indicators

**Backend is ready when you see:**
```
🚀 Designer BFF Server running on port 3001
📊 Database: Connected
🔴 Redis: Connected
☁️ R2 Storage: Connected
```

**Frontend is ready when you see:**
```
webpack compiled successfully
Compiled successfully!
```

**Open:** http://localhost:3000

---

## 📞 Need Help?

- Check `backend.log` for server errors
- Check `frontend.log` for React errors
- See [README.md](README.md) for full documentation
- See [SETUP_READY.md](SETUP_READY.md) for configuration

---

**Happy Testing!** 🎨✨

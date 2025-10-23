# 🎯 Quick Start - Frontend Testing

## 🚀 Start Everything (Easiest!)

### Option 1: Automated Startup (Recommended)
```bash
chmod +x start-full-stack.sh
./start-full-stack.sh
```

This will:
- ✅ Start backend on port 3001
- ✅ Start frontend on port 3000
- ✅ Check health
- ✅ Open browser automatically
- ✅ Save logs to `logs/` directory

---

### Option 2: Manual Startup

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

## 🛑 Stop Everything

```bash
chmod +x stop-all-servers.sh
./stop-all-servers.sh
```

Or manually:
```bash
# Kill backend
lsof -ti:3001 | xargs kill -9

# Kill frontend
lsof -ti:3000 | xargs kill -9
```

---

## 🧪 Test the Frontend

### 1. Open Browser
Go to: **http://localhost:3000**

### 2. Sign Up
- **URL:** http://localhost:3000/signup
- **Enter:**
  - Name: Your name
  - Email: your@email.com
  - Password: Test123!@#

### 3. Upload Portfolio
- **Auto-redirects to:** `/onboarding`
- **Upload:** ZIP file with 50+ fashion images
- **Wait:** Processing takes 2-5 minutes
- **See:** Progress indicator

### 4. Explore Your Style
- **Home:** `/home` - View generated images
- **Generate:** `/generate` - Create new images
- **Profile:** `/style-profile` - View style analysis

---

## 📊 What You'll See

### After Signup:
- ✅ Auth token saved
- ✅ Redirect to onboarding
- ✅ Upload interface

### After Portfolio Upload:
- ✅ Ingestion Agent processes ZIP
- ✅ Style Descriptor Agent analyzes images (Gemini via Replicate)
- ✅ Trend Analysis Agent creates style profile
- ✅ Redirect to home dashboard

### On Home Page:
- ✅ Your portfolio summary
- ✅ Style tags
- ✅ Generate button
- ✅ Navigation menu

### On Generate Page:
- ✅ Number selector (1-50 images)
- ✅ Strategy selector (Exploit/Explore)
- ✅ Generate button
- ✅ Loading state
- ✅ Results display

### On Style Profile Page:
- ✅ Style labels & tags
- ✅ Color distribution chart
- ✅ Garment type distribution
- ✅ Fabric preferences
- ✅ Style description

---

## 🔧 Troubleshooting

### Frontend won't start
```bash
cd frontend
npm install
npm start
```

### Backend connection error
Check backend is running:
```bash
curl http://localhost:3001/health
```

### CORS errors
Already configured! Should work automatically.

### Port already in use
```bash
# Change frontend port
cd frontend
PORT=3002 npm start
```

---

## 📝 Key URLs

- **Frontend:** http://localhost:3000
- **Backend:** http://localhost:3001
- **Health Check:** http://localhost:3001/health
- **API Docs:** See `TESTING_INSTRUCTIONS.md`

---

## 🎨 Pages to Test

| Page | URL | What it Does |
|------|-----|--------------|
| **Signup** | `/signup` | Register new account |
| **Login** | `/login` | Login to account |
| **Onboarding** | `/onboarding` | Upload portfolio ZIP |
| **Home** | `/home` | Dashboard & gallery |
| **Generate** | `/generate` | Create new images |
| **Style Profile** | `/style-profile` | View style analysis |
| **Settings** | `/settings` | Account settings |

---

## ✨ Features to Test

### 1. User Registration
- [x] Sign up with email/password
- [x] Receive auth token
- [x] Auto-redirect to onboarding

### 2. Portfolio Upload
- [x] Upload ZIP (50+ images)
- [x] See upload progress
- [x] Processing status updates
- [x] Error handling (invalid ZIP, too few images)

### 3. Style Analysis
- [x] View extracted style tags
- [x] See color distribution
- [x] Check garment preferences
- [x] Read style description

### 4. Image Generation
- [x] Select number of images
- [x] Choose strategy (exploit/explore)
- [x] See loading state
- [x] View generated images

### 5. Feedback Loop
- [x] Like/dislike images
- [x] Add text critiques
- [x] See updated style profile
- [x] Notice improved generations

---

## 💡 Pro Tips

1. **Keep Chrome DevTools open** (F12)
   - Watch Network tab for API calls
   - Check Console for errors

2. **Monitor both terminals**
   - Backend logs show Replicate API calls
   - Frontend logs show React errors

3. **First generation is slow**
   - Stable Diffusion XL takes ~30-60 seconds per image
   - Real-ESRGAN upscaling adds ~10 seconds

4. **Give meaningful feedback**
   - "I prefer brighter colors and longer sleeves"
   - System parses with Gemini and improves

5. **Explore mode discovers new styles**
   - 90% exploit = use best prompts
   - 10% explore = try new combinations

---

## 🎉 You're Ready!

**Just run:**
```bash
./start-full-stack.sh
```

**Then test:**
1. ✅ Sign up
2. ✅ Upload portfolio
3. ✅ View style profile
4. ✅ Generate images
5. ✅ Give feedback
6. ✅ Generate again (see improvements!)

**Everything works via your single Replicate token!** 🚀

---

## 📚 Full Documentation

- **`START_FRONTEND.md`** - Detailed frontend guide
- **`TESTING_INSTRUCTIONS.md`** - Complete API testing
- **`SYSTEM_STATUS.md`** - System status & health
- **`frontend/README.md`** - Frontend-specific docs

**Happy testing!** 🎨✨

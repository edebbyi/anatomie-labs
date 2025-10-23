# 🎨 Frontend Testing Guide

## 🚀 Quick Start

### Step 1: Start the Backend
Open a terminal and run:
```bash
cd /Users/esosaimafidon/Documents/GitHub/anatomie-lab
npm run dev
```

**Keep this terminal running!** The backend should be on **http://localhost:3001**

---

### Step 2: Start the Frontend
Open a **NEW terminal** and run:
```bash
cd /Users/esosaimafidon/Documents/GitHub/anatomie-lab/frontend
npm start
```

The frontend will automatically open in your browser at **http://localhost:3000**

---

## 📱 Available Pages

Your frontend has these pages ready:

### 🔐 Authentication (No login required)
- **`/signup`** - Register a new account
- **`/login`** - Login to existing account

### 🎯 Onboarding (After signup)
- **`/onboarding`** - Upload portfolio ZIP (50+ images)

### 🏠 Main App (After onboarding)
- **`/home`** - Dashboard with your generated images
- **`/generate`** - Generate new images
- **`/style-profile`** - View your style analysis
- **`/settings`** - Account settings

### 📊 Advanced (Accessible from settings)
- **`/analytics`** - Generation analytics
- **`/coverage`** - Style coverage analysis
- **`/feedback`** - Feedback management

---

## 🧪 Testing Workflow

### Test 1: Registration & Signup ✅

1. **Go to** http://localhost:3000/signup
2. **Fill in:**
   - Name: "Test Designer"
   - Email: "test@example.com"
   - Password: "Test123!@#"
3. **Click** "Sign Up"
4. **Expected:** Redirect to `/onboarding` with auth token saved

### Test 2: Onboarding - Portfolio Upload ✅

1. **Should automatically be on** `/onboarding`
2. **Prepare a ZIP file** with 50+ fashion images
3. **Click** "Upload Portfolio" or drag & drop
4. **Expected:**
   - Upload progress bar
   - Processing message
   - Redirect to `/home` when complete

### Test 3: Home - View Generated Images ✅

1. **Should see:**
   - Your generated images in a grid/masonry layout
   - Prompt information for each image
   - Like/Dislike/Swipe actions
   - Filter options

### Test 4: Generate - Create New Images ✅

1. **Go to** `/generate`
2. **Options:**
   - Number of images (1-50)
   - Strategy: Exploit (use best prompts) or Explore (try new)
3. **Click** "Generate"
4. **Expected:**
   - Loading state
   - Images appear when ready
   - Stored in your gallery

### Test 5: Style Profile - View Analysis ✅

1. **Go to** `/style-profile`
2. **Should see:**
   - Your style tags (e.g., "minimalist", "tailored", "monochrome")
   - Color distribution chart
   - Garment type distribution
   - Fabric/silhouette preferences
   - Style description summary

### Test 6: Feedback - Improve Generations ✅

1. **On any generated image:**
   - Click ❤️ (Like) - Boosts this style
   - Click 👎 (Dislike) - Reduces this style
   - Add text critique: "I prefer longer sleeves and brighter colors"
2. **Expected:**
   - Feedback saved
   - Style profile updated
   - Future generations improve

---

## 🔧 Configuration

### Backend API URL
The frontend is configured to connect to:
```
REACT_APP_API_URL=http://localhost:3001/api
```

### Feature Flags
All Podna features are enabled:
```
REACT_APP_USE_AGENTS=true
REACT_APP_ENABLE_PORTFOLIO_ANALYSIS=true
REACT_APP_ENABLE_PERSONALIZED_GENERATION=true
REACT_APP_ENABLE_FEEDBACK_LEARNING=true
```

---

## 🐛 Troubleshooting

### "Cannot connect to backend"
**Check:**
1. Backend is running on port 3001
   ```bash
   curl http://localhost:3001/health
   ```
2. CORS is enabled (already configured in server.js)

### "Port 3000 already in use"
**Fix:**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or change frontend port
PORT=3002 npm start
```

### "Module not found" errors
**Fix:**
```bash
cd frontend
npm install
```

### Pages not loading
**Check:**
1. React Dev Server is running (should see "Compiled successfully!")
2. Browser console for errors (F12)
3. Network tab shows API calls to localhost:3001

---

## 📊 What Each Page Does

### Signup Page (`/signup`)
- Calls: `POST /api/auth/register`
- Saves JWT token to localStorage
- Redirects to `/onboarding`

### Onboarding Page (`/onboarding`)
- Calls: `POST /api/podna/upload` (portfolio ZIP)
- Calls: `POST /api/podna/analyze/:portfolioId`
- Calls: `POST /api/podna/profile/generate/:portfolioId`
- Redirects to `/home` when complete

### Home Page (`/home`)
- Calls: `GET /api/podna/generations` (your images)
- Calls: `GET /api/podna/profile` (your style)
- Shows generated images in prompt-centric layout

### Generate Page (`/generate`)
- Calls: `POST /api/podna/generate` with count & strategy
- Uses Prompt Builder Agent (epsilon-greedy)
- Generates images with Stable Diffusion XL via Replicate

### Style Profile Page (`/style-profile`)
- Calls: `GET /api/podna/profile`
- Shows:
  - Style labels & tags
  - Color distribution (pie chart)
  - Garment types (bar chart)
  - Fabric preferences
  - Style summary

### Feedback Flow
- User clicks Like/Dislike on image
- Calls: `POST /api/podna/feedback/:generationId`
- Feedback Learner Agent:
  - Uses Gemini (via Replicate) to parse critique
  - Updates prompt weights
  - Adjusts style profile
  - Improves future generations

---

## 🎯 Testing the Full Flow

### Complete End-to-End Test:

1. **Start Backend** (Terminal 1)
   ```bash
   npm run dev
   ```

2. **Start Frontend** (Terminal 2)
   ```bash
   cd frontend && npm start
   ```

3. **Register** at http://localhost:3000/signup

4. **Upload Portfolio** (50+ images in ZIP)

5. **Wait for Analysis** (uses Gemini via Replicate)

6. **View Home** - See your portfolio summary

7. **View Style Profile** - See extracted style

8. **Generate Images** - Create 4 new designs

9. **Give Feedback** - Like/dislike and add critiques

10. **Generate Again** - See improved results!

---

## ✨ Expected Behavior

### On First Load:
- Redirects to `/signup` (no token)
- Clean signup form

### After Signup:
- Redirects to `/onboarding`
- Token saved in localStorage
- Auth header added to API calls

### During Onboarding:
- Upload progress indicator
- Processing status (Ingestion → Analysis → Profile)
- Time estimate (varies by portfolio size)

### In Main App:
- Protected routes (needs auth token)
- Navigation between pages
- Real-time updates
- Responsive design (mobile & desktop)

---

## 🔑 Auth Flow

```
User enters credentials
    ↓
POST /api/auth/register or /login
    ↓
Receives JWT token
    ↓
Saves to localStorage
    ↓
Adds to all API requests: Authorization: Bearer {token}
    ↓
Backend validates token with authMiddleware
    ↓
Requests proceed
```

---

## 📝 Developer Notes

### Tech Stack:
- **React 19** with TypeScript
- **React Router v7** for navigation
- **Tailwind CSS** for styling
- **Axios** for API calls
- **Recharts** for data visualization
- **Lucide React** for icons

### State Management:
- localStorage for auth token
- Component state for UI
- API calls for data

### API Service:
Check `frontend/src/services/` for API utilities

---

## 🎉 You're Ready!

Just run these commands in **two separate terminals**:

**Terminal 1 (Backend):**
```bash
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd frontend && npm start
```

Then open **http://localhost:3000** in your browser! 🚀

---

## 💡 Pro Tips

1. **Keep both terminals visible** to see logs
2. **Use Chrome DevTools** to debug (F12)
3. **Check Network tab** for API call details
4. **Watch backend logs** for Replicate API calls
5. **First generation takes time** - Stable Diffusion XL is slow but high quality

Enjoy testing your Podna agent system! 🎨✨

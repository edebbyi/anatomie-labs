# 🔧 Onboarding Error Fixed!

## ❌ Problem

You were getting this error during onboarding:
```json
{
  "success": false,
  "message": "Unexpected field",
  "code": "UNEXPECTED_FILE"
}
```

---

## 🔍 Root Cause

**Field name mismatch** between frontend and backend:

- **Frontend was sending:** `FormData.append('file', zipFile)`
- **Backend was expecting:** `upload.single('portfolio')`

The multer middleware on the backend rejected the upload because it was looking for a field named `'portfolio'`, but received `'file'` instead.

---

## ✅ Solution

### Fix #1: Field Name Correction
**File:** `frontend/src/pages/Onboarding.tsx`

**Changed:**
```typescript
// Before ❌
formData.append('file', file);

// After ✅
formData.append('portfolio', file);
```

### Fix #2: Generate Endpoint Update
**File:** `frontend/src/pages/Onboarding.tsx`

**Changed:**
```typescript
// Before ❌
POST /api/podna/generate
Body: { count: 8, strategy: 'exploit' }

// After ✅
POST /api/podna/generate/batch
Body: { 
  count: 8, 
  mode: 'exploratory',
  provider: 'stable-diffusion-xl'
}
```

**Reason:** The `/api/podna/generate` endpoint is for single image generation and expects different parameters. The `/api/podna/generate/batch` endpoint is designed for batch generation and accepts `count`, `mode`, and `provider`.

---

## 🧪 Testing

Now you should be able to test the full onboarding flow:

### Step 1: Start Servers
```bash
# Terminal 1 - Backend
npm run dev

# Terminal 2 - Frontend
cd frontend && npm start
```

### Step 2: Test Onboarding
1. Go to http://localhost:3000/signup
2. Register a new account
3. Upload portfolio ZIP (50+ fashion images)
4. Watch the progress:
   - ✅ Uploading portfolio... (10-20%)
   - ✅ Analyzing images with AI... (30-50%)
   - ✅ Creating your style profile... (50-60%)
   - ✅ Generating your first custom designs... (70-90%)
   - ✅ Complete! (100%)
5. See 8 custom-generated images on `/home`!

---

## 📊 Expected API Call Flow

```
1. POST /api/podna/upload
   Headers: { Authorization: Bearer <token> }
   Body: FormData { portfolio: <ZIP file> }
   ✅ Response: { portfolioId, imageCount }

2. POST /api/podna/analyze/:portfolioId
   Headers: { Authorization: Bearer <token> }
   ✅ Response: { analyzed: 50, failed: 0 }

3. POST /api/podna/profile/generate/:portfolioId
   Headers: { Authorization: Bearer <token> }
   ✅ Response: { profile: {...} }

4. POST /api/podna/generate/batch
   Headers: { Authorization: Bearer <token> }
   Body: { count: 8, mode: 'exploratory', provider: 'stable-diffusion-xl' }
   ✅ Response: { generations: [...] }
```

---

## 🎨 What User Will See

After successful onboarding:

1. **Home Page** (`/home`)
   - 8 custom-generated images
   - Each image URL from R2 storage
   - Prompt text for each image
   - Like/dislike buttons
   - Critique text input

2. **Generated Images**
   - Created by Stable Diffusion XL via Replicate
   - Based on user's style profile
   - Matching colors, fabrics, silhouettes from portfolio
   - Professional fashion photography style

3. **Example Images**
   If user's portfolio was minimalist tailored blazers:
   - "Tailored black silk blazer, fitted silhouette..."
   - "Navy wool coat, straight cut, professional..."
   - "White cotton shirt, minimalist design..."
   - etc.

---

## 🔧 Backend Multer Configuration

For reference, here's what the backend expects:

```javascript
// src/api/routes/podna.js
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/zip' || 
        file.mimetype === 'application/x-zip-compressed') {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP files are allowed'));
    }
  }
});

router.post('/upload', authMiddleware, upload.single('portfolio'), ...);
//                                                       ^^^^^^^^^^
//                                        This is the field name!
```

---

## 💡 Key Learnings

1. **Field names must match** between frontend FormData and backend multer
2. **Use the correct endpoint** - `/generate/batch` for multiple images
3. **Send correct parameters** - each endpoint expects specific body structure
4. **Always check backend logs** - they show what field name was received

---

## ✅ Status: FIXED

Both issues are now resolved:
- ✅ Field name changed from `'file'` to `'portfolio'`
- ✅ Endpoint changed to `/api/podna/generate/batch`
- ✅ Correct parameters: `{ count, mode, provider }`

**Ready to test!** 🚀

---

## 📝 Files Modified

1. **`frontend/src/pages/Onboarding.tsx`**
   - Line ~63: Changed `formData.append('file', file)` → `formData.append('portfolio', file)`
   - Line ~157: Changed endpoint from `/generate` → `/generate/batch`
   - Line ~165: Changed body parameters

---

## 🎉 Next Steps

1. **Refresh your browser** to load the updated code
2. **Try onboarding again** with a portfolio ZIP
3. **Watch the progress** through all 4 steps
4. **See your custom images** on the home page!

If you encounter any other errors, check:
- Browser console for frontend errors
- Terminal for backend logs
- Network tab for API responses

**Good luck!** 🎨✨

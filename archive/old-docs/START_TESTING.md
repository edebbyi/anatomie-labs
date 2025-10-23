# 🚀 START TESTING - Your App is Ready!

## ✅ Everything is Live and Running

Your servers are **already running**:
- ✅ **Backend**: `http://localhost:3001` (node server.js)
- ✅ **Frontend**: `http://localhost:3000` (react-scripts)
- ✅ **Replicate API**: Configured with your token
- ✅ **VLT API**: Gemini Vision ready
- ✅ **Database**: PostgreSQL connected

---

## 🎯 Test Now (3 Steps)

### 1. Open Your Browser
```
http://localhost:3000/onboarding
```

### 2. Prepare Test Portfolio
If you don't have a ZIP ready:
```bash
# Create test portfolio
mkdir -p test-data
# Copy 10-50 fashion images to a folder
zip -r test-data/test-portfolio.zip path/to/your/images/*.jpg
```

### 3. Complete Onboarding
Watch the full flow:
1. **Step 1**: Enter name & email
2. **Step 2**: Upload your portfolio ZIP
3. **Step 3**: VLT analysis (1-2 min) - REAL API! ✅
4. **Step 4**: Generate 40 images (8-12 min) - NEW! ✅
   - Watch real-time progress
   - See: "Generated 15 images (1 failed)"
   - Completion: "Generated 46 images! 🎉"
5. **Redirect to Home** with your generated images!

---

## 💰 Quick Cost Calculator

### Test with 10 Images (Recommended First Test)
```
Images: 10 → Buffer: 12 generated
Imagen:  12 × $0.04 = $0.48
SDXL:    12 × $0.02 = $0.24 ← Cheaper!
VLT:     ~$0.50
────────────────────────────
Total (Imagen): ~$0.98
Total (SDXL):   ~$0.74
```

### Full Test with 40 Images
```
Images: 40 → Buffer: 48 generated
Imagen:  48 × $0.04 = $1.92
SDXL:    48 × $0.02 = $0.96 ← 50% cheaper!
VLT:     ~$0.50
────────────────────────────
Total (Imagen): ~$2.42
Total (SDXL):   ~$1.46
```

**To use cheaper model**, edit line 153 in `frontend/src/pages/Onboarding.tsx`:
```typescript
provider: 'stable-diffusion-xl', // Instead of 'google-imagen'
```

---

## ⏱️ Expected Timeline

```
Account Creation:     5 seconds
Portfolio Upload:     30-60 seconds
VLT Analysis:        45-90 seconds
Image Generation:    8-12 minutes ← This is the longest step
Navigate to Home:    instant

TOTAL: ~10-15 minutes
```

**Note**: Image generation takes 8-12 minutes because:
- 48 images × ~10-15 sec each = 8-12 minutes
- Includes rate limiting (2s pause every 5 images)
- Real Replicate API calls (not mocked!)

---

## 📊 What You'll See

### Step 4 Progress Messages (Real-time!):
```
0%:   "Starting image generation..."
5%:   "Found 50 portfolio items"
10%:  "Generated prompt 24/48"
15%:  "48 prompts ready. Starting image generation..."
30%:  "Generated 15 images (1 failed)"
50%:  "Generated 30 images (2 failed)"
70%:  "Generated 45 images (2 failed)"
85%:  "Generated 46 images. Selecting best 40..."
95%:  "Selected 40 best images"
100%: "Generated 46 images! 🎉"
```

### Console Logs (Check Browser DevTools):
```javascript
Portfolio saved to database successfully
Generation stats: { total: 15, success: 14, failed: 1 }
Generation stats: { total: 30, success: 28, failed: 2 }
Image generation complete: { totalGenerated: 46, selected: 40 }
```

---

## 🔧 Quick Customizations

### Change to Cheaper Model (50% Cost Savings)
Edit `frontend/src/pages/Onboarding.tsx` line 153:
```typescript
provider: 'stable-diffusion-xl', // Was: 'google-imagen'
```

### Generate Fewer Images (Faster Testing)
Edit `frontend/src/pages/Onboarding.tsx` line 152:
```typescript
targetCount: 10, // Was: 40
```

### Test Specific User ID
Edit `frontend/src/pages/Onboarding.tsx` line 123:
```typescript
const testUserId = 'YOUR_USER_ID_HERE';
```

---

## 🐛 Troubleshooting

### "No portfolio found for user"
**Issue**: VLT analysis didn't save to database  
**Fix**: Check Step 3 completed successfully before Step 4

### Image generation stuck at 15%
**Issue**: Replicate API might be rate-limited  
**Fix**: Wait 30 seconds, it will resume automatically

### "Failed to generate images"
**Issue**: Replicate API error or network timeout  
**Fix**: 
1. Check Replicate token: `echo $REPLICATE_API_TOKEN`
2. Test token: `curl -H "Authorization: Token $REPLICATE_API_TOKEN" https://api.replicate.com/v1/models`
3. Check logs: `tail -f logs/app.log`

### Frontend shows blank page
**Issue**: React app not compiled  
**Fix**: Check terminal for errors, restart: `cd frontend && npm start`

---

## 📱 Alternative: Test via API

If you want to test the backend separately:

```bash
# 1. Create a test user
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@anatomie.com",
    "password": "Test123!",
    "name": "Test User"
  }'

# 2. Get user ID
USER_ID=$(psql designer_bff -tAc "SELECT id FROM users WHERE email = 'test@anatomie.com';")

# 3. Test generation endpoint
curl -N -X POST http://localhost:3001/api/generate/onboarding \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"$USER_ID\",
    \"targetCount\": 5,
    \"provider\": \"stable-diffusion-xl\"
  }"
```

This will stream progress in your terminal!

---

## 📈 Monitor Progress

### View Backend Logs
```bash
# Real-time logs
tail -f logs/app.log

# Filter for generation
tail -f logs/app.log | grep -E "generation|onboarding"

# Check errors only
grep ERROR logs/app.log | tail -20
```

### Check Database
```bash
# Count users
psql designer_bff -c "SELECT COUNT(*) FROM users;"

# Count images generated
psql designer_bff -c "SELECT COUNT(*) FROM images;"

# View recent generation jobs
psql designer_bff -c "SELECT id, status, created_at FROM generation_jobs ORDER BY created_at DESC LIMIT 10;"
```

### Monitor Replicate Usage
Go to: https://replicate.com/account/billing

---

## ✅ Success Checklist

After completing onboarding, verify:

- [ ] Onboarding completed without errors
- [ ] Redirected to `/home`
- [ ] Generated 40+ images
- [ ] Progress updates worked smoothly
- [ ] No console errors
- [ ] Database has user + portfolio + images
- [ ] Cost matches expectations
- [ ] Images look high quality

---

## 🎊 Ready to Test!

Everything is set up and ready to go. Just:

1. Open browser to `http://localhost:3000/onboarding`
2. Fill in the form
3. Upload a portfolio ZIP
4. Watch the magic happen! ✨

**Estimated time**: 10-15 minutes  
**Cost**: $0.74 - $2.42 (depending on options)

---

## 📞 Quick Reference

### URLs:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`
- API Docs: `http://localhost:3001/health`

### Files Changed:
- `src/routes/generation.js` - Backend endpoint
- `frontend/src/services/onboardingAPI.ts` - Service method
- `frontend/src/pages/Onboarding.tsx` - UI integration

### Documentation:
- `INTEGRATION_COMPLETE.md` - Full technical details
- `TEST_IN_APP.md` - Testing guide
- `READY_TO_TEST.md` - Overview
- `MODELS_BUILT_SUMMARY.md` - Architecture

---

## 💡 Pro Tips

1. **Start small**: Test with 10 images first (~$0.74)
2. **Use SDXL**: 50% cheaper than Imagen
3. **Watch the console**: See real-time progress
4. **Check the logs**: `tail -f logs/app.log`
5. **Be patient**: 8-12 minutes is normal for 40 images

---

**Let's generate some images!** 🚀🎨

Open `http://localhost:3000/onboarding` and go!

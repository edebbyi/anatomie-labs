# Quick Start - Test VLT Onboarding

## 1️⃣ Verify Setup (30 seconds)
```bash
# Check Replicate API
node test-replicate-connection.js
# Expected: ✅ Replicate API is working correctly!
```

## 2️⃣ Test Backend (5 minutes)
```bash
# Create test-images.zip with 3-5 fashion images
# Then run:
node test-vlt-streaming.js
# Expected: Progress bar, live updates, completion message
```

## 3️⃣ Test Full Flow (10 minutes)
```bash
# Terminal 1: Start backend
npm run dev

# Terminal 2: Start frontend
cd frontend && npm start

# Terminal 3: Monitor logs
tail -f logs/combined.log | grep -i "vlt\|analyze"

# Browser: Navigate to http://localhost:3000/onboarding
# Upload 50-image ZIP and watch the magic! ✨
```

## 📊 What to Expect

### VLT Analysis Phase (Step 3)
- ✅ "Extracting images from ZIP..." (5%)
- ✅ "Found 50 images..." (10%)
- ✅ "Image 1 of 50" → "Image 50 of 50" (15-90%)
- ✅ "~2 min remaining" countdown
- ✅ "Analysis complete!" (100%)

### Timing
- **50 images:** ~1.3 minutes
- **100 images:** ~2.5 minutes
- **200+ images:** Timeout after 5 min

## 🆘 Troubleshooting

### "API test failed"
→ Check `.env` has valid `REPLICATE_API_TOKEN`

### "No progress updates"
→ Server running? Check `ps aux | grep node`

### "Timeout"
→ Use smaller ZIP (50-100 images max)

## 📚 Full Documentation
- [ONBOARDING_COMPLETE.md](./ONBOARDING_COMPLETE.md) - Complete summary
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - All test scenarios
- [ONBOARDING_IMPROVEMENTS.md](./ONBOARDING_IMPROVEMENTS.md) - Technical details

---
**Status:** ✅ Ready for Production Testing

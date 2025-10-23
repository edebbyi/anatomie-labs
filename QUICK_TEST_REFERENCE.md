# 🚀 Quick Test Reference - Garment Detection

## ✅ System Status

Both services are running and ready:
- ✅ Backend: `http://localhost:3001`
- ✅ Frontend: `http://localhost:3000`
- ✅ Database: Schema updated with new columns
- ✅ Code: Updated with improved garment detection

## 🧪 Quick Test Steps

### 1. Open Frontend
```
http://localhost:3000
```

### 2. Create Test Account
- Go to `/signup`
- Email: `test-garment@test.com`
- Password: `TestPassword123!`

### 3. Upload Portfolio
- Prepare ZIP with 50+ images
- Include test cases:
  - 3-5 dress images
  - 3-5 two-piece outfits (matching top+skirt)
  - Remaining: mixed garments
- Upload on Onboarding page
- Wait ~2-5 minutes for analysis

### 4. Check Results
```bash
cd /Users/esosaimafidon/Documents/GitHub/anatomie-lab
node check-garment-results.js test-garment@test.com
```

## 📊 What You Should See

### ✅ Good Results
```
Garment Type         Two-Piece    Count    Avg Confidence
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
dress                No           3        85.3%
two-piece            Yes          4        82.1%
blazer               No           5        88.7%
```

### ❌ Bad Results (Old Behavior)
```
dress                No           25       75.0%  ← Too many dresses!
```

## 🔍 Key Indicators

| Indicator | Good ✅ | Bad ❌ |
|-----------|---------|---------|
| Dress count | Matches actual number | 2-3x more than expected |
| Two-piece detection | Has entries with `is_two_piece: true` | No two-piece entries |
| Confidence | >70% average | <50% average |
| Reasoning | Present for all | Missing or generic |

## 🛠️ Helper Scripts

### Check if ready to test
```bash
./quick-test.sh
```

### Check results after upload
```bash
node check-garment-results.js YOUR_EMAIL
```

### View live logs
```bash
tail -f server.log | grep -i "Style Descriptor\|garment"
```

## 📁 Important Files

- **Code Changes**: `/src/services/styleDescriptorAgent.js`
- **Test Guide**: `TEST_GARMENT_DETECTION_FRONTEND.md`
- **Improvements Doc**: `GARMENT_DETECTION_IMPROVEMENTS.md`

## 🐛 Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| Frontend not loading | Check if running: `lsof -ti:3000` |
| Backend not responding | Check if running: `lsof -ti:3001` |
| Analysis takes too long | Normal for 50+ images (~2-5 min) |
| No results in database | Wait for analysis to complete |

## 📞 Need Help?

If you encounter issues:
1. Check browser console (F12)
2. Check backend logs: `tail -f server.log`
3. Check database: Run `check-garment-results.js`

## 🎯 Success Criteria

Your test is successful if:
- [x] No duplicate dress detections
- [x] Two-piece outfits correctly identified
- [x] `is_two_piece` flag is accurate
- [x] `reasoning` field explains decisions
- [x] Confidence scores >70%

---

**Ready to test!** Follow the steps above and the system will analyze your portfolio with the improved garment detection. 🚀

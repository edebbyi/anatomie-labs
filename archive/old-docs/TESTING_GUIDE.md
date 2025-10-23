# Onboarding Testing Guide

## ✅ Pre-Testing Checklist

### 1. Environment Configuration
- [x] **REPLICATE_API_TOKEN** is set and valid (tested with `test-replicate-connection.js`)
- [x] **adm-zip** package is installed
- [x] Server is running on port 3001
- [x] Frontend is running on port 3000
- [x] Database is accessible

### 2. API Endpoints Status
- [x] `/api/vlt/analyze/stream` - NEW streaming endpoint ✨
- [x] `/api/vlt/analyze/direct` - Legacy non-streaming endpoint
- [x] Replicate API connectivity verified

---

## 🧪 Test Scenarios

### Scenario 1: Quick API Test (Recommended First)
**Purpose:** Verify streaming endpoint works without frontend

```bash
# Run the streaming endpoint test
node test-vlt-streaming.js
```

**Prerequisites:**
- Create a ZIP file with 3-5 fashion images
- Name it `test-images.zip`
- Place in project root

**Expected Results:**
```
✅ Found test ZIP: XX.XX KB
✅ Connection established, streaming progress...
[██████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 10%
   Found 5 images. Starting analysis...
   
[████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░] 20%
   📸 Image 1/5: Analyzing image 1 of 5...
   
...

✅ Test PASSED - Streaming endpoint working correctly!
```

---

### Scenario 2: Full Frontend Onboarding Flow
**Purpose:** Test complete user experience from account creation to generation

#### Step 1: Start the Application
```bash
# Terminal 1: Backend
npm run dev

# Terminal 2: Frontend
cd frontend && npm start

# Terminal 3: Monitor logs
tail -f logs/combined.log | grep -i "vlt\|analyze\|fashion"
```

#### Step 2: Navigate to Onboarding
1. Open browser: http://localhost:3000/onboarding
2. Fill in account details:
   - Name: Test User
   - Email: test@example.com
   - Company: Test Company

#### Step 3: Upload Portfolio
1. Click "Continue" to Step 2
2. Upload a ZIP file with 50-100 fashion images
3. Verify estimate shows correct image count
4. Click "Process Portfolio"

#### Step 4: Monitor VLT Analysis
**What to Look For:**

```
Expected UI Updates:
├── Progress bar moves smoothly (0% → 100%)
├── Message: "Extracting images from ZIP..." (5%)
├── Message: "Found 50 images. Starting analysis..." (10%)
├── Live counter: "Image 1 of 50"
├── Message: "Analyzing image X of 50..." (15-90%)
├── Time estimate: "~2 min remaining"
├── Message: "Generating style summary..." (90%)
└── Message: "Analysis complete!" (100%)
```

**Timing Expectations:**
- 50 images × 1.5s = 75 seconds (~1.3 minutes)
- Plus ~5s for extraction and summary
- **Total: ~80 seconds**

#### Step 5: Verify Database Records
```sql
-- Check VLT records were saved
SELECT 
  COUNT(*) as record_count,
  garment_type,
  AVG(confidence) as avg_confidence
FROM vlt_specifications
WHERE user_id = 'ec058a8c-b2d7-4888-9e66-b7b02e393152'
  AND created_at > NOW() - INTERVAL '5 minutes'
GROUP BY garment_type;
```

**Expected:**
- 50 records inserted
- Various garment types (dress, top, pants, etc.)
- Average confidence ~0.85

#### Step 6: Generation Phase
After VLT analysis completes, onboarding proceeds to Step 4:

```
Expected:
├── Automatic transition to "Generating Your First Collection"
├── Progress updates via SSE
├── Message: "Generated X of 40 images..."
├── Final: "Generated 40 images! 🎉"
└── Redirect to /home gallery
```

---

### Scenario 3: Timeout Handling Test
**Purpose:** Verify graceful timeout behavior

#### Method 1: Large File Test
```bash
# Create a ZIP with 500+ images (will exceed 5-minute timeout)
# Upload and observe timeout handling
```

**Expected:**
- After 5 minutes: timeout error displayed
- Error message suggests retry with fewer images
- User returned to Step 2
- Database transaction rolled back (no partial data)

#### Method 2: Simulated Slow Network
```bash
# Slow down network to simulate timeout
# (Use browser dev tools Network throttling)
```

---

### Scenario 4: Error Recovery Tests

#### Test 4A: Invalid ZIP File
1. Upload a ZIP with no images
2. **Expected:** Error message "No valid images found"
3. User stays on Step 2

#### Test 4B: Corrupted Image
1. Upload ZIP with 1 corrupted image among valid ones
2. **Expected:** 
   - Fallback analysis used for corrupted image
   - Other images analyzed normally
   - Warning logged but flow continues

#### Test 4C: API Rate Limit
1. Upload many images quickly
2. **Expected:**
   - 1.5s delay between each image prevents rate limiting
   - All images processed successfully

---

## 📊 Success Metrics

### VLT Analysis Phase
- ✅ Progress updates received every 1.5s
- ✅ All images processed (or fallback used)
- ✅ Database records inserted successfully
- ✅ Summary generated with correct stats
- ✅ No transaction errors in logs

### Generation Phase
- ✅ Smooth transition from VLT → Generation
- ✅ Initial generation completes (40 images)
- ✅ User redirected to home gallery
- ✅ Generated images visible in UI

### Error Handling
- ✅ Timeout handled gracefully
- ✅ Invalid files rejected with clear message
- ✅ Transaction rollback on errors
- ✅ User can retry after errors

---

## 🐛 Troubleshooting

### Issue: "Analysis timed out"
**Causes:**
- ZIP file too large (>100 images for testing)
- Slow network connection
- Replicate API slow

**Solutions:**
```bash
# 1. Check Replicate API status
node test-replicate-connection.js

# 2. Use smaller ZIP file (50 images)
# 3. Check logs for specific errors
tail -f logs/error.log

# 4. Verify database connectivity
psql -U anatomie_user -d anatomie_fashion_db -c "SELECT NOW();"
```

### Issue: "No progress updates"
**Causes:**
- SSE connection broken
- Server not sending updates
- Frontend not consuming stream

**Debug:**
```bash
# 1. Test backend directly
node test-vlt-streaming.js

# 2. Check browser console for SSE errors
# 3. Verify server logs show progress
grep "Analyzed image" logs/combined.log | tail -20
```

### Issue: "Database transaction errors"
**Causes:**
- Malformed VLT data
- Database connection issues
- Schema mismatch

**Debug:**
```sql
-- Check recent errors
SELECT * FROM vlt_specifications 
ORDER BY created_at DESC LIMIT 5;

-- Verify schema
\d vlt_specifications
```

---

## 📈 Performance Benchmarks

### Expected Timings
| Images | Analysis Time | DB Save | Total  |
|--------|---------------|---------|--------|
| 10     | 15s           | <1s     | ~16s   |
| 50     | 75s           | ~2s     | ~77s   |
| 100    | 150s          | ~3s     | ~153s  |
| 200    | 300s (5min)   | ~5s     | TIMEOUT|

### Resource Usage
- **Memory:** ~50MB per analysis
- **CPU:** Low (mostly waiting on API)
- **Network:** ~1 request/1.5s to Replicate
- **Database:** Minimal (batch insert at end)

---

## ✅ Test Completion Checklist

After running all scenarios, verify:

- [ ] Replicate API connectivity tested
- [ ] Streaming endpoint works standalone
- [ ] Frontend progress updates display correctly
- [ ] Database records saved properly
- [ ] Timeout handling works
- [ ] Error recovery works
- [ ] Generation phase starts automatically
- [ ] User reaches home gallery
- [ ] No errors in server logs
- [ ] No errors in browser console

---

## 🚀 Next Steps After Testing

### If All Tests Pass:
1. ✅ VLT analysis is production-ready
2. ✅ Onboarding flow is complete
3. Ready to test with real user portfolios
4. Consider optimizations (parallel processing, caching)

### If Tests Fail:
1. Check specific error messages
2. Review server logs: `logs/error.log`
3. Verify environment variables
4. Test Replicate API connection again
5. Check database connectivity

---

## 📞 Support Resources

### Useful Commands
```bash
# Restart server
pm2 restart all
# OR
kill $(lsof -t -i:3001) && npm run dev

# Clear logs
> logs/combined.log
> logs/error.log

# Check database
psql -U anatomie_user -d anatomie_fashion_db

# Test API
curl -X POST http://localhost:3001/api/vlt/health
```

### Log Files
- `logs/combined.log` - All application logs
- `logs/error.log` - Errors only
- `logs/exceptions.log` - Uncaught exceptions
- `logs/rejections.log` - Unhandled promise rejections

### Key Files Modified
- `src/api/routes/vlt.js` - Added streaming endpoint
- `src/services/portfolioService.js` - Fixed transactions
- `frontend/src/services/onboardingAPI.ts` - Added timeout
- `frontend/src/pages/Onboarding.tsx` - Enhanced UI

---

**Last Updated:** October 13, 2025
**Status:** ✅ Ready for Testing

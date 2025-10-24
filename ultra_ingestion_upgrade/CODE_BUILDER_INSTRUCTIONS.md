# CODE BUILDER INTEGRATION INSTRUCTIONS

## 📋 Overview
You are upgrading `src/services/enhancedStyleDescriptorAgent.js` to a much more powerful ultra-detailed ingestion agent that captures 10-20x more data per image.

**Current Status:** Basic ingestion (~10 data points per image)  
**Target Status:** Ultra-detailed ingestion (~150 data points per image)

**Impact:** Better profiles, more accurate AI generation, higher user satisfaction

---

## ✅ Task Checklist

### TASK 1: Database Migration
**Priority:** CRITICAL - Must be done first  
**Estimated Time:** 10 minutes

```bash
# 1. Connect to database
psql -U [username] -d [database_name]

# 2. Run migration script
\i sql/001_create_ultra_detailed_descriptors.sql

# 3. Verify tables created
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('ultra_detailed_descriptors', 'descriptor_quality_log', 'descriptor_corrections');

# Expected: 3 rows returned
```

**Success Criteria:**
- [ ] 3 new tables created
- [ ] 13+ indexes created
- [ ] 3 helper functions installed
- [ ] 3 views created
- [ ] No errors in migration

**If Errors Occur:**
- Check PostgreSQL version (requires 12+)
- Verify database permissions
- Review error message in migration script output

---

### TASK 2: Install New Agent File
**Priority:** HIGH  
**Estimated Time:** 2 minutes

```bash
# Copy new agent to services directory
cp src/services/ultraDetailedIngestionAgent.js /path/to/your/project/src/services/
```

**Success Criteria:**
- [ ] File copied to correct location
- [ ] File has correct permissions
- [ ] No syntax errors (run a quick lint check if possible)

---

### TASK 3: Update Imports
**Priority:** HIGH  
**Estimated Time:** 5 minutes

**Find all files that import the old agent:**
```bash
# Search for imports
grep -r "enhancedStyleDescriptorAgent" src/
```

**Update each file:**

**BEFORE:**
```javascript
const styleDescriptor = require('./services/enhancedStyleDescriptorAgent');
```

**AFTER:**
```javascript
const ultraIngestion = require('./services/ultraDetailedIngestionAgent');
```

**Files to update (likely candidates):**
- API routes that trigger analysis
- Background workers
- Admin tools
- Test files

**Success Criteria:**
- [ ] All imports updated
- [ ] Variable names updated (styleDescriptor → ultraIngestion)
- [ ] No remaining references to old agent (except in backup/archive files)

**Note:** The API is 100% backward compatible, so method calls don't need to change!

---

### TASK 4: Run Tests
**Priority:** CRITICAL  
**Estimated Time:** 10-15 minutes

```bash
# Option A: Run automated test script
node tests/test_migration.js --portfolioId=test-portfolio-id

# Option B: Manual testing
# Create a test portfolio and run analysis
```

**What to Test:**
1. Database tables exist ✓
2. Indexes created ✓
3. Helper functions work ✓
4. Agent can analyze single image ✓
5. Portfolio analysis works ✓
6. Quality metrics views work ✓
7. Data quality meets targets ✓

**Success Criteria:**
- [ ] All automated tests pass
- [ ] Sample image analyzes successfully
- [ ] avg_confidence > 0.80
- [ ] avg_completeness > 80%
- [ ] Data stored correctly in database
- [ ] No errors in logs

**If Tests Fail:**
- Check REPLICATE_API_TOKEN environment variable
- Verify image URLs are accessible
- Review error logs
- Check database connection

---

### TASK 5: Monitor Quality (Post-Deployment)
**Priority:** MEDIUM  
**Estimated Time:** Ongoing

```sql
-- Check daily quality metrics
SELECT * FROM daily_quality_metrics
WHERE analysis_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY analysis_date DESC;

-- Check for low quality analyses
SELECT * FROM low_quality_descriptors
LIMIT 20;

-- Overall stats
SELECT 
  COUNT(*) as total,
  AVG(overall_confidence) as avg_confidence,
  AVG(completeness_percentage) as avg_completeness,
  COUNT(*) FILTER (WHERE overall_confidence < 0.70) as low_quality_count
FROM ultra_detailed_descriptors
WHERE created_at > NOW() - INTERVAL '24 hours';
```

**Success Criteria:**
- [ ] avg_confidence > 0.80
- [ ] avg_completeness > 80%
- [ ] Low quality count < 10% of total
- [ ] No unexpected errors

---

### TASK 6: Set Up Quality Alerts (Optional)
**Priority:** LOW  
**Estimated Time:** 10 minutes

```javascript
// Add to your cron jobs or scheduled tasks
const flagLowQuality = async () => {
  const result = await db.query('SELECT flag_low_quality_descriptors()');
  console.log(`Flagged ${result.rows[0].flag_low_quality_descriptors} analyses for review`);
};

// Run daily at 2 AM
schedule.scheduleJob('0 2 * * *', flagLowQuality);
```

**Success Criteria:**
- [ ] Scheduled job runs daily
- [ ] Low quality analyses flagged automatically
- [ ] Alerts sent if threshold exceeded

---

## 🔧 Code Changes Summary

### What Changes:
1. ✅ Import statement (old agent → new agent)
2. ✅ Variable name (styleDescriptor → ultraIngestion)

### What Stays the Same:
1. ✅ Method names (`analyzePortfolio`, `analyzeImage`)
2. ✅ Parameters (portfolioId, progressCallback)
3. ✅ Return format ({ analyzed, failed, descriptors })
4. ✅ Progress callback format

### What's New (Additive):
1. ✅ results.avgConfidence
2. ✅ results.avgCompleteness
3. ✅ Richer descriptor data

---

## 📝 Example Code Changes

### Before (Your Current Code)
```javascript
const styleDescriptor = require('./services/enhancedStyleDescriptorAgent');

async function analyzeUserPortfolio(portfolioId) {
  const results = await styleDescriptor.analyzePortfolio(portfolioId, (progress) => {
    console.log(`Progress: ${progress.percentage}%`);
  });
  
  return {
    success: true,
    analyzed: results.analyzed,
    failed: results.failed
  };
}
```

### After (Updated Code)
```javascript
const ultraIngestion = require('./services/ultraDetailedIngestionAgent');

async function analyzeUserPortfolio(portfolioId) {
  const results = await ultraIngestion.analyzePortfolio(portfolioId, (progress) => {
    console.log(`Progress: ${progress.percentage}%`);
    console.log(`Avg Confidence: ${progress.avgConfidence}`);  // NEW!
    console.log(`Avg Completeness: ${progress.avgCompleteness}`);  // NEW!
  });
  
  return {
    success: true,
    analyzed: results.analyzed,
    failed: results.failed,
    avgConfidence: results.avgConfidence,  // NEW!
    avgCompleteness: results.avgCompleteness  // NEW!
  };
}
```

**Changes Required:**
1. Update import
2. Update variable name
3. Optionally use new metrics

---

## 🚨 Important Warnings

### ⚠️  BACKUP DATABASE FIRST
```sql
CREATE TABLE image_descriptors_backup_20241023 AS 
SELECT * FROM image_descriptors;
```

### ⚠️  TEST BEFORE PRODUCTION
- Test with small portfolio first
- Verify quality metrics
- Monitor for 24 hours in staging

### ⚠️  ENVIRONMENT VARIABLES
Ensure `REPLICATE_API_TOKEN` is set:
```bash
export REPLICATE_API_TOKEN=your_token_here
```

### ⚠️  CONCURRENCY CONTROL
Adjust if needed:
```bash
export ANALYSIS_CONCURRENCY=3  # Default: 3 concurrent requests
```

---

## 🎯 Success Criteria

**After 1 week, verify:**

```sql
SELECT 
  AVG(overall_confidence) as avg_confidence,
  AVG(completeness_percentage) as avg_completeness,
  COUNT(*) FILTER (WHERE overall_confidence >= 0.80) * 100.0 / COUNT(*) as high_quality_pct
FROM ultra_detailed_descriptors
WHERE created_at > NOW() - INTERVAL '7 days';
```

**Targets:**
- avg_confidence > 0.80 ✓
- avg_completeness > 80% ✓
- high_quality_pct > 85% ✓

**User Impact:**
- Profile accuracy improves (measure via feedback)
- AI generation more precise (fewer "this isn't my style" complaints)
- Faster time-to-personalization (10 images vs 50)

---

## 🔄 Rollback Plan

If issues arise, rollback is simple:

```javascript
// Revert import
const styleDescriptor = require('./services/enhancedStyleDescriptorAgent');
```

The old table (`image_descriptors`) remains untouched, so old code continues working.

---

## 📚 Additional Resources

**Detailed Instructions:**
- `docs/MIGRATION_GUIDE.md` - Step-by-step migration
- `docs/COMPARISON.md` - Before/after comparison

**Testing:**
- `tests/test_migration.js` - Automated test script

**Database:**
- `sql/001_create_ultra_detailed_descriptors.sql` - Migration script

**Code:**
- `src/services/ultraDetailedIngestionAgent.js` - New agent

---

## 💬 Questions?

**Database issues?** → Check PostgreSQL version (12+), review migration errors  
**Low confidence?** → Check image quality, review REPLICATE_API_TOKEN  
**Slow performance?** → Reduce ANALYSIS_CONCURRENCY  
**API errors?** → Verify REPLICATE_API_TOKEN, check network access  

See `docs/MIGRATION_GUIDE.md` for detailed troubleshooting.

---

## ✅ Final Checklist

Before marking complete, verify:

- [ ] Database migration ran successfully
- [ ] All 3 tables created
- [ ] Indexes and functions installed
- [ ] New agent file copied
- [ ] All imports updated
- [ ] Tests pass
- [ ] Quality metrics meet targets (confidence > 0.80, completeness > 80%)
- [ ] Monitoring set up
- [ ] Team informed of changes
- [ ] Documentation updated

---

**Estimated Total Time:** 2-3 hours  
**Difficulty:** Medium  
**Impact:** HIGH - Critical upgrade for product quality

Good luck! 🚀

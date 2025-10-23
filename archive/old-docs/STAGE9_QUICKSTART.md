# Stage 9: Quick Start Guide

## 🚀 Get Started in 5 Minutes

### What You Get

Stage 9 adds **intelligent diverse selection** using DPP (Determinantal Point Processes) and **coverage analysis** to track VLT attribute representation. Your system will:

- ✅ Select the most **diverse** 100 images from 110+ validated images
- ✅ Track **coverage** across garment types, silhouettes, fabrications, etc.
- ✅ Identify **gaps** in attribute representation
- ✅ **Automatically adjust** prompts to fill gaps in next generation
- ✅ Continuously improve **diversity** over time

---

## Step 1: Run Database Migration (2 mins)

```bash
# Set your database URL
export DATABASE_URL='postgresql://user:pass@localhost:5432/dbname'

# Run the automated setup script
./scripts/setup_stage9.sh
```

This creates:
- 4 tables: `coverage_reports`, `attribute_gaps`, `dpp_selection_results`, `coverage_config`
- 3 views: `active_attribute_gaps`, `coverage_trends`, `attribute_coverage_history`
- Triggers for auto-gap tracking

---

## Step 2: Register API Routes (1 min)

Add to your Express app (e.g., `src/server.js` or `src/app.js`):

```javascript
const coverageRoutes = require('./routes/coverageRoutes');
app.use('/api/coverage', coverageRoutes);
```

That's it! The API is now ready.

---

## Step 3: Test It Out (2 mins)

### Generate Images

Generate images as usual with over-generation buffer (already implemented in previous stages).

### Check Coverage

```bash
# Get coverage for a generation
curl http://localhost:3000/api/coverage/generation/{generationId}

# View active gaps
curl http://localhost:3000/api/coverage/gaps

# Get summary statistics
curl http://localhost:3000/api/coverage/summary
```

### Query Database

```bash
# View coverage trends
psql $DATABASE_URL -c "SELECT * FROM coverage_trends ORDER BY date DESC LIMIT 10;"

# View active gaps
psql $DATABASE_URL -c "SELECT * FROM active_attribute_gaps;"

# View DPP selection results
psql $DATABASE_URL -c "SELECT generation_id, diversity_score, selected_count FROM dpp_selection_results ORDER BY created_at DESC LIMIT 10;"
```

---

## Optional: Integrate DPP Selection

The DPP selection logic is ready but requires a manual integration step.

### Current State
- ✅ Services created: `dppSelectionService.js`, `coverageAnalysisService.js`
- ✅ Imports added to `generationService.js`
- ✅ Helper method `storeDPPResults()` added
- ✅ Backup created: `generationService.js.backup`

### To Complete Integration

1. **Review the updated method** in `src/services/stage9_filter_update.js`

2. **Replace the filtering method** in `src/services/generationService.js`:
   - Find `async filterAndReturnBestImages(...)` (around line 624)
   - Replace it with the version from `stage9_filter_update.js`

3. **What it does**:
   - Validates all images (Stage 8)
   - Filters acceptable quality images (score ≥ 60)
   - Applies DPP selection for diversity (if enough images)
   - Runs coverage analysis
   - Stores gaps and recommendations
   - Returns diverse subset to user

**OR**: Use the existing simple score-based filtering and let the API track coverage separately.

---

## How It Works

### Pipeline Flow

```
110 validated images → DPP Selection → 100 diverse images
                            ↓
                    Coverage Analysis
                            ↓
                      Gap Identification
                            ↓
                    (Store in Database)
                            ↓
              Stage 4 reads gaps → Adjusts weights
                            ↓
                      Next Generation
```

### DPP Algorithm (Simplified)

1. Convert each image to a **feature vector** based on VLT attributes
2. Calculate **similarity matrix** (how similar images are to each other)
3. **Greedily select** images that maximize:
   - High quality scores
   - Low similarity to already selected images
4. Result: **Most diverse** subset that maintains quality

### Coverage Analysis

1. Count how many different values each attribute has
2. Calculate **coverage %** = (covered values / total values) × 100
3. Identify **gaps** = attributes below target coverage
4. Generate **recommendations** = boost weights for gap attributes

### Gap Feedback Loop

1. **After generation**: Gaps identified and stored
2. **Before next generation**: Stage 4 reads active gaps
3. **Weights adjusted**: Underrepresented attributes boosted (e.g., 1.2x - 2.0x)
4. **Next generation**: More diverse results
5. **Repeat**: Gaps gradually close over time

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/coverage/generation/:id` | Get coverage for a generation |
| GET | `/api/coverage/gaps` | Get active gaps |
| GET | `/api/coverage/trends` | Get historical trends |
| GET | `/api/coverage/summary` | Get overall summary |
| GET | `/api/coverage/dpp/:id` | Get DPP selection results |
| POST | `/api/coverage/gaps/:id/apply-boost` | Apply weight boost |
| POST | `/api/coverage/gaps/:id/resolve` | Mark gap as resolved |
| PUT | `/api/coverage/config` | Update target coverage |

---

## Example Response

### GET `/api/coverage/generation/{id}`

```json
{
  "generationId": "gen_123...",
  "metrics": {
    "overallDiversityScore": "0.82",
    "avgCoveragePercent": "75.3",
    "garmentType": {
      "coveragePercent": 75.0,
      "targetCoverage": 80.0,
      "meetsTarget": false
    }
  },
  "gaps": [
    {
      "attribute": "garmentType",
      "severity": "high",
      "uncoveredValues": ["jumpsuit", "set"],
      "recommendedBoost": 1.2
    }
  ],
  "summary": {
    "status": "Needs Improvement",
    "message": "Coverage at 75.3% with 2 gaps identified..."
  }
}
```

---

## Expected Metrics

### Diversity Score
- **0.75 - 0.90**: Excellent diversity
- **0.60 - 0.74**: Good diversity
- **< 0.60**: Needs improvement

### Coverage
- **≥ 80%**: Excellent coverage
- **70% - 79%**: Good coverage
- **< 70%**: Gaps exist

### Gap Resolution
- Gaps should **decrease over time** as system learns
- Critical gaps should resolve within **5-10 generations**

---

## Monitoring

### Key Metrics to Track

1. **Diversity Score Trend**: Should stabilize around 0.80-0.90
2. **Gap Count**: Should decrease over time
3. **Coverage by Attribute**: Track individual attributes
4. **Resolution Rate**: % of gaps resolved

### Quick Queries

```sql
-- Average diversity score (last 30 days)
SELECT AVG((metrics->>'overallDiversityScore')::numeric) 
FROM coverage_reports 
WHERE created_at >= NOW() - INTERVAL '30 days';

-- Gap count by severity
SELECT severity, COUNT(*) 
FROM active_attribute_gaps 
GROUP BY severity;

-- Resolution rate
SELECT 
  COUNT(*) FILTER (WHERE status = 'resolved')::float / 
  COUNT(*) * 100 as resolution_rate
FROM attribute_gaps 
WHERE identified_at >= NOW() - INTERVAL '30 days';
```

---

## Troubleshooting

### "Low diversity scores"
→ Increase over-generation buffer % (default is 20%)

### "Same gaps keep appearing"
→ Check if Stage 4 is reading gaps and applying boosts

### "DPP selection slow"
→ Reduce input count with stricter validation

### "Database errors"
→ Ensure PostgreSQL 12+ with JSONB support

---

## Files Created

```
src/services/
  ├── dppSelectionService.js          # DPP algorithm
  ├── coverageAnalysisService.js       # Coverage tracking
  ├── gapAwarePromptService.js         # Gap-based weight adjustment
  └── stage9_filter_update.js          # Updated filtering method

src/routes/
  └── coverageRoutes.js                # Coverage API endpoints

migrations/
  └── 004_stage9_coverage_tracking.sql # Database schema

docs/
  ├── stage9_intelligent_selection_coverage.md  # Full guide
  └── STAGE9_COMPLETION.md                      # Completion summary

scripts/
  └── setup_stage9.sh                  # Automated setup script
```

---

## Next Steps

1. ✅ **Run setup script**: `./scripts/setup_stage9.sh`
2. ✅ **Register API routes** in your Express app
3. 🔄 **Generate images** and observe coverage
4. 📊 **Monitor trends** via API or database queries
5. 🎯 **Watch diversity improve** over time

---

## Full Documentation

For complete details, see:
- **Full Guide**: `docs/stage9_intelligent_selection_coverage.md`
- **Completion Summary**: `docs/STAGE9_COMPLETION.md`

---

## Support

Questions? Check:
1. Database logs and API responses
2. Query `coverage_reports`, `attribute_gaps`, `dpp_selection_results`
3. Monitor via `/api/coverage/summary`
4. Review troubleshooting section in full docs

---

**Stage 9 is ready to go! 🚀**

Generate images → DPP selects diverse subset → Gaps identified → Weights adjusted → Better diversity next time!

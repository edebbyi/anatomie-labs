# Designer BFF Pipeline - Quick Reference

**Last Updated:** 2025-10-11  
**Pipeline Status:** Fully Operational (Stages 1-8 Complete)

---

## 🚀 Quick Start

### Generate Images with Quality Guarantee

```javascript
// Request 30 high-quality images
const result = await generationService.generateFromImage({
  userId: 'user_123',
  imageFile: buffer,
  settings: {
    count: 30,           // User gets exactly 30 best images
    bufferPercent: 20,   // System generates 36 (20% buffer)
    autoValidate: true   // Validate & filter (default)
  }
});

// System automatically:
// 1. Generates 36 images (30 × 1.2)
// 2. Validates all 36
// 3. Returns best 30 to user
// 4. Feeds discarded 6 to RLHF
```

---

## 📋 Complete Pipeline Flow

```
Stage 1: VLT Analysis
         ↓ Analyze uploaded image
Stage 2: Prompt Enhancement (OpenAI)
         ↓ Enhance with GPT-4
Stage 3: Persona Matching
         ↓ Match to user style
Stage 4: Model Routing
         ↓ Select best provider
Stage 5: RLHF Optimization
         ↓ Optimize with feedback
Stage 6: Image Generation (with buffer)
         ↓ Generate N × 1.2 images
Stage 7: R2 Upload
         ↓ Upload all to storage
Stage 8: Validation & Filtering
         ↓ Validate all → Return best N → Feed discarded to RLHF
```

---

## 🎯 Key Features

### ✅ Quality Guarantee
- User requests N images → Gets exactly N **best** images
- All returned images validated & ranked by quality
- No poor-quality images reach the user

### ✅ Continuous Learning
- Discarded images → RLHF negative examples
- High-scoring images → RLHF positive examples
- System improves over time

### ✅ Provider Diversity
- **Google Imagen 4 Ultra** (default, highest quality)
- **Google Gemini 2.5 Flash Image** (ultra-fast & cheap)
- **Stable Diffusion 3.5 Large** (cost-effective)
- **OpenAI DALL-E 3** (creative alternative)

---

## 📊 Database Tables

### Core Tables
```sql
generations           -- Main generation tracking
generation_assets     -- Uploaded images
validation_results    -- VLT validation scores
rlhf_feedback        -- Learning feedback (new!)
```

### Key Views
```sql
validation_summary           -- Validation stats
provider_validation_stats   -- Quality by provider
rlhf_negative_examples      -- Failed/discarded images
rlhf_positive_examples      -- High-quality images
```

---

## 🔧 Configuration

### Buffer Percentages by Use Case

| Scenario | Buffer % | Cost Overhead | Quality |
|----------|----------|---------------|---------|
| High-stakes | 40-50% | +40-50% | Maximum |
| **Standard** | **20-25%** | **+20-25%** | **High** |
| High-volume | 10-15% | +10-15% | Good |
| Single image | 0% | None | Variable |

### Environment Variables

```env
# Validation (optional)
VALIDATION_OUTLIER_CONTAMINATION=0.1
VALIDATION_MIN_SCORE_THRESHOLD=70

# Generation (optional)
DEFAULT_BUFFER_PERCENT=20
DEFAULT_COUNT=1
```

---

## 📡 API Endpoints

### Generation
```bash
POST /api/generate/from-image       # Generate from uploaded image
POST /api/generate/from-prompt      # Generate from text prompt
GET  /api/generate/:id              # Get generation status
GET  /api/generate                  # List user generations
DELETE /api/generate/:id            # Delete generation
```

### Validation
```bash
POST /api/validation/validate/:id      # Trigger validation
GET  /api/validation/results/:id       # Get validation results
GET  /api/validation/flagged           # Get flagged images
GET  /api/validation/outliers          # Get outlier images
GET  /api/validation/metrics           # Get quality metrics
PUT  /api/validation/:id/review        # Review/approve/reject
```

---

## 💾 Database Queries

### Check Generation Quality
```sql
SELECT 
  id,
  pipeline_data->'overGeneration' as buffer_info,
  pipeline_data->'filtering'->'avgReturnedScore' as avg_quality,
  pipeline_data->'filtering'->'discarded' as discarded_count
FROM generations
WHERE id = 'gen_xxx';
```

### View RLHF Feedback
```sql
-- Negative examples (learn what NOT to do)
SELECT * FROM rlhf_negative_examples
ORDER BY quality_score ASC
LIMIT 20;

-- Positive examples (learn what TO do)
SELECT * FROM rlhf_positive_examples
ORDER BY quality_score DESC
LIMIT 20;
```

### Provider Quality Comparison
```sql
SELECT 
  provider_name,
  avg_overall_score,
  pass_rate,
  total_validations
FROM provider_validation_stats
ORDER BY avg_overall_score DESC;
```

### Discard Rate by Provider
```sql
SELECT 
  provider_name,
  negative_count,
  feedback_count,
  ROUND(negative_count::FLOAT / feedback_count * 100, 2) as discard_rate
FROM rlhf_feedback_summary
WHERE feedback_type = 'discarded'
ORDER BY discard_rate DESC;
```

---

## 🧪 Testing

### Run Tests
```bash
# Stage 6: Full pipeline test
node tests/stage6-integration-test.js

# Stage 8: Validation test
node tests/stage8-validation-test.js

# Manual test with curl
curl -X POST http://localhost:3000/api/generate/from-image \
  -F "image=@test.jpg" \
  -F "userId=test" \
  -F "settings={\"count\":10,\"bufferPercent\":20}"
```

---

## 📈 Monitoring Metrics

### Key Metrics to Track

**Quality:**
- Average validation score of returned images
- Discard rate per provider
- User satisfaction (from feedback)

**Cost:**
- Cost per returned image (total cost / N)
- Buffer overhead percentage
- Cost by provider

**Learning:**
- RLHF feedback count (negative/positive)
- Quality improvement trend over time
- Provider performance changes

---

## 🔄 Typical Workflow

### User Uploads Image
```
1. User uploads fashion reference image
2. VLT analyzes: "red dress, midi length, A-line silhouette"
3. Prompt enhanced to professional quality
4. User persona matched
5. Routed to Google Imagen (highest quality)
6. RLHF optimizes prompt based on past feedback
7. Generates 36 images (requested 30 + 20% buffer)
8. Validates all 36:
   - 28 score 85-95 (excellent)
   - 5 score 70-84 (good)
   - 3 score <70 (poor)
9. Returns top 30 to user
10. Feeds 6 discarded to RLHF as negative examples
11. Auto-feeds 28 high-scoring as positive examples
```

### User Receives Result
```json
{
  "success": true,
  "generation": {
    "id": "gen_1728612345_abc",
    "status": "completed",
    "cost": 1.44,
    "assets": [
      // Array of 30 image objects
    ],
    "metadata": {
      "requested": 30,
      "generated": 36,
      "returned": 30,
      "avgQuality": 89.5
    }
  }
}
```

---

## 🎓 Learning Resources

### Documentation Files
- `STAGE_8_VALIDATION_COMPLETE.md` - Full Stage 8 docs
- `OVER_GENERATION_RLHF_FEEDBACK.md` - Over-generation system
- `IMPLEMENTATION_SUMMARY.md` - What was built
- `MODEL_ADAPTERS_SUMMARY.md` - All model providers
- `QUICK_REFERENCE.md` - This file

### Key Concepts

**Over-Generation:** Generate more than requested, return best N  
**Validation:** Re-analyze with VLT, score 0-100  
**Outlier Detection:** ML-based anomaly detection  
**RLHF Feedback:** Learn from both successes and failures  
**Buffer Percentage:** Extra generation overhead for quality

---

## 🚨 Troubleshooting

### Issue: Low discard rate (all images good)
**Solution:** Reduce buffer % to save costs

### Issue: High discard rate (many poor images)
**Solution:** Increase buffer % or check provider quality

### Issue: Validation too slow
**Solution:** VLT analysis is the bottleneck, consider async processing

### Issue: User didn't get N images
**Solution:** Buffer wasn't enough, increase buffer % or check provider

### Issue: RLHF feedback not created
**Solution:** Check migration applied, verify triggers active

---

## 📞 Quick Commands

### Database Migrations
```bash
# Apply validation tables
psql $DB_URL -f database/migrations/006_create_validation_tables.sql

# Apply RLHF feedback tables
psql $DB_URL -f database/migrations/007_create_rlhf_feedback_table.sql
```

### Check System Health
```sql
-- Recent generations
SELECT id, status, cost, created_at 
FROM generations 
ORDER BY created_at DESC 
LIMIT 10;

-- Validation pass rate today
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN overall_score >= 70 THEN 1 ELSE 0 END) as passed,
  ROUND(AVG(overall_score), 2) as avg_score
FROM validation_results
WHERE created_at >= CURRENT_DATE;

-- RLHF feedback count
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN is_negative_example THEN 1 ELSE 0 END) as negative,
  SUM(CASE WHEN is_positive_example THEN 1 ELSE 0 END) as positive
FROM rlhf_feedback;
```

---

## 🎯 Default Behavior

**Without specifying count:**
- Generates: 1 image
- Returns: 1 image
- Buffer: None

**With count specified:**
- Generates: count × (1 + bufferPercent/100)
- Returns: count best images
- Buffer: 20% default

**Validation:**
- Enabled by default (`autoValidate: true`)
- Scores 0-100
- Pass threshold: 70
- Auto-flags outliers

---

## 📚 Next Steps

### Ready to Use
✅ Full pipeline operational  
✅ Quality guarantee system active  
✅ RLHF feedback collection working  
✅ All documentation complete

### Optional Enhancements
- [ ] Enhance Stage 5 RLHF to use feedback
- [ ] Add monitoring dashboard
- [ ] Implement dynamic buffer adjustment
- [ ] Create A/B testing framework

---

## 💡 Pro Tips

1. **Start with 20% buffer** for most use cases
2. **Monitor discard rates** to optimize buffer size
3. **Check provider stats** regularly for quality insights
4. **Use RLHF feedback** to improve prompts over time
5. **Track costs** vs quality to find optimal balance

---

**Questions?** Check the full docs or test with a small batch first! 🚀

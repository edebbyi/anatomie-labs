# Stage 9: Intelligent Selection & Coverage Analysis

## Overview

Stage 9 implements **Determinantal Point Processes (DPP)** for diverse image selection and comprehensive **coverage analysis** to track VLT attribute representation. This stage ensures that users receive the most diverse subset from over-generated batches and enables continuous improvement through gap tracking.

## Architecture

### Key Components

1. **DPP Selection Service** (`dppSelectionService.js`)
   - Converts VLT specs to feature vectors
   - Calculates similarity matrices using RBF kernels
   - Applies greedy DPP sampling for diversity maximization
   - Returns most diverse N images from validated set

2. **Coverage Analysis Service** (`coverageAnalysisService.js`)
   - Tracks attribute distribution across selected images
   - Calculates diversity metrics (entropy, Gini coefficient)
   - Identifies coverage gaps
   - Generates recommendations for Stage 4

3. **Gap-Aware Prompt Service** (`gapAwarePromptService.js`)
   - Reads active gaps from database
   - Calculates adjusted prompt weights
   - Emphasizes underrepresented attributes
   - Feeds back to Stage 4 for next generation

## Workflow

```
┌─────────────────────────────────────────────────────────────┐
│ Stage 8: Validation Complete (~110 validated images)         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 9.1: DPP Selection                                     │
│ - Convert VLT specs to feature vectors                       │
│ - Calculate kernel matrix (quality + diversity)              │
│ - Apply greedy DPP sampling                                  │
│ - Select best 100 diverse images                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 9.2: Coverage Analysis                                 │
│ - Extract attribute distribution                             │
│ - Calculate coverage metrics                                 │
│ - Identify gaps (uncovered/underrepresented)                 │
│ - Generate recommendations                                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 9.3: Gap Tracking                                      │
│ - Store coverage report in DB                                │
│ - Create gap records (severity, missing values)              │
│ - Trigger recommendations to Stage 4                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Output: 100 Diverse Images + Coverage Report                 │
└─────────────────────────────────────────────────────────────┘
```

## DPP Selection Algorithm

### Feature Vector Construction

Each image is converted to a feature vector based on VLT attributes:

```javascript
features = {
  garmentType: oneHot(['dress', 'top', 'bottom', ...]),
  silhouette: oneHot(['fitted', 'relaxed', 'oversized', ...]),
  fabrication: oneHot(['cotton', 'silk', 'denim', ...]),
  neckline: oneHot(['crew', 'v-neck', 'scoop', ...]),
  sleeves: oneHot(['sleeveless', 'short', 'long', ...]),
  length: oneHot(['mini', 'knee', 'midi', 'maxi', ...]),
  qualityScore: normalized(0-1)
}
```

### Kernel Matrix

- **Diagonal**: Quality scores (selection probability)
- **Off-diagonal**: RBF similarity between images

```javascript
K[i][j] = {
  quality_i / 100,                          if i == j
  exp(-||v_i - v_j||² / (2σ²)),           otherwise
}
```

### Greedy DPP Sampling

Iteratively selects items that maximize marginal gain:

```
marginal_gain = quality_score * 0.6 - diversity_penalty * 0.4
```

Where diversity_penalty = average similarity to already selected items.

## Coverage Metrics

### 1. Coverage Percentage
```
coverage = (covered_values / total_values) * 100
```

### 2. Shannon Entropy (Diversity Measure)
```
entropy = -Σ(p_i * log₂(p_i))
```
Higher entropy = more uniform distribution

### 3. Gini Coefficient (Inequality Measure)
```
gini = Σ((2i - n - 1) * x_i) / (n * Σx_i)
```
0 = perfect equality, 1 = perfect inequality

### 4. Overall Diversity Score
```
diversityScore = (avgCoverage / 100) * 0.6 + (avgEntropy / 5) * 0.4
```

## Gap Identification

### Gap Severity Levels

| Severity  | Conditions |
|-----------|-----------|
| Critical  | Gap ≥ 30% OR uncovered ≥ 5 values |
| High      | Gap ≥ 15% OR uncovered ≥ 3 values |
| Medium    | Gap ≥ 5% OR uncovered ≥ 1 value |
| Low       | Gap < 5% |

### Recommended Boosts

| Gap Percentage | Boost Multiplier |
|----------------|------------------|
| ≥ 30%          | 2.0x             |
| ≥ 15%          | 1.5x             |
| ≥ 5%           | 1.2x             |
| < 5%           | 1.0x (no boost)  |

## Database Schema

### Coverage Reports
```sql
CREATE TABLE coverage_reports (
  id UUID PRIMARY KEY,
  generation_id UUID REFERENCES generations(id),
  distribution JSONB,  -- Attribute value counts
  metrics JSONB,       -- Coverage metrics
  gaps JSONB,          -- Identified gaps
  recommendations JSONB,  -- Stage 4 recommendations
  created_at TIMESTAMP
);
```

### Attribute Gaps
```sql
CREATE TABLE attribute_gaps (
  id UUID PRIMARY KEY,
  attribute VARCHAR(50),
  missing_values TEXT[],
  underrepresented_values JSONB,
  severity VARCHAR(20),
  current_coverage DECIMAL(5,2),
  target_coverage DECIMAL(5,2),
  gap_percentage DECIMAL(5,2),
  recommended_boost DECIMAL(3,2),
  applied_boost DECIMAL(3,2),
  status VARCHAR(20),  -- 'identified', 'in_progress', 'resolved', 'ignored'
  created_at TIMESTAMP
);
```

### DPP Selection Results
```sql
CREATE TABLE dpp_selection_results (
  id UUID PRIMARY KEY,
  generation_id UUID REFERENCES generations(id),
  input_count INTEGER,
  target_count INTEGER,
  selected_count INTEGER,
  selected_asset_ids UUID[],
  rejected_asset_ids UUID[],
  diversity_score DECIMAL(3,2),
  avg_coverage DECIMAL(5,2),
  avg_pairwise_distance DECIMAL(10,6),
  attribute_coverage JSONB,
  selection_duration_ms INTEGER,
  created_at TIMESTAMP
);
```

## API Endpoints

### Coverage Reports

#### Get Coverage for Generation
```http
GET /api/coverage/generation/:generationId
```

Response:
```json
{
  "generationId": "gen_123...",
  "distribution": {
    "garmentType": { "dress": 45, "top": 30, "bottom": 25 },
    "silhouette": { "fitted": 40, "relaxed": 35, "a-line": 25 }
  },
  "metrics": {
    "garmentType": {
      "coveragePercent": 75.0,
      "entropy": 1.52,
      "meetsTarget": false
    },
    "overallDiversityScore": 0.82,
    "avgCoveragePercent": 72.3
  },
  "gaps": [
    {
      "attribute": "garmentType",
      "severity": "high",
      "currentCoverage": 75.0,
      "targetCoverage": 80.0,
      "gap": 5.0,
      "uncoveredValues": ["jumpsuit", "set"],
      "recommendedBoost": 1.2
    }
  ],
  "recommendations": [...]
}
```

#### Get Active Gaps
```http
GET /api/coverage/gaps?severity=critical
```

#### Get Coverage Trends
```http
GET /api/coverage/trends?days=30&attribute=garmentType
```

#### Get Coverage Summary
```http
GET /api/coverage/summary?timeRange=30d
```

### Gap Management

#### Apply Weight Boost
```http
POST /api/coverage/gaps/:gapId/apply-boost
Content-Type: application/json

{
  "appliedBoost": 1.5
}
```

#### Mark Gap as Resolved
```http
POST /api/coverage/gaps/:gapId/resolve
```

### Configuration

#### Update Target Coverage
```http
PUT /api/coverage/config
Content-Type: application/json

{
  "targets": {
    "garmentType": 80.0,
    "silhouette": 75.0,
    "fabrication": 70.0
  }
}
```

## Integration with Stage 4

### Automatic Weight Adjustment

When Stage 4 (Model Routing / Prompt Enhancement) runs, it queries active gaps:

```javascript
const gapService = require('./gapAwarePromptService');

// Get adjusted weights based on gaps
const { weights, appliedBoosts } = await gapService.getAdjustedWeights();

// Adjust prompt to emphasize underrepresented attributes
const adjusted = await gapService.adjustPromptForGaps(prompt, vltSpec);

// Use adjusted prompt and weights for generation
```

### Feedback Loop

```
Generation → Validation → DPP Selection → Coverage Analysis
                                            ↓
                                        Gaps Identified
                                            ↓
                                    Weight Adjustments
                                            ↓
                            ← Stage 4 Prompt Enhancement
                                            ↓
                                      Next Generation
```

## Example Coverage Report

### Input
- **Generated**: 120 images
- **Validated**: 110 images (passed quality threshold)
- **Target**: 100 images

### DPP Selection
- **Selected**: 100 images
- **Diversity Score**: 0.82
- **Avg Pairwise Distance**: 2.45
- **Selection Time**: 1,250ms

### Coverage Analysis

| Attribute    | Coverage | Target | Status | Gaps |
|--------------|----------|--------|--------|------|
| Garment Type | 75%      | 80%    | ⚠️ Gap | jumpsuit, set |
| Silhouette   | 88%      | 75%    | ✅ Good | - |
| Fabrication  | 80%      | 70%    | ✅ Good | - |
| Neckline     | 63%      | 65%    | ⚠️ Gap | cowl, boat |
| Sleeves      | 71%      | 60%    | ✅ Good | - |
| Length       | 75%      | 60%    | ✅ Good | - |

**Overall Status**: Needs Improvement  
**Diversity Score**: 0.82  
**Avg Coverage**: 75.3%

### Recommendations

1. **Critical**: None
2. **High Priority** (2 gaps):
   - garmentType: Boost weight by 20% to include jumpsuit, set
   - neckline: Boost weight by 10% for cowl, boat necklines

3. **Actions**: Weight adjustments automatically applied for next batch

## Monitoring & Analytics

### Key Metrics to Track

1. **Diversity Score Trend**: Should stabilize around 0.80-0.90
2. **Gap Count**: Should decrease over time
3. **Resolution Rate**: % of gaps resolved
4. **Coverage Improvement**: Track per-attribute coverage trends

### SQL Queries

```sql
-- Coverage trend over last 30 days
SELECT * FROM coverage_trends
WHERE date >= NOW() - INTERVAL '30 days';

-- Active gaps by severity
SELECT * FROM active_attribute_gaps
ORDER BY severity DESC;

-- Gap resolution rate
SELECT 
  COUNT(*) FILTER (WHERE status = 'resolved') / COUNT(*) * 100 as resolution_rate
FROM attribute_gaps
WHERE identified_at >= NOW() - INTERVAL '30 days';
```

## Performance Considerations

### DPP Selection
- **Time Complexity**: O(n²k) where n = input count, k = target count
- **Typical Performance**: ~1-2 seconds for 110 → 100 selection
- **Optimization**: Uses greedy approximation instead of exact DPP

### Coverage Analysis
- **Time Complexity**: O(n * m) where n = images, m = attributes
- **Typical Performance**: <200ms
- **Caching**: None required (fast enough)

## Testing

### Unit Tests

```bash
# Test DPP selection
npm test -- dppSelectionService.test.js

# Test coverage analysis
npm test -- coverageAnalysisService.test.js

# Test gap-aware prompting
npm test -- gapAwarePromptService.test.js
```

### Integration Tests

```javascript
// Test full Stage 9 flow
const result = await testStage9Pipeline({
  validatedImages: mockValidatedImages(110),
  targetCount: 100
});

expect(result.selected).toHaveLength(100);
expect(result.diversityScore).toBeGreaterThan(0.7);
expect(result.coverageReport.gaps).toBeDefined();
```

## Configuration

### Environment Variables

```env
# Coverage targets
COVERAGE_TARGET_GARMENT_TYPE=80
COVERAGE_TARGET_SILHOUETTE=75
COVERAGE_TARGET_FABRICATION=70

# DPP parameters
DPP_RBF_SIGMA=1.0
DPP_QUALITY_WEIGHT=0.6
DPP_DIVERSITY_WEIGHT=0.4

# Gap tracking
GAP_TRACKING_ENABLED=true
AUTO_BOOST_ENABLED=true
MAX_BOOST_MULTIPLIER=3.0
```

## Troubleshooting

### Low Diversity Scores

**Problem**: Diversity score consistently <0.7  
**Solutions**:
- Increase over-generation buffer %
- Check if validation is too strict
- Review DPP feature weights

### Persistent Gaps

**Problem**: Same gaps appearing repeatedly  
**Solutions**:
- Verify weight boosts are being applied
- Check if Stage 4 is reading gaps
- Manually increase boost multipliers
- Review VLT taxonomy completeness

### Slow DPP Selection

**Problem**: Selection taking >5 seconds  
**Solutions**:
- Reduce input count (stricter validation)
- Optimize feature vector construction
- Consider parallelization for large batches

## Future Enhancements

1. **Advanced DPP**:
   - Implement exact DPP sampling
   - Add learned similarity metrics
   - Support multi-objective optimization

2. **Predictive Gap Analysis**:
   - ML model to predict future gaps
   - Proactive weight adjustments
   - Seasonal trend analysis

3. **Real-time Dashboards**:
   - Live coverage visualization
   - Interactive gap exploration
   - A/B testing interface

4. **Multi-tenant Support**:
   - Per-user coverage tracking
   - Custom target thresholds
   - Tenant-specific taxonomies

## References

- [Determinantal Point Processes](https://arxiv.org/abs/1207.6083)
- [DPP for Diverse Subset Selection](https://proceedings.mlr.press/v28/kulesza13.html)
- Shannon Entropy for diversity measurement
- Gini Coefficient for distribution inequality

## Support

For issues or questions about Stage 9:
1. Check logs in `pipeline_data.dppSelection` and `pipeline_data.coverage`
2. Review database: `coverage_reports`, `attribute_gaps`, `dpp_selection_results`
3. Use API endpoints to inspect coverage details
4. Monitor gap statistics via `/api/coverage/summary`

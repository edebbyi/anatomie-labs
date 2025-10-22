# Designer BFF Pipeline - Quick Start Guide

## 🚀 Get Started in 5 Minutes

This is the quick start guide for the complete Designer BFF pipeline (all 11 stages).

---

## Prerequisites

- Node.js 16+
- PostgreSQL 13+
- Python 3.8+
- OpenAI API key

---

## Installation

```bash
# 1. Clone and install
git clone <repo-url>
cd anatomie-lab
npm install
pip install -r requirements.txt

# 2. Configure environment
cp .env.example .env
# Add your API keys to .env

# 3. Setup database
psql $DATABASE_URL -f migrations/007_clustering_schema.sql
psql $DATABASE_URL -f migrations/009_coverage_analysis_schema.sql
psql $DATABASE_URL -f migrations/010_user_feedback_schema.sql

# 4. Start server
npm start
```

---

## Quick API Examples

### 1. Generate Images
```bash
curl -X POST http://localhost:3000/api/generation/generate \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "description": "elegant minimalist dress",
    "model": "stable-diffusion",
    "count": 10
  }'
```

### 2. Analyze Coverage
```bash
curl -X POST http://localhost:3000/api/coverage/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "batchId": "batch-abc",
    "userId": "user-123"
  }'
```

### 3. Submit Feedback
```bash
curl -X POST http://localhost:3000/api/feedback/submit \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "imageId": "img-456",
    "feedbackType": "positive",
    "userRating": 5
  }'
```

### 4. View Analytics Dashboard
```bash
curl http://localhost:3000/api/analytics/dashboard/user-123
```

---

## Pipeline Stages

| Stage | Feature | Status |
|-------|---------|--------|
| 1-6 | Core Generation | ✅ Complete |
| 7 | Semantic Clustering | ✅ Complete |
| 8 | Diversity Selection | ✅ Complete |
| 9 | Coverage Analysis | ✅ Complete |
| 10 | User Feedback Loop | ✅ Complete |
| 11 | Analytics Dashboard | ✅ Complete |

---

## Key Features

✅ **VLT-Powered Prompts** - 50+ fashion attributes  
✅ **Multi-Model Support** - SD, DALL-E, Midjourney  
✅ **DPP Diversity** - Mathematical diversity optimization  
✅ **Coverage Tracking** - Automatic gap detection & adjustment  
✅ **RLHF Learning** - Continuous improvement from feedback  
✅ **Real-time Analytics** - Insights and recommendations  

---

## API Endpoints

### Generation
- `POST /api/generation/generate` - Generate images
- `GET /api/generation/status/:jobId` - Check status

### Clustering
- `POST /api/clusters/analyze` - Cluster images
- `GET /api/clusters/results/:batchId` - Get clusters

### Diversity
- `POST /api/diversity/select` - DPP selection
- `GET /api/diversity/results/:selectionId` - Get results

### Coverage
- `POST /api/coverage/analyze` - Analyze coverage
- `GET /api/coverage/gaps` - List gaps
- `POST /api/coverage/adjust-prompt` - Gap-aware prompts

### Feedback
- `POST /api/feedback/submit` - Submit feedback
- `GET /api/feedback/outliers` - Get outliers
- `POST /api/feedback/process-learning` - Trigger RLHF

### Analytics
- `GET /api/analytics/dashboard/:userId` - Full dashboard
- `GET /api/analytics/recommendations/:userId` - Get recommendations
- `GET /api/analytics/style-evolution/:userId` - Track trends

---

## Expected Performance

| Metric | Target |
|--------|--------|
| Generation time | 8-12s per image |
| Clustering | <3s per batch |
| DPP selection | <5s |
| Coverage analysis | <2s |
| Feedback processing | <100ms |
| Dashboard generation | <2s |

---

## Documentation

- **[Complete Pipeline Guide](./PIPELINE_COMPLETE.md)** - Full documentation
- **[Stage 9: Coverage](./stage-9-coverage-analysis-completion.md)** - Coverage details
- **[Stage 10: Feedback](./stage-10-user-feedback-completion.md)** - Feedback loop
- **[Stage 11: Analytics](./stage-11-analytics-insights-completion.md)** - Analytics dashboard

---

## Troubleshooting

### Database Connection Error
```bash
# Check DATABASE_URL in .env
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT version();"
```

### API Key Error
```bash
# Verify API keys are set
echo $OPENAI_API_KEY
```

### Port Already in Use
```bash
# Change PORT in .env
PORT=3001 npm start
```

---

## Testing

```bash
# Health check
curl http://localhost:3000/api/analytics/health-check

# Test with sample data
psql $DATABASE_URL << EOF
INSERT INTO user_feedback (user_id, image_id, feedback_type, user_rating, is_outlier)
VALUES ('test-user', 'img-1', 'positive', 5, true);
EOF

# View analytics
curl http://localhost:3000/api/analytics/dashboard/test-user
```

---

## Next Steps

1. ✅ Generate your first batch of images
2. ✅ Analyze coverage and diversity
3. ✅ Submit feedback on results
4. ✅ View analytics dashboard
5. ✅ Get personalized recommendations

---

## Support

For detailed documentation, see:
- [PIPELINE_COMPLETE.md](./PIPELINE_COMPLETE.md)
- [Stage-specific guides](./docs/)

**Status:** 🎉 **All 11 Stages Complete - Production Ready** 🎉

---

**Version:** 1.0.0  
**Last Updated:** January 2024

# Stage 11: Analytics & Insights

## Overview

Stage 11 provides a comprehensive VLT-powered analytics dashboard that delivers actionable insights to users. The system tracks style evolution, analyzes cluster performance, evaluates attribute success rates, and generates personalized recommendations based on user data.

## Key Features

### 1. Style Evolution Tracking
- **Purpose**: Monitor how user preferences change over time
- **Features**:
  - Daily/weekly style snapshots
  - Cluster distribution analysis
  - Dominant attribute tracking (colors, styles, silhouettes, fabrications)
  - Outlier rate trends
  - CLIP score and user rating averages
  - Trend direction and strength calculation

### 2. Cluster Performance Analysis
- **Purpose**: Evaluate outlier rates per style mode
- **Features**:
  - Performance metrics by cluster/style profile
  - Provider comparison (best performing AI provider per cluster)
  - Attribute correlation with success rates
  - Performance classification (excellent, good, average, poor)
  - Best vs. worst performing cluster identification

### 3. Attribute Success Rates
- **Purpose**: Identify which VLT attributes lead to more outliers
- **Features**:
  - Success rate tracking per attribute value
  - Global attribute performance comparison
  - Top performing attributes identification
  - Attribute variance analysis
  - Usage frequency vs. success correlation

### 4. Personalized Recommendations
- **Purpose**: Provide data-driven suggestions to improve user results
- **Types**:
  - **Try New**: High-performing attributes user hasn't explored
  - **Improve Style**: Alternatives for underperforming patterns
  - **Double Down**: Reinforce successful patterns
- **Features**:
  - Priority ranking (high, medium, low)
  - Confidence scoring
  - Expected improvement estimates
  - Actionable suggestions

### 5. Insights Generation
- **Purpose**: Automatically generate actionable insights from analytics data
- **Features**:
  - Real-time insight generation
  - Insight caching (7-day expiry)
  - Confidence scoring
  - Priority ranking
  - Category classification (success, opportunity, trend)

## Database Schema

### Tables Created

#### 1. `analytics_events`
Tracks user interactions and events for analytics.

```sql
- id: UUID (Primary Key)
- user_id: UUID (Foreign Key → users)
- event_type: VARCHAR(50) - Type of event
- event_data: JSONB - Event details
- metadata: JSONB - Additional context
- created_at: TIMESTAMP
```

#### 2. `style_evolution`
Captures snapshots of user style preferences over time.

```sql
- id: UUID (Primary Key)
- user_id: UUID (Foreign Key → users)
- snapshot_date: DATE
- cluster_distribution: JSONB
- dominant_colors: JSONB
- dominant_styles: JSONB
- dominant_silhouettes: JSONB
- dominant_fabrications: JSONB
- total_generations: INTEGER
- total_outliers: INTEGER
- outlier_rate: DECIMAL(5,2)
- avg_clip_score: DECIMAL(5,4)
- avg_user_rating: DECIMAL(3,2)
- trend_direction: VARCHAR(20)
- trend_strength: DECIMAL(5,4)
- created_at: TIMESTAMP
```

#### 3. `cluster_performance`
Tracks performance metrics by style cluster.

```sql
- id: UUID (Primary Key)
- user_id: UUID (Foreign Key → users)
- cluster_id: INTEGER
- cluster_name: VARCHAR(100)
- period_start: DATE
- period_end: DATE
- total_generations: INTEGER
- total_outliers: INTEGER
- outlier_rate: DECIMAL(5,2)
- avg_clip_score: DECIMAL(5,4)
- avg_user_rating: DECIMAL(3,2)
- best_provider: VARCHAR(50)
- top_attributes: JSONB
- provider_scores: JSONB
- created_at: TIMESTAMP
```

#### 4. `insights_cache`
Stores generated insights with expiry.

```sql
- id: UUID (Primary Key)
- user_id: UUID (Foreign Key → users)
- insight_type: VARCHAR(50)
- title: TEXT
- description: TEXT
- confidence_score: DECIMAL(3,2)
- priority: INTEGER
- category: VARCHAR(50)
- metadata: JSONB
- is_active: BOOLEAN
- expires_at: TIMESTAMP
- generated_at: TIMESTAMP
```

#### 5. `personalized_recommendations`
Stores personalized recommendations for users.

```sql
- id: UUID (Primary Key)
- user_id: UUID (Foreign Key → users)
- recommendation_type: VARCHAR(50)
- title: TEXT
- description: TEXT
- action_data: JSONB
- expected_improvement: DECIMAL(5,2)
- confidence: DECIMAL(3,2)
- priority: VARCHAR(20)
- status: VARCHAR(20)
- based_on: JSONB
- expires_at: TIMESTAMP
- created_at: TIMESTAMP
```

#### 6. `global_trends`
Tracks system-wide trends for comparison.

```sql
- id: UUID (Primary Key)
- metric_name: VARCHAR(100)
- metric_value: DECIMAL(10,4)
- aggregation_period: VARCHAR(20)
- period_start: DATE
- period_end: DATE
- sample_size: INTEGER
- metadata: JSONB
- calculated_at: TIMESTAMP
```

### Materialized Views

#### 1. `vlt_attribute_success`
Aggregates success rates for VLT attributes.

#### 2. `style_profile_success`
Performance metrics by style profile.

#### 3. `provider_performance`
Comparative performance by AI provider.

#### 4. `user_analytics_summary`
High-level user analytics summary.

## API Endpoints

### Base URL
```
/api/analytics
```

All endpoints require authentication via `authMiddleware`.

### Endpoints

#### 1. Get Analytics Dashboard
```http
GET /api/analytics/dashboard?days=30
```

**Description**: Retrieve comprehensive analytics dashboard with style evolution, cluster performance, and recommendations.

**Query Parameters**:
- `days` (optional, default: 30): Number of days to analyze

**Response**:
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "period": {
      "days": 30,
      "end": "2024-01-15T00:00:00Z"
    },
    "styleEvolution": { ... },
    "clusterPerformance": { ... },
    "attributeSuccess": { ... },
    "insights": [ ... ],
    "recommendations": [ ... ],
    "generatedAt": "2024-01-15T10:30:00Z"
  }
}
```

#### 2. Get Insights Dashboard
```http
GET /api/analytics/insights
```

**Description**: Retrieve detailed insights dashboard with actionable recommendations.

**Response**:
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "generatedAt": "2024-01-15T10:30:00Z",
    "styleEvolution": { ... },
    "clusterPerformance": { ... },
    "attributeSuccess": { ... },
    "recommendations": [ ... ],
    "summary": {
      "insights": [ ... ],
      "overallHealth": {
        "score": "75",
        "rating": "good"
      },
      "actionableItems": 3
    }
  }
}
```

#### 3. Get Style Evolution
```http
GET /api/analytics/style-evolution?days=30
```

**Description**: Track how user's style preferences evolve over time.

**Response**:
```json
{
  "success": true,
  "data": {
    "snapshots": [ ... ],
    "currentState": { ... },
    "trend": {
      "direction": "improving",
      "strength": 0.5,
      "description": "↑ 5.2% change"
    },
    "insights": [ ... ]
  }
}
```

#### 4. Capture Style Snapshot
```http
POST /api/analytics/style-snapshot
```

**Description**: Manually trigger a style snapshot capture.

**Response**:
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "snapshotDate": "2024-01-15",
    "totalGenerations": 45,
    "totalOutliers": 28,
    "outlierRate": "62.22"
  },
  "message": "Style snapshot captured successfully"
}
```

#### 5. Get Cluster Performance
```http
GET /api/analytics/cluster-performance?days=30
```

**Description**: Analyze performance by style cluster.

**Response**:
```json
{
  "success": true,
  "data": {
    "clusters": [
      {
        "cluster_id": 1,
        "cluster_name": "minimalist",
        "outlier_rate": "65.00",
        "performance": "excellent",
        "insights": [ ... ]
      }
    ],
    "summary": {
      "bestPerforming": { ... },
      "worstPerforming": { ... }
    }
  }
}
```

#### 6. Get Attribute Success Rates
```http
GET /api/analytics/attribute-success
```

**Description**: Retrieve success rates for different VLT attributes.

**Response**:
```json
{
  "success": true,
  "data": {
    "byAttribute": {
      "color": [ ... ],
      "style": [ ... ]
    },
    "topPerformers": [ ... ],
    "insights": [ ... ]
  }
}
```

#### 7. Get Recommendations
```http
GET /api/analytics/recommendations?limit=5
```

**Description**: Retrieve personalized recommendations.

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "recommendation_type": "try_new",
      "title": "Try emerald green",
      "description": "...",
      "expected_improvement": "15.00",
      "confidence": "0.85",
      "priority": "high"
    }
  ]
}
```

#### 8. Get Personalized Recommendations
```http
GET /api/analytics/personalized-recommendations
```

**Description**: Get detailed personalized recommendations with insights.

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "type": "try_new",
      "priority": "high",
      "attribute": "color",
      "value": "emerald",
      "outlierRate": 65.0,
      "message": "...",
      "confidence": "high"
    }
  ]
}
```

#### 9. Generate Insights
```http
POST /api/analytics/generate-insights
```

**Description**: Generate fresh insights for user.

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "type": "cluster_performance",
      "title": "...",
      "description": "...",
      "confidence": 0.85,
      "category": "success",
      "priority": 10
    }
  ],
  "message": "Insights generated successfully"
}
```

#### 10. Get Recent Insights
```http
GET /api/analytics/recent-insights?limit=5
```

**Description**: Retrieve cached recent insights.

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "insight_type": "style_evolution",
      "title": "...",
      "description": "...",
      "confidence_score": 0.75,
      "category": "trend",
      "generated_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

#### 11. Get Global Trends
```http
GET /api/analytics/global-trends
```

**Description**: Retrieve global trends for comparison.

**Response**:
```json
{
  "success": true,
  "data": {
    "globalAttributeSuccess": { ... },
    "message": "Compare your performance to global trends"
  }
}
```

#### 12. Clear Cache
```http
DELETE /api/analytics/cache
```

**Description**: Clear insights cache.

**Response**:
```json
{
  "success": true,
  "message": "Cache cleared successfully"
}
```

## Services

### 1. Analytics Service (`analyticsService.js`)

Main analytics engine providing core functionality.

**Key Methods**:
- `getUserDashboard(userId, options)` - Get comprehensive dashboard
- `getStyleEvolution(userId, days)` - Track style evolution
- `captureStyleSnapshot(userId)` - Capture style snapshot
- `getClusterPerformance(userId, days)` - Analyze cluster performance
- `getAttributeSuccessRates(userId)` - Get attribute success rates
- `getRecommendations(userId, limit)` - Get recommendations
- `generateInsights(userId)` - Generate insights
- `getRecentInsights(userId, limit)` - Get cached insights

### 2. Analytics Insights Service (`analyticsInsightsService.js`)

Advanced insights generation and recommendations.

**Key Methods**:
- `getUserInsightsDashboard(userId)` - Get complete insights dashboard
- `getStyleEvolution(userId)` - Analyze style evolution with trends
- `getClusterPerformance(userId)` - Performance with global comparison
- `getAttributeSuccessRates(userId)` - Global attribute success rates
- `getPersonalizedRecommendations(userId)` - Generate personalized recommendations
- `generateInsightsSummary(data)` - Create summary insights
- `calculateOverallHealth(data)` - Calculate health score

## Testing

### Running Tests

```bash
# Run all analytics tests
npm test tests/analyticsService.test.js
npm test tests/analyticsInsightsService.test.js

# Run with coverage
npm test -- --coverage tests/analytics*.test.js
```

### Test Coverage

- **Analytics Service**: 
  - Dashboard generation
  - Style evolution tracking
  - Snapshot capture
  - Cluster performance
  - Attribute success rates
  - Insights generation
  - Helper methods

- **Insights Service**:
  - Insights dashboard
  - Style evolution analysis
  - Cluster performance with global comparison
  - Personalized recommendations
  - Helper utilities
  - Cache management

## Usage Examples

### 1. Get User Dashboard

```javascript
const dashboard = await analyticsService.getUserDashboard(userId, { days: 30 });

console.log('Style Evolution:', dashboard.styleEvolution.trend);
console.log('Best Cluster:', dashboard.clusterPerformance.summary.bestPerforming);
console.log('Recommendations:', dashboard.recommendations);
```

### 2. Capture Daily Snapshot

```javascript
// Can be run as a cron job
const snapshot = await analyticsService.captureStyleSnapshot(userId);
console.log(`Captured snapshot with ${snapshot.outlierRate}% outlier rate`);
```

### 3. Get Personalized Recommendations

```javascript
const recommendations = await analyticsInsightsService.getPersonalizedRecommendations(userId);

recommendations.forEach(rec => {
  console.log(`[${rec.priority}] ${rec.message}`);
});
```

### 4. Generate Fresh Insights

```javascript
const insights = await analyticsService.generateInsights(userId);

insights.forEach(insight => {
  console.log(`${insight.title} (confidence: ${insight.confidence})`);
});
```

## Automation Opportunities

### 1. Daily Snapshot Capture
Schedule a cron job to capture daily style snapshots:

```javascript
// Cron: 0 2 * * * (2 AM daily)
const users = await getActiveUsers();
for (const user of users) {
  await analyticsService.captureStyleSnapshot(user.id);
}
```

### 2. Weekly Insights Generation
Generate fresh insights weekly:

```javascript
// Cron: 0 8 * * 1 (8 AM Monday)
const users = await getActiveUsers();
for (const user of users) {
  await analyticsService.generateInsights(user.id);
}
```

### 3. Materialized View Refresh
Refresh materialized views periodically:

```sql
-- Refresh hourly
REFRESH MATERIALIZED VIEW CONCURRENTLY vlt_attribute_success;
REFRESH MATERIALIZED VIEW CONCURRENTLY style_profile_success;
REFRESH MATERIALIZED VIEW CONCURRENTLY provider_performance;
```

## Performance Considerations

1. **Caching**:
   - Insights are cached for 7 days
   - In-memory cache with 5-minute timeout
   - Use `DELETE /api/analytics/cache` to invalidate

2. **Materialized Views**:
   - Pre-computed aggregations for faster queries
   - Refresh concurrently to avoid blocking
   - Schedule refreshes during off-peak hours

3. **Query Optimization**:
   - Indexes on frequently queried columns
   - JSONB GIN indexes for attribute searches
   - Composite indexes for user + date queries

4. **Data Retention**:
   - Consider archiving old analytics events (>90 days)
   - Expired insights auto-cleanup via triggers
   - Aggregate old snapshots into monthly summaries

## Integration with Other Stages

Stage 11 integrates with:

- **Stage 6 (RLHF)**: Uses feedback data for insights
- **Stage 7 (Style Clustering)**: Analyzes cluster performance
- **Stage 8 (Outlier Detection)**: Tracks outlier rates
- **Stage 9 (Coverage)**: Monitors coverage gaps
- **Stage 10 (Prompt Templates)**: Analyzes prompt effectiveness

## Future Enhancements

1. **Predictive Analytics**:
   - ML models to predict successful combinations
   - Trend forecasting
   - User behavior prediction

2. **A/B Testing Framework**:
   - Test different prompt strategies
   - Compare provider performance
   - Optimize attribute combinations

3. **Advanced Visualizations**:
   - Interactive charts and graphs
   - Heat maps for attribute correlations
   - Timeline visualizations

4. **Social Features**:
   - Compare with similar users
   - Trending styles in community
   - Collaborative filtering

5. **Export Capabilities**:
   - CSV/PDF reports
   - Data export API
   - Scheduled email reports

## Troubleshooting

### Common Issues

1. **No insights generated**:
   - Check if user has sufficient data (min 10 generations)
   - Verify database migrations are applied
   - Check logs for errors

2. **Slow dashboard loading**:
   - Refresh materialized views
   - Check database indexes
   - Reduce query date range

3. **Outdated recommendations**:
   - Clear insights cache
   - Trigger fresh insights generation
   - Check expiry timestamps

## Contributing

When contributing to Stage 11:

1. Add tests for new features
2. Update materialized views if adding new metrics
3. Document new API endpoints
4. Consider performance impact of new queries
5. Update this documentation

## License

Part of the Anatomie Lab project.

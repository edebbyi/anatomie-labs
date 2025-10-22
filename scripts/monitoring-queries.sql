-- ============================================
-- Monitoring Dashboard Queries
-- ============================================
-- Use these queries to monitor quality, costs, and learning metrics

-- ============================================
-- 1. QUALITY METRICS
-- ============================================

-- Overall quality trend (last 30 days)
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_generations,
  ROUND(AVG(
    (pipeline_data->'filtering'->>'avgReturnedScore')::numeric
  ), 2) as avg_quality_score,
  SUM((pipeline_data->'filtering'->>'discarded')::integer) as total_discarded,
  ROUND(AVG((pipeline_data->'filtering'->>'discarded')::numeric), 2) as avg_discarded_per_generation
FROM generations
WHERE created_at >= NOW() - INTERVAL '30 days'
  AND pipeline_data->'filtering' IS NOT NULL
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Provider quality comparison
SELECT 
  provider_name,
  total_validations,
  ROUND(avg_overall_score, 2) as avg_score,
  ROUND(pass_rate, 1) as pass_rate_percent,
  outlier_count,
  rejected_count
FROM provider_validation_stats
ORDER BY avg_overall_score DESC;

-- Validation score distribution
SELECT 
  CASE 
    WHEN overall_score >= 90 THEN '90-100 (Excellent)'
    WHEN overall_score >= 80 THEN '80-89 (Great)'
    WHEN overall_score >= 70 THEN '70-79 (Good)'
    WHEN overall_score >= 60 THEN '60-69 (Fair)'
    ELSE '0-59 (Poor)'
  END as score_range,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM validation_results
WHERE status = 'completed'
GROUP BY score_range
ORDER BY score_range DESC;

-- ============================================
-- 2. COST METRICS
-- ============================================

-- Daily cost breakdown
SELECT 
  DATE(created_at) as date,
  COUNT(*) as generations,
  ROUND(SUM(cost), 2) as total_cost,
  ROUND(AVG(cost), 2) as avg_cost_per_generation,
  ROUND(SUM(cost) / NULLIF(SUM(
    COALESCE((pipeline_data->'overGeneration'->>'returned')::integer, 1)
  ), 0), 4) as cost_per_returned_image
FROM generations
WHERE created_at >= NOW() - INTERVAL '30 days'
  AND status = 'completed'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Cost by provider
SELECT 
  mp.name as provider,
  COUNT(DISTINCT g.id) as generations,
  ROUND(SUM(g.cost), 2) as total_cost,
  ROUND(AVG(g.cost), 2) as avg_cost,
  ROUND(AVG(vr.overall_score), 2) as avg_quality,
  ROUND(SUM(g.cost) / NULLIF(AVG(vr.overall_score), 0) * 100, 2) as cost_per_quality_point
FROM generations g
JOIN generation_assets ga ON g.id = ga.generation_id
LEFT JOIN model_providers mp ON ga.provider_id = mp.id
LEFT JOIN validation_results vr ON ga.id = vr.asset_id
WHERE g.created_at >= NOW() - INTERVAL '30 days'
  AND g.status = 'completed'
GROUP BY mp.name
ORDER BY cost_per_quality_point ASC;

-- Buffer efficiency (cost vs benefit)
SELECT 
  (pipeline_data->'overGeneration'->>'requested')::integer as requested,
  (pipeline_data->'overGeneration'->>'generated')::integer as generated,
  (pipeline_data->'overGeneration'->>'generated')::integer - 
    (pipeline_data->'overGeneration'->>'requested')::integer as buffer_size,
  ROUND(
    ((pipeline_data->'overGeneration'->>'generated')::integer::numeric - 
     (pipeline_data->'overGeneration'->>'requested')::integer) / 
    (pipeline_data->'overGeneration'->>'requested')::integer * 100, 2
  ) as buffer_percent,
  ROUND((pipeline_data->'filtering'->>'avgReturnedScore')::numeric, 2) as avg_quality,
  (pipeline_data->'filtering'->>'discarded')::integer as discarded,
  cost
FROM generations
WHERE pipeline_data->'overGeneration' IS NOT NULL
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 20;

-- ============================================
-- 3. RLHF LEARNING METRICS
-- ============================================

-- Negative feedback trends
SELECT 
  DATE(created_at) as date,
  COUNT(*) as negative_examples,
  ROUND(AVG(quality_score), 2) as avg_quality,
  COUNT(DISTINCT generation_id) as affected_generations
FROM rlhf_feedback
WHERE is_negative_example = TRUE
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Positive feedback trends
SELECT 
  DATE(created_at) as date,
  COUNT(*) as positive_examples,
  ROUND(AVG(quality_score), 2) as avg_quality,
  COUNT(DISTINCT generation_id) as affected_generations
FROM rlhf_feedback
WHERE is_positive_example = TRUE
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Learning progress by provider
SELECT 
  provider_name,
  negative_count as failures,
  positive_count as successes,
  ROUND(positive_count::numeric / NULLIF(negative_count + positive_count, 0) * 100, 2) as success_rate,
  ROUND(avg_quality_score, 2) as avg_score
FROM rlhf_feedback_summary
ORDER BY success_rate DESC, avg_quality_score DESC;

-- Most common failure types
SELECT 
  feedback_type,
  COUNT(*) as count,
  ROUND(AVG(quality_score), 2) as avg_score,
  COUNT(DISTINCT generation_id) as affected_generations
FROM rlhf_feedback
WHERE is_negative_example = TRUE
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY feedback_type
ORDER BY count DESC;

-- ============================================
-- 4. DISCARD RATE ANALYSIS
-- ============================================

-- Overall discard rate trend
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_generations,
  SUM((pipeline_data->'overGeneration'->>'generated')::integer) as total_generated,
  SUM((pipeline_data->'overGeneration'->>'returned')::integer) as total_returned,
  SUM((pipeline_data->'filtering'->>'discarded')::integer) as total_discarded,
  ROUND(
    SUM((pipeline_data->'filtering'->>'discarded')::integer)::numeric / 
    NULLIF(SUM((pipeline_data->'overGeneration'->>'generated')::integer), 0) * 100, 
    2
  ) as discard_rate_percent
FROM generations
WHERE created_at >= NOW() - INTERVAL '30 days'
  AND pipeline_data->'overGeneration' IS NOT NULL
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Discard rate by provider
SELECT 
  provider_name,
  negative_count as discarded,
  feedback_count as total_feedback,
  ROUND(negative_count::numeric / NULLIF(feedback_count, 0) * 100, 2) as discard_rate,
  ROUND(avg_quality_score, 2) as avg_discarded_quality
FROM rlhf_feedback_summary
WHERE feedback_type = 'discarded'
ORDER BY discard_rate DESC;

-- ============================================
-- 5. PERFORMANCE METRICS
-- ============================================

-- Generation time analysis
SELECT 
  DATE(created_at) as date,
  COUNT(*) as generations,
  ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - created_at))), 2) as avg_duration_seconds,
  MIN(EXTRACT(EPOCH FROM (completed_at - created_at))) as min_duration,
  MAX(EXTRACT(EPOCH FROM (completed_at - created_at))) as max_duration
FROM generations
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND status = 'completed'
  AND completed_at IS NOT NULL
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Pipeline stage breakdown (from pipeline_data)
SELECT 
  AVG(
    (pipeline_data->'validation'->>'total')::integer
  ) as avg_images_validated,
  AVG(
    EXTRACT(EPOCH FROM (
      (pipeline_data->'validation'->>'validated_at')::timestamp - created_at
    ))
  ) as avg_validation_time_seconds
FROM generations
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND pipeline_data->'validation' IS NOT NULL;

-- ============================================
-- 6. ALERTING QUERIES
-- ============================================

-- High discard rate alert (>30%)
SELECT 
  id,
  created_at,
  (pipeline_data->'filtering'->>'discarded')::integer as discarded,
  (pipeline_data->'overGeneration'->>'generated')::integer as generated,
  ROUND(
    (pipeline_data->'filtering'->>'discarded')::integer::numeric / 
    (pipeline_data->'overGeneration'->>'generated')::integer * 100, 
    2
  ) as discard_rate
FROM generations
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND (pipeline_data->'filtering'->>'discarded')::integer::numeric / 
      (pipeline_data->'overGeneration'->>'generated')::integer > 0.3
ORDER BY created_at DESC;

-- Low quality alert (avg score <70)
SELECT 
  id,
  created_at,
  (pipeline_data->'filtering'->>'avgReturnedScore')::numeric as avg_score,
  (pipeline_data->'overGeneration'->>'returned')::integer as returned_count
FROM generations
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND (pipeline_data->'filtering'->>'avgReturnedScore')::numeric < 70
ORDER BY avg_score ASC;

-- Failed generations
SELECT 
  id,
  created_at,
  status,
  error_message,
  cost
FROM generations
WHERE status = 'failed'
  AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- ============================================
-- 7. SUMMARY DASHBOARD
-- ============================================

-- Daily summary
SELECT 
  'Today' as period,
  COUNT(*) as generations,
  ROUND(AVG((pipeline_data->'filtering'->>'avgReturnedScore')::numeric), 2) as avg_quality,
  ROUND(SUM(cost), 2) as total_cost,
  SUM((pipeline_data->'overGeneration'->>'returned')::integer) as images_returned,
  SUM((pipeline_data->'filtering'->>'discarded')::integer) as images_discarded
FROM generations
WHERE DATE(created_at) = CURRENT_DATE
  AND status = 'completed'
UNION ALL
SELECT 
  'Last 7 Days' as period,
  COUNT(*),
  ROUND(AVG((pipeline_data->'filtering'->>'avgReturnedScore')::numeric), 2),
  ROUND(SUM(cost), 2),
  SUM((pipeline_data->'overGeneration'->>'returned')::integer),
  SUM((pipeline_data->'filtering'->>'discarded')::integer)
FROM generations
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND status = 'completed'
UNION ALL
SELECT 
  'Last 30 Days' as period,
  COUNT(*),
  ROUND(AVG((pipeline_data->'filtering'->>'avgReturnedScore')::numeric), 2),
  ROUND(SUM(cost), 2),
  SUM((pipeline_data->'overGeneration'->>'returned')::integer),
  SUM((pipeline_data->'filtering'->>'discarded')::integer)
FROM generations
WHERE created_at >= NOW() - INTERVAL '30 days'
  AND status = 'completed';

-- RLHF Learning summary
SELECT 
  'RLHF Feedback' as metric,
  COUNT(*) as total,
  SUM(CASE WHEN is_negative_example THEN 1 ELSE 0 END) as negative,
  SUM(CASE WHEN is_positive_example THEN 1 ELSE 0 END) as positive,
  ROUND(AVG(quality_score), 2) as avg_score
FROM rlhf_feedback
WHERE created_at >= NOW() - INTERVAL '30 days';

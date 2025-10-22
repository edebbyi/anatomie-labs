const express = require('express');
const router = express.Router();
const coverageAnalysisService = require('../services/coverageAnalysisService');
const db = require('../services/database');
const logger = require('../utils/logger');

/**
 * Stage 9: Coverage Analysis & Gap Tracking API Routes
 */

/**
 * GET /coverage/generation/:generationId
 * Get coverage report for a specific generation
 */
router.get('/generation/:generationId', async (req, res) => {
  try {
    const { generationId } = req.params;

    const client = await db.getClient();
    try {
      const result = await client.query(`
        SELECT *
        FROM coverage_reports
        WHERE generation_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `, [generationId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Coverage report not found for this generation'
        });
      }

      const report = result.rows[0];
      
      res.json({
        generationId,
        distribution: report.distribution,
        metrics: report.metrics,
        gaps: report.gaps,
        recommendations: report.recommendations,
        createdAt: report.created_at
      });
    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Failed to get coverage report', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve coverage report' });
  }
});

/**
 * GET /coverage/gaps
 * Get active attribute gaps
 */
router.get('/gaps', async (req, res) => {
  try {
    const { status = 'identified', severity } = req.query;

    const client = await db.getClient();
    try {
      let query = 'SELECT * FROM active_attribute_gaps WHERE 1=1';
      const params = [];

      if (severity) {
        params.push(severity);
        query += ` AND severity = $${params.length}`;
      }

      query += ' LIMIT 100';

      const result = await client.query(query, params);

      res.json({
        gaps: result.rows,
        count: result.rows.length
      });
    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Failed to get active gaps', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve gaps' });
  }
});

/**
 * GET /coverage/trends
 * Get historical coverage trends
 */
router.get('/trends', async (req, res) => {
  try {
    const { days = 30, attribute } = req.query;

    const trends = await coverageAnalysisService.getCoverageTrends({
      days: parseInt(days),
      attribute
    });

    res.json({
      trends,
      period: `${days} days`,
      attribute: attribute || 'all'
    });

  } catch (error) {
    logger.error('Failed to get coverage trends', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve trends' });
  }
});

/**
 * GET /coverage/summary
 * Get overall coverage summary across all generations
 */
router.get('/summary', async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;

    const client = await db.getClient();
    try {
      const result = await client.query(`
        SELECT 
          COUNT(*) as total_reports,
          AVG((metrics->>'overallDiversityScore')::numeric) as avg_diversity_score,
          AVG((metrics->>'avgCoveragePercent')::numeric) as avg_coverage,
          COUNT(DISTINCT generation_id) as unique_generations
        FROM coverage_reports
        WHERE created_at >= NOW() - INTERVAL '${timeRange === '7d' ? '7 days' : timeRange === '90d' ? '90 days' : '30 days'}'
      `);

      const gapsResult = await client.query(`
        SELECT 
          COUNT(*) as total_gaps,
          SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical_gaps,
          SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high_gaps,
          SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_gaps
        FROM attribute_gaps
        WHERE identified_at >= NOW() - INTERVAL '${timeRange === '7d' ? '7 days' : timeRange === '90d' ? '90 days' : '30 days'}'
      `);

      const summary = result.rows[0];
      const gaps = gapsResult.rows[0];

      res.json({
        timeRange,
        summary: {
          totalReports: parseInt(summary.total_reports),
          avgDiversityScore: parseFloat(summary.avg_diversity_score) || 0,
          avgCoverage: parseFloat(summary.avg_coverage) || 0,
          uniqueGenerations: parseInt(summary.unique_generations)
        },
        gaps: {
          total: parseInt(gaps.total_gaps),
          critical: parseInt(gaps.critical_gaps),
          high: parseInt(gaps.high_gaps),
          resolved: parseInt(gaps.resolved_gaps),
          resolutionRate: gaps.total_gaps > 0 
            ? ((gaps.resolved_gaps / gaps.total_gaps) * 100).toFixed(1)
            : 0
        }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Failed to get coverage summary', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve summary' });
  }
});

/**
 * GET /coverage/attributes/:attribute
 * Get detailed coverage for a specific attribute
 */
router.get('/attributes/:attribute', async (req, res) => {
  try {
    const { attribute } = req.params;
    const { days = 30 } = req.query;

    const client = await db.getClient();
    try {
      // Get historical data for this attribute
      const result = await client.query(`
        SELECT 
          DATE(created_at) as date,
          generation_id,
          (metrics->$1)::jsonb as attribute_metrics
        FROM coverage_reports
        WHERE created_at >= NOW() - INTERVAL '${parseInt(days)} days'
          AND metrics->>$1 IS NOT NULL
        ORDER BY created_at DESC
      `, [attribute]);

      // Get current gaps for this attribute
      const gapsResult = await client.query(`
        SELECT *
        FROM attribute_gaps
        WHERE attribute = $1
          AND status IN ('identified', 'in_progress')
        ORDER BY severity DESC, identified_at DESC
      `, [attribute]);

      res.json({
        attribute,
        history: result.rows.map(row => ({
          date: row.date,
          generationId: row.generation_id,
          metrics: row.attribute_metrics
        })),
        currentGaps: gapsResult.rows
      });

    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Failed to get attribute coverage', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve attribute coverage' });
  }
});

/**
 * GET /coverage/dpp/:generationId
 * Get DPP selection results for a generation
 */
router.get('/dpp/:generationId', async (req, res) => {
  try {
    const { generationId } = req.params;

    const client = await db.getClient();
    try {
      const result = await client.query(`
        SELECT *
        FROM dpp_selection_results
        WHERE generation_id = $1
      `, [generationId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'DPP selection results not found for this generation'
        });
      }

      res.json(result.rows[0]);

    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Failed to get DPP results', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve DPP results' });
  }
});

/**
 * POST /coverage/gaps/:gapId/resolve
 * Mark a gap as resolved
 */
router.post('/gaps/:gapId/resolve', async (req, res) => {
  try {
    const { gapId } = req.params;
    const { notes } = req.body;

    const client = await db.getClient();
    try {
      const result = await client.query(`
        UPDATE attribute_gaps
        SET 
          status = 'resolved',
          resolved_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [gapId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Gap not found' });
      }

      logger.info('Gap marked as resolved', { gapId, notes });

      res.json({
        message: 'Gap marked as resolved',
        gap: result.rows[0]
      });

    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Failed to resolve gap', { error: error.message });
    res.status(500).json({ error: 'Failed to resolve gap' });
  }
});

/**
 * POST /coverage/gaps/:gapId/apply-boost
 * Mark a weight boost as applied to a gap
 */
router.post('/gaps/:gapId/apply-boost', async (req, res) => {
  try {
    const { gapId } = req.params;
    const { appliedBoost } = req.body;

    if (!appliedBoost || appliedBoost < 1.0 || appliedBoost > 3.0) {
      return res.status(400).json({
        error: 'Applied boost must be between 1.0 and 3.0'
      });
    }

    const client = await db.getClient();
    try {
      const result = await client.query(`
        UPDATE attribute_gaps
        SET 
          applied_boost = $2,
          boost_applied_at = NOW(),
          status = 'in_progress',
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [gapId, appliedBoost]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Gap not found' });
      }

      logger.info('Weight boost applied to gap', { gapId, appliedBoost });

      res.json({
        message: 'Weight boost applied',
        gap: result.rows[0]
      });

    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Failed to apply boost', { error: error.message });
    res.status(500).json({ error: 'Failed to apply boost' });
  }
});

/**
 * PUT /coverage/config
 * Update coverage configuration (target thresholds)
 */
router.put('/config', async (req, res) => {
  try {
    const { targets } = req.body;

    if (!targets || typeof targets !== 'object') {
      return res.status(400).json({
        error: 'Invalid request body. Expected { targets: { attribute: percentage } }'
      });
    }

    // Update in service
    coverageAnalysisService.updateTargetCoverage(targets);

    // Update in database
    const client = await db.getClient();
    try {
      for (const [attribute, targetCoverage] of Object.entries(targets)) {
        await client.query(`
          INSERT INTO coverage_config (attribute, target_coverage, updated_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (attribute) DO UPDATE
          SET target_coverage = EXCLUDED.target_coverage,
              updated_at = NOW()
        `, [attribute, targetCoverage]);
      }

      res.json({
        message: 'Coverage configuration updated',
        targets
      });

    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Failed to update config', { error: error.message });
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

/**
 * GET /coverage/config
 * Get current coverage configuration
 */
router.get('/config', async (req, res) => {
  try {
    const client = await db.getClient();
    try {
      const result = await client.query(`
        SELECT *
        FROM coverage_config
        ORDER BY attribute
      `);

      res.json({
        config: result.rows
      });

    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Failed to get config', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve configuration' });
  }
});

module.exports = router;

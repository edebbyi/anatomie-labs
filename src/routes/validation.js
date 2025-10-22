const express = require('express');
const validationService = require('../services/validationService');
const logger = require('../utils/logger');
const db = require('../utils/db');

const router = express.Router();

/**
 * POST /api/validation/validate/:generationId
 * Trigger validation for a specific generation
 */
router.post('/validate/:generationId', async (req, res) => {
  try {
    const { generationId } = req.params;
    const { assetId, forceRevalidate = false } = req.body;

    logger.info('Validation request received', {
      generationId,
      assetId,
      forceRevalidate
    });

    // Check if generation exists
    const client = await db.getClient();
    try {
      const genResult = await client.query(
        'SELECT id, status FROM generations WHERE id = $1',
        [generationId]
      );

      if (genResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Generation not found'
        });
      }

      // Check if already validated (unless force revalidate)
      if (!forceRevalidate) {
        const existingValidation = await client.query(
          'SELECT id, status FROM validation_results WHERE generation_id = $1 AND ($2::integer IS NULL OR asset_id = $2)',
          [generationId, assetId || null]
        );

        if (existingValidation.rows.length > 0 && existingValidation.rows[0].status === 'completed') {
          return res.json({
            success: true,
            message: 'Validation already exists',
            validation: existingValidation.rows[0],
            cached: true
          });
        }
      }

      // Trigger validation
      const result = await validationService.validateGeneration(generationId, assetId);

      res.json({
        success: true,
        validation: result,
        cached: false
      });

    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Validation request failed', {
      generationId: req.params.generationId,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/validation/results/:generationId
 * Get validation results for a generation
 */
router.get('/results/:generationId', async (req, res) => {
  try {
    const { generationId } = req.params;
    const { includeDetails = false } = req.query;

    const client = await db.getClient();
    try {
      let query;
      if (includeDetails === 'true') {
        // Get full details with attribute comparisons
        query = `
          SELECT 
            vr.*,
            json_agg(
              json_build_object(
                'id', ac.id,
                'attribute_name', ac.attribute_name,
                'target_value', ac.target_value,
                'detected_value', ac.detected_value,
                'match_type', ac.match_type,
                'similarity_score', ac.similarity_score,
                'is_match', ac.is_match,
                'weight', ac.weight
              ) ORDER BY ac.similarity_score DESC
            ) FILTER (WHERE ac.id IS NOT NULL) as attribute_comparisons
          FROM validation_results vr
          LEFT JOIN attribute_comparisons ac ON vr.id = ac.validation_result_id
          WHERE vr.generation_id = $1
          GROUP BY vr.id
          ORDER BY vr.created_at DESC
        `;
      } else {
        // Get summary only
        query = `
          SELECT * FROM validation_results
          WHERE generation_id = $1
          ORDER BY created_at DESC
        `;
      }

      const result = await client.query(query, [generationId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No validation results found for this generation'
        });
      }

      res.json({
        success: true,
        validations: result.rows
      });

    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Get validation results failed', {
      generationId: req.params.generationId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/validation/flagged
 * Get flagged or rejected validations
 */
router.get('/flagged', async (req, res) => {
  try {
    const {
      userId,
      providerId,
      flaggedOnly = false,
      rejectedOnly = false,
      limit = 50,
      offset = 0
    } = req.query;

    const client = await db.getClient();
    try {
      let whereConditions = ['(vr.is_flagged = TRUE OR vr.is_rejected = TRUE)'];
      const queryParams = [];
      let paramCount = 0;

      if (flaggedOnly === 'true') {
        whereConditions = ['vr.is_flagged = TRUE'];
      } else if (rejectedOnly === 'true') {
        whereConditions = ['vr.is_rejected = TRUE'];
      }

      if (userId) {
        paramCount++;
        queryParams.push(userId);
        whereConditions.push(`g.user_id = $${paramCount}`);
      }

      if (providerId) {
        paramCount++;
        queryParams.push(providerId);
        whereConditions.push(`ga.provider_id = $${paramCount}`);
      }

      paramCount++;
      queryParams.push(parseInt(limit));
      const limitParam = `$${paramCount}`;

      paramCount++;
      queryParams.push(parseInt(offset));
      const offsetParam = `$${paramCount}`;

      const query = `
        SELECT 
          vr.id,
          vr.generation_id,
          vr.asset_id,
          vr.overall_score,
          vr.consistency_score,
          vr.style_consistency_score,
          vr.is_outlier,
          vr.is_flagged,
          vr.is_rejected,
          vr.rejection_reason,
          vr.created_at,
          ga.cdn_url,
          ga.provider_id,
          mp.name as provider_name,
          g.user_id,
          g.status as generation_status
        FROM validation_results vr
        JOIN generation_assets ga ON vr.asset_id = ga.id
        LEFT JOIN model_providers mp ON ga.provider_id = mp.id
        JOIN generations g ON vr.generation_id = g.id
        WHERE ${whereConditions.join(' AND ')}
          AND vr.status = 'completed'
        ORDER BY vr.created_at DESC
        LIMIT ${limitParam} OFFSET ${offsetParam}
      `;

      const result = await client.query(query, queryParams);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM validation_results vr
        JOIN generation_assets ga ON vr.asset_id = ga.id
        JOIN generations g ON vr.generation_id = g.id
        WHERE ${whereConditions.join(' AND ')}
          AND vr.status = 'completed'
      `;
      
      const countResult = await client.query(countQuery, queryParams.slice(0, -2));

      res.json({
        success: true,
        flagged: result.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: parseInt(countResult.rows[0].total),
          hasMore: parseInt(offset) + result.rows.length < parseInt(countResult.rows[0].total)
        }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Get flagged validations failed', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/validation/:validationId/review
 * Review and update a flagged validation
 */
router.put('/:validationId/review', async (req, res) => {
  try {
    const { validationId } = req.params;
    const {
      reviewAction, // 'approve', 'reject', 'flag', 'unflag'
      rejectionReason,
      reviewerId
    } = req.body;

    if (!reviewAction) {
      return res.status(400).json({
        success: false,
        error: 'reviewAction is required'
      });
    }

    const client = await db.getClient();
    try {
      // Get current validation
      const currentResult = await client.query(
        'SELECT * FROM validation_results WHERE id = $1',
        [validationId]
      );

      if (currentResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Validation not found'
        });
      }

      let updateQuery;
      let updateParams;

      switch (reviewAction) {
        case 'approve':
          updateQuery = `
            UPDATE validation_results
            SET is_rejected = FALSE, is_flagged = FALSE, rejection_reason = NULL, updated_at = NOW()
            WHERE id = $1
            RETURNING *
          `;
          updateParams = [validationId];
          break;

        case 'reject':
          if (!rejectionReason) {
            return res.status(400).json({
              success: false,
              error: 'rejectionReason is required for reject action'
            });
          }
          updateQuery = `
            UPDATE validation_results
            SET is_rejected = TRUE, rejection_reason = $2, updated_at = NOW()
            WHERE id = $1
            RETURNING *
          `;
          updateParams = [validationId, rejectionReason];
          break;

        case 'flag':
          updateQuery = `
            UPDATE validation_results
            SET is_flagged = TRUE, updated_at = NOW()
            WHERE id = $1
            RETURNING *
          `;
          updateParams = [validationId];
          break;

        case 'unflag':
          updateQuery = `
            UPDATE validation_results
            SET is_flagged = FALSE, updated_at = NOW()
            WHERE id = $1
            RETURNING *
          `;
          updateParams = [validationId];
          break;

        default:
          return res.status(400).json({
            success: false,
            error: 'Invalid reviewAction'
          });
      }

      const result = await client.query(updateQuery, updateParams);

      logger.info('Validation reviewed', {
        validationId,
        reviewAction,
        reviewerId
      });

      res.json({
        success: true,
        validation: result.rows[0]
      });

    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Review validation failed', {
      validationId: req.params.validationId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/validation/metrics
 * Get validation metrics and statistics
 */
router.get('/metrics', async (req, res) => {
  try {
    const {
      providerId,
      startDate,
      endDate,
      groupBy = 'day' // 'day', 'provider', 'overall'
    } = req.query;

    const client = await db.getClient();
    try {
      let query;
      const queryParams = [];
      let paramCount = 0;

      if (groupBy === 'provider') {
        // Per-provider statistics
        query = `
          SELECT * FROM provider_validation_stats
          ORDER BY avg_overall_score DESC
        `;
      } else if (groupBy === 'day') {
        // Daily metrics
        let whereConditions = [];
        
        if (providerId) {
          paramCount++;
          queryParams.push(providerId);
          whereConditions.push(`provider_id = $${paramCount}`);
        }

        if (startDate) {
          paramCount++;
          queryParams.push(startDate);
          whereConditions.push(`metric_date >= $${paramCount}`);
        }

        if (endDate) {
          paramCount++;
          queryParams.push(endDate);
          whereConditions.push(`metric_date <= $${paramCount}`);
        }

        const whereClause = whereConditions.length > 0 
          ? `WHERE ${whereConditions.join(' AND ')}` 
          : '';

        query = `
          SELECT * FROM validation_metrics
          ${whereClause}
          ORDER BY metric_date DESC, provider_id
          LIMIT 100
        `;
      } else {
        // Overall summary
        query = `
          SELECT 
            COUNT(*) as total_validations,
            SUM(CASE WHEN overall_score >= 70 AND is_rejected = FALSE THEN 1 ELSE 0 END) as passed_count,
            SUM(CASE WHEN overall_score < 70 OR is_rejected = TRUE THEN 1 ELSE 0 END) as failed_count,
            SUM(CASE WHEN is_outlier THEN 1 ELSE 0 END) as outlier_count,
            SUM(CASE WHEN is_flagged THEN 1 ELSE 0 END) as flagged_count,
            SUM(CASE WHEN is_rejected THEN 1 ELSE 0 END) as rejected_count,
            AVG(overall_score) as avg_overall_score,
            AVG(consistency_score) as avg_consistency_score,
            AVG(style_consistency_score) as avg_style_score,
            MIN(overall_score) as min_score,
            MAX(overall_score) as max_score,
            STDDEV(overall_score) as stddev_score
          FROM validation_results
          WHERE status = 'completed'
        `;
      }

      const result = await client.query(query, queryParams);

      res.json({
        success: true,
        metrics: groupBy === 'overall' ? result.rows[0] : result.rows,
        groupBy
      });

    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Get validation metrics failed', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/validation/outliers
 * Get detected outliers for analysis
 */
router.get('/outliers', async (req, res) => {
  try {
    const {
      providerId,
      minScore,
      limit = 50,
      offset = 0
    } = req.query;

    const client = await db.getClient();
    try {
      let whereConditions = ['vr.is_outlier = TRUE', 'vr.status = \'completed\''];
      const queryParams = [];
      let paramCount = 0;

      if (providerId) {
        paramCount++;
        queryParams.push(providerId);
        whereConditions.push(`ga.provider_id = $${paramCount}`);
      }

      if (minScore) {
        paramCount++;
        queryParams.push(parseFloat(minScore));
        whereConditions.push(`vr.outlier_score >= $${paramCount}`);
      }

      paramCount++;
      queryParams.push(parseInt(limit));
      const limitParam = `$${paramCount}`;

      paramCount++;
      queryParams.push(parseInt(offset));
      const offsetParam = `$${paramCount}`;

      const query = `
        SELECT 
          vr.id,
          vr.generation_id,
          vr.asset_id,
          vr.overall_score,
          vr.outlier_score,
          vr.is_flagged,
          vr.is_rejected,
          vr.created_at,
          ga.cdn_url,
          ga.provider_id,
          mp.name as provider_name,
          vr.validation_data->>'vlt_analysis' as vlt_analysis
        FROM validation_results vr
        JOIN generation_assets ga ON vr.asset_id = ga.id
        LEFT JOIN model_providers mp ON ga.provider_id = mp.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY vr.outlier_score ASC, vr.created_at DESC
        LIMIT ${limitParam} OFFSET ${offsetParam}
      `;

      const result = await client.query(query, queryParams);

      res.json({
        success: true,
        outliers: result.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          count: result.rows.length
        }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Get outliers failed', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

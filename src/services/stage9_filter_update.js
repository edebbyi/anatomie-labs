// This is the updated filterAndReturnBestImages method for generationService.js
// Replace the existing method (lines 622-733) with this version

  /**
   * Helper: Filter validated images and return best N
   * Includes Stage 9: DPP Selection & Coverage Analysis
   * Also feeds discarded images to RLHF as negative examples
   * @param {string} generationId - Generation ID
   * @param {Array} assets - All generated assets
   * @param {number} requestedCount - Number of images user requested
   * @param {Object} targetSpec - Original VLT spec
   * @returns {Promise<Array>} Best N validated assets
   */
  async filterAndReturnBestImages(generationId, assets, requestedCount, targetSpec) {
    try {
      logger.info('[Stage 8] Validating all generated images', {
        generationId,
        totalAssets: assets.length,
        requestedCount
      });

      // Stage 8: Validate all assets
      const validationResults = [];
      for (const asset of assets) {
        try {
          const validation = await validationService.validateGeneration(
            generationId,
            asset.id,
            targetSpec
          );
          validationResults.push({
            asset,
            validation,
            vltSpecs: validation.vltSpecs // Extract VLT specs for Stage 9
          });
        } catch (error) {
          logger.error('Validation failed for asset', {
            generationId,
            assetId: asset.id,
            error: error.message
          });
          // Still include but with low score
          validationResults.push({
            asset,
            validation: {
              overallScore: 0,
              consistencyScore: 0,
              isRejected: true,
              rejectionReason: 'Validation error: ' + error.message
            },
            vltSpecs: {}
          });
        }
      }

      logger.info('[Stage 8] Validation complete', {
        generationId,
        validatedCount: validationResults.length,
        avgScore: validationResults.reduce((sum, r) => sum + (r.validation.overallScore || 0), 0) / validationResults.length
      });

      // Filter out rejected images (below quality threshold)
      const acceptableImages = validationResults.filter(r => 
        !r.validation.isRejected && (r.validation.overallScore || 0) >= 60
      );

      logger.info('[Stage 9] Starting DPP selection for diversity', {
        generationId,
        inputCount: acceptableImages.length,
        targetCount: requestedCount
      });

      let selectedResults;
      let dppMetrics = null;
      let coverageReport = null;

      // Stage 9: Apply DPP sampling for diverse selection
      if (acceptableImages.length > requestedCount) {
        try {
          // Convert to format expected by DPP service
          const imagesForDPP = acceptableImages.map(r => ({
            id: r.asset.id,
            ...r.asset,
            vltSpecs: r.vltSpecs,
            validation: r.validation
          }));

          // Run DPP selection
          const dppResult = await dppSelectionService.selectDiverseImages(
            imagesForDPP,
            requestedCount
          );

          dppMetrics = dppResult.metrics;

          // Map back to validation results format
          const selectedIds = new Set(dppResult.selected.map(img => img.id));
          selectedResults = acceptableImages.filter(r => selectedIds.has(r.asset.id));

          logger.info('[Stage 9] DPP selection complete', {
            generationId,
            selectedCount: selectedResults.length,
            diversityScore: dppMetrics.diversityScore,
            avgCoverage: dppMetrics.avgCoverage
          });

          // Store DPP selection results
          await this.storeDPPResults(generationId, {
            inputCount: acceptableImages.length,
            targetCount: requestedCount,
            selectedCount: selectedResults.length,
            selectedAssetIds: selectedResults.map(r => r.asset.id),
            rejectedAssetIds: acceptableImages.filter(r => !selectedIds.has(r.asset.id)).map(r => r.asset.id),
            metrics: dppMetrics,
            duration: dppResult.metadata.duration
          });

          // Stage 9: Run coverage analysis
          coverageReport = await coverageAnalysisService.analyzeCoverage(
            dppResult.selected,
            { generationId, targetCount: requestedCount }
          );

          logger.info('[Stage 9] Coverage analysis complete', {
            generationId,
            coverageStatus: coverageReport.summary.status,
            avgCoverage: coverageReport.summary.avgCoverage,
            gapCount: coverageReport.gaps.length
          });

        } catch (error) {
          logger.error('[Stage 9] DPP selection failed, falling back to score-based selection', {
            generationId,
            error: error.message
          });
          // Fallback: simple score-based selection
          acceptableImages.sort((a, b) => 
            (b.validation.overallScore || 0) - (a.validation.overallScore || 0)
          );
          selectedResults = acceptableImages.slice(0, requestedCount);
        }
      } else {
        // Not enough images for DPP, return all acceptable
        selectedResults = acceptableImages;
        logger.warn('[Stage 9] Insufficient images for DPP selection', {
          generationId,
          available: acceptableImages.length,
          requested: requestedCount
        });
      }

      // Identify discarded images (not selected + rejected)
      const selectedIds = new Set(selectedResults.map(r => r.asset.id));
      const discarded = validationResults.filter(r => !selectedIds.has(r.asset.id));

      logger.info('Image selection complete', {
        generationId,
        selected: selectedResults.length,
        discarded: discarded.length,
        avgSelectedScore: selectedResults.reduce((sum, r) => sum + (r.validation.overallScore || 0), 0) / selectedResults.length,
        avgDiscardedScore: discarded.length > 0 ? discarded.reduce((sum, r) => sum + (r.validation.overallScore || 0), 0) / discarded.length : 0
      });

      // Feed discarded images to RLHF as negative examples
      if (discarded.length > 0) {
        await this.feedDiscardedToRLHF(generationId, discarded, targetSpec);
      }

      // Update generation metadata with all pipeline stats
      const client = await db.getClient();
      try {
        const pipelineData = {
          filtering: {
            requested: requestedCount,
            generated: assets.length,
            validated: validationResults.length,
            acceptable: acceptableImages.length,
            selected: selectedResults.length,
            discarded: discarded.length,
            avgReturnedScore: selectedResults.reduce((sum, r) => sum + (r.validation.overallScore || 0), 0) / selectedResults.length,
            avgDiscardedScore: discarded.length > 0 ? discarded.reduce((sum, r) => sum + (r.validation.overallScore || 0), 0) / discarded.length : null
          }
        };

        // Add DPP metrics if available
        if (dppMetrics) {
          pipelineData.dppSelection = {
            diversityScore: dppMetrics.diversityScore,
            avgCoverage: dppMetrics.avgCoverage,
            avgPairwiseDistance: dppMetrics.avgPairwiseDistance
          };
        }

        // Add coverage summary if available
        if (coverageReport) {
          pipelineData.coverage = {
            status: coverageReport.summary.status,
            overallScore: coverageReport.summary.overallScore,
            avgCoverage: coverageReport.summary.avgCoverage,
            gapCount: coverageReport.gaps.length,
            criticalGaps: coverageReport.summary.gapSummary.critical,
            highGaps: coverageReport.summary.gapSummary.high
          };
        }

        await client.query(`
          UPDATE generations
          SET pipeline_data = pipeline_data || $2::jsonb
          WHERE id = $1
        `, [generationId, JSON.stringify(pipelineData)]);
      } finally {
        client.release();\n      }

      // Return only the asset objects (without validation data)
      return selectedResults.map(r => r.asset);

    } catch (error) {
      logger.error('Failed to filter validated images', {
        generationId,
        error: error.message
      });
      // On failure, just return first N assets
      return assets.slice(0, requestedCount);
    }
  }

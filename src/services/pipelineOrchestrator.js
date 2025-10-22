const vltService = require('./vltService');
const promptEnhancementService = require('./promptEnhancementService');
const personaService = require('./personaService');
const logger = require('../utils/logger');

/**
 * Pipeline Orchestrator
 * Chains Stages 1-3: VLT → Enhancement → Persona Matching
 * Provides unified interface for complete pre-generation pipeline
 */
class PipelineOrchestrator {
  constructor() {
    this.stages = {
      VLT: 'vlt_analysis',
      ENHANCEMENT: 'prompt_enhancement',
      PERSONA: 'persona_matching'
    };
  }

  /**
   * Execute full pipeline from image to persona-matched prompt
   * @param {string} userId - User ID
   * @param {Buffer|string} imageInput - Image buffer or file path
   * @param {Object} options - Pipeline options
   * @returns {Promise<Object>}
   */
  async executeFullPipeline(userId, imageInput, options = {}) {
    const {
      vltOptions = {},
      enhancementOptions = {},
      personaOptions = {},
      skipStages = []
    } = options;

    const pipelineId = `pipeline_${Date.now()}_${userId}`;
    const startTime = Date.now();

    logger.info('Starting full pipeline execution', {
      userId,
      pipelineId,
      skipStages
    });

    const result = {
      pipelineId,
      userId,
      stages: {},
      finalOutput: null,
      errors: [],
      metadata: {
        startTime: new Date(startTime).toISOString(),
        totalDuration: 0
      }
    };

    try {
      // ==================== STAGE 1: VLT Analysis ====================
      if (!skipStages.includes(this.stages.VLT)) {
        const vltStart = Date.now();
        logger.info('Stage 1: VLT Analysis starting', { pipelineId });

        try {
          const vltResult = await vltService.analyzeImage(imageInput, {
            ...vltOptions,
            model: vltOptions.model || 'gemini',
            passes: vltOptions.passes || 'A,B,C'
          });

          result.stages.vlt = {
            status: 'completed',
            duration: Date.now() - vltStart,
            output: vltResult,
            timestamp: new Date().toISOString()
          };

          logger.info('Stage 1: VLT Analysis completed', {
            pipelineId,
            duration: result.stages.vlt.duration,
            recordCount: vltResult.records?.length || 0
          });

        } catch (error) {
          result.stages.vlt = {
            status: 'failed',
            error: error.message,
            timestamp: new Date().toISOString()
          };
          result.errors.push({
            stage: 'vlt',
            error: error.message
          });
          throw new Error(`Stage 1 (VLT) failed: ${error.message}`);
        }
      }

      // ==================== STAGE 2: Prompt Enhancement ====================
      if (!skipStages.includes(this.stages.ENHANCEMENT)) {
        const enhancementStart = Date.now();
        logger.info('Stage 2: Prompt Enhancement starting', { pipelineId });

        try {
          const vltOutput = result.stages.vlt?.output;
          
          if (!vltOutput) {
            throw new Error('VLT output not available for enhancement');
          }

          const enhancedResult = await promptEnhancementService.enhancePrompt(
            vltOutput,
            {
              ...enhancementOptions,
              provider: enhancementOptions.provider || 'claude',
              style: enhancementOptions.style || 'professional'
            }
          );

          result.stages.enhancement = {
            status: 'completed',
            duration: Date.now() - enhancementStart,
            output: enhancedResult,
            timestamp: new Date().toISOString()
          };

          logger.info('Stage 2: Prompt Enhancement completed', {
            pipelineId,
            duration: result.stages.enhancement.duration,
            provider: enhancedResult.metadata.provider,
            enhancementCount: enhancedResult.enhancements.length
          });

        } catch (error) {
          result.stages.enhancement = {
            status: 'failed',
            error: error.message,
            timestamp: new Date().toISOString()
          };
          result.errors.push({
            stage: 'enhancement',
            error: error.message
          });
          throw new Error(`Stage 2 (Enhancement) failed: ${error.message}`);
        }
      }

      // ==================== STAGE 3: Persona Matching ====================
      if (!skipStages.includes(this.stages.PERSONA)) {
        const personaStart = Date.now();
        logger.info('Stage 3: Persona Matching starting', { pipelineId });

        try {
          const enhancedOutput = result.stages.enhancement?.output;
          
          if (!enhancedOutput || !enhancedOutput.enhancements) {
            throw new Error('Enhanced prompts not available for persona matching');
          }

          // Match each enhancement to persona
          const personaMatches = await Promise.all(
            enhancedOutput.enhancements.map(enhancement =>
              personaService.matchToPersona(userId, enhancement, {
                ...personaOptions,
                useActivePersona: personaOptions.useActivePersona !== false
              })
            )
          );

          result.stages.persona = {
            status: 'completed',
            duration: Date.now() - personaStart,
            output: personaMatches,
            timestamp: new Date().toISOString()
          };

          logger.info('Stage 3: Persona Matching completed', {
            pipelineId,
            duration: result.stages.persona.duration,
            matchCount: personaMatches.length
          });

        } catch (error) {
          result.stages.persona = {
            status: 'failed',
            error: error.message,
            timestamp: new Date().toISOString()
          };
          result.errors.push({
            stage: 'persona',
            error: error.message
          });
          throw new Error(`Stage 3 (Persona) failed: ${error.message}`);
        }
      }

      // ==================== Final Output ====================
      result.finalOutput = this.buildFinalOutput(result);
      result.metadata.totalDuration = Date.now() - startTime;
      result.metadata.endTime = new Date().toISOString();
      result.metadata.success = true;

      logger.info('Pipeline execution completed successfully', {
        userId,
        pipelineId,
        totalDuration: result.metadata.totalDuration,
        stages: Object.keys(result.stages).length
      });

      return result;

    } catch (error) {
      result.metadata.totalDuration = Date.now() - startTime;
      result.metadata.endTime = new Date().toISOString();
      result.metadata.success = false;
      result.metadata.error = error.message;

      logger.error('Pipeline execution failed', {
        userId,
        pipelineId,
        error: error.message,
        errorStage: result.errors[result.errors.length - 1]?.stage
      });

      return result;
    }
  }

  /**
   * Execute partial pipeline starting from specific stage
   * @param {string} userId - User ID
   * @param {string} startStage - Stage to start from
   * @param {Object} input - Input data for starting stage
   * @param {Object} options - Pipeline options
   * @returns {Promise<Object>}
   */
  async executeFrom(userId, startStage, input, options = {}) {
    logger.info('Executing partial pipeline', {
      userId,
      startStage
    });

    switch (startStage) {
      case this.stages.ENHANCEMENT:
        return await this.executeEnhancementOnly(userId, input, options);
      
      case this.stages.PERSONA:
        return await this.executePersonaOnly(userId, input, options);
      
      default:
        throw new Error(`Invalid start stage: ${startStage}`);
    }
  }

  /**
   * Execute only enhancement stage
   * @param {string} userId - User ID
   * @param {Object} vltSpec - VLT specification
   * @param {Object} options - Options
   * @returns {Promise<Object>}
   */
  async executeEnhancementOnly(userId, vltSpec, options = {}) {
    const startTime = Date.now();
    
    try {
      const enhanced = await promptEnhancementService.enhancePrompt(
        vltSpec,
        options.enhancementOptions || {}
      );

      return {
        stage: 'enhancement',
        success: true,
        duration: Date.now() - startTime,
        output: enhanced
      };

    } catch (error) {
      logger.error('Enhancement-only execution failed', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Execute only persona matching stage
   * @param {string} userId - User ID
   * @param {Object} enhancedPrompt - Enhanced prompt
   * @param {Object} options - Options
   * @returns {Promise<Object>}
   */
  async executePersonaOnly(userId, enhancedPrompt, options = {}) {
    const startTime = Date.now();
    
    try {
      const matched = await personaService.matchToPersona(
        userId,
        enhancedPrompt,
        options.personaOptions || {}
      );

      return {
        stage: 'persona',
        success: true,
        duration: Date.now() - startTime,
        output: matched
      };

    } catch (error) {
      logger.error('Persona-only execution failed', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Build final output from pipeline stages
   * @param {Object} pipelineResult - Pipeline execution result
   * @returns {Object}
   */
  buildFinalOutput(pipelineResult) {
    const { stages } = pipelineResult;

    // Extract the most relevant data from each stage
    const output = {
      readyForGeneration: true,
      prompts: [],
      metadata: {
        vltJobId: stages.vlt?.output?.jobId,
        enhancementProvider: stages.enhancement?.output?.metadata?.provider,
        personaMatched: stages.persona?.output?.[0]?.matchedPersona?.name
      }
    };

    // Build generation-ready prompts
    if (stages.persona?.output) {
      output.prompts = stages.persona.output.map((match, index) => ({
        id: `prompt_${index}`,
        mainPrompt: match.adjustedPrompt?.enhanced?.mainPrompt || match.originalPrompt?.enhanced?.mainPrompt,
        negativePrompt: match.adjustedPrompt?.enhanced?.negativePrompt || match.originalPrompt?.enhanced?.negativePrompt,
        persona: match.matchedPersona,
        matchScore: match.matchScore,
        keywords: match.adjustedPrompt?.enhanced?.keywords || [],
        photographyStyle: match.adjustedPrompt?.enhanced?.photographyStyle,
        adjustments: match.adjustments,
        recommendation: match.recommendation,
        vltAttributes: stages.vlt?.output?.records?.[index]?.attributes || {}
      }));
    }

    return output;
  }

  /**
   * Get pipeline status
   * @param {string} pipelineId - Pipeline ID
   * @returns {Promise<Object>}
   */
  async getStatus(pipelineId) {
    // In production, you'd query a database or cache
    // For now, returning a mock response
    logger.info('Getting pipeline status', { pipelineId });
    
    return {
      pipelineId,
      status: 'unknown',
      message: 'Pipeline status tracking not yet implemented'
    };
  }

  /**
   * Validate pipeline input
   * @param {Object} input - Pipeline input
   * @param {string} stage - Starting stage
   * @returns {Object}
   */
  validateInput(input, stage) {
    const validation = {
      valid: true,
      errors: []
    };

    switch (stage) {
      case this.stages.VLT:
        if (!input || (!Buffer.isBuffer(input) && typeof input !== 'string')) {
          validation.valid = false;
          validation.errors.push('VLT stage requires image buffer or file path');
        }
        break;

      case this.stages.ENHANCEMENT:
        if (!input || !input.records) {
          validation.valid = false;
          validation.errors.push('Enhancement stage requires valid VLT specification');
        }
        break;

      case this.stages.PERSONA:
        if (!input || !input.enhanced) {
          validation.valid = false;
          validation.errors.push('Persona stage requires enhanced prompt');
        }
        break;
    }

    return validation;
  }
}

module.exports = new PipelineOrchestrator();

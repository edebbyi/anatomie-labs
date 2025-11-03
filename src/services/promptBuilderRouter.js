const logger = require('../utils/logger');
const advancedPromptBuilder = require('./advancedPromptBuilderAgent');
const intelligentPromptBuilder = require('./IntelligentPromptBuilder');

/**
 * Routes prompt generation traffic between the legacy advanced builder
 * and the newer intelligent builder so we can gradually ramp usage.
 */
class PromptBuilderRouter {
  constructor(newSystemPercentage = 10) {
    this.setTrafficSplit(newSystemPercentage);
    this.stats = {
      oldSystem: { count: 0, totalTime: 0, errors: 0 },
      newSystem: { count: 0, totalTime: 0, errors: 0 }
    };
  }

  setTrafficSplit(percentage) {
    const clamped = Math.max(0, Math.min(Number(percentage) || 0, 100));
    this.newSystemPercentage = clamped;
  }

  getTrafficSplit() {
    return this.newSystemPercentage;
  }

  async generatePrompt(userId, options = {}) {
    const useNewSystem = Math.random() * 100 < this.newSystemPercentage;
    if (useNewSystem) {
      return this.generateWithNew(userId, options);
    }
    return this.generateWithOld(userId, options);
  }

  async generateWithNew(userId, options = {}) {
    const start = Date.now();
    try {
      const result = await intelligentPromptBuilder.generatePrompt(userId, options);
      this.recordSuccess('newSystem', Date.now() - start);

      return {
        ...result,
        system: 'new',
        prompt_id: result.prompt_id || result.id,
        text: result.text || result.positive_prompt,
        metadata: result.metadata || result.json_spec
      };
    } catch (error) {
      this.recordFailure('newSystem');
      logger.error('PromptBuilderRouter: NEW system failed, falling back to OLD', {
        userId,
        error: error.message
      });
      return this.generateWithOld(userId, options);
    }
  }

  async generateWithOld(userId, options = {}) {
    const start = Date.now();
    try {
      const result = await advancedPromptBuilder.generatePrompt(userId, options);
      this.recordSuccess('oldSystem', Date.now() - start);

      return {
        ...result,
        system: 'old',
        prompt_id: result.prompt_id || result.id,
        text: result.text || result.positive_prompt,
        metadata: result.metadata || result.json_spec
      };
    } catch (error) {
      this.recordFailure('oldSystem');
      logger.error('PromptBuilderRouter: OLD system failed', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  recordSuccess(systemKey, durationMs) {
    const stats = this.stats[systemKey];
    stats.count += 1;
    stats.totalTime += durationMs;
  }

  recordFailure(systemKey) {
    this.stats[systemKey].errors += 1;
  }

  getStats() {
    const format = (entry) => ({
      count: entry.count,
      avgTimeMs: entry.count ? Number((entry.totalTime / entry.count).toFixed(2)) : null,
      errors: entry.errors
    });

    return {
      newSystemPercentage: this.newSystemPercentage,
      newSystem: format(this.stats.newSystem),
      oldSystem: format(this.stats.oldSystem)
    };
  }
}

module.exports = PromptBuilderRouter;

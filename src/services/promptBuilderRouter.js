/**
 * Prompt Builder Router
 * 
 * A/B testing router for gradual rollout of IntelligentPromptBuilder
 */

const advancedPromptBuilder = require('./advancedPromptBuilderAgent');
const intelligentPromptBuilder = require('./IntelligentPromptBuilder');

class PromptBuilderRouter {
  constructor(newSystemPercentage = 10) {
    this.newSystemPercentage = newSystemPercentage; // 10% = 0.1
    this.stats = {
      oldSystem: { count: 0, totalTime: 0, errors: 0 },
      newSystem: { count: 0, totalTime: 0, errors: 0 }
    };
  }

  /**
   * Route to appropriate system based on percentage
   */
  async generatePrompt(userId, options = {}) {
    const useNewSystem = Math.random() * 100 < this.newSystemPercentage;

    if (useNewSystem) {
      return this.generateWithNew(userId, options);
    } else {
      return this.generateWithOld(userId, options);
    }
  }

  async generateWithNew(userId, options) {
    const start = Date.now();
    try {
      const result = await intelligentPromptBuilder.generatePrompt(userId, options);
      this.stats.newSystem.count++;
      this.stats.newSystem.totalTime += (Date.now() - start);
      
      console.log('Prompt generated with NEW system', { userId });
      
      // Format result to match existing structure
      return {
        id: result.prompt_id,
        text: result.positive_prompt,
        json_spec: result.metadata,
        system: 'new'
      };
    } catch (error) {
      this.stats.newSystem.errors++;
      console.error('NEW system error', { userId, error: error.message });
      
      // Fallback to old system
      return this.generateWithOld(userId, options);
    }
  }

  async generateWithOld(userId, options) {
    const start = Date.now();
    try {
      const result = await advancedPromptBuilder.generatePrompt(userId, options);
      this.stats.oldSystem.count++;
      this.stats.oldSystem.totalTime += (Date.now() - start);
      
      console.log('Prompt generated with OLD system', { userId });
      
      return {
        ...result,
        system: 'old'
      };
    } catch (error) {
      this.stats.oldSystem.errors++;
      console.error('OLD system error', { userId, error: error.message });
      throw error;
    }
  }

  getStats() {
    return {
      old: {
        count: this.stats.oldSystem.count,
        avgTime: this.stats.oldSystem.count > 0 
          ? (this.stats.oldSystem.totalTime / this.stats.oldSystem.count).toFixed(2) + 'ms'
          : 'N/A',
        errors: this.stats.oldSystem.errors
      },
      new: {
        count: this.stats.newSystem.count,
        avgTime: this.stats.newSystem.count > 0 
          ? (this.stats.newSystem.totalTime / this.stats.newSystem.count).toFixed(2) + 'ms'
          : 'N/A',
        errors: this.stats.newSystem.errors
      },
      newSystemPercentage: this.newSystemPercentage + '%'
    };
  }

  increaseNewSystemTraffic(percentage) {
    this.newSystemPercentage = Math.min(100, percentage);
    console.log('New system traffic increased', { percentage: this.newSystemPercentage });
  }
}

module.exports = PromptBuilderRouter;
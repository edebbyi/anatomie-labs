/**
 * MIGRATION & COMPARISON GUIDE
 * 
 * How to test and migrate from old prompt builders to IntelligentPromptBuilder
 */

const advancedPromptBuilder = require('./advancedPromptBuilderAgent');
const promptBuilder = require('./promptBuilderAgent');
const intelligentPromptBuilder = require('./IntelligentPromptBuilder');
const logger = require('../utils/logger');

// ============================================
// STEP 1: COMPARISON TEST
// ============================================

/**
 * Run all three systems side-by-side and compare outputs
 */
async function comparePromptBuilders(userId, options = {}) {
  console.log('\n========================================');
  console.log('PROMPT BUILDER COMPARISON TEST');
  console.log('========================================\n');

  const startTime = Date.now();

  // Run OLD System #1 (advancedPromptBuilder)
  console.log('🔧 Running OLD System #1 (advancedPromptBuilder)...');
  const oldSystem1Start = Date.now();
  try {
    const oldPrompt1 = await advancedPromptBuilder.generatePrompt(userId, options);
    const oldSystem1Time = Date.now() - oldSystem1Start;
    
    console.log('✅ OLD System #1 Complete');
    console.log(`   Time: ${oldSystem1Time}ms`);
    console.log(`   Tokens: ${oldPrompt1.text.split(',').length}`);
    console.log(`   Sample: ${oldPrompt1.text.substring(0, 100)}...`);
  } catch (error) {
    console.log('❌ OLD System #1 Failed:', error.message);
  }

  // Run OLD System #2 (promptBuilder)
  console.log('\n🔧 Running OLD System #2 (promptBuilder)...');
  const oldSystem2Start = Date.now();
  try {
    const oldPrompt2 = await promptBuilder.generatePrompt(userId, options);
    const oldSystem2Time = Date.now() - oldSystem2Start;
    
    console.log('✅ OLD System #2 Complete');
    console.log(`   Time: ${oldSystem2Time}ms`);
    console.log(`   Tokens: ${oldPrompt2.text.split(',').length}`);
    console.log(`   Sample: ${oldPrompt2.text.substring(0, 100)}...`);
  } catch (error) {
    console.log('❌ OLD System #2 Failed:', error.message);
  }

  // Run NEW System (IntelligentPromptBuilder)
  console.log('\n🚀 Running NEW System (IntelligentPromptBuilder)...');
  const newSystemStart = Date.now();
  try {
    const newPrompt = await intelligentPromptBuilder.generatePrompt(userId, {
      ...options,
      useCache: false // Force generation for comparison
    });
    const newSystemTime = Date.now() - newSystemStart;
    
    console.log('✅ NEW System Complete');
    console.log(`   Time: ${newSystemTime}ms`);
    console.log(`   Tokens: ${newPrompt.positive_prompt.split(',').length}`);
    console.log(`   Sample: ${newPrompt.positive_prompt.substring(0, 100)}...`);
    console.log(`   Cache Hit Rate: ${intelligentPromptBuilder.getCacheHitRate()}`);
  } catch (error) {
    console.log('❌ NEW System Failed:', error.message);
  }

  const totalTime = Date.now() - startTime;
  console.log(`\n⏱️  Total comparison time: ${totalTime}ms`);
  console.log('========================================\n');
}

// ============================================
// STEP 2: PERFORMANCE BENCHMARK
// ============================================

/**
 * Benchmark cache performance
 */
async function benchmarkCachePerformance(userId) {
  console.log('\n========================================');
  console.log('CACHE PERFORMANCE BENCHMARK');
  console.log('========================================\n');

  const iterations = 20;
  const times = [];

  console.log(`Running ${iterations} iterations...`);

  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await intelligentPromptBuilder.generatePrompt(userId, {
      garmentType: 'blazer',
      useCache: true
    });
    const time = Date.now() - start;
    times.push(time);
    
    if (i === 0) {
      console.log(`   Iteration ${i + 1}: ${time}ms (CACHE MISS - first time)`);
    } else {
      console.log(`   Iteration ${i + 1}: ${time}ms ${time < 5 ? '(CACHE HIT ⚡)' : ''}`);
    }
  }

  const avg = times.reduce((sum, t) => sum + t, 0) / times.length;
  const firstTime = times[0];
  const cachedAvg = times.slice(1).reduce((sum, t) => sum + t, 0) / (times.length - 1);

  console.log('\n📊 RESULTS:');
  console.log(`   First generation (cache miss): ${firstTime}ms`);
  console.log(`   Cached generations (avg): ${cachedAvg.toFixed(2)}ms`);
  console.log(`   Overall average: ${avg.toFixed(2)}ms`);
  console.log(`   Speed improvement: ${((firstTime / cachedAvg) * 100).toFixed(0)}x faster with cache`);
  console.log(`   Cache hit rate: ${intelligentPromptBuilder.getCacheHitRate()}`);
  console.log('========================================\n');
}

// ============================================
// STEP 3: A/B TEST SETUP
// ============================================

/**
 * Set up A/B test with traffic split
 */
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
      
      logger.info('Prompt generated with NEW system', { userId });
      
      return {
        ...result,
        system: 'new'
      };
    } catch (error) {
      this.stats.newSystem.errors++;
      logger.error('NEW system error', { userId, error: error.message });
      
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
      
      logger.info('Prompt generated with OLD system', { userId });
      
      return {
        text: result.text,
        system: 'old',
        prompt_id: result.id
      };
    } catch (error) {
      this.stats.oldSystem.errors++;
      logger.error('OLD system error', { userId, error: error.message });
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
    logger.info('New system traffic increased', { percentage: this.newSystemPercentage });
  }
}

// ============================================
// STEP 4: USAGE EXAMPLES
// ============================================

/**
 * Example 1: Basic usage
 */
async function example1_basicUsage() {
  console.log('\n📝 Example 1: Basic Usage\n');

  const userId = 'user-123';
  
  const prompt = await intelligentPromptBuilder.generatePrompt(userId);
  
  console.log('Generated prompt:');
  console.log(prompt.positive_prompt);
  console.log('\nMetadata:', prompt.metadata);
}

/**
 * Example 2: With constraints
 */
async function example2_withConstraints() {
  console.log('\n📝 Example 2: With Constraints\n');

  const userId = 'user-123';
  
  const prompt = await intelligentPromptBuilder.generatePrompt(userId, {
    garmentType: 'blazer',
    season: 'fall',
    occasion: 'business',
    creativity: 0.2 // Low exploration
  });
  
  console.log('Constrained prompt:');
  console.log(prompt.positive_prompt);
}

/**
 * Example 3: Exploration mode
 */
async function example3_exploration() {
  console.log('\n📝 Example 3: Exploration Mode\n');

  const userId = 'user-123';
  
  const prompt = await intelligentPromptBuilder.generatePrompt(userId, {
    creativity: 0.8, // High exploration
    useCache: false  // Don't use cache
  });
  
  console.log('Exploratory prompt:');
  console.log(prompt.positive_prompt);
}

/**
 * Example 4: With feedback loop
 */
async function example4_feedbackLoop() {
  console.log('\n📝 Example 4: Feedback Loop\n');

  const userId = 'user-123';
  
  // Generate prompt
  const prompt = await intelligentPromptBuilder.generatePrompt(userId, {
    garmentType: 'dress'
  });
  
  console.log('Generated prompt:', prompt.prompt_id);
  
  // User generates image and likes it
  console.log('User likes the image...');
  await intelligentPromptBuilder.updateThompsonParamsFromFeedback(
    userId,
    prompt.prompt_id,
    { liked: true, saved: false }
  );
  
  console.log('✅ Thompson parameters updated!');
  console.log('Next time, similar attributes will be more likely to be selected.');
}

/**
 * Example 5: Batch generation
 */
async function example5_batchGeneration() {
  console.log('\n📝 Example 5: Batch Generation\n');

  const userId = 'user-123';
  const count = 10;
  
  console.log(`Generating ${count} prompts...`);
  
  const start = Date.now();
  const prompts = [];
  
  for (let i = 0; i < count; i++) {
    const prompt = await intelligentPromptBuilder.generatePrompt(userId, {
      garmentType: i % 2 === 0 ? 'blazer' : 'dress'
    });
    prompts.push(prompt);
  }
  
  const totalTime = Date.now() - start;
  const avgTime = totalTime / count;
  
  console.log(`✅ Generated ${count} prompts in ${totalTime}ms`);
  console.log(`   Average: ${avgTime.toFixed(2)}ms per prompt`);
  console.log(`   Cache hit rate: ${intelligentPromptBuilder.getCacheHitRate()}`);
}

// ============================================
// STEP 5: MIGRATION CHECKLIST
// ============================================

const MIGRATION_CHECKLIST = `
📋 MIGRATION CHECKLIST
========================

PHASE 1: PREPARATION (Week 1)
□ Run database migration: prompt_builder_schema.sql
□ Deploy IntelligentPromptBuilder.js (no traffic yet)
□ Run comparison tests (comparePromptBuilders)
□ Verify ultra-detailed ingestion is working
□ Check sample outputs for quality

PHASE 2: PARALLEL TESTING (Week 2)
□ Deploy A/B test router (10% traffic to new system)
□ Monitor error rates (should be <1%)
□ Compare quality metrics (user feedback)
□ Check performance metrics (cache hit rate >60%)
□ Fix any issues discovered

PHASE 3: GRADUAL ROLLOUT (Weeks 3-4)
□ Increase to 25% traffic
□ Monitor for 3 days
□ Increase to 50% traffic
□ Monitor for 3 days
□ Increase to 75% traffic
□ Monitor for 3 days
□ Increase to 100% traffic

PHASE 4: CLEANUP (Week 5)
□ Verify 100% traffic on new system
□ Monitor for 1 week
□ Deprecate old prompt builders
□ Remove unused code:
   - advancedPromptBuilderAgent.js
   - promptGeneratorAgent.js
□ Update all imports to use IntelligentPromptBuilder
□ Remove old database columns (optional)

PHASE 5: OPTIMIZATION (Ongoing)
□ Monitor Thompson Sampling learning
□ Track cache hit rates
□ Analyze top-performing prompts
□ Refine negative prompts
□ Tune creativity thresholds

ROLLBACK PLAN
==============
If issues occur at any phase:
1. Reduce traffic to new system (or stop completely)
2. Investigate errors
3. Fix issues
4. Resume at previous phase
5. Old systems remain functional during entire migration
`;

// ============================================
// EXPORTS
// ============================================

module.exports = {
  comparePromptBuilders,
  benchmarkCachePerformance,
  PromptBuilderRouter,
  examples: {
    example1_basicUsage,
    example2_withConstraints,
    example3_exploration,
    example4_feedbackLoop,
    example5_batchGeneration
  },
  MIGRATION_CHECKLIST
};

// ============================================
// CLI USAGE
// ============================================

if (require.main === module) {
  const command = process.argv[2];
  const userId = process.argv[3] || 'test-user-123';

  (async () => {
    switch (command) {
      case 'compare':
        await comparePromptBuilders(userId);
        break;
      
      case 'benchmark':
        await benchmarkCachePerformance(userId);
        break;
      
      case 'example1':
        await example1_basicUsage();
        break;
      
      case 'example2':
        await example2_withConstraints();
        break;
      
      case 'example3':
        await example3_exploration();
        break;
      
      case 'example4':
        await example4_feedbackLoop();
        break;
      
      case 'example5':
        await example5_batchGeneration();
        break;
      
      case 'checklist':
        console.log(MIGRATION_CHECKLIST);
        break;
      
      default:
        console.log(`
Usage: node migration_guide.js <command> [userId]

Commands:
  compare     - Compare all three prompt builders side-by-side
  benchmark   - Benchmark cache performance
  example1    - Basic usage example
  example2    - With constraints example
  example3    - Exploration mode example
  example4    - Feedback loop example
  example5    - Batch generation example
  checklist   - Show migration checklist

Examples:
  node migration_guide.js compare user-123
  node migration_guide.js benchmark user-456
  node migration_guide.js example1
  node migration_guide.js checklist
        `);
    }
  })();
}

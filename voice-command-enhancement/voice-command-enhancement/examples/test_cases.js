/**
 * Test Cases and Usage Examples
 * 
 * Run this file to test the specificity analysis system:
 * node examples/test_cases.js
 */

const SpecificityAnalyzer = require('../services/specificityAnalyzer');

// Initialize analyzer
const analyzer = new SpecificityAnalyzer();

console.log('\n===========================================');
console.log('VOICE COMMAND SPECIFICITY ANALYSIS - TESTS');
console.log('===========================================\n');

/**
 * Test Case 1: Very Exploratory Command
 * Expected: Low specificity, high creativity
 */
function testCase1() {
  console.log('TEST 1: Very Exploratory Command');
  console.log('Command: "make me 10 dresses"');
  console.log('---');
  
  const analysis = analyzer.analyzeCommand('make me 10 dresses', {
    colors: [],
    styles: [],
    fabrics: [],
    modifiers: [],
    count: 10
  });
  
  console.log('Specificity Score:', analysis.specificityScore.toFixed(3));
  console.log('Creativity Temp:', analysis.creativityTemp.toFixed(3));
  console.log('Mode:', analysis.mode);
  console.log('Category:', analyzer.getSpecificityCategory(analysis.specificityScore));
  console.log('Reasoning:', analysis.reasoning);
  console.log('\n✓ Expected: Low specificity (0.1-0.3), High creativity (1.0-1.2)');
  console.log('✓ Expected Mode: exploratory');
  console.log('\n');
}

/**
 * Test Case 2: Highly Specific Command
 * Expected: High specificity, low creativity
 */
function testCase2() {
  console.log('TEST 2: Highly Specific Command');
  console.log('Command: "make a sporty chic cashmere fitted dress in navy blue"');
  console.log('---');
  
  const analysis = analyzer.analyzeCommand(
    'make a sporty chic cashmere fitted dress in navy blue',
    {
      colors: ['navy blue'],
      styles: ['sporty', 'chic'],
      fabrics: ['cashmere'],
      modifiers: ['sporty', 'chic', 'fitted', 'navy blue', 'cashmere'],
      count: 1
    }
  );
  
  console.log('Specificity Score:', analysis.specificityScore.toFixed(3));
  console.log('Creativity Temp:', analysis.creativityTemp.toFixed(3));
  console.log('Mode:', analysis.mode);
  console.log('Category:', analyzer.getSpecificityCategory(analysis.specificityScore));
  console.log('Reasoning:', analysis.reasoning);
  console.log('\nFactors:');
  analysis.factors.forEach(factor => {
    console.log(`  - ${factor.name}: ${factor.contribution >= 0 ? '+' : ''}${factor.contribution.toFixed(2)} (${factor.explanation})`);
  });
  console.log('\n✓ Expected: High specificity (0.8-1.0), Low creativity (0.3-0.4)');
  console.log('✓ Expected Mode: specific');
  console.log('\n');
}

/**
 * Test Case 3: Moderate Specificity
 * Expected: Medium specificity, balanced creativity
 */
function testCase3() {
  console.log('TEST 3: Moderate Specificity Command');
  console.log('Command: "create 5 summer evening dresses"');
  console.log('---');
  
  const analysis = analyzer.analyzeCommand(
    'create 5 summer evening dresses',
    {
      colors: [],
      styles: ['evening'],
      fabrics: [],
      modifiers: ['evening', 'summer'],
      occasions: ['summer'],
      count: 5
    }
  );
  
  console.log('Specificity Score:', analysis.specificityScore.toFixed(3));
  console.log('Creativity Temp:', analysis.creativityTemp.toFixed(3));
  console.log('Mode:', analysis.mode);
  console.log('Category:', analyzer.getSpecificityCategory(analysis.specificityScore));
  console.log('Reasoning:', analysis.reasoning);
  console.log('\n✓ Expected: Medium specificity (0.4-0.6), Balanced creativity (0.6-0.8)');
  console.log('\n');
}

/**
 * Test Case 4: Vague Language
 * Expected: Very low specificity, very high creativity
 */
function testCase4() {
  console.log('TEST 4: Vague/Exploratory Language');
  console.log('Command: "surprise me with some random varied outfits"');
  console.log('---');
  
  const analysis = analyzer.analyzeCommand(
    'surprise me with some random varied outfits',
    {
      colors: [],
      styles: [],
      fabrics: [],
      modifiers: [],
      count: 10
    }
  );
  
  console.log('Specificity Score:', analysis.specificityScore.toFixed(3));
  console.log('Creativity Temp:', analysis.creativityTemp.toFixed(3));
  console.log('Mode:', analysis.mode);
  console.log('Has Vague Language:', analysis.metadata.hasVagueLanguage);
  console.log('Reasoning:', analysis.reasoning);
  console.log('\n✓ Expected: Very low specificity (<0.2), Very high creativity (>1.1)');
  console.log('✓ Expected: hasVagueLanguage = true');
  console.log('\n');
}

/**
 * Test Case 5: Precise Language
 * Expected: Higher specificity boost
 */
function testCase5() {
  console.log('TEST 5: Precise Language');
  console.log('Command: "create exactly 3 burgundy structured blazers that must have peak lapels"');
  console.log('---');
  
  const analysis = analyzer.analyzeCommand(
    'create exactly 3 burgundy structured blazers that must have peak lapels',
    {
      colors: ['burgundy'],
      styles: [],
      fabrics: [],
      modifiers: ['structured', 'burgundy'],
      count: 3
    }
  );
  
  console.log('Specificity Score:', analysis.specificityScore.toFixed(3));
  console.log('Creativity Temp:', analysis.creativityTemp.toFixed(3));
  console.log('Mode:', analysis.mode);
  console.log('Has Precise Language:', analysis.metadata.hasPreciseLanguage);
  console.log('Has Technical Terms:', analysis.metadata.hasTechnicalTerms);
  console.log('Reasoning:', analysis.reasoning);
  console.log('\n✓ Expected: High specificity (0.7+), Low creativity (0.4-0.5)');
  console.log('✓ Expected: hasPreciseLanguage = true');
  console.log('\n');
}

/**
 * Test Case 6: Fisherman Style (Trend Example)
 * Expected: Low-medium specificity
 */
function testCase6() {
  console.log('TEST 6: Trend-Based Command');
  console.log('Command: "make me 10 fisherman style outfits"');
  console.log('---');
  
  const analysis = analyzer.analyzeCommand(
    'make me 10 fisherman style outfits',
    {
      colors: [],
      styles: ['fisherman'],
      fabrics: [],
      modifiers: ['fisherman'],
      count: 10
    }
  );
  
  console.log('Specificity Score:', analysis.specificityScore.toFixed(3));
  console.log('Creativity Temp:', analysis.creativityTemp.toFixed(3));
  console.log('Mode:', analysis.mode);
  console.log('Reasoning:', analysis.reasoning);
  console.log('\n✓ Expected: Low-medium specificity (0.3-0.4), Moderate-high creativity (0.8-0.9)');
  console.log('✓ Note: Single style modifier, but still exploratory due to quantity');
  console.log('\n');
}

/**
 * Test Case 7: Detailed Explanation
 * Shows the explainAnalysis method
 */
function testCase7() {
  console.log('TEST 7: Detailed Analysis Explanation');
  console.log('Command: "design 2 elegant silk evening gowns in emerald green"');
  console.log('---');
  
  const analysis = analyzer.analyzeCommand(
    'design 2 elegant silk evening gowns in emerald green',
    {
      colors: ['emerald green'],
      styles: ['elegant', 'evening'],
      fabrics: ['silk'],
      modifiers: ['elegant', 'evening', 'emerald green', 'silk'],
      count: 2
    }
  );
  
  const explanation = analyzer.explainAnalysis(analysis);
  
  console.log('ANALYSIS EXPLANATION:');
  console.log('Summary:', explanation.summary);
  console.log('\nSpecificity:');
  console.log('  Score:', explanation.specificity.score.toFixed(3));
  console.log('  Category:', explanation.specificity.category);
  console.log('  Interpretation:', explanation.specificity.interpretation);
  console.log('\nCreativity:');
  console.log('  Temperature:', explanation.creativity.temperature.toFixed(3));
  console.log('  Category:', explanation.creativity.category);
  console.log('  Behavior:', explanation.creativity.behavior);
  console.log('\nMode:');
  console.log('  Selected:', explanation.mode.selected);
  console.log('  Explanation:', explanation.mode.explanation);
  console.log('\nContributing Factors:');
  explanation.factors.forEach(factor => {
    console.log(`  ${factor.factor}: ${factor.impact} - ${factor.explanation}`);
  });
  console.log('\n');
}

/**
 * Run all tests
 */
function runAllTests() {
  testCase1();
  console.log('-------------------------------------------\n');
  
  testCase2();
  console.log('-------------------------------------------\n');
  
  testCase3();
  console.log('-------------------------------------------\n');
  
  testCase4();
  console.log('-------------------------------------------\n');
  
  testCase5();
  console.log('-------------------------------------------\n');
  
  testCase6();
  console.log('-------------------------------------------\n');
  
  testCase7();
  console.log('-------------------------------------------\n');
  
  console.log('===========================================');
  console.log('ALL TESTS COMPLETE');
  console.log('===========================================\n');
  console.log('Key Insights:');
  console.log('- Low specificity (0.0-0.3) → High creativity (1.0-1.2) → Exploratory mode');
  console.log('- Medium specificity (0.4-0.6) → Balanced creativity (0.6-0.8)');
  console.log('- High specificity (0.7-1.0) → Low creativity (0.3-0.5) → Specific mode');
  console.log('\nFactors that increase specificity:');
  console.log('  + Descriptor count (colors, styles, fabrics)');
  console.log('  + Low quantity (1 item = most specific)');
  console.log('  + Precise language ("exactly", "must have")');
  console.log('  + Technical terms (cashmere, structured, fitted)');
  console.log('\nFactors that decrease specificity:');
  console.log('  - High quantity (10+ items)');
  console.log('  - Vague language ("surprise", "random")');
  console.log('  - Few or no descriptors');
  console.log('\n');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

// Export for use in other test files
module.exports = {
  testCase1,
  testCase2,
  testCase3,
  testCase4,
  testCase5,
  testCase6,
  testCase7,
  runAllTests
};

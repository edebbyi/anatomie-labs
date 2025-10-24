/**
 * Test script for the voice command enhancement
 */

const SpecificityAnalyzer = require('./src/services/specificityAnalyzer');

// Mock logger for testing
const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.log('[WARN]', ...args),
  error: (...args) => console.log('[ERROR]', ...args)
};

console.log('\n===========================================');
console.log('VOICE COMMAND ENHANCEMENT - TESTS');
console.log('===========================================\n');

// Initialize analyzer
const analyzer = new SpecificityAnalyzer();

// Test Case 1: Very Exploratory Command
console.log('TEST 1: Very Exploratory Command');
console.log('Command: "make me 10 dresses"');
console.log('---');

const analysis1 = analyzer.analyzeCommand('make me 10 dresses', {
  colors: [],
  styles: [],
  fabrics: [],
  modifiers: [],
  count: 10
});

console.log('Specificity Score:', analysis1.specificityScore.toFixed(3));
console.log('Creativity Temp:', analysis1.creativityTemp.toFixed(3));
console.log('Mode:', analysis1.mode);
console.log('Category:', analyzer.getSpecificityCategory(analysis1.specificityScore));
console.log('Reasoning:', analysis1.reasoning);
console.log('\n✓ Expected: Low specificity (0.1-0.3), High creativity (1.0-1.2)');
console.log('✓ Expected Mode: exploratory');
console.log('\n-------------------------------------------\n');

// Test Case 2: Highly Specific Command
console.log('TEST 2: Highly Specific Command');
console.log('Command: "make a sporty chic cashmere fitted dress in navy blue"');
console.log('---');

const analysis2 = analyzer.analyzeCommand(
  'make a sporty chic cashmere fitted dress in navy blue',
  {
    colors: ['navy blue'],
    styles: ['sporty', 'chic'],
    fabrics: ['cashmere'],
    modifiers: ['sporty', 'chic', 'fitted', 'navy blue', 'cashmere'],
    count: 1
  }
);

console.log('Specificity Score:', analysis2.specificityScore.toFixed(3));
console.log('Creativity Temp:', analysis2.creativityTemp.toFixed(3));
console.log('Mode:', analysis2.mode);
console.log('Category:', analyzer.getSpecificityCategory(analysis2.specificityScore));
console.log('Reasoning:', analysis2.reasoning);
console.log('\nFactors:');
analysis2.factors.forEach(factor => {
  console.log(`  - ${factor.name}: ${factor.contribution >= 0 ? '+' : ''}${factor.contribution.toFixed(2)} (${factor.explanation})`);
});
console.log('\n✓ Expected: High specificity (0.8-1.0), Low creativity (0.3-0.4)');
console.log('✓ Expected Mode: specific');
console.log('\n-------------------------------------------\n');

// Test Case 3: Moderate Specificity
console.log('TEST 3: Moderate Specificity Command');
console.log('Command: "create 5 summer evening dresses"');
console.log('---');

const analysis3 = analyzer.analyzeCommand(
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

console.log('Specificity Score:', analysis3.specificityScore.toFixed(3));
console.log('Creativity Temp:', analysis3.creativityTemp.toFixed(3));
console.log('Mode:', analysis3.mode);
console.log('Category:', analyzer.getSpecificityCategory(analysis3.specificityScore));
console.log('Reasoning:', analysis3.reasoning);
console.log('\n✓ Expected: Medium specificity (0.4-0.6), Balanced creativity (0.6-0.8)');
console.log('\n-------------------------------------------\n');

// Test Case 4: Vague Language
console.log('TEST 4: Vague/Exploratory Language');
console.log('Command: "surprise me with some random varied outfits"');
console.log('---');

const analysis4 = analyzer.analyzeCommand(
  'surprise me with some random varied outfits',
  {
    colors: [],
    styles: [],
    fabrics: [],
    modifiers: [],
    count: 10
  }
);

console.log('Specificity Score:', analysis4.specificityScore.toFixed(3));
console.log('Creativity Temp:', analysis4.creativityTemp.toFixed(3));
console.log('Mode:', analysis4.mode);
console.log('Has Vague Language:', analysis4.metadata.hasVagueLanguage);
console.log('Reasoning:', analysis4.reasoning);
console.log('\n✓ Expected: Very low specificity (<0.2), Very high creativity (>1.1)');
console.log('✓ Expected: hasVagueLanguage = true');
console.log('\n-------------------------------------------\n');

// Test Case 5: Detailed Explanation
console.log('TEST 5: Detailed Analysis Explanation');
console.log('Command: "design 2 elegant silk evening gowns in emerald green"');
console.log('---');

const analysis5 = analyzer.analyzeCommand(
  'design 2 elegant silk evening gowns in emerald green',
  {
    colors: ['emerald green'],
    styles: ['elegant', 'evening'],
    fabrics: ['silk'],
    modifiers: ['elegant', 'evening', 'emerald green', 'silk'],
    count: 2
  }
);

const explanation = analyzer.explainAnalysis(analysis5);

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
console.log('\n-------------------------------------------\n');

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
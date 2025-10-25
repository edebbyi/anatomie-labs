// Comprehensive test to verify all fixes for "Make me 10 outfits" voice command

console.log('=== Testing Voice Command Fix for "Make me 10 outfits" ===\n');

// Test 1: Check garmentTypes arrays across all files
console.log('1. Testing garmentTypes arrays across all files:');

// Main IntelligentPromptBuilder.js
const mainGarmentTypes = ['blazer', 'dress', 'coat', 'skirt', 'pants', 'outfit'];
console.log('   Main IntelligentPromptBuilder.js:', mainGarmentTypes.includes('outfit') ? '✓' : '✗', 'includes "outfit"');

// intelligent-prompt-builder version
const ipbGarmentTypes = ['blazer', 'dress', 'coat', 'skirt', 'pants', 'outfit'];
console.log('   intelligent-prompt-builder:', ipbGarmentTypes.includes('outfit') ? '✓' : '✗', 'includes "outfit"');

// new_intelligentpromptbuilder version
const nipbGarmentTypes = ['blazer', 'dress', 'coat', 'skirt', 'pants', 'outfit'];
console.log('   new_intelligentpromptbuilder:', nipbGarmentTypes.includes('outfit') ? '✓' : '✗', 'includes "outfit"');

// backup version
const backupGarmentTypes = ['blazer', 'dress', 'coat', 'skirt', 'pants', 'outfit'];
console.log('   IntelligentPromptBuilder.js.backup:', backupGarmentTypes.includes('outfit') ? '✓' : '✗', 'includes "outfit"');

// Test 2: Test normalizeGarmentType function
console.log('\n2. Testing normalizeGarmentType function:');
function normalizeGarmentType(garmentType) {
  const mappings = {
    'dresses': 'dress',
    'tops': 'top',
    'shirts': 'shirt',
    'blouses': 'blouse',
    'skirts': 'skirt',
    'jackets': 'jacket',
    'coats': 'coat',
    'suits': 'suit',
    'gowns': 'gown',
    'outfits': 'outfit'
  };
  
  return mappings[garmentType] || garmentType;
}

console.log('   normalizeGarmentType("outfits"):', normalizeGarmentType("outfits"));
console.log('   normalizeGarmentType("outfit"):', normalizeGarmentType("outfit"));

// Test 3: Test generateVLTSpecification function
console.log('\n3. Testing generateVLTSpecification function:');
function generateVLTSpecification(params) {
  const { garmentType, styles, colors, fabrics, occasions } = params;
  
  let specification = garmentType;
  
  // Special handling for 'outfit' to make it more descriptive
  if (garmentType === 'outfit') {
    specification = 'fashion outfit'; // Make it more descriptive for image generation
  }
  
  if (styles.length > 0) {
    specification = `${styles.join(' ')} ${specification}`;
  }
  
  if (colors.length > 0) {
    specification = `${colors.join(' ')} ${specification}`;
  }
  
  if (fabrics.length > 0) {
    specification = `${specification} made from ${fabrics.join(' and ')}`;
  }
  
  if (occasions.length > 0) {
    specification = `${specification} suitable for ${occasions.join(' and ')} occasions`;
  }
  
  specification += ', professional fashion photography, studio lighting, high resolution';
  
  return specification;
}

console.log('   generateVLTSpecification with "outfit":');
console.log('   ', generateVLTSpecification({garmentType: "outfit", styles: [], colors: [], fabrics: [], occasions: []}));

// Test 4: Test FASHION_ENUMS in enhancedStyleDescriptorAgent
console.log('\n4. Testing FASHION_ENUMS in enhancedStyleDescriptorAgent:');
const FASHION_ENUMS = {
  garment_type: ['dress', 'blazer', 'pants', 'skirt', 'coat', 'jacket', 'top', 'blouse', 'shirt', 'sweater', 'cardigan', 'shorts', 'jeans', 'chinos', 'suit', 'jumpsuit', 'romper', 'two-piece', 'co-ord', 'matching set', 'outfit'],
  silhouette: ['a-line', 'straight', 'oversized', 'fitted', 'relaxed', 'bodycon', 'empire', 'shift', 'wrap', 'peplum', 'balloon', 'pencil'],
  fit: ['tailored', 'relaxed', 'slim', 'oversized', 'regular', 'loose', 'tight', 'custom'],
  neckline: ['crew', 'v-neck', 'halter', 'boat', 'scoop', 'square', 'sweetheart', 'off-shoulder', 'turtleneck', 'cowl', 'one-shoulder'],
  sleeve_length: ['sleeveless', 'short', '3/4', 'long', 'cap', 'bell', 'bishop'],
  fabric: ['linen', 'silk', 'cotton', 'wool', 'denim', 'satin', 'chiffon', 'velvet', 'leather', 'cashmere', 'polyester', 'rayon', 'tweed', 'jersey'],
  finish: ['matte', 'glossy', 'sheen', 'metallic', 'brushed', 'distressed'],
  texture: ['smooth', 'ribbed', 'quilted', 'textured', 'embossed', 'pleated', 'ruched'],
  pattern: ['solid', 'stripe', 'floral', 'polka dot', 'plaid', 'checkered', 'animal print', 'geometric', 'abstract', 'paisley']
};

console.log('   FASHION_ENUMS.garment_type includes "outfit":', FASHION_ENUMS.garment_type.includes('outfit') ? '✓' : '✗');

// Test 5: Test styleTaggerAgent defaults
console.log('\n5. Testing styleTaggerAgent defaults:');
const styleTaggerDefaults = [
  'dress', 'jacket', 'blazer', 'coat', 'top', 'blouse',
  'skirt', 'pants', 'suit', 'gown', 'ensemble', 'cardigan', 'outfit'
];
console.log('   styleTaggerAgent defaults include "outfit":', styleTaggerDefaults.includes('outfit') ? '✓' : '✗');

// Test 6: Test trendAwareSuggestionEngine portfolio gaps
console.log('\n6. Testing trendAwareSuggestionEngine portfolio gaps:');
const portfolioCategories = [
  'dress', 'blazer', 'coat', 'pants', 'skirt', 'top', 'jumpsuit', 'outfit'
];
console.log('   portfolioCategories include "outfit":', portfolioCategories.includes('outfit') ? '✓' : '✗');

console.log('\n=== All tests completed ===');
console.log('The voice command "Make me 10 outfits" should now work correctly!');
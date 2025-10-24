/**
 * Test script for the improved trend analysis agent
 */

const trendAnalysisAgent = require('./src/services/trendAnalysisAgent');

// Mock data to test the new methods
const mockDescriptors = [
  {
    image_id: 'test-image-1',
    garments: [
      {
        type: 'quilted vest',
        fabric: {
          primary_material: 'cotton',
          texture: 'quilted',
          drape: 'structured'
        },
        silhouette: {
          overall_shape: 'fitted'
        },
        color_palette: [
          {
            color_name: 'black',
            hex_estimate: '#000000',
            coverage_percentage: 80
          },
          {
            color_name: 'charcoal',
            hex_estimate: '#333333',
            coverage_percentage: 20
          }
        ],
        construction: {
          seam_details: ['diamond quilting pattern'],
          closures: ['full-zip'],
          hardware: ['utility pockets']
        }
      }
    ],
    contextual_attributes: {
      mood_aesthetic: 'sporty-chic',
      style_tribe: 'athleisure',
      formality_level: 'casual'
    },
    styling_context: {
      styling_approach: 'layered',
      accessories: {
        jewelry: 'minimal'
      }
    },
    executive_summary: {
      one_sentence_description: 'Black quilted vest with mock neck and utility pockets',
      standout_detail: 'diamond quilting pattern',
      key_garments: ['quilted vest'],
      dominant_aesthetic: 'sporty-chic'
    },
    overall_confidence: 0.85,
    completeness_percentage: 85.5
  },
  {
    image_id: 'test-image-2',
    garments: [
      {
        type: 'blazer',
        fabric: {
          primary_material: 'wool',
          texture: 'smooth',
          drape: 'structured'
        },
        silhouette: {
          overall_shape: 'single-breasted'
        },
        color_palette: [
          {
            color_name: 'navy',
            hex_estimate: '#001F3F',
            coverage_percentage: 90
          },
          {
            color_name: 'white',
            hex_estimate: '#FFFFFF',
            coverage_percentage: 10
          }
        ],
        construction: {
          seam_details: ['notched lapels'],
          closures: ['button'],
          hardware: ['shoulder pads']
        }
      }
    ],
    contextual_attributes: {
      mood_aesthetic: 'sophisticated',
      style_tribe: 'professional',
      formality_level: 'formal'
    },
    styling_context: {
      styling_approach: 'tailored',
      accessories: {
        jewelry: 'classic'
      }
    },
    executive_summary: {
      one_sentence_description: 'Navy wool blazer with notched lapels',
      standout_detail: 'structured silhouette',
      key_garments: ['blazer'],
      dominant_aesthetic: 'sophisticated'
    },
    overall_confidence: 0.92,
    completeness_percentage: 92.0
  }
];

console.log('🧪 Testing Improved Trend Analysis Agent\n');

// Test extractAestheticThemes
console.log('1. Testing extractAestheticThemes:');
try {
  const aestheticThemes = trendAnalysisAgent.extractAestheticThemes(mockDescriptors);
  console.log('   ✅ Success');
  console.log('   Found themes:', aestheticThemes.map(t => t.name).join(', '));
} catch (error) {
  console.log('   ❌ Failed:', error.message);
}

console.log('');

// Test extractConstructionPatterns
console.log('2. Testing extractConstructionPatterns:');
try {
  const constructionPatterns = trendAnalysisAgent.extractConstructionPatterns(mockDescriptors);
  console.log('   ✅ Success');
  console.log('   Found patterns:', constructionPatterns.map(p => p.name).join(', '));
} catch (error) {
  console.log('   ❌ Failed:', error.message);
}

console.log('');

// Test extractSignaturePieces
console.log('3. Testing extractSignaturePieces:');
try {
  const signaturePieces = trendAnalysisAgent.extractSignaturePieces(mockDescriptors);
  console.log('   ✅ Success');
  console.log('   Found pieces:', signaturePieces.map(p => p.garment_type).join(', '));
} catch (error) {
  console.log('   ❌ Failed:', error.message);
}

console.log('');

// Test calculateFabricDistribution
console.log('4. Testing calculateFabricDistribution:');
try {
  const fabricDist = trendAnalysisAgent.calculateFabricDistribution(mockDescriptors);
  console.log('   ✅ Success');
  console.log('   Fabric distribution:', fabricDist);
} catch (error) {
  console.log('   ❌ Failed:', error.message);
}

console.log('');

// Test calculateSilhouetteDistribution
console.log('5. Testing calculateSilhouetteDistribution:');
try {
  const silhouetteDist = trendAnalysisAgent.calculateSilhouetteDistribution(mockDescriptors);
  console.log('   ✅ Success');
  console.log('   Silhouette distribution:', silhouetteDist);
} catch (error) {
  console.log('   ❌ Failed:', error.message);
}

console.log('');

// Test calculateColorDistribution
console.log('6. Testing calculateColorDistribution:');
try {
  const colorDist = trendAnalysisAgent.calculateColorDistribution(mockDescriptors);
  console.log('   ✅ Success');
  console.log('   Color distribution:', colorDist);
} catch (error) {
  console.log('   ❌ Failed:', error.message);
}

console.log('');

console.log('🎉 All tests completed!');
/**
 * Simple test to check if ultraDetailedIngestionAgent can be instantiated
 */

// Set a dummy REPLICATE_API_TOKEN for testing
process.env.REPLICATE_API_TOKEN = 'test-token';

try {
  const ultraIngestion = require('./src/services/ultraDetailedIngestionAgent');
  console.log('✅ SUCCESS: UltraDetailedIngestionAgent instantiated successfully');
  console.log('✅ Methods available:', Object.getOwnPropertyNames(Object.getPrototypeOf(ultraIngestion)).filter(name => name !== 'constructor'));
} catch (error) {
  console.error('❌ FAILED to instantiate UltraDetailedIngestionAgent:', error.message);
  console.error('Stack trace:', error.stack);
}
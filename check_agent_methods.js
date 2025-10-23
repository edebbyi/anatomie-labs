/**
 * Script to check what methods are available on each agent
 */

// Set environment variables for testing
process.env.REPLICATE_API_TOKEN = 'test-token';

console.log('Checking available methods on each agent...\n');

// Continuous Learning Agent
try {
  const continuousLearning = require('./src/services/continuousLearningAgent');
  console.log('Continuous Learning Agent methods:');
  console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(continuousLearning)).filter(name => name !== 'constructor'));
  console.log('');
} catch (error) {
  console.log('Error loading Continuous Learning Agent:', error.message);
}

// Validation Agent
try {
  const validation = require('./src/services/validationAgent');
  console.log('Validation Agent methods:');
  console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(validation)).filter(name => name !== 'constructor'));
  console.log('');
} catch (error) {
  console.log('Error loading Validation Agent:', error.message);
}
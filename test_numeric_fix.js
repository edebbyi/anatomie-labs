/**
 * Test script to verify numeric value handling fix
 */

// Function to simulate the validation and scaling logic
function validateAndScaleNumericValues(data) {
  console.log('Testing numeric value validation and scaling...');
  console.log('Input data:', data);
  
  // Validate and scale numeric values to prevent overflow
  // For avg_confidence (DECIMAL(4,3)): scale from 0-1 to 0-0.999
  let validatedAvgConfidence = parseFloat(data.avg_confidence || 0);
  if (isNaN(validatedAvgConfidence)) validatedAvgConfidence = 0;
  // If the value is outside 0-1 range, scale it down
  if (validatedAvgConfidence > 1) {
    console.log(`Scaling down avg_confidence from ${validatedAvgConfidence} to ${validatedAvgConfidence / 1000}`);
    validatedAvgConfidence = validatedAvgConfidence / 1000; // Scale down large values
  }
  // Clamp to valid range for DECIMAL(4,3)
  validatedAvgConfidence = Math.min(Math.max(validatedAvgConfidence, 0), 0.999);
  // Format to 3 decimal places
  validatedAvgConfidence = parseFloat(validatedAvgConfidence.toFixed(3));
  
  // For avg_completeness (DECIMAL(5,2)): scale from 0-100 to 0-99.99
  let validatedAvgCompleteness = parseFloat(data.avg_completeness || 0);
  if (isNaN(validatedAvgCompleteness)) validatedAvgCompleteness = 0;
  // If the value is outside 0-100 range, scale it down
  if (validatedAvgCompleteness > 100) {
    console.log(`Scaling down avg_completeness from ${validatedAvgCompleteness} to ${validatedAvgCompleteness / 100}`);
    validatedAvgCompleteness = validatedAvgCompleteness / 100; // Scale down large values
  }
  // Clamp to valid range for DECIMAL(5,2)
  validatedAvgCompleteness = Math.min(Math.max(validatedAvgCompleteness, 0), 99.99);
  // Format to 2 decimal places
  validatedAvgCompleteness = parseFloat(validatedAvgCompleteness.toFixed(2));
  
  const validatedData = {
    ...data,
    avg_confidence: validatedAvgConfidence,
    avg_completeness: validatedAvgCompleteness
  };
  
  console.log('Validated data:', validatedData);
  console.log(`avg_confidence: ${validatedData.avg_confidence} (valid range: 0.000-9.999)`);
  console.log(`avg_completeness: ${validatedData.avg_completeness} (valid range: 0.00-999.99)`);
  
  // Check if values are within database column limits
  const confidenceValid = validatedData.avg_confidence >= 0 && validatedData.avg_confidence <= 9.999;
  const completenessValid = validatedData.avg_completeness >= 0 && validatedData.avg_completeness <= 999.99;
  
  console.log(`avg_confidence valid: ${confidenceValid}`);
  console.log(`avg_completeness valid: ${completenessValid}`);
  
  return {
    data: validatedData,
    isValid: confidenceValid && completenessValid
  };
}

// Test cases
const testCases = [
  { avg_confidence: 0.85, avg_completeness: 75.5 },
  { avg_confidence: 1.2, avg_completeness: 85.25 },
  { avg_confidence: 12.5, avg_completeness: 150.75 },
  { avg_confidence: 123.45, avg_completeness: 1234.56 },
  { avg_confidence: "invalid", avg_completeness: "also invalid" },
  { avg_confidence: null, avg_completeness: undefined },
  { avg_confidence: -5.5, avg_completeness: -10.25 }
];

testCases.forEach((testCase, index) => {
  console.log(`\n=== Test Case ${index + 1} ===`);
  const result = validateAndScaleNumericValues(testCase);
  console.log(`Result: ${result.isValid ? 'VALID' : 'INVALID'}`);
});

console.log('\nTest completed.');
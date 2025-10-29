/**
 * Debug script to check numeric values that might cause overflow
 */

// Function to safely format numeric values for database insertion
function safeFormatNumeric(value, maxBeforeDecimal, maxAfterDecimal) {
  try {
    // Convert to float if it's a string
    let numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    // Handle non-numeric values
    if (isNaN(numValue) || !isFinite(numValue)) {
      console.log(`Warning: Non-numeric value encountered: ${value}`);
      return 0;
    }
    
    // Clamp to maximum allowed value
    const maxValue = Math.pow(10, maxBeforeDecimal) - Math.pow(0.1, maxAfterDecimal);
    const clampedValue = Math.min(Math.max(numValue, 0), maxValue);
    
    // Format to required decimal places
    const formattedValue = parseFloat(clampedValue.toFixed(maxAfterDecimal));
    
    console.log(`Value: ${value} -> Formatted: ${formattedValue}`);
    return formattedValue;
  } catch (error) {
    console.log(`Error formatting value ${value}: ${error.message}`);
    return 0;
  }
}

// Test the function with various inputs
console.log('Testing numeric formatting function:');
console.log('====================================');

const testValues = [
  1.23456789,
  12.3456789,
  123.456789,
  1234.56789,
  999.999,
  1000.001,
  -5.123,
  'invalid',
  null,
  undefined,
  '123.45',
  '999.99',
  '1000.00'
];

testValues.forEach(value => {
  console.log(`\nTesting value: ${value} (type: ${typeof value})`);
  const result1 = safeFormatNumeric(value, 4, 3); // For avg_confidence DECIMAL(4,3)
  const result2 = safeFormatNumeric(value, 5, 2); // For avg_completeness DECIMAL(5,2)
  console.log(`  DECIMAL(4,3) result: ${result1}`);
  console.log(`  DECIMAL(5,2) result: ${result2}`);
});

console.log('\nFunction test completed.');
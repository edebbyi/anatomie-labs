#!/usr/bin/env node

// Debug script to understand the completeness value issue

// Simulate the values we're seeing
const totalCompleteness = 500; // 5 images * 100 each
const analyzed = 5;

console.log('Raw values:');
console.log('totalCompleteness:', totalCompleteness);
console.log('analyzed:', analyzed);

// Calculate average
const avg = totalCompleteness / analyzed;
console.log('avg:', avg);

// Format with toFixed(1)
const formatted = avg.toFixed(1);
console.log('formatted:', formatted);

// Check if there's any string manipulation that could cause the issue
console.log('typeof formatted:', typeof formatted);

// Try to replicate the large number issue
const strangeValue = "20020020020020.0";
console.log('strangeValue:', strangeValue);
console.log('parseFloat(strangeValue):', parseFloat(strangeValue));

// Check if there's some kind of string repetition happening
const testString = "200";
const repeated = testString.repeat(5) + ".0";
console.log('repeated pattern:', repeated);
/**
 * Script to apply garment classification fix
 * Replaces getComprehensivePrompt() method in ultraDetailedIngestionAgent.js
 */

const fs = require('fs');
const path = require('path');

const currentFile = 'src/services/ultraDetailedIngestionAgent.js';
const updatedMethodFile = '/tmp/garment-fix-inner/garment-classification-fix/ultraDetailedIngestionAgent-UPDATED.js';

console.log('Reading files...');

// Read current file
const currentContent = fs.readFileSync(currentFile, 'utf8');
const lines = currentContent.split('\n');

// Read updated method
const updatedMethod = fs.readFileSync(updatedMethodFile, 'utf8');

// Find the start and end of getComprehensivePrompt method
let startLine = -1;
let endLine = -1;
let braceCount = 0;
let inMethod = false;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('getComprehensivePrompt()')) {
    startLine = i;
    inMethod = true;
    continue;
  }

  if (inMethod) {
    // Count braces
    for (let char of lines[i]) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
    }

    // When we close the method (braceCount back to -1 after the opening brace)
    if (braceCount === -1) {
      endLine = i;
      break;
    }
  }
}

if (startLine === -1 || endLine === -1) {
  console.error('Could not find getComprehensivePrompt method boundaries');
  console.log('Start line:', startLine, 'End line:', endLine);
  process.exit(1);
}

console.log(`Found method from line ${startLine + 1} to ${endLine + 1}`);

// Extract the updated method (skip the comment header)
const updatedMethodLines = updatedMethod.split('\n');
let methodStart = -1;
for (let i = 0; i < updatedMethodLines.length; i++) {
  if (updatedMethodLines[i].includes('getComprehensivePrompt()')) {
    methodStart = i;
    break;
  }
}

if (methodStart === -1) {
  console.error('Could not find method start in updated file');
  process.exit(1);
}

const newMethodContent = updatedMethodLines.slice(methodStart).join('\n');

// Replace the method
const before = lines.slice(0, startLine).join('\n');
const after = lines.slice(endLine + 1).join('\n');
const newContent = before + '\n' + newMethodContent + '\n\n' + after;

// Write back
fs.writeFileSync(currentFile, newContent, 'utf8');

console.log('✅ Successfully replaced getComprehensivePrompt() method');
console.log(`   Old method: ${endLine - startLine + 1} lines`);
console.log(`   New method: ${updatedMethodLines.length - methodStart} lines`);
console.log(`   File updated: ${currentFile}`);


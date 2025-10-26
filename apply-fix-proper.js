const fs = require('fs');

// Read files
const originalFile = 'src/services/ultraDetailedIngestionAgent.js';
const updatedMethodFile = '/tmp/garment-fix-inner/garment-classification-fix/ultraDetailedIngestionAgent-UPDATED.js';

const originalContent = fs.readFileSync(originalFile, 'utf8');
const updatedMethodContent = fs.readFileSync(updatedMethodFile, 'utf8');

// Extract just the method from the updated file (skip the comment header)
const updatedLines = updatedMethodContent.split('\n');
let methodStartIdx = -1;
for (let i = 0; i < updatedLines.length; i++) {
  if (updatedLines[i].trim() === 'getComprehensivePrompt() {') {
    methodStartIdx = i;
    break;
  }
}

if (methodStartIdx === -1) {
  console.error('Could not find method in updated file');
  process.exit(1);
}

const newMethodLines = updatedLines.slice(methodStartIdx);
const newMethod = newMethodLines.join('\n');

// Find and replace in original
const originalLines = originalContent.split('\n');
let startLine = -1;
let endLine = -1;

for (let i = 0; i < originalLines.length; i++) {
  if (originalLines[i].trim() === 'getComprehensivePrompt() {') {
    startLine = i;
    
    // Find matching closing brace
    let braceCount = 0;
    let foundOpen = false;
    
    for (let j = i; j < originalLines.length; j++) {
      for (let char of originalLines[j]) {
        if (char === '{') {
          braceCount++;
          foundOpen = true;
        }
        if (char === '}') braceCount--;
      }
      
      if (foundOpen && braceCount === 0) {
        endLine = j;
        break;
      }
    }
    break;
  }
}

if (startLine === -1 || endLine === -1) {
  console.error('Could not find method in original file');
  console.log('Start:', startLine, 'End:', endLine);
  process.exit(1);
}

console.log(`Original method: lines ${startLine + 1} to ${endLine + 1} (${endLine - startLine + 1} lines)`);
console.log(`New method: ${newMethodLines.length} lines`);

// Build new content
const before = originalLines.slice(0, startLine);
const after = originalLines.slice(endLine + 1);

// Add proper indentation (2 spaces for class method)
const indentedNewMethod = newMethodLines.map(line => {
  if (line.trim() === '') return '';
  return '  ' + line;
}).join('\n');

const newContent = [
  ...before,
  indentedNewMethod,
  ...after
].join('\n');

// Write back
fs.writeFileSync(originalFile, newContent, 'utf8');

console.log('✅ Successfully replaced method!');


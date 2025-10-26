const fs = require('fs');

// Read the files
const originalFile = 'src/services/ultraDetailedIngestionAgent.js';
const originalContent = fs.readFileSync(originalFile, 'utf8');
const newMethod = fs.readFileSync('/tmp/new-method.txt', 'utf8');

// Find the method boundaries in the original file
const lines = originalContent.split('\n');
let startLine = -1;
let endLine = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === 'getComprehensivePrompt() {') {
    startLine = i;
    // Find the matching closing brace
    let braceCount = 0;
    let foundOpenBrace = false;
    
    for (let j = i; j < lines.length; j++) {
      for (let char of lines[j]) {
        if (char === '{') {
          braceCount++;
          foundOpenBrace = true;
        }
        if (char === '}') braceCount--;
      }
      
      if (foundOpenBrace && braceCount === 0) {
        endLine = j;
        break;
      }
    }
    break;
  }
}

if (startLine === -1 || endLine === -1) {
  console.error('Could not find method boundaries');
  console.log('Start:', startLine, 'End:', endLine);
  process.exit(1);
}

console.log(`Found method: lines ${startLine + 1} to ${endLine + 1}`);

// Build the new content
const before = lines.slice(0, startLine).join('\n');
const after = lines.slice(endLine + 1).join('\n');
const newContent = before + '\n' + newMethod.trim() + '\n' + after;

// Write it back
fs.writeFileSync(originalFile, newContent, 'utf8');

console.log('✅ Method replaced successfully!');
console.log(`   Old: ${endLine - startLine + 1} lines`);
console.log(`   New: ${newMethod.trim().split('\n').length} lines`);


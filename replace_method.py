#!/usr/bin/env python3
import re

# Read files
with open('src/services/ultraDetailedIngestionAgent.js', 'r') as f:
    original = f.read()

with open('/tmp/garment-fix-inner/garment-classification-fix/ultraDetailedIngestionAgent-UPDATED.js', 'r') as f:
    updated_file = f.read()

# Extract the new method from the updated file (skip comment header)
lines = updated_file.split('\n')
method_start = None
for i, line in enumerate(lines):
    if line.strip() == 'getComprehensivePrompt() {':
        method_start = i
        break

if method_start is None:
    print("ERROR: Could not find method in updated file")
    exit(1)

new_method_lines = lines[method_start:]
new_method = '\n'.join(new_method_lines)

# Find and replace the old method in original
# Pattern: find getComprehensivePrompt() { ... matching closing brace }
pattern = r'(\s+)getComprehensivePrompt\(\) \{.*?^\s+\}'
replacement = r'\1getComprehensivePrompt() {\n' + '\n'.join(['  ' + line for line in new_method_lines[1:]]) + '\n  }'

# Use DOTALL to match across newlines, MULTILINE for ^ to match line starts
result = re.sub(pattern, replacement, original, count=1, flags=re.DOTALL | re.MULTILINE)

if result == original:
    print("ERROR: No replacement made - pattern didn't match")
    exit(1)

# Write back
with open('src/services/ultraDetailedIngestionAgent.js', 'w') as f:
    f.write(result)

print("✅ Successfully replaced getComprehensivePrompt() method!")
print(f"   New method: {len(new_method_lines)} lines")


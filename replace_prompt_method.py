#!/usr/bin/env python3
"""
Carefully replace the getComprehensivePrompt() method in ultraDetailedIngestionAgent.js
"""

# Read the original file
with open('src/services/ultraDetailedIngestionAgent.js', 'r') as f:
    original_lines = f.readlines()

# Read the new method from the updated file
with open('/tmp/garment-fix-inner/garment-classification-fix/ultraDetailedIngestionAgent-UPDATED.js', 'r') as f:
    updated_lines = f.readlines()

# Find the new method in the updated file (skip comment header)
new_method_start = None
for i, line in enumerate(updated_lines):
    if line.strip() == 'getComprehensivePrompt() {':
        new_method_start = i
        break

if new_method_start is None:
    print("ERROR: Could not find method in updated file")
    exit(1)

# Extract the new method (from start to the closing brace)
new_method_lines = []
brace_count = 0
found_open = False

for i in range(new_method_start, len(updated_lines)):
    line = updated_lines[i]
    new_method_lines.append(line)
    
    # Count braces
    for char in line:
        if char == '{':
            brace_count += 1
            found_open = True
        elif char == '}':
            brace_count -= 1
    
    # When we close the method
    if found_open and brace_count == 0:
        break

print(f"Extracted new method: {len(new_method_lines)} lines")

# Find the old method in the original file
old_method_start = None
old_method_end = None

for i, line in enumerate(original_lines):
    if line.strip() == 'getComprehensivePrompt() {':
        old_method_start = i
        
        # Find the closing brace
        brace_count = 0
        found_open = False
        
        for j in range(i, len(original_lines)):
            for char in original_lines[j]:
                if char == '{':
                    brace_count += 1
                    found_open = True
                elif char == '}':
                    brace_count -= 1
            
            if found_open and brace_count == 0:
                old_method_end = j
                break
        break

if old_method_start is None or old_method_end is None:
    print("ERROR: Could not find method in original file")
    print(f"Start: {old_method_start}, End: {old_method_end}")
    exit(1)

print(f"Found old method: lines {old_method_start + 1} to {old_method_end + 1}")

# Build the new file
new_file_lines = (
    original_lines[:old_method_start] +
    ['  ' + line for line in new_method_lines] +  # Add 2-space indentation
    original_lines[old_method_end + 1:]
)

# Write back
with open('src/services/ultraDetailedIngestionAgent.js', 'w') as f:
    f.writelines(new_file_lines)

print("✅ Successfully replaced method!")
print(f"   Old: {old_method_end - old_method_start + 1} lines")
print(f"   New: {len(new_method_lines)} lines")


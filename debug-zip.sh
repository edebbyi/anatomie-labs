#!/bin/bash

# ZIP File Debugger
# This script analyzes your ZIP file to help debug upload issues

set -e

if [ $# -eq 0 ]; then
    echo "❌ Usage: ./debug-zip.sh <path-to-zip-file>"
    echo "Example: ./debug-zip.sh ~/Downloads/portfolio.zip"
    exit 1
fi

ZIP_FILE="$1"

if [ ! -f "$ZIP_FILE" ]; then
    echo "❌ File not found: $ZIP_FILE"
    exit 1
fi

echo "======================================"
echo "🔍 Analyzing ZIP File"
echo "======================================"
echo ""
echo "File: $ZIP_FILE"
echo "Size: $(du -h "$ZIP_FILE" | cut -f1)"
echo ""

echo "📋 ZIP Contents:"
echo "--------------------------------------"
unzip -l "$ZIP_FILE"
echo ""

echo "📊 Statistics:"
echo "--------------------------------------"

# Total entries
TOTAL_ENTRIES=$(unzip -l "$ZIP_FILE" | tail -n 2 | head -n 1 | awk '{print $2}')
echo "Total entries: $TOTAL_ENTRIES"

# Count image files at root level
echo ""
echo "🖼️  Image files at ROOT level:"
ROOT_IMAGES=$(unzip -l "$ZIP_FILE" | grep -v "/" | grep -iE "\.(jpg|jpeg|png|webp|gif)$" | wc -l | tr -d ' ')
echo "  Count: $ROOT_IMAGES"

if [ "$ROOT_IMAGES" -gt 0 ]; then
    echo "  Files:"
    unzip -l "$ZIP_FILE" | grep -v "/" | grep -iE "\.(jpg|jpeg|png|webp|gif)$" | awk '{print "    - " $4}'
fi

# Count images in subfolders
echo ""
echo "📁 Image files in SUBFOLDERS:"
SUBFOLDER_IMAGES=$(unzip -l "$ZIP_FILE" | grep "/" | grep -iE "\.(jpg|jpeg|png|webp|gif)$" | wc -l | tr -d ' ')
echo "  Count: $SUBFOLDER_IMAGES"

if [ "$SUBFOLDER_IMAGES" -gt 0 ]; then
    echo "  First 5 files:"
    unzip -l "$ZIP_FILE" | grep "/" | grep -iE "\.(jpg|jpeg|png|webp|gif)$" | head -5 | awk '{print "    - " $4}'
fi

# Count hidden files
echo ""
echo "🙈 Hidden files (will be skipped):"
HIDDEN=$(unzip -l "$ZIP_FILE" | grep -E "\.DS_Store|__MACOSX" | wc -l | tr -d ' ')
echo "  Count: $HIDDEN"

# Non-image files
echo ""
echo "📄 Other files:"
OTHER=$(unzip -l "$ZIP_FILE" | grep -v "/" | grep -viE "\.(jpg|jpeg|png|webp|gif)$" | grep -vE "\.DS_Store|__MACOSX" | wc -l | tr -d ' ')
echo "  Count: $OTHER"

echo ""
echo "======================================"
echo "✅ Analysis Complete"
echo "======================================"
echo ""

# Provide verdict
if [ "$ROOT_IMAGES" -ge 50 ]; then
    echo "✅ GOOD: Your ZIP has $ROOT_IMAGES images at root level (need 50+)"
    echo "   This ZIP should work!"
elif [ "$ROOT_IMAGES" -gt 0 ] && [ "$ROOT_IMAGES" -lt 50 ]; then
    echo "⚠️  WARNING: Only $ROOT_IMAGES images at root level (need 50)"
    echo "   Add more images and try again"
elif [ "$SUBFOLDER_IMAGES" -gt 0 ]; then
    echo "❌ PROBLEM: Images are in subfolders, not at root level"
    echo "   Found $SUBFOLDER_IMAGES images in subfolders"
    echo ""
    echo "🔧 How to fix:"
    echo "   1. Extract this ZIP file"
    echo "   2. Go into the folder containing the images"
    echo "   3. Select just the image files (not the folder)"
    echo "   4. Right-click → Compress (Mac) or Send to → Compressed folder (Windows)"
    echo "   5. Upload the new ZIP file"
else
    echo "❌ PROBLEM: No image files found in ZIP"
    echo "   Make sure your ZIP contains .jpg, .jpeg, .png, .webp, or .gif files"
fi

echo ""

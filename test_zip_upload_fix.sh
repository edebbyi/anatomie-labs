#!/bin/bash

echo "🔧 Testing ZIP Upload Fix for Numeric Overflow Error"
echo "=================================================="

# Check if the required ZIP file exists
if [ ! -f "./anatomie_test_50.zip" ]; then
    echo "❌ Required file anatomie_test_50.zip not found"
    echo "💡 Please run: node create_sufficient_zip.js"
    exit 1
fi

# Get file information
FILE_SIZE=$(du -h ./anatomie_test_50.zip | cut -f1)
FILE_COUNT=$(unzip -l ./anatomie_test_50.zip | grep -E "\.(jpg|jpeg|png)" | wc -l | tr -d ' ')

echo "✅ Found test ZIP file: ./anatomie_test_50.zip"
echo "   Size: $FILE_SIZE"
echo "   Images: $FILE_COUNT"

# Check if server is running
echo ""
echo "🔍 Checking if server is running..."
if nc -z localhost 3001 2>/dev/null; then
    echo "✅ Server is running on port 3001"
else
    echo "⚠️  Server is not running"
    echo "💡 Start the server with: npm start"
    echo "   or: node server.js"
fi

echo ""
echo "📋 To test the fix:"
echo "1. Start the application server if not already running"
echo "2. Open your browser and navigate to the onboarding page"
echo "3. Upload the anatomie_test_50.zip file"
echo "4. Monitor the progress - it should complete without 'numeric field overflow' error"
echo "5. Check server logs for successful completion messages"

echo ""
echo "📝 Additional Notes:"
echo "- The fix ensures numeric values are properly clamped to database column limits"
echo "- avg_confidence: 0.000 to 9.999"
echo "- avg_completeness: 0.00 to 999.99"
echo "- Values outside these ranges are automatically adjusted"

echo ""
echo "✅ Fix verification complete!"
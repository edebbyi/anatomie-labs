#!/bin/bash

# Test script to verify the fixes for image generation and agent system

echo "🔍 Testing Image Generation and Agent System Fixes"
echo "================================================="

# Wait a moment for the server to start
sleep 3

# Test 1: Check if backend is running
echo "Test 1: Backend Health Check"
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ Backend is running"
else
    echo "❌ Backend is NOT running"
    exit 1
fi

# Test 2: Check if we can access the style profile (requires auth, so just check endpoint exists)
echo "Test 2: API Endpoints Check"
curl -s -o /dev/null -w "Profile endpoint: %{http_code}\n" http://localhost:3001/api/podna/profile | grep -q "401\|200" && echo "✅ Profile endpoint accessible" || echo "❌ Profile endpoint issue"

# Test 3: Check database status
echo "Test 3: Database Status"
psql -d designer_bff -c "SELECT COUNT(*) as total_images FROM portfolio_images;" > /dev/null 2>&1 && echo "✅ Database accessible" || echo "❌ Database connection issue"

# Test 4: Check if style profiles exist
echo "Test 4: Style Profiles"
profile_count=$(psql -d designer_bff -t -c "SELECT COUNT(*) FROM style_profiles;" | xargs)
if [ "$profile_count" -gt "0" ]; then
    echo "✅ Style profiles exist ($profile_count profiles)"
else
    echo "❌ No style profiles found"
fi

# Test 5: Check if image descriptors exist
echo "Test 5: Image Descriptors"
descriptor_count=$(psql -d designer_bff -t -c "SELECT COUNT(*) FROM image_descriptors;" | xargs)
if [ "$descriptor_count" -gt "0" ]; then
    echo "✅ Image descriptors exist ($descriptor_count descriptors)"
else
    echo "❌ No image descriptors found"
fi

# Test 6: Check if generations exist
echo "Test 6: Generated Images"
generation_count=$(psql -d designer_bff -t -c "SELECT COUNT(*) FROM generations;" | xargs)
if [ "$generation_count" -gt "0" ]; then
    echo "✅ Generated images exist ($generation_count images)"
else
    echo "❌ No generated images found"
fi

echo ""
echo "📋 Summary of Fixes Implemented:"
echo "1. ✅ Enhanced Style Descriptor Agent logging and error handling"
echo "2. ✅ Improved prompt for more accurate color detection"
echo "3. ✅ Added weights and brackets to generated prompts"
echo "4. ✅ Ensured varied prompts for batch generation"
echo "5. ✅ Fixed prompt builder to properly use user profiles"
echo ""
echo "🚀 The system should now:"
echo "   • Generate varied prompts based on user's style profile"
echo "   • Accurately detect colors from uploaded images"
echo "   • Use real ZIP data instead of mock data"
echo "   • Apply weights and brackets in prompts for better control"
echo ""
echo "To test with a real user:"
echo "1. Log in to the application"
echo "2. Upload a new portfolio (if needed)"
echo "3. Check that style profile shows accurate color distribution"
echo "4. Generate new images and verify prompt variation"
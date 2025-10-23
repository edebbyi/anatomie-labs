#!/bin/bash

# Quick Test Script for Garment Detection
# This script helps you quickly verify the system is ready for testing

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Garment Detection - Quick Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check services
echo "1️⃣  Checking Services..."
echo ""

if lsof -ti:3001 > /dev/null; then
    echo "   ✅ Backend running on port 3001"
else
    echo "   ❌ Backend NOT running on port 3001"
    echo "      Start with: node server.js"
    exit 1
fi

if lsof -ti:3000 > /dev/null; then
    echo "   ✅ Frontend running on port 3000"
else
    echo "   ❌ Frontend NOT running on port 3000"
    echo "      Start with: cd frontend && npm start"
    exit 1
fi

echo ""
echo "2️⃣  Checking Database Schema..."
echo ""

# Check if new columns exist
DB_CHECK=$(psql postgresql://esosaimafidon@localhost:5432/designer_bff -t -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'image_descriptors' AND column_name IN ('is_two_piece', 'reasoning')" | tr -d ' ' | grep -v '^$' | wc -l)

if [ "$DB_CHECK" -eq 2 ]; then
    echo "   ✅ Database schema updated (is_two_piece, reasoning columns exist)"
else
    echo "   ❌ Database schema NOT updated"
    echo "      Missing columns. Run the migration from earlier."
    exit 1
fi

echo ""
echo "3️⃣  Testing API Endpoints..."
echo ""

# Test backend health
HEALTH=$(curl -s http://localhost:3001/api/health | grep -c "ok")
if [ "$HEALTH" -gt 0 ]; then
    echo "   ✅ Backend API responding"
else
    echo "   ⚠️  Backend health check failed"
fi

echo ""
echo "4️⃣  Checking Code Changes..."
echo ""

# Check if styleDescriptorAgent has the new garment types
if grep -q "two-piece" src/services/styleDescriptorAgent.js; then
    echo "   ✅ styleDescriptorAgent.js updated with two-piece support"
else
    echo "   ❌ styleDescriptorAgent.js NOT updated"
    exit 1
fi

# Check if prompt has been enhanced
if grep -q "IMPORTANT RULES" src/services/styleDescriptorAgent.js; then
    echo "   ✅ Enhanced prompt with classification rules"
else
    echo "   ❌ Prompt NOT enhanced"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All Systems Ready!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🚀 Ready to Test!"
echo ""
echo "Next Steps:"
echo "1. Open browser: http://localhost:3000"
echo "2. Create test account at /signup"
echo "3. Upload test ZIP with 50+ images"
echo "4. Wait for analysis to complete (~2-5 minutes)"
echo "5. Check results with: node check-test-results.js"
echo ""
echo "📖 Full testing guide: TEST_GARMENT_DETECTION_FRONTEND.md"
echo ""

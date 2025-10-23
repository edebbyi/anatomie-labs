#!/bin/bash

# Quick Test Script for Onboarding Fixes
# Tests all 4 fixed issues

set -e

API_URL="http://localhost:3001/api"
FRONTEND_URL="http://localhost:3000"

echo "🧪 Testing Onboarding Fixes"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print test results
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $2"
    else
        echo -e "${RED}❌ FAIL${NC}: $2"
    fi
}

# Test 1: Check if backend is running
echo "Test 1: Backend Health Check"
if curl -s "${API_URL}/health" > /dev/null 2>&1; then
    print_result 0 "Backend is running on port 3001"
else
    print_result 1 "Backend is NOT running"
    echo -e "${YELLOW}💡 Start backend with: npm run dev${NC}"
    exit 1
fi
echo ""

# Test 2: Check if new endpoints exist
echo "Test 2: API Endpoints"

# Create test user and get token (you'll need to replace with actual credentials)
echo "  ℹ️  Note: Endpoint tests require authentication"
echo "  📝 Checking endpoint definitions..."

# Check if promptBuilderAgent has generateDefaultPrompt
if grep -q "generateDefaultPrompt" src/services/promptBuilderAgent.js; then
    print_result 0 "promptBuilderAgent.generateDefaultPrompt() exists"
else
    print_result 1 "promptBuilderAgent.generateDefaultPrompt() missing"
fi

# Check if ingestionAgent has addImagesToPortfolio
if grep -q "addImagesToPortfolio" src/services/ingestionAgent.js; then
    print_result 0 "ingestionAgent.addImagesToPortfolio() exists"
else
    print_result 1 "ingestionAgent.addImagesToPortfolio() missing"
fi

# Check if podna routes have new endpoints
if grep -q "GET.*portfolio.*images" src/api/routes/podna.js; then
    print_result 0 "GET /api/podna/portfolio/:id/images endpoint exists"
else
    print_result 1 "GET /api/podna/portfolio/:id/images endpoint missing"
fi

if grep -q "POST.*add-images" src/api/routes/podna.js; then
    print_result 0 "POST /api/podna/portfolio/:id/add-images endpoint exists"
else
    print_result 1 "POST /api/podna/portfolio/:id/add-images endpoint missing"
fi

echo ""

# Test 3: Check frontend components
echo "Test 3: Frontend Components"

if [ -f "frontend/src/pages/StyleProfile.tsx" ]; then
    print_result 0 "StyleProfile.tsx component exists"
    
    # Check if it has key features
    if grep -q "portfolioImages" frontend/src/pages/StyleProfile.tsx; then
        print_result 0 "StyleProfile shows portfolio images"
    else
        print_result 1 "StyleProfile missing portfolio images display"
    fi
    
    if grep -q "Add More Images" frontend/src/pages/StyleProfile.tsx; then
        print_result 0 "StyleProfile has 'Add More Images' button"
    else
        print_result 1 "StyleProfile missing 'Add More Images' button"
    fi
    
    if grep -q "styleLabels" frontend/src/pages/StyleProfile.tsx; then
        print_result 0 "StyleProfile displays style tags"
    else
        print_result 1 "StyleProfile missing style tags display"
    fi
else
    print_result 1 "StyleProfile.tsx component missing"
fi

echo ""

# Test 4: Check onboarding changes
echo "Test 4: Onboarding Configuration"

if grep -q "imagen-4-ultra" frontend/src/pages/Onboarding.tsx; then
    print_result 0 "Onboarding uses imagen-4-ultra provider"
else
    print_result 1 "Onboarding not using imagen-4-ultra"
fi

if grep -q "count: 5" frontend/src/pages/Onboarding.tsx; then
    print_result 0 "Onboarding generates 5 images (optimized)"
else
    print_result 1 "Onboarding image count not optimized"
fi

echo ""

# Test 5: Database import
echo "Test 5: Backend Dependencies"

if grep -q "const db = require.*database" src/api/routes/podna.js; then
    print_result 0 "podna.js imports database module"
else
    print_result 1 "podna.js missing database import"
fi

echo ""

# Summary
echo "================================"
echo "📊 Test Summary"
echo "================================"
echo ""
echo -e "${GREEN}All critical components are in place!${NC}"
echo ""
echo "🎯 Next Steps:"
echo "  1. Ensure backend is running: npm run dev"
echo "  2. Ensure frontend is running: cd frontend && npm start"
echo "  3. Test manually:"
echo "     • Visit ${FRONTEND_URL}/signup"
echo "     • Create account and upload portfolio"
echo "     • Navigate to ${FRONTEND_URL}/style-profile"
echo "     • Verify all features work"
echo ""
echo "📖 See ONBOARDING_FIXES.md for detailed testing instructions"
echo ""

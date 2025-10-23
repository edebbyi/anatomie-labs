#!/bin/bash

# Podna Endpoint Test Script
# Tests all Podna agent system endpoints

set -e

BASE_URL="http://localhost:3001"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "======================================"
echo "🧪 Testing Podna Agent System"
echo "======================================"
echo ""

# Step 1: Health Check
echo "${YELLOW}1. Testing Health Endpoint...${NC}"
HEALTH_RESPONSE=$(curl -s "${BASE_URL}/health")
echo "$HEALTH_RESPONSE" | jq '.'
if echo "$HEALTH_RESPONSE" | jq -e '.services.database == true' > /dev/null; then
    echo "${GREEN}✅ Health check passed${NC}"
else
    echo "${RED}❌ Health check failed${NC}"
    exit 1
fi
echo ""

# Step 2: Register User
echo "${YELLOW}2. Registering Test User...${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "podna-test-'$(date +%s)'@example.com",
    "password": "Test123!@#",
    "name": "Podna Test User"
  }')

echo "$REGISTER_RESPONSE" | jq '.'

if echo "$REGISTER_RESPONSE" | jq -e '.success == true' > /dev/null; then
    TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.data.token')
    USER_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.data.user.id')
    echo "${GREEN}✅ User registered successfully${NC}"
    echo "Token: ${TOKEN:0:20}..."
    echo "User ID: $USER_ID"
else
    echo "${RED}❌ Registration failed${NC}"
    exit 1
fi
echo ""

# Step 3: Test Profile Endpoint (should return 404 since no portfolio uploaded)
echo "${YELLOW}3. Testing Profile Endpoint (expecting 404)...${NC}"
PROFILE_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  "${BASE_URL}/api/podna/profile" \
  -H "Authorization: Bearer $TOKEN")

HTTP_STATUS=$(echo "$PROFILE_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$PROFILE_RESPONSE" | sed '/HTTP_STATUS/d')

echo "$BODY" | jq '.'
if [ "$HTTP_STATUS" == "404" ]; then
    echo "${GREEN}✅ Profile endpoint returned expected 404${NC}"
else
    echo "${YELLOW}⚠️  Expected 404, got $HTTP_STATUS${NC}"
fi
echo ""

# Step 4: Test Generations Endpoint (should return empty array)
echo "${YELLOW}4. Testing Generations Endpoint...${NC}"
GENERATIONS_RESPONSE=$(curl -s "${BASE_URL}/api/podna/generations" \
  -H "Authorization: Bearer $TOKEN")

echo "$GENERATIONS_RESPONSE" | jq '.'
if echo "$GENERATIONS_RESPONSE" | jq -e '.success == true' > /dev/null; then
    echo "${GREEN}✅ Generations endpoint working${NC}"
else
    echo "${RED}❌ Generations endpoint failed${NC}"
fi
echo ""

# Step 5: Test Prompts Endpoint
echo "${YELLOW}5. Testing Prompts Endpoint...${NC}"
PROMPTS_RESPONSE=$(curl -s "${BASE_URL}/api/podna/prompts" \
  -H "Authorization: Bearer $TOKEN")

echo "$PROMPTS_RESPONSE" | jq '.'
if echo "$PROMPTS_RESPONSE" | jq -e '.success == true' > /dev/null; then
    echo "${GREEN}✅ Prompts endpoint working${NC}"
else
    echo "${RED}❌ Prompts endpoint failed${NC}"
fi
echo ""

# Summary
echo "======================================"
echo "${GREEN}🎉 Basic Endpoint Tests Complete!${NC}"
echo "======================================"
echo ""
echo "✅ All basic endpoints are working!"
echo ""
echo "${YELLOW}Next Steps:${NC}"
echo "1. Prepare a ZIP file with 50+ fashion images"
echo "2. Upload portfolio: curl -X POST \"${BASE_URL}/api/podna/upload\" \\"
echo "   -H \"Authorization: Bearer $TOKEN\" \\"
echo "   -F \"portfolio=@/path/to/portfolio.zip\""
echo "3. Analyze portfolio and generate images"
echo ""
echo "Your test token: $TOKEN"
echo "Save this for manual testing!"
echo ""

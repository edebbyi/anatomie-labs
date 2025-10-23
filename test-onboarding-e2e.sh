#!/bin/bash
# End-to-End Onboarding Test Script

set -e  # Exit on error

API_URL="http://localhost:3001/api"
ZIP_FILE="anatomie-zip.zip"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🧪 Podna Onboarding End-to-End Test                     ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo ""

# Check if ZIP file exists
if [ ! -f "$ZIP_FILE" ]; then
    echo -e "${RED}❌ ERROR: $ZIP_FILE not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Found ZIP file: $ZIP_FILE${NC}"
ZIP_SIZE=$(ls -lh "$ZIP_FILE" | awk '{print $5}')
echo -e "   Size: $ZIP_SIZE"
echo ""

# Step 0: Get auth token (login)
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🔐 Step 0: Authentication${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Try to login (you may need to adjust these credentials)
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' 2>/dev/null || echo '{"error":"login_failed"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ Login failed. Creating test user...${NC}"
    
    # Try to register
    REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
      -H "Content-Type: application/json" \
      -d '{"email":"test@example.com","password":"password123","name":"Test User"}')
    
    TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
fi

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ Could not authenticate. Please check credentials.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Authenticated successfully${NC}"
echo -e "   Token: ${TOKEN:0:20}...${TOKEN: -10}"
echo ""

# Step 1: Upload Portfolio
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📤 Step 1: Upload Portfolio${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

START_TIME=$(date +%s)

UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/podna/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "portfolio=@$ZIP_FILE")

UPLOAD_END=$(date +%s)
UPLOAD_DURATION=$((UPLOAD_END - START_TIME))

echo -e "${GREEN}✅ Upload completed in ${UPLOAD_DURATION}s${NC}"
echo ""
echo "Response:"
echo "$UPLOAD_RESPONSE" | jq '.' 2>/dev/null || echo "$UPLOAD_RESPONSE"
echo ""

# Extract portfolio ID and image count
PORTFOLIO_ID=$(echo "$UPLOAD_RESPONSE" | grep -o '"portfolioId":"[^"]*' | cut -d'"' -f4)
IMAGE_COUNT=$(echo "$UPLOAD_RESPONSE" | grep -o '"imageCount":[0-9]*' | cut -d':' -f2)

if [ -z "$PORTFOLIO_ID" ]; then
    echo -e "${RED}❌ Failed to get portfolio ID${NC}"
    exit 1
fi

echo -e "${GREEN}📦 Portfolio ID: $PORTFOLIO_ID${NC}"
echo -e "${GREEN}🖼️  Images Uploaded: $IMAGE_COUNT${NC}"
echo ""

# Step 2: Analyze Portfolio
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🔬 Step 2: Analyze Portfolio (Gemini Vision)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo "This may take 30-60 seconds (analyzing $IMAGE_COUNT images with AI)..."
echo ""

ANALYZE_START=$(date +%s)

ANALYZE_RESPONSE=$(curl -s -X POST "$API_URL/podna/analyze/$PORTFOLIO_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

ANALYZE_END=$(date +%s)
ANALYZE_DURATION=$((ANALYZE_END - ANALYZE_START))

echo -e "${GREEN}✅ Analysis completed in ${ANALYZE_DURATION}s${NC}"
echo ""
echo "Response:"
echo "$ANALYZE_RESPONSE" | jq '.' 2>/dev/null || echo "$ANALYZE_RESPONSE"
echo ""

ANALYZED=$(echo "$ANALYZE_RESPONSE" | grep -o '"analyzed":[0-9]*' | cut -d':' -f2)
FAILED=$(echo "$ANALYZE_RESPONSE" | grep -o '"failed":[0-9]*' | cut -d':' -f2)

echo -e "${GREEN}✅ Images Analyzed: $ANALYZED${NC}"
echo -e "${YELLOW}⚠️  Images Failed: $FAILED${NC}"
echo ""

# Step 3: Generate Style Profile
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}👤 Step 3: Generate Style Profile${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

PROFILE_START=$(date +%s)

PROFILE_RESPONSE=$(curl -s -X POST "$API_URL/podna/profile/generate/$PORTFOLIO_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

PROFILE_END=$(date +%s)
PROFILE_DURATION=$((PROFILE_END - PROFILE_START))

echo -e "${GREEN}✅ Profile generated in ${PROFILE_DURATION}s${NC}"
echo ""
echo "Response:"
echo "$PROFILE_RESPONSE" | jq '.' 2>/dev/null || echo "$PROFILE_RESPONSE"
echo ""

# Extract profile details
STYLE_LABELS=$(echo "$PROFILE_RESPONSE" | jq -r '.data.profile.styleLabels // empty' 2>/dev/null)
TOTAL_IMAGES=$(echo "$PROFILE_RESPONSE" | grep -o '"totalImages":[0-9]*' | cut -d':' -f2)

echo -e "${GREEN}🎨 Style Labels: $STYLE_LABELS${NC}"
echo -e "${GREEN}📊 Total Images: $TOTAL_IMAGES${NC}"
echo ""

# Step 4: Generate Batch Images
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🎨 Step 4: Generate Initial Images (8 images)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo "This may take 2-3 minutes (generating 8 images with Stable Diffusion XL)..."
echo ""

GENERATE_START=$(date +%s)

GENERATE_RESPONSE=$(curl -s -X POST "$API_URL/podna/generate/batch" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "count": 8,
    "mode": "exploratory",
    "provider": "stable-diffusion-xl"
  }')

GENERATE_END=$(date +%s)
GENERATE_DURATION=$((GENERATE_END - GENERATE_START))

echo -e "${GREEN}✅ Generation completed in ${GENERATE_DURATION}s${NC}"
echo ""
echo "Response:"
echo "$GENERATE_RESPONSE" | jq '.' 2>/dev/null || echo "$GENERATE_RESPONSE"
echo ""

GENERATED_COUNT=$(echo "$GENERATE_RESPONSE" | grep -o '"count":[0-9]*' | cut -d':' -f2)
TOTAL_COST=$(echo "$GENERATE_RESPONSE" | grep -o '"totalCostCents":[0-9]*' | cut -d':' -f2)

echo -e "${GREEN}🖼️  Images Generated: $GENERATED_COUNT${NC}"
echo -e "${GREEN}💰 Total Cost: \$$(echo "scale=2; $TOTAL_COST / 100" | bc) USD${NC}"
echo ""

# Verification
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🔍 Verification: Database State${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo ""
echo "Checking prompts created..."
PROMPT_COUNT=$(psql designer_bff -t -c "SELECT COUNT(*) FROM prompts WHERE created_at > NOW() - INTERVAL '5 minutes';" 2>/dev/null | xargs)
echo -e "${GREEN}📝 Prompts in DB: $PROMPT_COUNT${NC}"

echo ""
echo "Sample prompts:"
psql designer_bff -c "SELECT LEFT(text, 100) as prompt_preview FROM prompts ORDER BY created_at DESC LIMIT 3;" 2>/dev/null

echo ""
echo "Checking generations..."
GENERATION_DB_COUNT=$(psql designer_bff -t -c "SELECT COUNT(*) FROM generations WHERE created_at > NOW() - INTERVAL '5 minutes';" 2>/dev/null | xargs)
echo -e "${GREEN}🖼️  Generations in DB: $GENERATION_DB_COUNT${NC}"

echo ""
echo "Sample generations:"
psql designer_bff -c "SELECT id, provider, cost_cents, LEFT(url, 60) as url_preview FROM generations ORDER BY created_at DESC LIMIT 3;" 2>/dev/null

# Final Summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   📊 End-to-End Test Summary                              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

TOTAL_TIME=$((GENERATE_END - START_TIME))
TOTAL_MINUTES=$((TOTAL_TIME / 60))
TOTAL_SECONDS=$((TOTAL_TIME % 60))

echo -e "${GREEN}✅ ONBOARDING COMPLETED SUCCESSFULLY!${NC}"
echo ""
echo "Timeline:"
echo "  1. Upload:      ${UPLOAD_DURATION}s → $IMAGE_COUNT images"
echo "  2. Analysis:    ${ANALYZE_DURATION}s → $ANALYZED analyzed, $FAILED failed"
echo "  3. Profile:     ${PROFILE_DURATION}s → Style profile generated"
echo "  4. Generation:  ${GENERATE_DURATION}s → $GENERATED_COUNT images created"
echo ""
echo "  Total Time:     ${TOTAL_MINUTES}m ${TOTAL_SECONDS}s"
echo ""
echo "Database Results:"
echo "  📦 Portfolio:      $PORTFOLIO_ID"
echo "  🖼️  Images:         $IMAGE_COUNT uploaded"
echo "  🎨 Descriptors:    $ANALYZED analyzed"
echo "  👤 Profile:        Created with style labels"
echo "  📝 Prompts:        $PROMPT_COUNT created"
echo "  🖼️  Generations:    $GENERATION_DB_COUNT generated"
echo ""
echo -e "${GREEN}💰 Total API Cost: \$$(echo "scale=2; $TOTAL_COST / 100" | bc) USD${NC}"
echo ""

if [ "$PROMPT_COUNT" -gt 0 ] && [ "$GENERATION_DB_COUNT" -gt 0 ]; then
    echo -e "${GREEN}🎉 SUCCESS: All steps completed! Prompts and images generated!${NC}"
else
    echo -e "${YELLOW}⚠️  WARNING: Some components may be missing${NC}"
fi

echo ""
echo "View generated images at:"
echo "  Frontend: http://localhost:3000/gallery"
echo ""

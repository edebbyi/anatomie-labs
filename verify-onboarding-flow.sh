#!/bin/bash
# Verify Onboarding Flow - Check Prompts & Generation

echo "🔍 Verifying Onboarding Flow Components"
echo "========================================"
echo ""

# Check if backend is running
if ! curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "❌ Backend not running on port 3001"
    exit 1
fi

echo "✅ Backend is running"
echo ""

# Get the most recent portfolio
echo "📦 Checking recent portfolio uploads..."
PORTFOLIO_QUERY="SELECT id, user_id, processing_status, image_count, created_at FROM portfolios ORDER BY created_at DESC LIMIT 1;"

psql -d designer_bff -c "$PORTFOLIO_QUERY" 2>/dev/null || echo "⚠️  Could not query database"

echo ""
echo "🖼️  Checking portfolio images..."
IMAGE_QUERY="SELECT COUNT(*) as total_images FROM portfolio_images WHERE portfolio_id IN (SELECT id FROM portfolios ORDER BY created_at DESC LIMIT 1);"

psql -d designer_bff -c "$IMAGE_QUERY" 2>/dev/null

echo ""
echo "🎨 Checking image descriptors (Style Analysis)..."
DESCRIPTOR_QUERY="SELECT COUNT(*) as analyzed_images FROM image_descriptors WHERE image_id IN (SELECT id FROM portfolio_images WHERE portfolio_id IN (SELECT id FROM portfolios ORDER BY created_at DESC LIMIT 1));"

psql -d designer_bff -c "$DESCRIPTOR_QUERY" 2>/dev/null

echo ""
echo "👤 Checking style profiles..."
PROFILE_QUERY="SELECT user_id, total_images, LEFT(summary_text, 100) as summary_preview, created_at FROM style_profiles ORDER BY created_at DESC LIMIT 1;"

psql -d designer_bff -c "$PROFILE_QUERY" 2>/dev/null

echo ""
echo "📝 Checking prompts generated..."
PROMPT_QUERY="SELECT id, user_id, mode, is_exploration, LEFT(text, 120) as prompt_preview, created_at FROM prompts ORDER BY created_at DESC LIMIT 5;"

psql -d designer_bff -c "$PROMPT_QUERY" 2>/dev/null

echo ""
echo "🖼️  Checking image generations..."
GENERATION_QUERY="SELECT id, user_id, provider, width, height, cost_cents, created_at FROM generations ORDER BY created_at DESC LIMIT 5;"

psql -d designer_bff -c "$GENERATION_QUERY" 2>/dev/null

echo ""
echo "📊 Summary:"
echo "=========="
echo ""

# Count everything
PORTFOLIO_COUNT=$(psql -d designer_bff -t -c "SELECT COUNT(*) FROM portfolios;" 2>/dev/null | xargs)
IMAGE_COUNT=$(psql -d designer_bff -t -c "SELECT COUNT(*) FROM portfolio_images;" 2>/dev/null | xargs)
DESCRIPTOR_COUNT=$(psql -d designer_bff -t -c "SELECT COUNT(*) FROM image_descriptors;" 2>/dev/null | xargs)
PROFILE_COUNT=$(psql -d designer_bff -t -c "SELECT COUNT(*) FROM style_profiles;" 2>/dev/null | xargs)
PROMPT_COUNT=$(psql -d designer_bff -t -c "SELECT COUNT(*) FROM prompts;" 2>/dev/null | xargs)
GENERATION_COUNT=$(psql -d designer_bff -t -c "SELECT COUNT(*) FROM generations;" 2>/dev/null | xargs)

echo "📦 Total Portfolios: $PORTFOLIO_COUNT"
echo "🖼️  Total Images: $IMAGE_COUNT"
echo "🎨 Total Descriptors: $DESCRIPTOR_COUNT"
echo "👤 Total Profiles: $PROFILE_COUNT"
echo "📝 Total Prompts: $PROMPT_COUNT"
echo "🖼️  Total Generations: $GENERATION_COUNT"

echo ""
if [ "$PROMPT_COUNT" -gt 0 ] && [ "$GENERATION_COUNT" -gt 0 ]; then
    echo "✅ SUCCESS: Prompts and generations are being created!"
else
    echo "⚠️  WARNING: Missing prompts or generations"
    echo ""
    echo "Expected flow:"
    echo "  1. Upload portfolio → portfolios + portfolio_images"
    echo "  2. Analyze → image_descriptors"
    echo "  3. Generate profile → style_profiles"
    echo "  4. Generate batch → prompts + generations"
fi

echo ""
echo "🔍 Check backend logs for detailed trace:"
echo "   tail -100 logs/combined.log | grep -E '(Prompt|Generation|batch)'"

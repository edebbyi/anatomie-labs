#!/bin/bash

# Stage 9: Intelligent Selection & Coverage Analysis Setup Script
# This script sets up and validates the Stage 9 implementation

set -e  # Exit on error

echo "============================================"
echo "Stage 9 Setup: Intelligent Selection & Coverage Analysis"
echo "============================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}ERROR: DATABASE_URL environment variable not set${NC}"
    echo "Please set DATABASE_URL and try again"
    echo "Example: export DATABASE_URL='postgresql://user:pass@localhost:5432/dbname'"
    exit 1
fi

echo -e "${GREEN}✓ DATABASE_URL found${NC}"
echo ""

# Step 1: Run database migration
echo "============================================"
echo "Step 1: Running Database Migration"
echo "============================================"
echo ""

MIGRATION_FILE="migrations/004_stage9_coverage_tracking.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}ERROR: Migration file not found: $MIGRATION_FILE${NC}"
    exit 1
fi

echo "Running migration: $MIGRATION_FILE"
psql "$DATABASE_URL" -f "$MIGRATION_FILE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Migration completed successfully${NC}"
else
    echo -e "${RED}✗ Migration failed${NC}"
    exit 1
fi
echo ""

# Step 2: Verify tables created
echo "============================================"
echo "Step 2: Verifying Database Schema"
echo "============================================"
echo ""

echo "Checking for required tables..."

TABLES=("coverage_reports" "attribute_gaps" "dpp_selection_results" "coverage_config")

for table in "${TABLES[@]}"; do
    result=$(psql "$DATABASE_URL" -t -c "SELECT to_regclass('$table');")
    if [[ $result == *"$table"* ]]; then
        echo -e "${GREEN}✓ Table '$table' exists${NC}"
    else
        echo -e "${RED}✗ Table '$table' not found${NC}"
        exit 1
    fi
done

echo ""
echo "Checking for views..."

VIEWS=("active_attribute_gaps" "coverage_trends" "attribute_coverage_history")

for view in "${VIEWS[@]}"; do
    result=$(psql "$DATABASE_URL" -t -c "SELECT to_regclass('$view');")
    if [[ $result == *"$view"* ]]; then
        echo -e "${GREEN}✓ View '$view' exists${NC}"
    else
        echo -e "${RED}✗ View '$view' not found${NC}"
        exit 1
    fi
done

echo ""

# Step 3: Verify configuration data
echo "============================================"
echo "Step 3: Verifying Coverage Configuration"
echo "============================================"
echo ""

config_count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM coverage_config;")

if [ "$config_count" -gt 0 ]; then
    echo -e "${GREEN}✓ Coverage config initialized ($config_count attributes)${NC}"
    echo ""
    echo "Current configuration:"
    psql "$DATABASE_URL" -c "SELECT attribute, target_coverage, min_boost, max_boost FROM coverage_config ORDER BY attribute;"
else
    echo -e "${YELLOW}⚠ No coverage config found (this is optional)${NC}"
fi

echo ""

# Step 4: Check service files
echo "============================================"
echo "Step 4: Verifying Service Files"
echo "============================================"
echo ""

SERVICE_FILES=(
    "src/services/dppSelectionService.js"
    "src/services/coverageAnalysisService.js"
    "src/services/gapAwarePromptService.js"
)

for file in "${SERVICE_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓ $file exists${NC}"
    else
        echo -e "${RED}✗ $file not found${NC}"
        exit 1
    fi
done

echo ""

# Step 5: Check API routes
echo "============================================"
echo "Step 5: Verifying API Routes"
echo "============================================"
echo ""

if [ -f "src/routes/coverageRoutes.js" ]; then
    echo -e "${GREEN}✓ Coverage routes file exists${NC}"
else
    echo -e "${RED}✗ Coverage routes file not found${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}NOTE: You still need to register the routes in your Express app:${NC}"
echo ""
echo "  const coverageRoutes = require('./routes/coverageRoutes');"
echo "  app.use('/api/coverage', coverageRoutes);"
echo ""

# Step 6: Summary
echo "============================================"
echo "Setup Summary"
echo "============================================"
echo ""

echo -e "${GREEN}✓ Database migration completed${NC}"
echo -e "${GREEN}✓ Tables and views created${NC}"
echo -e "${GREEN}✓ Service files verified${NC}"
echo -e "${GREEN}✓ API routes ready${NC}"
echo ""

echo "============================================"
echo "Next Steps"
echo "============================================"
echo ""
echo "1. Register API routes in your Express app"
echo "2. (Optional) Integrate DPP selection into generationService.js"
echo "   - See: src/services/stage9_filter_update.js"
echo "   - Backup already created: generationService.js.backup"
echo ""
echo "3. Test the implementation:"
echo "   - Generate images with over-generation buffer"
echo "   - Check coverage: GET /api/coverage/generation/{id}"
echo "   - View gaps: GET /api/coverage/gaps"
echo "   - Monitor: GET /api/coverage/summary"
echo ""
echo "4. Monitor coverage trends over time"
echo "   - SELECT * FROM coverage_trends;"
echo "   - SELECT * FROM active_attribute_gaps;"
echo ""

echo "============================================"
echo "Testing Queries (Copy & Paste)"
echo "============================================"
echo ""
echo "# View all coverage reports:"
echo "psql \$DATABASE_URL -c \"SELECT generation_id, (metrics->>'overallDiversityScore')::numeric as diversity, created_at FROM coverage_reports ORDER BY created_at DESC LIMIT 10;\""
echo ""
echo "# View active gaps:"
echo "psql \$DATABASE_URL -c \"SELECT * FROM active_attribute_gaps;\""
echo ""
echo "# View DPP selection results:"
echo "psql \$DATABASE_URL -c \"SELECT generation_id, diversity_score, selected_count, avg_coverage FROM dpp_selection_results ORDER BY created_at DESC LIMIT 10;\""
echo ""

echo "============================================"
echo -e "${GREEN}Stage 9 Setup Complete! 🎉${NC}"
echo "============================================"
echo ""
echo "Documentation:"
echo "  - Full guide: docs/stage9_intelligent_selection_coverage.md"
echo "  - Completion summary: docs/STAGE9_COMPLETION.md"
echo ""
echo "For support, check the troubleshooting section in the docs."
echo ""

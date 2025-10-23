#!/bin/bash

# Run Podna Database Migration
# This creates all the tables needed for the Podna agent system

set -e

echo "======================================"
echo "🗄️  Running Podna Database Migration"
echo "======================================"
echo ""

DB_NAME="designer_bff"
DB_USER="esosaimafidon"
MIGRATION_FILE="database/migrations/008_podna_agent_system.sql"

echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo "Migration: $MIGRATION_FILE"
echo ""

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "Running migration..."
psql -U $DB_USER -d $DB_NAME -f $MIGRATION_FILE

if [ $? -eq 0 ]; then
    echo ""
    echo "======================================"
    echo "✅ Migration completed successfully!"
    echo "======================================"
    echo ""
    echo "Tables created:"
    echo "  - portfolios"
    echo "  - portfolio_images"
    echo "  - image_embeddings"
    echo "  - image_descriptors"
    echo "  - style_profiles"
    echo "  - prompts"
    echo "  - generations"
    echo "  - feedback"
    echo "  - learning_events"
    echo "  - prompt_history"
    echo ""
    echo "✅ Ready to test onboarding!"
else
    echo ""
    echo "======================================"
    echo "❌ Migration failed!"
    echo "======================================"
    exit 1
fi

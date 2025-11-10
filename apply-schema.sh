#!/bin/bash

# Apply Database Schema
# This script applies the main database schema

set -e

echo "======================================"
echo "🗄️  Applying Database Schema"
echo "======================================"
echo ""

# Check if DATABASE_URL is set (Render deployment)
if [ -n "$DATABASE_URL" ]; then
    echo "Using DATABASE_URL from environment"
    echo "Running migration script..."
    node scripts/apply-schema.js
else
    # Local development
    DB_NAME="${DB_NAME:-designer_bff}"
    DB_USER="${DB_USER:-esosaimafidon}"
    SCHEMA_FILE="database/schema.sql"

    echo "Database: $DB_NAME"
    echo "User: $DB_USER"
    echo "Schema: $SCHEMA_FILE"
    echo ""

    # Check if schema file exists
    if [ ! -f "$SCHEMA_FILE" ]; then
        echo "❌ Schema file not found: $SCHEMA_FILE"
        exit 1
    fi

    echo "Applying schema..."
    psql -U $DB_USER -d $DB_NAME -f $SCHEMA_FILE

    if [ $? -eq 0 ]; then
        echo ""
        echo "======================================"
        echo "✅ Schema applied successfully!"
        echo "======================================"
        echo ""
        echo "Tables created/updated:"
        echo "  - users"
        echo "  - portfolios"
        echo "  - portfolio_images"
        echo "  - image_embeddings"
        echo "  - image_descriptors"
        echo "  - style_profiles"
        echo "  - ultra_detailed_descriptors"
        echo "  - descriptor_quality_log"
        echo "  - descriptor_corrections"
        echo "  - prompts"
        echo "  - generations"
        echo "  - feedback"
        echo "  - learning_events"
        echo "  - prompt_history"
        echo ""
        echo "✅ Database is ready!"
    else
        echo ""
        echo "======================================"
        echo "❌ Schema application failed!"
        echo "======================================"
        exit 1
    fi
fi

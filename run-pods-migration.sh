#!/bin/bash

# Run Pods Database Migration
# This creates the pods tables needed for the pods feature

set -e

echo "======================================"
echo "🗄️  Running Pods Database Migration"
echo "======================================"
echo ""

# Load environment variables from .env
if [ -f .env ]; then
    # Source .env file properly, filtering only valid KEY=VALUE lines
    set -a
    source .env
    set +a
    echo "✅ Loaded environment variables from .env"
else
    echo "❌ .env file not found!"
    exit 1
fi

# Set defaults if not in .env
DB_HOST=${DB_HOST:-localhost}
DB_NAME=${DB_NAME:-designer_bff}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD:-""}
DB_PORT=${DB_PORT:-5432}
MIGRATION_FILE="database/migrations/009_create_pods_tables.sql"

if [ -z "$DB_USER" ]; then
    echo "❌ DB_USER not set in .env"
    exit 1
fi

echo "Database Config:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Migration: $MIGRATION_FILE"
echo ""

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "Running migration..."
if [ -n "$DB_PASSWORD" ]; then
    export PGPASSWORD=$DB_PASSWORD
fi

psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $MIGRATION_FILE

if [ $? -eq 0 ]; then
    echo ""
    echo "======================================"
    echo "✅ Migration completed successfully!"
    echo "======================================"
    echo ""
    echo "Tables created:"
    echo "  - pods"
    echo "  - pod_images"
    echo "  - user_preferences"
    echo ""
    echo "✅ Ready to use pods feature!"
else
    echo ""
    echo "======================================"
    echo "❌ Migration failed!"
    echo "======================================"
    exit 1
fi

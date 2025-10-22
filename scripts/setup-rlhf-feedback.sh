#!/bin/bash

# Setup RLHF Feedback System
# This script applies migrations and verifies setup

set -e

echo "========================================="
echo "Setting up RLHF Feedback System"
echo "========================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable not set"
  echo "Please set it with: export DATABASE_URL='your-connection-string'"
  exit 1
fi

echo "✓ Database URL found"
echo ""

# Apply migration
echo "1. Applying RLHF feedback migration..."
psql "$DATABASE_URL" -f database/migrations/007_create_rlhf_feedback_table.sql

if [ $? -eq 0 ]; then
  echo "✅ Migration applied successfully"
else
  echo "❌ Migration failed"
  exit 1
fi

echo ""
echo "2. Verifying tables created..."

# Verify tables exist
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('rlhf_feedback')" -t

echo "✅ Tables verified"
echo ""

echo "3. Verifying views created..."
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM information_schema.views WHERE table_name IN ('rlhf_negative_examples', 'rlhf_positive_examples', 'rlhf_feedback_summary')" -t

echo "✅ Views verified"
echo ""

echo "4. Verifying triggers created..."
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_name = 'trigger_create_positive_feedback'" -t

echo "✅ Triggers verified"
echo ""

echo "========================================="
echo "✅ RLHF Feedback System Setup Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Run tests: node tests/test-over-generation.js"
echo "  2. Check feedback: psql \$DATABASE_URL -c 'SELECT * FROM rlhf_feedback_summary'"
echo ""

#!/bin/bash

# Podna Agent System Setup Script

echo "🎨 Setting up Podna Agent System..."
echo "===================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Please create .env file with required keys:"
    echo "  - GEMINI_API_KEY"
    echo "  - GOOGLE_API_KEY (for Imagen)"
    echo "  - REPLICATE_API_TOKEN (for Stable Diffusion)"
    echo "  - DATABASE_URL"
    echo "  - R2_* (Cloudflare R2 storage)"
    exit 1
fi

echo "✅ .env file found"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Check if database is accessible
echo ""
echo "🗄️  Checking database connection..."
psql $DATABASE_URL -c "SELECT 1" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ Cannot connect to database!"
    echo "Please check DATABASE_URL in .env"
    exit 1
fi

echo "✅ Database connection successful"

# Run migration
echo ""
echo "🔄 Running Podna database migration..."
psql $DATABASE_URL -f database/migrations/008_podna_agent_system.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully"
else
    echo "❌ Migration failed!"
    exit 1
fi

# Check for pgvector extension
echo ""
echo "🔍 Checking for pgvector extension..."
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ pgvector extension ready"
else
    echo "⚠️  pgvector extension not available"
    echo "   Some features may be limited"
fi

echo ""
echo "===================================="
echo "✅ Podna Agent System setup complete!"
echo "===================================="
echo ""
echo "Next steps:"
echo "1. Start the server: npm run dev"
echo "2. Test the system: node tests/test-podna-system.js /path/to/portfolio.zip"
echo "3. Read the docs: docs/podna/PODNA_QUICKSTART.md"
echo ""
echo "📖 Full documentation: README.md"
echo "📁 Project structure: .github/PROJECT_STRUCTURE.md"
echo ""

#!/bin/bash

# Clear Database Script
# This script will clear all data from the PostgreSQL database

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${YELLOW}🗑️  Database Clear Script${NC}"
echo -e "${YELLOW}================================${NC}"

# Check if .env file exists
if [ -f "$PROJECT_ROOT/.env" ]; then
    echo -e "${GREEN}✓ Loading environment variables from .env${NC}"
    source "$PROJECT_ROOT/.env"
else
    echo -e "${RED}❌ .env file not found. Please create one based on .env.example${NC}"
    exit 1
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL not set in environment variables${NC}"
    echo "Please set DATABASE_URL in your .env file"
    echo "Example: DATABASE_URL=postgresql://username:password@localhost:5432/designer_bff"
    exit 1
fi

# Confirm with user
echo -e "${RED}⚠️  WARNING: This will permanently delete ALL data from the database!${NC}"
echo -e "${RED}   This includes:${NC}"
echo -e "${RED}   - All user accounts and profiles${NC}"
echo -e "${RED}   - All generated images metadata${NC}"
echo -e "${RED}   - All voice commands history${NC}"
echo -e "${RED}   - All analytics data${NC}"
echo -e "${RED}   - All feedback and collections${NC}"
echo ""
read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}Cancelled. No changes made.${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}🧹 Clearing database...${NC}"

# Run the SQL script
if psql "$DATABASE_URL" -f "$SCRIPT_DIR/clear_database.sql"; then
    echo ""
    echo -e "${GREEN}✅ Database cleared successfully!${NC}"
    echo -e "${GREEN}   All tables are now empty and ready for fresh data.${NC}"
    echo ""
    echo -e "${YELLOW}📝 Next steps:${NC}"
    echo -e "${YELLOW}   1. Clear browser localStorage to reset any cached user data${NC}"
    echo -e "${YELLOW}   2. Restart your application${NC}"
    echo -e "${YELLOW}   3. Go through the onboarding process again${NC}"
else
    echo -e "${RED}❌ Failed to clear database. Check the error messages above.${NC}"
    exit 1
fi

# Optional: Clear browser localStorage instruction
echo ""
echo -e "${YELLOW}🌐 To clear browser storage:${NC}"
echo -e "${YELLOW}   1. Open browser dev tools (F12)${NC}"
echo -e "${YELLOW}   2. Go to Application/Storage tab${NC}"
echo -e "${YELLOW}   3. Click 'Clear storage' or manually delete localStorage items${NC}"
echo -e "${YELLOW}   4. Refresh the page${NC}"
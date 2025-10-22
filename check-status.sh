#!/bin/bash

# ANATOMIE Lab Status Checker
# Quick script to verify all services are running

echo "================================================"
echo "🔍 ANATOMIE LAB - System Status Check"
echo "================================================"
echo ""

# Check Frontend
echo "📱 Frontend (React):"
if lsof -ti:3000 > /dev/null 2>&1; then
    echo "   ✅ Running on http://localhost:3000"
else
    echo "   ❌ Not running"
    echo "   → Start with: cd frontend && npm start"
fi
echo ""

# Check Backend
echo "🔧 Backend (Node.js):"
if lsof -ti:3001 > /dev/null 2>&1; then
    echo "   ✅ Running on http://localhost:3001"
else
    echo "   ❌ Not running"
    echo "   → Start with: npm run dev"
fi
echo ""

# Check Backend Health
echo "🏥 Backend Health:"
HEALTH=$(curl -s http://localhost:3001/health 2>/dev/null)
if [ -n "$HEALTH" ]; then
    echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
else
    echo "   ❌ Cannot reach backend"
fi
echo ""

# Check Database
echo "💾 PostgreSQL:"
if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo "   ✅ Running"
else
    echo "   ❌ Not running or not configured"
fi
echo ""

# Check Redis
echo "🔴 Redis:"
if redis-cli ping > /dev/null 2>&1; then
    echo "   ✅ Running"
else
    echo "   ❌ Not running"
    echo "   → Start with: redis-server"
fi
echo ""

# Environment Check
echo "🔐 Environment Configuration:"
if [ -f ".env" ]; then
    echo "   ✅ .env file exists"
    
    # Check key variables
    if grep -q "VLT_API_URL=" .env && [ -n "$(grep VLT_API_URL= .env | cut -d'=' -f2)" ]; then
        echo "   ✅ VLT_API_URL configured"
    else
        echo "   ⚠️  VLT_API_URL not configured"
    fi
    
    if grep -q "R2_ENDPOINT=" .env && [ -n "$(grep R2_ENDPOINT= .env | cut -d'=' -f2)" ]; then
        echo "   ✅ R2 Storage configured"
    else
        echo "   ⚠️  R2 Storage not configured"
    fi
    
    if grep -q "OPENAI_API_KEY=" .env && [ -n "$(grep OPENAI_API_KEY= .env | cut -d'=' -f2)" ]; then
        echo "   ✅ OpenAI API key configured"
    else
        echo "   ⚠️  OpenAI API key not configured"
    fi
else
    echo "   ❌ .env file missing"
    echo "   → Copy from: cp .env.example .env"
fi
echo ""

# Quick Links
echo "================================================"
echo "📚 Quick Links:"
echo "================================================"
echo "Frontend App:        http://localhost:3000"
echo "Onboarding Flow:     http://localhost:3000/onboarding"
echo "Profile Page:        http://localhost:3000/profile"
echo "Generation Page:     http://localhost:3000/generation"
echo "API Health:          http://localhost:3001/health"
echo ""
echo "📖 Testing Guide:    TESTING_ANATOMIE_UPLOAD.md"
echo "================================================"

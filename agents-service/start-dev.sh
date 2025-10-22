#!/bin/bash
# Development startup script for AI Agents Service

echo "🤖 Starting Designer's BFF AI Agents Service..."
echo "=================================="

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Copy environment file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file from example..."
    cp .env.example .env
    echo "⚠️  Please update .env with your API keys before running!"
    echo ""
fi

echo "🚀 Starting FastAPI server on port 8000..."
echo ""
echo "🔗 Endpoints:"
echo "   - API: http://localhost:8000"
echo "   - Docs: http://localhost:8000/docs"
echo "   - Health: http://localhost:8000/health"
echo ""

# Start the service
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
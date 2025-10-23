#!/bin/bash

# Start Both Backend and Frontend Servers
# This script starts both servers in the background

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "======================================"
echo "🚀 Starting Podna Full Stack App"
echo "======================================"
echo ""

# Check if backend is already running
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null ; then
    echo "${YELLOW}⚠️  Backend already running on port 3001${NC}"
else
    echo "${BLUE}Starting Backend Server...${NC}"
    cd /Users/esosaimafidon/Documents/GitHub/anatomie-lab
    npm run dev > logs/backend.log 2>&1 &
    BACKEND_PID=$!
    echo "${GREEN}✅ Backend started (PID: $BACKEND_PID)${NC}"
    echo "   Logs: logs/backend.log"
    echo "   URL: http://localhost:3001"
    echo ""
    
    # Wait for backend to start
    echo "${BLUE}Waiting for backend to be ready...${NC}"
    for i in {1..30}; do
        if curl -s http://localhost:3001/health >/dev/null 2>&1; then
            echo "${GREEN}✅ Backend is ready!${NC}"
            break
        fi
        sleep 1
        echo -n "."
    done
    echo ""
fi

# Check if frontend is already running
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo "${YELLOW}⚠️  Frontend already running on port 3000${NC}"
else
    echo "${BLUE}Starting Frontend Server...${NC}"
    cd /Users/esosaimafidon/Documents/GitHub/anatomie-lab/frontend
    npm start > ../logs/frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo "${GREEN}✅ Frontend started (PID: $FRONTEND_PID)${NC}"
    echo "   Logs: logs/frontend.log"
    echo "   URL: http://localhost:3000"
    echo ""
fi

echo "======================================"
echo "${GREEN}🎉 Both Servers Running!${NC}"
echo "======================================"
echo ""
echo "📍 Backend:  http://localhost:3001"
echo "📍 Frontend: http://localhost:3000"
echo ""
echo "📊 Health Check:"
curl -s http://localhost:3001/health | jq -r '.status' 2>/dev/null || echo "Waiting..."
echo ""
echo "🔧 To stop servers: ./stop-all-servers.sh"
echo "📝 View logs: tail -f logs/backend.log logs/frontend.log"
echo ""
echo "${YELLOW}Opening browser...${NC}"

# Wait a moment then open browser
sleep 3
open http://localhost:3000 2>/dev/null || echo "Please open http://localhost:3000 in your browser"

echo ""
echo "${GREEN}Ready to test! 🚀${NC}"

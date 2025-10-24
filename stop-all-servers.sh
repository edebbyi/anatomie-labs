#!/bin/bash

# Stop all running servers (backend and frontend)
set +e  # Don't exit on error

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "======================================"
echo "🛑 Stopping All Servers"
echo "======================================"
echo ""

# Stop backend (port 3001)
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null ; then
    echo "${YELLOW}Stopping Backend (port 3001)...${NC}"
    lsof -ti:3001 | xargs kill -9 2>/dev/null
    echo "${GREEN}✅ Backend stopped${NC}"
else
    echo "${YELLOW}⚠️  Backend not running${NC}"
fi

# Stop frontend (port 3000)
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo "${YELLOW}Stopping Frontend (port 3000)...${NC}"
    lsof -ti:3000 | xargs kill -9 2>/dev/null
    echo "${GREEN}✅ Frontend stopped${NC}"
else
    echo "${YELLOW}⚠️  Frontend not running${NC}"
fi

# Stop any node processes with 'server.js' or 'react-scripts'
echo ""
echo "${YELLOW}Cleaning up any remaining Node processes...${NC}"
pkill -f "node.*server.js" 2>/dev/null && echo "${GREEN}✅ Backend processes cleaned${NC}" || true
pkill -f "react-scripts start" 2>/dev/null && echo "${GREEN}✅ Frontend processes cleaned${NC}" || true

echo ""
echo "======================================"
echo "${GREEN}🎉 All Servers Stopped${NC}"
echo "======================================"

#!/bin/bash

echo "🛑 Stopping all existing processes..."
pkill -f "node server.js" 2>/dev/null
pkill -f nodemon 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null
sleep 2

echo "🔧 Starting backend on port 3001..."
cd /Users/esosaimafidon/Documents/GitHub/anatomie-lab
npm run dev > backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend started with PID: $BACKEND_PID"

sleep 5

echo "🎨 Starting frontend on port 3000..."
cd /Users/esosaimafidon/Documents/GitHub/anatomie-lab/frontend
BROWSER=none npm start > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend started with PID: $FRONTEND_PID"

echo ""
echo "✅ Services started!"
echo "📊 Backend: http://localhost:3001"
echo "🎨 Frontend: http://localhost:3000"
echo ""
echo "📝 Logs:"
echo "  Backend: tail -f backend.log"
echo "  Frontend: tail -f frontend.log"
echo ""
echo "⚠️  IMPORTANT: In your browser, do a HARD REFRESH:"
echo "   - Chrome/Edge: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)"
echo "   - Firefox: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)"
echo "   - Safari: Cmd+Option+R"
echo ""
echo "This will clear the cached old code and load the new fixes!"

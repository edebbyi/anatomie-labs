#!/bin/bash

# Stop all servers

echo "🛑 Stopping servers..."

# Kill backend
if [ -f backend.pid ]; then
    BACKEND_PID=$(cat backend.pid)
    if kill -0 $BACKEND_PID 2>/dev/null; then
        kill $BACKEND_PID
        echo "✅ Backend stopped (PID: $BACKEND_PID)"
    fi
    rm backend.pid
fi

# Kill frontend
pkill -f "react-scripts start"
pkill -f "webpack-dev-server"

# Kill any node processes on ports 3000 and 3001
lsof -ti:3001 | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null

echo "✅ All servers stopped"

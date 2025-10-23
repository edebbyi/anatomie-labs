#!/bin/bash

# Test Backend and Frontend Startup Script

echo "🚀 Starting Podna System Test"
echo "=============================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "Please copy .env.podna.example to .env and configure it"
    exit 1
fi

echo "✅ .env file found"

# Check if Gemini API key is configured
if grep -q "GEMINI_API_KEY=your_gemini_api_key_here" .env; then
    echo "⚠️  Warning: GEMINI_API_KEY not configured"
    echo "   Some features will use mock data"
    echo "   Get your key from: https://ai.google.dev/"
    echo ""
fi

# Check database connection
echo "📊 Checking database connection..."
psql $DATABASE_URL -c "SELECT 1" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Database connected"
else
    echo "❌ Database connection failed"
    echo "   Make sure PostgreSQL is running"
    exit 1
fi

# Check Redis connection
echo "🔴 Checking Redis connection..."
redis-cli ping > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Redis connected"
else
    echo "⚠️  Redis not running (optional)"
fi

echo ""
echo "=============================="
echo "🎯 Starting Backend Server"
echo "=============================="
echo ""
echo "Backend will run on: http://localhost:3001"
echo "Frontend will run on: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Start backend in background
npm run dev > backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > backend.pid

# Wait for backend to start
echo "⏳ Waiting for backend to start..."
sleep 5

# Check if backend is running
if kill -0 $BACKEND_PID 2>/dev/null; then
    echo "✅ Backend started (PID: $BACKEND_PID)"
    
    # Test backend health
    curl -s http://localhost:3001/health > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ Backend health check passed"
    else
        echo "⚠️  Backend health check failed (still starting...)"
    fi
else
    echo "❌ Backend failed to start"
    echo "Check backend.log for errors"
    exit 1
fi

echo ""
echo "=============================="
echo "🎨 Starting Frontend Server"
echo "=============================="
echo ""

# Start frontend in background
cd frontend
npm run start > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo "⏳ Waiting for frontend to start..."
sleep 5

if kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "✅ Frontend started (PID: $FRONTEND_PID)"
else
    echo "⚠️  Frontend may still be starting..."
fi

echo ""
echo "=============================="
echo "✅ System is running!"
echo "=============================="
echo ""
echo "📍 URLs:"
echo "   Backend:  http://localhost:3001"
echo "   Frontend: http://localhost:3000"
echo "   Health:   http://localhost:3001/health"
echo ""
echo "📝 Logs:"
echo "   Backend:  tail -f backend.log"
echo "   Frontend: tail -f frontend.log"
echo ""
echo "🛑 To stop:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo "   or run: ./stop-servers.sh"
echo ""
echo "🧪 To test:"
echo "   Open http://localhost:3000 in your browser"
echo "   Or run: node tests/test-podna-system.js"
echo ""

# Keep script running
wait

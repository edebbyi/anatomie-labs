#!/bin/bash

# Enhanced development start script that ensures clean start with better error handling

set -e  # Exit on any error

echo "🚀 Starting Designer BFF development server..."

# Function to check if a port is in use
is_port_in_use() {
    lsof -ti:$1 >/dev/null 2>&1
}

# Function to kill processes on a specific port with better error handling
kill_port_processes() {
    local PORT=$1
    echo "🔍 Checking for processes using port $PORT..."
    
    if ! is_port_in_use $PORT; then
        echo "✅ No processes found using port $PORT"
        return 0
    fi
    
    # Get PIDs using different methods for better compatibility
    PIDS=$(lsof -ti:$PORT 2>/dev/null || netstat -anv | grep "[.:]$PORT" | awk '{print $2}' | head -n 1)
    
    if [ -z "$PIDS" ]; then
        echo "✅ No processes found using port $PORT"
        return 0
    fi
    
    echo "⚠️  Found processes using port $PORT: $PIDS"
    
    # Try graceful termination first
    for PID in $PIDS; do
        if kill -0 $PID 2>/dev/null; then
            echo "🔄 Attempting graceful termination of process $PID..."
            kill -TERM $PID 2>/dev/null
            
            # Wait a moment for graceful shutdown
            sleep 2
            
            # Force kill if still running
            if kill -0 $PID 2>/dev/null; then
                echo "💥 Force killing process $PID..."
                kill -9 $PID 2>/dev/null
            fi
            
            # Verify process is killed
            if kill -0 $PID 2>/dev/null; then
                echo "❌ Failed to kill process $PID"
                return 1
            else
                echo "✅ Successfully killed process $PID"
            fi
        else
            echo "⚠️  Process $PID not found or already terminated"
        fi
    done
    
    # Double check the port is free
    sleep 1
    if is_port_in_use $PORT; then
        echo "❌ Port $PORT is still in use after killing processes"
        return 1
    fi
    
    echo "✅ Port $PORT is now free"
    return 0
}

# Kill any processes using common ports with better error handling
echo "🧹 Cleaning up common development ports..."
if ! kill_port_processes 3001; then
    echo "❌ Failed to free port 3001"
    exit 1
fi

# Try to free port 5000 but don't fail completely if we can't
if ! kill_port_processes 5000; then
    echo "⚠️  Warning: Could not free port 5000, continuing anyway..."
fi

# Additional check to ensure ports are free
echo "🔍 Final port check..."
sleep 2

if is_port_in_use 3001; then
    echo "❌ Port 3001 is still in use. Please manually check what's running on this port."
    exit 1
fi

# Set environment variables
export PORT=${PORT:-3001}
export NODE_ENV=development

echo "🔧 Environment:"
echo "   PORT: $PORT"
echo "   NODE_ENV: $NODE_ENV"

# Start the development server
echo "🚀 Starting development server on port $PORT..."

# Function to check if server is responding
curl_health_check() {
    curl -s --connect-timeout 5 http://localhost:$PORT/health >/dev/null 2>&1
}

# Start server in background
npm run dev &
SERVER_PID=$!

# Wait for server to start (max 30 seconds)
echo "⏳ Waiting for server to start..."
for i in {1..30}; do
    if curl_health_check; then
        echo "✅ Server is running on port $PORT"
        wait $SERVER_PID
        exit 0
    fi
    echo "⏳ Waiting... ($i/30)"
    sleep 1
done

echo "⚠️  Server may still be starting. Check logs for details."
echo "📝 Server logs are in server.log"
wait $SERVER_PID
#!/bin/bash

# Script to test if the server is running properly

echo "🔍 Testing server health..."

# Check if server is running on port 3001
if lsof -ti:3001 >/dev/null 2>&1; then
    echo "✅ Server process found on port 3001"
else
    echo "❌ No server process found on port 3001"
    exit 1
fi

# Test health endpoint
echo "🏥 Checking health endpoint..."
HEALTH_RESPONSE=$(curl -s --connect-timeout 10 http://localhost:3001/health)

if [ -z "$HEALTH_RESPONSE" ]; then
    echo "❌ Health endpoint not responding"
    exit 1
else
    echo "✅ Health endpoint responding"
    echo "📊 Server status: $(echo $HEALTH_RESPONSE | grep -o '\"status\":\"[^\"]*' | cut -d':' -f2 | tr -d '\"')"
fi

echo "🎉 Server test completed successfully!"
#!/bin/bash

# Script to kill processes using a specific port
PORT=${1:-3001}

echo "Checking for processes using port $PORT..."

# Find processes using the port
PIDS=$(lsof -ti:$PORT)

if [ -z "$PIDS" ]; then
    echo "No processes found using port $PORT"
    exit 0
fi

echo "Found processes using port $PORT: $PIDS"

# Kill the processes
for PID in $PIDS; do
    echo "Killing process $PID..."
    kill -9 $PID
    if [ $? -eq 0 ]; then
        echo "Successfully killed process $PID"
    else
        echo "Failed to kill process $PID"
    fi
done

echo "Finished killing processes using port $PORT"
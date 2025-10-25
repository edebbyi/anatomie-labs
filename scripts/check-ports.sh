#!/bin/bash

# Script to check what processes are using common development ports

echo "🔍 Checking common development ports..."

PORTS=("3001" "5000" "3000" "8080")

for PORT in "${PORTS[@]}"; do
    echo "----- Port $PORT -----"
    if lsof -ti:$PORT >/dev/null 2>&1; then
        PIDS=$(lsof -ti:$PORT)
        echo "Processes: $PIDS"
        for PID in $PIDS; do
            echo "Details for PID $PID:"
            ps -p $PID -o pid,ppid,cmd 2>/dev/null || echo "Could not get process details"
        done
    else
        echo "No processes found"
    fi
    echo ""
done
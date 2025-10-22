#!/bin/bash
echo "Stopping any running servers..."
pkill -f "react-scripts" 2>/dev/null
pkill -f "webpack" 2>/dev/null
sleep 1

echo "Clearing all caches..."
rm -rf node_modules/.cache
rm -rf build
rm -f .eslintcache
rm -f tsconfig.tsbuildinfo

echo "Starting fresh dev server..."
npm start

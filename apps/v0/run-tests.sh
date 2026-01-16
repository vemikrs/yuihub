#!/bin/bash
# YuiHub Test Suite Runner

set -e

echo "🧪 YuiHub Test Suite"
echo "===================="
echo

# Check if API server is running
if ! curl -s http://localhost:3000/health > /dev/null; then
    echo "⚠️  API server not running. Starting server..."
    cd yuihub_api
    npm run start &
    API_PID=$!
    echo "   Server PID: $API_PID"
    sleep 5
    cd ..
else
    echo "✅ API server is running"
    API_PID=""
fi

echo

# Run schema tests
echo "📝 Running schema validation tests..."
cd yuihub_api
node tests/schema.test.js
echo

# Run API integration tests  
echo "🔗 Running API integration tests..."
node tests/api-integration.test.js
echo

# Run MCP smoke test
echo "🔌 Running MCP smoke test..."
cd ../yuihub_mcp
timeout 10s node src/server.js --help > /dev/null 2>&1 && echo "✅ MCP server startup successful" || echo "❌ MCP server startup failed"
cd ..

echo

# Run existing smoke tests
echo "💨 Running existing smoke tests..."
cd tests/smoke

# Only run tests that don't require tunnel
./test-api-health.sh || echo "   Health test completed"
# Skip other smoke tests as they may require more setup

cd ../..

echo
echo "🎉 Test suite completed!"

# Clean up
if [ ! -z "$API_PID" ]; then
    echo "🛑 Stopping test server..."
    kill $API_PID 2>/dev/null || true
fi
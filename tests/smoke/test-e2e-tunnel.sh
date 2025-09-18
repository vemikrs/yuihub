#!/bin/bash
# YuiHub End-to-End Tunnel Test
# Tests complete tunnel lifecycle with real deployment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🎯 YuiHub End-to-End Tunnel Test"
echo "================================"
echo ""

cd "$PROJECT_ROOT"

# Stop any existing processes
echo "🛑 Cleaning up existing processes..."
pkill -f "cloudflared.*tunnel" 2>/dev/null || true
pkill -f "node.*server" 2>/dev/null || true
sleep 2

# Test 1: Start API server with tunnel integration
echo "1. 🚀 Starting integrated API server with tunnel..."
echo ""

# Start in background and capture output
ENABLE_TUNNEL=true npm run dev:api > /tmp/yuihub-e2e.log 2>&1 &
SERVER_PID=$!

# Wait for server and tunnel to be ready
echo "⏳ Waiting for server and tunnel initialization..."
sleep 15

# Check if server started successfully
if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "❌ Server failed to start"
    cat /tmp/yuihub-e2e.log
    exit 1
fi

# Extract tunnel URL from logs
TUNNEL_URL=$(grep -o "Cloudflare Tunnel: https://[^[:space:]]*" /tmp/yuihub-e2e.log | cut -d' ' -f3 | head -1)

if [ -z "$TUNNEL_URL" ]; then
    echo "❌ No tunnel URL found in logs"
    echo "Server logs:"
    cat /tmp/yuihub-e2e.log
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi

echo "✅ Tunnel URL obtained: $TUNNEL_URL"
echo ""

# Test 2: Verify all endpoints through tunnel
echo "2. 🧪 Testing all endpoints through tunnel..."

# Health check
echo -n "   Health endpoint: "
if timeout 10s curl -s "$TUNNEL_URL/health" | jq -e '.ok == true' > /dev/null 2>&1; then
    echo "✅"
else
    echo "❌"
    ERRORS=$((ERRORS + 1))
fi

# OpenAPI schema
echo -n "   OpenAPI endpoint: "
if timeout 10s curl -s "$TUNNEL_URL/openapi.yml" | grep -q "openapi: 3.0"; then
    echo "✅"
else
    echo "❌"
    ERRORS=$((ERRORS + 1))
fi

# Search endpoint
echo -n "   Search endpoint: "
if timeout 10s curl -s "$TUNNEL_URL/search?q=test" | jq -e '.hits' > /dev/null 2>&1; then
    echo "✅"
else
    echo "❌"
    ERRORS=$((ERRORS + 1))
fi

# Recent endpoint
echo -n "   Recent endpoint: "
if timeout 10s curl -s "$TUNNEL_URL/recent?n=2" | jq -e '.items' > /dev/null 2>&1; then
    echo "✅"
else
    echo "❌"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# Test 3: URL accuracy verification
echo "3. 🔗 Verifying URL accuracy (hyphen preservation)..."
if echo "$TUNNEL_URL" | grep -q -- "-"; then
    echo "   ✅ URL contains hyphens (properly preserved)"
else
    echo "   ⚠️  URL contains no hyphens (may be valid but check extraction logic)"
fi

# Test 4: Graceful shutdown test
echo "4. 🛑 Testing graceful shutdown..."
echo -n "   Sending SIGTERM to server: "

kill -TERM $SERVER_PID 2>/dev/null || true
sleep 5

if kill -0 $SERVER_PID 2>/dev/null; then
    echo "❌ Server did not shut down gracefully"
    kill -KILL $SERVER_PID 2>/dev/null || true
    ERRORS=$((ERRORS + 1))
else
    echo "✅ Server shut down gracefully"
fi

# Cleanup
rm -f /tmp/yuihub-e2e.log

echo ""
if [ ${ERRORS:-0} -eq 0 ]; then
    echo "🎉 End-to-End Tunnel Test: ALL PASSED"
else
    echo "❌ End-to-End Tunnel Test: $ERRORS errors found"
    exit 1
fi
echo ""
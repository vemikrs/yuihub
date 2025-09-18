#!/bin/bash
# Get current tunnel URL helper script

if [ -f .cloudflare/.tunnel-url ]; then
    echo "🌐 Current Tunnel URL:"
    cat .cloudflare/.tunnel-url
    echo ""
    echo "📋 OpenAPI Schema:"
    echo "$(cat .cloudflare/.tunnel-url)/openapi.yml"
else
    echo "❌ No active tunnel found. Start tunnel first."
fi
#!/bin/bash
# YuiHub Cloudflare Tunnel - Unified Quick Mode Script
# Provides dynamic URL generation for development use

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TUNNEL_URL_FILE="$SCRIPT_DIR/.tunnel-url"
HEALTH_CHECK_URL=""
API_PORT="3000"

echo "🚀 Starting YuiHub Cloudflare Tunnel (Quick Mode)"
echo "==============================================="
echo ""

# Pre-flight check: API server status
echo "🔍 Checking local API server..."
if ! curl -s "http://localhost:$API_PORT/health" > /dev/null 2>&1; then
    echo "⚠️  WARNING: YuiHub API server not responding on port $API_PORT"
    echo "💡 Start the API server first: npm run start:api"
    echo ""
    echo "🔄 Continuing with tunnel setup anyway..."
    echo ""
fi

# Clean up previous tunnel URL file
rm -f "$TUNNEL_URL_FILE"

echo "📡 Connecting to localhost:$API_PORT..."
echo "⏳ Please wait for the tunnel URL to appear..."
echo ""

# Start cloudflared tunnel in quick mode
cloudflared tunnel --url "http://localhost:$API_PORT" 2>&1 | while IFS= read -r line; do
    echo "$line"
    
    # Extract tunnel URL from cloudflared output
    if [[ $line == *"trycloudflare.com"* ]]; then
        URL=$(echo "$line" | grep -o 'https://[^[:space:]]*\.trycloudflare\.com')
        if [[ -n "$URL" ]]; then
            # Save URL to file for other scripts
            echo "$URL" > "$TUNNEL_URL_FILE"
            chmod 600 "$TUNNEL_URL_FILE"  # Secure file permissions
            
            HEALTH_CHECK_URL="$URL/health"
            
            echo ""
            echo "🎉 Tunnel established successfully!"
            echo "=================================="
            echo ""
            echo "📡 Your YuiHub API is accessible at:"
            echo "   🌐 Base URL:      $URL"
            echo "   💚 Health Check:  $HEALTH_CHECK_URL"
            echo "   📋 OpenAPI:       $URL/openapi.yml"
            echo "   🔍 Search:        $URL/search?q=example"
            echo "   📄 Recent:        $URL/recent?n=5"
            echo ""
            echo "🔗 For ChatGPT Custom Actions:"
            echo "   Base URL: $URL"
            echo "   Schema:   $URL/openapi.yml"
            echo ""
            
            # Verify API accessibility through tunnel
            echo "🧪 Testing tunnel connectivity..."
            sleep 2  # Wait for tunnel to stabilize
            if curl -s "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
                echo "✅ Tunnel connectivity verified"
            else
                echo "⚠️  Tunnel may not be fully ready yet"
            fi
            echo ""
            echo "📝 Tunnel URL saved to: $TUNNEL_URL_FILE"
            echo ""
        fi
    fi
    
    # Handle common errors
    if [[ $line == *"failed to connect"* ]]; then
        echo ""
        echo "❌ Failed to establish tunnel connection"
        echo "💡 Check your internet connection and try again"
        echo ""
    fi
    
    if [[ $line == *"cloudflared: command not found"* ]]; then
        echo ""
        echo "❌ cloudflared not installed"
        echo "💡 Install with: curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb && sudo dpkg -i cloudflared.deb"
        echo ""
    fi
done
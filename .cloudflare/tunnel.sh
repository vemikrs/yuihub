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

# Start cloudflared tunnel in quick mode with improved URL extraction
echo "🔧 Debug: Starting cloudflared with enhanced logging..."
timeout 30s cloudflared tunnel --url "http://localhost:$API_PORT" 2>&1 | while IFS= read -r line; do
    echo "$line"
    
    # Enhanced URL extraction - multiple patterns to catch different formats
    if [[ $line == *"trycloudflare.com"* ]]; then
        # Pattern 1: Standard output format
        URL=$(echo "$line" | grep -oP 'https://[a-zA-Z0-9\-]+\.trycloudflare\.com' | head -1)
        
        # Pattern 2: Alternative format with additional context
        if [[ -z "$URL" ]]; then
            URL=$(echo "$line" | grep -oE 'https://[^[:space:]]+trycloudflare\.com[^[:space:]]*' | head -1)
        fi
        
        if [[ -n "$URL" ]]; then
            # Clean URL (remove any trailing characters)
            URL=$(echo "$URL" | sed 's/[[:space:]]*$//' | sed 's/[^[:alnum:]\-\.\/\:]//g')
            
            echo "🔧 Debug: Extracted URL: '$URL'"
            
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
            sleep 3  # Wait longer for tunnel to stabilize
            
            # Test with multiple attempts
            success=0
            for i in {1..3}; do
                echo "   Attempt $i/3..."
                if timeout 10s curl -s "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
                    echo "✅ Tunnel connectivity verified"
                    success=1
                    break
                else
                    echo "   ⏳ Waiting for tunnel to stabilize..."
                    sleep 2
                fi
            done
            
            if [[ $success -eq 0 ]]; then
                echo "⚠️  Tunnel may not be fully ready, but URL is available"
            fi
            
            echo ""
            echo "📝 Tunnel URL saved to: $TUNNEL_URL_FILE"
            echo ""
            echo "💡 To stop tunnel: pkill -f 'cloudflared.*tunnel'"
            echo ""
        fi
    fi
    
    # Enhanced error handling
    if [[ $line == *"failed to connect"* || $line == *"connection refused"* ]]; then
        echo ""
        echo "❌ Failed to establish tunnel connection"
        echo "💡 Troubleshooting:"
        echo "   - Check internet connection"
        echo "   - Verify API server is running on port $API_PORT"
        echo "   - Try restarting the tunnel"
        echo ""
        exit 1
    fi
    
    if [[ $line == *"command not found"* ]]; then
        echo ""
        echo "❌ cloudflared not installed"
        echo "💡 Install with:"
        echo "   curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb"
        echo "   sudo dpkg -i cloudflared.deb"
        echo ""
        exit 1
    fi
    
    # Handle timeout
    if [[ $line == *"timeout"* ]]; then
        echo ""
        echo "⏰ Tunnel establishment timed out"
        echo "💡 This may happen if:"
        echo "   - Network connectivity is slow"
        echo "   - Cloudflare service is temporarily unavailable"
        echo "   - Local firewall is blocking connections"
        echo ""
    fi
done

# Handle script timeout
if [[ $? -eq 124 ]]; then
    echo ""
    echo "⏰ Tunnel startup timed out after 30 seconds"
    echo "💡 Try running the command again or check your internet connection"
    echo ""
    exit 1
fi
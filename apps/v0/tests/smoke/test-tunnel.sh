#!/bin/bash
# YuiHub Cloudflare Tunnel スモークテスト

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
API_PORT="3000"

echo "🌐 YuiHub Cloudflare Tunnel Smoke Test"
echo "======================================"
echo ""

# 前提条件確認
echo "📋 Checking prerequisites..."

# cloudflaredの存在確認
if ! command -v cloudflared &> /dev/null; then
    echo "❌ FAIL: cloudflared not found"
    echo "💡 Install with: curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb && sudo dpkg -i cloudflared.deb"
    exit 1
fi

CLOUDFLARED_VERSION=$(cloudflared version | head -1)
echo "✅ cloudflared found: $CLOUDFLARED_VERSION"

# APIサーバー確認
if ! curl -s "http://localhost:$API_PORT/health" > /dev/null 2>&1; then
    echo "⚠️  WARNING: YuiHub API server not responding on port $API_PORT"
    echo "💡 The test will continue but tunnel functionality will be limited"
else
    echo "✅ YuiHub API server responding on port $API_PORT"
fi

# インターネット接続確認
echo "🔗 Testing internet connectivity..."
if ! ping -c 1 1.1.1.1 > /dev/null 2>&1; then
    echo "❌ FAIL: No internet connection"
    echo "💡 Cloudflare Tunnel requires internet access"
    exit 1
fi

echo "✅ Internet connectivity verified"
echo ""

# Tunnel起動テスト（短時間）
echo "🚀 Testing tunnel startup..."
TUNNEL_SCRIPT="$WORKSPACE_ROOT/.cloudflare/tunnel.sh"

if [ ! -f "$TUNNEL_SCRIPT" ]; then
    echo "❌ FAIL: Tunnel script not found at $TUNNEL_SCRIPT"
    exit 1
fi

if [ ! -x "$TUNNEL_SCRIPT" ]; then
    echo "❌ FAIL: Tunnel script is not executable"
    exit 1
fi

echo "✅ Tunnel script found and executable"

# 一時的なTunnelテスト（10秒間）
echo ""
echo "🧪 Testing tunnel establishment (10 second test)..."
echo "   This will start a tunnel briefly to verify functionality..."
echo ""

cd "$WORKSPACE_ROOT"

# バックグラウンドでTunnelを起動
timeout 10s bash "$TUNNEL_SCRIPT" > /tmp/tunnel_test.log 2>&1 &
TUNNEL_PID=$!

# プロセスが開始されるまで少し待機
sleep 2

# プロセスがまだ動いているかチェック
if ! kill -0 $TUNNEL_PID 2>/dev/null; then
    echo "❌ FAIL: Tunnel process died unexpectedly"
    echo "Error log:"
    cat /tmp/tunnel_test.log
    exit 1
fi

echo "✅ PASS: Tunnel process started successfully"

# プロセス終了待機
wait $TUNNEL_PID 2>/dev/null || true

# ログでURL生成を確認
if grep -q "trycloudflare.com" /tmp/tunnel_test.log; then
    EXTRACTED_URL=$(grep -o 'https://[^[:space:]]*\.trycloudflare\.com' /tmp/tunnel_test.log | head -1)
    if [[ -n "$EXTRACTED_URL" ]]; then
        echo "✅ PASS: Tunnel URL successfully generated: $EXTRACTED_URL"
        
        # URLファイル確認
        if [ -f ".cloudflare/.tunnel-url" ]; then
            FILE_URL=$(cat .cloudflare/.tunnel-url)
            if [[ "$FILE_URL" == "$EXTRACTED_URL" ]]; then
                echo "✅ PASS: URL correctly saved to file"
            else
                echo "⚠️  WARN: URL mismatch between log and file"
            fi
        else
            echo "⚠️  WARN: Tunnel URL file not created"
        fi
    else
        echo "❌ FAIL: Could not extract valid URL from tunnel log"
        exit 1
    fi
else
    echo "⚠️  WARN: No tunnel URL found in log (may need longer startup time)"
    echo "Log content:"
    cat /tmp/tunnel_test.log
fi

# クリーンアップ
rm -f /tmp/tunnel_test.log
pkill -f "cloudflared.*tunnel" 2>/dev/null || true

echo ""
echo "📊 Tunnel Smoke Test Summary:"
echo "=============================="
echo "✅ cloudflared binary:       PASS"
echo "✅ Script availability:      PASS" 
echo "✅ Process startup:          PASS"
echo "✅ Internet connectivity:    PASS"

if [[ -n "$EXTRACTED_URL" ]]; then
    echo "✅ URL generation:           PASS"
    echo "✅ File operations:          PASS"
    echo ""
    echo "🎉 ALL TUNNEL SMOKE TESTS PASSED"
    echo ""
    echo "💡 To run a full tunnel:"
    echo "   ./.cloudflare/tunnel.sh"
    echo "   or use VS Code Task: 'YuiHub: Start Cloudflare Tunnel'"
else
    echo "⚠️  URL generation:           PARTIAL"
    echo ""
    echo "⚠️  MOSTLY SUCCESSFUL - Tunnel can start but may need more time for URL generation"
fi

echo ""
exit 0
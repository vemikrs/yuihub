#!/bin/bash
# YuiHub API 検索機能 スモークテスト

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_BASE="http://localhost:3000"

echo "🔍 YuiHub API Search Test"
echo "========================="
echo

# 基本検索テスト
echo "📡 Testing search endpoint with basic query..."
RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" "$API_BASE/search?q=TypeScript")
HTTP_STATUS=$(echo $RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
RESPONSE_BODY=$(echo $RESPONSE | sed -e 's/HTTPSTATUS:.*//g')

if [ "$HTTP_STATUS" -ne 200 ]; then
    echo "❌ FAIL: Search endpoint returned HTTP $HTTP_STATUS"
    exit 1
fi

# JSONレスポンスの検証
echo "$RESPONSE_BODY" | python3 -m json.tool > /dev/null
if [ $? -ne 0 ]; then
    echo "❌ FAIL: Invalid JSON response"
    exit 1
fi

# レスポンス構造の検証
HITS_FIELD=$(echo "$RESPONSE_BODY" | python3 -c "import json, sys; data=json.load(sys.stdin); print('true' if 'hits' in data else 'false')")
if [ "$HITS_FIELD" != "true" ]; then
    echo "❌ FAIL: 'hits' field is missing"
    exit 1
fi

# ヒット数の確認
HIT_COUNT=$(echo "$RESPONSE_BODY" | python3 -c "import json, sys; data=json.load(sys.stdin); print(len(data.get('hits', [])))")
echo "✅ PASS: Basic search successful"
echo "   Status: HTTP $HTTP_STATUS"
echo "   Hit Count: $HIT_COUNT"

# 日本語検索テスト
echo
echo "📡 Testing search with Japanese query..."
JAPANESE_QUERY=$(python3 -c "import urllib.parse; print(urllib.parse.quote('テスト'))")
RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" "$API_BASE/search?q=$JAPANESE_QUERY")
HTTP_STATUS=$(echo $RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')

if [ "$HTTP_STATUS" -ne 200 ]; then
    echo "❌ FAIL: Japanese search returned HTTP $HTTP_STATUS"
    exit 1
fi

echo "✅ PASS: Japanese search successful"
echo "   Status: HTTP $HTTP_STATUS"

# 空のクエリテスト
echo
echo "📡 Testing search with empty query..."
RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" "$API_BASE/search?q=")
HTTP_STATUS=$(echo $RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')

# 空クエリは400または200のどちらでも許容
if [ "$HTTP_STATUS" -ne 200 ] && [ "$HTTP_STATUS" -ne 400 ]; then
    echo "❌ FAIL: Empty search returned unexpected HTTP $HTTP_STATUS"
    exit 1
fi

echo "✅ PASS: Empty query handling correct"
echo "   Status: HTTP $HTTP_STATUS"
echo

exit 0
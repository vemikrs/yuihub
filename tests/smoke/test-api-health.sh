#!/bin/bash
# YuiHub API ヘルスチェック スモークテスト

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_BASE="http://localhost:3000"

echo "🩺 YuiHub API Health Check Test"
echo "================================="
echo

# ヘルスチェックエンドポイントテスト
echo "📡 Testing health endpoint..."
RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" "$API_BASE/health")
HTTP_STATUS=$(echo $RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
RESPONSE_BODY=$(echo $RESPONSE | sed -e 's/HTTPSTATUS:.*//g')

if [ "$HTTP_STATUS" -ne 200 ]; then
    echo "❌ FAIL: Health endpoint returned HTTP $HTTP_STATUS"
    exit 1
fi

# JSONレスポンスの検証
echo "$RESPONSE_BODY" | python3 -m json.tool > /dev/null
if [ $? -ne 0 ]; then
    echo "❌ FAIL: Invalid JSON response"
    exit 1
fi

# 必須フィールドの検証
OK_FIELD=$(echo "$RESPONSE_BODY" | python3 -c "import json, sys; data=json.load(sys.stdin); print('true' if data.get('ok') == True else 'false')")
if [ "$OK_FIELD" != "true" ]; then
    echo "❌ FAIL: 'ok' field is not true"
    exit 1
fi

STORAGE_FIELD=$(echo "$RESPONSE_BODY" | python3 -c "import json, sys; data=json.load(sys.stdin); print(data.get('storage', ''))")
if [ -z "$STORAGE_FIELD" ]; then
    echo "❌ FAIL: 'storage' field is missing"
    exit 1
fi

SEARCH_INDEX_FIELD=$(echo "$RESPONSE_BODY" | python3 -c "import json, sys; data=json.load(sys.stdin); print(data.get('searchIndex', ''))")
# Accept either "loaded" or "missing" as valid states for CI
if [ "$SEARCH_INDEX_FIELD" != "loaded" ] && [ "$SEARCH_INDEX_FIELD" != "missing" ]; then
    echo "❌ FAIL: 'searchIndex' field has unexpected value: $SEARCH_INDEX_FIELD"
    exit 1
fi

echo "✅ PASS: Health check successful"
echo "   Status: HTTP $HTTP_STATUS"
echo "   Storage: $STORAGE_FIELD"
echo "   Search Index: $SEARCH_INDEX_FIELD"
echo

exit 0
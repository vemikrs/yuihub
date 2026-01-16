#!/bin/bash
# YuiHub API ノート保存 スモークテスト

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_BASE="http://localhost:3000"

echo "💾 YuiHub API Save Note Test"
echo "============================"
echo

# テスト用の一意なトピック生成
TIMESTAMP=$(date +%s)
TEST_TOPIC="スモークテスト_$TIMESTAMP"

# JSONペイロードの準備 (YuiFlow InputMessage format)
TEST_PAYLOAD=$(cat << EOF
{
  "source": "gpts",
  "thread": "th-01234567890123456789012345",
  "author": "smoke-test-user",
  "text": "## スモークテスト実行\n\nこれは自動化されたスモークテストです。\n\n### 実行情報\n- タイムスタンプ: $TIMESTAMP\n- テスト対象: ノート保存機能\n- 期待結果: 正常保存とID生成",
  "tags": ["smoke-test", "automated", "ci"]
}
EOF
)

echo "📡 Testing save endpoint..."
RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$TEST_PAYLOAD" \
    "$API_BASE/save")

HTTP_STATUS=$(echo $RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
RESPONSE_BODY=$(echo $RESPONSE | sed -e 's/HTTPSTATUS:.*//g')

if [ "$HTTP_STATUS" -ne 200 ]; then
    echo "❌ FAIL: Save endpoint returned HTTP $HTTP_STATUS"
    echo "Response: $RESPONSE_BODY"
    exit 1
fi

# JSONレスポンスの検証
echo "$RESPONSE_BODY" | python3 -m json.tool > /dev/null
if [ $? -ne 0 ]; then
    echo "❌ FAIL: Invalid JSON response"
    echo "Response: $RESPONSE_BODY"
    exit 1
fi

# 保存成功の検証
OK_FIELD=$(echo "$RESPONSE_BODY" | python3 -c "import json, sys; data=json.load(sys.stdin); print('true' if data.get('ok') == True else 'false')")
if [ "$OK_FIELD" != "true" ]; then
    echo "❌ FAIL: 'ok' field is not true"
    echo "Response: $RESPONSE_BODY"
    exit 1
fi

# YuiFlow format: Check for data.id and data.thread fields
SAVED_ID=$(echo "$RESPONSE_BODY" | python3 -c "import json, sys; data=json.load(sys.stdin); print(data.get('data', {}).get('id', ''))" 2>/dev/null || echo "")
SAVED_THREAD=$(echo "$RESPONSE_BODY" | python3 -c "import json, sys; data=json.load(sys.stdin); print(data.get('data', {}).get('thread', ''))" 2>/dev/null || echo "")

if [ -z "$SAVED_ID" ]; then
    echo "❌ FAIL: 'data.id' field is missing"
    echo "Response: $RESPONSE_BODY"
    exit 1
fi

if [ -z "$SAVED_THREAD" ]; then
    echo "❌ FAIL: 'data.thread' field is missing" 
    echo "Response: $RESPONSE_BODY"
    exit 1
fi

echo "✅ PASS: Note save successful"
echo "   Status: HTTP $HTTP_STATUS"
echo "   Saved Path: $SAVED_PATH"
echo "✅ PASS: Note save successful"
echo "   Status: HTTP $HTTP_STATUS"
echo "   ID: $SAVED_ID"
echo "   Thread: $SAVED_THREAD"

# Note: File system persistence test disabled for YuiFlow format
# The new format doesn't return file paths directly
echo
echo "📡 Testing search after save (may need index rebuild)..."
sleep 1  # 少し待機

# Use a more generic search term
SEARCH_RESPONSE=$(curl -s "$API_BASE/search?q=smoke-test")
SEARCH_HITS=$(echo "$SEARCH_RESPONSE" | python3 -c "import json, sys; data=json.load(sys.stdin); print(len(data.get('hits', [])))" 2>/dev/null || echo "0")

if [ "$SEARCH_HITS" -gt 0 ]; then
    echo "✅ PASS: Saved note found in search (immediate indexing)"
else
    echo "⚠️  WARN: Saved note not found in search (may require manual index rebuild)"
fi

echo

exit 0
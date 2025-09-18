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

# JSONペイロードの準備
TEST_PAYLOAD=$(cat << EOF
{
  "frontmatter": {
    "topic": "$TEST_TOPIC",
    "actors": ["copilot", "test"],
    "tags": ["smoke-test", "automated"],
    "decision": "採用"
  },
  "body": "## スモークテスト実行\n\nこれは自動化されたスモークテストです。\n\n### 実行情報\n- タイムスタンプ: $TIMESTAMP\n- テスト対象: ノート保存機能\n- 期待結果: 正常保存とパス生成"
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

# パスとURLの検証
SAVED_PATH=$(echo "$RESPONSE_BODY" | python3 -c "import json, sys; data=json.load(sys.stdin); print(data.get('path', ''))")
SAVED_URL=$(echo "$RESPONSE_BODY" | python3 -c "import json, sys; data=json.load(sys.stdin); print(data.get('url', ''))")

if [ -z "$SAVED_PATH" ]; then
    echo "❌ FAIL: 'path' field is missing"
    exit 1
fi

if [ -z "$SAVED_URL" ]; then
    echo "❌ FAIL: 'url' field is missing"
    exit 1
fi

# URLの相対パス形式確認
if [[ "$SAVED_URL" != "file://./"* ]]; then
    echo "❌ FAIL: URL is not in relative path format"
    echo "Expected: file://./<path>, Got: $SAVED_URL"
    exit 1
fi

echo "✅ PASS: Note save successful"
echo "   Status: HTTP $HTTP_STATUS"
echo "   Saved Path: $SAVED_PATH"
echo "   URL Format: ✓ (relative path)"

# 保存されたファイルが実際に存在するか確認
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FULL_FILE_PATH="$WORKSPACE_ROOT/chatlogs/$SAVED_PATH"

echo
echo "📡 Testing file system persistence..."
if [ ! -f "$FULL_FILE_PATH" ]; then
    echo "❌ FAIL: Saved file does not exist at $FULL_FILE_PATH"
    exit 1
fi

# ファイル内容の基本検証
if ! grep -q "$TEST_TOPIC" "$FULL_FILE_PATH"; then
    echo "❌ FAIL: Saved file does not contain expected topic"
    exit 1
fi

if ! grep -q "smoke-test" "$FULL_FILE_PATH"; then
    echo "❌ FAIL: Saved file does not contain expected tag"
    exit 1
fi

echo "✅ PASS: File persistence verified"
echo "   File exists: ✓"
echo "   Content verification: ✓"

# 保存後の検索テスト
echo
echo "📡 Testing search after save (may need index rebuild)..."
sleep 1  # 少し待機
SEARCH_RESPONSE=$(curl -s "$API_BASE/search?q=$TEST_TOPIC")
SEARCH_HITS=$(echo "$SEARCH_RESPONSE" | python3 -c "import json, sys; data=json.load(sys.stdin); print(len(data.get('hits', [])))" 2>/dev/null || echo "0")

if [ "$SEARCH_HITS" -gt 0 ]; then
    echo "✅ PASS: Saved note found in search (immediate indexing)"
else
    echo "⚠️  WARN: Saved note not found in search (may require manual index rebuild)"
fi

echo

exit 0
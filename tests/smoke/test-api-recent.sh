#!/bin/bash
# YuiHub API 最近のノート取得 スモークテスト

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_BASE="http://localhost:3000"

echo "📋 YuiHub API Recent Notes Test"
echo "==============================="
echo

# 基本的な最近のノート取得
echo "📡 Testing recent endpoint with default limit..."
RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" "$API_BASE/recent")
HTTP_STATUS=$(echo $RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
RESPONSE_BODY=$(echo $RESPONSE | sed -e 's/HTTPSTATUS:.*//g')

if [ "$HTTP_STATUS" -ne 200 ]; then
    echo "❌ FAIL: Recent endpoint returned HTTP $HTTP_STATUS"
    exit 1
fi

# JSONレスポンスの検証
echo "$RESPONSE_BODY" | python3 -m json.tool > /dev/null
if [ $? -ne 0 ]; then
    echo "❌ FAIL: Invalid JSON response"
    exit 1
fi

# レスポンス構造の検証
ITEMS_FIELD=$(echo "$RESPONSE_BODY" | python3 -c "import json, sys; data=json.load(sys.stdin); print('true' if 'items' in data else 'false')")
if [ "$ITEMS_FIELD" != "true" ]; then
    echo "❌ FAIL: 'items' field is missing"
    exit 1
fi

ITEM_COUNT=$(echo "$RESPONSE_BODY" | python3 -c "import json, sys; data=json.load(sys.stdin); print(len(data.get('items', [])))")
echo "✅ PASS: Recent notes (default limit) successful"
echo "   Status: HTTP $HTTP_STATUS"
echo "   Item Count: $ITEM_COUNT"

# 制限数指定テスト
echo
echo "📡 Testing recent endpoint with custom limit..."
RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" "$API_BASE/recent?n=3")
HTTP_STATUS=$(echo $RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
RESPONSE_BODY=$(echo $RESPONSE | sed -e 's/HTTPSTATUS:.*//g')

if [ "$HTTP_STATUS" -ne 200 ]; then
    echo "❌ FAIL: Recent endpoint with limit returned HTTP $HTTP_STATUS"
    exit 1
fi

ITEM_COUNT=$(echo "$RESPONSE_BODY" | python3 -c "import json, sys; data=json.load(sys.stdin); print(len(data.get('items', [])))")
if [ "$ITEM_COUNT" -gt 3 ]; then
    echo "❌ FAIL: Limit parameter not respected (got $ITEM_COUNT items, expected <= 3)"
    exit 1
fi

echo "✅ PASS: Recent notes with limit successful"
echo "   Status: HTTP $HTTP_STATUS"
echo "   Item Count: $ITEM_COUNT"

# アイテム構造の検証（1つ以上のアイテムがある場合）
if [ "$ITEM_COUNT" -gt 0 ]; then
    echo
    echo "📡 Testing item structure..."
    
    # 必須フィールドの確認
    FIRST_ITEM_ID=$(echo "$RESPONSE_BODY" | python3 -c "import json, sys; data=json.load(sys.stdin); items=data.get('items', []); print(items[0].get('id', '') if items else '')")
    FIRST_ITEM_TITLE=$(echo "$RESPONSE_BODY" | python3 -c "import json, sys; data=json.load(sys.stdin); items=data.get('items', []); print(items[0].get('title', '') if items else '')")
    FIRST_ITEM_PATH=$(echo "$RESPONSE_BODY" | python3 -c "import json, sys; data=json.load(sys.stdin); items=data.get('items', []); print(items[0].get('path', '') if items else '')")
    
    if [ -z "$FIRST_ITEM_ID" ] || [ -z "$FIRST_ITEM_TITLE" ] || [ -z "$FIRST_ITEM_PATH" ]; then
        echo "❌ FAIL: Missing required fields in item structure"
        exit 1
    fi
    
    echo "✅ PASS: Item structure validation successful"
    echo "   Sample ID: $FIRST_ITEM_ID"
    echo "   Sample Title: $FIRST_ITEM_TITLE"
fi

echo

exit 0
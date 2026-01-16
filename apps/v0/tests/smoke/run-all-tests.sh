#!/bin/bash
# YuiHub 全スモークテスト実行スクリプト

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNED_TESTS=0

echo "🧪 YuiHub Smoke Test Suite"
echo "=========================="
echo "Starting comprehensive smoke tests..."
echo

# テスト実行関数
run_test() {
    local test_script=$1
    local test_name=$2
    
    echo "🚀 Running: $test_name"
    echo "   Script: $test_script"
    echo "   $(date '+%Y-%m-%d %H:%M:%S')"
    echo
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ ! -f "$SCRIPT_DIR/$test_script" ]; then
        echo "❌ FAIL: Test script not found: $test_script"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
    
    # テスト実行
    if bash "$SCRIPT_DIR/$test_script"; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo "✅ $test_name: COMPLETED SUCCESSFULLY"
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo "❌ $test_name: FAILED"
    fi
    
    echo
    echo "----------------------------------------"
    echo
}

# 実行可能権限の付与
chmod +x "$SCRIPT_DIR"/*.sh

# 個別テストの実行
echo "📋 Test Execution Plan:"
echo "1. API Health Check"
echo "2. API Search Functionality" 
echo "3. API Recent Notes"
echo "4. API Note Save"
echo "5. Data Flow Integration"
echo "6. MCP Server Connection"
echo "7. Cloudflare Tunnel"
echo
echo "🏁 Starting test execution..."
echo

# テスト1: APIヘルスチェック
run_test "test-api-health.sh" "API Health Check"

# テスト2: API検索機能
run_test "test-api-search.sh" "API Search Functionality"

# テスト3: API最近のノート
run_test "test-api-recent.sh" "API Recent Notes"

# テスト4: APIノート保存
run_test "test-api-save.sh" "API Note Save"

# テスト5: データフロー統合テスト
run_test "test-data-flow.sh" "Data Flow Integration"

# テスト6: MCPサーバー接続
run_test "test-mcp-connection.sh" "MCP Server Connection"

# テスト7: Cloudflare Tunnel
run_test "test-tunnel.sh" "Cloudflare Tunnel"

# 結果サマリー
echo "📊 TEST EXECUTION SUMMARY"
echo "========================"
echo "Total Tests:   $TOTAL_TESTS"
echo "✅ Passed:      $PASSED_TESTS"
echo "❌ Failed:      $FAILED_TESTS"
echo "⚠️  Warnings:    $WARNED_TESTS"
echo

# 成功率の計算
if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
    echo "Success Rate:  $SUCCESS_RATE%"
else
    SUCCESS_RATE=0
fi

echo

# 全体結果の判定
if [ $FAILED_TESTS -eq 0 ]; then
    echo "🎉 ALL SMOKE TESTS PASSED!"
    echo "   YuiHub system is ready for refactoring"
    echo
    exit 0
elif [ $SUCCESS_RATE -ge 80 ]; then
    echo "⚠️  MOSTLY SUCCESSFUL ($SUCCESS_RATE% pass rate)"
    echo "   Some tests failed, but core functionality appears working"
    echo "   Review failed tests before proceeding with refactoring"
    echo
    exit 1
else
    echo "❌ CRITICAL FAILURES DETECTED"
    echo "   Multiple core functions are not working properly"
    echo "   System is not ready for refactoring - fix issues first"
    echo
    exit 2
fi
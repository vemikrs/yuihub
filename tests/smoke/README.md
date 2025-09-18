# YuiHub スモークテスト

このディレクトリにはYuiHubの主要機能を検証するスモークテストが含まれています。

## テスト概要

スモークテストは、システムの基本的な機能が正常に動作することを迅速に確認するためのテストです。
リファクタリングや変更後の回帰テストとして使用します。

## テスト構成

### 1. API エンドポイントテスト
- `test-api-health.sh` - ヘルスチェック
- `test-api-search.sh` - 検索機能
- `test-api-recent.sh` - 最近のノート取得
- `test-api-save.sh` - ノート保存

### 2. データ統合テスト
- `test-data-flow.sh` - 保存→インデックス更新→検索の一連フロー

### 3. MCP サーバーテスト
- `test-mcp-connection.sh` - MCP サーバー接続確認

### 4. 統合実行
- `run-all-tests.sh` - 全テスト一括実行

## 実行方法

### VS Codeタスクから実行
1. Ctrl+Shift+P でコマンドパレット開く
2. "Tasks: Run Task" を選択
3. "YuiHub: Smoke Tests" カテゴリから実行

### コマンドラインから実行
```bash
# 全テスト実行
./tests/smoke/run-all-tests.sh

# 個別テスト実行
./tests/smoke/test-api-health.sh
```

## 前提条件

- YuiHub API サーバーが http://localhost:3000 で起動中
- 検索インデックスが構築済み
- curl, python3 がインストール済み

## テスト結果

テスト結果は以下の形式で出力されます：
- ✅ PASS: テスト成功
- ❌ FAIL: テスト失敗
- ⚠️  WARN: 警告（継続可能）
# YuiHub - AI会話メモリ横断基盤

YuiHubは、複数のAI（ChatGPT、Claude、GitHub Copilot等）での会話・意思決定を統一された外部記憶として管理するシステムです。

## ⚠️ 重要：開発作業時の必須ルール

### プロセス管理の絶対原則
- **APIサーバー起動は必ずVS Code Tasksを使用すること**
  - ❌ 絶対禁止: `run_in_terminal`で直接`npm run`コマンド実行
  - ✅ 必須: `run_task`でVS Code Tasks経由での起動
  - 理由: 直接コマンド実行は割り込み停止でプロセスが残り、システム不安定化を招く

### 正しいプロセス管理手順
1. **起動**: `run_task`を使用してバックグラウンドタスク実行
2. **確認**: タスクのログ出力で正常起動を確認
3. **テスト**: 別ターミナルで`curl`等によるエンドポイント確認
4. **停止**: VS Code Task終了機能またはTask管理画面から適切に停止

### Cloudflare Tunnel統合
- 新しいNode.js統合システムを使用
- ENABLE_TUNNEL=true環境変数でAPI統合動作
- バックグラウンド実行とライフサイクル管理を重視

## アーキテクチャ

### コンポーネント構成
- **yuihub_api/**: Fastify HTTP API サーバー（メインAPI）
- **yuihub_mcp/**: Model Context Protocol サーバー（プロトコルアダプタ）  
- **scripts/**: 検索インデックス構築、要約生成スクリプト
- **chatlogs/**: Markdownファイル保存場所（YAML Front-Matter付き）

### プロトコル二面対応
```
ChatGPT Actions → HTTP API → Storage
Claude Desktop → MCP Server → HTTP API → Storage
```

### データフォーマット
```yaml
---
id: ulid()                    # ULID形式の一意ID
date: 2025-09-18T21:00+09:00  # ISO8601タイムスタンプ
actors: [chatgpt, claude]     # 参加AI一覧
topic: "API設計検討"          # 会話トピック
tags: [architecture, api]    # 分類タグ
decision: 採用               # 意思決定（採用/保留/却下）
links: [https://...]         # 参考URL
---
## 要点（3行）
- ポイント1
- ポイント2
- ポイント3

## 本文
詳細な会話内容や根拠
```

## 技術スタック

### Backend
- **Node.js 18+** with ES Modules
- **Fastify 4.x** - 高性能HTTPサーバー
- **@modelcontextprotocol/sdk** - MCP実装
- **Lunr.js** - 軽量全文検索
- **gray-matter** - YAML Front-Matter処理
- **ulid** - 一意ID生成

### 検索・インデックス
- **Lunr** - クライアント側全文検索
- **チャンク化** - 長文を1000文字単位で分割
- **TF-IDF** - 用語重要度計算
- **日英対応** - 日本語・英語混在検索

### ストレージアダプタパターン
- **Local**: ローカルファイルシステム
- **GitHub**: GitHub API経由の自動コミット
- **Notion**: 将来拡張予定

## 開発環境

### VS Code統合
- **launch.json**: デバッグ設定（API:9229、MCP:9230）
- **tasks.json**: ビルド・実行・テストタスク
- **compounds**: フルスタック同時起動

### 環境変数
```bash
# API Server
PORT=3000
HOST=localhost
STORAGE_ADAPTER=local|github|notion
LOCAL_STORAGE_PATH=./chatlogs
LUNR_INDEX_PATH=./index/lunr.idx.json

# GitHub Storage
GITHUB_TOKEN=ghp_xxx
GITHUB_OWNER=username
GITHUB_REPO=repository
GITHUB_BRANCH=main

# MCP Server  
YUIHUB_API=http://localhost:3000
```

## API仕様

### HTTP Endpoints
- `GET /health` - ヘルスチェック
- `POST /save` - ノート保存
- `GET /search?q=query` - 全文検索
- `GET /recent?n=20` - 最近の決定事項
- `GET /openapi.yml` - OpenAPI仕様

### MCP Tools
- `save_note(frontmatter, body)` - ノート保存
- `search_notes(query, limit)` - 検索実行
- `get_recent_decisions(limit)` - 最近の決定取得

## コーディング規約

### JavaScript/Node.js
- **ES Modules** - `import/export`使用
- **async/await** - Promise処理
- **エラーハンドリング** - try-catch必須
- **ログ出力** - Fastify logger使用
- **環境変数** - process.env経由

### ファイル命名
- **kebab-case** - スクリプト・設定ファイル
- **camelCase** - JavaScript変数・関数
- **PascalCase** - クラス名
- **UPPER_CASE** - 定数・環境変数

### APIレスポンス形式
```javascript
// 成功レスポンス
{ ok: true, data: {...}, timestamp: "..." }

// エラーレスポンス  
{ ok: false, error: "message", code: "ERROR_CODE" }
```

## プロジェクト固有パターン

### ストレージアダプタ実装
```javascript
export class StorageAdapter {
  constructor(type, config) { ... }
  async save(frontmatter, body) { ... }
  async _saveLocal(path, content) { ... }
  async _saveGithub(path, content) { ... }
}
```

### 検索サービス
```javascript
export class SearchService {
  async loadIndex(indexPath) { ... }
  async search(query, limit) { ... }
  _generateSnippet(text, query) { ... }
}
```

### MCP Server構造
```javascript
server.setRequestHandler(ListToolsRequestSchema, async () => {...});
server.setRequestHandler(CallToolRequestSchema, async (request) => {...});
```

## セキュリティ要件

### 機密情報管理
- `.env` ファイルは git ignore
- `chatlogs/` は実データ除外
- GitHub Token は最小権限
- Cloudflare認証情報は暗号化

### データ検証
- YAML Front-Matter検証
- ULID形式チェック
- 文字エンコーディング（UTF-8）
- ファイルサイズ制限

## パフォーマンス最適化

### 検索性能
- Lunrインデックス事前構築
- チャンクサイズ最適化（1000文字）
- スニペット生成の効率化

### メモリ使用量
- 大量ファイル処理時のストリーミング
- インデックス分割読み込み
- ガベージコレクション考慮

## テスト戦略

### API テスト
```bash
curl -X POST http://localhost:3000/save \
  -H "Content-Type: application/json" \
  -d '{"frontmatter": {...}, "body": "..."}'
```

### MCP テスト
- stdio通信テスト
- Tools呼び出し検証
- エラーハンドリング確認

## デプロイメント

### Cloudflare Tunnel
- 開発環境外部公開
- ChatGPT Actions統合
- 一時URL自動生成

### GitHub Actions
- 自動インデックス更新
- 週次要約生成
- CI/CDパイプライン

## トラブルシューティング

### よくある問題
1. **ポート競合**: `lsof -i :3000` で確認
2. **インデックス未読み込み**: パス設定確認  
3. **MCP接続エラー**: stdio通信確認
4. **Cloudflare DNS**: 伝播待ち（数分）

### デバッグ方法
- VS Code デバッガー利用
- ログレベル調整
- ネットワーク通信確認

## 将来拡張

### Phase 2
- TypeScript段階的導入
- Vector検索（sqlite-vec）
- Web UI（Astro/React）

### Enterprise機能
- RBAC（Role-Based Access Control）
- データ暗号化
- 監査ログ
- マルチテナント

---

このinstructionに基づいて、YuiHubプロジェクトの一貫した開発を支援してください。
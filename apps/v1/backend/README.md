# @yuihub/server

**YuiHub Semantic Memory API Server**

Agentic AI のためのセマンティックメモリサーバー。思考、意思決定、コンテキストをローカルに保存・検索。

## クイックスタート

```bash
# サーバー起動 (ポート 4182)
npx @yuihub/server

# または グローバルインストール
npm install -g @yuihub/server
yuihub-server
```

## 機能

- **セマンティック検索**: BGE-M3 による高精度ベクトル検索
- **ローカルファースト**: すべてのデータはローカルに保存
- **MCP 対応**: `@yuihub/mcp-server` と連携
- **File-based 認証**: `~/.yuihub/.token` による自動認証

## 設定

環境変数または `~/.yuihub/config.yaml`:

```yaml
server:
  port: 4182
  host: "0.0.0.0"

storage:
  dataDir: "~/.yuihub/data"

auth:
  enabled: true
  tokenPath: "~/.yuihub/.token"
```

## API エンドポイント

| メソッド | パス              | 説明                     |
| :------- | :---------------- | :----------------------- |
| GET      | `/health`         | ヘルスチェック           |
| POST     | `/save`           | エントリ保存             |
| GET      | `/search`         | セマンティック検索       |
| POST     | `/threads/new`    | セッション作成           |
| POST     | `/checkpoints`    | チェックポイント作成     |
| GET      | `/export/context` | コンテキストパケット取得 |

## MCP Server との連携

```bash
# 別ターミナルで MCP Server を起動
npx @yuihub/mcp-server
```

## ライセンス

MIT

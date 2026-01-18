# @yuihub/mcp-server

**YuiHub MCP Protocol Adapter**

Model Context Protocol (MCP) を通じて YuiHub のセマンティックメモリ機能を AI エージェント (Antigravity, Cursor, Claude Desktop) に提供。

## クイックスタート

```bash
# stdio モードで起動
npx @yuihub/mcp-server

# グローバルインストール
npm install -g @yuihub/mcp-server
yuihub-mcp
```

## 設定

### Antigravity

`~/.gemini/antigravity/mcp_config.json`:

```json
{
  "mcpServers": {
    "yuihub": {
      "command": "npx",
      "args": ["-y", "@yuihub/mcp-server"]
    }
  }
}
```

### Cursor

`~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "yuihub": {
      "command": "npx",
      "args": ["-y", "@yuihub/mcp-server"]
    }
  }
}
```

## 前提条件

`@yuihub/server` が起動している必要があります:

```bash
npx @yuihub/server
```

## MCP ツール

| ツール              | 説明                 |
| :------------------ | :------------------- |
| `save_thought`      | メモリに保存         |
| `search_memory`     | セマンティック検索   |
| `start_session`     | セッション作成       |
| `fetch_context`     | コンテキスト取得     |
| `create_checkpoint` | チェックポイント作成 |

## MCP リソース

| URI                      | 説明         |
| :----------------------- | :----------- |
| `yuihub://recent`        | 最近のメモリ |
| `yuihub://system/status` | システム状態 |

## 環境変数

| 変数             | デフォルト              | 説明            |
| :--------------- | :---------------------- | :-------------- |
| `YUIHUB_API_URL` | `http://localhost:4182` | Backend API URL |
| `YUIHUB_TOKEN`   | (自動取得)              | 認証トークン    |

## ライセンス

MIT

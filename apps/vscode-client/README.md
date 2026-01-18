# YuiHub VSCode Client (V1)

**ローカルファースト・セマンティックメモリ for Agentic AI**

YuiHub Engine に接続し、思考・意思決定・コンテキストをセマンティックメモリに保存・検索する拡張機能です。

---

## ⚠️ Beta 版

- 機能は安定していますが、仕様変更の可能性があります
- 最小要件: **VSCode 1.104.0 以上** (Language Model Tools API)

---

## 📌 主な機能

### コマンド

| コマンド                           | 説明                                             |
| :--------------------------------- | :----------------------------------------------- |
| `YuiHub: Smoke Test (Health)`      | Backend 接続確認                                 |
| `YuiHub: Search…`                  | セマンティック検索                               |
| `YuiHub: Save Selection to Memory` | 選択テキストをメモリに保存                       |
| `YuiHub: Create Checkpoint`        | 意思決定チェックポイント作成                     |
| `YuiHub: Install MCP Server`       | Antigravity/Cursor に MCP 設定を自動インストール |
| `YuiHub: Set API Token`            | API トークン設定                                 |
| `YuiHub: Open Logs`                | ログ表示                                         |

### Language Model Tools (AI アシスト)

Copilot/Antigravity から直接呼び出せる 5 つのツール:

| ツール                     | 説明                 |
| :------------------------- | :------------------- |
| `yuihub_save_thought`      | メモリに保存         |
| `yuihub_search_memory`     | セマンティック検索   |
| `yuihub_start_session`     | セッション作成       |
| `yuihub_fetch_context`     | コンテキスト取得     |
| `yuihub_create_checkpoint` | チェックポイント作成 |

### 未実装機能 (旧 README から)

以下は V0 から引き継がれた設計ですが、V1 では未実装または仕様変更されています:

- `yuihub.defaultSource` / `yuihub.defaultAuthor` (未実装)
- `yuihub.defaultThreadId` (未実装 - セッション自動管理に移行)
- `YuiHub: Issue New Thread ID` (未実装 - `yuihub_start_session` に統合)
- `yuihub.authHeader` / `yuihub.authScheme` (未実装 - File-based Handshake に移行)
- `yuihub.requestTimeoutMs` (未実装)
- `yuihub.logResponseBodies` (未実装)
- `yuihub.saveConfirmOnFullDocument` / `yuihub.saveConfirmFullDocThresholdBytes` (未実装)
- `YuiHub: Open Privacy Policy` コマンド (未実装)

---

## ⚙ インストール方法

### 1. Backend (YuiHub Engine) 起動

```bash
# monorepo から
pnpm dev:backend

# または npm グローバルインストール (リリース後)
npx @yuihub/mcp-server
```

### 2. 拡張インストール

1. VSIX をインストール、または Visual Studio Marketplace からインストール
2. Backend が起動していれば自動認証 (File-based Handshake)

### 3. MCP Server 設定 (Antigravity/Cursor 用)

コマンドパレットで実行:

```
YuiHub: Install MCP Server (Antigravity/Cursor)
```

自動設定される箇所:

- Antigravity: `~/.gemini/antigravity/mcp_config.json`
- Cursor: `~/.cursor/mcp.json`

---

## 設定

| 設定                    | デフォルト              | 説明                           |
| :---------------------- | :---------------------- | :----------------------------- |
| `yuihub.apiBaseUrl`     | `http://localhost:4182` | Backend URL                    |
| `yuihub.apiKey`         | (空)                    | API トークン (File-based 優先) |
| `yuihub.useManagedAuth` | `true`                  | File-based Token を使用        |
| `yuihub.searchLimit`    | `10`                    | 検索結果上限                   |

---

## 🛠 トラブルシュート

| 状況                              | 解決案                                  |
| --------------------------------- | --------------------------------------- |
| 接続失敗                          | Backend 起動確認 (`pnpm dev:backend`)   |
| MCP ツールが見えない              | `Install MCP Server` 実行後、IDE 再起動 |
| Language Model Tools が動作しない | VSCode 1.104.0 以上が必要               |

---

## 🔒 プライバシー

- **Offline Context**: すべてのデータはローカルに保存
- **テレメトリなし**: 外部送信は一切行いません
- 詳細: [PRIVACY.md](./PRIVACY.md)

---

## 📝 ライセンス

[MIT License](https://github.com/vemikrs/yuihub/blob/main/LICENSE)

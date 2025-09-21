# YuiHub - AI会話メモリ横断基盤

[![CI](https://github.com/user/yuihub/workflows/CI%20-%20Test%20and%20Validate/badge.svg)](https://github.com/user/yuihub/actions)
[![Build Index](https://github.com/user/yuihub/workflows/Build%20Search%20Index%20and%20Summaries/badge.svg)](https://github.com/user/yuihub/actions)

**YuiHub**は、複数のAI（ChatGPT、Claude、GitHub Copilot等）での会話・意思決定を統一された外部記憶として管理するシステムです。**中立フォーマット**（YAML + Markdown）でデータを保存し、**MCP**と**HTTP API**の二面でアクセスできる軽量な基盤を提供します。

## 🌟 主な特徴

- **🤖 AI横断対応**: ChatGPT Actions、Claude Desktop（MCP）、VS Code、Cursor等から同じデータにアクセス
- **📝 中立フォーマット**: YAML Front-Matter + Markdownによるポータブルなデータ形式  
- **🔍 高速全文検索**: Lunr.jsベースの事前索引による10-20秒以内の検索応答
- **💾 柔軟なストレージ**: ローカル、GitHub、Notion（予定）への保存対応
- **📊 自動要約**: 週次レポートと用語逆引き辞書の自動生成
- **💸 最小コスト**: GitHub Pages + 事前索引によるゼロ円運用が可能

## 🏗️ アーキテクチャ

```
┌─────────────────────────────────────────────────┐
│  AI Clients                                     │
│  ├─ ChatGPT Plus (HTTP Actions)               │
│  ├─ Claude Desktop (MCP)                      │  
│  └─ VS Code / Cursor / Continue (MCP)          │
├─────────────────────────────────────────────────┤
│  Protocol Layer                                 │
│  ├─ HTTP API (OpenAPI 3.0)                    │
│  └─ MCP Server (Model Context Protocol)        │
├─────────────────────────────────────────────────┤
│  YuiHub Core                                   │
│  ├─ Fastify Server (Node.js)                  │
│  ├─ Storage Adapters (GitHub/Local/Notion)     │
│  └─ Lunr Search Engine                        │
├─────────────────────────────────────────────────┤
│  Automation                                    │  
│  ├─ GitHub Actions (CI/CD)                     │
│  ├─ Search Index Builder                       │
│  └─ Weekly Summarizer                         │
└─────────────────────────────────────────────────┘
```

## 🚀 クイックスタート

### 必要な環境

- **Node.js** 18.0+
- **npm** または **yarn**
- **Git**（GitHub連携時）

### 1. インストールと設定

```bash
# リポジトリのクローン
git clone https://github.com/your-username/yuihub.git
cd yuihub

# 依存関係のインストール  
npm run install-all

# 設定ファイルのコピー
cp yuihub_api/.env.example yuihub_api/.env
```

### 2. 環境変数の設定

`yuihub_api/.env` を編集：

```bash
# 基本設定
PORT=3000
HOST=localhost
STORAGE_ADAPTER=local

# ローカル保存の場合
LOCAL_STORAGE_PATH=./chatlogs

# GitHub連携の場合（オプション）
STORAGE_ADAPTER=github
GITHUB_TOKEN=your_github_token
GITHUB_OWNER=your_username
GITHUB_REPO=your_repo_name
GITHUB_BRANCH=main
GITHUB_PATH=chatlogs
```

### 3. APIサーバの起動

#### VS Code統合デバッグ（推奨）

**F5** → デバッグ設定を選択：

| 設定名 | 用途 | デバッグポート |
|--------|------|---------------|
| **Debug YuiHub Full Stack** | 両サーバ同時デバッグ | 9229, 9230 |
| **Run YuiHub Full Stack (Production)** | 両サーバ本番実行 | なし |
| **Debug API Only** | APIサーバーのみ | 9229 |
| **Debug MCP Only** | MCPサーバーのみ | 9230 |

#### ターミナルでの起動

```bash
# 開発モード（ファイル監視）
npm run dev:api

# 本番モード
npm run start:api

# MCPサーバー（別ターミナル）
npm run start:mcp
```

#### VS Code Tasks（推奨）

**Ctrl+Shift+P** → "Tasks: Run Task" → 以下から選択：

- **`YuiHub: Start API Server`** - 本番モードでAPI起動
- **`YuiHub: Start API Server (Dev)`** - 開発モード（ファイル監視）
- **`YuiHub: Start MCP Server`** - Claude Desktop用MCPサーバー
- **`YuiHub: Build Search Index`** - 全文検索インデックス構築
- **`YuiHub: Test API Endpoints`** - 全APIエンドポイントの動作確認
- **`YuiHub: Stop All Servers`** - 全YuiHubプロセス停止

### 4. 検索インデックスの構築

```bash
# Lunr検索インデックスを構築
npm run build-index

# 用語逆引き辞書を構築  
npm run build-terms

# 週次要約を生成
npm run build-summaries

# 全て実行
npm run build-all
```

### 5. MCPサーバの起動（オプション）

Claude Desktop等のMCPクライアント用：

```bash
npm run start:mcp
```

**推奨**: VS Codeの **"Debug YuiHub Full Stack"** で両サーバを同時起動

## 📖 使用方法

### ChatGPTでの利用

#### 1. ローカル開発での利用

1. **Custom Actions**でOpenAPI仕様（`yuihub_api/openapi.yml`）を読み込み
2. 会話の保存には以下のプロンプトを使用：

```
この会話を保存してください。

SAVE:
---
topic: "API設計の検討"  
actors: [chatgpt]
tags: [architecture, api-design]
decision: 採用
---
## 要点（3行）
- RESTfulなAPI設計を採用
- OpenAPI仕様による型安全性を確保  
- Fastifyによる高性能な実装

## 本文
（会話の詳細内容）
```

#### 2. Cloudflare Tunnel経由での利用（推奨）

**外部からアクセス可能**な本格的なChatGPT Actions設定：

```bash
# 1. Cloudflare認証（初回のみ）
cloudflared tunnel login

# 2. トンネル設定
npm run tunnel:setup  # または VS Code Task: "YuiHub: Setup Cloudflare Tunnel"

# 3. APIサーバー起動
npm run start:api

# 4. トンネル開始  
npm run tunnel:start  # または VS Code Task: "YuiHub: Start Cloudflare Tunnel"
```

**ChatGPT Custom Actions設定**：
- **Base URL**: セットアップ時に表示される `https://yuihub-xxxxx-api.trycloudflare.com`
- **OpenAPI Schema**: 同URLの `/openapi.yml` エンドポイント
- **認証**: なし（開発環境用）

### Claude Desktopでの利用  

MCPサーバ設定（`claude_desktop_config.json`）：

```json
{
  "mcpServers": {
    "yuihub": {
      "command": "node",
      "args": ["/path/to/yuihub/yuihub_mcp/src/server.js"],
      "env": {
        "YUIHUB_API": "http://localhost:3000"
      }
    }
  }
}
```

利用可能なツール：
- `save_note`: 会話の保存
- `search_notes`: 全文検索
- `get_recent_decisions`: 最近の意思決定一覧

### REST APIでの直接利用

```bash
# 会話を保存
curl -X POST http://localhost:3000/save \
  -H "Content-Type: application/json" \
  -d '{
    "frontmatter": {
      "topic": "テスト会話",
      "actors": ["api"],
      "tags": ["test"],
      "decision": "採用"
    },
    "body": "## テスト内容\nAPI経由でのテスト保存"
  }'

# 検索実行
curl "http://localhost:3000/search?q=API設計&limit=10"

# 最近の決定事項取得
curl "http://localhost:3000/recent?n=20"
```

## 📁 データ形式

### YAML Front-Matter

```yaml
---
id: 01HZXK7QCMXKJ8G2N5D4WVYB3R  # ULID形式の一意ID
date: 2025-09-18T21:00:00+09:00   # ISO8601形式のタイムスタンプ
actors: [chatgpt, copilot]         # 参加AI一覧
topic: "API設計検討"               # 会話のトピック
tags: [api, architecture, poc]     # 分類タグ
decision: 採用                     # 意思決定（採用/保留/却下）
links: ["https://example.com"]     # 参考URL
---
```

### Markdownボディ

```markdown
## 要点（3行）
- ポイント1
- ポイント2  
- ポイント3

## 本文
詳細な会話内容や根拠、引用など
```

## 🔧 カスタマイズ

### ストレージアダプタの追加

`yuihub_api/src/storage.js`を拡張して新しい保存先を追加可能：

```javascript
// Notion対応の例（将来実装予定）
case 'notion':
  return await this._saveNotion(relativePath, content);
```

### 検索エンジンの拡張

軽量ベクトル検索（sqlite-vec等）への拡張も計画：

```javascript
// 将来の拡張例
import { VectorStore } from 'sqlite-vec';
const vectorStore = new VectorStore();
```

## 🧪 テストとデプロイ

### ローカルテスト

```bash
# CI/CD相当のテストを実行
npm test

# API単体テスト
cd yuihub_api && npm test

# MCP単体テスト  
cd yuihub_mcp && npm test
```

### GitHub Actionsによる自動化

- **継続的統合**: PRごとの自動テスト
- **インデックス更新**: チャットログ更新時の自動索引構築
- **週次要約**: 毎週日曜日の自動レポート生成

## 📚 関連ドキュメント

- **[RUNBOOK.md](RUNBOOK.md)** - 運用ガイドとトラブルシューティング
- **[API仕様書](yuihub_api/openapi.yml)** - OpenAPI 3.0形式のAPI仕様
- **[計画書](docs/250918A_PoC/yuihub_poc_plan.md)** - 詳細な設計思想と方針

## 🛣️ ロードマップ

- **v0.1** (現在): 基本的な保存・検索・MCP対応
- **v0.2**: Notion連携、軽量ベクトル検索対応
- **v0.3**: Web UI、RBACとセキュリティ強化  
- **v1.0**: エンタープライズ機能（監査ログ、暗号化等）

## 🤝 コントリビューション

1. このリポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチをプッシュ (`git push origin feature/amazing-feature`)
5. Pull Requestを作成

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は [LICENSE](LICENSE) ファイルを参照してください。

## 🙏 謝辞

- **[Model Context Protocol (MCP)](https://modelcontextprotocol.io/)** - AI横断アクセスの標準化
- **[Lunr.js](https://lunrjs.com/)** - 軽量全文検索エンジン  
- **[Fastify](https://fastify.dev/)** - 高性能Node.jsフレームワーク

---

**YuiHub** - あなたのAI会話を、永続的で検索可能な外部記憶に変換します。
